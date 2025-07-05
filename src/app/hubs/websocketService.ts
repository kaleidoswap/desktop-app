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
  updateQuote,
  clearQuote,
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

// Circuit breaker states
enum CircuitBreakerState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing, not attempting connections
  HALF_OPEN = 'HALF_OPEN', // Testing if service is back
}

// Connection stability tracking
interface ConnectionStability {
  consecutiveFailures: number
  lastSuccessfulConnection: number
  lastFailureTime: number
  reconnectAttempts: number
  circuitBreakerState: CircuitBreakerState
  circuitBreakerOpenTime: number
  stabilityScore: number
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
  private maxReconnectAttempts: number = 5 // Increased from 3 to 5 for better reliability
  private reconnectInterval: number = 8000 // Increased from 5000ms to 8000ms to reduce connection frequency
  private subscribedPairs: Set<string> = new Set()
  private isReconnecting: boolean = false
  private heartbeatInterval: number | null = null
  private lastHeartbeatResponse: number = 0
  private heartbeatTimeout: number = 15000 // Increased from 10000ms to 15000ms for more stable connections
  private heartbeatIntervalMs: number = 8000 // Increased from 5000ms to 8000ms for less frequent heartbeats
  private networkOnlineHandler: (() => void) | null = null
  private networkOfflineHandler: (() => void) | null = null

  // Message queue system
  private messageQueue: QueuedMessage[] = []
  private processingQueue: boolean = false
  private maxQueueSize: number = 200
  private messageProcessInterval: number = 300 // Increased from 200ms to 300ms to reduce processing frequency
  private messageProcessTimer: number | null = null
  private lastMessageSent: number = 0

  // Track if a connection has been initialized to prevent multiple connections
  public connectionInitialized: boolean = false

  // Connection diagnostics and stability
  private connectionStartTime: number = 0
  private lastSuccessfulConnection: number = 0
  private connectionAttempts: number = 0
  private stability: ConnectionStability = {
    circuitBreakerOpenTime: 0,
    circuitBreakerState: CircuitBreakerState.CLOSED,
    consecutiveFailures: 0,
    lastFailureTime: 0,
    lastSuccessfulConnection: 0,
    reconnectAttempts: 0,
    stabilityScore: 100,
  }

  // Circuit breaker settings
  private readonly CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5 // Increased from 3 to 5 for more tolerance
  private readonly CIRCUIT_BREAKER_TIMEOUT = 30000 // Increased from 15000ms to 30000ms for better recovery

  // Connection health monitoring
  private connectionHealthCheckInterval: number | null = null
  private readonly CONNECTION_HEALTH_CHECK_INTERVAL = 15000 // Increased from 8000ms to 15000ms for less frequent health checks
  private missedHeartbeats: number = 0
  private readonly MAX_MISSED_HEARTBEATS = 3 // Increased from 2 to 3 for more tolerance

  // Track last quote request for error handling
  private lastQuoteRequest: {
    fromAsset: string
    toAsset: string
    fromAmount: number
  } | null = null

  // Add connection readiness tracking
  private isConnectionReady: boolean = false
  private connectionReadyResolvers: Array<(value: boolean) => void> = []
  private readonly CONNECTION_READY_TIMEOUT = 10000 // 10 second timeout for connection readiness

  // Connection cooldown to prevent rapid reconnections
  private lastCloseTime: number = 0
  private readonly CONNECTION_COOLDOWN = 5000 // 5 second cooldown between connections to prevent rapid reconnections

  private constructor() {
    logger.info('WebSocketService instance created')
    this.setupNetworkListeners()
    this.startConnectionHealthMonitoring()
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
      this.resetCircuitBreaker() // Reset circuit breaker on network restore
      if (!this.isConnected() && this.connectionInitialized) {
        // Delay reconnection slightly to allow network to stabilize
        setTimeout(() => {
          this.handleReconnect()
        }, 2000)
      }
    }

    this.networkOfflineHandler = () => {
      logger.info('Network connection lost')
      this.stability.lastFailureTime = Date.now()
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.handleClose(new CloseEvent('network_offline'))
      }
    }

    window.addEventListener('online', this.networkOnlineHandler)
    window.addEventListener('offline', this.networkOfflineHandler)
  }

  /**
   * Start connection health monitoring
   */
  private startConnectionHealthMonitoring(): void {
    this.stopConnectionHealthMonitoring()

    this.connectionHealthCheckInterval = window.setInterval(() => {
      this.performHealthCheck()
    }, this.CONNECTION_HEALTH_CHECK_INTERVAL)
  }

  /**
   * Stop connection health monitoring
   */
  private stopConnectionHealthMonitoring(): void {
    if (this.connectionHealthCheckInterval) {
      clearInterval(this.connectionHealthCheckInterval)
      this.connectionHealthCheckInterval = null
    }
  }

  /**
   * Perform health check on the connection
   */
  private performHealthCheck(): void {
    if (!this.isConnected()) {
      return
    }

    // Check if we've missed too many heartbeats
    const now = Date.now()
    const timeSinceLastHeartbeat = now - this.lastHeartbeatResponse

    if (timeSinceLastHeartbeat > this.heartbeatTimeout) {
      this.missedHeartbeats++
      logger.warn(
        `Missed heartbeat #${this.missedHeartbeats}, last response: ${timeSinceLastHeartbeat}ms ago`
      )

      if (this.missedHeartbeats >= this.MAX_MISSED_HEARTBEATS) {
        logger.error(
          `Too many missed heartbeats (${this.missedHeartbeats}), forcing reconnection`
        )
        this.recordConnectionFailure()
        this.handleReconnect()
        return
      }
    } else {
      // Reset missed heartbeats on successful response
      this.missedHeartbeats = 0
    }

    // Update stability score
    this.updateStabilityScore()
  }

  /**
   * Update connection stability score
   */
  private updateStabilityScore(): void {
    const now = Date.now()
    const timeSinceLastFailure = now - this.stability.lastFailureTime

    // Increase score for stable connections
    if (timeSinceLastFailure > 60000 && this.isConnected()) {
      // 1 minute stable
      this.stability.stabilityScore = Math.min(
        100,
        this.stability.stabilityScore + 1
      )
    }

    // Decrease score for recent failures
    if (timeSinceLastFailure < 30000) {
      // Recent failure
      this.stability.stabilityScore = Math.max(
        0,
        this.stability.stabilityScore - 5
      )
    }
  }

  /**
   * Record a connection failure and update circuit breaker
   */
  private recordConnectionFailure(): void {
    this.stability.consecutiveFailures++
    this.stability.lastFailureTime = Date.now()
    this.stability.stabilityScore = Math.max(
      0,
      this.stability.stabilityScore - 10
    )

    // Check if we should open the circuit breaker
    if (
      this.stability.consecutiveFailures >=
        this.CIRCUIT_BREAKER_FAILURE_THRESHOLD &&
      this.stability.circuitBreakerState === CircuitBreakerState.CLOSED
    ) {
      this.openCircuitBreaker()
    }
  }

  /**
   * Record a successful connection
   */
  private recordConnectionSuccess(): void {
    this.stability.consecutiveFailures = 0
    this.stability.lastSuccessfulConnection = Date.now()
    this.stability.stabilityScore = Math.min(
      100,
      this.stability.stabilityScore + 20
    )
    this.missedHeartbeats = 0

    // Reset circuit breaker on successful connection
    if (this.stability.circuitBreakerState === CircuitBreakerState.HALF_OPEN) {
      this.resetCircuitBreaker()
    }
  }

  /**
   * Open the circuit breaker
   */
  private openCircuitBreaker(): void {
    this.stability.circuitBreakerState = CircuitBreakerState.OPEN
    this.stability.circuitBreakerOpenTime = Date.now()
    logger.warn(
      `Circuit breaker opened after ${this.stability.consecutiveFailures} consecutive failures`
    )

    // Show user notification
    toast.warning(
      'Connection unstable, temporarily suspending reconnection attempts',
      {
        autoClose: 10000,
        toastId: 'circuit-breaker-open',
      }
    )
  }

  /**
   * Reset the circuit breaker to closed state
   */
  private resetCircuitBreaker(): void {
    const oldState = this.stability.circuitBreakerState
    this.stability.circuitBreakerState = CircuitBreakerState.CLOSED
    this.stability.consecutiveFailures = 0

    if (oldState !== CircuitBreakerState.CLOSED) {
      logger.info('Circuit breaker reset to closed state')
      toast.dismiss('circuit-breaker-open')
    }
  }

  /**
   * Check if circuit breaker allows connection attempts
   */
  private canAttemptConnection(): boolean {
    const now = Date.now()

    switch (this.stability.circuitBreakerState) {
      case CircuitBreakerState.CLOSED:
        return true

      case CircuitBreakerState.OPEN:
        // Check if enough time has passed to try again
        if (
          now - this.stability.circuitBreakerOpenTime >
          this.CIRCUIT_BREAKER_TIMEOUT
        ) {
          this.stability.circuitBreakerState = CircuitBreakerState.HALF_OPEN
          logger.info(
            'Circuit breaker moved to half-open state, allowing test connection'
          )
          return true
        }
        return false

      case CircuitBreakerState.HALF_OPEN:
        return true

      default:
        return false
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

    // For quote requests, try to replace an existing request for the same asset pair
    if (action === 'quote_request' && payload.from_asset && payload.to_asset) {
      const pairKey = `${payload.from_asset}/${payload.to_asset}`

      // Find any existing quote request for this pair
      const existingIndex = this.messageQueue.findIndex(
        (msg) =>
          msg.action === 'quote_request' &&
          msg.payload.from_asset === payload.from_asset &&
          msg.payload.to_asset === payload.to_asset
      )

      // If found, replace it instead of adding a new message
      if (existingIndex >= 0) {
        this.messageQueue[existingIndex] = {
          action,
          payload,
          priority,
          timestamp: Date.now(),
        }
        logger.debug(
          `WebSocketService: Replaced existing quote request for ${pairKey}`
        )

        // Start processing if not already running
        if (!this.processingQueue) {
          this.processMessageQueue()
        }

        return true
      }
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

    // Route validation - only allow WebSocket connections on the market maker page
    // This prevents unnecessary connections and improves overall app performance
    const currentPath = window.location.pathname
    if (currentPath !== '/market-maker') {
      logger.warn(
        `WebSocketService init: Blocked connection attempt from ${currentPath}. WebSocket connections are only allowed on the market maker page.`
      )
      return false
    }

    // Check connection cooldown to prevent rapid reconnections
    const now = Date.now()
    if (now - this.lastCloseTime < this.CONNECTION_COOLDOWN) {
      const remainingCooldown =
        this.CONNECTION_COOLDOWN - (now - this.lastCloseTime)
      logger.debug(
        `WebSocketService: Connection cooldown active, waiting ${remainingCooldown}ms`
      )
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

    // Skip if we're currently connecting to the same URL to prevent multiple connection attempts
    if (
      this.socket &&
      this.socket.readyState === WebSocket.CONNECTING &&
      this.url === cleanUrl
    ) {
      logger.info(
        'WebSocketService: Already connecting to the same URL, skipping initialization'
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

    // Check circuit breaker
    if (!this.canAttemptConnection()) {
      logger.warn(
        'WebSocketService: Connection attempt blocked by circuit breaker'
      )
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
      this.stability.reconnectAttempts++

      logger.info(
        `WebSocketService: Connecting to ${fullWsUrl} (attempt ${this.stability.reconnectAttempts})`
      )

      // Create new WebSocket
      this.socket = new WebSocket(fullWsUrl)

      // Set up connection timeout to fail fast if server is not responding
      const connectionTimeout = setTimeout(() => {
        if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
          logger.warn('WebSocketService: Connection timeout - closing socket')
          this.socket.close(1006, 'Connection timeout')
          this.recordConnectionFailure()
        }
      }, 5000) // 5 second timeout for initial connection

      // Set up event handlers
      this.socket.onopen = () => {
        clearTimeout(connectionTimeout)
        this.handleOpen()
      }
      this.socket.onmessage = this.handleMessage.bind(this)
      this.socket.onclose = (event) => {
        clearTimeout(connectionTimeout)
        this.handleClose(event)
      }
      this.socket.onerror = (event) => {
        clearTimeout(connectionTimeout)
        this.handleError(event)
      }

      return true
    } catch (error) {
      logger.error('WebSocketService connect: Error creating WebSocket', error)
      this.recordConnectionFailure()
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

    // Record successful connection for stability tracking
    this.recordConnectionSuccess()

    // Reset connection health metrics
    resetConnectionHealth()
    this.messageProcessInterval = 500 // Reset to default

    this.startHeartbeat()

    // Reset rate limiting after successful connection
    resetRateLimitBackoff()

    // Dismiss any circuit breaker notifications
    toast.dismiss('circuit-breaker-open')

    // Mark connection as ready after a short delay to ensure stability
    setTimeout(() => {
      this.isConnectionReady = true

      // Resolve any pending connection ready promises
      this.connectionReadyResolvers.forEach((resolve) => resolve(true))
      this.connectionReadyResolvers = []

      logger.info(
        'WebSocketService: Connection marked as ready for communication'
      )
    }, 500) // 500ms delay to ensure connection stability
  }

  /**
   * Handle WebSocket message event
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data)

      // Log the raw data for debugging (only for non-heartbeat messages to reduce noise)
      if (data.action !== 'pong') {
        logger.debug('WebSocketService: Received message data:', data)
      }

      // Always update heartbeat timestamp when we receive any message
      this.lastHeartbeatResponse = Date.now()

      // Handle message based on action type
      if (data.action === 'quote_response') {
        if (this.dispatch) {
          if (data.data) {
            // Ensure data contains all required fields
            logger.debug(
              'WebSocketService: Processing quote response data:',
              data.data
            )

            // Make sure we have the necessary fields
            if (
              data.data.from_asset &&
              data.data.to_asset &&
              data.data.to_amount !== undefined
            ) {
              logger.info(
                `WebSocketService: Received valid quote: with ID: ${data.data.rfq_id} - ${data.data.from_amount} ${data.data.from_asset} -> ${data.data.to_amount} ${data.data.to_asset}`
              )
              this.dispatch(updateQuote(data.data))
            } else {
              logger.error(
                'WebSocketService: Malformed quote response - missing required fields:',
                data.data
              )
            }
          } else if (data.error) {
            logger.error(
              `WebSocketService: Quote response error: ${data.error}`
            )

            // Clear the quote for the failed request
            if (this.lastQuoteRequest && this.dispatch) {
              this.dispatch(clearQuote(this.lastQuoteRequest))
              logger.debug(
                `WebSocketService: Cleared failed quote for ${this.lastQuoteRequest.fromAsset}/${this.lastQuoteRequest.toAsset}/${this.lastQuoteRequest.fromAmount}`
              )
            }
          } else {
            logger.error(
              'WebSocketService: Invalid quote response format - missing data'
            )
          }
        } else {
          logger.warn(
            'WebSocketService: Redux dispatch not set, cannot update quote'
          )
        }

        // Reset rate limit and track success
        resetRateLimitBackoff()
        trackMessageSuccess()
      } else if (data.action === 'pong') {
        // Reset rate limit and track success
        resetRateLimitBackoff()
        trackMessageSuccess()
      } else if (data.error) {
        logger.error(`WebSocketService: Server reported error: ${data.error}`)
        trackMessageFailure(`Server error: ${data.error}`)

        // Handle rate limit errors specifically
        if (data.error.includes('Rate limit exceeded')) {
          handleRateLimitError()
        }

        // If this is a quote-related error, clear the quote and signal the UI
        const isQuoteError =
          data.error.includes('Failed to calculate quote') ||
          data.error.includes('equivalent base amount must be between') ||
          data.error.includes('No tradable pair found') ||
          data.error.includes('Invalid asset') ||
          data.error.includes('quote') // Generic quote error detection

        if (isQuoteError && this.lastQuoteRequest && this.dispatch) {
          this.dispatch(clearQuote(this.lastQuoteRequest))
          logger.debug(
            `WebSocketService: Cleared failed quote due to error for ${this.lastQuoteRequest.fromAsset}/${this.lastQuoteRequest.toAsset}/${this.lastQuoteRequest.fromAmount}`
          )

          // Also dispatch a quote error action to immediately signal UI components
          // that there was an error and loading states should be reset
          this.dispatch({
            payload: data.error,
            type: 'pairs/setQuoteError',
          })
        }
      }
    } catch (error) {
      logger.error('WebSocketService: Error parsing message', error)
      trackMessageFailure('Error parsing message')
    }
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(event: Event): void {
    logger.error('WebSocketService: WebSocket error', event)
    trackMessageFailure('WebSocket error event')
    this.recordConnectionFailure()

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

      // For CONNECTING state, wait a moment before closing to avoid premature close
      if (readyState === WebSocket.CONNECTING) {
        logger.debug(
          'WebSocketService: Socket still connecting during error, waiting before close'
        )
        setTimeout(() => {
          if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
            this.socket.close(1006, 'Error during connection')
          }
        }, 200)
      } else if (readyState === WebSocket.OPEN) {
        // For OPEN state, close immediately
        this.socket.close(1006, 'Error event occurred')
      }
    } catch (err) {
      logger.warn('WebSocketService: Error during socket cleanup', err)
    } finally {
      // Always reconnect after an error
      this.handleReconnect()
    }
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    logger.info(
      `WebSocketService: Disconnected with code ${event.code}, reason: ${event.reason || 'No reason provided'}`
    )

    // Mark connection as not ready immediately
    this.isConnectionReady = false

    // Reject any pending connection ready promises
    this.connectionReadyResolvers.forEach((resolve) => resolve(false))
    this.connectionReadyResolvers = []

    if (this.dispatch) {
      this.dispatch(setWsConnected(false))
    }

    this.stopHeartbeat()

    // Record failure if this was not a clean close
    if (!event.wasClean) {
      this.recordConnectionFailure()
    }

    // Display specific messages for common close codes
    if (event.code === 1006) {
      logger.warn(
        'WebSocketService: Abnormal closure (code 1006) - The connection was closed abnormally'
      )
      toast.warning(
        'Connection to maker was lost. Attempting to reconnect...',
        {
          autoClose: 5000,
          toastId: 'websocket-lost-connection',
        }
      )
    } else if (event.code === 1011) {
      logger.error(
        'WebSocketService: Server error (code 1011) - The server encountered an error'
      )
      toast.error('Server error detected. Attempting to reconnect...', {
        autoClose: 5000,
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
   * Close the WebSocket connection and clean up resources
   */
  public close(): void {
    logger.info('WebSocketService: Closing connection')

    this.connectionInitialized = false
    this.isReconnecting = false

    // Record close time for cooldown
    this.lastCloseTime = Date.now()

    // Reset connection readiness
    this.isConnectionReady = false

    // Reject any pending connection ready promises
    this.connectionReadyResolvers.forEach((resolve) => resolve(false))
    this.connectionReadyResolvers = []

    // Clear heartbeat and message processing
    this.stopHeartbeat()

    // Stop connection health monitoring
    this.stopConnectionHealthMonitoring()

    // Clean up message queue
    this.messageQueue = []
    this.processingQueue = false

    // Clear subscribed pairs
    this.subscribedPairs.clear()

    // Close socket connection with better state handling
    if (this.socket) {
      try {
        const readyState = this.socket.readyState

        if (readyState === WebSocket.OPEN) {
          this.socket.close(1000, 'Connection closed by client')
        } else if (readyState === WebSocket.CONNECTING) {
          // For connecting sockets, wait a moment before forcing close
          logger.debug(
            'WebSocketService: Socket still connecting, waiting before close'
          )
          setTimeout(() => {
            if (
              this.socket &&
              this.socket.readyState === WebSocket.CONNECTING
            ) {
              this.socket.close(1006, 'Connection timeout during close')
            }
          }, 100)
        }
        // For CLOSING or CLOSED states, don't attempt to close again
      } catch (error) {
        logger.debug('WebSocketService: Error closing socket', error)
      }

      this.socket = null
    }

    // Update Redux state
    if (this.dispatch) {
      this.dispatch(setWsConnected(false))
    }

    // Clear all toasts related to websocket
    toast.dismiss('websocket-lost-connection')
    toast.dismiss('websocket-server-error')
    toast.dismiss('circuit-breaker-open')
    toast.dismiss('max-reconnect-attempts')

    // Reset stability metrics
    this.stability = {
      circuitBreakerOpenTime: 0,
      circuitBreakerState: CircuitBreakerState.CLOSED,
      consecutiveFailures: 0,
      lastFailureTime: 0,
      lastSuccessfulConnection: 0,
      reconnectAttempts: 0,
      stabilityScore: 100,
    }

    logger.info('WebSocketService: Connection closed and resources cleaned up')
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

    // Route validation - only allow reconnections on the market maker page
    const currentPath = window.location.pathname
    if (currentPath !== '/market-maker') {
      logger.warn(
        `WebSocketService reconnect: Blocked reconnection attempt from ${currentPath}. WebSocket connections are only allowed on the market maker page.`
      )
      return false
    }

    // Check cooldown to prevent rapid reconnection attempts
    const now = Date.now()
    if (now - this.lastCloseTime < this.CONNECTION_COOLDOWN) {
      const remainingCooldown =
        this.CONNECTION_COOLDOWN - (now - this.lastCloseTime)
      logger.warn(
        `WebSocketService reconnect: Connection cooldown active. Please wait ${remainingCooldown}ms before reconnecting.`
      )
      return false
    }

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
   * Get enhanced diagnostics including stability metrics
   */
  public getDiagnostics(): any {
    const baseStats = {
      clientId: this.clientId,
      connectionAttempts: this.connectionAttempts,
      connectionInitialized: this.connectionInitialized,
      isConnected: this.isConnected(),
      isReconnecting: this.isReconnecting,
      lastHeartbeatResponse: this.lastHeartbeatResponse
        ? new Date(this.lastHeartbeatResponse).toISOString()
        : 'never',
      lastSuccessfulConnection: this.lastSuccessfulConnection
        ? new Date(this.lastSuccessfulConnection).toISOString()
        : 'never',
      maxReconnectAttempts: this.maxReconnectAttempts,
      messageQueueSize: this.messageQueue.length,
      processingQueue: this.processingQueue,
      reconnectAttempts: this.reconnectAttempts,
      subscribedPairs: Array.from(this.subscribedPairs),
      url: this.url,
    }

    // Add stability and circuit breaker information
    const stabilityStats = {
      circuitBreakerState: this.stability.circuitBreakerState,
      consecutiveFailures: this.stability.consecutiveFailures,
      lastFailureTime: this.stability.lastFailureTime
        ? new Date(this.stability.lastFailureTime).toISOString()
        : 'never',
      missedHeartbeats: this.missedHeartbeats,
      reconnectAttemptsByStability: this.stability.reconnectAttempts,
      stabilityScore: this.stability.stabilityScore,
    }

    return {
      ...baseStats,
      stability: stabilityStats,
    }
  }

  /**
   * Wait for the connection to be ready for communication
   * @param timeout Maximum time to wait in milliseconds
   * @returns Promise that resolves to true if connected, false if timeout
   */
  public async waitForConnection(
    timeout: number = this.CONNECTION_READY_TIMEOUT
  ): Promise<boolean> {
    // If already connected and ready, return immediately
    if (this.isConnected() && this.isConnectionReady) {
      return true
    }

    // If not connected at all, return false immediately
    if (!this.socket || this.socket.readyState === WebSocket.CLOSED) {
      return false
    }

    // If connecting, wait for connection to be established
    if (this.socket.readyState === WebSocket.CONNECTING) {
      return new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
          // Remove this resolver from the list
          this.connectionReadyResolvers = this.connectionReadyResolvers.filter(
            (r) => r !== resolve
          )
          resolve(false)
        }, timeout)

        const resolver = (connected: boolean) => {
          clearTimeout(timeoutId)
          resolve(connected)
        }

        this.connectionReadyResolvers.push(resolver)
      })
    }

    return this.isConnected() && this.isConnectionReady
  }

  /**
   * Check if the connection is ready for communication
   */
  public isConnectionReadyForCommunication(): boolean {
    return this.isConnected() && this.isConnectionReady
  }

  /**
   * Request a quote for swapping from one asset to another
   * Now includes connection readiness checking
   *
   * @param fromAsset The asset to swap from
   * @param toAsset The asset to swap to
   * @param fromAmount The amount to swap
   * @returns A promise that resolves to true if the quote request was sent successfully
   */
  public async requestQuote(
    fromAsset: string,
    toAsset: string,
    fromAmount: number
  ): Promise<boolean> {
    // Check if connection is ready for communication
    if (!this.isConnectionReadyForCommunication()) {
      logger.debug(
        'WebSocketService: Connection not ready for quote request, waiting...'
      )

      // Try to wait for connection to be ready
      const isReady = await this.waitForConnection(5000) // 5 second timeout

      if (!isReady) {
        logger.debug(
          'WebSocketService: Connection not ready after waiting, cannot request quote'
        )
        return false
      }
    }

    logger.debug(
      `WebSocketService: Requesting quote for ${fromAmount} ${fromAsset} -> ${toAsset}`
    )

    // Track this request for error handling
    this.lastQuoteRequest = { fromAmount, fromAsset, toAsset }

    return this.queueMessage(
      'quote_request',
      {
        from_amount: fromAmount,
        from_asset: fromAsset,
        to_asset: toAsset,
      },
      4
    ) // Higher priority than normal messages but lower than connection management
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

            // For each pair, send a quote request
            if (this.subscribedPairs.size > 0) {
              this.subscribedPairs.forEach((pair) => {
                const [fromAsset, toAsset] = pair.split('/')
                if (fromAsset && toAsset) {
                  this.socket?.send(
                    JSON.stringify({
                      action: 'quote_request',
                      from_amount: 1000,
                      from_asset: fromAsset,
                      to_asset: toAsset,
                    })
                  )
                }
              })
              logger.debug(
                `WebSocketService: Sent emergency quote requests for ${this.subscribedPairs.size} pairs`
              )
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

    // Check circuit breaker before attempting reconnection
    if (!this.canAttemptConnection()) {
      logger.info('WebSocketService: Reconnection blocked by circuit breaker')
      return
    }

    this.isReconnecting = true

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.warn(
        `WebSocketService: Maximum reconnect attempts (${this.maxReconnectAttempts}) reached`
      )

      this.recordConnectionFailure()

      if (this.dispatch) {
        this.dispatch(setWsConnected(false))
      }

      toast.error(
        'Could not establish a stable connection. Please try refreshing the connection.',
        {
          autoClose: false,
          toastId: 'max-reconnect-attempts',
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
          autoClose: 5000,
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
   * Reset circuit breaker and connection state when manually switching makers
   */
  public resetForNewMaker(): void {
    logger.info('WebSocketService: Resetting connection state for new maker')

    // Reset circuit breaker
    this.resetCircuitBreaker()

    // Reset reconnection attempts
    this.reconnectAttempts = 0
    this.isReconnecting = false

    // Reset connection state
    this.connectionInitialized = false

    // Clear any existing connection
    if (this.socket) {
      this.close()
    }
  }
}

// Export a singleton instance
export const webSocketService = WebSocketService.getInstance()
