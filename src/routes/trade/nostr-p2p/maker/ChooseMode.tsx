import { ChevronDown, Cloud, Server, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '../../../../components/ui'
import { short } from '../format'
import { Panel, Pill } from '../market/ui'

import type { MakerBackend, MakerMode, MakerView } from './makerApi'
import {
  ChoiceCard,
  CopyBox,
  errorText,
  SectionTitle,
  TextField,
  useMk,
} from './parts'

interface Props {
  backend: MakerBackend
  view: MakerView
  onView: (v: MakerView) => void
  onNext: () => void
}

/** Screen 1: hosted by KaleidoSwap, or run it yourself; then pair with that maker. */
export function ChooseMode({ backend, view, onView, onNext }: Props) {
  const tm = useMk()
  const [pending, setPending] = useState<MakerMode | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const choose = async (mode: MakerMode) => {
    if (view.mode === mode) return
    // switching forgets the pairing: ask first when there is one
    if (view.mode && view.endpoint && pending !== mode) {
      setPending(mode)
      return
    }
    setPending(null)
    setBusy(true)
    setError(null)
    try {
      onView(await backend.setMode(mode))
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <div className="flex flex-col gap-4">
          <SectionTitle hint={tm('mode.hint')}>{tm('mode.title')}</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            <ChoiceCard
              badge={<Pill tone="primary">{tm('mode.recommended')}</Pill>}
              disabled={busy}
              onSelect={() => void choose('hosted')}
              selected={view.mode === 'hosted'}
              title={
                <span className="flex items-center gap-2">
                  <Cloud size={16} /> {tm('mode.hosted')}
                </span>
              }
            >
              <span className="flex flex-col gap-1">
                <span>{tm('mode.hostedBody')}</span>
                <span>• {tm('mode.hosted24')}</span>
                <span>• {tm('mode.hostedKeys')}</span>
                <span>• {tm('mode.hostedPolicy')}</span>
              </span>
            </ChoiceCard>
            <ChoiceCard
              disabled={busy}
              onSelect={() => void choose('self_hosted')}
              selected={view.mode === 'self_hosted'}
              title={
                <span className="flex items-center gap-2">
                  <Server size={16} /> {tm('mode.self')}
                </span>
              }
            >
              <span className="flex flex-col gap-1">
                <span>{tm('mode.selfBody')}</span>
                <span>• {tm('mode.selfUptime')}</span>
                <span>• {tm('mode.selfFeed')}</span>
              </span>
            </ChoiceCard>
          </div>
          {pending && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-status-warning-subtle p-3 text-caption text-status-warning">
              <span className="flex-1">{tm('mode.switchWarning')}</span>
              <Button
                onClick={() => setPending(null)}
                size="sm"
                variant="ghost"
              >
                {tm('common.cancel')}
              </Button>
              <Button
                onClick={() => void choose(pending)}
                size="sm"
                variant="outline"
              >
                {tm('mode.switch')}
              </Button>
            </div>
          )}
          {error && <p className="text-caption text-status-danger">{error}</p>}
        </div>
      </Panel>
      {view.mode === 'hosted' && (
        <HostedPairing
          backend={backend}
          onNext={onNext}
          onView={onView}
          view={view}
        />
      )}
      {view.mode === 'self_hosted' && (
        <SelfPairing
          backend={backend}
          onNext={onNext}
          onView={onView}
          view={view}
        />
      )}
    </div>
  )
}

function HostedPairing({ backend, view, onView, onNext }: Props) {
  const tm = useMk()
  const [request, setRequest] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [dev, setDev] = useState(false)
  const [url, setUrl] = useState(view.endpoint?.url ?? '')
  const [token, setToken] = useState('')
  const [npub, setNpub] = useState(view.endpoint?.maker_npub ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const paired = !!view.endpoint && view.has_token

  useEffect(() => {
    let live = true
    backend
      .pairingRequest()
      .then((r) => live && setRequest(r))
      .catch((e) => live && setError(errorText(e)))
    return () => {
      live = false
    }
  }, [backend])

  const pair = async (input: Parameters<MakerBackend['pair']>[0]) => {
    setBusy(true)
    setError(null)
    try {
      onView(await backend.pair(input))
      setCode('')
      setToken('')
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel>
      <div className="flex flex-col gap-4">
        <SectionTitle hint={tm('pair.hostedHint')}>
          {tm('pair.hostedTitle')}
        </SectionTitle>
        {paired && view.endpoint && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-status-success-subtle p-3">
            <ShieldCheck className="text-status-success" size={18} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-body font-medium text-content-primary">
                {tm('pair.paired')}
              </span>
              <span className="truncate text-caption text-content-secondary">
                {view.endpoint.url} · {short(view.endpoint.maker_npub, 10)}
              </span>
            </div>
            <Button onClick={onNext} size="sm">
              {tm('pair.next')}
            </Button>
          </div>
        )}
        <ol className="flex flex-col gap-4">
          <li className="flex flex-col gap-2">
            <span className="text-body text-content-primary">
              1. {tm('pair.step1')}
            </span>
            <span className="text-caption text-content-secondary">
              {tm('pair.step1Hint')}
            </span>
            {request ? (
              <CopyBox label={tm('pair.step1')} value={request} />
            ) : (
              <span className="text-caption text-content-tertiary">…</span>
            )}
            <span className="text-caption text-content-tertiary">
              {tm('pair.signerKey')}:{' '}
              <span className="font-mono">{short(view.signer_npub, 12)}</span>
            </span>
          </li>
          <li className="flex flex-col gap-2">
            <span className="text-body text-content-primary">
              2. {tm('pair.step2')}
            </span>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-64 flex-1">
                <TextField
                  id="maker-pairing-code"
                  label={tm('pair.code')}
                  mono
                  onChange={setCode}
                  placeholder="kmaker1…"
                  value={code}
                />
              </div>
              <Button
                disabled={busy || !code.trim()}
                isLoading={busy}
                onClick={() => void pair({ code: code.trim() })}
              >
                {tm('pair.pair')}
              </Button>
            </div>
          </li>
        </ol>
        <button
          aria-expanded={dev}
          className="flex items-center gap-1 self-start text-caption text-content-tertiary hover:text-content-secondary"
          onClick={() => setDev((d) => !d)}
          type="button"
        >
          <ChevronDown
            className={
              dev ? 'rotate-180 transition-transform' : 'transition-transform'
            }
            size={14}
          />
          {tm('pair.dev')}
        </button>
        {dev && (
          <div className="flex flex-col gap-3 rounded-xl bg-surface-inset/50 p-3">
            <p className="text-caption text-content-tertiary">
              {tm('pair.devHint')}
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              <TextField
                id="maker-dev-url"
                label={tm('pair.url')}
                mono
                onChange={setUrl}
                placeholder="http://127.0.0.1:…"
                value={url}
              />
              <TextField
                id="maker-dev-token"
                label={tm('pair.token')}
                mono
                onChange={setToken}
                value={token}
              />
              <TextField
                id="maker-dev-npub"
                label={tm('pair.makerKey')}
                mono
                onChange={setNpub}
                placeholder="npub1…"
                value={npub}
              />
            </div>
            <div>
              <Button
                disabled={busy || !url || !token || !npub}
                onClick={() =>
                  void pair({
                    endpoint: { maker_npub: npub.trim(), url: url.trim() },
                    token: token.trim(),
                  })
                }
                size="sm"
                variant="outline"
              >
                {tm('pair.useEndpoint')}
              </Button>
            </div>
          </div>
        )}
        {error && <p className="text-caption text-status-danger">{error}</p>}
      </div>
    </Panel>
  )
}

function SelfPairing({ backend, view, onView, onNext }: Props) {
  const tm = useMk()
  const own = !!view.endpoint
  const [target, setTarget] = useState<'local' | 'own'>(own ? 'own' : 'local')
  const [url, setUrl] = useState(view.endpoint?.url ?? '')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ready = target === 'local' ? !own : own && view.has_token

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      onView(
        await backend.pair(
          target === 'local'
            ? {}
            : {
                endpoint: { maker_npub: '', url: url.trim() },
                token: token.trim(),
              }
        )
      )
      setToken('')
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel>
      <div className="flex flex-col gap-4">
        <SectionTitle hint={tm('pair.selfHint')}>
          {tm('pair.selfTitle')}
        </SectionTitle>
        <div className="grid gap-3 md:grid-cols-2">
          <ChoiceCard
            onSelect={() => setTarget('local')}
            selected={target === 'local'}
            title={tm('pair.local')}
          >
            {tm('pair.localBody')}
          </ChoiceCard>
          <ChoiceCard
            onSelect={() => setTarget('own')}
            selected={target === 'own'}
            title={tm('pair.own')}
          >
            {tm('pair.ownBody')}
          </ChoiceCard>
        </div>
        {target === 'own' && (
          <div className="grid gap-3 md:grid-cols-2">
            <TextField
              id="maker-own-url"
              label={tm('pair.url')}
              mono
              onChange={setUrl}
              placeholder="https://…"
              value={url}
            />
            <TextField
              id="maker-own-token"
              label={tm('pair.token')}
              mono
              onChange={setToken}
              value={token}
            />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={busy || (target === 'own' && (!url || !token))}
            isLoading={busy}
            onClick={() => void save()}
            variant={ready ? 'outline' : 'primary'}
          >
            {tm('pair.save')}
          </Button>
          {ready && <Button onClick={onNext}>{tm('pair.next')}</Button>}
        </div>
        {error && <p className="text-caption text-status-danger">{error}</p>}
      </div>
    </Panel>
  )
}
