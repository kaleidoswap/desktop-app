// Pairing — show the P2P pairing QR so the phone can delegate inference to this
// desktop brain. `PairingPanel` is reused both as a modal (from Brain) and as
// the standalone /kaleido-mind/pairing page (which adds a back button).

import { ArrowLeft, Check, Copy, Loader2, Users } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { KALEIDO_MIND_BRAIN_PATH } from '../../app/router/paths'

import { MindCard, useMindContext } from './shared'

/** The QR + states, with no surrounding navigation (works in a modal or page). */
export const PairingPanel: React.FC = () => {
  const mind = useMindContext()
  const { status } = mind
  const providerOn = status?.on === true
  // The pubkey arrives on a separate `pubkey` event after P2P bootstraps, so the
  // brain can be ON for a moment before the key (and QR) are ready.
  const preparing = (providerOn && !status?.publicKey) || !!mind.loading

  // Structured pairing payload the phone parses (services/PairingService.ts).
  // The phone also accepts a bare public key, but the structured form carries
  // the device name + active model so the pairing UI is informative.
  const qrValue = useMemo(() => {
    if (!status?.publicKey) return ''
    return JSON.stringify({
      issued_at: Math.floor(Date.now() / 1000),
      model: status.activeModelName ?? '',
      name: 'KaleidoSwap Desktop',
      publicKey: status.publicKey,
      type: 'kaleido-mind-pair',
      v: 1,
    })
  }, [status?.publicKey, status?.activeModelName])

  const [copied, setCopied] = useState(false)
  const copyKey = async () => {
    if (!status?.publicKey) return
    try {
      await navigator.clipboard.writeText(status.publicKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <MindCard>
      <div className="mb-3 flex items-center gap-2">
        <Users className="h-5 w-5 text-content-secondary" />
        <h2 className="font-semibold text-content-primary">Pair your phone</h2>
      </div>

      {providerOn && status?.publicKey ? (
        // ── Ready: show the QR ──
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-lg bg-white p-3">
            <QRCodeSVG level="M" size={196} value={qrValue} />
          </div>
          <button
            className="flex items-center gap-2 rounded-md border border-border-default px-3 py-1.5 text-xs text-content-secondary hover:bg-surface-overlay"
            onClick={copyKey}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span className="font-mono">
              {status.publicKey.slice(0, 10)}…{status.publicKey.slice(-6)}
            </span>
          </button>
          <p className="max-w-sm text-center text-xs text-content-tertiary">
            In the KaleidoSwap app: AI → Settings → “Scan QR from desktop” (or
            paste the key).
          </p>
          {status.peers.length > 0 && (
            <div className="mt-1 w-full max-w-sm rounded-md bg-surface-overlay/60 p-2 text-center text-xs text-content-secondary">
              {status.peers.length} phone
              {status.peers.length > 1 ? 's' : ''} connected
            </div>
          )}
        </div>
      ) : preparing ? (
        // ── Preparing: brain starting / P2P bootstrapping — loading QR ──
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-[218px] w-[218px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-default bg-surface-base/50">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <span className="text-xs text-content-tertiary">
              {mind.loading?.message ?? 'Preparing pairing code…'}
            </span>
          </div>
          <p className="max-w-sm text-center text-xs text-content-tertiary">
            Establishing the secure P2P channel. The QR appears as soon as the
            brain is online.
          </p>
        </div>
      ) : (
        // ── Off: prompt to start the brain ──
        <p className="text-sm text-content-tertiary">
          Start the brain with a model (in Brain) to show a pairing QR. The
          phone scans it to run inference here instead of on-device.
        </p>
      )}
    </MindCard>
  )
}

export const Component: React.FC = () => {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col gap-4">
      <button
        className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border-default px-2.5 py-1.5 text-sm text-content-secondary transition-colors hover:bg-surface-overlay hover:text-content-primary"
        onClick={() => navigate(KALEIDO_MIND_BRAIN_PATH)}
        type="button"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Brain
      </button>
      <PairingPanel />
    </div>
  )
}
