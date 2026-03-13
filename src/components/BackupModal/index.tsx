import { Folder, Loader2 } from 'lucide-react'
import React from 'react'
import { Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-overlay p-8 rounded-xl shadow-2xl w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-content-primary">
          {t('backupModal.title')}
        </h2>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1">
              {t('backupModal.backupFilePath')}
            </label>
            <div className="flex">
              <input
                className="flex-grow px-3 py-2 text-content-primary bg-surface-high border border-border-default rounded-l-md focus:outline-none focus:ring-2 focus:ring-primary"
                onChange={(e) => setValue('backupPath', e.target.value)}
                type="text"
                value={backupPath}
              />
              <button
                className="px-3 py-2 bg-primary text-content-inverse rounded-r-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-overlay"
                onClick={onSelectFolder}
                type="button"
              >
                <Folder className="w-5 h-5" />
              </button>
            </div>
            {formState.errors.backupPath && (
              <p className="mt-1 text-sm text-status-danger">
                {t('backupModal.invalidBackupPath')}
              </p>
            )}
          </div>
          <Controller
            control={control}
            name="nodePassword"
            render={({ field }) => (
              <div>
                <label className="block text-sm font-medium text-content-secondary mb-1">
                  {t('backupModal.nodePassword')}
                </label>
                <input
                  {...field}
                  className="w-full px-3 py-2 text-content-primary bg-surface-high border border-border-default rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder={t('backupModal.nodePasswordPlaceholder')}
                  type="password"
                />
              </div>
            )}
          />
          {isBackupInProgress && (
            <div className="mt-4">
              <div className="flex items-center justify-center mb-2">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
              <p className="text-content-primary text-center">
                {t('backupModal.backupInProgressMessage')}
                <br />
                {t('backupModal.backupLockedMessage')}
              </p>
            </div>
          )}
          <div className="flex justify-between space-x-4 pt-6">
            <button
              className="flex-1 px-4 py-2 bg-surface-elevated text-content-primary rounded-md hover:bg-surface-high border border-border-default focus:outline-none focus:ring-2 focus:ring-border-strong disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isBackupInProgress}
              onClick={onClose}
              type="button"
            >
              {t('backupModal.cancel')}
            </button>
            <button
              className="flex-1 px-4 py-2 bg-primary text-content-inverse rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-overlay disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isBackupInProgress}
              type="submit"
            >
              {t('backupModal.createBackup')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
