import { useState } from 'react'
import {
  KeyRound,
  X,
  Eye,
  EyeOff,
  CheckCircle2,
  Save,
  AlertTriangle,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { invoke } from '@tauri-apps/api/core'

import {
  getModalPortalTarget,
  getModalPositionClass,
} from '../../helpers/modalPortal'

interface ChangePasswordModalProps {
  showModal: boolean
  accountName: string
  onClose: () => void
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  showModal,
  accountName,
  onClose,
}) => {
  const { t } = useTranslation()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [seedPhrase, setSeedPhrase] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  // true when the account has no encrypted mnemonic stored in the DB
  const [needsSeedPhrase, setNeedsSeedPhrase] = useState(false)

  if (!showModal) return null

  const handleClose = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setSeedPhrase('')
    setError(null)
    setSuccess(false)
    setNeedsSeedPhrase(false)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword !== confirmPassword) {
      setError(t('changePassword.errorMismatch', 'New passwords do not match.'))
      return
    }
    if (newPassword.length < 8) {
      setError(
        t(
          'changePassword.errorTooShort',
          'New password must be at least 8 characters.'
        )
      )
      return
    }
    if (newPassword === currentPassword) {
      setError(
        t(
          'changePassword.errorSame',
          'New password must be different from the current one.'
        )
      )
      return
    }

    setIsLoading(true)

    let mnemonic: string

    if (needsSeedPhrase) {
      // User provided seed phrase manually — validate basic word count
      const words = seedPhrase.trim().split(/\s+/)
      if (words.length !== 12 && words.length !== 24) {
        setError(
          t(
            'changePassword.errorInvalidSeed',
            'Please enter a valid 12 or 24-word recovery phrase.'
          )
        )
        setIsLoading(false)
        return
      }
      mnemonic = words.join(' ')
    } else {
      // Try to decrypt from DB
      try {
        mnemonic = await invoke<string>('get_decrypted_mnemonic', {
          password: currentPassword,
        })
      } catch (err) {
        const msg = String(err)
        if (msg.includes('No mnemonic stored')) {
          // Switch to seed-phrase input mode
          setNeedsSeedPhrase(true)
          setError(null)
          setIsLoading(false)
          return
        }
        setError(
          t(
            'changePassword.errorWrongPassword',
            'Current password is incorrect.'
          )
        )
        setIsLoading(false)
        return
      }
    }

    try {
      await invoke('store_encrypted_mnemonic', {
        accountName,
        mnemonic,
        password: newPassword,
      })
      setSuccess(true)
    } catch (err) {
      setError(String(err))
    } finally {
      setIsLoading(false)
    }
  }

  const pos = getModalPositionClass()

  const passwordInput = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    show: boolean,
    setShow: (v: boolean) => void,
    autoComplete: string
  ) => (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-content-secondary uppercase tracking-wider">
        {label}
      </label>
      <div className="relative">
        <input
          autoComplete={autoComplete}
          className="w-full rounded-lg border border-border-default/50 bg-surface-overlay/40 px-3 py-2.5 pr-10 text-sm text-white placeholder:text-content-tertiary focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          type={show ? 'text' : 'password'}
          value={value}
        />
        <button
          className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary hover:text-content-secondary transition-colors"
          onClick={() => setShow(!show)}
          type="button"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )

  return createPortal(
    <div
      className={`${pos} inset-0 bg-surface-base/80 backdrop-blur-sm flex items-center justify-center z-50 p-4`}
      onMouseDown={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="w-full max-w-lg bg-surface-base rounded-3xl border border-border-subtle/50 shadow-2xl shadow-black/20 overflow-hidden relative">
        <div className="max-h-[85vh] overflow-y-auto px-8 py-8">
          {/* Header */}
          <div className="flex items-center gap-3 pb-4 border-b border-divider/10 mb-6">
            <KeyRound className="w-6 h-6 text-primary" />
            <h3 className="text-xl font-bold text-white flex-1">
              {t('changePassword.title', 'Change Password')}
            </h3>
            <button
              className="p-1.5 rounded-md text-content-secondary hover:text-white hover:bg-surface-overlay/50 transition-colors"
              onClick={handleClose}
              type="button"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {success ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-status-success/10 border border-status-success/20 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-status-success" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold text-white">
                  {t('changePassword.successTitle', 'Password updated')}
                </p>
                <p className="text-sm text-content-secondary">
                  {t(
                    'changePassword.successDescription',
                    'Your wallet password has been changed successfully.'
                  )}
                </p>
              </div>
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary hover:bg-primary-emphasis px-6 text-sm font-semibold text-[#12131C] transition-colors"
                onClick={handleClose}
                type="button"
              >
                {t('common.close', 'Close')}
              </button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              {needsSeedPhrase ? (
                <>
                  {/* Seed phrase fallback notice */}
                  <div className="flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-200 leading-relaxed">
                      {t(
                        'changePassword.seedFallbackNotice',
                        'Your recovery phrase is not stored in this device. Enter it below to enable password management.'
                      )}
                    </p>
                  </div>

                  {/* Seed phrase input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-content-secondary uppercase tracking-wider">
                      {t('changePassword.seedPhrase', 'Recovery phrase')}
                    </label>
                    <textarea
                      autoComplete="off"
                      className="w-full rounded-lg border border-border-default/50 bg-surface-overlay/40 px-3 py-2.5 text-sm text-white placeholder:text-content-tertiary focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors resize-none"
                      onChange={(e) => setSeedPhrase(e.target.value)}
                      placeholder={t(
                        'changePassword.seedPhrasePlaceholder',
                        'word1 word2 word3 …'
                      )}
                      rows={3}
                      value={seedPhrase}
                    />
                  </div>

                  {passwordInput(
                    t('changePassword.newPassword', 'New password'),
                    newPassword,
                    setNewPassword,
                    showNew,
                    setShowNew,
                    'new-password'
                  )}
                  {passwordInput(
                    t('changePassword.confirmPassword', 'Confirm new password'),
                    confirmPassword,
                    setConfirmPassword,
                    showConfirm,
                    setShowConfirm,
                    'new-password'
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-content-secondary leading-relaxed">
                    {t(
                      'changePassword.description',
                      'Enter your current password, then choose a new one. Your wallet mnemonic will be re-encrypted with the new password.'
                    )}
                  </p>

                  {passwordInput(
                    t('changePassword.currentPassword', 'Current password'),
                    currentPassword,
                    setCurrentPassword,
                    showCurrent,
                    setShowCurrent,
                    'current-password'
                  )}
                  {passwordInput(
                    t('changePassword.newPassword', 'New password'),
                    newPassword,
                    setNewPassword,
                    showNew,
                    setShowNew,
                    'new-password'
                  )}
                  {passwordInput(
                    t('changePassword.confirmPassword', 'Confirm new password'),
                    confirmPassword,
                    setConfirmPassword,
                    showConfirm,
                    setShowConfirm,
                    'new-password'
                  )}
                </>
              )}

              {/* Error */}
              {error && (
                <p className="text-sm text-status-danger leading-relaxed">
                  {error}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  className="flex items-center gap-1.5 px-4 py-2.5 text-content-secondary hover:text-content-primary transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading}
                  onClick={handleClose}
                  type="button"
                >
                  <X className="w-4 h-4" />
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#15E99A] hover:bg-[#12C97E] text-gray-900 rounded-md font-semibold transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={
                    isLoading ||
                    (!needsSeedPhrase &&
                      (!currentPassword || !newPassword || !confirmPassword)) ||
                    (needsSeedPhrase &&
                      (!seedPhrase || !newPassword || !confirmPassword))
                  }
                  type="submit"
                >
                  <Save className="w-4 h-4" />
                  {isLoading
                    ? t('changePassword.updating', 'Updating…')
                    : t('changePassword.confirm', 'Update Password')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    getModalPortalTarget()
  )
}
