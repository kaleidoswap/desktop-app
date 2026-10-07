// Serve models to your phone — the desktop exposes its loaded model over an
// OpenAI-compatible API that Rate reaches on the LAN. `PairingPanel` is reused
// both as a modal (from Brain) and as the standalone /kaleido-mind/pairing page.

import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Smartphone,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import {
  buildPairingPayload,
  remoteBrain,
  type RemoteBrainStatus,
} from '../../api/remoteBrain'
import { KALEIDO_MIND_BRAIN_PATH } from '../../app/router/paths'

import { MindCard, useMindContext } from './shared'

const Toggle: React.FC<{
  checked: boolean
  disabled?: boolean
  label: string
  hint: string
  onChange: (next: boolean) => void
}> = ({ checked, disabled, label, hint, onChange }) => (
  <label className="flex cursor-pointer items-start justify-between gap-4">
    <span className="min-w-0">
      <span className="block text-sm font-medium text-content-primary">
        {label}
      </span>
      <span className="block text-xs text-content-tertiary">{hint}</span>
    </span>
    <input
      checked={checked}
      className="mt-1 h-4 w-4 shrink-0 accent-primary"
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      type="checkbox"
    />
  </label>
)

export const PairingPanel: React.FC = () => {
  const { t } = useTranslation()
  const mind = useMindContext()
  const providerOn = mind.status?.on === true
  const [status, setStatus] = useState<RemoteBrainStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    remoteBrain
      .status()
      .then(setStatus)
      .catch((e) => setError(String(e)))
  }, [])

  const run = useCallback(async (op: () => Promise<RemoteBrainStatus>) => {
    setBusy(true)
    setError(null)
    try {
      setStatus(await op())
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }, [])

  const payload = useMemo(
    () => buildPairingPayload(status, mind.status?.activeModelName ?? null),
    [status, mind.status?.activeModelName]
  )

  const enabled = status?.enabled ?? false
  const lan = status?.lan ?? false
  const shownError = error ?? status?.error

  return (
    <MindCard>
      <div className="mb-3 flex items-center gap-2">
        <Smartphone className="h-5 w-5 text-content-secondary" />
        <h2 className="font-semibold text-content-primary">
          {t('remoteBrain.title')}
        </h2>
      </div>
      <p className="mb-4 text-sm text-content-tertiary">
        {t('remoteBrain.description')}
      </p>

      <div className="flex flex-col gap-3">
        <Toggle
          checked={enabled}
          disabled={busy || !status}
          hint={t('remoteBrain.enableHint')}
          label={t('remoteBrain.enable')}
          onChange={(next) => run(() => remoteBrain.configure(next, lan))}
        />
        <Toggle
          checked={lan}
          disabled={busy || !status}
          hint={t('remoteBrain.lanHint')}
          label={t('remoteBrain.lan')}
          onChange={(next) => run(() => remoteBrain.configure(enabled, next))}
        />
      </div>

      {lan && (
        <div className="mt-4 flex gap-2 rounded-md border border-status-warning/40 bg-status-warning/10 p-3 text-xs text-content-secondary">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" />
          <span>{t('remoteBrain.plainHttpWarning')}</span>
        </div>
      )}

      {shownError && (
        <p className="mt-3 text-xs text-status-danger">
          {t('remoteBrain.error', { error: shownError })}
        </p>
      )}

      <div className="mt-4 flex flex-col items-center gap-3">
        {busy ? (
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        ) : payload ? (
          <>
            <div className="rounded-lg bg-white p-3">
              <QRCodeSVG level="M" size={196} value={JSON.stringify(payload)} />
            </div>
            <p className="font-mono text-xs text-content-secondary">
              {payload.baseUrl}
            </p>
            <p className="max-w-sm text-center text-xs text-content-tertiary">
              {t('remoteBrain.scanHint')}
            </p>
            {!providerOn && (
              <p className="max-w-sm text-center text-xs text-status-warning">
                {t('remoteBrain.startModelHint')}
              </p>
            )}
            <button
              className="flex items-center gap-2 rounded-md border border-border-default px-3 py-1.5 text-xs text-content-secondary hover:bg-surface-overlay"
              disabled={busy}
              onClick={() => run(remoteBrain.rotateToken)}
              type="button"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t('remoteBrain.rotateToken')}
            </button>
            <p className="max-w-sm text-center text-[11px] text-content-tertiary">
              {t('remoteBrain.rotateHint')}
            </p>
          </>
        ) : enabled && status?.running ? (
          <p className="text-center text-sm text-content-tertiary">
            {t('remoteBrain.localOnly', {
              url: `http://${status.host}:${status.port}/v1`,
            })}
          </p>
        ) : (
          <p className="text-center text-sm text-content-tertiary">
            {t('remoteBrain.off')}
          </p>
        )}
      </div>
    </MindCard>
  )
}

export const Component: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <div className="flex flex-col gap-4">
      <button
        className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border-default px-2.5 py-1.5 text-sm text-content-secondary transition-colors hover:bg-surface-overlay hover:text-content-primary"
        onClick={() => navigate(KALEIDO_MIND_BRAIN_PATH)}
        type="button"
      >
        <ArrowLeft className="h-4 w-4" /> {t('remoteBrain.back')}
      </button>
      <PairingPanel />
    </div>
  )
}
