import {
  Pause,
  Play,
  Trash2,
  X,
  Zap,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAppDispatch } from '../../../../app/store/hooks'
import bitcoinLogo from '../../../../assets/bitcoin-logo.svg'
import tetherLogo from '../../../../assets/tether-logo.svg'
import {
  DCA_SCHEDULER_INTERVAL_MS,
  executeOrderManually,
} from '../../../../hooks/useDcaScheduler'
import {
  DcaOrder,
  DcaExecution,
  cancelOrder,
  deleteOrder,
  pauseOrder,
  resumeOrder,
} from '../../../../slices/dcaSlice'
import { DcaHistoryChart } from './DcaHistoryChart'

interface Props {
  order: DcaOrder
  currentBtcPrice?: number
}

function formatInterval(hours: number): string {
  if (hours < 1 / 60 + 0.001) return '1m'
  if (hours === 1) return '1h'
  if (hours < 24) return `${hours}h`
  if (hours === 24) return '24h'
  if (hours === 168) return '1w'
  return `${hours}h`
}

function formatTimeRemaining(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${s}s`
}

function formatTs(ts: number) {
  return new Date(ts).toLocaleString('en-US', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  })
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}

function StatusBadge({ status }: { status: DcaOrder['status'] }) {
  const { t } = useTranslation()
  const styles: Record<DcaOrder['status'], string> = {
    active: 'bg-status-success/15 text-status-success border-status-success/30',
    cancelled:
      'bg-border-subtle/30 text-content-tertiary border-border-subtle/50',
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

function ExecutionRow({ exec }: { exec: DcaExecution }) {
  return (
    <div
      className={`flex items-center justify-between py-1.5 px-2 rounded-lg text-xs ${
        exec.status === 'success' ? 'bg-status-success/5' : 'bg-status-danger/5'
      }`}
    >
      <div className="flex items-center gap-2 text-content-tertiary min-w-0">
        {exec.status === 'success' ? (
          <CheckCircle className="w-3 h-3 text-status-success flex-shrink-0" />
        ) : (
          <XCircle className="w-3 h-3 text-status-danger flex-shrink-0" />
        )}
        <span className="truncate">{formatTs(exec.timestamp)}</span>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0 ml-2">
        {exec.status === 'success' ? (
          <>
            <span className="text-content-secondary">
              {exec.fromAmountUsdt} USDT
            </span>
            <span className="text-status-success font-medium">
              +{exec.toAmountSats.toLocaleString()} sats
            </span>
            <span className="text-content-tertiary">
              @$
              {exec.priceBtcUsdt.toLocaleString('en-US', {
                maximumFractionDigits: 0,
              })}
            </span>
            {exec.feeSats != null && exec.feeSats > 0 && (
              <span className="text-content-tertiary/70">
                fee {exec.feeSats.toLocaleString('en-US')} sats
              </span>
            )}
          </>
        ) : (
          <span className="text-status-danger truncate max-w-[160px]">
            {exec.error ?? 'Failed'}
          </span>
        )}
      </div>
    </div>
  )
}

export function DcaOrderCard({ order, currentBtcPrice }: Props) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const [expanded, setExpanded] = useState(false)
  const [nowTs, setNowTs] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const successfulExecs = order.executions.filter((e) => e.status === 'success')
  const failedExecs = order.executions.filter((e) => e.status === 'failed')
  const successCount = successfulExecs.length
  const totalSats = successfulExecs.reduce((s, e) => s + e.toAmountSats, 0)
  const avgPrice =
    successCount > 0
      ? successfulExecs.reduce((s, e) => s + e.priceBtcUsdt, 0) / successCount
      : undefined
  const totalFeeSats = successfulExecs.reduce((s, e) => s + (e.feeSats ?? 0), 0)

  const isActive = order.status === 'active'
  const isPaused = order.status === 'paused'
  const isDone = order.status === 'completed' || order.status === 'cancelled'
  const hasHistory = order.executions.length > 0

  // Scheduled: progress bar
  const intervalMs =
    order.type === 'scheduled' && order.intervalHours
      ? order.intervalHours * 3600 * 1000
      : undefined
  const anchorTs =
    order.type === 'scheduled'
      ? (order.lastExecutedAt ?? order.createdAt)
      : undefined
  const progressPct =
    intervalMs && anchorTs
      ? clamp(((nowTs - anchorTs) / intervalMs) * 100, 0, 100)
      : undefined
  const msToNext =
    intervalMs && anchorTs ? anchorTs + intervalMs - nowTs : undefined

  // Price-target: gap
  const priceGapPct =
    order.type === 'price-target' &&
    order.triggerPriceBtcUsdt &&
    currentBtcPrice &&
    currentBtcPrice > 0
      ? ((currentBtcPrice - order.triggerPriceBtcUsdt) / currentBtcPrice) * 100
      : undefined
  const triggerReached = priceGapPct != null && priceGapPct <= 0

  return (
    <div className="bg-surface-raised border border-border-subtle rounded-xl overflow-hidden hover:border-border-default transition-colors duration-200">
      {/* ── Row 1: header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-3">
        {/* Left: icon + type + amount */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`p-1.5 rounded-lg flex-shrink-0 ${
              order.type === 'scheduled'
                ? 'bg-primary/10 text-primary'
                : 'bg-status-warning/10 text-status-warning'
            }`}
          >
            {order.type === 'scheduled' ? (
              <Clock className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-content-primary">
                {order.type === 'scheduled'
                  ? t('dca.type.scheduled', 'Scheduled')
                  : t('dca.type.priceTarget', 'Price Target')}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface-overlay/50 px-2 py-0.5 text-[11px] text-content-secondary font-medium">
                <img
                  alt="USDT"
                  className="w-3 h-3 rounded-full"
                  src={tetherLogo}
                />
                <span>{order.amountUsdt} USDT</span>
                <ArrowRight className="w-3 h-3" />
                <img
                  alt="BTC"
                  className="w-3 h-3 rounded-full"
                  src={bitcoinLogo}
                />
                <span>{t('dca.card.receiveBtc', 'to BTC')}</span>
              </span>
            </div>
            <p className="text-xs text-content-secondary mt-0.5">
              {t('dca.orderHelp.createdAt', 'Created')}:{' '}
              {formatTs(order.createdAt)}
            </p>
          </div>
        </div>

        {/* Right: badge + actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <StatusBadge status={order.status} />
          {!isDone ? (
            <>
              {isActive && (
                <button
                  aria-label="Execute now"
                  className="h-7 px-2 rounded-lg text-content-secondary hover:text-primary hover:bg-primary/10 transition-colors inline-flex items-center gap-1 border border-border-subtle/70 text-xs font-medium"
                  title="Execute now"
                  onClick={() => executeOrderManually(order.id)}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {t('dca.actions.execute', 'Execute')}
                  </span>
                </button>
              )}
              {isActive ? (
                <button
                  aria-label="Pause"
                  className="h-7 w-7 rounded-lg text-content-secondary hover:text-status-warning hover:bg-status-warning/10 transition-colors border border-border-subtle/70 inline-flex items-center justify-center"
                  title={t('dca.actions.pause', 'Pause')}
                  onClick={() => dispatch(pauseOrder(order.id))}
                >
                  <Pause className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  aria-label="Resume"
                  className="h-7 w-7 rounded-lg text-content-secondary hover:text-status-success hover:bg-status-success/10 transition-colors border border-border-subtle/70 inline-flex items-center justify-center"
                  title={t('dca.actions.resume', 'Resume')}
                  onClick={() => dispatch(resumeOrder(order.id))}
                >
                  <Play className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                aria-label="Cancel"
                className="h-7 w-7 rounded-lg text-content-secondary hover:text-status-danger hover:bg-status-danger/10 transition-colors border border-border-subtle/70 inline-flex items-center justify-center"
                title={t('dca.actions.cancel', 'Cancel')}
                onClick={() => dispatch(cancelOrder(order.id))}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button
              aria-label="Delete"
              className="h-7 w-7 rounded-lg text-content-secondary hover:text-status-danger hover:bg-status-danger/10 transition-colors border border-border-subtle/70 inline-flex items-center justify-center"
              title="Delete permanently"
              onClick={() => dispatch(deleteOrder(order.id))}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Row 2: contextual status strip ─────────────────────────────────── */}
      <div className="px-4 py-2.5 border-y border-border-subtle/40 bg-surface-overlay/20">
        {order.type === 'scheduled' && order.intervalHours != null ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-content-secondary">
                Every{' '}
                <span className="text-content-primary font-semibold">
                  {formatInterval(order.intervalHours)}
                </span>
              </span>
              {isActive && msToNext != null && (
                <span className="text-content-secondary">
                  {msToNext <= 0 ? (
                    <span className="text-primary font-semibold">
                      {t('dca.card.checking', 'Checking…')}
                    </span>
                  ) : msToNext <= DCA_SCHEDULER_INTERVAL_MS ? (
                    <>
                      Next in{' '}
                      <span className="text-primary font-semibold">
                        {'<'}
                        {Math.ceil(DCA_SCHEDULER_INTERVAL_MS / 1000)}s
                      </span>
                    </>
                  ) : (
                    <>
                      Next in{' '}
                      <span className="text-primary font-semibold">
                        {formatTimeRemaining(msToNext)}
                      </span>
                    </>
                  )}
                </span>
              )}
              {isPaused && (
                <span className="text-status-warning text-xs">Paused</span>
              )}
              {isDone && (
                <span className="text-content-secondary text-xs">
                  {order.status === 'cancelled' ? 'Cancelled' : 'Completed'}
                </span>
              )}
            </div>
            {isActive && progressPct != null && (
              <div className="h-1.5 rounded-full bg-surface-base/80 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-1000"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            )}
          </div>
        ) : order.type === 'price-target' &&
          order.triggerPriceBtcUsdt != null ? (
          <div className="flex items-center gap-4 text-xs flex-wrap">
            <span className="text-content-secondary">
              Trigger ≤{' '}
              <span className="text-status-warning font-semibold">
                $
                {order.triggerPriceBtcUsdt.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </span>
            </span>
            {currentBtcPrice && (
              <span className="text-content-secondary">
                Current{' '}
                <span className="text-content-primary font-semibold">
                  $
                  {currentBtcPrice.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </span>
              </span>
            )}
            {priceGapPct != null && isActive && (
              <span
                className={
                  triggerReached
                    ? 'text-status-success font-medium'
                    : 'text-content-secondary'
                }
              >
                {triggerReached
                  ? t('dca.card.triggerReady', 'At/under trigger ✓')
                  : `−${priceGapPct.toFixed(1)}% to trigger`}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-content-secondary">—</span>
        )}
      </div>

      {/* ── Row 3: stats footer + expand ───────────────────────────────────── */}
      <div
        className={`flex items-center justify-between px-4 py-2.5 gap-3 ${hasHistory ? 'cursor-pointer' : ''}`}
        onClick={() => hasHistory && setExpanded((p) => !p)}
      >
        <div className="flex items-center gap-3 text-xs text-content-secondary flex-wrap">
          {/* Buy count */}
          <span className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-status-success" />
            <span className="text-content-primary font-medium">
              {successCount}
            </span>{' '}
            buy{successCount !== 1 ? 's' : ''}
          </span>

          {/* Total sats */}
          {totalSats > 0 && (
            <span>
              <span className="text-content-primary font-medium">
                {totalSats >= 1_000_000
                  ? `${(totalSats / 1_000_000).toFixed(3)}M`
                  : totalSats >= 1_000
                    ? `${(totalSats / 1_000).toFixed(1)}k`
                    : totalSats.toLocaleString()}
              </span>{' '}
              sats
            </span>
          )}

          {/* Avg price */}
          {avgPrice != null && (
            <span>
              avg{' '}
              <span className="text-content-primary font-medium">
                $
                {avgPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
            </span>
          )}

          {/* Total fees */}
          {totalFeeSats > 0 && (
            <span className="text-content-secondary/80">
              fees{' '}
              <span className="font-medium">
                {totalFeeSats >= 1_000
                  ? `${(totalFeeSats / 1_000).toFixed(1)}k`
                  : totalFeeSats.toLocaleString('en-US')}
              </span>{' '}
              sats
            </span>
          )}

          {/* Failed indicator */}
          {failedExecs.length > 0 && (
            <span className="flex items-center gap-1 text-status-danger/70">
              <XCircle className="w-3 h-3" />
              {failedExecs.length} failed
            </span>
          )}
        </div>

        {hasHistory && (
          <button className="text-content-secondary hover:text-content-primary transition-colors flex-shrink-0">
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* ── Expanded history ────────────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-border-subtle/50 bg-surface-overlay/20 p-4 space-y-3">
          <DcaHistoryChart executions={order.executions} />
          <div className="space-y-1 max-h-52 overflow-y-auto">
            {[...order.executions].reverse().map((exec) => (
              <ExecutionRow exec={exec} key={exec.id} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
