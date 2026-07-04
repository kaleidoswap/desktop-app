// BrainLauncher — the onboarding/launch screen shown in place of the chat while
// the brain is offline. It walks a first-time user through the two steps that
// must happen before chat works: (1) download a model, (2) start the brain.
// Once the brain comes online the chat view replaces this automatically.

import {
  AlertTriangle,
  Brain,
  Cpu,
  Download,
  HardDrive,
  MemoryStick,
  Play,
  RefreshCw,
  Settings2,
  Sparkles,
  X,
} from 'lucide-react'
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { KALEIDO_MIND_MODELS_PATH } from '../../app/router/paths'
import type { UseMindResult } from '../../hooks/useMind'

import { gb, labelForPhase } from './shared'
import { LAST_MODEL_KEY } from './start-brain-modal'

/** Shimmer rows while the catalog loads. */
const CatalogSkeleton: React.FC = () => (
  <div className="flex flex-col gap-2">
    {[0, 1, 2].map((i) => (
      <div
        className="flex items-center justify-between rounded-lg border border-border-default bg-surface-overlay/30 px-3 py-3"
        key={i}
      >
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3.5 w-36 animate-pulse rounded bg-surface-overlay" />
          <div className="h-2.5 w-52 animate-pulse rounded bg-surface-overlay/70" />
        </div>
        <div className="h-7 w-16 animate-pulse rounded-md bg-surface-overlay" />
      </div>
    ))}
  </div>
)

/** Step 1 — choose & download a model from the catalog. */
const ChooseModel: React.FC<{ mind: UseMindResult }> = ({ mind }) => {
  const isEmpty = mind.catalog.length === 0
  const recommendedId = mind.catalog[0]?.id

  return (
    <div className="w-full max-w-lg">
      <div className="mb-4 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
          <Cpu className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-base font-semibold text-content-primary">
          Choose a model
        </h2>
        <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-content-tertiary">
          Download a model to run the brain privately on this device. The
          recommended one is a good balance of speed and quality.
        </p>
      </div>

      {isEmpty && mind.catalogLoading ? (
        <CatalogSkeleton />
      ) : isEmpty && mind.catalogError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-status-danger/30 bg-status-danger/5 px-4 py-8 text-center">
          <AlertTriangle className="h-6 w-6 text-status-danger" />
          <div>
            <p className="text-sm font-medium text-content-primary">
              Couldn&apos;t load the model catalog
            </p>
            <p className="mt-1 max-w-xs text-xs text-content-tertiary">
              {mind.catalogError}
            </p>
          </div>
          <button
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-surface-base hover:bg-primary-emphasis"
            onClick={() => void mind.refresh()}
            type="button"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      ) : isEmpty ? (
        <div className="rounded-xl border border-border-default bg-surface-overlay/30 px-4 py-8 text-center text-sm text-content-tertiary">
          No models available yet.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {mind.catalog.map((m) => {
            const dl = mind.downloads[m.id]
            const downloading = typeof dl === 'number'
            const isRecommended = m.id === recommendedId
            return (
              <div
                className={`rounded-xl border px-3.5 py-3 transition-colors ${
                  isRecommended
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border-default bg-surface-overlay/40'
                }`}
                key={m.id}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-content-primary">
                        {m.displayName}
                      </span>
                      {isRecommended && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          <Sparkles className="h-2.5 w-2.5" /> Recommended
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-content-tertiary">
                      <span className="inline-flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        {gb(m.sizeBytes)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MemoryStick className="h-3 w-3" />~{m.ramHintGb} GB RAM
                      </span>
                    </div>
                  </div>
                  {downloading ? (
                    <button
                      className="rounded p-1 text-content-tertiary hover:bg-surface-overlay hover:text-status-danger"
                      onClick={() => mind.cancelDownload(m.id)}
                      title="Cancel download"
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        isRecommended
                          ? 'bg-primary text-surface-base hover:bg-primary-emphasis'
                          : 'border border-border-default text-content-secondary hover:bg-surface-overlay'
                      }`}
                      onClick={() => mind.downloadModel(m.id)}
                      type="button"
                    >
                      <Download className="h-3.5 w-3.5" /> Get
                    </button>
                  )}
                </div>
                {downloading && (
                  <div className="mt-2.5">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-content-tertiary">
                      <span>Downloading…</span>
                      <span className="font-medium text-primary">{dl}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-overlay">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${dl}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Step 2 — start the brain on an installed model. */
const StartBrain: React.FC<{ mind: UseMindResult }> = ({ mind }) => {
  const navigate = useNavigate()
  const { installed, loading, starting } = mind
  const [selected, setSelected] = useState('')

  let lastId: string | null = null
  try {
    lastId = localStorage.getItem(LAST_MODEL_KEY)
  } catch {
    /* ignore */
  }
  const defaultId =
    (lastId && installed.some((m) => m.id === lastId)
      ? lastId
      : installed[0]?.id) ?? ''
  const modelId = selected || defaultId
  const active = installed.find((m) => m.id === modelId)
  const busy = starting || !!loading

  const start = () => {
    if (!modelId) return
    try {
      localStorage.setItem(LAST_MODEL_KEY, modelId)
    } catch {
      /* ignore */
    }
    // loading/providerOn flips → this view is replaced by the chat. On
    // failure mind.starting flips back to false, allowing a retry.
    void mind.startProvider(modelId).catch(() => {})
  }

  if (busy) {
    return (
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-500/30 via-green-500/25 to-teal-600/30 blur-2xl" />
          <div className="relative rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 p-6 shadow-lg shadow-primary/10 ring-1 ring-primary/20 backdrop-blur-2xl">
            <Brain className="relative z-10 h-10 w-10 text-[#15E99A]" />
          </div>
        </div>
        <div className="max-w-lg space-y-4 text-center">
          <p className="bg-gradient-to-r from-white via-emerald-100 to-green-100 bg-clip-text text-xl font-bold text-transparent">
            Starting your brain…
          </p>
          <p className="text-base leading-relaxed text-slate-300">
            {loading ? labelForPhase(loading.phase) : 'Starting…'}
            {typeof loading?.percentage === 'number'
              ? ` · ${loading.percentage}%`
              : ''}
            {loading?.message ? ` — ${loading.message}` : ''}
          </p>
          <div className="mx-auto h-2 w-80 overflow-hidden rounded-full border border-slate-600/40 bg-slate-800/60 shadow-inner backdrop-blur-sm">
            <div className="splash-progress-fill h-full rounded-full shadow-lg" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
        <Brain className="h-6 w-6 text-primary" />
      </div>
      <h2 className="text-base font-semibold text-content-primary">
        Start your brain
      </h2>
      <p className="mx-auto mt-1 max-w-xs text-sm leading-relaxed text-content-tertiary">
        Your model is ready. Start the brain to begin chatting.
      </p>

      <div className="mt-5 space-y-3">
        {installed.length > 1 && (
          <div className="relative">
            <select
              className="appearance-none w-full pl-9 pr-8 py-2 border border-border-default rounded-lg bg-surface-overlay text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-primary"
              onChange={(e) => setSelected(e.target.value)}
              value={modelId}
            >
              {installed.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName || m.id}
                  {m.id === lastId ? ' · last used' : ''}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Cpu className="h-4 w-4 text-content-tertiary" />
            </div>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <svg
                className="h-4 w-4 text-content-tertiary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M19 9l-7 7-7-7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </div>
          </div>
        )}
        <button
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 py-2.5 text-sm font-semibold text-surface-base transition-all hover:bg-primary-emphasis active:scale-95 disabled:opacity-50"
          disabled={!modelId}
          onClick={start}
          type="button"
        >
          <Play className="h-4 w-4" />
          Start {active?.displayName ?? 'brain'}
        </button>
        <button
          className="inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-content-tertiary hover:text-content-primary"
          onClick={() => navigate(KALEIDO_MIND_MODELS_PATH)}
          type="button"
        >
          <Settings2 className="h-3.5 w-3.5" /> Manage models
        </button>
      </div>
    </div>
  )
}

export const BrainLauncher: React.FC<{ mind: UseMindResult }> = ({ mind }) => {
  const hasModel = mind.installed.length > 0

  if (hasModel) {
    return (
      <div className="flex min-h-[440px] flex-1 flex-col items-center justify-center px-5 py-8">
        <StartBrain mind={mind} />
      </div>
    )
  }

  return (
    <section className="flex min-h-[440px] flex-1 flex-col overflow-hidden rounded-2xl border border-border-default bg-surface-base/50">
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-8">
        <ChooseModel mind={mind} />
      </div>
    </section>
  )
}
