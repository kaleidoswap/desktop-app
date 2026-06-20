// Brain — KaleidoMind control panel. A compact, screen-fitting hub: start/stop
// the brain (with a clear "start a model" prompt when it's off), and open Models,
// Skills, Pairing and Activity in modals so the page never overflows.

import {
  Activity,
  Check,
  ChevronRight,
  Copy,
  Cpu,
  Gauge,
  KeyRound,
  Loader2,
  Play,
  Power,
  QrCode,
  Sparkles,
  Square,
  Users,
  Zap,
} from 'lucide-react'
import React, { useState } from 'react'

import { Modal } from '../../components/ui/Modal'

import { ModelsManager } from './models'
import { PairingPanel } from './pairing'
import { useMindContext } from './shared'
import { SkillsManager } from './skills'

type ActiveModal = null | 'models' | 'skills' | 'pairing' | 'activity'

/** A tappable tile in the quick-actions grid. */
const ActionTile: React.FC<{
  icon: React.ReactNode
  label: string
  hint: string
  onClick: () => void
}> = ({ icon, label, hint, onClick }) => (
  <button
    className="group flex items-center gap-3 rounded-xl border border-border-default bg-surface-overlay/40 p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-surface-overlay"
    onClick={onClick}
    type="button"
  >
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
      {icon}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-semibold text-content-primary">
        {label}
      </span>
      <span className="block truncate text-xs text-content-tertiary">
        {hint}
      </span>
    </span>
    <ChevronRight className="h-4 w-4 shrink-0 text-content-tertiary transition-transform group-hover:translate-x-0.5" />
  </button>
)

export const Component: React.FC = () => {
  const mind = useMindContext()
  const { status } = mind
  const providerOn = status?.on === true
  const loading = mind.loading

  const installed = mind.installed
  const [selectedModel, setSelectedModel] = useState<string>('')
  const startModelId = selectedModel || installed[0]?.id || ''
  const [modal, setModal] = useState<ActiveModal>(null)
  const [copied, setCopied] = useState(false)

  const device = status?.inferenceDevice
  const onGpu = device === 'gpu'
  const deviceLabel = onGpu
    ? 'Metal/GPU'
    : device === 'cpu'
      ? 'CPU'
      : device === 'mock'
        ? 'Mock'
        : 'detecting'
  const tps = status?.tokensPerSecond
  const peers = status?.peers.length ?? 0
  const enabledSkills =
    mind.capabilities?.skills.filter((s) => s.enabled).length ?? 0
  const toolCount = mind.capabilities?.tools.length ?? 0

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
    <div className="flex flex-col gap-4">
      {/* ── Hero: status + start/stop ──────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-border-default bg-surface-base/50">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3.5">
            <span
              className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                providerOn ? 'bg-primary/15' : 'bg-surface-overlay'
              }`}
            >
              <Power
                className={`h-6 w-6 ${providerOn ? 'text-primary' : 'text-content-tertiary'}`}
              />
              {providerOn && (
                <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full border-2 border-surface-base bg-status-success" />
              )}
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-content-primary">
                {providerOn
                  ? 'Brain is online'
                  : loading
                    ? 'Starting the brain…'
                    : 'Brain is offline'}
              </h2>
              <p className="truncate text-sm text-content-tertiary">
                {providerOn
                  ? (status?.activeModelName ?? 'Running')
                  : loading
                    ? (loading.message ?? 'Loading model…')
                    : 'Start a model to chat, run skills, and pair a phone.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            {providerOn ? (
              <button
                className="inline-flex items-center gap-1.5 rounded-lg border border-status-danger/40 bg-status-danger/10 px-3 py-2 text-sm font-medium text-status-danger transition-colors hover:bg-status-danger/20"
                onClick={() => mind.stopProvider()}
                type="button"
              >
                <Square className="h-4 w-4" /> Stop brain
              </button>
            ) : installed.length > 0 ? (
              <>
                <select
                  className="rounded-lg border border-border-default bg-surface-overlay px-2.5 py-2 text-sm text-content-primary focus:border-primary focus:outline-none disabled:opacity-50"
                  disabled={!!loading}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  value={startModelId}
                >
                  {installed.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName || m.id}
                    </option>
                  ))}
                </select>
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-surface-base transition-all hover:bg-primary-emphasis active:scale-95 disabled:opacity-50"
                  disabled={!startModelId || !!loading}
                  onClick={() =>
                    startModelId && mind.startProvider(startModelId)
                  }
                  type="button"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {loading ? 'Starting…' : 'Start brain'}
                </button>
              </>
            ) : (
              <button
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-surface-base transition-all hover:bg-primary-emphasis active:scale-95"
                onClick={() => setModal('models')}
                type="button"
              >
                <Cpu className="h-4 w-4" /> Get a model
              </button>
            )}
          </div>
        </div>

        {/* Live stats strip — only meaningful when running. */}
        {providerOn && (
          <div className="grid grid-cols-3 divide-x divide-divider/10 border-t border-divider/10">
            <div className="px-4 py-3">
              <div className="flex items-center gap-1.5 text-xs text-content-tertiary">
                {onGpu ? (
                  <Zap className="h-3.5 w-3.5" />
                ) : (
                  <Cpu className="h-3.5 w-3.5" />
                )}
                Backend
              </div>
              <div
                className={`mt-0.5 text-sm font-semibold ${
                  onGpu
                    ? 'text-status-success'
                    : device === 'cpu'
                      ? 'text-status-warning'
                      : 'text-content-primary'
                }`}
              >
                {deviceLabel}
              </div>
            </div>
            <div className="px-4 py-3">
              <div className="flex items-center gap-1.5 text-xs text-content-tertiary">
                <Gauge className="h-3.5 w-3.5" />
                Throughput
              </div>
              <div className="mt-0.5 text-sm font-semibold text-content-primary">
                {typeof tps === 'number' && tps > 0
                  ? `${tps.toFixed(0)} tok/s`
                  : '—'}
              </div>
            </div>
            <div className="px-4 py-3">
              <div className="flex items-center gap-1.5 text-xs text-content-tertiary">
                <Users className="h-3.5 w-3.5" />
                Paired
              </div>
              <div className="mt-0.5 text-sm font-semibold text-content-primary">
                {peers}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Quick actions (open in modals / navigate) ──────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2">
        <ActionTile
          hint={`${installed.length} installed`}
          icon={<Cpu className="h-5 w-5" />}
          label="Models"
          onClick={() => setModal('models')}
        />
        <ActionTile
          hint={
            mind.capabilities
              ? `${enabledSkills} skills · ${toolCount} tools`
              : 'Skills & MCP tools'
          }
          icon={<Sparkles className="h-5 w-5" />}
          label="Skills & tools"
          onClick={() => setModal('skills')}
        />
        <ActionTile
          hint={
            providerOn ? `${peers} phone(s) paired` : 'Delegate from a phone'
          }
          icon={<QrCode className="h-5 w-5" />}
          label="Phone pairing"
          onClick={() => setModal('pairing')}
        />
        <ActionTile
          hint={`${mind.logs.length} log line(s)`}
          icon={<Activity className="h-5 w-5" />}
          label="Recent activity"
          onClick={() => setModal('activity')}
        />
      </div>

      {/* ── Provider key (compact) ─────────────────────────────────────── */}
      <section className="flex items-center gap-3 rounded-xl border border-border-default bg-surface-base/50 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-overlay text-content-secondary">
          <KeyRound className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-content-primary">
            Provider key
          </p>
          <p className="truncate text-xs text-content-tertiary">
            {status?.publicKey
              ? 'This brain’s public identity for paired phones.'
              : 'Available once the brain is running.'}
          </p>
        </div>
        {status?.publicKey && (
          <button
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border-default px-2.5 py-1.5 font-mono text-xs text-content-secondary transition-colors hover:bg-surface-overlay"
            onClick={copyKey}
            type="button"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-status-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {status.publicKey.slice(0, 8)}…{status.publicKey.slice(-6)}
          </button>
        )}
      </section>

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      <Modal
        isOpen={modal === 'models'}
        onClose={() => setModal(null)}
        size="lg"
        title="Models"
      >
        <div className="p-4">
          <ModelsManager />
        </div>
      </Modal>

      <Modal
        isOpen={modal === 'skills'}
        onClose={() => setModal(null)}
        size="lg"
        title="Skills & tools"
      >
        <div className="p-4">
          <SkillsManager />
        </div>
      </Modal>

      <Modal
        isOpen={modal === 'pairing'}
        onClose={() => setModal(null)}
        size="sm"
        title="Phone pairing"
      >
        <div className="p-4">
          <PairingPanel />
        </div>
      </Modal>

      <Modal
        isOpen={modal === 'activity'}
        onClose={() => setModal(null)}
        size="md"
        title="Recent activity"
      >
        <div className="p-4">
          <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-border-default bg-surface-base/60 p-3 font-mono text-[11px] leading-relaxed text-content-tertiary">
            {mind.logs.length === 0 ? (
              <span className="text-content-tertiary">
                No log output yet. Start the brain to see model load, inference
                backend and tool activity here.
              </span>
            ) : (
              mind.logs.slice(-200).map((line, i) => <div key={i}>{line}</div>)
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
