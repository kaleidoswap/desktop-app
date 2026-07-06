import { invoke } from '@tauri-apps/api/core'
import {
  Eye,
  EyeOff,
  Lock,
  AlertTriangle,
  Copy,
  CheckCircle,
  X,
  KeyRound,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'

import { getModalPortalTarget } from '../helpers/modalPortal'

interface MnemonicViewerModalProps {
  isOpen: boolean
  onClose: () => void
}

export const MnemonicViewerModal: React.FC<MnemonicViewerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation()
  const [step, setStep] = useState<'password' | 'display'>('password')
  const [password, setPassword] = useState('')
  const [mnemonic, setMnemonic] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setStep('password')
      setPassword('')
      setMnemonic(null)
      setError(null)
      setShowPassword(false)
      setCopied(false)
    }
  }, [isOpen])

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) {
      setError(t('walletUnlock.passwordRequired'))
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const decryptedMnemonic = await invoke<string>('get_decrypted_mnemonic', {
        password,
      })
      setMnemonic(decryptedMnemonic)
      setStep('display')
      toast.success(t('mnemonicViewer.retrievedSuccess'))
    } catch (err) {
      setError(
        err instanceof Error
          ? err.toString()
          : t('mnemonicViewer.incorrectPassword')
      )
      toast.error(t('mnemonicViewer.decryptFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!mnemonic) return
    try {
      await navigator.clipboard.writeText(mnemonic)
      setCopied(true)
      toast.success(t('walletInit.mnemonicStep.mnemonicCopied'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('mnemonicViewer.copyFailed'))
    }
  }

  if (!isOpen) return null

  const mnemonicWords = mnemonic ? mnemonic.split(' ') : []

  return createPortal(
    <div
      className="fixed inset-0 bg-surface-base/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-surface-base rounded-3xl border border-border-subtle/50 shadow-2xl shadow-black/20 overflow-hidden">
        <div className="max-h-[90vh] overflow-y-auto px-8 py-8">
          {/* Header */}
          <div className="flex items-center gap-3 pb-4 border-b border-divider/10 mb-6">
            <KeyRound className="w-6 h-6 text-primary" />
            <h3 className="text-xl font-bold text-white flex-1">
              {step === 'password'
                ? t('mnemonicViewer.unlockTitle')
                : t('mnemonicViewer.displayTitle')}
            </h3>
            <button
              className="text-content-secondary hover:text-white p-1.5 rounded-lg hover:bg-surface-high/60 transition-colors"
              onClick={onClose}
              type="button"
            >
              <X size={18} />
            </button>
          </div>

          {step === 'password' ? (
            <form className="space-y-5" onSubmit={handlePasswordSubmit}>
              {/* Security notice */}
              <div className="flex items-start gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-200/80 leading-relaxed">
                  {t('mnemonicViewer.securityNoticeDescription')}
                </p>
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
                  {t('walletUnlock.walletPassword')}
                </label>
                <div className="flex items-center bg-surface-overlay/50 rounded-xl border border-border-default focus-within:border-primary/60 transition-colors">
                  <Lock className="w-4 h-4 text-content-tertiary ml-3 flex-shrink-0" />
                  <input
                    autoFocus
                    className="flex-1 min-w-0 px-3 py-2.5 bg-transparent focus:outline-none text-white placeholder:text-content-tertiary text-sm"
                    disabled={isLoading}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setError(null)
                    }}
                    placeholder={t('walletUnlock.passwordPlaceholder')}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                  />
                  <button
                    className="px-3 text-content-secondary hover:text-white transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                    type="button"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {error && (
                  <p className="text-xs text-status-danger flex items-center gap-1.5 pt-0.5">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    {error}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  className="flex items-center gap-1.5 px-4 py-2.5 text-content-secondary hover:text-content-primary transition-colors text-sm font-medium"
                  disabled={isLoading}
                  onClick={onClose}
                  type="button"
                >
                  <X className="w-4 h-4" />
                  {t('common.cancel')}
                </button>
                <button
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#15E99A] hover:bg-[#12C97E] text-gray-900 rounded-xl font-semibold transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={isLoading || !password}
                  type="submit"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                  {isLoading
                    ? t('mnemonicViewer.decrypting')
                    : t('mnemonicViewer.viewButton')}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-5">
              {/* Warning */}
              <div className="flex items-start gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-amber-400">
                    {t('mnemonicViewer.warningTitle')}
                  </p>
                  <ul className="text-xs text-amber-200/80 space-y-0.5 list-disc list-inside leading-relaxed">
                    <li>{t('mnemonicViewer.warningNeverShare')}</li>
                    <li>{t('mnemonicViewer.warningStoreSecurely')}</li>
                    <li>{t('mnemonicViewer.warningScreenPrivacy')}</li>
                  </ul>
                </div>
              </div>

              {/* Mnemonic grid */}
              <div className="bg-surface-overlay/50 rounded-xl border border-border-default/60 p-4">
                <p className="text-[10px] font-semibold text-content-tertiary uppercase tracking-widest mb-3">
                  {t('mnemonicViewer.recoveryPhraseHeading')}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {mnemonicWords.map((word, index) => (
                    <div
                      className="bg-surface-base border border-border-default rounded-lg px-3 py-2 flex items-center gap-2"
                      key={index}
                    >
                      <span className="text-[10px] text-content-tertiary font-mono font-bold min-w-[16px] tabular-nums">
                        {index + 1}.
                      </span>
                      <span className="text-sm text-white font-mono font-medium">
                        {word}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-1">
                <button
                  className="flex items-center gap-1.5 px-4 py-2.5 text-content-secondary hover:text-content-primary transition-colors text-sm font-medium"
                  onClick={onClose}
                  type="button"
                >
                  <EyeOff className="w-4 h-4" />
                  {t('mnemonicViewer.closeButton')}
                </button>
                <button
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#15E99A] hover:bg-[#12C97E] text-gray-900 rounded-xl font-semibold transition-colors text-sm"
                  onClick={handleCopy}
                  type="button"
                >
                  {copied ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  {copied
                    ? t('mnemonicViewer.copySuccessButton')
                    : t('mnemonicViewer.copyButton')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    getModalPortalTarget()
  )
}
