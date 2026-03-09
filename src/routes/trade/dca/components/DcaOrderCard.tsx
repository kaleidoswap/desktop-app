import { Pause, Play, X, TrendingDown, Clock, CheckCircle, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useAppDispatch } from '../../../../app/store/hooks'
import { DcaOrder, cancelOrder, pauseOrder, resumeOrder } from '../../../../slices/dcaSlice'

interface Props {
  order: DcaOrder
  currentBtcPrice?: number
}

function formatInterval(hours: number): string {
  if (hours === 1) return '1h'
  if (hours < 24) return `${hours}h`
  if (hours === 24) return '24h'
  if (hours === 168) return '1w'
  return `${hours}h`
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'now'
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function StatusBadge({ status }: { status: DcaOrder['status'] }) {
  const { t } = useTranslation()
  const styles: Record<DcaOrder['status'], string> = {
    active: 'bg-status-success/15 text-status-success border-status-success/30',
    cancelled: 'bg-border-subtle/30 text-content-tertiary border-border-subtle/50',
    completed: 'bg-primary/15 text-primary border-primary/30',
    paused: 'bg-status-warning/15 text-status-warning border-status-warning/30',
  }
  return (
    <span
      className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${styles[status]}`}
    >
      {t(`dca.status.${status}`, status)}
    </span>
  )
}

export function DcaOrderCard({ order, currentBtcPrice }: Props) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()

  const successfulExecs = order.executions.filter((e) => e.status === 'success')
  const successCount = successfulExecs.length
  const lastSuccess = successCount > 0 ? successfulExecs[successCount - 1] : undefined

  const isActive = order.status === 'active'
  const isDone = order.status === 'completed' || order.status === 'cancelled'

  return (
    <div className="bg-surface-raised border border-border-subtle rounded-xl p-4 space-y-3 hover:border-border-default transition-colors duration-200">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {order.type === 'scheduled' ? (
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Clock className="w-4 h-4" />
            </div>
          ) : (
            <div className="p-1.5 rounded-lg bg-status-warning/10 text-status-warning">
              <TrendingDown className="w-4 h-4" />
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-content-primary">
              {order.type === 'scheduled'
                ? t('dca.type.scheduled', 'Scheduled')
                : t('dca.type.priceTarget', 'Price Target')}
            </p>
            <p className="text-xs text-content-tertiary">
              {t('dca.amountLabel', 'Amount per buy')}:{' '}
              <span className="text-content-secondary font-medium">
                {order.amountUsdt} USDT
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={order.status} />
          {!isDone && (
            <>
              {isActive ? (
                <button
                  aria-label="Pause order"
                  className="p-1.5 rounded-lg text-content-secondary hover:text-status-warning hover:bg-status-warning/10 transition-colors"
                  onClick={() => dispatch(pauseOrder(order.id))}
                >
                  <Pause className="w-4 h-4" />
                </button>
              ) : (
                <button
                  aria-label="Resume order"
                  className="p-1.5 rounded-lg text-content-secondary hover:text-status-success hover:bg-status-success/10 transition-colors"
                  onClick={() => dispatch(resumeOrder(order.id))}
                >
                  <Play className="w-4 h-4" />
                </button>
              )}
              <button
                aria-label="Cancel order"
                className="p-1.5 rounded-lg text-content-secondary hover:text-status-danger hover:bg-status-danger/10 transition-colors"
                onClick={() => dispatch(cancelOrder(order.id))}
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Details row */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        {order.type === 'scheduled' && order.intervalHours && (
          <>
            <div className="bg-surface-overlay/50 rounded-lg p-2">
              <p className="text-content-tertiary mb-0.5">
                {t('dca.intervalLabel', 'Buy every')}
              </p>
              <p className="text-content-primary font-semibold">
                {formatInterval(order.intervalHours)}
              </p>
            </div>
            {order.nextExecutionAt && isActive && (
              <div className="bg-surface-overlay/50 rounded-lg p-2">
                <p className="text-content-tertiary mb-0.5">
                  {t('dca.nextExecution', 'Next execution')}
                </p>
                <p className="text-primary font-semibold">
                  {formatTimeRemaining(order.nextExecutionAt - Date.now())}
                </p>
              </div>
            )}
          </>
        )}

        {order.type === 'price-target' && (
          <>
            <div className="bg-surface-overlay/50 rounded-lg p-2">
              <p className="text-content-tertiary mb-0.5">
                {t('dca.triggerPrice', 'Triggers at ≤')}
              </p>
              <p className="text-status-warning font-semibold">
                ${order.triggerPriceBtcUsdt?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            {currentBtcPrice && (
              <div className="bg-surface-overlay/50 rounded-lg p-2">
                <p className="text-content-tertiary mb-0.5">Current</p>
                <p className="text-content-primary font-semibold">
                  ${currentBtcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Executions summary */}
      <div className="flex items-center justify-between pt-2 border-t border-border-subtle/50">
        <div className="flex items-center gap-1.5 text-xs text-content-tertiary">
          <CheckCircle className="w-3.5 h-3.5 text-status-success" />
          <span>
            {t('dca.executions', { count: successCount, defaultValue: `${successCount} executions` })}
          </span>
        </div>
        {lastSuccess && (
          <p className="text-xs text-content-tertiary">
            Last:{' '}
            <span className="text-status-success font-medium">
              +{lastSuccess.toAmountSats.toLocaleString()} sats
            </span>{' '}
            @ ${lastSuccess.priceBtcUsdt.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        )}
      </div>

      {/* Failed executions count */}
      {order.executions.some((e) => e.status === 'failed') && (
        <div className="flex items-center gap-1.5 text-xs text-status-danger">
          <XCircle className="w-3.5 h-3.5" />
          <span>
            {order.executions.filter((e) => e.status === 'failed').length} failed
          </span>
        </div>
      )}
    </div>
  )
}
