import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Layer } from 'kaleido-sdk'
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
  const [received, setReceived] = useState<{
    assetId: string
    amount: number
    quote: QuoteResponse
  } | null>(null)
  const latestRequest = useRef(0)
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

    const precision = assetMap[assetId]?.precision ?? 0
    return Math.round(parsed * Math.pow(10, precision))
  }, [assetId, assetMap, clientAssetAmount, enabled])

  const quote =
    received &&
    received.assetId === assetId &&
    received.amount === requestedAmount
      ? received.quote
      : null

  const resetQuote = useCallback(() => {
    latestRequest.current += 1
    setReceived(null)
    setQuoteError(null)
    setQuoteLoading(false)
  }, [])

  const requestQuote = useCallback(async () => {
    if (!enabled || !assetId || requestedAmount <= 0) {
      resetQuote()
      return null
    }

    const requestId = ++latestRequest.current
    setQuoteLoading(true)
    setQuoteError(null)

    try {
      const response = await getQuote({
        from_asset: {
          asset_id: 'BTC',
          layer: Layer.BTC_LN,
        },
        to_asset: {
          amount: requestedAmount,
          asset_id: assetId,
          layer: Layer.RGB_LN,
        },
      })

      if (requestId !== latestRequest.current) return null
      if (response.error) {
        const message = getQuoteErrorMessage(
          response.error,
          'Failed to get quote'
        )
        setReceived(null)
        setQuoteError(message)
        return null
      }

      if (response.data) {
        setReceived({ assetId, amount: requestedAmount, quote: response.data })
        setQuoteError(null)
        return response.data
      }

      setReceived(null)
      setQuoteError('No quote data returned')
      return null
    } catch (error) {
      if (requestId !== latestRequest.current) return null
      setReceived(null)
      setQuoteError(
        getQuoteErrorMessage(error, 'Failed to get quote. Please try again.')
      )
      return null
    } finally {
      if (requestId === latestRequest.current) setQuoteLoading(false)
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
      latestRequest.current += 1
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
    refetchQuote: requestQuote,
    requestedAmount,
    resetQuote,
  }
}
