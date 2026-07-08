import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Plus, Target, Clock, BarChart2, X, ShoppingCart } from 'lucide-react'
import { createPortal } from 'react-dom'

import {
  getModalPortalTarget,
  getModalPositionClass,
} from '../../../helpers/modalPortal'
import { ORDER_CHANNEL_PATH, TRADE_LIMIT_PATH } from '../../../app/router/paths'
import { useAppSelector } from '../../../app/store/hooks'
import { nodeApi } from '../../../slices/nodeApi/nodeApi.slice'
import { CreateLimitOrderForm } from './components/CreateLimitOrderForm'
import { LimitOrderCard } from './components/LimitOrderCard'

type Tab = 'active' | 'history'

function CreateOrderModal({
  hasUsdtChannel,
  onClose,
}: {
  hasUsdtChannel: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const pos = getModalPositionClass()
  return createPortal(
    <div
      className={`${pos} inset-0 z-50 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 pointer-events-none">
        <div className="bg-surface-base p-6 sm:p-8 rounded-3xl border border-border-subtle/50 max-w-lg w-full shadow-2xl max-h-[calc(100vh-2rem)] overflow-y-auto pointer-events-auto">
          <div className="flex items-center justify-between pb-4 border-b border-divider/10 mb-6">
            <div className="flex items-center gap-3">
              <Target className="w-6 h-6 text-primary flex-shrink-0" />
              <h3 className="text-xl font-bold text-white">
                {t('limitOrders.createOrder', 'New Limit Order')}
              </h3>
            </div>
            <button
              className="p-1.5 rounded-md text-content-secondary hover:text-white hover:bg-surface-overlay/50 transition-colors"
              onClick={onClose}
              type="button"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!hasUsdtChannel ? (
            <div className="flex flex-col items-center gap-5 py-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <ShoppingCart className="w-7 h-7 text-primary" />
              </div>
              <div className="space-y-2">
                <p className="text-base font-semibold text-white">
                  {t('limitOrders.noChannel.title', 'USDT Channel Required')}
                </p>
                <p className="text-sm text-content-secondary leading-relaxed max-w-sm mx-auto">
                  {t(
                    'limitOrders.noChannel.description',
                    'You need a USDT Lightning channel to place limit orders. Buy one to get started.'
                  )}
                </p>
              </div>
              <button
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary hover:bg-primary-emphasis px-4 text-sm font-semibold text-[#12131C] transition-colors"
                onClick={() => {
                  onClose()
                  navigate(ORDER_CHANNEL_PATH, {
                    state: { returnTo: TRADE_LIMIT_PATH },
                  })
                }}
                type="button"
              >
                <ShoppingCart className="h-4 w-4" />
                {t('limitOrders.noChannel.cta', 'Buy USDT Channel')}
              </button>
            </div>
          ) : (
            <CreateLimitOrderForm onCreated={onClose} />
          )}
        </div>
      </div>
    </div>,
    getModalPortalTarget()
  )
}

export const LimitOrdersView = () => {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('active')
  const [showModal, setShowModal] = useState(false)

  const orders = useAppSelector((s) => s.limitOrders.orders)

  const { data: channelsData } = nodeApi.endpoints.listChannels.useQuery(
    undefined,
    { pollingInterval: 30_000 }
  )
  const { data: assetsData } = nodeApi.endpoints.listAssets.useQuery(
    undefined,
    { pollingInterval: 60_000 }
  )
  const readyChannels = (channelsData?.channels ?? []).filter(
    (ch: any) => ch.ready
  )
  const usdtAsset = (assetsData?.nia ?? []).find(
    (a: any) => a.ticker === 'USDT'
  )
  const hasUsdtChannel = usdtAsset
    ? readyChannels.some((ch: any) => ch.asset_id === usdtAsset.asset_id)
    : false

  const activeOrders = orders.filter(
    (o) => o.status === 'active' || o.status === 'paused'
  )
  const doneOrders = orders.filter(
    (o) =>
      o.status === 'filled' ||
      o.status === 'expired' ||
      o.status === 'cancelled'
  )
  const displayedOrders = tab === 'active' ? activeOrders : doneOrders

  const filledOrders = orders.filter((o) => o.status === 'filled')
  const successfulExecutions = orders.flatMap((o) =>
    o.executions.filter((e) => e.status === 'success')
  )

  // Collect unique pair IDs from active orders for a future price feed
  // (currently prices are fetched by the scheduler)

  return (
    <>
      {showModal && (
        <CreateOrderModal
          hasUsdtChannel={hasUsdtChannel}
          onClose={() => setShowModal(false)}
        />
      )}

      <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-6 px-4 py-6">
        {/* Hero section */}
        <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-overlay p-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-2xl">
                <h1 className="text-xl font-bold text-white">
                  {t('limitOrders.title', 'Limit Orders')}
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-content-secondary">
                  {t(
                    'limitOrders.description',
                    'Set a target price for any trading pair. When the market reaches your price, the swap executes automatically.'
                  )}
                </p>
              </div>

              <button
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-primary hover:bg-primary-emphasis px-4 text-sm font-semibold text-[#12131C] transition-colors"
                onClick={() => setShowModal(true)}
                title={t('limitOrders.createOrder', 'New Limit Order')}
              >
                <Plus className="h-5 w-5" />
                <span className="hidden sm:inline">
                  {t('limitOrders.createOrder', 'New Limit Order')}
                </span>
              </button>
            </div>

            {/* Metrics */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border-subtle bg-surface-base/35 p-3.5">
                <p className="text-[11px] uppercase tracking-[0.2em] text-content-tertiary">
                  {t('limitOrders.metrics.activeOrders', 'Active orders')}
                </p>
                <p className="mt-1.5 text-lg font-semibold text-content-primary">
                  {activeOrders.length}
                </p>
              </div>
              <div className="rounded-2xl border border-border-subtle bg-surface-base/35 p-3.5">
                <p className="text-[11px] uppercase tracking-[0.2em] text-content-tertiary">
                  {t('limitOrders.metrics.filledOrders', 'Filled orders')}
                </p>
                <p className="mt-1.5 text-lg font-semibold text-content-primary">
                  {filledOrders.length}
                </p>
              </div>
              <div className="rounded-2xl border border-border-subtle bg-surface-base/35 p-3.5">
                <p className="text-[11px] uppercase tracking-[0.2em] text-content-tertiary">
                  {t(
                    'limitOrders.metrics.totalExecutions',
                    'Successful executions'
                  )}
                </p>
                <p className="mt-1.5 text-lg font-semibold text-content-primary">
                  {successfulExecutions.length}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Order list */}
        <section className="min-h-[420px] rounded-2xl border border-border-subtle bg-surface-overlay p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-content-primary">
              {tab === 'active'
                ? t('limitOrders.orders.activeTitle', 'Planned Limit Orders')
                : t(
                    'limitOrders.orders.historyTitle',
                    'Filled & Closed Orders'
                  )}
            </h2>
            <div className="flex gap-1 rounded-xl bg-surface-base/35 p-1">
              <button
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:outline-none ${
                  tab === 'active'
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'text-content-secondary hover:text-white border border-transparent'
                }`}
                onClick={() => setTab('active')}
              >
                <Clock className="h-3.5 w-3.5" />
                {t('limitOrders.tabs.active', 'Planned')}
                <span
                  className={`text-xs ${tab === 'active' ? 'text-primary' : 'text-white/60'}`}
                >
                  ({activeOrders.length})
                </span>
              </button>
              <button
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:outline-none ${
                  tab === 'history'
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'text-content-secondary hover:text-white border border-transparent'
                }`}
                onClick={() => setTab('history')}
              >
                <BarChart2 className="h-3.5 w-3.5" />
                {t('limitOrders.tabs.history', 'History')}
                <span
                  className={`text-xs ${tab === 'history' ? 'text-primary' : 'text-white/60'}`}
                >
                  ({doneOrders.length})
                </span>
              </button>
            </div>
          </div>

          <div className="mt-5">
            {displayedOrders.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center space-y-3 rounded-2xl border border-dashed border-border-subtle bg-surface-base/40 px-6 text-center">
                <div className="rounded-2xl bg-surface-overlay/50 p-4 text-content-secondary">
                  <Target className="h-8 w-8" />
                </div>
                <p className="text-sm font-medium text-content-secondary">
                  {tab === 'active'
                    ? t('limitOrders.empty.active', 'No active limit orders')
                    : t('limitOrders.empty.history', 'No order history yet')}
                </p>
                {tab === 'active' && (
                  <button
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary hover:bg-primary-emphasis px-4 py-2 text-sm font-semibold text-[#12131C] transition-colors"
                    onClick={() => setShowModal(true)}
                  >
                    <Plus className="h-4 w-4" />
                    {t('limitOrders.createOrder', 'New Limit Order')}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {displayedOrders.map((order) => (
                  <LimitOrderCard key={order.id} order={order} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  )
}
