import { KeyRound, ShieldCheck } from 'lucide-react'
import { useState } from 'react'

import { Button } from '../../../components/ui'

import { useTr } from './market/hooks'
import { Panel, cx } from './market/ui'

/** A phrase as a person types it: lower case, one space between words. */
export const normalizePhrase = (s: string) =>
  s.trim().toLowerCase().split(/\s+/).filter(Boolean).join(' ')

/** Which words the user must type back to prove the phrase was written down: three, in order. */
export function pickChallenge(words: number, random = Math.random): number[] {
  const picked = new Set<number>()
  while (picked.size < Math.min(3, words)) {
    picked.add(Math.floor(random() * words))
  }
  return [...picked].sort((a, b) => a - b)
}

/** Whether `typed` matches the words of `phrase` at the challenged positions. */
export function challengePassed(
  phrase: string,
  positions: number[],
  typed: string[]
): boolean {
  const words = normalizePhrase(phrase).split(' ')
  return positions.every(
    (p, i) => (typed[i] ?? '').trim().toLowerCase() === words[p]
  )
}

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
}

/** Creating a trading wallet: see the recovery phrase, prove it was written down, or restore one. */
export function WalletSetup({
  networkLabel,
  walletLabel,
  onCancel,
  generate,
  onComplete,
}: Props) {
  const tr = useTr()
  const [step, setStep] = useState<Step>('choose')
  const [phrase, setPhrase] = useState('')
  const [positions, setPositions] = useState<number[]>([])
  const [typed, setTyped] = useState<string[]>([])
  const [restoreText, setRestoreText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const create = () =>
    run(async () => {
      setPhrase(await generate())
      setStep('show')
    })

  const toConfirm = () => {
    const words = normalizePhrase(phrase).split(' ').length
    setPositions(pickChallenge(words))
    setTyped([])
    setStep('confirm')
  }

  const words = normalizePhrase(phrase).split(' ').filter(Boolean)
  const restoreWords = normalizePhrase(restoreText).split(' ').filter(Boolean)
  const restoreValid = [12, 15, 18, 21, 24].includes(restoreWords.length)
  const confirmed =
    positions.length > 0 && challengePassed(phrase, positions, typed)

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 py-8">
      {step === 'choose' && (
        <Panel className="flex flex-col gap-5">
          <header className="flex flex-col gap-1">
            <h2 className="text-xl font-bold text-content-primary">
              {walletLabel
                ? tr('setup.titleNamed', 'Set up {{name}}', {
                    name: walletLabel,
                  })
                : tr('setup.title', 'Set up your trading wallet')}
            </h2>
            <p className="text-body text-content-secondary">
              {tr(
                'setup.body',
                'This wallet trades on {{network}} straight from your computer. It is yours alone and needs no node: you hold it with a recovery phrase.',
                { network: networkLabel }
              )}
            </p>
          </header>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              className="flex flex-col items-start gap-2 rounded-xl bg-primary/10 p-4 text-left ring-1 ring-primary/30 transition-colors hover:bg-primary/15"
              disabled={busy}
              onClick={() => void create()}
              type="button"
            >
              <ShieldCheck aria-hidden className="text-primary" size={20} />
              <strong className="text-body text-content-primary">
                {tr('setup.create', 'Create a new wallet')}
              </strong>
              <span className="text-caption text-content-secondary">
                {tr(
                  'setup.createHelp',
                  'You get a 12-word recovery phrase to write down.'
                )}
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
                {tr('setup.restore', 'I have a recovery phrase')}
              </strong>
              <span className="text-caption text-content-secondary">
                {tr(
                  'setup.restoreHelp',
                  'Bring back a wallet you made before.'
                )}
              </span>
            </button>
          </div>
          {onCancel && (
            <button
              className="self-start text-caption text-content-tertiary transition-colors hover:text-content-secondary"
              onClick={onCancel}
              type="button"
            >
              {tr('setup.useOther', 'Use another wallet')}
            </button>
          )}
        </Panel>
      )}

      {step === 'show' && (
        <Panel className="flex flex-col gap-4">
          <header className="flex flex-col gap-1">
            <h2 className="text-xl font-bold text-content-primary">
              {tr('setup.writeTitle', 'Write down your recovery phrase')}
            </h2>
            <p className="text-body text-content-secondary">
              {tr(
                'setup.writeBody',
                'These words restore your bitcoin if this computer is lost. Anyone who has them can take your funds, so keep them offline and never share them.'
              )}
            </p>
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
            {tr(
              'setup.assetsNote',
              'The phrase restores bitcoin. RGB assets also depend on this computer’s data, so bring assets back to your node when you are done trading.'
            )}
          </p>
          <div className="flex justify-between">
            <Button
              onClick={() => {
                setPhrase('')
                setStep('choose')
              }}
              variant="outline"
            >
              {tr('setup.back', 'Back')}
            </Button>
            <Button onClick={toConfirm}>
              {tr('setup.written', 'I have written it down')}
            </Button>
          </div>
        </Panel>
      )}

      {step === 'confirm' && (
        <Panel className="flex flex-col gap-4">
          <header className="flex flex-col gap-1">
            <h2 className="text-xl font-bold text-content-primary">
              {tr('setup.confirmTitle', 'Check your phrase')}
            </h2>
            <p className="text-body text-content-secondary">
              {tr(
                'setup.confirmBody',
                'Type these words from your recovery phrase to confirm you saved it.'
              )}
            </p>
          </header>
          <div className="grid gap-3 sm:grid-cols-3">
            {positions.map((p, i) => (
              <label
                className="flex flex-col gap-1.5 text-caption text-content-secondary"
                key={p}
              >
                {tr('setup.wordN', 'Word {{n}}', { n: p + 1 })}
                <input
                  autoCapitalize="none"
                  autoComplete="off"
                  autoCorrect="off"
                  className={cx(
                    'rounded-xl bg-surface-base px-3 py-2.5 text-body text-content-primary outline-none ring-1 ring-border-subtle focus:ring-2 focus:ring-primary/40'
                  )}
                  onChange={(e) =>
                    setTyped((t) => {
                      const next = [...t]
                      next[i] = e.target.value
                      return next
                    })
                  }
                  spellCheck={false}
                  value={typed[i] ?? ''}
                />
              </label>
            ))}
          </div>
          {error && <p className="text-caption text-status-danger">{error}</p>}
          <div className="flex justify-between">
            <Button onClick={() => setStep('show')} variant="outline">
              {tr('setup.back', 'Back')}
            </Button>
            <Button
              disabled={!confirmed || busy}
              isLoading={busy}
              onClick={() => void run(() => onComplete(phrase))}
            >
              {tr('setup.createNow', 'Create wallet')}
            </Button>
          </div>
        </Panel>
      )}

      {step === 'restore' && (
        <Panel className="flex flex-col gap-4">
          <header className="flex flex-col gap-1">
            <h2 className="text-xl font-bold text-content-primary">
              {tr('setup.restoreTitle', 'Restore your wallet')}
            </h2>
            <p className="text-body text-content-secondary">
              {tr(
                'setup.restoreBody',
                'Enter your recovery phrase, with a space between the words. It stays on this computer.'
              )}
            </p>
          </header>
          <textarea
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            className="min-h-28 rounded-xl bg-surface-base p-3 text-body text-content-primary outline-none ring-1 ring-border-subtle focus:ring-2 focus:ring-primary/40"
            onChange={(e) => setRestoreText(e.target.value)}
            placeholder={tr('setup.restorePlaceholder', 'word1 word2 word3 …')}
            spellCheck={false}
            value={restoreText}
          />
          <p className="text-caption text-content-tertiary">
            {tr('setup.wordCount', '{{n}} words', { n: restoreWords.length })}
          </p>
          {error && <p className="text-caption text-status-danger">{error}</p>}
          <div className="flex justify-between">
            <Button onClick={() => setStep('choose')} variant="outline">
              {tr('setup.back', 'Back')}
            </Button>
            <Button
              disabled={!restoreValid || busy}
              isLoading={busy}
              onClick={() =>
                void run(() => onComplete(normalizePhrase(restoreText)))
              }
            >
              {tr('setup.restoreNow', 'Restore wallet')}
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
