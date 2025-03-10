import { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { toast } from 'react-toastify'

import { TradingPair } from '../../../slices/makerApi/makerApi.slice'
import { NiaAsset } from '../../../slices/nodeApi/nodeApi.slice'
import { logger } from '../../../utils/logger'

import { handleApiError } from './apiUtils'
import { Fields } from './types'

/**
 * Type for swap recap details
 */
export interface SwapDetails {
  fromAmount: string
  fromAsset: string
  toAmount: string
  toAsset: string
  price: number
  timestamp: string
  payment_hash: string
  selectedPair: TradingPair | null
}

/**
 * Copies error details to clipboard
 */
export const copyToClipboard = (text: string) => {
  navigator.clipboard.write([
    new ClipboardItem({
      'text/plain': new Blob([text], { type: 'text/plain' }),
    }),
  ])
  toast.success('Error details copied to clipboard')
}

/**
 * Validates the swapstring format and contents
 */
export const validateSwapString = (
  swapstring: string,
  fromAmount: number,
  fromAssetId: string,
  toAmount: number,
  toAssetId: string,
  payment_hash: string
): boolean => {
  // Validate swapstring format
  const swap_parts = swapstring.split('/')
  if (swap_parts.length !== 6) {
    logger.error(`Invalid swap string format: ${swapstring}`)
    return false
  }

  const [
    swapFromAmount,
    swapFromAsset,
    swapToAmount,
    swapToAsset,
    _,
    swapPaymentHash,
  ] = swap_parts

  // Validate swap string contents
  if (
    parseInt(swapFromAmount) !== fromAmount ||
    swapFromAsset !== fromAssetId ||
    parseInt(swapToAmount) !== toAmount ||
    swapToAsset !== toAssetId ||
    swapPaymentHash !== payment_hash
  ) {
    logger.error('Swap string contents do not match the payload')
    logger.error(
      `Expected: ${fromAmount}/${fromAssetId}/${toAmount}/${toAssetId}/${payment_hash}`
    )
    logger.error(
      `Received: ${swapFromAmount}/${swapFromAsset}/${swapToAmount}/${swapToAsset}/${swapPaymentHash}`
    )
    return false
  }

  return true
}

/**
 * Creates a function to execute a swap
 */
export const createSwapExecutor = (
  assets: NiaAsset[],
  pubKey: string,
  price: number,
  selectedPair: TradingPair | null,
  parseAssetAmount: (
    amount: string | undefined | null,
    asset: string
  ) => number,
  formatAmount: (amount: number, asset: string) => string,
  tradablePairs: TradingPair[],
  initSwap: any,
  taker: any,
  execSwap: any,
  setSwapRecapDetails: (details: SwapDetails) => void,
  setShowRecap: (show: boolean) => void,
  setErrorMessage: (message: string | null) => void,
  setIsSwapInProgress: (inProgress: boolean) => void
) => {
  return async (data: Fields): Promise<void> => {
    let toastId: string | number | null = null
    let timeoutId: any | null = null
    let errorMessage: string | null = null

    const clearToastAndTimeout = () => {
      if (toastId !== null) {
        toast.dismiss(toastId)
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }
      setIsSwapInProgress(false)
    }

    try {
      setIsSwapInProgress(true)
      toastId = toast.loading('(1/3) Initializing swap...', {
        autoClose: false,
      })

      // Set a timeout for the entire swap process (e.g., 60 seconds)
      timeoutId = setTimeout(() => {
        throw new Error('Swap operation timed out')
      }, 60000)

      logger.info('Initiating swap', data)

      const pair = tradablePairs.find(
        (p) =>
          (p.base_asset === data.fromAsset && p.quote_asset === data.toAsset) ||
          (p.base_asset === data.toAsset && p.quote_asset === data.fromAsset)
      )

      if (!pair) {
        throw new Error('Invalid trading pair')
      }

      const fromAssetId =
        assets.find((asset) => asset.ticker === data.fromAsset)?.asset_id ||
        'btc'
      const toAssetId =
        assets.find((asset) => asset.ticker === data.toAsset)?.asset_id || 'btc'

      if (!fromAssetId || !toAssetId) {
        throw new Error('Invalid asset ID')
      }
      if (fromAssetId === toAssetId) {
        throw new Error('Cannot swap the same asset')
      }

      let toAmount = parseAssetAmount(data.to, data.toAsset)
      let fromAmount = parseAssetAmount(data.from, data.fromAsset)

      // Multiply by 1000 if the asset is BTC
      if (data.fromAsset.toLowerCase() === 'btc') {
        fromAmount *= 1000
      }
      if (data.toAsset.toLowerCase() === 'btc') {
        toAmount *= 1000
      }
      const rfq_id = data.rfq_id
      if (!rfq_id) {
        throw new Error('Invalid RFQ ID')
      }
      const payload = {
        from_amount: fromAmount,
        from_asset: fromAssetId,
        rfq_id: rfq_id,
        to_amount: toAmount,
        to_asset: toAssetId,
      }
      logger.debug('Swap payload:', payload)

      const initSwapResponse = await initSwap(payload)
      if ('error' in initSwapResponse) {
        const errorMessage = handleApiError(
          initSwapResponse.error as FetchBaseQueryError
        )
        setErrorMessage(errorMessage)
        throw new Error(errorMessage)
      }

      if (!initSwapResponse.data) {
        throw new Error('No data received from swap initialization')
      }

      const { swapstring, payment_hash } = initSwapResponse.data

      toast.update(toastId, {
        isLoading: true,
        render: '(2/3) Processing taker whitelisting...',
      })

      // Check if the swapstring is valid
      if (!swapstring) {
        throw new Error('Invalid swapstring')
      }

      // Validate swapstring
      if (
        !validateSwapString(
          swapstring,
          fromAmount,
          fromAssetId,
          toAmount,
          toAssetId,
          payment_hash
        )
      ) {
        throw new Error('Invalid swap string validation')
      }

      const takerResponse = await taker({ swapstring })
      if ('error' in takerResponse) {
        throw new Error(
          handleApiError(takerResponse.error as FetchBaseQueryError)
        )
      }

      const confirmSwapPayload = {
        payment_hash,
        swapstring,
        taker_pubkey: pubKey,
      }
      toast.update(toastId, {
        isLoading: true,
        render: '(3/3) Waiting for maker to execute swap...',
      })

      const confirmSwapResponse = await execSwap(confirmSwapPayload)
      if ('error' in confirmSwapResponse) {
        throw new Error(
          handleApiError(confirmSwapResponse.error as FetchBaseQueryError)
        )
      }

      logger.info('Swap executed successfully!')
      toast.update(toastId, {
        autoClose: 5000,
        closeOnClick: true,
        isLoading: false,
        render: 'Swap executed successfully!',
        type: 'success',
      })

      // Prepare and show the swap recap
      const recapDetails: SwapDetails = {
        fromAmount: formatAmount(
          parseAssetAmount(data.from, data.fromAsset),
          data.fromAsset
        ),
        fromAsset: data.fromAsset,
        payment_hash: payment_hash,
        price: price || 0,
        selectedPair: selectedPair,
        timestamp: new Date().toISOString(),
        toAmount: formatAmount(
          parseAssetAmount(data.to, data.toAsset),
          data.toAsset
        ),
        toAsset: data.toAsset,
      }
      setSwapRecapDetails(recapDetails)
      setShowRecap(true)
    } catch (error) {
      logger.error('Error executing swap', error)

      // Extract error message
      errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred'
      setErrorMessage(errorMessage)

      // Clear any existing toasts first
      toast.dismiss()

      toast.error(`Swap Failed: ${errorMessage}`, {
        autoClose: 5000,
        closeButton: true,
        closeOnClick: false,
        draggable: false,
        isLoading: false,
        onClick: (e) => e.stopPropagation(),
        pauseOnFocusLoss: false,
        pauseOnHover: true,
      })

      setIsSwapInProgress(false)
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      return
    } finally {
      if (!errorMessage) {
        clearToastAndTimeout()
      }
    }
  }
}
