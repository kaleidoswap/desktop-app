import { AlertTriangle } from 'lucide-react'

import { Button, Modal } from '../ui'

interface SkipMnemonicWarningModalProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const SkipMnemonicWarningModal = ({
  isOpen,
  onConfirm,
  onCancel,
}: SkipMnemonicWarningModalProps) => {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} size="sm">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-status-danger/10 border border-status-danger/20 shrink-0">
            <AlertTriangle className="w-5 h-5 text-status-danger" />
          </div>
          <h2 className="text-xl font-bold text-white">
            Skip Recovery Phrase?
          </h2>
        </div>

        {/* Warning Content */}
        <div className="space-y-4 mb-6">
          <p className="text-content-secondary text-sm leading-relaxed">
            Without your recovery phrase, you will{' '}
            <span className="text-status-danger font-semibold">
              permanently lose access
            </span>{' '}
            to your wallet if your device is lost, data corrupted, or password
            forgotten.
          </p>

          <div className="p-3 rounded-lg bg-status-warning/5 border border-status-warning/20">
            <p className="text-status-warning text-sm font-medium">
              We strongly recommend writing down your recovery phrase and
              storing it in a secure location before continuing.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5">
          <Button
            className="w-full"
            onClick={onCancel}
            size="lg"
            variant="primary"
          >
            Go Back and Save Recovery Phrase
          </Button>
          <Button
            className="w-full border-status-danger/30 text-status-danger hover:bg-status-danger/10 hover:border-status-danger/50"
            onClick={onConfirm}
            size="lg"
            variant="outline"
          >
            Skip Anyway
          </Button>
        </div>

        <p className="text-xs text-content-tertiary text-center mt-4">
          You can view your recovery phrase later in Settings.
        </p>
      </div>
    </Modal>
  )
}
