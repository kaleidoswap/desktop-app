import { CheckCircle, XCircle, Clock, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface StatusScreenProps {
  status: 'success' | 'error' | 'expired'
  orderId?: string | null
  onClose: () => void
  onRetry: () => void
}

export const StatusScreen: React.FC<StatusScreenProps> = ({
  status,
  orderId,
  onClose,
  onRetry,
}) => {
  const { t } = useTranslation()
  const config = {
    error: {
      actions: (
        <div className="flex gap-3">
          <button
            className="px-6 py-3 bg-surface-high hover:bg-surface-elevated text-white rounded-xl font-medium transition-colors"
            onClick={onClose}
          >
            {t('components.buyChannelModal.statusClose')}
          </button>
          <button
            className="px-6 py-3 bg-primary hover:bg-primary-emphasis text-[#12131C] rounded-xl font-medium transition-colors"
            onClick={onRetry}
          >
            {t('components.buyChannelModal.statusTryAgain')}
          </button>
        </div>
      ),
      bgColor: 'bg-red-500/20',
      details: (
        <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-200/80">
              <p>{t('components.buyChannelModal.statusErrorHelp')}</p>
            </div>
          </div>
        </div>
      ),
      icon: <XCircle className="w-12 h-12 text-red-400" />,
      message: t('components.buyChannelModal.statusErrorMessage'),
      title: t('components.buyChannelModal.statusErrorTitle'),
    },
    expired: {
      actions: (
        <div className="flex gap-3">
          <button
            className="px-6 py-3 bg-surface-high hover:bg-surface-elevated text-white rounded-xl font-medium transition-colors"
            onClick={onClose}
          >
            {t('components.buyChannelModal.statusClose')}
          </button>
          <button
            className="px-6 py-3 bg-primary hover:bg-primary-emphasis text-[#12131C] rounded-xl font-medium transition-colors"
            onClick={onRetry}
          >
            {t('components.buyChannelModal.statusCreateNewOrder')}
          </button>
        </div>
      ),
      bgColor: 'bg-yellow-500/20',
      details: (
        <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-200/80">
              <p>{t('components.buyChannelModal.noFundsDeducted')}</p>
            </div>
          </div>
        </div>
      ),
      icon: <Clock className="w-12 h-12 text-yellow-400" />,
      message: t('components.buyChannelModal.statusExpiredMessage'),
      title: t('components.buyChannelModal.statusExpiredTitle'),
    },
    success: {
      actions: (
        <button
          className="px-8 py-3 bg-primary hover:bg-primary-emphasis text-[#12131C] rounded-xl font-medium transition-colors"
          onClick={onClose}
        >
          {t('components.buyChannelModal.statusGotIt')}
        </button>
      ),
      bgColor: 'bg-green-500/20',
      details: (
        <div className="bg-blue-900/30 border border-blue-700/40 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <Clock className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-200/80">
              <p className="font-semibold text-blue-200 mb-1">
                {t('components.buyChannelModal.statusConfirmationTitle')}
              </p>
              <p>{t('components.buyChannelModal.statusConfirmationMessage')}</p>
            </div>
          </div>
        </div>
      ),
      icon: <CheckCircle className="w-12 h-12 text-green-400" />,
      message: t('components.buyChannelModal.statusSuccessMessage'),
      title: t('components.buyChannelModal.statusSuccessTitle'),
    },
  }

  const current = config[status]

  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-6">
      <div
        className={`w-20 h-20 ${current.bgColor} rounded-full flex items-center justify-center ${status === 'success' ? 'animate-pulse' : ''}`}
      >
        {current.icon}
      </div>

      <div className="text-center space-y-2">
        <h3 className="text-2xl font-bold text-white">{current.title}</h3>
        <p className="text-content-secondary max-w-md">{current.message}</p>
      </div>

      {current.details}

      {orderId && (
        <div className="bg-surface-overlay/30 rounded-lg p-3 border border-border-default/30">
          <p className="text-xs text-content-secondary text-center">
            {t('components.buyChannelModal.orderIdLabel')}:{' '}
            <span className="text-content-secondary font-mono">{orderId}</span>
          </p>
        </div>
      )}

      {current.actions}
    </div>
  )
}
