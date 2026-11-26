import { Button, CardDescription } from 'kaleido-ui'
import { Fingerprint, KeyRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { MnemonicVerifyForm } from '../../components/MnemonicVerifyForm'
import {
  deriveCredential,
  generatePhrase,
  passkeyCapability,
  phraseFingerprint,
  readPending,
  registerCredential,
  rememberPending,
  saveWallet,
  type PasskeyCapability,
  type WalletIdentity,
  type WalletMethod,
} from './onchain'

type Step = 'choose' | 'passkey' | 'backup' | 'verify' | 'restore' | 'export'
type Props = {
  wallet: WalletIdentity | null
  onReady: (wallet: WalletIdentity) => void
}

const errorKeys: Record<string, string> = {
  invalid_mnemonic: 'invalid',
  passkey_busy: 'busy',
  passkey_cancelled: 'cancelled',
  passkey_invalid_credential: 'wrongKey',
  passkey_legacy_test: 'legacyKey',
  passkey_macos_version: 'unavailable',
  passkey_not_provisioned: 'unavailable',
  passkey_prf_unsupported: 'unsupported',
  passkey_unavailable: 'unavailable',
  passkey_unsupported_platform: 'unavailable',
  wallet_exists: 'exists',
}

export function OnchainSetup({ wallet, onReady }: Props) {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>('choose')
  const [method, setMethod] = useState<WalletMethod>('mnemonic')
  const [phrase, setPhrase] = useState('')
  const [visible, setVisible] = useState(false)
  const [seen, setSeen] = useState(false)
  const [pending, setPending] = useState(readPending)
  const [capability, setCapability] = useState<PasskeyCapability | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    let current = true
    if (!wallet || wallet.method === 'passkey') {
      passkeyCapability().then(
        (result) => {
          if (current) setCapability(result)
        },
        () => {
          if (current)
            setCapability({ available: false, reason: 'passkey_unavailable' })
        }
      )
    }
    return () => {
      current = false
      mounted.current = false
    }
  }, [wallet])

  // Remove the words from the page if the person leaves the window during backup.
  useEffect(() => {
    const hide = () => setVisible(false)
    const onVisibility = () => {
      if (document.hidden) hide()
    }
    window.addEventListener('blur', hide)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('blur', hide)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  function reset() {
    setStep('choose')
    setPhrase('')
    setSeen(false)
    setVisible(false)
    setError(null)
  }

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return false
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      await action()
      return true
    } catch (reason) {
      const code = typeof reason === 'string' ? reason : ''
      if (mounted.current) setError(errorKeys[code] ?? 'failed')
      return false
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }

  async function commit(words: string, source: WalletMethod) {
    const result = await saveWallet(words, source)
    if (result.state !== 'ready') throw new Error('wallet_initialization')
    rememberPending(null)
    if (mounted.current) {
      setPending(null)
      reset()
      onReady(result.wallet)
    }
  }

  function backup(words: string, source: WalletMethod) {
    if (!mounted.current) return
    setPhrase(words)
    setVisible(false)
    setSeen(false)
    setMethod(source)
    setStep('backup')
  }

  async function fromPasskey(id: string | null, exporting = false) {
    const result = await deriveCredential(id)
    if (!mounted.current) return
    if (id && result.credentialId !== id) throw 'passkey_invalid_credential'
    if (exporting) {
      if (
        !wallet ||
        (await phraseFingerprint(result.mnemonic)) !== wallet.fingerprint
      ) {
        throw 'passkey_invalid_credential'
      }
      if (!mounted.current) return
      setPhrase(result.mnemonic)
      setVisible(true)
      setStep('export')
    } else {
      backup(result.mnemonic, 'passkey')
    }
  }

  const label = (key: string) => t('onchainSetup.' + key)
  const canPasskey = capability?.available === true
  const wordList = visible && (
    <ol
      aria-label={t('walletInit.mnemonicStep.title')}
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4"
    >
      {phrase
        .trim()
        .split(/\s+/)
        .map((word, index) => (
          <li
            className="rounded-md bg-surface-inset px-3 py-2 font-mono text-body"
            key={index}
          >
            <span aria-hidden className="mr-2 text-content-secondary">
              {index + 1}.
            </span>
            {word}
          </li>
        ))}
    </ol>
  )
  let content
  if (step === 'backup' || step === 'export') {
    content = (
      <>
        <p>{t('walletInit.mnemonicStep.warning')}</p>
        <CardDescription>{label('rgbBackup')}</CardDescription>
        <Button
          disabled={busy}
          onClick={() => {
            setVisible(!visible)
            setSeen(true)
          }}
          type="button"
          variant="outline"
        >
          {visible ? label('hide') : t('walletInit.mnemonicStep.revealTitle')}
        </Button>
        {wordList}
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={reset} type="button" variant="quiet">
            {t(step === 'export' ? 'common.close' : 'common.back')}
          </Button>
          {step === 'backup' && (
            <Button
              disabled={busy || !seen}
              onClick={() => {
                setVisible(false)
                if (method === 'mnemonic') setStep('verify')
                else void run(() => commit(phrase, 'passkey'))
              }}
              type="button"
            >
              {method === 'mnemonic'
                ? t('walletInit.mnemonicStep.verifyButton')
                : label('finish')}
            </Button>
          )}
        </div>
      </>
    )
  } else if (step === 'verify') {
    content = (
      <MnemonicVerifyForm
        onBack={() => {
          setVisible(false)
          setError(null)
          setStep('backup')
        }}
        onVerified={() => run(() => commit(phrase, 'mnemonic'))}
        phrase={phrase}
        submitLabel={label('finish')}
      />
    )
  } else if (step === 'restore') {
    content = (
      <form
        autoComplete="off"
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          void run(() =>
            commit(
              phrase.trim().toLowerCase().split(/\s+/).join(' '),
              'mnemonic'
            )
          )
        }}
      >
        <label className="grid gap-2">
          {label('restore')}
          <textarea
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            className="w-full rounded-md border border-divider bg-surface-inset p-3"
            disabled={busy}
            onChange={(event) => setPhrase(event.target.value)}
            rows={3}
            spellCheck={false}
            value={phrase}
          />
        </label>
        <CardDescription>{label('rgbBackup')}</CardDescription>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={reset} type="button" variant="quiet">
            {t('common.back')}
          </Button>
          <Button disabled={busy || !phrase.trim()} type="submit">
            {t('common.import')}
          </Button>
        </div>
      </form>
    )
  } else if (wallet) {
    content = (
      <>
        <strong>{label('ready')}</strong>
        <p>
          {label('fingerprint')}{' '}
          <bdi className="font-mono">{wallet.masterFingerprint}</bdi>
        </p>
        <CardDescription>{label('offline')}</CardDescription>
        {wallet.method === 'passkey' && (
          <Button
            disabled={busy || !canPasskey}
            onClick={() => void run(() => fromPasskey(null, true))}
            type="button"
            variant="surface"
          >
            {label('export')}
          </Button>
        )}
        {wallet.method === 'passkey' && capability && !canPasskey && (
          <CardDescription>{label('unavailable')}</CardDescription>
        )}
      </>
    )
  } else if (step === 'passkey') {
    content = (
      <>
        <CardDescription>{label('confirmPasskey')}</CardDescription>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy}
            onClick={() => void run(() => fromPasskey(pending))}
            type="button"
          >
            {label('usePasskey')}
          </Button>
          <Button disabled={busy} onClick={reset} type="button" variant="quiet">
            {t('common.back')}
          </Button>
        </div>
      </>
    )
  } else {
    content = (
      <>
        <p>{label('choose')}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy || !canPasskey}
            onClick={() =>
              void run(async () => {
                if (!pending) {
                  const { credentialId } = await registerCredential()
                  rememberPending(credentialId)
                  if (!mounted.current) return
                  setPending(credentialId)
                }
                setStep('passkey')
              })
            }
            type="button"
            variant="surface"
          >
            <Fingerprint aria-hidden size={17} />
            {label(pending ? 'resume' : 'createPasskey')}
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => backup(await generatePhrase(), 'mnemonic'))
            }
            type="button"
            variant="surface"
          >
            <KeyRound aria-hidden size={17} />
            {label('createPhrase')}
          </Button>
        </div>
        {capability && !canPasskey && (
          <CardDescription>{label('unavailable')}</CardDescription>
        )}
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={busy}
            onClick={() => {
              reset()
              setStep('restore')
            }}
            size="sm"
            type="button"
            variant="link"
          >
            {label('restore')}
          </Button>
          {canPasskey && (
            <Button
              disabled={busy}
              onClick={() => void run(() => fromPasskey(null))}
              size="sm"
              type="button"
              variant="link"
            >
              {label('recoverPasskey')}
            </Button>
          )}
          {pending && (
            <Button
              disabled={busy}
              onClick={() => {
                rememberPending(null)
                setPending(null)
                reset()
              }}
              size="sm"
              type="button"
              variant="quiet"
            >
              {label('forgetPending')}
            </Button>
          )}
        </div>
      </>
    )
  }
  return (
    <section
      aria-busy={busy}
      aria-label={label('title')}
      className="flex w-full flex-col items-start gap-4 [&>form]:w-full"
    >
      {content}
      {error && (
        <p className="text-body text-status-danger" role="alert">
          {label(error)}
        </p>
      )}
    </section>
  )
}
