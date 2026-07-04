import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CalendarClock,
  ChevronDown,
  Info,
  Target,
  TrendingUp,
  X,
} from 'lucide-react'
import { createPortal } from 'react-dom'

import {
  getModalPortalTarget,
  getModalPositionClass,
} from '../../../../helpers/modalPortal'

export function HowItWorksModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [expandedStep, setExpandedStep] = useState<string | null>('fund')

  if (!isOpen) return null

  const pos = getModalPositionClass()

  const toggleStep = (step: string) => {
    setExpandedStep(expandedStep === step ? null : step)
  }

  const steps = [
    {
      content: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-start gap-2.5 p-3 border border-primary/25 rounded-xl bg-primary/5">
            <CalendarClock className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
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
          <div className="flex items-start gap-2.5 p-3 border border-primary/25 rounded-xl bg-primary/5">
            <Target className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
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
      ),
      id: 'types',
      label: t('dca.howItWorks.typesTitle', '1. Choose a DCA type'),
    },
    {
      content: (
        <p className="text-sm text-content-secondary leading-relaxed">
          {t(
            'dca.howItWorks.fundingDescription',
            'Keep enough USDT Lightning balance for the buy amount. Your BTC Lightning capacity sets how many sats you can receive per execution.'
          )}
        </p>
      ),
      id: 'fund',
      label: t('dca.howItWorks.fundingTitle', '2. Fund the order'),
    },
    {
      content: (
        <p className="text-sm text-content-secondary leading-relaxed">
          {t(
            'dca.howItWorks.triggerDescription',
            'Scheduled orders buy after each interval. Price Target orders wait for BTC to hit your threshold, then re-arm from the new market price after a successful buy.'
          )}
        </p>
      ),
      id: 'trigger',
      label: t('dca.howItWorks.triggerTitle', '3. Choose the trigger'),
    },
    {
      content: (
        <p className="text-sm text-content-secondary leading-relaxed">
          {t(
            'dca.howItWorks.manageDescription',
            'Use Execute for one immediate buy, Pause to stop automatic runs, and Cancel to move the order into history without deleting past executions.'
          )}
        </p>
      ),
      id: 'manage',
      label: t('dca.howItWorks.manageTitle', '4. Monitor and control'),
    },
  ]

  return createPortal(
    <div
      className={`${pos} inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm animate-in fade-in duration-200`}
    >
      <div
        className="flex min-h-screen items-center justify-center p-4 sm:p-6"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          className="bg-surface-base p-6 sm:p-8 rounded-3xl border border-border-subtle/50 max-w-2xl w-full shadow-2xl max-h-[calc(100vh-2rem)] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-divider/10 mb-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-primary flex-shrink-0" />
              <h3 className="text-xl font-bold text-white">
                {t('dca.howItWorks.title', 'How DCA works')}
              </h3>
            </div>
            <button
              className="p-1.5 rounded-md text-content-secondary hover:text-white hover:bg-surface-overlay/50 transition-colors"
              onClick={onClose}
              type="button"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="space-y-4">
            <p className="text-sm text-content-secondary leading-relaxed">
              {t(
                'dca.howItWorks.description',
                'DCA automatically spends your USDT Lightning balance to buy BTC on Lightning. Orders run only when your node is unlocked, maker pricing is reachable, and your channels can both spend USDT and receive BTC.'
              )}
            </p>

            {/* Accordion steps */}
            <div className="space-y-2">
              {steps.map((step) => (
                <div
                  className="bg-surface-overlay/30 rounded-lg border border-border-default overflow-hidden"
                  key={step.id}
                >
                  <button
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-surface-overlay/50 transition-colors"
                    onClick={() => toggleStep(step.id)}
                    type="button"
                  >
                    <span className="font-medium text-white text-sm">
                      {step.label}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-content-secondary flex-shrink-0 transform transition-transform duration-200 ${
                        expandedStep === step.id ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {expandedStep === step.id && (
                    <div className="px-4 pb-4 pt-1">{step.content}</div>
                  )}
                </div>
              ))}
            </div>

            {/* Info banner */}
            <div className="flex items-start gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3">
              <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-200 leading-relaxed">
                {t(
                  'dca.howItWorks.actions',
                  'A buy only happens when the wallet is ready. If liquidity or maker connectivity is missing, the order stays active and retries on the next eligible check.'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    getModalPortalTarget()
  )
}
