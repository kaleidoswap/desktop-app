// A prompt that pops up whenever you're in the Mind section and the brain is
// offline, offering to start the latest model in one tap. Mounted for the whole
// Mind layout (kept mounted across sub-tab navigation so `dismissed` persists,
// suppressed only on the chat route via the `suppressed` prop); dismissible,
// and auto-closes once the brain comes online (or while it's loading).

import { Cpu, Play, Rocket } from 'lucide-react'
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { KALEIDO_MIND_BRAIN_PATH } from '../../app/router/paths'
import { Modal } from '../../components/ui/Modal'
import { Select } from '../../components/ui/Select'
import type { UseMindResult } from '../../hooks/useMind'

/** Remembers the last model you started, so "the latest" is the one you used. */
export const LAST_MODEL_KEY = 'kaleido-mind.last-model.v1'

export const StartBrainModal: React.FC<{
  mind: UseMindResult
  suppressed?: boolean
}> = ({ mind, suppressed = false }) => {
  const navigate = useNavigate()
  const { status, installed, loading, starting } = mind
  const providerOn = status?.on === true
  const [dismissed, setDismissed] = useState(false)
  const [selected, setSelected] = useState('')

  // "Latest" = the model you last ran (persisted), else the first installed
  // (the catalog lists the recommended model first).
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
  const activeModel = installed.find((m) => m.id === modelId)

  // Show once the sidecar has reported status (avoid flashing during boot) and
  // the brain is off, idle, not mid-start, not dismissed this visit, and not on
  // the chat route (which has its own inline launcher).
  const open =
    status !== null &&
    !providerOn &&
    !loading &&
    !starting &&
    !dismissed &&
    !suppressed

  const start = () => {
    if (!modelId) return
    try {
      localStorage.setItem(LAST_MODEL_KEY, modelId)
    } catch {
      /* ignore */
    }
    // mind.starting flips false again on failure, which reopens this modal
    // (status/loading are still "off") so the user can retry.
    void mind.startProvider(modelId).catch(() => {})
  }

  return (
    <Modal
      isOpen={open}
      onClose={() => setDismissed(true)}
      size="sm"
      title="Start KaleidoMind"
    >
      <div className="space-y-4 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Rocket className="h-5 w-5" />
          </span>
          <p className="text-sm text-content-secondary">
            Your brain is offline. Start a model to chat, run skills, and pair
            your phone.
          </p>
        </div>

        {installed.length > 0 ? (
          <>
            {installed.length > 1 && (
              <div className="block">
                <span className="mb-1 block text-xs text-content-tertiary">
                  Model
                </span>
                <Select
                  icon={<Cpu className="h-4 w-4" />}
                  onChange={(val) => setSelected(val)}
                  options={installed.map((m) => ({
                    label: `${m.displayName || m.id}${m.id === lastId ? ' · last used' : ''}`,
                    value: m.id,
                  }))}
                  value={modelId}
                />
              </div>
            )}
            <div className="flex gap-2">
              <button
                className="flex-1 rounded-lg border border-border-default px-3 py-2 text-sm text-content-secondary transition-colors hover:bg-surface-overlay"
                onClick={() => setDismissed(true)}
                type="button"
              >
                Not now
              </button>
              <button
                className="flex-[1.4] inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-surface-base transition-all hover:bg-primary-emphasis active:scale-95 disabled:opacity-50"
                disabled={!modelId}
                onClick={start}
                type="button"
              >
                <Play className="h-4 w-4" />
                Start {activeModel?.displayName ?? 'brain'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-content-tertiary">
              No model is installed yet — grab one to bring the brain online.
            </p>
            <div className="flex gap-2">
              <button
                className="flex-1 rounded-lg border border-border-default px-3 py-2 text-sm text-content-secondary transition-colors hover:bg-surface-overlay"
                onClick={() => setDismissed(true)}
                type="button"
              >
                Not now
              </button>
              <button
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-surface-base transition-all hover:bg-primary-emphasis active:scale-95"
                onClick={() => {
                  setDismissed(true)
                  navigate(KALEIDO_MIND_BRAIN_PATH)
                }}
                type="button"
              >
                <Cpu className="h-4 w-4" /> Get a model
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
