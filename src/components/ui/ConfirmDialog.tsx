import { AlertTriangle, Loader2 } from 'lucide-react'
import { ReactNode } from 'react'

import { Modal } from './Modal'

export interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: ReactNode
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
  /** "danger" for destructive or irreversible actions. */
  tone?: 'primary' | 'danger'
  isLoading?: boolean
}

/** Small confirmation dialog built on the shared Modal. */
export const ConfirmDialog = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  tone = 'primary',
  isLoading = false,
}: ConfirmDialogProps) => (
  <Modal
    isOpen={isOpen}
    onClose={isLoading ? () => {} : onCancel}
    size="sm"
    title={title}
  >
    <div className="space-y-5 p-5">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
            tone === 'danger'
              ? 'bg-status-danger-subtle text-status-danger'
              : 'bg-status-warning-subtle text-status-warning'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
        </span>
        <div className="pt-1.5 text-sm leading-relaxed text-content-secondary">
          {message}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          className="h-10 flex-1 rounded-lg border border-border-default text-sm font-medium text-white transition-colors hover:bg-surface-high disabled:opacity-50"
          disabled={isLoading}
          onClick={onCancel}
          type="button"
        >
          {cancelLabel}
        </button>
        <button
          className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 ${
            tone === 'danger'
              ? 'bg-status-danger text-white hover:opacity-90'
              : 'bg-primary text-primary-foreground hover:bg-primary-emphasis'
          }`}
          disabled={isLoading}
          onClick={onConfirm}
          type="button"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {confirmLabel}
        </button>
      </div>
    </div>
  </Modal>
)
