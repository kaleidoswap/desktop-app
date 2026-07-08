import { invoke } from '@tauri-apps/api/core'
import {
  KeyRound,
  X,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Lock,
} from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { WALLET_UNLOCK_PATH } from '../../app/router/paths'
import {
  getModalPortalTarget,
  getModalPositionClass,
} from '../../helpers/modalPortal'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'

interface ChangePasswordModalProps {
  showModal: boolean
  accountName: string
  onClose: () => void
}

// Outcome of the change flow — determines the final screen. In both terminal
// states the node has been LOCKED (the node's /changepassword requires it), so
// the user must re-unlock; we send them to the standard unlock screen.
type Phase = 'form' | 'changed' | 'locked-unchanged'

const messageOf = (err: unknown, fallback: string): string => {
  const data = (err as { data?: { error?: string } } | undefined)?.data
  if (data?.error) return data.error
  if (err instanceof Error) return err.message
  return fallback
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  showModal,
  accountName,
  onClose,
}) => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [lock] = nodeApi.endpoints.lock.useMutation()
  const [changePassword] = nodeApi.useChangePasswordMutation()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('form')

  if (!showModal) return null

  const reset = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setError(null)
    setProgress(null)
    setPhase('form')
    setIsLoading(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  // Once the node is locked there is no way back to a working session from
  // here — the only safe exit is the unlock screen.
  const goToUnlock = () => {
    reset()
    onClose()
    navigate(WALLET_UNLOCK_PATH)
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

    // 1. Verify the current password locally (and grab the mnemonic so we can
    //    keep the local encrypted copy — used by the recovery-phrase viewer —
    //    in sync). Restored wallets may have no local mnemonic; that's fine,
    //    the node still validates the current password during /changepassword.
    let mnemonic: string | null = null
    try {
      mnemonic = await invoke<string>('get_decrypted_mnemonic', {
        password: currentPassword,
      })
    } catch (err) {
      if (!String(err).includes('No mnemonic stored')) {
        setError(
          t(
            'changePassword.errorWrongPassword',
            'Current password is incorrect.'
          )
        )
        setIsLoading(false)
        return
      }
      // No local mnemonic — proceed without a local copy to re-encrypt.
    }

    // 2. Lock the node — required before /changepassword. If this fails the
    //    node is still unlocked and the session is unharmed.
    setProgress(t('changePassword.progressLocking', 'Locking wallet…'))
    const lockRes = await lock()
    if ('error' in lockRes) {
      setError(
        t('changePassword.errorLock', {
          defaultValue: 'Could not lock the wallet: {{msg}}',
          msg: messageOf(lockRes.error, 'unknown error'),
        })
      )
      setProgress(null)
      setIsLoading(false)
      return
    }

    // 3. Change the password on the node (it re-encrypts the mnemonic file and
    //    re-validates the current password + new-password strength).
    setProgress(t('changePassword.progressUpdating', 'Updating password…'))
    const cpRes = await changePassword({
      new_password: newPassword,
      old_password: currentPassword,
    })
    if ('error' in cpRes) {
      // Node is now locked but the password is UNCHANGED — the user must
      // unlock with their current password.
      setError(messageOf(cpRes.error, t('changePassword.errorGeneric')))
      setPhase('locked-unchanged')
      setProgress(null)
      setIsLoading(false)
      return
    }

    // 4. Best-effort: re-encrypt the local mnemonic copy with the new password
    //    so the recovery-phrase viewer keeps working. The node password has
    //    already changed, so a failure here is non-fatal.
    if (mnemonic) {
      try {
        await invoke('store_encrypted_mnemonic', {
          accountName,
          mnemonic,
          password: newPassword,
        })
      } catch (err) {
        console.error('Failed to re-encrypt local mnemonic copy:', err)
      }
    }

    setPhase('changed')
    setProgress(null)
    setIsLoading(false)
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
          disabled={isLoading}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          type={show ? 'text' : 'password'}
          value={value}
        />
        <button
          className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary hover:text-content-secondary transition-colors"
          onClick={() => setShow(!show)}
          tabIndex={-1}
          type="button"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )

  const renderBody = () => {
    if (phase === 'changed') {
      return (
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
                'Your wallet has been locked. Unlock it with your new password to continue.'
              )}
            </p>
          </div>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary hover:bg-primary-emphasis px-6 text-sm font-semibold text-primary-foreground transition-colors"
            onClick={goToUnlock}
            type="button"
          >
            <Lock className="w-4 h-4" />
            {t('changePassword.unlockNow', 'Unlock now')}
          </button>
        </div>
      )
    }

    if (phase === 'locked-unchanged') {
      return (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-status-danger/10 border border-status-danger/20 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-status-danger" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold text-white">
              {t('changePassword.failedTitle', 'Password not changed')}
            </p>
            <p className="text-sm text-content-secondary">
              {error ||
                t('changePassword.errorGeneric', 'Failed to change password.')}
            </p>
            <p className="text-sm text-content-secondary">
              {t(
                'changePassword.lockedUnchangedHint',
                'Your wallet was locked but the password is unchanged — unlock with your current password.'
              )}
            </p>
          </div>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary hover:bg-primary-emphasis px-6 text-sm font-semibold text-primary-foreground transition-colors"
            onClick={goToUnlock}
            type="button"
          >
            <Lock className="w-4 h-4" />
            {t('changePassword.goToUnlock', 'Go to unlock')}
          </button>
        </div>
      )
    }

    return (
      <form className="space-y-4" onSubmit={handleSubmit}>
        <p className="text-sm text-content-secondary leading-relaxed">
          {t(
            'changePassword.description',
            'Enter your current password and choose a new one. Your wallet will be locked while the password is changed, then you can unlock it with the new password.'
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

        {error && (
          <p className="text-sm text-status-danger leading-relaxed">{error}</p>
        )}

        <div className="pt-2">
          <button
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-emphasis text-primary-foreground rounded-md font-semibold transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={
              isLoading || !currentPassword || !newPassword || !confirmPassword
            }
            type="submit"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <KeyRound className="w-4 h-4" />
            )}
            {isLoading
              ? progress || t('changePassword.updating', 'Updating…')
              : t('changePassword.confirm', 'Update Password')}
          </button>
        </div>
      </form>
    )
  }

  const dismissable = phase === 'form' && !isLoading

  return createPortal(
    <div
      className={`${pos} inset-0 bg-surface-base/80 backdrop-blur-sm flex items-center justify-center z-50 p-4`}
      onMouseDown={(e) =>
        dismissable && e.target === e.currentTarget && handleClose()
      }
    >
      <div className="w-full max-w-lg bg-surface-base rounded-3xl border border-border-subtle/50 shadow-2xl shadow-black/20 overflow-hidden relative">
        <div className="max-h-[85vh] overflow-y-auto px-8 py-8">
          <div className="flex items-center gap-3 pb-4 border-b border-divider/10 mb-6">
            <KeyRound className="w-6 h-6 text-primary" />
            <h3 className="text-xl font-bold text-white flex-1">
              {t('changePassword.title', 'Change Password')}
            </h3>
            {dismissable && (
              <button
                className="p-1.5 rounded-md text-content-secondary hover:text-white hover:bg-surface-overlay/50 transition-colors"
                onClick={handleClose}
                type="button"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {renderBody()}
        </div>
      </div>
    </div>,
    getModalPortalTarget()
  )
}
