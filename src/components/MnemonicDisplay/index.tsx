import { Copy, AlertCircle, ArrowRight, SkipForward } from 'lucide-react'

import { Button, Card, Alert } from '../ui'

interface MnemonicDisplayProps {
  mnemonic: string[]
  onCopy: () => void
  onNext: () => void
  onSkip?: () => void
}

export const MnemonicDisplay = ({
  mnemonic,
  onCopy,
  onNext,
  onSkip,
}: MnemonicDisplayProps) => {
  return (
    <div className="w-full">
      <p className="text-content-secondary mb-6 leading-relaxed">
        Save your recovery phrase in a secure location. This is the only way to
        recover your wallet if you lose access.
      </p>

      {/* Warning Message */}
      <Alert
        className="mb-6"
        icon={<AlertCircle className="w-5 h-5" />}
        title="Important"
        variant="warning"
      >
        <p className="text-sm">
          Never share your recovery phrase with anyone. Store it securely
          offline. Anyone with access to this phrase can control your wallet.
        </p>
      </Alert>

      {/* Recovery Phrase Grid */}
      <Card className="p-6 bg-surface-elevated/40 border border-white/5">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {mnemonic.map((word, i) => (
            <div
              className="flex items-center p-2.5 bg-surface-overlay/50 rounded-lg 
                       border border-border-default/50 text-content-secondary"
              key={i}
            >
              <span className="text-content-tertiary text-xs mr-2">{i + 1}.</span>
              <span className="font-medium text-sm">{word}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Copy Button */}
            <Button
              className="text-primary border-primary/20 hover:bg-primary/10"
              icon={<Copy className="w-4 h-4" />}
              onClick={onCopy}
              size="md"
              variant="outline"
            >
              Copy Recovery Phrase
            </Button>

            {/* Next Button */}
            <Button
              className="flex-1"
              icon={<ArrowRight className="w-4 h-4" />}
              iconPosition="right"
              onClick={onNext}
              size="md"
              variant="primary"
            >
              I've Securely Saved My Recovery Phrase
            </Button>
          </div>

          {/* Skip Button */}
          {onSkip && (
            <Button
              className="w-full text-content-secondary border-border-default/50 hover:bg-surface-overlay/50 hover:text-content-secondary hover:border-border-default"
              icon={<SkipForward className="w-4 h-4" />}
              onClick={onSkip}
              size="md"
              variant="outline"
            >
              Skip Backup (Not Recommended)
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
