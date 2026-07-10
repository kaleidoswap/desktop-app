import {
  Copy,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  SkipForward,
} from 'lucide-react'

import { Button, Alert } from '../ui'

interface MnemonicDisplayProps {
  mnemonic: string[]
  onCopy: () => void
  onNext: () => void
  onBack?: () => void
  onSkip?: () => void
}

export const MnemonicDisplay = ({
  mnemonic,
  onCopy,
  onNext,
  onBack,
  onSkip,
}: MnemonicDisplayProps) => {
  return (
    <div className="w-full space-y-5">
      {/* Warning Message */}
      <Alert icon={<AlertTriangle className="w-5 h-5" />} variant="warning">
        <p className="text-sm">
          Never share your recovery phrase with anyone. Store it securely
          offline. Anyone with access to this phrase can control your wallet.
        </p>
      </Alert>

      {/* Recovery Phrase Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {mnemonic.map((word, i) => (
          <div
            className="flex items-center gap-2.5 px-3 py-2.5 bg-surface-raised rounded-lg
                       border border-border-subtle hover:border-primary/40 transition-colors"
            key={i}
          >
            <span className="w-5 shrink-0 text-right text-xs font-mono tabular-nums text-content-tertiary">
              {i + 1}
            </span>
            <span className="font-semibold text-sm text-content-primary tracking-wide">
              {word}
            </span>
          </div>
        ))}
      </div>

      {/* Copy Button */}
      <Button
        className="w-full text-primary border-primary/20 hover:bg-primary/10"
        icon={<Copy className="w-4 h-4" />}
        onClick={onCopy}
        size="md"
        variant="outline"
      >
        Copy Recovery Phrase
      </Button>

      {/* Footer: Back + Next */}
      <div className="flex justify-between items-center mt-2">
        {onBack ? (
          <button
            className="px-3 py-2 text-content-secondary hover:text-white transition-colors flex items-center gap-1.5 hover:bg-surface-overlay/50 rounded-lg text-sm"
            onClick={onBack}
            type="button"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
        ) : (
          <span />
        )}
        <Button
          icon={<ArrowRight className="w-4 h-4" />}
          iconPosition="right"
          onClick={onNext}
          size="lg"
          variant="primary"
        >
          Verify Recovery Phrase
        </Button>
      </div>

      {/* Skip Button */}
      {onSkip && (
        <Button
          className="w-full border-white/30 hover:border-white/50 bg-transparent hover:bg-white/5 text-white"
          icon={<SkipForward className="w-4 h-4" />}
          onClick={onSkip}
          size="md"
          variant="outline"
        >
          Skip Backup (Not Recommended)
        </Button>
      )}
    </div>
  )
}
