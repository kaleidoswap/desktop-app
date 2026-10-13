// Shown on every Mind page while the sidecar runs without @qvac/sdk: the
// provider then falls back to MOCK mode and every answer is fake.

import { AlertTriangle, Download } from 'lucide-react'
import React from 'react'

import type { ProviderStatusEvent } from '../../api/mind'

export const MockModeBanner: React.FC<{
  device: ProviderStatusEvent['inferenceDevice']
  onDownload: () => void
  busy?: boolean
}> = ({ device, onDownload, busy = false }) => {
  if (device !== 'mock') return null
  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-red-600/50 bg-red-900/25 p-4 sm:flex-row sm:items-center"
      role="alert"
    >
      <AlertTriangle className="h-5 w-5 shrink-0 text-red-300" />
      <div className="flex-1 text-sm text-red-100">
        <p className="font-semibold">
          Mock mode — no local model engine installed
        </p>
        <p className="mt-0.5 text-xs text-red-200/80">
          Answers are fake. Download the KaleidoMind runtime (or point
          KALEIDO_MIND_PROVIDER_DIR at a provider with @qvac/sdk installed) and
          restart the brain.
        </p>
      </div>
      <button
        className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={busy}
        onClick={onDownload}
        type="button"
      >
        <Download className="h-3.5 w-3.5" />
        Download runtime
      </button>
    </div>
  )
}
