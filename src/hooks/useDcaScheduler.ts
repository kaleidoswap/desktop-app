import { invoke } from '@tauri-apps/api/core'
import { useEffect, useRef } from 'react'
import { toast } from 'react-toastify'

import { store } from '../app/store'
import { useAppDispatch, useAppSelector } from '../app/store/hooks'
import {
  DcaOrder,
  pauseOrder,
  recordExecution,
  setOrders,
  updateAfterExecution,
} from '../slices/dcaSlice'
import { makerApi } from '../slices/makerApi/makerApi.slice'
import { nodeApi } from '../slices/nodeApi/nodeApi.slice'
import { handleApiError } from '../routes/trade/market-maker/apiUtils'
import { validateSwapString } from '../routes/trade/market-maker/swapUtils'
import { SATOSHIS_PER_BTC } from '../helpers/number'
import { logger } from '../utils/logger'
import { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { NiaAsset } from '../slices/nodeApi/nodeApi.slice'
import { useBitcoinPrice } from './useBitcoinPrice'

export const DCA_SCHEDULER_INTERVAL_MS = 5_000
const MAX_SLIPPAGE_PCT = 2
const DCA_QUOTE_TIMEOUT_MS = 15_000
const LEGACY_STORAGE_KEY = 'kaleidoswap_dca_orders'

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

function normalizeDcaError(err: unknown) {
  const rawMessage = extractErrorText(err)
  // Strip any leading error class name prefix (e.g. "TypeError: ", "ValidationError: ", "API Error (422): ")
  const message = rawMessage
    .replace(/^[A-Za-z]*Error:\s*/i, '')
    .replace(/^API Error \(\d+\):\s*/i, '')
    .trim()
  const normalized = message.toLowerCase()

  if (
    normalized.includes('access-control-allow-origin') ||
    normalized.includes('cors') ||
    normalized.includes('origin http://localhost:1420 is not allowed') ||
    normalized.includes('origin not allowed')
  ) {
    return {
      internalMessage: rawMessage,
      userMessage:
        'Request blocked by CORS policy on maker API. Allow http://localhost:1420 in maker CORS settings.',
    }
  }

  if (
    normalized.includes('insufficient balance') ||
    normalized.includes('not enough balance') ||
    normalized.includes('insufficient funds') ||
    normalized.includes('not enough funds') ||
    normalized.includes('insufficient liquidity') ||
    normalized.includes('insufficient outbound') ||
    normalized.includes('exceeds available') ||
    normalized.includes('max send amount') ||
    normalized.includes('can only send') ||
    normalized.includes('channel balance')
  ) {
    return {
      internalMessage: rawMessage,
      userMessage:
        'Not enough USDT/BTC channel balance for this DCA order. Reduce amount or add liquidity.',
    }
  }

  if (
    normalized.includes('load failed') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('network error') ||
    normalized.includes('econnrefused') ||
    normalized.includes('connection refused')
  ) {
    return {
      internalMessage: rawMessage,
      userMessage:
        'Could not reach maker API (possible CORS block or connectivity issue). Please check maker settings and try again.',
    }
  }

  if (normalized.includes('timeout') || normalized.includes('timed out')) {
    return {
      internalMessage: rawMessage,
      userMessage: 'Request timed out. Please try again in a moment.',
    }
  }

  if (
    normalized.includes('rate limit') ||
    normalized.includes('too many requests')
  ) {
    return {
      internalMessage: rawMessage,
      userMessage:
        'Rate limited by maker API. Will retry on next scheduled interval.',
    }
  }

  if (
    normalized.includes('quote has expired') ||
    normalized.includes('quote expired') ||
    normalized.includes('quote_expired')
  ) {
    return {
      internalMessage: rawMessage,
      userMessage:
        'Quote expired before the swap could execute. Will retry on next interval.',
    }
  }

  if (
    normalized.includes('not configured') ||
    normalized.includes('rgb node not configured') ||
    normalized.includes('maker api not configured')
  ) {
    return {
      internalMessage: rawMessage,
      userMessage:
        'Maker API or RLN node is not configured. Check Settings → Maker URL and Node URL.',
    }
  }

  if (normalized.includes('slippage too high')) {
    return {
      internalMessage: rawMessage,
      userMessage: message,
    }
  }

  if (normalized.includes('swap string validation failed')) {
    return {
      internalMessage: rawMessage,
      userMessage:
        'Swap safety validation failed. Please retry with a fresh quote.',
    }
  }

  if (normalized.includes('no quote data returned')) {
    return {
      internalMessage: rawMessage,
      userMessage:
        'Could not get a valid quote from the maker. Please try again.',
    }
  }

  if (normalized.includes('usdt asset not found')) {
    return {
      internalMessage: rawMessage,
      userMessage:
        'USDT channel asset not available. Check wallet/channel state and retry.',
    }
  }

  return {
    internalMessage: rawMessage,
    userMessage: message || 'DCA swap failed. Please try again.',
  }
}

/**
 * Convert the fee from a quote response into satoshis.
 * fee_asset == 'BTC' (or empty) → final_fee is in msats → divide by 1000
 * Otherwise (USDT RGB asset) → final_fee is in asset units → convert using btcPrice
 */
function computeFeeSats(
  fee:
    | { final_fee: number; fee_asset?: string; fee_asset_precision?: number }
    | undefined,
  btcPriceUsdt: number
): number {
  if (!fee || !fee.final_fee) return 0
  const { final_fee, fee_asset, fee_asset_precision } = fee
  if (!fee_asset || fee_asset.toUpperCase() === 'BTC') {
    return Math.round(final_fee / 1000)
  }
  // USDT RGB asset: convert to sats via BTC price
  const precision = fee_asset_precision ?? 6
  const feeUsdt = final_fee / Math.pow(10, precision)
  return btcPriceUsdt > 0
    ? Math.round((feeUsdt / btcPriceUsdt) * SATOSHIS_PER_BTC)
    : 0
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

/** Build DcaOrderInfo compatible with the Rust struct */
function toRustOrder(order: DcaOrder) {
  return {
    amount_usdt: order.amountUsdt,
    id: order.id,
    interval_secs:
      order.intervalHours != null
        ? Math.round(order.intervalHours * 3600)
        : null,
    last_executed_at:
      order.lastExecutedAt != null
        ? Math.floor(order.lastExecutedAt / 1000)
        : null,
    order_type: order.type,
    status: order.status,
    trigger_price_usd: order.triggerPriceBtcUsdt ?? null,
  }
}

function computeUsdtLnBalance(
  channels: any[] | undefined,
  niAssets: NiaAsset[] | undefined
): number | null {
  if (!channels || !niAssets) return null
  const usdtAsset = niAssets.find(
    (asset: any) => asset.ticker === 'USDT'
  ) as any
  if (!usdtAsset) return null
  const precisionFactor = Math.pow(10, usdtAsset.precision ?? 6)
  const balance = channels
    .filter(
      (channel: any) => channel.ready && channel.asset_id === usdtAsset.asset_id
    )
    .reduce(
      (sum: number, channel: any) =>
        sum + (channel.asset_local_amount ?? 0) / precisionFactor,
      0
    )
  return balance
}

// Module-level ref so DcaOrderCard can call executeOrderManually without context
type ExecuteFn = (orderId: string, currentPrice: number) => Promise<void>
const _executeFnRef: { current: ExecuteFn | null } = { current: null }

export function executeOrderManually(orderId: string) {
  if (!_executeFnRef.current) {
    logger.warn('DCA: scheduler not mounted')
    toast.warn('DCA scheduler not ready')
    return
  }
  _executeFnRef.current(orderId, 0)
}

export function useDcaScheduler() {
  const dispatch = useAppDispatch()

  const accountName = useAppSelector((s) => s.nodeSettings.data.name)
  const orders = useAppSelector((s) => s.dca.orders)

  // BTC price for price-target orders
  const { btcPrice } = useBitcoinPrice()

  // RTK Query hooks — these return stable function references
  const [getQuote] = makerApi.endpoints.getQuote.useLazyQuery()
  const [initSwap] = makerApi.endpoints.initSwap.useLazyQuery()
  const [execSwap] = makerApi.endpoints.execSwap.useLazyQuery()
  const [whitelistTrade] = nodeApi.endpoints.whitelistTrade.useMutation()

  // Poll nodeInfo every 30s so the scheduler always knows node/wallet state,
  // regardless of which other components are mounted.
  const { data: nodeInfoData, isSuccess: nodeInfoSuccess } =
    nodeApi.endpoints.nodeInfo.useQuery(undefined, { pollingInterval: 30_000 })
  const pubKey = (nodeInfoData as any)?.pubkey ?? ''
  // Node is ready only when nodeInfo succeeds AND we have a pubkey (wallet unlocked)
  const isNodeReady = nodeInfoSuccess && !!pubKey

  // Poll assets every 60s for USDT precision
  const { data: assetsData } = nodeApi.endpoints.listAssets.useQuery(
    undefined,
    {
      pollingInterval: 60_000,
    }
  )
  const { data: channelsData } = nodeApi.endpoints.listChannels.useQuery(
    undefined,
    {
      pollingInterval: 30_000,
    }
  )

  const isExecuting = useRef(false)
  const executionQueueRef = useRef<
    Array<{ orderId: string; currentPrice: number }>
  >([])
  const queuedOrderIdsRef = useRef<Set<string>>(new Set())
  const runQueueRef = useRef<(() => Promise<void>) | null>(null)
  const hydratedAccountRef = useRef<string | null>(null)
  const isHydratingOrdersRef = useRef(false)

  // Keep refs in sync so the scheduler closure never goes stale
  const isNodeReadyRef = useRef(isNodeReady)
  const btcPriceRef = useRef(btcPrice)
  const pubKeyRef = useRef(pubKey)
  const assetsRef = useRef(assetsData)
  const channelsRef = useRef(channelsData)
  const getQuoteRef = useRef(getQuote)
  const initSwapRef = useRef(initSwap)
  const execSwapRef = useRef(execSwap)
  const whitelistTradeRef = useRef(whitelistTrade)

  useEffect(() => {
    isNodeReadyRef.current = isNodeReady
  }, [isNodeReady])
  useEffect(() => {
    btcPriceRef.current = btcPrice
  }, [btcPrice])
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

  // ── Load orders from DB for the active account (with localStorage migration) ──
  useEffect(() => {
    const loadOrders = async () => {
      hydratedAccountRef.current = null
      isHydratingOrdersRef.current = true
      prevOrderIdsRef.current = new Set()
      dispatch(setOrders([]))
      await invoke('dca_set_orders', { orders: [] }).catch((err) =>
        logger.error('dca_set_orders reset failed', err)
      )

      if (!accountName) {
        isHydratingOrdersRef.current = false
        return
      }

      try {
        const payloads = await invoke<string[]>('dca_get_orders')
        if (payloads.length > 0) {
          const loaded = payloads.map((p) => JSON.parse(p) as DcaOrder)
          // DB stores oldest-first; reverse to match unshift order (newest first)
          hydratedAccountRef.current = accountName
          isHydratingOrdersRef.current = false
          dispatch(setOrders(loaded.reverse()))
          logger.info(
            `DCA: loaded ${loaded.length} orders from DB for account ${accountName}`
          )
          return
        }
      } catch (err) {
        logger.error('DCA: dca_get_orders failed', err)
      }

      // Migration: if DB is empty, check localStorage
      try {
        const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
        if (raw) {
          const migrated = JSON.parse(raw) as DcaOrder[]
          if (migrated.length > 0) {
            hydratedAccountRef.current = accountName
            isHydratingOrdersRef.current = false
            dispatch(setOrders(migrated))
            logger.info(
              `DCA: migrated ${migrated.length} orders from localStorage for account ${accountName}`
            )
          }
          localStorage.removeItem(LEGACY_STORAGE_KEY)
        }
      } catch {
        // ignore
      }

      hydratedAccountRef.current = accountName
      isHydratingOrdersRef.current = false
    }

    loadOrders()
  }, [accountName, dispatch])

  // ── Mirror orders → DB on every change ──────────────────────────────────
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

    // Upsert all current orders
    orders.forEach((order) => {
      invoke('dca_upsert_order', {
        orderId: order.id,
        payload: JSON.stringify(order),
      }).catch((err) => logger.error('dca_upsert_order failed', err))
    })

    // Delete orders that were removed from the array
    prevOrderIdsRef.current.forEach((id) => {
      if (!currIds.has(id)) {
        invoke('dca_delete_order', { orderId: id }).catch((err) =>
          logger.error('dca_delete_order failed', err)
        )
      }
    })

    prevOrderIdsRef.current = currIds
  }, [accountName, orders])

  // ── Sync orders → Rust scheduler on every change ────────────────────────
  useEffect(() => {
    if (
      !accountName ||
      isHydratingOrdersRef.current ||
      hydratedAccountRef.current !== accountName
    ) {
      return
    }

    const rustOrders = orders
      .filter((o) => o.status === 'active' || o.status === 'paused')
      .map(toRustOrder)
    logger.info(`DCA: syncing ${rustOrders.length} orders to Rust`)
    invoke('dca_set_orders', { orders: rustOrders }).catch((err) =>
      logger.error('dca_set_orders failed', err)
    )
  }, [accountName, orders])

  // ── Core execution — registered once, uses refs for live state ──────────
  useEffect(() => {
    const enqueueExecution = (orderId: string, currentPrice: number) => {
      if (queuedOrderIdsRef.current.has(orderId)) {
        return
      }
      queuedOrderIdsRef.current.add(orderId)
      executionQueueRef.current.push({ orderId, currentPrice })
      void runQueueRef.current?.()
    }

    const executeOrder = async (order_id: string, current_price: number) => {
      logger.info(`DCA execute: order=${order_id} price=$${current_price}`)
      const referencePrice =
        current_price > 0 ? current_price : (btcPriceRef.current ?? 0)

      if (!isNodeReadyRef.current) {
        logger.warn(
          'DCA: node not ready (locked or stopped), skipping execution'
        )
        toast.warn('DCA: node not ready — wallet must be unlocked')
        return
      }

      const state = store.getState()
      const order = state.dca.orders.find(
        (o) => o.id === order_id && o.status === 'active'
      )
      if (!order) {
        logger.warn(`DCA: order ${order_id} not found or not active`)
        return
      }

      isExecuting.current = true
      const toastId = toast.loading('DCA: requesting quote...')

      try {
        // 1. Find USDT asset for precision + asset_id
        const niassets: NiaAsset[] = (assetsRef.current as any)?.nia ?? []
        logger.info(`DCA: ${niassets.length} NIA assets loaded`)
        const usdtAsset = niassets.find((a: any) => a.ticker === 'USDT') as any
        if (!usdtAsset) throw new Error('USDT asset not found in node assets')
        logger.info(
          `DCA: USDT precision=${usdtAsset.precision} asset_id=${usdtAsset.asset_id}`
        )

        const availableUsdtLn = computeUsdtLnBalance(
          (channelsRef.current as any)?.channels,
          niassets
        )
        if (availableUsdtLn != null && availableUsdtLn < order.amountUsdt) {
          const pauseReason = `Insufficient USDT LN balance (${availableUsdtLn.toFixed(2)} < ${order.amountUsdt}). Order auto-paused.`
          logger.warn(`DCA: ${pauseReason}`)
          dispatch(pauseOrder(order_id))
          dispatch(
            recordExecution({
              error: pauseReason,
              fromAmountUsdt: order.amountUsdt,
              orderId: order_id,
              priceBtcUsdt: referencePrice,
              status: 'failed',
              toAmountSats: 0,
            })
          )
          toast.update(toastId, {
            autoClose: 6500,
            isLoading: false,
            render: `DCA paused: ${pauseReason}`,
            type: 'warning',
          })
          return
        }

        const usdtPrecision: number = usdtAsset.precision ?? 6
        const rawFromAmount = Math.round(
          order.amountUsdt * Math.pow(10, usdtPrecision)
        )
        logger.info(`DCA: rawFromAmount=${rawFromAmount}`)

        // 2. Fetch quote via REST: USDT (RGB_LN) → BTC (BTC_LN)
        toast.update(toastId, { render: 'DCA: requesting USDT→BTC quote...' })
        const quoteResp = await withTimeout(
          getQuoteRef.current({
            from_asset: {
              asset_id: usdtAsset.asset_id,
              layer: 'RGB_LN',
              amount: rawFromAmount,
            },
            to_asset: {
              asset_id: 'BTC',
              layer: 'BTC_LN',
            },
          } as any),
          DCA_QUOTE_TIMEOUT_MS,
          'DCA quote request'
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
          `DCA: quote received rfq_id=${quote.rfq_id} to_amount=${quote.to_asset.amount}`
        )

        // 3. Slippage check (msats → sats)
        const receivedBtcSats = quote.to_asset.amount / 1000
        if (referencePrice > 0) {
          const expectedSats =
            (order.amountUsdt / referencePrice) * SATOSHIS_PER_BTC
          const slippagePct =
            ((expectedSats - receivedBtcSats) / expectedSats) * 100
          logger.info(
            `DCA: slippage=${slippagePct.toFixed(3)}% (expected=${expectedSats.toFixed(0)} received=${receivedBtcSats.toFixed(0)})`
          )
          if (slippagePct > MAX_SLIPPAGE_PCT) {
            throw new Error(
              `Slippage too high: ${slippagePct.toFixed(2)}% (max ${MAX_SLIPPAGE_PCT}%)`
            )
          }
        }

        // 4. Init swap
        toast.update(toastId, { render: '(1/3) Initializing DCA swap...' })
        const fromAssetId: string =
          quote.from_asset.asset_id ?? usdtAsset.asset_id
        const toAssetId: string = (quote.to_asset as any).asset_id ?? 'btc'
        const initPayload = {
          from_amount: rawFromAmount,
          from_asset: fromAssetId,
          rfq_id: quote.rfq_id,
          to_amount: quote.to_asset.amount,
          to_asset: toAssetId,
        }
        logger.debug('DCA initSwap payload', initPayload)

        const initResp = await initSwapRef.current(initPayload)
        if ('error' in initResp)
          throw new Error(handleApiError(initResp.error as FetchBaseQueryError))
        if (!initResp.data) throw new Error('No data from initSwap')

        const { swapstring, payment_hash } = initResp.data as any
        logger.info(`DCA: initSwap OK payment_hash=${payment_hash}`)

        if (
          !validateSwapString(
            swapstring,
            rawFromAmount,
            fromAssetId,
            quote.to_asset.amount,
            toAssetId,
            payment_hash
          )
        ) {
          throw new Error('Swap string validation failed')
        }

        // 5. Whitelist (taker)
        toast.update(toastId, { render: '(2/3) Whitelisting DCA trade...' })
        const whitelistResp = await whitelistTradeRef.current({ swapstring })
        if ('error' in whitelistResp)
          throw new Error(
            handleApiError(whitelistResp.error as FetchBaseQueryError)
          )
        logger.info('DCA: whitelisted OK')

        // 6. Execute
        toast.update(toastId, { render: '(3/3) Executing DCA swap...' })
        const execResp = await execSwapRef.current({
          payment_hash,
          swapstring,
          taker_pubkey: pubKeyRef.current,
        })
        if ('error' in execResp)
          throw new Error(handleApiError(execResp.error as FetchBaseQueryError))
        logger.info('DCA: execSwap OK')

        // 7. Record success
        const toAmountSats = Math.round(receivedBtcSats)
        const impliedPrice =
          toAmountSats > 0
            ? (order.amountUsdt / toAmountSats) * SATOSHIS_PER_BTC
            : referencePrice
        const feeSats = computeFeeSats(
          (quote as any).fee,
          referencePrice > 0 ? referencePrice : impliedPrice
        )

        toast.update(toastId, {
          autoClose: 5000,
          isLoading: false,
          render: `DCA: bought ${toAmountSats.toLocaleString()} sats for ${order.amountUsdt} USDT`,
          type: 'success',
        })

        dispatch(
          recordExecution({
            feeSats: feeSats > 0 ? feeSats : undefined,
            fromAmountUsdt: order.amountUsdt,
            orderId: order_id,
            priceBtcUsdt: impliedPrice,
            status: 'success',
            toAmountSats,
          })
        )

        if (order.type === 'price-target') {
          const newCreationPrice =
            referencePrice > 0 ? referencePrice : impliedPrice
          dispatch(
            updateAfterExecution({
              newCreationPrice,
              orderId: order_id,
            })
          )
        }

        await invoke('dca_order_executed', {
          orderId: order_id,
          timestamp: Math.floor(Date.now() / 1000),
        }).catch((err) => logger.error('dca_order_executed failed', err))

        // OS notification
        sendNotification(
          'DCA: Buy executed',
          `Bought ${toAmountSats.toLocaleString()} sats for ${order.amountUsdt} USDT`
        )
      } catch (err) {
        const { internalMessage, userMessage } = normalizeDcaError(err)
        logger.error('DCA execution failed', {
          error: err,
          normalizedMessage: internalMessage,
        })

        toast.update(toastId, {
          autoClose: 6000,
          isLoading: false,
          render: `DCA failed: ${userMessage}`,
          type: 'error',
        })

        dispatch(
          recordExecution({
            error: userMessage,
            fromAmountUsdt: order.amountUsdt,
            orderId: order_id,
            priceBtcUsdt: referencePrice,
            status: 'failed',
            toAmountSats: 0,
          })
        )
      } finally {
        isExecuting.current = false
      }
    }

    const runQueue = async () => {
      if (isExecuting.current) {
        return
      }
      const next = executionQueueRef.current.shift()
      if (!next) {
        return
      }
      queuedOrderIdsRef.current.delete(next.orderId)
      await executeOrder(next.orderId, next.currentPrice)
      if (executionQueueRef.current.length > 0) {
        void runQueue()
      }
    }

    runQueueRef.current = runQueue

    // Expose for manual triggers (Execute Now button)
    _executeFnRef.current = async (orderId: string, currentPrice: number) => {
      enqueueExecution(orderId, currentPrice)
    }

    // ── Frontend scheduler: check orders every few seconds, no Tauri events needed ──
    const checkOrders = () => {
      if (!isNodeReadyRef.current) {
        logger.info('DCA: scheduler tick skipped — node not ready')
        return
      }

      const state = store.getState()
      const now = Date.now()

      for (const order of state.dca.orders) {
        if (order.status !== 'active') continue

        if (order.type === 'scheduled' && order.intervalHours) {
          const intervalMs = order.intervalHours * 3600 * 1000
          const last = order.lastExecutedAt ?? order.createdAt
          const due = last + intervalMs
          logger.info(
            `DCA check: order=${order.id} last=${last} due=${due} now=${now} remaining=${Math.round((due - now) / 1000)}s`
          )
          if (now >= due) {
            logger.info(`DCA: scheduled order ${order.id} is due, queueing`)
            enqueueExecution(order.id, 0)
          }
        } else if (order.type === 'price-target' && order.triggerPriceBtcUsdt) {
          const price = btcPriceRef.current ?? 0
          logger.info(
            `DCA check: order=${order.id} trigger=$${order.triggerPriceBtcUsdt} current=$${price}`
          )
          if (price > 0 && price <= order.triggerPriceBtcUsdt) {
            logger.info(
              `DCA: price-target order ${order.id} triggered at $${price}, queueing`
            )
            enqueueExecution(order.id, price)
          }
        }
      }
    }

    checkOrders()

    const intervalId = setInterval(checkOrders, DCA_SCHEDULER_INTERVAL_MS)
    logger.info(
      `DCA: frontend scheduler started (every ${DCA_SCHEDULER_INTERVAL_MS / 1000}s)`
    )

    return () => {
      clearInterval(intervalId)
      _executeFnRef.current = null
      runQueueRef.current = null
      executionQueueRef.current = []
      queuedOrderIdsRef.current.clear()
      logger.info('DCA: frontend scheduler stopped')
    }
    // dispatch is stable — effect runs once on mount.
    // All other deps are accessed via refs updated in separate effects above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch])
}
