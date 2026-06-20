// RuntimeInstall — first-run gate for KaleidoMind. The agent runtime (~1.7 GB:
// the local model engine + tool server + Node) isn't shipped in the installer;
// it's downloaded on demand the first time you enable KaleidoMind, so the app
// download stays small. The Mind layout renders this whenever the runtime isn't
// available yet (and never in dev, where the sibling repos are used).

import { AlertTriangle, Cpu, Download, Loader2 } from 'lucide-react'
import React from 'react'

import type { UseMindResult } from '../../hooks/useMind'

function fmtMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
}

const PHASE_LABEL: Record<string, string> = {
  downloading: 'Downloading',
  error: 'Failed',
  extracting: 'Installing',
  verifying: 'Verifying',
}

export const RuntimeInstall: React.FC<{ mind: UseMindResult }> = ({ mind }) => {
  const p = mind.runtimeProgress
  const busy = p !== null && p.phase !== 'error'
  const pct =
    p && p.total > 0
      ? Math.min(100, Math.round((p.downloaded / p.total) * 100))
      : null

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-violet-700/40 bg-violet-900/10 p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-500/15">
          <Cpu className="h-7 w-7 text-violet-300" />
        </div>
        <h2 className="text-lg font-semibold text-white">Set up KaleidoMind</h2>
        <p className="mt-2 text-sm text-gray-400">
          KaleidoMind runs a local AI model on this device. The runtime
          (~1.7&nbsp;GB) downloads once — the app installer stays small. You can
          pick and download a model afterwards.
        </p>

        {p && p.phase !== 'error' && (
          <div className="mt-6 text-left">
            <div className="mb-1 flex items-center justify-between text-xs text-violet-200">
              <span>
                {PHASE_LABEL[p.phase] ?? p.phase}
                {p.phase === 'downloading' && p.total > 0
                  ? ` · ${fmtMB(p.downloaded)} / ${fmtMB(p.total)}`
                  : ''}
              </span>
              {pct !== null && p.phase === 'downloading' ? (
                <span>{pct}%</span>
              ) : null}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-violet-950/60">
              <div
                className="h-full rounded-full bg-violet-400 transition-all"
                style={{
                  width:
                    pct !== null && p.phase === 'downloading'
                      ? `${pct}%`
                      : '100%',
                }}
              />
            </div>
            {p.phase !== 'downloading' && (
              <div className="mt-2 flex items-center gap-2 text-xs text-violet-200">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{PHASE_LABEL[p.phase] ?? p.phase}…</span>
              </div>
            )}
          </div>
        )}

        {p?.phase === 'error' && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-700/40 bg-red-900/20 p-3 text-left text-xs text-red-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{p.message ?? 'Download failed. Please try again.'}</span>
          </div>
        )}

        <button
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy}
          onClick={() => void mind.installRuntime()}
          type="button"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Setting up…
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              {p?.phase === 'error' ? 'Retry download' : 'Download KaleidoMind'}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
