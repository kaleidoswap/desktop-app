import { KeyRound, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { MnemonicVerifyForm } from '../../../components/MnemonicVerifyForm'
import { Button } from '../../../components/ui'

import { Panel } from './market/ui'

/** A phrase as a person types it: lower case, one space between words. */
export const normalizePhrase = (s: string) =>
  s.trim().toLowerCase().split(/\s+/).filter(Boolean).join(' ')

type Step = 'choose' | 'show' | 'confirm' | 'restore'

interface Props {
  networkLabel: string
  /** Shown when this setup is for a wallet after the first. */
  walletLabel?: string
  /** Leave this setup and go back to a wallet that already exists. */
  onCancel?: () => void
  /** A new recovery phrase. Nothing exists until `onComplete` runs. */
  generate: () => Promise<string>
  /** Create the wallet from `phrase` (a new one, or one the user brought). */
  onComplete: (phrase: string) => Promise<void>
  /** Open straight on restoring from a phrase, when the user already chose that. */
  startWithRestore?: boolean
}

/** Creating a trading wallet: see the recovery phrase, prove it was written down, or restore one. */
export function WalletSetup({
  networkLabel,
  walletLabel,
  onCancel,
  generate,
  onComplete,
  startWithRestore = false,
}: Props) {
  const { t } = useTranslation('translation', {
    keyPrefix: 'p2pMarket.market.setup',
  })
  const [step, setStep] = useState<Step>(
    startWithRestore ? 'restore' : 'choose'
  )
  const [phrase, setPhrase] = useState('')
  const [restoreText, setRestoreText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  const create = () =>
    run(async () => {
      setPhrase(await generate())
      setStep('show')
    })

  const words = normalizePhrase(phrase).split(' ').filter(Boolean)
  const restoreWords = normalizePhrase(restoreText).split(' ').filter(Boolean)
  const restoreValid = [12, 15, 18, 21, 24].includes(restoreWords.length)

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 py-8">
      {step === 'choose' && (
        <Panel className="flex flex-col gap-5">
          <header className="flex flex-col gap-1">
            <h2 className="text-xl font-bold text-content-primary">
              {walletLabel
                ? t('titleNamed', {
                    name: walletLabel,
                  })
                : t('title')}
            </h2>
            <p className="text-body text-content-secondary">
              {t('body', { network: networkLabel })}
            </p>
          </header>
          <ol
            aria-label={t('gettingStarted')}
            className="flex gap-4 text-caption text-content-secondary"
          >
            <li className="font-semibold text-primary">
              1 · {t('stepCreate')}
            </li>
            <li>2 · {t('stepFund')}</li>
            <li>3 · {t('stepOffer')}</li>
          </ol>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              className="flex flex-col items-start gap-2 rounded-xl bg-primary/10 p-4 text-left ring-1 ring-primary/30 transition-colors hover:bg-primary/15"
              disabled={busy}
              onClick={() => void create()}
              type="button"
            >
              <ShieldCheck aria-hidden className="text-primary" size={20} />
              <strong className="text-body text-content-primary">
                {t('create')}
              </strong>
              <span className="text-caption text-content-secondary">
                {t('createHelp')}
              </span>
            </button>
            <button
              className="flex flex-col items-start gap-2 rounded-xl bg-surface-inset p-4 text-left transition-colors hover:bg-surface-raised"
              disabled={busy}
              onClick={() => {
                setError(null)
                setStep('restore')
              }}
              type="button"
            >
              <KeyRound
                aria-hidden
                className="text-content-secondary"
                size={20}
              />
              <strong className="text-body text-content-primary">
                {t('restore')}
              </strong>
              <span className="text-caption text-content-secondary">
                {t('restoreHelp')}
              </span>
            </button>
          </div>
          {onCancel && (
            <button
              className="self-start text-caption text-content-tertiary transition-colors hover:text-content-secondary"
              onClick={onCancel}
              type="button"
            >
              {t('useOther')}
            </button>
          )}
        </Panel>
      )}

      {step === 'show' && (
        <Panel className="flex flex-col gap-4">
          <header className="flex flex-col gap-1">
            <h2 className="text-xl font-bold text-content-primary">
              {t('writeTitle')}
            </h2>
            <p className="text-body text-content-secondary">{t('writeBody')}</p>
          </header>
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {words.map((w, i) => (
              <li
                className="flex items-baseline gap-2 rounded-lg bg-surface-base px-3 py-2 ring-1 ring-border-subtle"
                key={i}
              >
                <span className="w-5 text-right text-tiny tabular-nums text-content-tertiary">
                  {i + 1}
                </span>
                <span className="text-body font-medium text-content-primary">
                  {w}
                </span>
              </li>
            ))}
          </ol>
          <p className="rounded-xl bg-status-warning-subtle p-3 text-caption text-content-primary">
            {t('assetsNote')}
          </p>
          <div className="flex justify-between">
            <Button
              onClick={() => {
                setPhrase('')
                setStep('choose')
              }}
              variant="outline"
            >
              {t('back')}
            </Button>
            <Button onClick={() => setStep('confirm')}>{t('written')}</Button>
          </div>
        </Panel>
      )}

      {step === 'confirm' && (
        <Panel className="flex flex-col gap-4">
          <header className="flex flex-col gap-1">
            <h2 className="text-xl font-bold text-content-primary">
              {t('confirmTitle')}
            </h2>
          </header>
          {error && (
            <p className="text-caption text-status-danger" role="alert">
              {error}
            </p>
          )}
          <MnemonicVerifyForm
            onBack={() => setStep('show')}
            onVerified={() => run(() => onComplete(phrase))}
            phrase={phrase}
            submitLabel={t('createNow')}
          />
        </Panel>
      )}

      {step === 'restore' && (
        <Panel className="flex flex-col gap-4">
          <header className="flex flex-col gap-1">
            <h2 className="text-xl font-bold text-content-primary">
              {t('restoreTitle')}
            </h2>
            <p className="text-body text-content-secondary">
              {t('restoreBody')}
            </p>
          </header>
          <textarea
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            className="min-h-28 rounded-xl bg-surface-base p-3 text-body text-content-primary outline-none ring-1 ring-border-subtle focus:ring-2 focus:ring-primary/40"
            onChange={(e) => setRestoreText(e.target.value)}
            placeholder={t('restorePlaceholder')}
            spellCheck={false}
            value={restoreText}
          />
          <p className="text-caption text-content-tertiary">
            {t('wordCount', { n: restoreWords.length })}
          </p>
          {error && <p className="text-caption text-status-danger">{error}</p>}
          <div className="flex justify-between">
            <Button onClick={() => setStep('choose')} variant="outline">
              {t('back')}
            </Button>
            <Button
              disabled={!restoreValid || busy}
              isLoading={busy}
              onClick={() =>
                void run(() => onComplete(normalizePhrase(restoreText)))
              }
            >
              {t('restoreNow')}
            </Button>
          </div>
        </Panel>
      )}

      {step === 'choose' && error && (
        <p className="text-center text-caption text-status-danger">{error}</p>
      )}
    </div>
  )
}
