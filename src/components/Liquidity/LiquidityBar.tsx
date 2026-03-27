import { twJoin } from 'tailwind-merge'

interface LiquidityBarProps {
  outbound: number
  inbound: number
  outboundLabel: string
  inboundLabel: string
  outboundColor: string
  inboundColor: string
  className?: string
  trackClassName?: string
  outboundHint?: string
  inboundHint?: string
  showSummary?: boolean
}

export function LiquidityBar({
  outbound,
  inbound,
  outboundLabel,
  inboundLabel,
  outboundColor,
  inboundColor,
  className,
  trackClassName,
  outboundHint = 'Can send now',
  inboundHint = 'Can receive',
  showSummary = true,
}: LiquidityBarProps) {
  const total = outbound + inbound
  const outPct = total > 0 ? (outbound / total) * 100 : 50
  const inPct = total > 0 ? (inbound / total) * 100 : 50

  return (
    <div className={twJoin('space-y-2', className)}>
      {showSummary && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border-subtle/70 bg-surface-base/35 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-content-tertiary">
              {outboundHint}
            </div>
            <div className="mt-1 text-sm font-semibold text-content-primary">
              {outboundLabel}
            </div>
          </div>
          <div className="rounded-xl border border-border-subtle/70 bg-surface-base/35 px-3 py-2 text-right">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-content-tertiary">
              {inboundHint}
            </div>
            <div className="mt-1 text-sm font-semibold text-content-primary">
              {inboundLabel}
            </div>
          </div>
        </div>
      )}

      <div
        className={twJoin(
          'relative h-3 overflow-hidden rounded-full border border-border-subtle/70 bg-surface-overlay/70 p-[3px]',
          trackClassName
        )}
      >
        <div className="flex h-full overflow-hidden rounded-full bg-surface-base/50">
          <div
            className={twJoin(outboundColor, 'transition-all duration-300')}
            style={{ width: `${outPct}%` }}
          />
          <div
            className={twJoin(inboundColor, 'transition-all duration-300')}
            style={{ width: `${inPct}%` }}
          />
        </div>
        <div className="pointer-events-none absolute inset-y-[2px] left-1/2 w-px -translate-x-1/2 rounded-full bg-white/25" />
      </div>
    </div>
  )
}
