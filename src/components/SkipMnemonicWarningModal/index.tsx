import { AlertTriangle, X } from 'lucide-react'

import { Button } from '../ui'

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
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 rounded-2xl border border-red-500/30 shadow-2xl shadow-red-500/20 max-w-md w-full p-6 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-lg animate-pulse">
              <AlertTriangle className="w-6 h-6 text-red-500 animate-in zoom-in duration-500" />
            </div>
            <h2 className="text-xl font-bold text-white animate-in slide-in-from-left duration-300">
              Skip Recovery Phrase?
            </h2>
          </div>
          <button
            className="p-1 hover:bg-slate-800 rounded-lg transition-all duration-200 hover:rotate-90"
            onClick={onCancel}
            type="button"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Warning Content */}
        <div className="space-y-4 mb-6">
          <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
            <p className="text-red-400 font-semibold mb-2">
              ⚠️ Critical Warning
            </p>
            <p className="text-slate-300 text-sm leading-relaxed">
              Without your recovery phrase, you will{' '}
              <span className="text-red-400 font-bold">
                permanently lose access
              </span>{' '}
              to your wallet if:
            </p>
          </div>

          <ul className="space-y-2 text-sm text-slate-300">
            <li
              className="flex items-start gap-2 animate-in slide-in-from-left duration-300"
              style={{ animationDelay: '100ms' }}
            >
              <span className="text-red-500 mt-1">•</span>
              <span>You forget your password and backup</span>
            </li>
            <li
              className="flex items-start gap-2 animate-in slide-in-from-left duration-300"
              style={{ animationDelay: '200ms' }}
            >
              <span className="text-red-500 mt-1">•</span>
              <span>Your device is lost, stolen, or damaged</span>
            </li>
            <li
              className="flex items-start gap-2 animate-in slide-in-from-left duration-300"
              style={{ animationDelay: '300ms' }}
            >
              <span className="text-red-500 mt-1">•</span>
              <span>Your application data becomes corrupted</span>
            </li>
            <li
              className="flex items-start gap-2 animate-in slide-in-from-left duration-300"
              style={{ animationDelay: '400ms' }}
            >
              <span className="text-red-500 mt-1">•</span>
              <span>You need to restore your wallet on another device</span>
            </li>
          </ul>

          <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
            <p className="text-amber-400 text-sm font-medium mb-1">
              💡 Recommendation
            </p>
            <p className="text-slate-300 text-sm leading-relaxed">
              We <span className="font-semibold">strongly recommend</span>{' '}
              writing down your recovery phrase and storing it in a secure
              location before continuing.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <Button
            className="w-full transition-all duration-300 hover:scale-[1.02] animate-in slide-in-from-bottom duration-300"
            onClick={onCancel}
            size="lg"
            style={{ animationDelay: '500ms' }}
            variant="primary"
          >
            Go Back and Save Recovery Phrase
          </Button>
          <Button
            className="w-full bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20 hover:border-red-500/50 transition-all duration-300 hover:scale-[1.02] animate-in slide-in-from-bottom"
            onClick={onConfirm}
            size="lg"
            style={{ animationDelay: '600ms' }}
            variant="outline"
          >
            I Understand the Risks, Skip Anyway
          </Button>
        </div>

        {/* Footer Warning */}
        <p className="text-xs text-slate-500 text-center mt-4">
          You can view your recovery phrase later in Settings, but we recommend
          saving it now.
        </p>
      </div>
    </div>
  )
}
