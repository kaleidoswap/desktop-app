import { useCallback, useEffect, useMemo, useState } from 'react'

import { QuoteResponse, makerApi } from '../slices/makerApi/makerApi.slice'
import { AssetInfo } from '../utils/channelOrderUtils'

interface UseAssetChannelQuoteParams {
  assetId?: string
  assetMap: Record<string, AssetInfo>
  clientAssetAmount?: string
  debounceMs?: number
  enabled?: boolean
  refreshBufferMs?: number
}

const DEFAULT_DEBOUNCE_MS = 500
const DEFAULT_REFRESH_BUFFER_MS = 10_000

const getQuoteErrorMessage = (error: unknown, fallback: string): string => {
  if (
    typeof error === 'object' &&
    error &&
    'error' in error &&
    typeof (error as { error?: unknown }).error === 'string'
  ) {
    return (error as { error: string }).error
  }

  if (
    typeof error === 'object' &&
    error &&
    'data' in error &&
    typeof (error as { data?: { error?: unknown } }).data?.error === 'string'
  ) {
    return (error as { data: { error: string } }).data.error
  }

  return fallback
}

export const getQuoteToAmount = (quote: QuoteResponse | null | undefined) =>
  quote?.to_asset?.amount || (quote as any)?.to_amount || 0

export const getQuoteFromAmount = (quote: QuoteResponse | null | undefined) =>
  quote?.from_asset?.amount || (quote as any)?.from_amount || 0

export function useAssetChannelQuote({
  assetId,
  assetMap,
  clientAssetAmount,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  enabled = true,
  refreshBufferMs = DEFAULT_REFRESH_BUFFER_MS,
}: UseAssetChannelQuoteParams) {
  const [getQuote] = makerApi.endpoints.getQuote.useLazyQuery()
  const [quote, setQuote] = useState<QuoteResponse | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)

  const requestedAmount = useMemo(() => {
    if (!enabled || !assetId || !clientAssetAmount) {
      return 0
    }

    const parsed = parseFloat(clientAssetAmount)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 0
    }

    const precision = assetMap[assetId]?.precision || 0
    return Math.round(parsed * Math.pow(10, precision))
  }, [assetId, assetMap, clientAssetAmount, enabled])

  const resetQuote = useCallback(() => {
    setQuote(null)
    setQuoteError(null)
    setQuoteLoading(false)
  }, [])

  const requestQuote = useCallback(async () => {
    if (!enabled || !assetId || requestedAmount <= 0) {
      resetQuote()
      return null
    }

    setQuoteLoading(true)
    setQuoteError(null)

    try {
      const response = await getQuote({
        from_asset: {
          asset_id: 'BTC',
          layer: 'BTC_LN',
        },
        to_asset: {
          amount: requestedAmount,
          asset_id: assetId,
          layer: 'RGB_LN',
        },
      })

      if (response.error) {
        const message = getQuoteErrorMessage(
          response.error,
          'Failed to get quote'
        )
        setQuote(null)
        setQuoteError(message)
        return null
      }

      if (response.data) {
        setQuote(response.data)
        setQuoteError(null)
        return response.data
      }

      setQuote(null)
      setQuoteError('No quote data returned')
      return null
    } catch (error) {
      setQuote(null)
      setQuoteError(
        getQuoteErrorMessage(error, 'Failed to get quote. Please try again.')
      )
      return null
    } finally {
      setQuoteLoading(false)
    }
  }, [assetId, enabled, getQuote, requestedAmount, resetQuote])

  useEffect(() => {
    if (!enabled || !assetId || requestedAmount <= 0) {
      resetQuote()
      return
    }

    const timeoutId = window.setTimeout(() => {
      void requestQuote()
    }, debounceMs)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [assetId, debounceMs, enabled, requestQuote, requestedAmount, resetQuote])

  useEffect(() => {
    if (!enabled || !quote?.expires_at || !assetId || requestedAmount <= 0) {
      return
    }

    const refreshDelay = Math.max(
      0,
      quote.expires_at * 1000 - Date.now() - refreshBufferMs
    )

    const timeoutId = window.setTimeout(() => {
      void requestQuote()
    }, refreshDelay)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    assetId,
    enabled,
    quote?.expires_at,
    refreshBufferMs,
    requestQuote,
    requestedAmount,
  ])

  return {
    quote,
    quoteError,
    quoteLoading,
    requestedAmount,
    resetQuote,
    refetchQuote: requestQuote,
  }
}
