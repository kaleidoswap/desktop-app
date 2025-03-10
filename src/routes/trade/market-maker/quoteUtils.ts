import { ChangeEvent } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { toast } from 'react-toastify'

import { webSocketService } from '../../../app/hubs/websocketService'
import { logger } from '../../../utils/logger'

import { Fields } from './types'

let quoteRequestTimer: any | null = null
let quoteDebounceTimer: any | null = null
let lastQuoteRequestTime = 0
let lastRequestedQuoteKey = ''

/**
 * Creates a function to handle requesting quotes from the market maker
 * with built-in debouncing and duplicate request prevention
 * 
 * @param form Form instance from react-hook-form
 * @param parseAssetAmount Function to parse asset amount
 * @param setIsQuoteLoading Function to set the loading state for the quote
 * @returns A function that can be called to request a quote
 */
export const createQuoteRequestHandler = (
  form: UseFormReturn<Fields>,
  parseAssetAmount: (amount: string | undefined | null, asset: string) => number,
  setIsQuoteLoading: (loading: boolean) => void
) => {
  return async () => {
    const fromAsset = form.getValues().fromAsset
    const toAsset = form.getValues().toAsset
    const fromAmountStr = form.getValues().from

    // Skip if either asset is not set
    if (!fromAsset || !toAsset) {
      return
    }

    // Skip if amount is not set or is zero
    if (!fromAmountStr || fromAmountStr === '0') {
      return
    }

    // Parse the amount
    const fromAmount = parseAssetAmount(fromAmountStr, fromAsset)
    if (fromAmount <= 0) {
      return
    }

    // Create a unique key for this quote request
    const quoteKey = `${fromAsset}/${toAsset}/${fromAmount}`
    
    // Skip if this is the exact same quote we just requested 
    if (quoteKey === lastRequestedQuoteKey) {
      const timeSinceLastRequest = Date.now() - lastQuoteRequestTime
      if (timeSinceLastRequest < 1000) { // 1 second duplicate protection
        return
      }
    }

    // Check if enough time has passed since the last request
    // const now = Date.now()
    // const timeSinceLastRequest = now - lastQuoteRequestTime
    
    // if (timeSinceLastRequest < MIN_QUOTE_INTERVAL) {
    //   // If we already have a pending request, cancel it
    //   if (quoteDebounceTimer) {
    //     clearTimeout(quoteDebounceTimer)
    //   }
      
    //   // Schedule this request for later
    //   quoteDebounceTimer = setTimeout(() => {
    //     sendQuoteRequest(fromAsset, toAsset, fromAmount, setIsQuoteLoading)
    //   }, MIN_QUOTE_INTERVAL - timeSinceLastRequest)
      
    //   return
    // }
    
    // Send the request immediately
    sendQuoteRequest(fromAsset, toAsset, fromAmount, setIsQuoteLoading)
  }
}

/**
 * Helper function to actually send the quote request
 */
const sendQuoteRequest = (
  fromAsset: string,
  toAsset: string, 
  fromAmount: number,
  setIsQuoteLoading: (loading: boolean) => void
) => {
  // Update tracking variables
  lastQuoteRequestTime = Date.now()
  lastRequestedQuoteKey = `${fromAsset}/${toAsset}/${fromAmount}`
  
  // Set loading state
  setIsQuoteLoading(true)

  try {
    // Send the quote request
    const success = webSocketService.requestQuote(fromAsset, toAsset, fromAmount)
    
    if (!success) {
      logger.warn('Failed to send quote request')
      // Don't show error toast for every failure to avoid spamming the user
      if (Date.now() - lastQuoteRequestTime > 5000) { // Show error only if it's been 5+ seconds since last error
        toast.error('Failed to get price quote. Please try again.', {
          toastId: 'quote-request-failed',
          autoClose: 3000
        })
      }
    }
  } catch (error) {
    logger.error('Error requesting quote:', error)
  }
}

/**
 * Starts a timer to request quotes periodically
 * 
 * @param requestQuote Function to request a quote
 * @param intervalMs Interval in milliseconds (default: 5000)
 */
export const startQuoteRequestTimer = (
  requestQuote: () => Promise<void>,
  intervalMs: number = 5000  // Increased from 3000 to 5000
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
  
  // Also clear any pending debounced requests
  if (quoteDebounceTimer) {
    clearTimeout(quoteDebounceTimer)
    quoteDebounceTimer = null
  }
}

/**
 * Creates a function to handle form amount changes and request a quote
 * with debouncing to avoid excessive requests while typing
 * 
 * @param requestQuote Function to request a quote
 * @returns A function that can be called when the form amount changes
 */
export const createAmountChangeQuoteHandler = (
  requestQuote: () => Promise<void>
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
      // Use a longer timeout to avoid too many requests while typing
      debounceTimer = setTimeout(requestQuote, 500) // Increased from 300 to 500
    }
  }
} 