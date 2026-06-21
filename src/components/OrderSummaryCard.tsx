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
  showTotal = true,
  subtitle,
  ticker,
  title,
  titleClassName,
  totalLabel,
}: LiquiditySection & { showTotal?: boolean }) => (
  <div
    className={`min-w-0 rounded-2xl border p-4 ${borderClassName} ${backgroundClassName}`}
  >
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <img
          alt={iconAlt}
          className="h-5 w-5 flex-shrink-0 rounded-full"
          src={iconSrc}
        />
        <p
          className={`truncate text-sm font-semibold ${
            titleClassName || 'text-content-primary'
          }`}
        >
          {title}
        </p>
      </div>
      {showTotal && (
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-content-tertiary">
            {ticker}
          </p>
          <p className={`${accentClassName} text-sm font-semibold`}>
            {totalLabel}
          </p>
        </div>
      )}
    </div>

    {subtitle && (
      <p className="mt-2 text-xs leading-relaxed text-content-secondary">
        {subtitle}
      </p>
    )}

    {meta && <div className="mt-3">{meta}</div>}

    <div className="mt-3">
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
    <div className="overflow-hidden rounded-[24px] border border-border-subtle bg-surface-base/80 shadow-[0_12px_40px_rgba(2,6,23,0.25)]">
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
            <LiquiditySummaryCard
              key={section.title}
              showTotal={liquiditySections.length > 1}
              {...section}
            />
          ))}
        </div>

        {costBreakdown && (
          <div className="rounded-2xl border border-border-subtle/70 bg-surface-overlay/30 p-4">
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
