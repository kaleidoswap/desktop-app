import { Archive, Folder, Loader2, Save, X } from 'lucide-react'
import React from 'react'
import { Controller } from 'react-hook-form'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import {
  getModalPortalTarget,
  getModalPositionClass,
} from '../../helpers/modalPortal'

interface BackupModalProps {
  showModal: boolean
  isBackupInProgress: boolean
  control: any
  formState: any
  backupPath: string
  onClose: () => void
  onSubmit: (data: any) => void
  onSelectFolder: () => void
  setValue: (name: string, value: string) => void
}

export const BackupModal: React.FC<BackupModalProps> = ({
  showModal,
  isBackupInProgress,
  control,
  formState,
  backupPath,
  onClose,
  onSubmit,
  onSelectFolder,
  setValue,
}) => {
  const { t } = useTranslation()

  if (!showModal) return null

  return createPortal(
    <div
      className="fixed inset-0 bg-surface-base/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-surface-base rounded-3xl border border-border-subtle/50 shadow-2xl shadow-black/20 overflow-hidden relative">
        <div className="max-h-[85vh] overflow-y-auto px-8 py-8">
          {/* Header */}
          <div className="flex items-center gap-3 pb-4 border-b border-divider/10 mb-6">
            <Archive className="w-6 h-6 text-primary" />
            <h3 className="text-xl font-bold text-white flex-1">
              {t('backupModal.title')}
            </h3>
            <button
              className="text-content-secondary hover:text-white p-1.5 rounded-lg hover:bg-surface-high/60 transition-colors"
              onClick={onClose}
              type="button"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <form className="space-y-4" onSubmit={onSubmit}>
            {/* Backup path */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
                {t('backupModal.backupFilePath')}
              </label>
              <div className="flex items-center bg-surface-overlay/50 rounded-xl border border-border-default focus-within:border-primary/60 transition-colors">
                <input
                  className="flex-1 min-w-0 px-3 py-2.5 bg-transparent focus:outline-none text-white placeholder:text-content-tertiary text-sm"
                  onChange={(e) => setValue('backupPath', e.target.value)}
                  type="text"
                  value={backupPath}
                />
                <button
                  className="px-3 py-2.5 text-primary hover:text-white hover:bg-primary/20 border-l border-border-default transition-colors rounded-r-xl"
                  onClick={onSelectFolder}
                  type="button"
                >
                  <Folder className="w-4 h-4" />
                </button>
              </div>
              {formState.errors.backupPath && (
                <p className="text-xs text-status-danger">
                  {t('backupModal.invalidBackupPath')}
                </p>
              )}
            </div>

            {/* Password */}
            <Controller
              control={control}
              name="nodePassword"
              render={({ field }) => (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
                    {t('backupModal.nodePassword')}
                  </label>
                  <input
                    {...field}
                    className="w-full px-3 py-2.5 bg-surface-overlay/50 rounded-xl border border-border-default focus:border-primary/60 focus:outline-none text-white placeholder:text-content-tertiary text-sm transition-colors"
                    placeholder={t('backupModal.nodePasswordPlaceholder')}
                    type="password"
                  />
                </div>
              )}
            />

            {/* Progress */}
            {isBackupInProgress && (
              <div className="flex flex-col items-center gap-2 py-3 px-4 bg-primary/10 border border-primary/20 rounded-xl">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                <p className="text-sm text-content-primary text-center">
                  {t('backupModal.backupInProgressMessage')}
                </p>
                <p className="text-xs text-content-secondary text-center">
                  {t('backupModal.backupLockedMessage')}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                className="flex items-center gap-1.5 px-4 py-2.5 text-content-secondary hover:text-content-primary transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isBackupInProgress}
                onClick={onClose}
                type="button"
              >
                <X className="w-4 h-4" />
                {t('backupModal.cancel')}
              </button>
              <button
                className="flex items-center gap-2 px-4 py-2.5 bg-[#15E99A] hover:bg-[#12C97E] text-gray-900 rounded-xl font-semibold transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isBackupInProgress}
                type="submit"
              >
                <Save className="w-4 h-4" />
                {t('backupModal.createBackup')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    getModalPortalTarget()
  )
}
