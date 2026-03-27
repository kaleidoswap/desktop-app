import type { ReactNode } from 'react'

import { LiquidityBar } from './Liquidity'

export interface CostBreakdownItem {
  label: string
  value: string
  valueClassName?: string
}

export interface LiquiditySection {
  accentClassName: string
  backgroundClassName: string
  borderClassName: string
  iconAlt: string
  iconSrc: string
  inbound: number
  inboundColor: string
  inboundLabel: string
  meta?: ReactNode
  outbound: number
  outboundColor: string
  outboundLabel: string
  subtitle?: string
  ticker: string
  title: string
  titleClassName?: string
  totalLabel: string
}

interface OrderSummaryCardProps {
  costBreakdown?: {
    items: CostBreakdownItem[]
    totalLabel: string
    totalValue: string
  }
  description?: string
  headerEyebrow?: string
  liquiditySections: LiquiditySection[]
  stackSections?: boolean
  title?: string
  totalCapacityLabel?: string
  totalCapacityValue?: string
}

const LiquiditySummaryCard = ({
  accentClassName,
  backgroundClassName,
  borderClassName,
  iconAlt,
  iconSrc,
  inbound,
  inboundColor,
  inboundLabel,
  meta,
  outbound,
  outboundColor,
  outboundLabel,
  subtitle,
  ticker,
  title,
  titleClassName,
  totalLabel,
}: LiquiditySection) => (
  <div
    className={`min-w-0 rounded-[22px] border p-4 shadow-[0_12px_30px_-22px_rgba(0,0,0,0.7)] ${borderClassName} ${backgroundClassName}`}
  >
    <div className="flex flex-wrap items-start gap-3">
      <div className="min-w-0 flex flex-1 items-start gap-3">
        <img
          alt={iconAlt}
          className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-full"
          src={iconSrc}
        />
        <div className="min-w-0">
          <p
            className={`text-sm font-semibold ${
              titleClassName || 'text-content-primary'
            }`}
          >
            {title}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs leading-relaxed text-content-secondary">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-border-subtle bg-surface-overlay/60 px-3 py-2 text-right">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-content-tertiary">
          {ticker}
        </p>
        <p className={`${accentClassName} mt-1 text-sm font-semibold`}>
          {totalLabel}
        </p>
      </div>
    </div>

    {meta && <div className="mt-4">{meta}</div>}

    <div className="mt-4">
      <LiquidityBar
        inbound={inbound}
        inboundColor={inboundColor}
        inboundLabel={inboundLabel}
        outbound={outbound}
        outboundColor={outboundColor}
        outboundLabel={outboundLabel}
      />
    </div>
  </div>
)

export const OrderSummaryCard = ({
  costBreakdown,
  description,
  headerEyebrow,
  liquiditySections,
  stackSections = true,
  title,
  totalCapacityLabel,
  totalCapacityValue,
}: OrderSummaryCardProps) => {
  return (
    <div className="overflow-hidden rounded-[24px] border border-border-subtle bg-surface-base/80 shadow-[0_18px_60px_rgba(2,6,23,0.35)]">
      {(title || totalCapacityValue) && (
        <div className="border-b border-border-subtle bg-gradient-to-br from-amber-400/10 via-transparent to-cyan-400/6 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              {headerEyebrow && (
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-content-tertiary">
                  {headerEyebrow}
                </p>
              )}
              {title && (
                <h3 className="mt-2 text-xl font-semibold text-content-primary">
                  {title}
                </h3>
              )}
              {description && (
                <p className="mt-2 text-sm text-content-secondary">
                  {description}
                </p>
              )}
            </div>
            {totalCapacityValue && (
              <div className="rounded-2xl border border-border-subtle bg-surface-overlay/60 px-4 py-3 text-right">
                {totalCapacityLabel && (
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-content-tertiary">
                    {totalCapacityLabel}
                  </p>
                )}
                <p className="mt-2 text-xl font-semibold text-amber-300">
                  {totalCapacityValue}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-5 p-5">
        <div
          className={`grid gap-4 ${
            !stackSections && liquiditySections.length > 1
              ? 'xl:grid-cols-2'
              : 'grid-cols-1'
          }`}
        >
          {liquiditySections.map((section) => (
            <LiquiditySummaryCard key={section.title} {...section} />
          ))}
        </div>

        {costBreakdown && (
          <div className="rounded-[22px] border border-border-subtle bg-surface-overlay/40 p-4">
            <div className="space-y-1.5">
              {costBreakdown.items.map((item) => (
                <div
                  className="flex justify-between gap-4 text-sm"
                  key={item.label}
                >
                  <span className="text-content-secondary">{item.label}</span>
                  <span
                    className={item.valueClassName || 'text-content-primary'}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="my-3 h-px bg-border-subtle" />

            <div className="flex items-end justify-between gap-4">
              <span className="text-sm font-semibold text-content-secondary">
                {costBreakdown.totalLabel}
              </span>
              <span className="text-xl font-semibold text-amber-300">
                {costBreakdown.totalValue}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
