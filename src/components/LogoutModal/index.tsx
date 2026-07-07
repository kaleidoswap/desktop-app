import { AlertTriangle, LogOut } from 'lucide-react'
import React from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import {
  getModalPortalTarget,
  getModalPositionClass,
} from '../../helpers/modalPortal'

interface LogoutModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isLoggingOut?: boolean
}

export const LogoutModal: React.FC<LogoutModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoggingOut = false,
}) => {
  const { t } = useTranslation()

  if (!isOpen) return null

  const pos = getModalPositionClass()
  return createPortal(
    <div
      className={`${pos} inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4`}
      onClick={onClose}
    >
      <div
        className="bg-surface-overlay p-6 rounded-xl shadow-2xl w-full max-w-sm border border-border-default animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoggingOut ? (
          <div className="flex flex-col items-center py-6">
            <div className="w-16 h-16 mb-4">
              <div className="w-full h-full border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {t('logoutModal.loggingOut')}
            </h3>
            <p className="text-content-secondary text-center">
              {t('logoutModal.loggingOutMessage')}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center text-yellow-500 mb-4">
              <AlertTriangle size={48} />
            </div>
            <h2 className="text-2xl font-bold mb-4 text-center text-white">
              {t('logoutModal.confirmLogoutTitle')}
            </h2>
            <p className="text-content-secondary text-center mb-6">
              {t('logoutModal.confirmLogoutMessage')}
            </p>
            <div className="flex justify-between space-x-4">
              <button
                className="flex-1 px-4 py-2 bg-surface-elevated text-white rounded-lg hover:bg-surface-high focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors"
                onClick={onClose}
                type="button"
              >
                {t('logoutModal.cancel')}
              </button>
              <button
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-emphasis focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-overlay transition-colors"
                onClick={onConfirm}
                type="button"
              >
                {t('logoutModal.confirmLogout')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    getModalPortalTarget()
  )
}

export const LogoutButton: React.FC<{ onClick: () => void }> = ({
  onClick,
}) => {
  const { t } = useTranslation()

  return (
    <button
      className="w-full px-4 py-3 flex items-center gap-3 bg-transparent hover:bg-surface-high/50 text-red-400 rounded-md transition-colors text-sm font-medium"
      onClick={onClick}
      type="button"
    >
      <LogOut className="w-4 h-4" />
      {t('logoutModal.logout')}
    </button>
  )
}
