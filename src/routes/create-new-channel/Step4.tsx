import { ArrowLeft, ArrowRight, RefreshCw, X } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../components/ui'

const SUCCESS_PARTICLES = [
  { angle: 0, color: '#15E99A', delay: 0.3, dist: 70 },
  { angle: 30, color: '#34d399', delay: 0.36, dist: 56 },
  { angle: 60, color: '#6ee7b7', delay: 0.32, dist: 64 },
  { angle: 90, color: '#15E99A', delay: 0.4, dist: 72 },
  { angle: 120, color: '#34d399', delay: 0.34, dist: 54 },
  { angle: 150, color: '#a7f3d0', delay: 0.42, dist: 66 },
  { angle: 180, color: '#15E99A', delay: 0.3, dist: 70 },
  { angle: 210, color: '#34d399', delay: 0.38, dist: 58 },
  { angle: 240, color: '#6ee7b7', delay: 0.33, dist: 68 },
  { angle: 270, color: '#15E99A', delay: 0.44, dist: 60 },
  { angle: 300, color: '#a7f3d0', delay: 0.31, dist: 74 },
  { angle: 330, color: '#34d399', delay: 0.4, dist: 56 },
]

interface Props {
  error: string | null
  onFinish: VoidFunction
  onGoBack: VoidFunction
  onRetry: VoidFunction
}

export const Step4 = (props: Props) => {
  const { t } = useTranslation()
  if (props.error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 max-w-md mx-auto">
        <div className="text-center mt-6 bg-surface-overlay/50 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-border-default w-full">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
            <X className="w-7 h-7 text-red-400" />
          </div>

          <h3 className="text-2xl font-bold text-white mb-4">
            {t('createChannel.step4.failed')}
          </h3>

          <p className="text-red-400 mb-8 py-3 px-4 bg-red-900/20 rounded-lg border border-red-800/50 text-sm">
            {props.error}
          </p>

          <div className="flex items-center justify-between">
            <button
              className="px-3 py-2 text-content-secondary hover:text-white transition-colors flex items-center gap-1.5 hover:bg-surface-overlay/50 rounded-lg text-sm"
              onClick={props.onGoBack}
              type="button"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Go Back
            </button>
            <Button
              icon={<RefreshCw className="w-4 h-4" />}
              iconPosition="right"
              onClick={props.onRetry}
              size="md"
              variant="primary"
            >
              {t('createChannel.step4.tryAgain')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 max-w-lg mx-auto">
      <div className="text-center mt-6 bg-surface-overlay/50 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-border-default w-full">
        <div className="relative mx-auto mb-5 h-14 w-14">
          {SUCCESS_PARTICLES.map((p, i) => (
            <span
              className="order-success-particle"
              key={i}
              style={
                {
                  '--angle': `${p.angle}deg`,
                  '--delay': `${p.delay}s`,
                  '--dist': `${p.dist}px`,
                  background: p.color,
                } as CSSProperties
              }
            />
          ))}
          <span className="order-success-ring absolute inset-0 rounded-full bg-emerald-500/30" />
          <span className="order-success-ring-2 absolute inset-0 rounded-full border-2 border-emerald-400/40" />
          <div className="order-success-circle relative flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
            <svg
              className="h-7 w-7 text-primary"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
            >
              <path className="order-success-check" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <h3 className="text-2xl font-bold text-white mb-4">
          Channel opening completed
        </h3>

        <p className="text-content-secondary mb-8 text-sm">
          {t('createChannel.step4.successMessage')}
        </p>

        <Button
          fullWidth
          icon={<ArrowRight className="w-4 h-4" />}
          iconPosition="right"
          onClick={props.onFinish}
          size="md"
          variant="primary"
        >
          Go to Manage Channels
        </Button>
      </div>
    </div>
  )
}
