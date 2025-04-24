import { Dispatch } from '@reduxjs/toolkit'
import { toast } from 'react-toastify'

import {
  handleRateLimitError,
  resetRateLimitBackoff,
  trackMessageSuccess,
  trackMessageFailure,
  resetConnectionHealth,
  isConnectionHealthy,
  addJitter,
} from '../../routes/trade/market-maker/websocketUtils'
import {
  setWsConnected,
  subscribeToPair,
  unsubscribeFromPair,
  updatePrice,
} from '../../slices/makerApi/pairs.slice'
import { logger } from '../../utils/logger'

// Import utility functions for rate limit handling

// Message queue for rate-limited operations
interface QueuedMessage {
  action: string
  payload: any
  priority: number
  timestamp: number
}

/**
 * Centralized WebSocket service that manages a single connection to the maker
 * and handles subscription management, heartbeat, reconnection, etc.
 */
class WebSocketService {
  private static instance: WebSocketService
  private socket: WebSocket | null = null
  private url: string = ''
  private clientId: string = ''
  private dispatch: Dispatch | null = null
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 5
  private reconnectInterval: number = 5000
  private subscribedPairs: Set<string> = new Set()
  private isReconnecting: boolean = false
  private heartbeatInterval: number | null = null
  private lastHeartbeatResponse: number = 0
  private heartbeatTimeout: number = 15000
  private heartbeatIntervalMs: number = 8000
  private networkOnlineHandler: (() => void) | null = null
  private networkOfflineHandler: (() => void) | null = null

  // Message queue system
  private messageQueue: QueuedMessage[] = []
  private processingQueue: boolean = false
  private maxQueueSize: number = 100
  private messageProcessInterval: number = 500
  private messageProcessTimer: number | null = null
  private lastMessageSent: number = 0

  // Track if a connection has been initialized to prevent multiple connections
  public connectionInitialized: boolean = false

  // Connection diagnostics
  private connectionStartTime: number = 0
  private lastSuccessfulConnection: number = 0
  private connectionAttempts: number = 0

  private constructor() {
    logger.info('WebSocketService instance created')
    this.setupNetworkListeners()
  }

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService()
    }
    return WebSocketService.instance
  }

  private setupNetworkListeners(): void {
    this.networkOnlineHandler = () => {
      logger.info('Network connection restored')
      if (!this.isConnected() && this.connectionInitialized) {
        this.handleReconnect()
      }
    }

    this.networkOfflineHandler = () => {
      logger.info('Network connection lost')
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.handleClose(new CloseEvent('network_offline'))
      }
    }

    window.addEventListener('online', this.networkOnlineHandler)
    window.addEventListener('offline', this.networkOfflineHandler)
  }

  private cleanupNetworkListeners(): void {
    if (this.networkOnlineHandler) {
      window.removeEventListener('online', this.networkOnlineHandler)
    }
    if (this.networkOfflineHandler) {
      window.removeEventListener('offline', this.networkOfflineHandler)
    }
  }

  /**
   * Add a message to the send queue with priority
   * @param action Action type for the message
   * @param payload Payload data
   * @param priority Priority (higher numbers = higher priority)
   * @returns True if message was added, false if queue is full
   */
  private queueMessage(
    action: string,
    payload: any,
    priority: number = 1
  ): boolean {
    // Don't queue if not connected
    if (!this.isConnected()) {
      logger.debug(
        `WebSocketService: Not queuing message, socket not connected (${action})`
      )
      return false
    }

    // Check if queue is full
    if (this.messageQueue.length >= this.maxQueueSize) {
      logger.warn(
        `WebSocketService: Message queue full, dropping message (${action})`
      )
      return false
    }

    // Add message to queue
    this.messageQueue.push({
      action,
      payload,
      priority,
      timestamp: Date.now(),
    })

    // Sort queue by priority (highest first)
    this.messageQueue.sort((a, b) => b.priority - a.priority)

    // Start processing if not already running
    if (!this.processingQueue) {
      this.processMessageQueue()
    }

    return true
  }

  /**
   * Process the message queue with rate limiting
   */
  private processMessageQueue(): void {
    if (this.processingQueue) return

    this.processingQueue = true

    const processNext = () => {
      if (this.messageQueue.length === 0) {
        this.processingQueue = false
        if (this.messageProcessTimer) {
          window.clearTimeout(this.messageProcessTimer)
          this.messageProcessTimer = null
        }
        return
      }

      // Check if we're connected
      if (!this.isConnected()) {
        logger.debug(
          'WebSocketService: Socket not connected, pausing message queue'
        )
        this.processingQueue = false
        return
      }

      const now = Date.now()
      const timeSinceLastMessage = now - this.lastMessageSent

      if (timeSinceLastMessage >= this.messageProcessInterval) {
        // Process the next message
        const message = this.messageQueue.shift()
        if (message) {
          try {
            const payload = { action: message.action, ...message.payload }
            this.socket?.send(JSON.stringify(payload))
            this.lastMessageSent = now

            // Track message success and reset backoff on successful sends
            trackMessageSuccess()

            // Add additional delay if connection isn't healthy to avoid overwhelming
            if (!isConnectionHealthy()) {
              this.messageProcessInterval = Math.min(
                this.messageProcessInterval * 1.5,
                2000
              )
              logger.debug(
                `WebSocketService: Increasing message interval to ${this.messageProcessInterval}ms due to poor connection health`
              )
            } else if (this.messageProcessInterval > 500) {
              // Gradually reduce interval back to normal if connection is healthy
              this.messageProcessInterval = Math.max(
                500,
                this.messageProcessInterval * 0.9
              )
            }

            // Reset backoff on successful sends (after a delay)
            setTimeout(() => resetRateLimitBackoff(), 2000)

            logger.debug(
              `WebSocketService: Sent ${message.action} message from queue`
            )
          } catch (error) {
            // Track message failure and leave in queue if it's a high priority message
            trackMessageFailure(error)
            logger.error(
              `WebSocketService: Error sending queued message`,
              error
            )

            // Re-queue high priority messages on failure (with increased priority)
            if (message.priority >= 3) {
              this.queueMessage(
                message.action,
                message.payload,
                message.priority + 1
              )
            }
          }
        }
      }

      // Schedule next processing with adaptive timing based on connection health
      const nextDelay = isConnectionHealthy()
        ? Math.max(this.messageProcessInterval - timeSinceLastMessage, 10)
        : addJitter(this.messageProcessInterval) // Add jitter to delay when connection not healthy

      this.messageProcessTimer = window.setTimeout(processNext, nextDelay)
    }

    processNext()
  }

  /**
   * Initialize the WebSocket connection with a URL, client ID, and dispatch
   *
   * @param url Base URL of the maker service
   * @param clientId Unique client identifier
   * @param dispatch Redux dispatch function
   */
  public init(url: string, clientId: string, dispatch: Dispatch): boolean {
    // Skip if URL is not provided
    if (!url) {
      logger.error('WebSocketService init: No URL provided')
      return false
    }

    // Skip if already connected to the same URL
    const cleanUrl = url.replace(/\/+$/, '')
    if (
      this.connectionInitialized &&
      this.url === cleanUrl &&
      this.isConnected()
    ) {
      logger.info(
        'WebSocketService: Already connected to the same URL, skipping initialization'
      )
      return true
    }

    // Close any existing connection to a different URL
    if (this.url !== cleanUrl && this.socket) {
      logger.info(
        `WebSocketService: Switching URL from ${this.url} to ${cleanUrl}`
      )
      this.close()
    }

    // Set up connection parameters
    this.url = cleanUrl
    this.clientId = clientId
    this.dispatch = dispatch
    this.connectionInitialized = true
    this.connectionAttempts++

    // Start connection
    logger.info(`WebSocketService: Initializing connection to ${cleanUrl}`)
    return this.connect()
  }

  /**
   * Updates the WebSocket URL and reconnects if necessary
   *
   * @param url New URL to connect to
   */
  public updateUrl(url: string): boolean {
    if (!url) {
      logger.error('WebSocketService updateUrl: No URL provided')
      return false
    }

    const cleanUrl = url.replace(/\/+$/, '')
    if (this.url !== cleanUrl) {
      logger.info(
        `WebSocketService: Updating URL from ${this.url} to ${cleanUrl}`
      )
      this.url = cleanUrl
      this.reconnectAttempts = 0

      if (this.socket) {
        this.close()
        return this.connect()
      }
    }

    return this.isConnected()
  }

  /**
   * Internal method to establish WebSocket connection
   */
  private connect(): boolean {
    if (!this.url || !this.clientId) {
      logger.error('WebSocketService connect: URL or client ID not set')
      this.connectionInitialized = false
      return false
    }

    // Skip if connection is already in progress
    if (this.socket?.readyState === WebSocket.CONNECTING) {
      logger.info('WebSocketService: Connection already in progress')
      return true
    }

    try {
      // Format WebSocket URL
      const baseUrl = this.url.replace(/\/+$/, '')
      const wsUrl = baseUrl.replace(/^http/, 'ws')
      const fullWsUrl = `${wsUrl}/api/v1/market/ws/${this.clientId}`

      // Track connection start time
      this.connectionStartTime = Date.now()
      logger.info(`WebSocketService: Connecting to ${fullWsUrl}`)

      // Create new WebSocket
      this.socket = new WebSocket(fullWsUrl)

      // Set up event handlers
      this.socket.onopen = this.handleOpen.bind(this)
      this.socket.onmessage = this.handleMessage.bind(this)
      this.socket.onclose = this.handleClose.bind(this)
      this.socket.onerror = this.handleError.bind(this)

      return true
    } catch (error) {
      logger.error('WebSocketService connect: Error creating WebSocket', error)
      this.connectionInitialized = false
      return false
    }
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    const connectionTime = Date.now() - this.connectionStartTime
    this.lastSuccessfulConnection = Date.now()

    logger.info(`WebSocketService: Connected in ${connectionTime}ms`)

    if (this.dispatch) {
      this.dispatch(setWsConnected(true))
    }

    this.reconnectAttempts = 0

    // Reset connection health metrics
    resetConnectionHealth()
    this.messageProcessInterval = 500 // Reset to default

    // Synchronize subscriptions to ensure client and server are in sync
    this.syncSubscriptions()

    this.startHeartbeat()

    // Reset rate limiting after successful connection
    resetRateLimitBackoff()
  }

  /**
   * Synchronize subscriptions with the server
   * This ensures the server knows exactly what we're subscribed to
   */
  private syncSubscriptions(): void {
    if (this.subscribedPairs.size === 0) {
      logger.debug('WebSocketService: No pairs to sync')
      return
    }

    const pairs = Array.from(this.subscribedPairs)
    logger.info(
      `WebSocketService: Synchronizing ${pairs.length} subscriptions with server`
    )

    this.queueMessage('sync_subscriptions', { pairs }, 5) // Highest priority
  }

  /**
   * Handle WebSocket message event
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data)

      // Always update heartbeat timestamp when we receive any message
      this.lastHeartbeatResponse = Date.now()

      // Handle message based on action type
      if (data.action === 'price_update') {
        if (this.dispatch) {
          this.dispatch(updatePrice(data.data))
        }
        // Count successful message receipt
        trackMessageSuccess()
      } else if (data.action === 'pong') {
        logger.debug('WebSocketService: Received pong response')
        // Reset rate limit and track success
        resetRateLimitBackoff()
        trackMessageSuccess()
      } else if (data.action === 'subscribed') {
        logger.info(`WebSocketService: Successfully subscribed to ${data.pair}`)
        resetRateLimitBackoff()
        trackMessageSuccess()
      } else if (data.action === 'sync_result') {
        this.handleSyncResult(data)
      } else if (data.error) {
        logger.error(`WebSocketService: Server reported error: ${data.error}`)
        trackMessageFailure(`Server error: ${data.error}`)

        // Handle rate limit errors specifically
        if (data.error.includes('Rate limit exceeded')) {
          handleRateLimitError()
        }
      }
    } catch (error) {
      logger.error('WebSocketService: Error parsing message', error)
      trackMessageFailure('Error parsing message')
    }
  }

  /**
   * Handle subscription sync result
   */
  private handleSyncResult(data: any): void {
    if (data.success) {
      logger.info(
        `WebSocketService: Subscription sync successful with ${data.subscribed_pairs?.length || 0} pairs`
      )

      // Reset backoff and track success
      resetRateLimitBackoff()
      trackMessageSuccess()

      // Update local subscription state if it's different from server
      if (data.subscribed_pairs && Array.isArray(data.subscribed_pairs)) {
        const serverPairs = new Set<string>(data.subscribed_pairs as string[])
        const localPairs = this.subscribedPairs

        // Check for differences
        let differences = false

        // Find pairs we think we're subscribed to that the server doesn't have
        for (const pair of localPairs) {
          if (!serverPairs.has(pair)) {
            logger.warn(
              `WebSocketService: Local subscription to ${pair} not reflected on server, resubscribing`
            )
            this.subscribeToPair(pair)
            differences = true
          }
        }

        // Find pairs the server thinks we're subscribed to that we don't have locally
        for (const pair of serverPairs) {
          if (!localPairs.has(pair)) {
            logger.warn(
              `WebSocketService: Server subscription to ${pair} not reflected locally, unsubscribing`
            )
            this.unsubscribeFromPair(pair)
            differences = true
          }
        }

        if (!differences) {
          logger.debug(
            'WebSocketService: Client and server subscriptions are in sync'
          )
        }
      }
    } else {
      logger.error(
        `WebSocketService: Subscription sync failed: ${data.error || 'Unknown error'}`
      )
      trackMessageFailure(`Sync failed: ${data.error || 'Unknown error'}`)

      // Retry sync after a short delay
      setTimeout(() => this.syncSubscriptions(), 3000)
    }
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    logger.info(
      `WebSocketService: Disconnected with code ${event.code}, reason: ${event.reason || 'No reason provided'}`
    )

    if (this.dispatch) {
      this.dispatch(setWsConnected(false))
    }

    this.stopHeartbeat()

    // Display specific messages for common close codes
    if (event.code === 1006) {
      logger.warn(
        'WebSocketService: Abnormal closure (code 1006) - The connection was closed abnormally'
      )
      toast.warning(
        'Connection to maker was lost. Attempting to reconnect...',
        {
          toastId: 'websocket-lost-connection',
        }
      )
    } else if (event.code === 1011) {
      logger.error(
        'WebSocketService: Server error (code 1011) - The server encountered an error'
      )
      toast.error('Server error detected. Attempting to reconnect...', {
        toastId: 'websocket-server-error',
      })
    }

    if (!event.wasClean) {
      this.handleReconnect()
    } else {
      // Only mark as not initialized on clean close
      this.connectionInitialized = false
    }
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(event: Event): void {
    logger.error('WebSocketService: WebSocket error', event)
    trackMessageFailure('WebSocket error event')

    if (!this.socket) {
      logger.warn(
        'WebSocketService: Socket reference missing during error handling'
      )
      this.handleReconnect()
      return
    }

    try {
      // Get connection status for debugging
      const readyState = this.socket.readyState
      logger.debug(`WebSocketService: Socket state during error: ${readyState}`)

      // If already closing/closed, just reconnect
      if (readyState === WebSocket.CLOSING || readyState === WebSocket.CLOSED) {
        this.handleReconnect()
        return
      }

      // For CONNECTING or OPEN states, try to close cleanly first
      this.socket.close(1006, 'Error event occurred')
    } catch (err) {
      logger.warn('WebSocketService: Error during socket cleanup', err)
    } finally {
      // Always reconnect after an error
      this.handleReconnect()
    }
  }

  /**
   * Start heartbeat to keep connection alive
   * Using a ping-only approach
   */
  private startHeartbeat(): void {
    this.stopHeartbeat()

    this.lastHeartbeatResponse = Date.now()

    this.heartbeatInterval = window.setInterval(() => {
      // Check if we're still connected
      if (!this.isConnected()) {
        logger.warn(
          'WebSocketService: Socket not connected during heartbeat check'
        )
        return
      }

      try {
        // Direct ping (not queued) for more reliability
        if (this.socket) {
          this.socket.send(JSON.stringify({ action: 'ping' }))
          logger.debug('WebSocketService: Sent ping message')
        }
      } catch (err) {
        logger.error('WebSocketService: Failed to send ping', err)
        // Track error for health metrics
        trackMessageFailure('Failed to send ping')
      }

      // Check for heartbeat timeout
      const now = Date.now()
      const elapsed = now - this.lastHeartbeatResponse

      if (elapsed > this.heartbeatTimeout) {
        logger.warn(
          `WebSocketService: Ping timeout (${elapsed}ms) - attempting recovery`
        )

        try {
          // Send a direct ping - bypass the queue for immediate response
          if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ action: 'ping' }))
            logger.debug('WebSocketService: Sent emergency ping')

            // Also sync subscriptions
            if (this.subscribedPairs.size > 0) {
              const pairs = Array.from(this.subscribedPairs)
              this.socket.send(
                JSON.stringify({
                  action: 'sync_subscriptions',
                  pairs,
                })
              )
              logger.debug('WebSocketService: Sent subscription sync')
            }
          }

          // Give it one more chance with a shorter timeout
          setTimeout(() => {
            const newElapsed = Date.now() - this.lastHeartbeatResponse
            if (newElapsed > this.heartbeatTimeout / 2) {
              logger.warn(
                'WebSocketService: Recovery ping failed, reconnecting'
              )
              this.handleReconnect()
            } else {
              logger.info('WebSocketService: Recovery ping successful')
            }
          }, 2000) // Shorter wait time (2 seconds)
        } catch (err) {
          logger.error('WebSocketService: Failed to send recovery ping', err)
          this.handleReconnect()
        }
      }
    }, this.heartbeatIntervalMs)
  }

  /**
   * Stop the heartbeat interval
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
      logger.debug('WebSocketService: Heartbeat stopped')
    }

    // Also clear message processing
    if (this.messageProcessTimer) {
      clearTimeout(this.messageProcessTimer)
      this.messageProcessTimer = null
      this.processingQueue = false
    }
  }

  /**
   * Handle reconnection logic with exponential backoff and improved network checking
   */
  private handleReconnect(): void {
    if (this.isReconnecting) {
      logger.info('WebSocketService: Already attempting to reconnect')
      return
    }

    this.isReconnecting = true

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.warn(
        `WebSocketService: Maximum reconnect attempts (${this.maxReconnectAttempts}) reached`
      )

      if (this.dispatch) {
        this.dispatch(setWsConnected(false))
      }

      toast.error(
        'Could not establish a stable connection. Please try refreshing the connection.',
        {
          autoClose: 2000,
          toastId: 'websocket-max-reconnects',
        }
      )

      this.isReconnecting = false
      return
    }

    // First check if network is available
    if (!navigator.onLine) {
      logger.warn(
        'WebSocketService: Network is offline, waiting for connection'
      )
      toast.warning(
        'Network connection unavailable. Will reconnect when online.',
        {
          toastId: 'websocket-network-offline',
        }
      )
      this.isReconnecting = false
      return
    }

    // Improved exponential backoff with jitter
    const baseDelay = Math.min(
      this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts),
      30000
    )
    const jitter = Math.random() * 1000 // Add up to 1 second of random jitter
    const delay = baseDelay + jitter

    logger.info(
      `WebSocketService: Reconnecting in ${delay}ms (attempt ${
        this.reconnectAttempts + 1
      } of ${this.maxReconnectAttempts})`
    )

    // Clean up existing socket
    if (this.socket) {
      try {
        if (
          this.socket.readyState === WebSocket.OPEN ||
          this.socket.readyState === WebSocket.CONNECTING
        ) {
          this.socket.close(1000, 'Reconnecting')
        }
      } catch (e) {
        logger.debug(
          'WebSocketService: Error closing socket during reconnect',
          e
        )
      }
      this.socket = null
    }

    // Schedule reconnection attempt
    setTimeout(() => {
      if (this.isConnected()) {
        logger.info('WebSocketService: Already reconnected, skipping')
        this.isReconnecting = false
        return
      }

      this.reconnectAttempts++
      this.isReconnecting = false

      // One more network check before attempting connection
      if (!navigator.onLine) {
        logger.warn(
          'WebSocketService: Network still offline, delaying reconnect'
        )
        return
      }

      // Attempt reconnection
      this.connect()
    }, delay)
  }

  /**
   * Subscribe to a trading pair
   *
   * @param pair Trading pair to subscribe to (e.g. BTC/USD)
   */
  public subscribeToPair(pair: string): void {
    if (!pair) {
      logger.error('WebSocketService subscribeToPair: No pair provided')
      return
    }

    this.subscribedPairs.add(pair)

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.queueMessage('subscribe', { pair }, 2)

      if (this.dispatch) {
        this.dispatch(subscribeToPair(pair))
      }

      logger.info(`WebSocketService: Subscribed to ${pair}`)
    } else {
      logger.info(
        `WebSocketService: Socket not ready, ${pair} will be subscribed upon reconnection`
      )
    }
  }

  /**
   * Unsubscribe from a trading pair
   *
   * @param pair Trading pair to unsubscribe from
   */
  public unsubscribeFromPair(pair: string): void {
    if (!pair) return

    this.subscribedPairs.delete(pair)

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.queueMessage('unsubscribe', { pair }, 2)

      if (this.dispatch) {
        this.dispatch(unsubscribeFromPair(pair))
      }

      logger.info(`WebSocketService: Unsubscribed from ${pair}`)
    }
  }

  /**
   * Close the WebSocket connection
   */
  public close(): void {
    logger.info('WebSocketService: Closing connection')
    this.stopHeartbeat()
    this.cleanupNetworkListeners()

    if (this.socket) {
      if (this.socket.readyState === WebSocket.OPEN) {
        this.subscribedPairs.forEach((pair) => {
          try {
            this.queueMessage('unsubscribe', { pair }, 3)
            logger.debug(
              `WebSocketService: Unsubscribed from ${pair} before closing`
            )
          } catch (e) {
            // Ignore errors when unsubscribing during close
          }
        })

        try {
          this.queueMessage('disconnect', {}, 5)
        } catch (e) {
          // Ignore errors when sending disconnect
        }
      }

      try {
        this.socket.close(1000, 'Normal closure')
      } catch (e) {
        logger.error('WebSocketService close: Error closing WebSocket', e)
      }

      this.socket = null
      this.subscribedPairs.clear()
      this.connectionInitialized = false
      this.messageQueue = []

      if (this.dispatch) {
        this.dispatch(setWsConnected(false))
      }
    }
  }

  /**
   * Check if the WebSocket is currently connected
   */
  public isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN
  }

  /**
   * Get the current URL the WebSocket is connected to
   */
  public getCurrentUrl(): string {
    return this.url
  }

  /**
   * Force a reconnection to the WebSocket server
   */
  public reconnect(): boolean {
    logger.info('WebSocketService: Manual reconnection requested')

    if (this.url && this.clientId && this.dispatch) {
      this.reconnectAttempts = 0
      this.isReconnecting = false
      this.close()

      // Short delay before reconnecting
      setTimeout(() => {
        this.connectionInitialized = true
        this.connect()
      }, 100)

      return true
    }

    logger.error(
      'WebSocketService reconnect: Missing required connection parameters'
    )
    return false
  }

  /**
   * Verify current subscription state and repair if needed
   */
  public verifySubscriptions(): void {
    if (!this.isConnected()) {
      logger.warn(
        'WebSocketService: Cannot verify subscriptions while disconnected'
      )
      return
    }

    this.syncSubscriptions()
  }

  /**
   * Get connection diagnostic information
   */
  public getDiagnostics(): any {
    return {
      connectionAttempts: this.connectionAttempts,
      connectionInitialized: this.connectionInitialized,
      isConnected: this.isConnected(),
      lastHeartbeat: this.lastHeartbeatResponse
        ? new Date(this.lastHeartbeatResponse).toISOString()
        : null,
      lastSuccessfulConnection: this.lastSuccessfulConnection
        ? new Date(this.lastSuccessfulConnection).toISOString()
        : null,
      queuedMessages: this.messageQueue.length,
      reconnectAttempts: this.reconnectAttempts,
      subscribedPairs: Array.from(this.subscribedPairs),
      url: this.url,
    }
  }
}

// Export a singleton instance
export const webSocketService = WebSocketService.getInstance()
