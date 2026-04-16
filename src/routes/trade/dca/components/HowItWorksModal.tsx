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
      <div className="w-full max-w-2xl bg-surface-base border border-border-subtle rounded-2xl shadow-2xl shadow-black/30 overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border-subtle/50">
          <h2 className="text-2xl font-bold text-white">
            {t('dca.howItWorks.title', 'How DCA works')}
          </h2>
          <button
            className="p-1.5 rounded-lg text-content-secondary hover:text-content-primary hover:bg-surface-overlay transition-colors"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <p className="text-sm text-content-secondary leading-relaxed">
            {t(
              'dca.howItWorks.description',
              'DCA automatically spends your USDT Lightning balance to buy BTC on Lightning. Orders run only when your node is unlocked, maker pricing is reachable, and your channels can both spend USDT and receive BTC.'
            )}
          </p>

          <div className="flex flex-col gap-2">
            <div className="p-4 rounded-xl border border-border-default/50 space-y-1">
              <p className="text-xs font-semibold text-white uppercase tracking-wider">
                {t('dca.howItWorks.fundingTitle', '1. Fund the order')}
              </p>
              <p className="text-sm text-content-secondary leading-relaxed">
                {t(
                  'dca.howItWorks.fundingDescription',
                  'Keep enough USDT Lightning balance for the buy amount. Your BTC Lightning capacity sets how many sats you can receive per execution.'
                )}
              </p>
            </div>
            <div className="p-4 rounded-xl border border-border-default/50 space-y-1">
              <p className="text-xs font-semibold text-white uppercase tracking-wider">
                {t('dca.howItWorks.triggerTitle', '2. Choose the trigger')}
              </p>
              <p className="text-sm text-content-secondary leading-relaxed">
                {t(
                  'dca.howItWorks.triggerDescription',
                  'Scheduled orders buy after each interval. Price Target orders wait for BTC to hit your threshold, then re-arm from the new market price after a successful buy.'
                )}
              </p>
            </div>
            <div className="p-4 rounded-xl border border-border-default/50 space-y-1">
              <p className="text-xs font-semibold text-white uppercase tracking-wider">
                {t('dca.howItWorks.manageTitle', '3. Monitor and control')}
              </p>
              <p className="text-sm text-content-secondary leading-relaxed">
                {t(
                  'dca.howItWorks.manageDescription',
                  'Use Execute for one immediate buy, Pause to stop automatic runs, and Cancel to move the order into history without deleting past executions.'
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-start gap-3 p-4 bg-white/5 border border-white/10 rounded-xl">
              <CalendarClock className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-content-primary mb-1.5 text-sm">
                  {t('dca.type.scheduled', 'Scheduled')}
                </p>
                <p className="text-sm text-content-secondary leading-relaxed">
                  {t(
                    'dca.howItWorks.scheduled',
                    'Buys the same USDT amount on a fixed cadence, such as every hour or every 24 hours.'
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-white/5 border border-white/10 rounded-xl">
              <Target className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-content-primary mb-1.5 text-sm">
                  {t('dca.type.priceTarget', 'Price Target')}
                </p>
                <p className="text-sm text-content-secondary leading-relaxed">
                  {t(
                    'dca.howItWorks.priceTarget',
                    'Buys once BTC falls to or below your threshold. After a successful buy, the next trigger is recalculated from the latest price.'
                  )}
                </p>
              </div>
            </div>
          </div>

          <p className="text-sm text-content-secondary pt-4 border-t border-border-subtle/50 leading-relaxed">
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
