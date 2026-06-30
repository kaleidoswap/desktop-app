import {
  CheckCircle,
  XCircle,
  ArrowRight,
  RefreshCcw,
  Home,
  Copy,
  Clock,
  Info,
  SlidersHorizontal,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { CHANNELS_PATH } from '../../app/router/paths'

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

  const statusConfig = {
    error: {
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
      buttonAction: () => (onRestart ? onRestart() : navigate(CHANNELS_PATH)),
      buttonText: t('orderChannel.step4.errorButtonText'),
      icon: <XCircle className="text-red-500 mb-6" size={80} />,
      message: t('orderChannel.step4.errorMessage'),
      title: t('orderChannel.step4.errorTitle'),
    },
    expired: {
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/30',
      buttonAction: () => (onRestart ? onRestart() : navigate(CHANNELS_PATH)),
      buttonText: t('orderChannel.step4.expiredButtonText'),
      icon: <Clock className="text-yellow-500 mb-6" size={80} />,
      message: t('orderChannel.step4.expiredMessage'),
      title: t('orderChannel.step4.expiredTitle'),
    },
    pending: {
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
      buttonAction: () => window.location.reload(),
      buttonText: t('orderChannel.step4.pendingButtonText'),
      icon: <RefreshCcw className="text-blue-500 mb-6" size={80} />,
      message: t('orderChannel.step4.pendingMessage'),
      title: t('orderChannel.step4.pendingTitle'),
    },
    success: {
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
      buttonAction: () => navigate(successDestination),
      buttonText: t('orderChannel.step4.successButtonText'),
      icon: <CheckCircle className="text-green-500 mb-6" size={80} />,
      message: t('orderChannel.step4.successMessage'),
      title: t('orderChannel.step4.successTitle'),
    },
  }

  const config = statusConfig[paymentStatus as keyof typeof statusConfig]

  if (paymentStatus === 'expired') {
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-[70vh] text-white p-4">
        <div className="w-full max-w-lg text-center">
          {/* Icon with opaque yellow background */}
          <div className="order-expired-circle mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-yellow-500/15">
            <Clock className="text-yellow-500" size={44} />
          </div>

          <h3 className="text-2xl font-bold mb-3">
            {t('orderChannel.step4.expiredTitle')}
          </h3>
          <p className="text-content-secondary mb-8 whitespace-nowrap">
            {t('orderChannel.step4.expiredMessage')}
          </p>

          {/* Actions — Return to Channels (left) & Create New Order (right) */}
          <div className="flex items-center justify-between">
            <button
              className="flex items-center gap-2 text-content-secondary hover:text-white transition-colors py-2 px-3 rounded-lg hover:bg-surface-overlay/50 text-sm"
              onClick={() => navigate(CHANNELS_PATH)}
              type="button"
            >
              <SlidersHorizontal size={16} />
              {t('orderChannel.step4.returnToChannels')}
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-[#12131C] hover:bg-primary-emphasis transition-colors"
              onClick={() =>
                onRestart ? onRestart() : navigate(CHANNELS_PATH)
              }
              type="button"
            >
              <RefreshCcw size={18} />
              {t('orderChannel.step4.expiredButtonText')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (paymentStatus === 'success') {
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-[70vh] text-white p-4">
        <div className="w-full max-w-lg text-center">
          {/* Animated success icon (plays once) */}
          <div className="relative mx-auto mb-6 h-20 w-20">
            {/* Confetti burst */}
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
            {/* Ripple rings */}
            <span className="order-success-ring absolute inset-0 rounded-full bg-emerald-500/30" />
            <span className="order-success-ring-2 absolute inset-0 rounded-full border-2 border-emerald-400/40" />
            {/* Circle + drawing checkmark */}
            <div className="order-success-circle relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15">
              <svg
                className="h-11 w-11 text-emerald-500"
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

          <h3 className="text-2xl font-bold mb-3">
            {t('orderChannel.step4.successTitle')}
          </h3>
          <p className="text-content-secondary mb-6 whitespace-nowrap">
            {t('orderChannel.step4.successMessage')}
          </p>

          {/* Action — Go to Channels Page */}
          <div className="flex justify-center">
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-[#12131C] hover:bg-primary-emphasis transition-colors"
              onClick={() => navigate(successDestination)}
              type="button"
            >
              {t('orderChannel.step4.successButtonText')}
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (paymentStatus === 'error') {
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-[70vh] text-white p-4">
        <div className="w-full max-w-lg text-center">
          {/* Icon with opaque red background */}
          <div className="order-failed-circle mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/15">
            <XCircle className="text-red-500" size={44} />
          </div>

          <h3 className="text-2xl font-bold mb-3">
            {t('orderChannel.step4.errorTitle')}
          </h3>
          <p className="text-content-secondary mb-6 whitespace-nowrap">
            {t('orderChannel.step4.errorMessage')}
          </p>

          {/* Refund info — blue banner */}
          <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-left">
            <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-200">
              {t('orderChannel.step4.refundProcess')}{' '}
              {t('orderChannel.step4.refundProcessSuffix')}{' '}
              {t('orderChannel.step4.refundSupport')}
            </p>
          </div>

          {/* Order ID — matches the flow's box style */}
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

          {/* Actions — Return to Channels (left) & Try Again (right) */}
          <div className="flex items-center justify-between">
            <button
              className="flex items-center gap-2 text-content-secondary hover:text-white transition-colors py-2 px-3 rounded-lg hover:bg-surface-overlay/50 text-sm"
              onClick={() => navigate(CHANNELS_PATH)}
              type="button"
            >
              <SlidersHorizontal size={16} />
              {t('orderChannel.step4.returnToChannels')}
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-[#12131C] hover:bg-primary-emphasis transition-colors"
              onClick={() =>
                onRestart ? onRestart() : navigate(CHANNELS_PATH)
              }
              type="button"
            >
              <RefreshCcw size={18} />
              {t('orderChannel.step4.errorButtonText')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center w-full text-white p-4">
      <div
        className={`${config.bgColor} border ${config.borderColor} rounded-xl shadow-2xl p-10 max-w-md w-full text-center`}
      >
        <div className="flex justify-center">{config.icon}</div>
        <h3 className="text-3xl font-bold mb-4">{config.title}</h3>
        <p className="text-lg text-content-secondary mb-6">{config.message}</p>

        <button
          className={`px-6 py-4 rounded-lg text-lg font-bold ${
            paymentStatus === 'success'
              ? 'bg-primary text-[#12131C] hover:bg-primary-emphasis'
              : paymentStatus === 'error'
                ? 'bg-red-600 hover:bg-red-700'
                : paymentStatus === 'expired'
                  ? 'bg-yellow-600 hover:bg-yellow-700'
                  : 'bg-primary text-[#12131C] hover:bg-primary-emphasis'
          } transition-colors w-full flex items-center justify-center shadow-lg`}
          onClick={config.buttonAction}
        >
          {config.buttonText}
          {paymentStatus === 'success' ? (
            <ArrowRight className="ml-2" size={20} />
          ) : (
            <RefreshCcw className="ml-2" size={20} />
          )}
        </button>
      </div>

      <button
        className="mt-8 flex items-center gap-2 text-content-secondary hover:text-white transition-colors py-2 px-4 rounded-lg hover:bg-surface-overlay/50"
        onClick={() => navigate(CHANNELS_PATH)}
      >
        <Home size={18} />
        {t('orderChannel.step4.returnToChannels')}
      </button>
    </div>
  )
}
