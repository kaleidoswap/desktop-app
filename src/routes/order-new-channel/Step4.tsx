import {
  CheckCircle,
  XCircle,
  ArrowRight,
  RefreshCcw,
  Home,
  AlertCircle,
  Copy,
  Clock,
} from 'lucide-react'
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { CHANNELS_PATH } from '../../app/router/paths'

export const Step4 = ({
  paymentStatus,
  orderId,
  onRestart,
}: {
  paymentStatus: 'success' | 'error' | 'expired' | null | string
  orderId?: string
  onRestart?: () => void
}) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { copied, copy } = useCopyToClipboard()

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
      buttonAction: () => navigate(CHANNELS_PATH),
      buttonText: t('orderChannel.step4.successButtonText'),
      icon: <CheckCircle className="text-green-500 mb-6" size={80} />,
      message: t('orderChannel.step4.successMessage'),
      title: t('orderChannel.step4.successTitle'),
    },
  }

  const config = statusConfig[paymentStatus as keyof typeof statusConfig]

  return (
    <div className="flex flex-col items-center justify-center w-full text-white p-4">
      <div
        className={`${config.bgColor} border ${config.borderColor} rounded-xl shadow-2xl p-10 max-w-md w-full text-center`}
      >
        <div className="flex justify-center">{config.icon}</div>
        <h3 className="text-3xl font-bold mb-4">{config.title}</h3>
        <p className="text-lg text-content-secondary mb-6">{config.message}</p>

        {paymentStatus === 'success' && (
          <div className="flex items-center justify-center space-x-3 mb-8 p-3 bg-green-500/20 rounded-lg">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <p className="text-green-400 font-medium">
              {t('orderChannel.step4.channelProgress')}
            </p>
          </div>
        )}

        {paymentStatus === 'error' && (
          <>
            <div className="mb-6 p-4 bg-amber-500/20 border border-amber-500/30 rounded-lg text-left">
              <div className="flex items-start">
                <AlertCircle
                  className="text-amber-500 mr-3 mt-1 flex-shrink-0"
                  size={20}
                />
                <div>
                  <p className="text-amber-200 font-medium mb-2">
                    {t('orderChannel.step4.refundHeader')}
                  </p>
                  <p className="text-content-secondary text-sm mb-2">
                    <strong>{t('orderChannel.step4.refundProcess')}</strong>{' '}
                    {t('orderChannel.step4.refundProcessSuffix')}
                  </p>
                  <p className="text-content-secondary text-sm">
                    {t('orderChannel.step4.refundSupport')}
                  </p>
                </div>
              </div>
            </div>

            {/* Order ID Display - Only shown on failure */}
            {orderId && (
              <div className="mb-8 p-4 bg-surface-high/50 border border-border-default rounded-lg">
                <div className="flex flex-col items-center">
                  <p className="text-content-secondary text-sm mb-2">
                    {t('orderChannel.step4.orderIdLabel')}
                  </p>
                  <div className="flex items-center justify-center w-full bg-surface-overlay p-3 rounded-md mb-2">
                    <code className="text-sm font-mono text-white break-all">
                      {orderId}
                    </code>
                    <button
                      className="ml-2 p-1 hover:bg-surface-high rounded transition-colors"
                      onClick={copyToClipboard}
                      title={t('orderChannel.step4.copyToClipboard')}
                    >
                      {copied ? (
                        <CheckCircle className="text-green-400" size={16} />
                      ) : (
                        <Copy
                          className="text-content-secondary hover:text-white"
                          size={16}
                        />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-content-secondary">
                    {t('orderChannel.step4.orderIdHelp')}
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {paymentStatus === 'expired' && (
          <div className="mb-6 p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-left">
            <div className="flex items-start">
              <AlertCircle
                className="text-yellow-500 mr-3 mt-1 flex-shrink-0"
                size={20}
              />
              <div>
                <p className="text-yellow-200 font-medium mb-2">
                  {t('orderChannel.step4.expiredSectionTitle')}
                </p>
                <p className="text-content-secondary text-sm">
                  {t('orderChannel.step4.expiredSectionMessage')}
                </p>
              </div>
            </div>
          </div>
        )}

        <button
          className={`px-6 py-4 rounded-lg text-lg font-bold ${
            paymentStatus === 'success'
              ? 'bg-green-700 hover:bg-green-800'
              : paymentStatus === 'error'
                ? 'bg-red-600 hover:bg-red-700'
                : paymentStatus === 'expired'
                  ? 'bg-yellow-600 hover:bg-yellow-700'
                  : 'bg-primary hover:bg-primary-emphasis'
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
