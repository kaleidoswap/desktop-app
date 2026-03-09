import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useEffect, useRef } from 'react'
import { toast } from 'react-toastify'
import { useTranslation } from 'react-i18next'

import { webSocketService } from '../app/hubs/websocketService'
import { store } from '../app/store'
import { useAppDispatch, useAppSelector } from '../app/store/hooks'
import { DcaOrder, recordExecution, updateAfterExecution } from '../slices/dcaSlice'
import { makerApi } from '../slices/makerApi/makerApi.slice'
import { nodeApi } from '../slices/nodeApi/nodeApi.slice'
import { handleApiError } from '../routes/trade/market-maker/apiUtils'
import { validateSwapString } from '../routes/trade/market-maker/swapUtils'
import { logger } from '../utils/logger'
import { FetchBaseQueryError } from '@reduxjs/toolkit/query'

interface DcaTriggerPayload {
  order_id: string
  current_price: number
}

const QUOTE_TIMEOUT_MS = 15_000
const QUOTE_POLL_MS = 500

/** Poll Redux state for a quote matching the given key */
async function waitForQuote(
  fromAsset: string,
  toAsset: string,
  fromAmount: number
): Promise<{ rfq_id: string; toAmount: number; fromAmount: number } | null> {
  const key = `${fromAsset}/${toAsset}/${fromAmount}`
  const deadline = Date.now() + QUOTE_TIMEOUT_MS

  while (Date.now() < deadline) {
    const quote = store.getState().pairs.quotes[key]
    if (quote) {
      return {
        fromAmount: quote.from_asset.amount,
        rfq_id: quote.rfq_id,
        toAmount: quote.to_asset.amount,
      }
    }
    await new Promise((r) => setTimeout(r, QUOTE_POLL_MS))
  }
  return null
}

/** Build DcaOrderInfo compatible with Rust struct */
function toRustOrder(order: DcaOrder) {
  return {
    amount_usdt: order.amountUsdt,
    id: order.id,
    interval_secs:
      order.intervalHours != null ? order.intervalHours * 3600 : null,
    last_executed_at:
      order.lastExecutedAt != null
        ? Math.floor(order.lastExecutedAt / 1000)
        : null,
    order_type: order.type,
    status: order.status,
    trigger_price_usd: order.triggerPriceBtcUsdt ?? null,
  }
}

export function useDcaScheduler() {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const orders = useAppSelector((state) => state.dca.orders)
  const wsConnected = useAppSelector((state) => state.pairs.wsConnected)
  const isExecuting = useRef(false)

  // RTK Query lazy triggers – for executing the actual swap
  const [initSwap] = makerApi.endpoints.initSwap.useLazyQuery()
  const [execSwap] = makerApi.endpoints.execSwap.useLazyQuery()
  const [whitelistTrade] = nodeApi.endpoints.whitelistTrade.useMutation()

  // Node info for pubkey
  const nodeInfoState = nodeApi.endpoints.nodeInfo.useQueryState()
  const pubKey = (nodeInfoState.data as any)?.pubkey ?? ''

  // ── Sync orders to Rust whenever they change ────────────────────────────
  useEffect(() => {
    const rustOrders = orders
      .filter((o) => o.status === 'active' || o.status === 'paused')
      .map(toRustOrder)

    invoke('dca_set_orders', { orders: rustOrders }).catch((err) =>
      logger.error('dca_set_orders failed', err)
    )
  }, [orders])

  // ── Listen for dca:trigger events ───────────────────────────────────────
  useEffect(() => {
    let unlisten: (() => void) | undefined

    const setup = async () => {
      unlisten = await listen<DcaTriggerPayload>('dca:trigger', async ({ payload }) => {
        const { order_id, current_price } = payload
        logger.info(`DCA trigger received for order ${order_id} at price $${current_price}`)

        const state = store.getState()
        const order = state.dca.orders.find(
          (o) => o.id === order_id && o.status === 'active'
        )
        if (!order) {
          logger.warn(`DCA: order ${order_id} not found or not active`)
          return
        }

        if (!wsConnected) {
          toast.warn(t('dca.toast.skippedNoWs', 'DCA skipped: not connected to maker'))
          return
        }

        if (isExecuting.current) {
          logger.info('DCA: already executing another order, skipping')
          return
        }

        isExecuting.current = true
        const toastId = toast.loading(t('dca.toast.triggered', 'DCA order triggered'))

        try {
          // Find the USDT→BTC pair
          const pairs = state.pairs.values
          const pair = pairs.find(
            (p) =>
              (p.base?.ticker === 'USDT' && p.quote?.ticker === 'BTC') ||
              (p.base?.ticker === 'BTC' && p.quote?.ticker === 'USDT')
          )
          if (!pair) throw new Error('No USDT/BTC trading pair found')

          const fromAsset = 'USDT'
          const toAsset = 'BTC'
          const fromAmount = order.amountUsdt

          // Use pair protocol IDs for asset identification
          const fromAssetId =
            pair.base?.ticker === 'USDT'
              ? pair.base?.protocol_ids?.['RGB'] ?? pair.base?.ticker
              : pair.quote?.protocol_ids?.['RGB'] ?? pair.quote?.ticker
          const toAssetId = 'btc'

          // Request quote via WebSocket
          const sentOk = await webSocketService.requestQuote(
            fromAsset,
            toAsset,
            fromAmount
          )
          if (!sentOk) throw new Error('Failed to send quote request')

          // Wait for quote to appear in Redux
          const quote = await waitForQuote(fromAsset, toAsset, fromAmount)
          if (!quote) throw new Error('Quote timed out')

          // Amounts
          let fromAmountRaw = quote.fromAmount
          let toAmountRaw = quote.toAmount
          // BTC amounts need to be in msats (x1000)
          const toAmountMsats = toAmountRaw * 1000

          // 1. Init swap
          toast.update(toastId, { render: '(1/3) Initializing DCA swap...' })
          const initResp = await initSwap({
            from_amount: fromAmountRaw,
            from_asset: fromAssetId,
            rfq_id: quote.rfq_id,
            to_amount: toAmountMsats,
            to_asset: toAssetId,
          })
          if ('error' in initResp) {
            throw new Error(handleApiError(initResp.error as FetchBaseQueryError))
          }
          if (!initResp.data) throw new Error('No data from init swap')

          const { swapstring, payment_hash } = initResp.data as any

          if (
            !validateSwapString(
              swapstring,
              fromAmountRaw,
              fromAssetId,
              toAmountMsats,
              toAssetId,
              payment_hash
            )
          ) {
            throw new Error('Swap string validation failed')
          }

          // 2. Whitelist
          toast.update(toastId, { render: '(2/3) Whitelisting DCA trade...' })
          const whitelistResp = await whitelistTrade({ swapstring })
          if ('error' in whitelistResp) {
            throw new Error(handleApiError(whitelistResp.error as FetchBaseQueryError))
          }

          // 3. Exec swap
          toast.update(toastId, { render: '(3/3) Executing DCA swap...' })
          const execResp = await execSwap({
            payment_hash,
            swapstring,
            taker_pubkey: pubKey,
          })
          if ('error' in execResp) {
            throw new Error(handleApiError(execResp.error as FetchBaseQueryError))
          }

          // BTC received in sats
          const toAmountSats = toAmountRaw

          toast.update(toastId, {
            autoClose: 5000,
            isLoading: false,
            render: t('dca.toast.success', {
              amount: toAmountSats.toLocaleString(),
              defaultValue: `DCA: Bought ${toAmountSats.toLocaleString()} sats`,
            }),
            type: 'success',
          })

          dispatch(
            recordExecution({
              fromAmountUsdt: order.amountUsdt,
              orderId: order_id,
              priceBtcUsdt: current_price,
              status: 'success',
              toAmountSats,
            })
          )

          // For price-target orders: reset reference price for continuous dip-buying
          if (order.type === 'price-target') {
            dispatch(updateAfterExecution({ newCreationPrice: current_price, orderId: order_id }))
          }

          await invoke('dca_order_executed', {
            order_id,
            timestamp: Math.floor(Date.now() / 1000),
          }).catch((err) => logger.error('dca_order_executed failed', err))
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          logger.error('DCA execution failed', err)

          toast.update(toastId, {
            autoClose: 5000,
            isLoading: false,
            render: t('dca.toast.failed', {
              defaultValue: `DCA order failed: ${errMsg}`,
              error: errMsg,
            }),
            type: 'error',
          })

          dispatch(
            recordExecution({
              error: errMsg,
              fromAmountUsdt: order.amountUsdt,
              orderId: order_id,
              priceBtcUsdt: current_price,
              status: 'failed',
              toAmountSats: 0,
            })
          )
        } finally {
          isExecuting.current = false
        }
      })
    }

    setup().catch((err) => logger.error('Failed to set up dca:trigger listener', err))

    return () => {
      unlisten?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsConnected, pubKey, t])
}
