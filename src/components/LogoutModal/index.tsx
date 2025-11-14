import { AlertTriangle, LogOut } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'

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

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-sm border border-gray-700 animate-fade-in">
        {isLoggingOut ? (
          <div className="flex flex-col items-center py-6">
            <div className="w-16 h-16 mb-4">
              <div className="w-full h-full border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {t('logoutModal.loggingOut')}
            </h3>
            <p className="text-gray-400 text-center">
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
            <p className="text-gray-300 text-center mb-6">
              {t('logoutModal.confirmLogoutMessage')}
            </p>
            <div className="flex justify-between space-x-4">
              <button
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors"
                onClick={onClose}
                type="button"
              >
                {t('logoutModal.cancel')}
              </button>
              <button
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors"
                onClick={onConfirm}
                type="button"
              >
                {t('logoutModal.confirmLogout')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export const LogoutButton: React.FC<{ onClick: () => void }> = ({
  onClick,
}) => {
  const { t } = useTranslation()

  return (
    <div
      className="px-4 py-3 flex items-center space-x-3 cursor-pointer hover:bg-blue-darker transition-colors text-red-400"
      onClick={onClick}
    >
      <LogOut className="w-4 h-4" />
      <span className="text-sm font-medium">{t('logoutModal.logout')}</span>
    </div>
  )
}
