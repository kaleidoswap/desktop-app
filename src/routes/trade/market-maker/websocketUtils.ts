import { Dispatch } from '@reduxjs/toolkit'

import { webSocketService } from '../../../app/hubs/websocketService'
import { logger } from '../../../utils/logger'

// Rate limiting backoff parameters
let rateLimit = {
  attempts: 0,
  baseDelay: 500,
  currentDelay: 500,
  factor: 2,
  lastAttempt: 0,
  maxDelay: 30000,
}

// WebSocket connection health metrics
let connectionHealth = {
  failedMessages: 0,
  lastFailureTime: 0,
  lastSuccessfulMessage: 0,
  successfulMessages: 0,
}

/**
 * Initialize WebSocket connection using the WebSocketService
 * @param makerUrl The URL of the market maker
 * @param clientId Client ID, usually the node pubkey
 * @param dispatch Redux dispatch function
 * @returns Promise that resolves to a boolean indicating success
 */
export const initializeWebSocket = (
  makerUrl: string,
  clientId: string,
  dispatch: Dispatch
): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      logger.info(
        `Initializing WebSocket connection to ${makerUrl} with client ID ${clientId}`
      )

      // Check if already connected to same URL
      if (
        webSocketService.isConnected() &&
        webSocketService.getCurrentUrl() === makerUrl
      ) {
        logger.info('WebSocket already connected to the same URL')
        resolve(true)
        return
      }

      // Use the WebSocketService to initialize the connection
      const success = webSocketService.init(makerUrl, clientId, dispatch)

      if (success) {
        logger.info('WebSocket initialization request successful')
        resolve(true)
      } else {
        logger.debug(
          'WebSocket initialization request failed - service returned false'
        )
        resolve(false)
      }
    } catch (error) {
      logger.error('Error initializing WebSocket:', error)
      resolve(false)
    }
  })
}

/**
 * Initialize WebSocket connection and wait for it to be ready for communication
 * @param makerUrl The URL of the market maker
 * @param clientId Client ID, usually the node pubkey
 * @param dispatch Redux dispatch function
 * @param timeout Maximum time to wait for connection in milliseconds
 * @returns Promise that resolves to a boolean indicating success
 */
export const initializeWebSocketWithWait = async (
  makerUrl: string,
  clientId: string,
  dispatch: Dispatch,
  timeout: number = 8000 // Reduced from 10000ms to 8000ms
): Promise<boolean> => {
  try {
    logger.info(
      `Initializing WebSocket connection to ${makerUrl} with client ID ${clientId} (with connection wait)`
    )

    // Check if already connected and ready to same URL
    if (
      webSocketService.isConnected() &&
      webSocketService.getCurrentUrl() === makerUrl &&
      webSocketService.isConnectionReadyForCommunication()
    ) {
      logger.info('WebSocket already connected and ready to the same URL')
      return true
    }

    // First, initialize the WebSocket connection
    const initSuccess = webSocketService.init(makerUrl, clientId, dispatch)

    if (!initSuccess) {
      // Get diagnostics to understand why init failed
      const diagnostics = webSocketService.getDiagnostics()
      logger.debug('WebSocket initialization failed - diagnostics:', {
        circuitBreakerState: diagnostics.stability?.circuitBreakerState,
        connectionInitialized: diagnostics.connectionInitialized,
        currentUrl: diagnostics.url,
        isConnected: diagnostics.isConnected,
        targetUrl: makerUrl,
      })
      return false
    }

    // Wait for the connection to be fully established and ready
    logger.info('Waiting for WebSocket connection to be ready...')
    const connectionReady = await webSocketService.waitForConnection(timeout)

    if (connectionReady) {
      logger.info(
        'WebSocket connection established and ready for communication'
      )
      return true
    } else {
      logger.warn(`WebSocket connection failed to be ready within ${timeout}ms`)
      return false
    }
  } catch (error) {
    logger.error('Error initializing WebSocket with wait:', error)
    return false
  }
}

/**
 * Initialize WebSocket connection with automatic retry logic
 * @param makerUrl The URL of the market maker
 * @param clientId Client ID, usually the node pubkey
 * @param dispatch Redux dispatch function
 * @param maxRetries Maximum number of retry attempts
 * @param timeout Maximum time to wait for each connection attempt in milliseconds
 * @returns Promise that resolves to a boolean indicating success
 */
export const initializeWebSocketWithRetry = async (
  makerUrl: string,
  clientId: string,
  dispatch: Dispatch,
  maxRetries: number = 3,
  timeout: number = 8000 // Reduced from 10000ms to 8000ms
): Promise<boolean> => {
  // First check if already connected and ready
  if (
    webSocketService.isConnected() &&
    webSocketService.getCurrentUrl() === makerUrl &&
    webSocketService.isConnectionReadyForCommunication()
  ) {
    logger.info('WebSocket already connected and ready, skipping retry logic')
    return true
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(
        `WebSocket connection attempt ${attempt}/${maxRetries} to ${makerUrl}`
      )

      const success = await initializeWebSocketWithWait(
        makerUrl,
        clientId,
        dispatch,
        timeout
      )

      if (success) {
        logger.info(`WebSocket connection successful on attempt ${attempt}`)
        return true
      }

      // If this wasn't the last attempt, wait before retrying
      if (attempt < maxRetries) {
        // Reduced initial delay and max delay for faster recovery
        const delay = Math.min(500 * Math.pow(1.5, attempt - 1), 2000) // Start at 500ms, max 2 seconds
        logger.info(`WebSocket connection failed, retrying in ${delay}ms...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      } else {
        logger.error(`WebSocket connection failed after ${maxRetries} attempts`)
      }
    } catch (error) {
      logger.error(`WebSocket connection attempt ${attempt} failed:`, error)

      if (attempt === maxRetries) {
        return false
      }

      // Reduced retry delay for faster recovery
      const delay = Math.min(500 * Math.pow(1.5, attempt - 1), 2000)
      logger.info(`Waiting ${delay}ms before retry due to error...`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  return false
}

/**
 * Close the WebSocket connection
 */
export const closeWebSocket = (): void => {
  webSocketService.close()
}

/**
 * Track when we succeed in sending a WebSocket message
 */
export function trackMessageSuccess(): void {
  connectionHealth.lastSuccessfulMessage = Date.now()
  connectionHealth.successfulMessages++
}

/**
 * Track when we fail to send a WebSocket message
 */
export function trackMessageFailure(error?: any): void {
  connectionHealth.failedMessages++
  connectionHealth.lastFailureTime = Date.now()

  if (error) {
    logger.debug(`WebSocket message failure: ${error}`)
  }
}

/**
 * Get WebSocket connection health metrics
 */
export function getConnectionHealth(): any {
  return {
    ...connectionHealth,
    lastFailureTime: connectionHealth.lastFailureTime
      ? new Date(connectionHealth.lastFailureTime).toISOString()
      : 'never',
    lastSuccessfulMessageTime: connectionHealth.lastSuccessfulMessage
      ? new Date(connectionHealth.lastSuccessfulMessage).toISOString()
      : 'never',
    successRate:
      connectionHealth.successfulMessages + connectionHealth.failedMessages > 0
        ? (
            (connectionHealth.successfulMessages /
              (connectionHealth.successfulMessages +
                connectionHealth.failedMessages)) *
            100
          ).toFixed(1) + '%'
        : 'N/A',
  }
}

/**
 * Reset the connection health metrics
 */
export function resetConnectionHealth(): void {
  connectionHealth = {
    failedMessages: 0,
    lastFailureTime: 0,
    lastSuccessfulMessage: Date.now(),
    successfulMessages: 0,
  }
}

/**
 * Handle a rate limit error by increasing backoff delay
 */
export function handleRateLimitError(): void {
  const now = Date.now()

  // Only increase delay if we haven't already done so recently
  if (now - rateLimit.lastAttempt > rateLimit.currentDelay) {
    rateLimit.attempts++
    rateLimit.currentDelay = Math.min(
      rateLimit.currentDelay * rateLimit.factor,
      rateLimit.maxDelay
    )
  }

  rateLimit.lastAttempt = now

  logger.warn(
    `Rate limit exceeded. Increasing backoff to ${rateLimit.currentDelay}ms after ${rateLimit.attempts} attempts`
  )
}

/**
 * Reset rate limit backoff to initial values
 */
export function resetRateLimitBackoff(): void {
  if (rateLimit.currentDelay !== rateLimit.baseDelay) {
    logger.debug(
      `Resetting rate limit backoff from ${rateLimit.currentDelay}ms to ${rateLimit.baseDelay}ms`
    )
  }

  rateLimit.currentDelay = rateLimit.baseDelay
  rateLimit.attempts = 0
}

/**
 * Get the current delay that should be used before next attempt
 */
export function getCurrentBackoffDelay(): number {
  const now = Date.now()
  const timeSinceLastAttempt = now - rateLimit.lastAttempt

  // If we've waited long enough, use the current delay
  if (timeSinceLastAttempt >= rateLimit.currentDelay) {
    return 0
  }

  // Otherwise, wait the remaining time
  return rateLimit.currentDelay - timeSinceLastAttempt
}

/**
 * Check if websocket connection is healthy based on message success rate
 */
export function isConnectionHealthy(): boolean {
  const totalMessages =
    connectionHealth.successfulMessages + connectionHealth.failedMessages

  // If we haven't sent enough messages, assume it's healthy
  if (totalMessages < 5) {
    return true
  }

  const successRate = connectionHealth.successfulMessages / totalMessages

  // If success rate is below 70%, the connection is unhealthy
  if (successRate < 0.7) {
    logger.warn(
      `WebSocket connection health poor (${(successRate * 100).toFixed(1)}% success rate)`
    )
    return false
  }

  return true
}

/**
 * Add jitter to a delay value to prevent thundering herd problem
 * @param delay Base delay in milliseconds
 * @param jitterFactor Factor to multiply the delay by (default 0.3 = ±30%)
 */
export function addJitter(delay: number, jitterFactor: number = 0.3): number {
  // Add random jitter between -jitterFactor and +jitterFactor of the delay
  const jitter = (Math.random() * 2 - 1) * jitterFactor * delay
  return Math.max(0, delay + jitter)
}

/**
 * Ping the server and measure response time
 * @returns Promise that resolves to the round-trip time in milliseconds
 */
export const pingServer = async (): Promise<number> => {
  return new Promise((resolve) => {
    if (!webSocketService.isConnected()) {
      logger.warn('Cannot ping server: WebSocket not connected')
      resolve(-1)
      return
    }

    const startTime = Date.now()
    let timeoutId: number | null = null

    // Set a timeout to resolve with a failure after 5 seconds
    timeoutId = setTimeout(() => {
      timeoutId = null
      logger.warn('Ping timeout')
      resolve(-1)
    }, 5000) as unknown as number

    // Resolve when we receive a response
    const checkPongReceived = setInterval(() => {
      const now = Date.now()
      // If we've received any message in the last 500ms, consider it a success
      if (connectionHealth.lastSuccessfulMessage > startTime) {
        clearInterval(checkPongReceived)
        if (timeoutId !== null) {
          clearTimeout(timeoutId)
        }
        resolve(now - startTime)
      }
    }, 100)

    // Send the ping
    webSocketService['queueMessage']('ping', {}, 5)
  })
}

/**
 * Retry connecting to the WebSocket server
 * @returns Promise that resolves to a boolean indicating success
 */
export const retryConnection = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (webSocketService.isConnected()) {
      logger.info('Already connected, no need to retry')
      resolve(true)
      return
    }

    logger.info('Retrying connection...')
    webSocketService.reconnect()

    // Wait a bit to see if connection succeeds
    setTimeout(() => {
      if (webSocketService.isConnected()) {
        logger.info('Reconnection successful')
        resetRateLimitBackoff()
        resolve(true)
      } else {
        logger.error('Reconnection failed')
        resolve(false)
      }
    }, 3000)
  })
}
