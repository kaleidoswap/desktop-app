import { invoke } from '@tauri-apps/api/core'
import { useEffect, useRef } from 'react'
import { toast } from 'react-toastify'
import { FetchBaseQueryError } from '@reduxjs/toolkit/query'

import { store } from '../app/store'
import { useAppDispatch, useAppSelector } from '../app/store/hooks'
import {
  LimitOrder,
  expireLimitOrder,
  pauseLimitOrder,
  recordLimitExecution,
  setLimitOrders,
} from '../slices/limitOrderSlice'
import { makerApi, TradingPair } from '../slices/makerApi/makerApi.slice'
import { nodeApi } from '../slices/nodeApi/nodeApi.slice'
import { handleApiError } from '../routes/trade/market-maker/apiUtils'
import { validateSwapString } from '../routes/trade/market-maker/swapUtils'
import { logger } from '../utils/logger'

export const LIMIT_ORDER_SCHEDULER_INTERVAL_MS = 20_000
const MAX_SLIPPAGE_PCT = 3
const LIMIT_QUOTE_TIMEOUT_MS = 15_000
const PRICE_CACHE_TTL_MS = 30_000

const withTimeout = <T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${ms / 1000}s`)),
        ms
      )
    ),
  ])

function extractErrorText(err: unknown): string {
  if (err == null) return ''
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message

  if (typeof err === 'object') {
    const anyErr = err as Record<string, unknown>
    const candidates = [
      anyErr.message,
      anyErr.error,
      anyErr.reason,
      anyErr.details,
      typeof anyErr.data === 'string' ? anyErr.data : undefined,
      typeof anyErr.data === 'object' && anyErr.data
        ? (anyErr.data as Record<string, unknown>).message
        : undefined,
      typeof anyErr.data === 'object' && anyErr.data
        ? (anyErr.data as Record<string, unknown>).error
        : undefined,
    ].filter(
      (value): value is string =>
        typeof value === 'string' && value.trim().length > 0
    )

    if (candidates.length > 0) return candidates.join(' | ')
  }

  return String(err)
}

function normalizeLimitError(err: unknown) {
  const rawMessage = extractErrorText(err)
  const message = rawMessage
    .replace(/^[A-Za-z]*Error:\s*/i, '')
    .replace(/^API Error \(\d+\):\s*/i, '')
    .trim()
  const normalized = message.toLowerCase()

  if (
    normalized.includes('insufficient balance') ||
    normalized.includes('not enough balance') ||
    normalized.includes('insufficient funds') ||
    normalized.includes('insufficient liquidity') ||
    normalized.includes('insufficient outbound') ||
    normalized.includes('exceeds available')
  ) {
    return {
      internalMessage: rawMessage,
      userMessage:
        'Insufficient channel balance for this limit order. Order auto-paused.',
    }
  }

  if (
    normalized.includes('load failed') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('network error') ||
    normalized.includes('econnrefused')
  ) {
    return {
      internalMessage: rawMessage,
      userMessage:
        'Could not reach maker API. Please check connectivity and try again.',
    }
  }

  if (normalized.includes('timeout') || normalized.includes('timed out')) {
    return {
      internalMessage: rawMessage,
      userMessage: 'Request timed out. Will retry on next check.',
    }
  }

  if (
    normalized.includes('quote has expired') ||
    normalized.includes('quote expired')
  ) {
    return {
      internalMessage: rawMessage,
      userMessage:
        'Quote expired before swap could execute. Will retry on next check.',
    }
  }

  if (normalized.includes('swap string validation failed')) {
    return {
      internalMessage: rawMessage,
      userMessage:
        'Swap safety validation failed. Please retry with a fresh quote.',
    }
  }

  return {
    internalMessage: rawMessage,
    userMessage: message || 'Limit order execution failed.',
  }
}

function sendNotification(title: string, body: string) {
  if (!('Notification' in window)) return
  const send = () => new Notification(title, { body })
  if (Notification.permission === 'granted') {
    send()
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((perm) => {
      if (perm === 'granted') send()
    })
  }
}

/**
 * Determine the layer for a given asset based on its trading pair endpoint data.
 * BTC uses BTC_LN, RGB assets use RGB_LN.
 */
function getAssetLayer(
  ticker: string,
  assetId: string,
  pairs: TradingPair[]
): string {
  // BTC is always BTC_LN
  if (ticker.toUpperCase() === 'BTC' || assetId.toUpperCase() === 'BTC') {
    return 'BTC_LN'
  }

  // Look up the layer from pair endpoint data
  for (const pair of pairs) {
    for (const asset of [pair.base, pair.quote]) {
      if (asset.ticker === ticker) {
        const layer = asset.endpoints?.[0]?.layer
        if (layer) return layer
      }
    }
  }

  // Default for RGB assets
  return 'RGB_LN'
}

// Module-level ref so LimitOrderCard can call executeLimitOrderManually
type ExecuteFn = (orderId: string) => Promise<void>
const _executeFnRef: { current: ExecuteFn | null } = { current: null }

export function executeLimitOrderManually(orderId: string) {
  if (!_executeFnRef.current) {
    logger.warn('LimitOrder: scheduler not mounted')
    toast.warn('Limit order scheduler not ready')
    return
  }
  _executeFnRef.current(orderId)
}

export function useLimitOrderScheduler() {
  const dispatch = useAppDispatch()

  const accountName = useAppSelector((s) => s.nodeSettings.data.name)
  const orders = useAppSelector((s) => s.limitOrders.orders)
  const tradingPairs = useAppSelector((s) => s.pairs.values)

  // RTK Query hooks
  const [getQuote] = makerApi.endpoints.getQuote.useLazyQuery()
  const [initSwap] = makerApi.endpoints.initSwap.useLazyQuery()
  const [execSwap] = makerApi.endpoints.execSwap.useLazyQuery()
  const [whitelistTrade] = nodeApi.endpoints.whitelistTrade.useMutation()

  const { data: nodeInfoData, isSuccess: nodeInfoSuccess } =
    nodeApi.endpoints.nodeInfo.useQuery(undefined, { pollingInterval: 30_000 })
  const pubKey = (nodeInfoData as any)?.pubkey ?? ''
  const isNodeReady = nodeInfoSuccess && !!pubKey

  // Only poll assets/channels when node is unlocked — avoids 403s during startup
  const { data: assetsData } = nodeApi.endpoints.listAssets.useQuery(
    undefined,
    { pollingInterval: 60_000, skip: !isNodeReady }
  )
  const { data: channelsData } = nodeApi.endpoints.listChannels.useQuery(
    undefined,
    { pollingInterval: 30_000, skip: !isNodeReady }
  )

  const isExecuting = useRef(false)
  const executionQueueRef = useRef<Array<{ orderId: string }>>([])
  const queuedOrderIdsRef = useRef<Set<string>>(new Set())
  const runQueueRef = useRef<(() => Promise<void>) | null>(null)
  const hydratedAccountRef = useRef<string | null>(null)
  const isHydratingOrdersRef = useRef(false)
  const priceCacheRef = useRef<
    Record<string, { price: number; timestamp: number }>
  >({})

  // Keep refs in sync
  const isNodeReadyRef = useRef(isNodeReady)
  const pubKeyRef = useRef(pubKey)
  const assetsRef = useRef(assetsData)
  const channelsRef = useRef(channelsData)
  const tradingPairsRef = useRef(tradingPairs)
  const getQuoteRef = useRef(getQuote)
  const initSwapRef = useRef(initSwap)
  const execSwapRef = useRef(execSwap)
  const whitelistTradeRef = useRef(whitelistTrade)

  useEffect(() => {
    isNodeReadyRef.current = isNodeReady
  }, [isNodeReady])
  useEffect(() => {
    pubKeyRef.current = pubKey
  }, [pubKey])
  useEffect(() => {
    assetsRef.current = assetsData
  }, [assetsData])
  useEffect(() => {
    channelsRef.current = channelsData
  }, [channelsData])
  useEffect(() => {
    tradingPairsRef.current = tradingPairs
  }, [tradingPairs])
  useEffect(() => {
    getQuoteRef.current = getQuote
  }, [getQuote])
  useEffect(() => {
    initSwapRef.current = initSwap
  }, [initSwap])
  useEffect(() => {
    execSwapRef.current = execSwap
  }, [execSwap])
  useEffect(() => {
    whitelistTradeRef.current = whitelistTrade
  }, [whitelistTrade])

  // ── Load orders from DB for the active account ──
  // Only load when the node is unlocked to avoid "No account selected" errors.
  useEffect(() => {
    const loadOrders = async () => {
      hydratedAccountRef.current = null
      isHydratingOrdersRef.current = true
      prevOrderIdsRef.current = new Set()
      dispatch(setLimitOrders([]))

      if (!accountName || !isNodeReady) {
        isHydratingOrdersRef.current = false
        return
      }

      try {
        const payloads = await invoke<string[]>('limit_get_orders')
        if (payloads.length > 0) {
          const loaded = payloads.map((p) => JSON.parse(p) as LimitOrder)
          hydratedAccountRef.current = accountName
          isHydratingOrdersRef.current = false
          dispatch(setLimitOrders(loaded.reverse()))
          logger.info(
            `LimitOrder: loaded ${loaded.length} orders from DB for account ${accountName}`
          )
          return
        }
      } catch (err) {
        logger.error('LimitOrder: limit_get_orders failed', err)
      }

      hydratedAccountRef.current = accountName
      isHydratingOrdersRef.current = false
    }

    loadOrders()
  }, [accountName, isNodeReady, dispatch])

  // ── Mirror orders → DB on every change ──
  const prevOrderIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (
      !accountName ||
      isHydratingOrdersRef.current ||
      hydratedAccountRef.current !== accountName
    ) {
      return
    }

    const currIds = new Set(orders.map((o) => o.id))

    orders.forEach((order) => {
      invoke('limit_upsert_order', {
        orderId: order.id,
        payload: JSON.stringify(order),
      }).catch((err) => logger.error('limit_upsert_order failed', err))
    })

    prevOrderIdsRef.current.forEach((id) => {
      if (!currIds.has(id)) {
        invoke('limit_delete_order', { orderId: id }).catch((err) =>
          logger.error('limit_delete_order failed', err)
        )
      }
    })

    prevOrderIdsRef.current = currIds
  }, [accountName, orders])

  // ── Core execution — registered once, uses refs for live state ──
  useEffect(() => {
    const enqueueExecution = (orderId: string) => {
      if (queuedOrderIdsRef.current.has(orderId)) return
      queuedOrderIdsRef.current.add(orderId)
      executionQueueRef.current.push({ orderId })
      void runQueueRef.current?.()
    }

    const executeOrder = async (orderId: string) => {
      logger.info(`LimitOrder execute: order=${orderId}`)

      if (!isNodeReadyRef.current) {
        logger.warn('LimitOrder: node not ready, skipping execution')
        toast.warn('Limit order: node not ready — wallet must be unlocked')
        return
      }

      const state = store.getState()
      const order = state.limitOrders.orders.find(
        (o) => o.id === orderId && o.status === 'active'
      )
      if (!order) {
        logger.warn(`LimitOrder: order ${orderId} not found or not active`)
        return
      }

      isExecuting.current = true
      const toastId = toast.loading(
        `Limit order: requesting ${order.baseAssetTicker}/${order.quoteAssetTicker} quote...`
      )

      try {
        const pairs = tradingPairsRef.current || []

        // Determine from/to based on side
        // Buy: spending quote asset to get base asset
        // Sell: spending base asset to get quote asset
        const fromAssetId =
          order.side === 'buy' ? order.quoteAssetId : order.baseAssetId
        const fromTicker =
          order.side === 'buy' ? order.quoteAssetTicker : order.baseAssetTicker
        const toAssetId =
          order.side === 'buy' ? order.baseAssetId : order.quoteAssetId
        const toTicker =
          order.side === 'buy' ? order.baseAssetTicker : order.quoteAssetTicker

        const fromLayer = getAssetLayer(fromTicker, fromAssetId, pairs)
        const toLayer = getAssetLayer(toTicker, toAssetId, pairs)

        // Calculate raw from_amount
        // For buy: from_amount is in quote asset = amount * limitPrice (in quote precision units)
        // For sell: from_amount is the base asset amountRaw
        const fromAmountRaw =
          order.side === 'buy'
            ? order.amountRaw // Already computed as quote amount in precision units
            : order.amountRaw

        // 1. Fetch quote
        toast.update(toastId, {
          render: `(1/4) Requesting ${fromTicker}→${toTicker} quote...`,
        })
        const quoteResp = await withTimeout(
          getQuoteRef.current({
            from_asset: {
              asset_id: fromAssetId,
              layer: fromLayer,
              amount: fromAmountRaw,
            },
            to_asset: {
              asset_id: toAssetId,
              layer: toLayer,
            },
          } as any),
          LIMIT_QUOTE_TIMEOUT_MS,
          'Limit order quote request'
        )

        if ('error' in quoteResp || !quoteResp.data) {
          throw new Error(
            quoteResp.error
              ? handleApiError(quoteResp.error as FetchBaseQueryError)
              : 'No quote data returned'
          )
        }

        const quote = quoteResp.data
        logger.info(
          `LimitOrder: quote received rfq_id=${quote.rfq_id} to_amount=${quote.to_asset.amount}`
        )

        // 2. Slippage check against limit price
        const rawQuotedPrice = (quote as any).price
        let quotedPrice: number | undefined = undefined
        if (rawQuotedPrice && rawQuotedPrice > 0) {
          const pair = pairs.find((p) => p.id === order.pairId)
          const quotePrecision = pair?.quote?.precision ?? 6
          quotedPrice = rawQuotedPrice / Math.pow(10, quotePrecision)
        }

        if (quotedPrice && quotedPrice > 0) {
          const slippagePct =
            order.side === 'buy'
              ? ((quotedPrice - order.limitPrice) / order.limitPrice) * 100
              : ((order.limitPrice - quotedPrice) / order.limitPrice) * 100

          logger.info(
            `LimitOrder: slippage=${slippagePct.toFixed(3)}% (limit=${order.limitPrice} quoted=${quotedPrice})`
          )
          if (slippagePct > MAX_SLIPPAGE_PCT) {
            throw new Error(
              `Slippage too high: ${slippagePct.toFixed(2)}% (max ${MAX_SLIPPAGE_PCT}%)`
            )
          }
        }

        // 3. Init swap
        toast.update(toastId, {
          render: '(2/4) Initializing limit order swap...',
        })
        const initPayload = {
          from_amount: fromAmountRaw,
          from_asset: (quote.from_asset as any).asset_id ?? fromAssetId,
          rfq_id: quote.rfq_id,
          to_amount: quote.to_asset.amount,
          to_asset: (quote.to_asset as any).asset_id ?? toAssetId,
        }

        const initResp = await initSwapRef.current(initPayload)
        if ('error' in initResp)
          throw new Error(handleApiError(initResp.error as FetchBaseQueryError))
        if (!initResp.data) throw new Error('No data from initSwap')

        const { swapstring, payment_hash } = initResp.data as any
        logger.info(`LimitOrder: initSwap OK payment_hash=${payment_hash}`)

        if (
          !validateSwapString(
            swapstring,
            fromAmountRaw,
            initPayload.from_asset,
            quote.to_asset.amount,
            initPayload.to_asset,
            payment_hash
          )
        ) {
          throw new Error('Swap string validation failed')
        }

        // 4. Whitelist
        toast.update(toastId, {
          render: '(3/4) Whitelisting limit order trade...',
        })
        const whitelistResp = await whitelistTradeRef.current({ swapstring })
        if ('error' in whitelistResp)
          throw new Error(
            handleApiError(whitelistResp.error as FetchBaseQueryError)
          )
        logger.info('LimitOrder: whitelisted OK')

        // 5. Execute
        toast.update(toastId, {
          render: '(4/4) Executing limit order swap...',
        })
        const execResp = await execSwapRef.current({
          payment_hash,
          swapstring,
          taker_pubkey: pubKeyRef.current,
        })
        if ('error' in execResp)
          throw new Error(handleApiError(execResp.error as FetchBaseQueryError))
        logger.info('LimitOrder: execSwap OK')

        // 6. Record success
        const executionPrice = quotedPrice ?? order.limitPrice
        toast.update(toastId, {
          autoClose: 5000,
          isLoading: false,
          render: `Limit order filled: ${order.side} ${order.amount} ${order.baseAssetTicker} at ${executionPrice} ${order.quoteAssetTicker}`,
          type: 'success',
        })

        dispatch(
          recordLimitExecution({
            executionPrice,
            fromAmount: fromAmountRaw,
            fromAssetTicker: fromTicker,
            orderId,
            status: 'success',
            toAmount: quote.to_asset.amount,
            toAssetTicker: toTicker,
          })
        )

        sendNotification(
          'Limit order filled',
          `${order.side === 'buy' ? 'Bought' : 'Sold'} ${order.amount} ${order.baseAssetTicker} at ${executionPrice} ${order.quoteAssetTicker}`
        )
      } catch (err) {
        const { internalMessage, userMessage } = normalizeLimitError(err)
        logger.error('LimitOrder execution failed', {
          error: err,
          normalizedMessage: internalMessage,
        })

        toast.update(toastId, {
          autoClose: 6000,
          isLoading: false,
          render: `Limit order failed: ${userMessage}`,
          type: 'error',
        })

        // Auto-pause on balance errors
        if (
          internalMessage.toLowerCase().includes('insufficient') ||
          internalMessage.toLowerCase().includes('not enough')
        ) {
          dispatch(pauseLimitOrder(orderId))
        }

        dispatch(
          recordLimitExecution({
            error: userMessage,
            executionPrice: 0,
            fromAmount: 0,
            fromAssetTicker: '',
            orderId,
            status: 'failed',
            toAmount: 0,
            toAssetTicker: '',
          })
        )
      } finally {
        isExecuting.current = false
      }
    }

    const runQueue = async () => {
      if (isExecuting.current) return
      const next = executionQueueRef.current.shift()
      if (!next) return
      queuedOrderIdsRef.current.delete(next.orderId)
      await executeOrder(next.orderId)
      if (executionQueueRef.current.length > 0) {
        void runQueue()
      }
    }

    runQueueRef.current = runQueue

    _executeFnRef.current = async (orderId: string) => {
      enqueueExecution(orderId)
    }

    // ── Fetch price for a pair via quote polling ──
    const fetchPriceForPair = async (
      baseAssetId: string,
      baseTicker: string,
      quoteAssetId: string,
      quoteTicker: string,
      pairId: string
    ): Promise<number | null> => {
      const cached = priceCacheRef.current[pairId]
      if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL_MS) {
        return cached.price
      }

      const pairs = tradingPairsRef.current || []
      const quoteLayer = getAssetLayer(quoteTicker, quoteAssetId, pairs)
      const baseLayer = getAssetLayer(baseTicker, baseAssetId, pairs)

      // Find the pair to get min order size
      const pair = pairs.find((p) => p.id === pairId)
      const minAmount = pair?.quote?.endpoints?.[0]?.min_amount || 1000

      try {
        const quoteResp = await withTimeout(
          getQuoteRef.current({
            from_asset: {
              asset_id: quoteAssetId,
              layer: quoteLayer,
              amount: minAmount,
            },
            to_asset: {
              asset_id: baseAssetId,
              layer: baseLayer,
            },
          } as any),
          10_000,
          'Price poll quote'
        )

        if ('error' in quoteResp || !quoteResp.data) return null

        const price = (quoteResp.data as any).price
        if (price && price > 0) {
          // Convert raw price to display price using quote precision
          const pair = pairs.find((p) => p.id === pairId)
          const quotePrecision = pair?.quote?.precision ?? 6
          const displayPrice = price / Math.pow(10, quotePrecision)

          priceCacheRef.current[pairId] = {
            price: displayPrice,
            timestamp: Date.now(),
          }
          return displayPrice
        }
      } catch {
        // Skip this tick
      }
      return null
    }

    // ── Scheduler: check orders every few seconds ──
    const checkOrders = async () => {
      if (!isNodeReadyRef.current) return

      const state = store.getState()
      const now = Date.now()
      const activeOrders = state.limitOrders.orders.filter(
        (o) => o.status === 'active'
      )

      if (activeOrders.length === 0) return

      // Check expirations first
      for (const order of activeOrders) {
        if (order.expiresAt && now >= order.expiresAt) {
          logger.info(`LimitOrder: order ${order.id} expired`)
          dispatch(expireLimitOrder(order.id))
          sendNotification(
            'Limit order expired',
            `${order.side} ${order.amount} ${order.baseAssetTicker} at ${order.limitPrice} ${order.quoteAssetTicker}`
          )
          continue
        }

        // Fetch current price for this pair
        const currentPrice = await fetchPriceForPair(
          order.baseAssetId,
          order.baseAssetTicker,
          order.quoteAssetId,
          order.quoteAssetTicker,
          order.pairId
        )

        if (!currentPrice || currentPrice <= 0) continue

        // Buy limit: trigger when market price drops to or below limit price
        if (order.side === 'buy' && currentPrice <= order.limitPrice) {
          logger.info(
            `LimitOrder: BUY trigger order=${order.id} current=${currentPrice} limit=${order.limitPrice}`
          )
          enqueueExecution(order.id)
        }
        // Sell limit: trigger when market price rises to or above limit price
        if (order.side === 'sell' && currentPrice >= order.limitPrice) {
          logger.info(
            `LimitOrder: SELL trigger order=${order.id} current=${currentPrice} limit=${order.limitPrice}`
          )
          enqueueExecution(order.id)
        }
      }
    }

    const intervalId = setInterval(
      () => void checkOrders(),
      LIMIT_ORDER_SCHEDULER_INTERVAL_MS
    )
    logger.info(
      `LimitOrder: scheduler started (every ${LIMIT_ORDER_SCHEDULER_INTERVAL_MS / 1000}s)`
    )

    // Initial check
    void checkOrders()

    return () => {
      clearInterval(intervalId)
      _executeFnRef.current = null
      runQueueRef.current = null
      executionQueueRef.current = []
      queuedOrderIdsRef.current.clear()
      logger.info('LimitOrder: scheduler stopped')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch])
}
