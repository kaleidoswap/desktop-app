import { openUrl } from '@tauri-apps/plugin-opener'
import { Info, AlertTriangle, CheckCircle, XCircle, X } from 'lucide-react'
import React, { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export type AlertVariant = 'info' | 'warning' | 'success' | 'error'

interface AlertProps {
  children: ReactNode
  variant?: AlertVariant
  title?: string
  icon?: ReactNode
  className?: string
  dismissible?: boolean
  onDismiss?: () => void
}

/**
 * Alert component for notifications, warnings, and errors
 */
export const Alert: React.FC<AlertProps> = ({
  children,
  variant = 'info',
  title,
  icon,
  className = '',
  dismissible = false,
  onDismiss,
}) => {
  const variantStyles = {
    error: 'bg-red/10 border-red/20 text-red',
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    success: 'bg-green-500/10 border-green-500/20 text-green-400',
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  }

  const defaultIcons = {
    error: <XCircle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />,
    success: <CheckCircle className="w-5 h-5" />,
    warning: <AlertTriangle className="w-5 h-5" />,
  }

  const iconToRender = icon || defaultIcons[variant]

  return (
    <div
      className={`rounded-xl border p-4 flex items-start gap-3 ${variantStyles[variant]} ${className}`}
    >
      <div
        className={`p-2 bg-${getIconBgColor(variant)} rounded-lg flex-shrink-0`}
      >
        {iconToRender}
      </div>

      <div className="flex-1">
        {title && <h4 className="font-medium mb-1">{title}</h4>}
        <div className={title ? 'text-sm opacity-80' : ''}>{children}</div>
      </div>

      {dismissible && (
        <button
          className="p-1 hover:bg-surface-high/30 rounded-lg transition-colors"
          onClick={onDismiss}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

/**
 * Network warning alert specifically for testnet warnings
 */
export const NetworkWarningAlert: React.FC<{
  network: string
  faucetUrl?: string
}> = ({ network, faucetUrl }) => {
  const { t } = useTranslation()

  return (
    <Alert title={t('components.alert.testNetworkWarning')} variant="warning">
      <p>
        {t('components.alert.testNetworkMessage', { network })}
        {faucetUrl && (
          <>
            {' '}
            <br />
            {t('components.alert.requestTestCoins')}{' '}
            <button
              className="text-blue-400 hover:text-blue-300 underline"
              onClick={() => {
                openUrl(faucetUrl)
              }}
            >
              {t('components.alert.faucetLink', { network })}
            </button>
            .
          </>
        )}
      </p>
    </Alert>
  )
}

// Helper function to get icon background color
const getIconBgColor = (variant: AlertVariant): string => {
  switch (variant) {
    case 'info':
      return 'blue-500/20'
    case 'warning':
      return 'amber-500/20'
    case 'success':
      return 'green-500/20'
    case 'error':
      return 'red/20'
    default:
      return 'blue-500/20'
  }
}
