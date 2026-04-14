import {
  ArrowLeft,
  ArrowRight,
  Bitcoin,
  ChevronLeft,
  Clock,
  Download,
  Lightbulb,
  Rocket,
  ShoppingCart,
  Store,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import {
  CHANNELS_PATH,
  TRADE_MARKET_MAKER_PATH,
  WALLET_DASHBOARD_PATH,
} from '../../app/router/paths'
import { useAppDispatch } from '../../app/store/hooks'
import { Button } from '../../components/ui'
import { Stepper } from '../../components/ui/Stepper'
import { uiSliceActions } from '../../slices/ui/ui.slice'

type GuideStep = 1 | 2 | 3 | 4

interface StepConfig {
  key: string
  icon: React.ElementType
  accentIcon: React.ElementType
  ctaKey: string
  ctaAction: () => void
  gradient: string
  accentColor: string
}

export const Component = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const [step, setStep] = useState<GuideStep>(1)

  const openDepositModal = () => {
    navigate(WALLET_DASHBOARD_PATH)
    // Small delay to let the dashboard mount before dispatching modal
    setTimeout(() => {
      dispatch(uiSliceActions.setModal({ assetId: undefined, type: 'deposit' }))
    }, 100)
  }

  const steps: StepConfig[] = [
    {
      accentColor: 'text-amber-400',
      accentIcon: Bitcoin,
      ctaAction: openDepositModal,
      ctaKey: 'guide.actions.depositBtc',
      gradient: 'from-amber-500/20 to-orange-500/10',
      icon: Download,
      key: 'deposit',
    },
    {
      accentColor: 'text-cyan',
      accentIcon: Zap,
      ctaAction: () => navigate(TRADE_MARKET_MAKER_PATH),
      ctaKey: 'guide.actions.goToMarketMaker',
      gradient: 'from-cyan/20 to-blue-500/10',
      icon: Store,
      key: 'marketMaker',
    },
    {
      accentColor: 'text-purple-400',
      accentIcon: Zap,
      ctaAction: () => navigate(TRADE_MARKET_MAKER_PATH),
      ctaKey: 'guide.actions.browseAssets',
      gradient: 'from-purple-500/20 to-pink-500/10',
      icon: ShoppingCart,
      key: 'buyChannel',
    },
    {
      accentColor: 'text-emerald-400',
      accentIcon: Rocket,
      ctaAction: () => navigate(CHANNELS_PATH),
      ctaKey: 'guide.actions.viewChannels',
      gradient: 'from-emerald-500/20 to-green-500/10',
      icon: Clock,
      key: 'waitAndTrade',
    },
  ]

  const currentStep = steps[step - 1]

  const stepperSteps = steps.map((s, i) => ({
    completed: i + 1 < step,
    label: t(`guide.steps.${s.key}.title`),
  }))

  const handleNext = () => {
    if (step < 4) setStep((step + 1) as GuideStep)
  }

  const handleBack = () => {
    if (step > 1) setStep((step - 1) as GuideStep)
  }

  const Icon = currentStep.icon
  const AccentIcon = currentStep.accentIcon

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
        <div className="flex items-center gap-3">
          <Button
            icon={<ChevronLeft className="w-4 h-4" />}
            onClick={() => navigate(WALLET_DASHBOARD_PATH)}
            size="sm"
            variant="ghost"
          >
            {t('guide.actions.backToDashboard')}
          </Button>
        </div>
        <p className="text-sm text-content-tertiary">
          {t('guide.stepLabel', { current: step, total: 4 })}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <div className="max-w-3xl mx-auto px-6 py-8">
          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-bold mb-2 bg-gradient-to-r from-cyan via-blue-400 to-cyan bg-clip-text text-transparent">
              {t('guide.title')}
            </h1>
            <p className="text-content-secondary text-sm">
              {t('guide.subtitle')}
            </p>
          </div>

          {/* Stepper */}
          <div className="mb-12 px-8">
            <Stepper currentStep={step} steps={stepperSteps} />
          </div>

          {/* Step Card */}
          <div className="mt-8">
            <div
              className={`rounded-2xl border border-border-default/50 bg-gradient-to-br ${currentStep.gradient} backdrop-blur-sm p-8 md:p-10 transition-all duration-300`}
            >
              {/* Icon */}
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div
                    className={`w-20 h-20 rounded-2xl bg-surface-overlay/80 border border-border-default/50 flex items-center justify-center shadow-lg`}
                  >
                    <Icon className={`w-10 h-10 ${currentStep.accentColor}`} />
                  </div>
                  <div
                    className={`absolute -bottom-2 -right-2 w-8 h-8 rounded-lg bg-surface-elevated border border-border-default/50 flex items-center justify-center shadow-md`}
                  >
                    <AccentIcon
                      className={`w-4 h-4 ${currentStep.accentColor}`}
                    />
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="text-center space-y-4">
                <h2 className="text-xl md:text-2xl font-bold text-white">
                  {t(`guide.steps.${currentStep.key}.title`)}
                </h2>
                <p className="text-content-secondary text-sm md:text-base leading-relaxed max-w-xl mx-auto">
                  {t(`guide.steps.${currentStep.key}.description`)}
                </p>
              </div>

              {/* Pro Tip */}
              <div className="mt-6 mx-auto max-w-lg">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-base/60 border border-border-subtle">
                  <Lightbulb className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-400 mb-1">
                      {t('guide.proTip')}
                    </p>
                    <p className="text-xs text-content-secondary leading-relaxed">
                      {t(`guide.steps.${currentStep.key}.tip`)}
                    </p>
                  </div>
                </div>
              </div>

              {/* CTA Button */}
              <div className="flex justify-center mt-8">
                <Button
                  icon={<ArrowRight className="w-4 h-4" />}
                  iconPosition="right"
                  onClick={currentStep.ctaAction}
                  variant="primary"
                >
                  {t(currentStep.ctaKey)}
                </Button>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pb-4">
            <div>
              {step > 1 && (
                <Button
                  icon={<ArrowLeft className="w-4 h-4" />}
                  onClick={handleBack}
                  variant="outline"
                >
                  {t('guide.actions.back')}
                </Button>
              )}
            </div>

            <div>
              {step < 4 ? (
                <Button
                  icon={<ArrowRight className="w-4 h-4" />}
                  iconPosition="right"
                  onClick={handleNext}
                  variant="primary"
                >
                  {t('guide.actions.next')}
                </Button>
              ) : (
                <Button
                  icon={<Rocket className="w-4 h-4" />}
                  iconPosition="right"
                  onClick={() => navigate(TRADE_MARKET_MAKER_PATH)}
                  variant="primary"
                >
                  {t('guide.actions.finish')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
