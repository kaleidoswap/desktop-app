import { useTranslation } from 'react-i18next'
import { X, BarChart2 } from 'lucide-react'

export interface AnalyticsModalProps {
  isOpen: boolean
  onClose: () => void
  currentBtcPrice?: number
  activeOrdersCount: number
  activeScheduled: number
  activePriceTarget: number
  totalBuys: number
  totalSats: number
  totalFeeSats: number
  formatSats: (sats: number) => string
  formatPrice: (price: number) => string
}

export function AnalyticsModal({
  isOpen,
  onClose,
  currentBtcPrice,
  activeOrdersCount,
  activeScheduled,
  activePriceTarget,
  totalBuys,
  totalSats,
  totalFeeSats,
  formatSats,
  formatPrice,
}: AnalyticsModalProps) {
  const { t } = useTranslation()

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-base/70 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-surface-base border border-border-subtle rounded-2xl shadow-2xl shadow-black/30 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <BarChart2 className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold text-content-primary">
              {t('dca.analytics.title', 'Overall Stats & Analytics')}
            </h2>
          </div>
          <button
            className="p-1.5 rounded-lg text-content-secondary hover:text-content-primary hover:bg-surface-overlay transition-colors"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal body */}
        <div className="p-5 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[
              {
                label: t('dca.spotPrice', 'BTC Spot'),
                value: currentBtcPrice ? formatPrice(currentBtcPrice) : '—',
              },
              {
                label: t('dca.activeOrders', 'Active Orders'),
                value: String(activeOrdersCount),
                sub: `${activeScheduled} ${t('dca.type.scheduled', 'Scheduled')} · ${activePriceTarget} ${t('dca.type.priceTarget', 'Target')}`,
              },
              {
                label: t('dca.metrics.totalBuys', 'Total Buys'),
                value: String(totalBuys),
                sub: totalBuys > 0 ? 'executed successfully' : undefined,
                tone: 'text-status-success',
              },
              {
                label: t('dca.metrics.accumulated', 'Accumulated'),
                value: totalSats > 0 ? `${formatSats(totalSats)} sats` : '—',
                sub:
                  totalFeeSats > 0
                    ? `fees ${formatSats(totalFeeSats)} sats`
                    : undefined,
                tone: totalSats > 0 ? 'text-primary' : 'text-content-primary',
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-border-subtle/70 bg-surface-base/35 px-4 py-4"
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-content-tertiary">
                  {item.label}
                </div>
                <div
                  className={`mt-1.5 text-lg font-bold ${item.tone || 'text-content-primary'}`}
                >
                  {item.value}
                </div>
                {item.sub && (
                  <div className="mt-1 text-xs text-content-secondary">
                    {item.sub}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Placeholder graph */}
          <div className="border border-border-default bg-surface-overlay/30 rounded-xl p-6 flex flex-col items-center justify-center text-center h-48 border-dashed">
            <BarChart2 className="w-8 h-8 text-content-tertiary mb-3 opacity-50" />
            <p className="text-sm font-medium text-content-secondary">
              {t('dca.analytics.graphComingSoon', 'Performance Graph')}
            </p>
            <p className="text-xs text-content-tertiary mt-1">
              {t('dca.analytics.comingSoon', 'Coming soon...')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
