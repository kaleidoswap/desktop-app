import { useTranslation } from 'react-i18next'
import { CalendarClock, Target, X } from 'lucide-react'

export function HowItWorksModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-base/70 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-[600px] bg-surface-raised border border-border-subtle rounded-2xl shadow-2xl shadow-black/30 overflow-hidden relative p-6">
        <button
          className="absolute top-4 right-4 p-1.5 rounded-lg text-content-secondary hover:text-content-primary hover:bg-surface-overlay transition-colors"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </button>

        <span className="font-semibold text-content-primary text-xl mb-4 block">
          {t('dca.howItWorks.title', 'How DCA works')}
        </span>
        <div className="space-y-4">
          <p className="text-sm text-content-primary/90 leading-relaxed">
            {t(
              'dca.howItWorks.description',
              'DCA automatically spends your USDT Lightning balance to buy BTC on Lightning. Orders run only when your node is unlocked, maker pricing is reachable, and your channels can both spend USDT and receive BTC.'
            )}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border border-border-subtle/60 bg-surface-overlay/50 space-y-1.5">
              <p className="text-xs font-semibold text-content-primary uppercase tracking-wide">
                {t('dca.howItWorks.fundingTitle', '1. Fund the order')}
              </p>
              <p className="text-[13px] text-content-secondary leading-relaxed">
                {t(
                  'dca.howItWorks.fundingDescription',
                  'Keep enough USDT Lightning balance for the buy amount. Your BTC Lightning capacity sets how many sats you can receive per execution.'
                )}
              </p>
            </div>
            <div className="p-3 rounded-lg border border-border-subtle/60 bg-surface-overlay/50 space-y-1.5">
              <p className="text-xs font-semibold text-content-primary uppercase tracking-wide">
                {t('dca.howItWorks.triggerTitle', '2. Choose the trigger')}
              </p>
              <p className="text-[13px] text-content-secondary leading-relaxed">
                {t(
                  'dca.howItWorks.triggerDescription',
                  'Scheduled orders buy after each interval. Price Target orders wait for BTC to hit your threshold, then re-arm from the new market price after a successful buy.'
                )}
              </p>
            </div>
            <div className="p-3 rounded-lg border border-border-subtle/60 bg-surface-overlay/50 space-y-1.5">
              <p className="text-xs font-semibold text-content-primary uppercase tracking-wide">
                {t('dca.howItWorks.manageTitle', '3. Monitor and control')}
              </p>
              <p className="text-[13px] text-content-secondary leading-relaxed">
                {t(
                  'dca.howItWorks.manageDescription',
                  'Use Execute for one immediate buy, Pause to stop automatic runs, and Cancel to move the order into history without deleting past executions.'
                )}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="flex items-start gap-2.5 p-3 bg-primary/8 border border-primary/20 rounded-lg">
              <CalendarClock className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-content-primary mb-0.5 text-sm">
                  {t('dca.type.scheduled', 'Scheduled')}
                </p>
                <p className="text-[13px] text-content-primary/85 leading-relaxed">
                  {t(
                    'dca.howItWorks.scheduled',
                    'Buys the same USDT amount on a fixed cadence, such as every hour or every 24 hours.'
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 p-3 bg-status-warning/8 border border-status-warning/20 rounded-lg">
              <Target className="w-4 h-4 text-status-warning mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-content-primary mb-0.5 text-sm">
                  {t('dca.type.priceTarget', 'Price Target')}
                </p>
                <p className="text-[13px] text-content-primary/85 leading-relaxed">
                  {t(
                    'dca.howItWorks.priceTarget',
                    'Buys once BTC falls to or below your threshold. After a successful buy, the next trigger is recalculated from the latest price.'
                  )}
                </p>
              </div>
            </div>
          </div>
          <p className="text-[13px] text-content-secondary pt-3 border-t border-border-subtle/50 leading-relaxed">
            {t(
              'dca.howItWorks.actions',
              'A buy only happens when the wallet is ready. If liquidity or maker connectivity is missing, the order stays active and retries on the next eligible check.'
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
