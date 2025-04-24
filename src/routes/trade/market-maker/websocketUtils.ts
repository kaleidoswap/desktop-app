import { Dispatch } from '@reduxjs/toolkit'

import { webSocketService } from '../../../app/hubs/websocketService'
import { logger } from '../../../utils/logger'

// Track last subscription time and requests
const subscriptionState = {
  backoffMultiplier: 1.5,
  // Minimum time between subscriptions (milliseconds)
consecutiveRateLimitErrors: 0,
  
// Maximum backoff interval in milliseconds
currentBackoff: 500, 
  

lastSubscriptionTime: 0,
  

maxBackoffInterval: 5000,
  
minInterval: 500, 
  pendingSubscriptions: new Map<string, number>(), // Start with the min interval
}

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

      // Use the WebSocketService to initialize the connection
      const success = webSocketService.init(makerUrl, clientId, dispatch)

      if (success) {
        logger.info('WebSocket initialization successful')
        resolve(true)
      } else {
        logger.error('WebSocket initialization failed')
        resolve(false)
      }
    } catch (error) {
      logger.error('Error initializing WebSocket:', error)
      resolve(false)
    }
  })
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
 * Subscribe to a trading pair's price feed with rate limiting
 * This function debounces multiple subscription requests to the same pair
 * and ensures we don't exceed the server's rate limit
 * @param pair The trading pair to subscribe to (e.g. "BTC/USD")
 */
export const subscribeToPairFeed = (pair: string): void => {
  if (!pair) {
    logger.error('Cannot subscribe to empty pair')
    return
  }

  // Cancel any pending subscription for this pair
  if (subscriptionState.pendingSubscriptions.has(pair)) {
    clearTimeout(subscriptionState.pendingSubscriptions.get(pair))
    subscriptionState.pendingSubscriptions.delete(pair)
  }

  const now = Date.now()
  const timeSinceLastSubscription = now - subscriptionState.lastSubscriptionTime
  const currentDelay = subscriptionState.currentBackoff

  // If we've recently sent a subscription request, delay this one
  if (timeSinceLastSubscription < currentDelay) {
    const delay = currentDelay - timeSinceLastSubscription
    logger.debug(
      `Delaying subscription to ${pair} by ${delay}ms to avoid rate limiting`
    )

    // Set a timeout to subscribe after the delay
    const timeoutId = setTimeout(() => {
      subscriptionState.pendingSubscriptions.delete(pair)
      subscriptionState.lastSubscriptionTime = Date.now()
      webSocketService.subscribeToPair(pair)
    }, delay)

    subscriptionState.pendingSubscriptions.set(pair, timeoutId)
  } else {
    // If enough time has passed, subscribe immediately
    subscriptionState.lastSubscriptionTime = now
    webSocketService.subscribeToPair(pair)
  }
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
