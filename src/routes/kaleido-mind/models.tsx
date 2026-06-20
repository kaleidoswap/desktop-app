// Models — browse the catalog, download/delete models, and start/stop the brain
// on a given model.

import { Cpu, Download, Plus, Play, Square, Trash2, X } from 'lucide-react'
import React, { useMemo, useState } from 'react'

import { MindCard, gb, useMindContext } from './shared'

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

  return (
    <MindCard>
      <div className="mb-3 flex items-center gap-2">
        <Cpu className="h-5 w-5 text-content-secondary" />
        <h2 className="font-semibold text-content-primary">Models</h2>
        <button
          className="ml-auto flex items-center gap-1 rounded-md border border-border-default px-2.5 py-1 text-xs text-content-secondary hover:bg-surface-overlay"
          onClick={() => setShowCustom((v) => !v)}
          type="button"
        >
          <Plus className="h-3.5 w-3.5" /> Hugging Face
        </button>
      </div>
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
      <div className="flex flex-col gap-2">
        {mind.catalog.length === 0 && (
          <p className="text-sm text-content-tertiary">Loading catalog…</p>
        )}
        {mind.catalog.map((m) => {
          const isInstalled = installedIds.has(m.id)
          const isActive = status?.activeModelId === m.id && providerOn
          const dl = mind.downloads[m.id]
          const downloading = typeof dl === 'number'
          return (
            <div
              className="flex items-center justify-between rounded-lg border border-border-default bg-surface-overlay/40 px-3 py-2"
              key={m.id}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-content-primary">
                    {m.displayName}
                  </span>
                  {isActive && (
                    <span className="rounded-full bg-status-success/20 px-2 py-0.5 text-[10px] font-semibold text-status-success">
                      Running
                    </span>
                  )}
                </div>
                <div className="text-xs text-content-tertiary">
                  {m.quant} · {gb(m.sizeBytes)} · ~{m.ramHintGb} GB RAM
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {downloading ? (
                  <div className="flex items-center gap-2">
                    <span className="w-10 text-right text-xs text-primary">
                      {dl}%
                    </span>
                    <button
                      className="rounded p-1 text-content-tertiary hover:bg-surface-overlay hover:text-status-danger"
                      onClick={() => mind.cancelDownload(m.id)}
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : isInstalled ? (
                  <>
                    {isActive ? (
                      <button
                        className="flex items-center gap-1 rounded-md bg-status-danger px-2.5 py-1 text-xs font-medium text-white hover:bg-status-danger/90"
                        onClick={() => mind.stopProvider()}
                      >
                        <Square className="h-3.5 w-3.5" /> Stop
                      </button>
                    ) : (
                      <button
                        className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-surface-base hover:bg-primary-emphasis disabled:opacity-40"
                        disabled={providerOn}
                        onClick={() => mind.startProvider(m.id)}
                      >
                        <Play className="h-3.5 w-3.5" /> Start
                      </button>
                    )}
                    <button
                      className="rounded p-1 text-content-tertiary hover:bg-surface-overlay hover:text-status-danger disabled:opacity-30"
                      disabled={isActive}
                      onClick={() => mind.deleteModel(m.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <button
                    className="flex items-center gap-1 rounded-md border border-border-default px-2.5 py-1 text-xs text-content-secondary hover:bg-surface-overlay"
                    onClick={() => mind.downloadModel(m.id)}
                  >
                    <Download className="h-3.5 w-3.5" /> Get
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </MindCard>
  )
}

// The standalone /kaleido-mind/models route renders the same manager that the
// Brain page embeds as a section.
export const Component = ModelsManager
