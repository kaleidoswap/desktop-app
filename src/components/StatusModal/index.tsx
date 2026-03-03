import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { useEffect } from 'react'

export const ModalType = {
  ERROR: 'error',
  NONE: 'none',
  SUCCESS: 'success',
  WARNING: 'warning',
} as const

export type ModalTypeValue = (typeof ModalType)[keyof typeof ModalType]

export interface StatusModalProps {
  type: ModalTypeValue
  title: string
  message: string
  details?: string
  onClose: () => void
  autoClose?: boolean
  autoCloseDelay?: number
  isOpen: boolean
}

export const StatusModal: React.FC<StatusModalProps> = ({
  type,
  title,
  message,
  details = '',
  onClose,
  autoClose = false,
  autoCloseDelay = 3000,
  isOpen,
}) => {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    if (autoClose && isOpen) {
      timer = setTimeout(() => {
        onClose()
      }, autoCloseDelay)
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [autoClose, isOpen, onClose, autoCloseDelay])

  if (!isOpen) return null

  // Define icon and colors based on modal type
  const getModalConfig = () => {
    switch (type) {
      case ModalType.SUCCESS:
        return {
          bgColor: 'bg-green-900/20',
          borderColor: 'border-green-600/30',
          buttonColor: 'bg-green-600 hover:bg-green-700',
          icon: <CheckCircle2 className="h-8 w-8 text-green-400" />,
        }
      case ModalType.ERROR:
        return {
          bgColor: 'bg-red-900/20',
          borderColor: 'border-red-600/30',
          buttonColor: 'bg-red-600 hover:bg-red-700',
          icon: <XCircle className="h-8 w-8 text-red-400" />,
        }
      case ModalType.WARNING:
        return {
          bgColor: 'bg-yellow-900/20',
          borderColor: 'border-yellow-600/30',
          buttonColor: 'bg-yellow-600 hover:bg-yellow-700',
          icon: <AlertTriangle className="h-8 w-8 text-yellow-400" />,
        }
      default:
        return {
          bgColor: 'bg-blue-900/20',
          borderColor: 'border-blue-600/30',
          buttonColor: 'bg-primary hover:bg-primary-emphasis',
          icon: <CheckCircle2 className="h-8 w-8 text-blue-400" />,
        }
    }
  }

  const config = getModalConfig()

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className={`max-w-md w-full rounded-xl shadow-2xl ${config.bgColor} border ${config.borderColor} p-6 transform transition-all duration-300 ease-in-out animate-fade-in`}
      >
        <div className="flex items-start">
          <div className="flex-shrink-0 mr-4">{config.icon}</div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
            <p className="text-content-secondary mb-3">{message}</p>

            {details && (
              <div className="mt-3 mb-4">
                <div className="bg-black/30 rounded-lg p-3 max-h-48 overflow-y-auto text-sm text-content-secondary font-mono border border-border-default">
                  <p className="whitespace-pre-wrap break-words">{details}</p>
                </div>
              </div>
            )}

            <div className="flex justify-end mt-4">
              <button
                className={`px-4 py-2 rounded-lg ${config.buttonColor} text-white font-medium transition-colors duration-200`}
                onClick={onClose}
              >
                {type === ModalType.SUCCESS ? 'Continue' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
