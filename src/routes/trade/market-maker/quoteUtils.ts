import { ChangeEvent } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { toast } from 'react-toastify'

import { webSocketService } from '../../../app/hubs/websocketService'
import { NiaAsset } from '../../../slices/nodeApi/nodeApi.slice'
import { logger } from '../../../utils/logger'

import { mapAssetIdToTicker, mapTickerToAssetId } from './assetUtils'
import { Fields } from './types'

// Timing control variables for quote requests - updated to 500ms as requested
let lastQuoteRequestTime = 0
let lastRequestedQuoteKey = ''
let lastQuoteErrorToastTime = 0
let quoteRequestTimer: any = null
let globalDebouncedQuoteTimer: any = null
const QUOTE_REQUEST_DEBOUNCE_MS = 500 // Changed from 1000ms to 500ms as requested
const QUOTE_REQUEST_RATE_LIMIT_MS = 2000 // Increased from 1000ms to 2000ms for rate limiting
const ERROR_TOAST_COOLDOWN_MS = 8000 // Increased from 5000ms to 8000ms for less toast spam

/**
 * Global debounced quote request function that ensures all quote requests
 * are properly debounced regardless of where they originate
 */
export const debouncedQuoteRequest = (
  requestQuoteFn: () => Promise<void>,
  delay: number = QUOTE_REQUEST_DEBOUNCE_MS
) => {
  // Clear any existing timer
  if (globalDebouncedQuoteTimer) {
    clearTimeout(globalDebouncedQuoteTimer)
  }

  // Set new timer
  globalDebouncedQuoteTimer = setTimeout(() => {
    requestQuoteFn().catch((error) => {
      logger.error('Error in debounced quote request:', error)
    })
  }, delay)
}

/**
 * Clear any pending debounced quote requests
 */
export const clearDebouncedQuoteRequest = () => {
  if (globalDebouncedQuoteTimer) {
    clearTimeout(globalDebouncedQuoteTimer)
    globalDebouncedQuoteTimer = null
  }
}

/**
 * Creates a function to handle requesting quotes from the market maker
 * with built-in debouncing and duplicate request prevention
 *
 * @param form Form instance from react-hook-form
 * @param parseAssetAmount Function to parse asset amount
 * @param assets List of NiaAsset objects
 * @param setIsQuoteLoading Function to set quote loading state
 * @param setIsToAmountLoading Function to set to amount loading state
 * @param hasValidQuote Optional function to check if there's already a valid quote
 * @param maxFromAmount Maximum amount that can be sent
 * @param minFromAmount Minimum amount that can be sent
 * @returns A function that can be called to request a quote
 */
export const createQuoteRequestHandler = (
  form: UseFormReturn<Fields>,
  parseAssetAmount: (
    amount: string | undefined | null,
    asset: string
  ) => number,
  assets: NiaAsset[],
  setIsQuoteLoading?: (loading: boolean) => void,
  setIsToAmountLoading?: (loading: boolean) => void,
  hasValidQuote?: () => boolean,
  maxFromAmount?: number,
  minFromAmount?: number
) => {
  return async () => {
    const fromAssetTicker = form.getValues().fromAsset
    const toAssetTicker = form.getValues().toAsset
    const fromAmountStr = form.getValues().from

    // Skip if either asset is not set
    if (!fromAssetTicker || !toAssetTicker) {
      return
    }

    // Skip if assets are the same (prevents "Cannot swap an asset for itself" errors)
    if (fromAssetTicker === toAssetTicker) {
      return
    }

    // Skip if amount is not set or is zero
    if (!fromAmountStr || fromAmountStr === '0') {
      form.setValue('to', '') // Clear 'to' field if 'from' is empty
      return
    }

    // Parse the amount
    const fromAmount = parseAssetAmount(fromAmountStr, fromAssetTicker)
    if (fromAmount <= 0) {
      return
    }

    // Check if amount is below minimum or if balance is insufficient
    if (minFromAmount !== undefined) {
      if (fromAmount < minFromAmount) {
        // Amount is below minimum - don't request quote
        logger.debug(
          `Amount (${fromAmount}) is below minimum required (${minFromAmount}), skipping quote request`
        )
        if (setIsQuoteLoading) {
          setIsQuoteLoading(false)
        }
        if (setIsToAmountLoading) {
          setIsToAmountLoading(false)
        }
        form.setValue('to', '') // Clear 'to' field since we can't trade
        return
      }
    }

    // Check if the user's balance is below the minimum required amount
    if (maxFromAmount !== undefined && minFromAmount !== undefined) {
      if (maxFromAmount < minFromAmount) {
        // User's balance is below minimum - don't request quote
        logger.debug(
          `Available balance (${maxFromAmount}) is below minimum required (${minFromAmount}), skipping quote request`
        )
        if (setIsQuoteLoading) {
          setIsQuoteLoading(false)
        }
        if (setIsToAmountLoading) {
          setIsToAmountLoading(false)
        }
        form.setValue('to', '') // Clear 'to' field since we can't trade
        return
      }
    }

    // Only set loading states if we don't already have a valid quote
    // This prevents blocking users who have valid quotes while background updates happen
    const currentlyHasValidQuote = hasValidQuote ? hasValidQuote() : false

    if (!currentlyHasValidQuote) {
      if (setIsQuoteLoading) {
        setIsQuoteLoading(true)
      }
      if (setIsToAmountLoading) {
        setIsToAmountLoading(true)
      }
    }

    // Create a unique key for this quote request (using tickers for consistency with previous logic)
    const quoteKey = `${fromAssetTicker}/${toAssetTicker}/${fromAmount}`

    // Skip if this is the exact same quote we just requested
    if (quoteKey === lastRequestedQuoteKey) {
      const timeSinceLastRequest = Date.now() - lastQuoteRequestTime
      if (timeSinceLastRequest < QUOTE_REQUEST_RATE_LIMIT_MS) {
        // Rate limiting - no need to log this frequently
        return
      }
    }

    // Ensure assets are available before trying to send the request
    if (!assets || assets.length === 0) {
      logger.warn(
        'Quote request skipped: assets list is not available or empty.'
      )
      if (Date.now() - lastQuoteErrorToastTime > ERROR_TOAST_COOLDOWN_MS) {
        toast.warn('Asset data is not yet loaded. Cannot request quotes.', {
          toastId: 'assets-not-loaded',
        })
        lastQuoteErrorToastTime = Date.now()
      }
      return
    }

    // Send the request immediately, passing tickers and the assets list
    // Handle async request without blocking
    sendQuoteRequest(fromAssetTicker, toAssetTicker, fromAmount, assets).catch(
      (error) => {
        logger.error('Error in async quote request:', error)
      }
    )
  }
}

/**
 * Helper function to actually send the quote request
 */
const sendQuoteRequest = async (
  fromAssetTicker: string,
  toAssetTicker: string,
  fromAmount: number, // This fromAmount is in standard units (e.g., sats for BTC, base units for RGB)
  assets: NiaAsset[]
) => {
  // We use asset tickers in the UI, but need to send asset IDs to the websocket
  // Get the actual asset IDs to send in the request
  const fromAssetId = mapTickerToAssetId(fromAssetTicker, assets)
  const toAssetId = mapTickerToAssetId(toAssetTicker, assets)

  // Get display tickers for logging/errors
  const fromDisplayTicker = mapAssetIdToTicker(fromAssetId, assets)
  const toDisplayTicker = mapAssetIdToTicker(toAssetId, assets)

  // Update tracking variables for request rate limiting
  const requestTime = Date.now() // Capture current time before updating lastQuoteRequestTime
  lastQuoteRequestTime = requestTime
  // Key based on tickers and the original fromAmount (e.g., in sats for BTC)
  lastRequestedQuoteKey = `${fromAssetTicker}/${toAssetTicker}/${fromAmount}`

  // Determine the amount to send in the request.
  // If fromAsset is BTC, multiply by 1000 to convert to millisats for the backend.
  // Otherwise, use the fromAmount as is (which is in base units for RGB assets).
  let amountForRequest = fromAmount
  if (fromAssetTicker === 'BTC') {
    amountForRequest = fromAmount * 1000
  }

  try {
    // Only log if assets are different to avoid spam during swapping
    if (fromAssetTicker !== toAssetTicker) {
      logger.debug(
        `Requesting quote: ${fromDisplayTicker} -> ${toDisplayTicker}, Amount: ${amountForRequest}`
      )
    }

    // Send the quote request using resolved asset IDs and the potentially adjusted amount
    // Now using await since requestQuote is async and includes connection readiness checking
    const success = await webSocketService.requestQuote(
      fromAssetId,
      toAssetId,
      amountForRequest
    )

    if (!success) {
      logger.warn('Failed to send quote request via WebSocket service')

      // Check if WebSocket is not ready for communication
      if (!webSocketService.isConnectionReadyForCommunication()) {
        logger.debug('WebSocket connection not ready for quote requests')
        // Don't show error toast for connection readiness issues, as they're temporary
        return
      }

      // Show error toast only if it's been enough time since the last similar error toast
      if (Date.now() - lastQuoteErrorToastTime > ERROR_TOAST_COOLDOWN_MS) {
        toast.error(
          'Failed to send quote request. Connection may be unstable.',
          {
            autoClose: 4000, // Increased from 3000ms to 4000ms
            toastId: 'quote-request-failed',
          }
        )
        lastQuoteErrorToastTime = Date.now()
      }
    }
  } catch (error) {
    logger.error('Error in sendQuoteRequest:', error)
    if (Date.now() - lastQuoteErrorToastTime > ERROR_TOAST_COOLDOWN_MS) {
      toast.error('An unexpected error occurred while requesting the quote.', {
        autoClose: 4000, // Increased from 3000ms to 4000ms
        toastId: 'quote-request-exception',
      })
      lastQuoteErrorToastTime = Date.now()
    }
  }
}

/**
 * Starts a timer to request quotes periodically
 *
 * @param requestQuote Function to request a quote
 * @param intervalMs Interval in milliseconds (default: 15000)
 */
export const startQuoteRequestTimer = (
  requestQuote: () => Promise<void>,
  intervalMs: number = 15000 // Increased from 10000ms to 15000ms for less aggressive refreshing
): void => {
  // Clear any existing timer
  if (quoteRequestTimer) {
    clearInterval(quoteRequestTimer)
  }

  // Start a new timer
  quoteRequestTimer = setInterval(requestQuote, intervalMs)
}

/**
 * Stops the quote request timer
 */
export const stopQuoteRequestTimer = (): void => {
  if (quoteRequestTimer) {
    clearInterval(quoteRequestTimer)
    quoteRequestTimer = null
  }
}

/**
 * Creates a function to handle form amount changes and request a quote
 * with debouncing to avoid excessive requests while typing
 *
 * @param requestQuote Function to request a quote
 * @param setIsQuoteLoading Function to set quote loading state
 * @param setIsToAmountLoading Function to set to amount loading state
 * @param hasValidQuote Optional function to check if there's already a valid quote
 * @returns A function that can be called when the form amount changes
 */
export const createAmountChangeQuoteHandler = (
  requestQuote: () => Promise<void>,
  setIsQuoteLoading?: (loading: boolean) => void,
  setIsToAmountLoading?: (loading: boolean) => void,
  hasValidQuote?: () => boolean
) => {
  let debounceTimer: any = null

  return (e: ChangeEvent<HTMLInputElement>) => {
    // Cancel any pending debounced request
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    // Request a quote whenever the amount changes
    const value = e.target.value
    if (value && value !== '0') {
      // Only set loading states if we don't have a valid quote
      // This allows users to keep trading with current quotes while new ones load
      const currentlyHasValidQuote = hasValidQuote ? hasValidQuote() : false

      if (!currentlyHasValidQuote) {
        if (setIsQuoteLoading) {
          setIsQuoteLoading(true)
        }
        if (setIsToAmountLoading) {
          setIsToAmountLoading(true)
        }
      }

      // Use the defined constant for consistent debouncing
      debounceTimer = setTimeout(requestQuote, QUOTE_REQUEST_DEBOUNCE_MS)
    } else {
      // If amount is cleared, also clear loading states
      if (setIsQuoteLoading) {
        setIsQuoteLoading(false)
      }
      if (setIsToAmountLoading) {
        setIsToAmountLoading(false)
      }
    }
  }
}
