import {
  Copy,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
  const [isRevealed, setIsRevealed] = useState(false)
  const [hasRevealed, setHasRevealed] = useState(false)

  const reveal = () => {
    setIsRevealed(true)
    setHasRevealed(true)
  }

  return (
    <div className="w-full space-y-5">
      <Alert icon={<AlertTriangle className="w-5 h-5" />} variant="warning">
        <p className="text-sm">{t('walletInit.mnemonicStep.warning')}</p>
      </Alert>

      <div className="rounded-xl border border-border-subtle bg-surface-raised/40 p-3">
        <div className="flex items-center justify-between px-1 pb-3">
          <span className="text-xs font-medium uppercase tracking-wider text-content-tertiary">
            {t('walletInit.mnemonicStep.wordCount', { count: mnemonic.length })}
          </span>
          <div className="flex items-center gap-1">
            <button
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-content-secondary transition-colors hover:bg-surface-overlay/50 hover:text-white"
              onClick={() => (isRevealed ? setIsRevealed(false) : reveal())}
              type="button"
            >
              {isRevealed ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
              {isRevealed
                ? t('walletInit.mnemonicStep.hide')
                : t('walletInit.mnemonicStep.reveal')}
            </button>
            <button
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-content-secondary transition-colors hover:bg-surface-overlay/50 hover:text-white disabled:pointer-events-none disabled:opacity-40"
              disabled={!isRevealed}
              onClick={onCopy}
              type="button"
            >
              <Copy className="w-3.5 h-3.5" />
              {t('walletInit.mnemonicStep.copy')}
            </button>
          </div>
        </div>

        <div className="relative">
          <ol
            aria-hidden={!isRevealed}
            className={`grid grid-cols-2 sm:grid-cols-3 gap-2 transition-[filter] duration-200 ${
              isRevealed ? '' : 'blur-md select-none pointer-events-none'
            }`}
          >
            {mnemonic.map((word, i) => (
              <li
                className="flex items-center gap-2.5 rounded-lg border border-border-subtle bg-surface-raised px-3 py-2.5"
                key={i}
              >
                <span className="w-5 shrink-0 text-right font-mono text-xs tabular-nums text-content-tertiary">
                  {i + 1}
                </span>
                <span className="font-mono text-sm font-semibold text-content-primary">
                  {word}
                </span>
              </li>
            ))}
          </ol>

          {!isRevealed && (
            <button
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg text-center transition-colors hover:bg-surface-overlay/20"
              onClick={reveal}
              type="button"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-overlay/80 text-white">
                <Eye className="w-5 h-5" />
              </span>
              <span className="text-sm font-semibold text-white">
                {t('walletInit.mnemonicStep.revealTitle')}
              </span>
              <span className="text-xs text-content-secondary">
                {t('walletInit.mnemonicStep.revealHint')}
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        {onBack ? (
          <button
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-content-secondary transition-colors hover:bg-surface-overlay/50 hover:text-white"
            onClick={onBack}
            type="button"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t('common.back')}
          </button>
        ) : (
          <span />
        )}
        <Button
          disabled={!hasRevealed}
          icon={<ArrowRight className="w-4 h-4" />}
          iconPosition="right"
          onClick={onNext}
          size="lg"
          variant="primary"
        >
          {t('walletInit.mnemonicStep.verifyButton')}
        </Button>
      </div>

      {onSkip && (
        <div className="flex justify-center">
          <button
            className="text-xs text-content-secondary underline-offset-4 transition-colors hover:text-red hover:underline"
            onClick={onSkip}
            type="button"
          >
            {t('walletInit.mnemonicStep.skipButton')}
          </button>
        </div>
      )}
    </div>
  )
}
