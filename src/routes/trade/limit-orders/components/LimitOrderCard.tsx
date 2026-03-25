import {
  Pause,
  Play,
  Trash2,
  X,
  Zap,
  Clock,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAppDispatch } from '../../../../app/store/hooks'
import { executeLimitOrderManually } from '../../../../hooks/useLimitOrderScheduler'
import {
  LimitOrder,
  LimitOrderExecution,
  cancelLimitOrder,
  deleteLimitOrder,
  pauseLimitOrder,
  resumeLimitOrder,
} from '../../../../slices/limitOrderSlice'

interface Props {
  order: LimitOrder
  currentPrices?: Record<string, number>
}

function formatTs(ts: number) {
  return new Date(ts).toLocaleString('en-US', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  })
}

function formatTimeRemaining(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ${h % 24}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${s}s`
}

function StatusBadge({ status }: { status: LimitOrder['status'] }) {
  const { t } = useTranslation()
  const styles: Record<LimitOrder['status'], string> = {
    active: 'bg-status-success/15 text-status-success border-status-success/30',
    cancelled:
      'bg-border-subtle/30 text-content-tertiary border-border-subtle/50',
    expired:
      'bg-border-subtle/30 text-content-tertiary border-border-subtle/50',
    filled: 'bg-primary/15 text-primary border-primary/30',
    paused: 'bg-status-warning/15 text-status-warning border-status-warning/30',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${styles[status]}`}
    >
      {t(`limitOrders.status.${status}`, status)}
    </span>
  )
}

function SideBadge({ side }: { side: LimitOrder['side'] }) {
  const { t } = useTranslation()
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
        side === 'buy'
          ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-300'
          : 'border-rose-400/30 bg-rose-400/15 text-rose-300'
      }`}
    >
      {side === 'buy' ? (
        <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUp className="h-3 w-3" />
      )}
      {t(`limitOrders.side.${side}`, side)}
    </span>
  )
}

function ExecutionRow({ execution }: { execution: LimitOrderExecution }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border-subtle/50 bg-surface-base/30 px-3 py-2">
      {execution.status === 'success' ? (
        <CheckCircle className="h-3.5 w-3.5 shrink-0 text-status-success" />
      ) : (
        <XCircle className="h-3.5 w-3.5 shrink-0 text-status-danger" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-content-primary">
          {execution.status === 'success'
            ? `${execution.fromAssetTicker} → ${execution.toAssetTicker} at ${execution.executionPrice}`
            : execution.error || 'Failed'}
        </p>
        <p className="text-[10px] text-content-tertiary">
          {formatTs(execution.timestamp)}
        </p>
      </div>
    </div>
  )
}

export function LimitOrderCard({ order, currentPrices }: Props) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const [showHistory, setShowHistory] = useState(false)
  const [, setTick] = useState(0)

  // Update countdown every second for expiration display
  useEffect(() => {
    if (order.status !== 'active' || !order.expiresAt) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [order.status, order.expiresAt])

  const isTerminal =
    order.status === 'filled' ||
    order.status === 'expired' ||
    order.status === 'cancelled'
  const currentPrice = currentPrices?.[order.pairId]
  const priceDeltaPct =
    currentPrice && order.limitPrice > 0
      ? ((currentPrice - order.limitPrice) / order.limitPrice) * 100
      : undefined
  const timeRemaining =
    order.expiresAt && order.status === 'active'
      ? Math.max(0, order.expiresAt - Date.now())
      : undefined

  return (
    <div className="rounded-2xl border border-border-default/50 bg-surface-overlay/50 shadow-sm transition-all duration-300 hover:bg-surface-overlay/80 swap-card hover:border-border-default">
      <div className="flex items-start gap-3 p-4">
        {/* Left: Info */}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <SideBadge side={order.side} />
            <StatusBadge status={order.status} />
            <span className="text-sm font-semibold text-content-primary">
              {order.baseAssetTicker}/{order.quoteAssetTicker}
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-content-tertiary">
                {t('limitOrders.card.limitPrice', 'Limit')}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-content-primary">
                {order.limitPrice} {order.quoteAssetTicker}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-content-tertiary">
                {t('limitOrders.card.currentPrice', 'Current')}
              </p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <p className="text-sm font-semibold text-content-primary">
                  {currentPrice != null
                    ? `${currentPrice} ${order.quoteAssetTicker}`
                    : '—'}
                </p>
                {priceDeltaPct != null && (
                  <span
                    className={`text-[10px] font-semibold ${
                      priceDeltaPct >= 0 ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {priceDeltaPct >= 0 ? '+' : ''}
                    {priceDeltaPct.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-content-tertiary">
                {t('limitOrders.card.amount', 'Amount')}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-content-primary">
                {order.amount} {order.baseAssetTicker}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-content-secondary">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTs(order.createdAt)}
            </span>
            {timeRemaining != null && timeRemaining > 0 && (
              <span className="flex items-center gap-1 text-status-warning">
                <Clock className="h-3 w-3" />
                {t('limitOrders.card.expires', 'Expires')}{' '}
                {formatTimeRemaining(timeRemaining)}
              </span>
            )}
            {!order.expiresAt && order.status === 'active' && (
              <span className="text-content-tertiary">
                {t('limitOrders.card.noExpiration', 'No expiration')}
              </span>
            )}
            {order.filledAt && (
              <span className="flex items-center gap-1 text-primary">
                <CheckCircle className="h-3 w-3" />
                Filled {formatTs(order.filledAt)}
              </span>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex shrink-0 items-center gap-1.5">
          {!isTerminal && (
            <>
              <button
                className="rounded-lg p-1.5 text-content-secondary transition-colors hover:bg-primary/15 hover:text-primary"
                onClick={() => executeLimitOrderManually(order.id)}
                title={t('limitOrders.card.fillNow', 'Fill Now')}
              >
                <Zap className="h-4 w-4" />
              </button>
              {order.status === 'active' ? (
                <button
                  className="rounded-lg p-1.5 text-content-secondary transition-colors hover:bg-status-warning/15 hover:text-status-warning"
                  onClick={() => dispatch(pauseLimitOrder(order.id))}
                  title="Pause"
                >
                  <Pause className="h-4 w-4" />
                </button>
              ) : (
                <button
                  className="rounded-lg p-1.5 text-content-secondary transition-colors hover:bg-status-success/15 hover:text-status-success"
                  onClick={() => dispatch(resumeLimitOrder(order.id))}
                  title="Resume"
                >
                  <Play className="h-4 w-4" />
                </button>
              )}
              <button
                className="rounded-lg p-1.5 text-content-secondary transition-colors hover:bg-status-danger/15 hover:text-status-danger"
                onClick={() => dispatch(cancelLimitOrder(order.id))}
                title="Cancel"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          )}
          {isTerminal && (
            <button
              className="rounded-lg p-1.5 text-content-secondary transition-colors hover:bg-status-danger/15 hover:text-status-danger"
              onClick={() => dispatch(deleteLimitOrder(order.id))}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Execution history toggle */}
      {order.executions.length > 0 && (
        <div className="border-t border-border-subtle/50">
          <button
            className="flex w-full items-center justify-between px-4 py-2 text-xs text-content-secondary transition-colors hover:text-content-primary"
            onClick={() => setShowHistory(!showHistory)}
          >
            <span className="flex items-center gap-1.5">
              {t('limitOrders.card.executionHistory', 'Execution History')}
              <span className="rounded-full bg-surface-overlay px-1.5 py-0.5 text-[10px]">
                {order.executions.length}
              </span>
            </span>
            {showHistory ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          {showHistory && (
            <div className="space-y-1.5 px-4 pb-3">
              {order.executions.map((exec) => (
                <ExecutionRow execution={exec} key={exec.id} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
