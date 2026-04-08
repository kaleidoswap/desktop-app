import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Target, Clock, BarChart2, X } from 'lucide-react'

import { useAppSelector } from '../../../app/store/hooks'
import { CreateLimitOrderForm } from './components/CreateLimitOrderForm'
import { LimitOrderCard } from './components/LimitOrderCard'

type Tab = 'active' | 'history'

function CreateOrderModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-base/80 backdrop-blur-md"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg max-h-[calc(100vh-2rem)] bg-surface-elevated border border-border-default shadow-[0_32px_96px_-16px_rgba(0,0,0,0.8)] rounded-3xl overflow-hidden p-[1px] flex flex-col">
        <div className="bg-surface-base rounded-[calc(1.5rem-1px)] flex flex-col min-h-0">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-default/50 bg-surface-overlay/30 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Target className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-content-primary">
                  {t('limitOrders.createOrder', 'New Limit Order')}
                </h2>
                <p className="text-xs text-content-tertiary mt-0.5">
                  Set target prices for automatic execution
                </p>
              </div>
            </div>
            <button
              className="p-2 rounded-xl text-content-secondary hover:text-content-primary hover:bg-surface-elevated transition-colors border border-transparent hover:border-border-default/50"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6 overflow-y-auto overscroll-contain">
            <CreateLimitOrderForm onCreated={onClose} />
          </div>
        </div>
      </div>
    </div>
  )
}

export const LimitOrdersView = () => {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('active')
  const [showModal, setShowModal] = useState(false)

  const orders = useAppSelector((s) => s.limitOrders.orders)

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
      {showModal && <CreateOrderModal onClose={() => setShowModal(false)} />}

      <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-6">
        {/* Hero section */}
        <section className="overflow-hidden rounded-3xl border border-border-subtle bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-5 shadow-[0_24px_70px_-40px_rgba(0,0,0,0.7)]">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                  <Target className="h-4 w-4" />
                  {t('navigation.limitOrders', 'Limit Orders')}
                </div>
                <h1 className="mt-3 text-3xl font-semibold text-content-primary">
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
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl border border-primary/30 bg-primary/15 px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/25"
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

            {/* Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1 rounded-xl bg-surface-overlay/50 p-1">
                <button
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                    tab === 'active'
                      ? 'bg-surface-elevated text-content-primary shadow-sm'
                      : 'text-content-secondary hover:text-content-primary'
                  }`}
                  onClick={() => setTab('active')}
                >
                  <Clock className="h-3.5 w-3.5" />
                  {t('limitOrders.tabs.active', 'Active')}
                  <span className="text-xs text-content-secondary">
                    ({activeOrders.length})
                  </span>
                </button>
                <button
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                    tab === 'history'
                      ? 'bg-surface-elevated text-content-primary shadow-sm'
                      : 'text-content-secondary hover:text-content-primary'
                  }`}
                  onClick={() => setTab('history')}
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  {t('limitOrders.tabs.history', 'History')}
                  <span className="text-xs text-content-secondary">
                    ({doneOrders.length})
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Order list */}
        <section className="min-h-[420px] rounded-3xl border border-border-subtle bg-surface-raised p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-content-secondary">
                {tab === 'active'
                  ? t('limitOrders.tabs.active', 'Active')
                  : t('limitOrders.tabs.history', 'History')}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-content-primary">
                {tab === 'active'
                  ? t('limitOrders.orders.activeTitle', 'Active Limit Orders')
                  : t(
                      'limitOrders.orders.historyTitle',
                      'Filled & Closed Orders'
                    )}
              </h2>
            </div>
            <span className="rounded-full border border-border-subtle bg-surface-overlay/60 px-3 py-1 text-xs font-medium text-content-secondary">
              {displayedOrders.length}{' '}
              {tab === 'active'
                ? t('limitOrders.tabs.active', 'active')
                : t('limitOrders.tabs.history', 'history')}
            </span>
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
                    className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/15 px-4 py-2 text-sm font-medium text-primary transition-all duration-200 hover:bg-primary/25"
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
