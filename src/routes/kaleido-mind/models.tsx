// Models — browse the catalog, download/delete models, and start/stop the brain
// on a given model.

import {
  AlertTriangle,
  Cpu,
  Download,
  HardDrive,
  MemoryStick,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react'
import React, { useMemo, useState } from 'react'

import { MindCard, gb, useMindContext } from './shared'

/** Shimmer placeholder rows shown while the catalog is being fetched. */
const CatalogSkeleton: React.FC = () => (
  <div className="flex flex-col gap-2">
    {[0, 1, 2].map((i) => (
      <div
        className="flex items-center justify-between rounded-lg border border-border-default bg-surface-overlay/30 px-3 py-3"
        key={i}
      >
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3.5 w-40 animate-pulse rounded bg-surface-overlay" />
          <div className="h-2.5 w-56 animate-pulse rounded bg-surface-overlay/70" />
        </div>
        <div className="h-7 w-16 animate-pulse rounded-md bg-surface-overlay" />
      </div>
    ))}
  </div>
)

export const ModelsManager: React.FC = () => {
  const mind = useMindContext()
  const { status } = mind
  const providerOn = status?.on === true
  const [showCustom, setShowCustom] = useState(false)
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [customError, setCustomError] = useState('')

  const installedIds = useMemo(
    () => new Set(mind.installed.map((m) => m.id)),
    [mind.installed]
  )

  const isEmpty = mind.catalog.length === 0
  // First catalog entry is the provider's recommended model (see start-brain-modal).
  const recommendedId = mind.catalog[0]?.id

  return (
    <MindCard>
      <div className="mb-1 flex items-center gap-2">
        <Cpu className="h-5 w-5 text-content-secondary" />
        <h2 className="font-semibold text-content-primary">Models</h2>
        {!isEmpty && (
          <span className="rounded-full bg-surface-overlay px-2 py-0.5 text-[10px] font-medium text-content-tertiary">
            {mind.installed.length} installed · {mind.catalog.length} available
          </span>
        )}
        <button
          className="ml-auto flex items-center gap-1 rounded-md border border-border-default px-2.5 py-1 text-xs text-content-secondary hover:bg-surface-overlay"
          onClick={() => setShowCustom((v) => !v)}
          type="button"
        >
          <Plus className="h-3.5 w-3.5" /> Hugging Face
        </button>
      </div>
      <p className="mb-3 text-xs text-content-tertiary">
        Pick a model to run the brain on. Larger models are smarter but need
        more RAM and run slower.
      </p>
      {showCustom && (
        <form
          className="mb-4 grid gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3"
          onSubmit={(e) => {
            e.preventDefault()
            setCustomError('')
            void mind
              .addHuggingFaceModel(url, name || undefined)
              .then(() => {
                setUrl('')
                setName('')
                setShowCustom(false)
              })
              .catch((err) =>
                setCustomError(err instanceof Error ? err.message : String(err))
              )
          }}
        >
          <p className="text-xs text-content-tertiary">
            Paste a public Hugging Face repository URL. Kaleido selects the
            recommended GGUF automatically.
          </p>
          <input
            className="rounded-md border border-border-default bg-surface-overlay px-3 py-2 text-sm text-content-primary"
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://huggingface.co/owner/model-GGUF"
            type="url"
            value={url}
          />
          <input
            className="rounded-md border border-border-default bg-surface-overlay px-3 py-2 text-sm text-content-primary"
            onChange={(e) => setName(e.target.value)}
            placeholder="Display name (optional)"
            value={name}
          />
          {customError && (
            <p className="text-xs text-status-danger">{customError}</p>
          )}
          <button
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-surface-base disabled:opacity-40"
            disabled={!url.trim()}
            type="submit"
          >
            Add &amp; download
          </button>
        </form>
      )}

      {/* States: loading skeleton → error+retry → catalog list. */}
      {isEmpty && mind.catalogLoading ? (
        <CatalogSkeleton />
      ) : isEmpty && mind.catalogError ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-status-danger/30 bg-status-danger/5 px-4 py-8 text-center">
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
        <div className="rounded-lg border border-border-default bg-surface-overlay/30 px-4 py-8 text-center text-sm text-content-tertiary">
          No models available yet.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {mind.catalog.map((m) => {
            const isInstalled = installedIds.has(m.id)
            const isActive = status?.activeModelId === m.id && providerOn
            const dl = mind.downloads[m.id]
            const downloading = typeof dl === 'number'
            const isRecommended = m.id === recommendedId
            return (
              <div
                className={`rounded-lg border px-3 py-2.5 transition-colors ${
                  isActive
                    ? 'border-status-success/40 bg-status-success/5'
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
                      {isActive ? (
                        <span className="rounded-full bg-status-success/20 px-2 py-0.5 text-[10px] font-semibold text-status-success">
                          Running
                        </span>
                      ) : isInstalled ? (
                        <span className="rounded-full bg-surface-overlay px-2 py-0.5 text-[10px] font-semibold text-content-secondary">
                          Installed
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-content-tertiary">
                      <span>{m.quant}</span>
                      <span className="inline-flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        {gb(m.sizeBytes)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MemoryStick className="h-3 w-3" />~{m.ramHintGb} GB RAM
                      </span>
                    </div>
                    {m.notes && (
                      <p className="mt-1 truncate text-xs text-content-tertiary/80">
                        {m.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {downloading ? (
                      <button
                        className="rounded p-1 text-content-tertiary hover:bg-surface-overlay hover:text-status-danger"
                        onClick={() => mind.cancelDownload(m.id)}
                        title="Cancel download"
                        type="button"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : isInstalled ? (
                      <>
                        {isActive ? (
                          <button
                            className="flex items-center gap-1 rounded-md bg-status-danger px-2.5 py-1 text-xs font-medium text-white hover:bg-status-danger/90"
                            onClick={() => mind.stopProvider()}
                            type="button"
                          >
                            <Square className="h-3.5 w-3.5" /> Stop
                          </button>
                        ) : (
                          <button
                            className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-surface-base hover:bg-primary-emphasis disabled:opacity-40"
                            disabled={providerOn}
                            onClick={() => mind.startProvider(m.id)}
                            type="button"
                          >
                            <Play className="h-3.5 w-3.5" /> Start
                          </button>
                        )}
                        <button
                          className="rounded p-1 text-content-tertiary hover:bg-surface-overlay hover:text-status-danger disabled:opacity-30"
                          disabled={isActive}
                          onClick={() => mind.deleteModel(m.id)}
                          title="Delete"
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        className="flex items-center gap-1 rounded-md border border-border-default px-2.5 py-1 text-xs text-content-secondary hover:bg-surface-overlay"
                        onClick={() => mind.downloadModel(m.id)}
                        type="button"
                      >
                        <Download className="h-3.5 w-3.5" /> Get
                      </button>
                    )}
                  </div>
                </div>

                {/* Download progress bar (spans the full row). */}
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
    </MindCard>
  )
}

// The standalone /kaleido-mind/models route renders the same manager that the
// Brain page embeds as a section.
export const Component = ModelsManager
