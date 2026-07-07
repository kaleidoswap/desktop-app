import {
  X,
  AlertTriangle,
  AlertCircle,
  Loader2,
  ZapOff,
  Handshake,
} from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'

import {
  getModalPortalTarget,
  getModalPositionClass,
} from '../../helpers/modalPortal'
import { nodeApi, NodeApiError } from '../../slices/nodeApi/nodeApi.slice'

interface CloseChannelModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  channelId: string
  peerPubkey: string
}

export const CloseChannelModal: React.FC<CloseChannelModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  channelId,
  peerPubkey,
}) => {
  const { t } = useTranslation()
  const [closeChannel] = nodeApi.useCloseChannelMutation()
  const [forceClose, setForceClose] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestForceClose, setSuggestForceClose] = useState(false)

  if (!isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isClosing) {
      onClose()
    }
  }

  const handleConfirm = async () => {
    setIsClosing(true)
    setError(null)
    setSuggestForceClose(false)

    try {
      const response = await closeChannel({
        channel_id: channelId,
        force: forceClose,
        peer_pubkey: peerPubkey,
      })

      if (response.error) {
        const isNodeApiError = (err: any): err is NodeApiError =>
          err && typeof err === 'object' && 'data' in err

        const nodeError = isNodeApiError(response.error) ? response.error : null
        const errorMessage = nodeError?.data?.error || 'Unknown error'

        setError(errorMessage)
        handleErrorMessage(errorMessage)
        return
      }

      toast.success(
        t('closeChannelModal.successMessage', {
          channelId: channelId.substring(0, 8),
          forceClose: forceClose ? '(force)' : '',
        })
      )

      if (onSuccess) {
        onSuccess()
      }

      onClose()
    } catch (error: any) {
      console.error('Error closing channel:', error)

      const errorMessage = error?.data?.error || 'Unknown error'
      setError(errorMessage)

      handleErrorMessage(errorMessage)
    } finally {
      setIsClosing(false)
    }
  }

  const handleErrorMessage = (errorMessage: string) => {
    const forceClosePatterns = [
      'force-close instead',
      'peer is disconnected',
      'waiting on a monitor update',
      'Cannot begin shutdown',
      'Channel unavailable',
      'maybe force-close instead',
    ]

    const shouldSuggestForceClose = forceClosePatterns.some((pattern) =>
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    )

    if (shouldSuggestForceClose) {
      setSuggestForceClose(true)
      setForceClose(true)
    } else {
      toast.error(t('closeChannelModal.errorMessage', { error: errorMessage }))
    }
  }

  const resetAndClose = () => {
    setError(null)
    setSuggestForceClose(false)
    onClose()
  }

  const pos = getModalPositionClass()

  return createPortal(
    <div
      className={`${pos} inset-0 bg-surface-base/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 pointer-events-auto`}
      onMouseDown={handleBackdropClick}
    >
      <div className="w-full max-w-lg bg-surface-base rounded-3xl border border-border-subtle/50 shadow-2xl shadow-black/20 overflow-hidden">
        <div className="max-h-[90vh] overflow-y-scroll px-8 py-8">
          {/* Header */}
          <div className="flex items-center gap-3 pb-4 border-b border-divider/10 mb-6">
            <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0" />
            <h3 className="text-xl font-bold text-white flex-1">
              {t('closeChannelModal.title')}
            </h3>
            <button
              className="text-content-secondary hover:text-white p-1.5 rounded-lg hover:bg-surface-high/60 transition-colors"
              disabled={isClosing}
              onClick={(e) => {
                e.stopPropagation()
                resetAndClose()
              }}
              type="button"
            >
              <X size={18} />
            </button>
          </div>

          {suggestForceClose ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-amber-400">
                    {t('closeChannelModal.cannotCloseCooperatively')}
                  </p>
                  <p className="text-xs text-amber-200/80">{error}</p>
                </div>
              </div>
              <p className="text-sm text-content-secondary">
                {t('closeChannelModal.forceCloseQuestion')}
              </p>
              <ul className="text-xs text-content-secondary space-y-1.5 list-disc pl-5">
                <li>{t('closeChannelModal.forceCloseReason1')}</li>
                <li>{t('closeChannelModal.forceCloseReason2')}</li>
                <li>{t('closeChannelModal.forceCloseReason3')}</li>
              </ul>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <p className="text-sm text-content-secondary">
                  {t('closeChannelModal.confirmMessage')}
                </p>
                <p className="text-xs text-content-secondary">
                  {t('closeChannelModal.settleMessage')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Cooperative Closing card */}
                <button
                  className={`flex flex-col gap-2.5 p-4 rounded-xl border text-left transition-colors disabled:opacity-50 ${
                    !forceClose
                      ? 'bg-status-success/10 border-status-success/40'
                      : 'bg-surface-overlay/50 border-border-default/60 hover:border-border-default'
                  }`}
                  disabled={isClosing}
                  onClick={() => setForceClose(false)}
                  type="button"
                >
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-status-success/20 text-status-success rounded-full border border-status-success/30 w-fit">
                    {t('closeChannelModal.recommendedLabel')}
                  </span>
                  <span
                    className={`text-sm font-semibold transition-colors ${!forceClose ? 'text-status-success' : 'text-white'}`}
                  >
                    {t('closeChannelModal.cooperativeClose')}
                  </span>
                  <p
                    className={`text-xs leading-relaxed transition-colors ${!forceClose ? 'text-white/80' : 'text-content-secondary'}`}
                  >
                    {t('closeChannelModal.cooperativeCloseInfo')}
                  </p>
                </button>

                {/* Forced Closing card */}
                <button
                  className={`flex flex-col gap-2.5 p-4 rounded-xl border text-left transition-colors disabled:opacity-50 ${
                    forceClose
                      ? 'bg-red-500/10 border-red-500/40'
                      : 'bg-surface-overlay/50 border-border-default/60 hover:border-border-default'
                  }`}
                  disabled={isClosing}
                  onClick={() => setForceClose(true)}
                  type="button"
                >
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-red-500/15 text-red-300 rounded-full border border-red-500/25 w-fit">
                    {t('closeChannelModal.useCautionLabel')}
                  </span>
                  <span
                    className={`text-sm font-semibold transition-colors ${forceClose ? 'text-red-400' : 'text-white'}`}
                  >
                    {t('closeChannelModal.forcedClose')}
                  </span>
                  <p
                    className={`text-xs leading-relaxed transition-colors ${forceClose ? 'text-white/80' : 'text-content-secondary'}`}
                  >
                    {t('closeChannelModal.forceCloseWarning')}
                  </p>
                </button>
              </div>
            </div>
          )}

          {error && !suggestForceClose && (
            <div className="mt-5 flex items-start gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          {isClosing && (
            <div className="mt-5 flex items-center justify-center gap-3 py-2">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              <p className="text-sm text-content-secondary">
                {t('closeChannelModal.closingMessage')}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="pt-6 mt-2">
            <button
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed
                ${
                  suggestForceClose
                    ? 'bg-gradient-to-r from-amber-500 to-red-500 hover:from-amber-600 hover:to-red-600 text-white'
                    : forceClose
                      ? 'bg-red-600/80 hover:bg-red-600 text-white'
                      : 'bg-[#15E99A] hover:bg-[#12C97E] text-gray-900'
                }`}
              disabled={isClosing}
              onClick={(e) => {
                e.stopPropagation()
                handleConfirm()
              }}
              type="button"
            >
              {isClosing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : suggestForceClose || forceClose ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <Handshake className="w-4 h-4" />
              )}
              {isClosing
                ? t('closeChannelModal.processing')
                : suggestForceClose
                  ? t('closeChannelModal.forceCloseChannel')
                  : forceClose
                    ? t('closeChannelModal.forceClose')
                    : t('closeChannelModal.closeChannel')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    getModalPortalTarget()
  )
}
