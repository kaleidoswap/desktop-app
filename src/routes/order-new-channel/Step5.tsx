import {
  CheckCircle,
  XCircle,
  ArrowRight,
  RefreshCcw,
  SlidersHorizontal,
  Copy,
  Clock,
  Info,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { CHANNELS_PATH } from '../../app/router/paths'
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

export const Step5 = ({
  paymentStatus,
  orderId,
  onRestart,
  returnTo,
}: {
  paymentStatus: 'success' | 'error' | 'expired' | null | string
  orderId?: string
  onRestart?: () => void
  returnTo?: string
}) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { copied, copy } = useCopyToClipboard()
  const successDestination = returnTo ?? CHANNELS_PATH

  const copyToClipboard = () => {
    if (orderId) copy(orderId)
  }

  if (paymentStatus === 'success') {
    return (
      <div className="flex flex-col items-center justify-center p-8 max-w-lg mx-auto">
        <div className="text-center mt-6 bg-surface-overlay/50 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-border-default w-full">
          {/* Animated success icon */}
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
            {t('orderChannel.step4.successTitle')}
          </h3>
          <p className="text-content-secondary mb-8 text-sm">
            {t('orderChannel.step4.successMessage')}
          </p>

          <Button
            fullWidth
            icon={<ArrowRight className="w-4 h-4" />}
            iconPosition="right"
            onClick={() => navigate(successDestination)}
            size="md"
            variant="primary"
          >
            {t('orderChannel.step4.successButtonText')}
          </Button>
        </div>
      </div>
    )
  }

  if (paymentStatus === 'error') {
    return (
      <div className="flex flex-col items-center justify-center p-8 max-w-lg mx-auto">
        <div className="text-center mt-6 bg-surface-overlay/50 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-border-default w-full">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
            <XCircle className="w-7 h-7 text-red-400" />
          </div>

          <h3 className="text-2xl font-bold text-white mb-4">
            {t('orderChannel.step4.errorTitle')}
          </h3>
          <p className="text-content-secondary mb-6 text-sm">
            {t('orderChannel.step4.errorMessage')}
          </p>

          <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-left">
            <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-200">
              {t('orderChannel.step4.refundProcess')}{' '}
              {t('orderChannel.step4.refundProcessSuffix')}{' '}
              {t('orderChannel.step4.refundSupport')}
            </p>
          </div>

          {orderId && (
            <div className="mb-8 rounded-xl border border-border-subtle bg-surface-overlay/60 p-3.5 text-left">
              <p className="text-sm font-medium text-content-primary mb-2.5">
                {t('orderChannel.step4.orderIdLabel')}
              </p>
              <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-base/45 px-3 py-2.5">
                <code className="flex-1 font-mono text-[11px] leading-5 text-content-primary whitespace-nowrap overflow-x-auto">
                  {orderId}
                </code>
                <button
                  className="shrink-0 text-content-tertiary hover:text-white transition-colors"
                  onClick={copyToClipboard}
                  title={t('orderChannel.step4.copyToClipboard')}
                  type="button"
                >
                  {copied ? (
                    <CheckCircle className="text-green-400" size={16} />
                  ) : (
                    <Copy size={16} />
                  )}
                </button>
              </div>
              <p className="text-xs text-content-secondary mt-2">
                {t('orderChannel.step4.orderIdHelp')}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              className="px-3 py-2 text-content-secondary hover:text-white transition-colors flex items-center gap-1.5 hover:bg-surface-overlay/50 rounded-lg text-sm"
              onClick={() => navigate(CHANNELS_PATH)}
              type="button"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {t('orderChannel.step4.returnToChannels')}
            </button>
            <Button
              icon={<RefreshCcw className="w-4 h-4" />}
              iconPosition="right"
              onClick={() =>
                onRestart ? onRestart() : navigate(CHANNELS_PATH)
              }
              size="md"
              variant="primary"
            >
              {t('orderChannel.step4.errorButtonText')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (paymentStatus === 'expired') {
    return (
      <div className="flex flex-col items-center justify-center p-8 max-w-lg mx-auto">
        <div className="text-center mt-6 bg-surface-overlay/50 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-border-default w-full">
          <div className="w-14 h-14 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mx-auto mb-5">
            <Clock className="w-7 h-7 text-yellow-400" />
          </div>

          <h3 className="text-2xl font-bold text-white mb-4">
            {t('orderChannel.step4.expiredTitle')}
          </h3>
          <p className="text-content-secondary mb-8 text-sm">
            {t('orderChannel.step4.expiredMessage')}
          </p>

          <div className="flex items-center justify-between">
            <button
              className="px-3 py-2 text-content-secondary hover:text-white transition-colors flex items-center gap-1.5 hover:bg-surface-overlay/50 rounded-lg text-sm"
              onClick={() => navigate(CHANNELS_PATH)}
              type="button"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {t('orderChannel.step4.returnToChannels')}
            </button>
            <Button
              icon={<RefreshCcw className="w-4 h-4" />}
              iconPosition="right"
              onClick={() =>
                onRestart ? onRestart() : navigate(CHANNELS_PATH)
              }
              size="md"
              variant="primary"
            >
              {t('orderChannel.step4.expiredButtonText')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // pending / unknown
  return (
    <div className="flex flex-col items-center justify-center p-8 max-w-lg mx-auto">
      <div className="text-center mt-6 bg-surface-overlay/50 backdrop-blur-sm p-8 rounded-2xl shadow-xl border border-border-default w-full">
        <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
          <RefreshCcw className="w-7 h-7 text-primary animate-spin" />
        </div>

        <h3 className="text-2xl font-bold text-white mb-4">
          {t('orderChannel.step4.pendingTitle')}
        </h3>
        <p className="text-content-secondary mb-8 text-sm">
          {t('orderChannel.step4.pendingMessage')}
        </p>

        <Button
          fullWidth
          icon={<RefreshCcw className="w-4 h-4" />}
          iconPosition="right"
          onClick={() => window.location.reload()}
          size="md"
          variant="primary"
        >
          {t('orderChannel.step4.pendingButtonText')}
        </Button>
      </div>
    </div>
  )
}
