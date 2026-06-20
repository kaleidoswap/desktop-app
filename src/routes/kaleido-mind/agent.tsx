// Agent — the autonomy control surface. Lists scheduled tasks (the agent's
// "task brain"), arms/disarms the scheduler, shows run history + cost, and
// gates autonomous spending behind a dry-run / risk-limit switch.

import {
  Activity,
  AlertTriangle,
  Check,
  Clock,
  Gauge,
  Loader2,
  Pause,
  PieChart,
  Play,
  Power,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'

import {
  mindClient,
  type AgentState,
  type AgentTask,
  type MindEvent,
  type PortfolioTargets,
} from '../../api/mind'

import { MindCard } from './shared'

function fmtInterval(sec: number): string {
  if (sec <= 0) return 'manual only'
  if (sec < 3600) return `every ${Math.max(1, Math.round(sec / 60))} min`
  if (sec < 86400) return `every ${Math.round(sec / 3600)}h`
  const d = Math.round(sec / 86400)
  return d === 1 ? 'daily' : `every ${d}d`
}

function fmtAgo(ts: number | null): string {
  if (!ts) return 'never run'
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export const Component: React.FC = () => {
  const [tasks, setTasks] = useState<AgentTask[]>([])
  const [agent, setAgent] = useState<AgentState | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [t, s] = await Promise.all([
        mindClient.listTasks(),
        mindClient.getAgentState(),
      ])
      setTasks(t)
      setAgent(s)
    } catch {
      /* sidecar may still be booting */
    }
  }, [])

  useEffect(() => {
    void refresh()
    const off = mindClient.on((e: MindEvent) => {
      if (e.type === 'tasks_changed') setTasks(e.tasks)
      else if (e.type === 'agent_state') setAgent(e.state)
      else if (e.type === 'task_run_finished') void refresh()
    })
    return off
  }, [refresh])

  const dryRun = agent?.risk.dryRun ?? true
  const running = agent?.schedulerRunning ?? false

  const toggleScheduler = async () => {
    setAgent(await mindClient.setScheduler(!running))
  }
  const toggleDryRun = async () => {
    setAgent(await mindClient.setRiskLimits({ dryRun: !dryRun }))
  }
  const saveTargets = async (t: PortfolioTargets) => {
    setAgent(await mindClient.setPortfolioTargets(t))
  }
  const saveLimits = async (g: {
    maxThinkingTokens: number
    maxOutputTokens: number
  }) => {
    setAgent(await mindClient.setGenerationLimits(g))
  }
  const toggleTask = async (t: AgentTask) => {
    await mindClient.updateTask(t.id, { enabled: !t.enabled })
    // tasks_changed event refreshes the list
  }
  const runNow = async (t: AgentTask) => {
    setBusy(t.id)
    try {
      await mindClient.runTask(t.id)
    } catch {
      /* surfaced via run history */
    } finally {
      setBusy(null)
      void refresh()
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Scheduler + dry-run controls */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <MindCard>
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                running
                  ? 'bg-green-600/20 text-green-300'
                  : 'bg-gray-700/40 text-gray-400'
              }`}
            >
              <Power className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-white">Scheduler</h3>
              <p className="mt-0.5 text-xs text-gray-400">
                {running
                  ? 'Enabled tasks fire on their interval while a model is loaded.'
                  : 'Tasks are paused. Turn on to let enabled tasks run automatically.'}
              </p>
            </div>
            <button
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                running
                  ? 'bg-gray-700/60 text-gray-200 hover:bg-gray-700'
                  : 'bg-green-600 text-white hover:bg-green-500'
              }`}
              onClick={() => void toggleScheduler()}
              type="button"
            >
              {running ? (
                <>
                  <Pause className="h-3.5 w-3.5" /> Pause
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" /> Start
                </>
              )}
            </button>
          </div>
        </MindCard>

        <MindCard>
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                dryRun
                  ? 'bg-blue-600/20 text-blue-300'
                  : 'bg-amber-600/20 text-amber-300'
              }`}
            >
              {dryRun ? (
                <ShieldCheck className="h-5 w-5" />
              ) : (
                <ShieldAlert className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-white">
                {dryRun ? 'Dry run — safe' : 'Live spending'}
              </h3>
              <p className="mt-0.5 text-xs text-gray-400">
                {dryRun
                  ? 'Autonomous runs describe what they would do; no funds move.'
                  : 'Autonomous runs may spend within the risk limits below.'}
              </p>
            </div>
            <button
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                dryRun
                  ? 'bg-amber-600 text-white hover:bg-amber-500'
                  : 'bg-blue-600 text-white hover:bg-blue-500'
              }`}
              onClick={() => void toggleDryRun()}
              type="button"
            >
              {dryRun ? 'Go live' : 'Dry run'}
            </button>
          </div>
        </MindCard>
      </div>

      {/* Risk limits */}
      {agent && (
        <MindCard>
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Risk limits</h3>
            <span className="ml-auto text-xs text-gray-500">
              enforced on every autonomous spend
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Limit label="Max spend" value={`$${agent.risk.maxSpendUsd}`} />
            <Limit
              label="Auto-approve ≤"
              value={`$${agent.risk.autoApproveUnderUsd}`}
            />
            <Limit
              label="BTC reserve"
              value={`${agent.risk.minBtcReserveSat.toLocaleString()} sat`}
            />
            <Limit
              label="Stop-loss"
              value={`${agent.risk.stopLossBtcSat.toLocaleString()} sat`}
            />
          </div>
        </MindCard>
      )}

      {/* Portfolio targets */}
      {agent && <TargetsCard onSave={saveTargets} targets={agent.targets} />}

      {/* Response limits — bound how long a turn can take (token caps) */}
      {agent && (
        <LimitsCard generation={agent.generation} onSave={saveLimits} />
      )}

      {/* Tasks */}
      <MindCard>
        <div className="mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-white">Scheduled tasks</h3>
          <span className="ml-auto text-xs text-gray-500">
            {tasks.filter((t) => t.enabled).length} of {tasks.length} enabled
          </span>
        </div>
        {tasks.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500">
            No tasks yet.
          </p>
        ) : (
          <div className="space-y-2">
            {tasks.map((t) => (
              <div
                className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900/40 p-3"
                key={t.id}
              >
                <button
                  aria-label={t.enabled ? 'Disable task' : 'Enable task'}
                  className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
                    t.enabled ? 'bg-green-500' : 'bg-gray-600'
                  }`}
                  onClick={() => void toggleTask(t)}
                  type="button"
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                      t.enabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-white">
                      {t.name}
                    </p>
                    <span className="rounded bg-violet-600/20 px-1.5 py-0.5 text-[0.65rem] font-medium text-violet-300">
                      {t.skill}
                    </span>
                  </div>
                  <p className="truncate text-xs text-gray-400">
                    {fmtInterval(t.scheduleSec)} · last {fmtAgo(t.lastRunAt)}
                  </p>
                </div>
                <button
                  className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-2.5 py-1.5 text-xs text-gray-200 hover:bg-gray-800 disabled:opacity-50"
                  disabled={busy === t.id}
                  onClick={() => void runNow(t)}
                  type="button"
                >
                  {busy === t.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  Run now
                </button>
              </div>
            ))}
          </div>
        )}
      </MindCard>

      {/* Run history */}
      <MindCard>
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-white">Recent runs</h3>
          {agent && (
            <span className="ml-auto text-xs text-gray-500">
              {agent.cumulative.usd > 0
                ? `$${agent.cumulative.usd.toFixed(4)} spent`
                : 'local model — no API cost'}
            </span>
          )}
        </div>
        {!agent || agent.recent.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500">
            No runs yet. Enable a task or hit “Run now”.
          </p>
        ) : (
          <div className="space-y-1.5">
            {agent.recent.slice(0, 12).map((r, i) => (
              <div
                className="flex items-center gap-3 rounded px-2 py-1.5 text-xs hover:bg-gray-800/60"
                key={`${r.taskId}-${r.startedAt}-${i}`}
              >
                <span
                  className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                    r.ok ? 'bg-green-400' : 'bg-red-400'
                  }`}
                />
                <span className="w-32 flex-shrink-0 truncate font-medium text-gray-200">
                  {r.taskName}
                </span>
                <span className="truncate text-gray-400">
                  {r.ok ? r.text || 'ok' : (r.error ?? 'failed')}
                </span>
                <span className="ml-auto flex-shrink-0 text-gray-500">
                  {r.toolCalls} tools · {Math.round(r.durationMs / 100) / 10}s ·{' '}
                  {fmtAgo(r.startedAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </MindCard>
    </div>
  )
}

const Limit: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-3 py-2">
    <p className="text-[0.65rem] uppercase tracking-wide text-gray-500">
      {label}
    </p>
    <p className="mt-0.5 font-mono text-sm text-gray-100">{value}</p>
  </div>
)

const TargetInput: React.FC<{
  label: string
  value: number
  onChange: (v: number) => void
}> = ({ label, onChange, value }) => (
  <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-3 py-2">
    <p className="text-[0.65rem] uppercase tracking-wide text-gray-500">
      {label}
    </p>
    <input
      className="mt-0.5 w-full bg-transparent font-mono text-sm text-gray-100 focus:outline-none"
      inputMode="numeric"
      onChange={(e) => onChange(Number(e.target.value))}
      type="number"
      value={value}
    />
  </div>
)

/** Editable BTC/USDT/XAUT target weights + drift trigger; saves to the agent. */
const TargetsCard: React.FC<{
  targets: PortfolioTargets
  onSave: (t: PortfolioTargets) => Promise<void>
}> = ({ onSave, targets }) => {
  const [draft, setDraft] = useState<PortfolioTargets>(targets)
  const [saving, setSaving] = useState(false)
  // Re-sync if the upstream targets change (another client / a save round-trip).
  useEffect(() => setDraft(targets), [targets])

  const sum = draft.btcPct + draft.usdtPct + draft.xautPct
  const dirty =
    draft.btcPct !== targets.btcPct ||
    draft.usdtPct !== targets.usdtPct ||
    draft.xautPct !== targets.xautPct ||
    draft.driftThresholdPct !== targets.driftThresholdPct
  const set = (k: keyof PortfolioTargets, v: number) =>
    setDraft((d) => ({ ...d, [k]: Number.isFinite(v) ? v : 0 }))
  const save = async () => {
    setSaving(true)
    try {
      await onSave(draft)
    } finally {
      setSaving(false)
    }
  }

  return (
    <MindCard>
      <div className="mb-3 flex items-center gap-2">
        <PieChart className="h-4 w-4 text-violet-400" />
        <h3 className="text-sm font-semibold text-white">Portfolio targets</h3>
        <span
          className={`ml-auto text-xs ${sum === 100 ? 'text-gray-500' : 'text-amber-400'}`}
        >
          {sum === 100 ? 'sums to 100%' : `sum = ${sum}% (must be 100%)`}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <TargetInput
          label="BTC %"
          onChange={(v) => set('btcPct', v)}
          value={draft.btcPct}
        />
        <TargetInput
          label="USDT %"
          onChange={(v) => set('usdtPct', v)}
          value={draft.usdtPct}
        />
        <TargetInput
          label="XAUT %"
          onChange={(v) => set('xautPct', v)}
          value={draft.xautPct}
        />
        <TargetInput
          label="Drift trigger %"
          onChange={(v) => set('driftThresholdPct', v)}
          value={draft.driftThresholdPct}
        />
      </div>
      <div className="mt-3 flex justify-end">
        <button
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
          disabled={!dirty || sum !== 100 || saving}
          onClick={() => void save()}
          type="button"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Save targets
        </button>
      </div>
    </MindCard>
  )
}

/** Editable thinking + total-output token caps (0 = uncapped); saves live. */
const LimitsCard: React.FC<{
  generation: { maxThinkingTokens: number; maxOutputTokens: number }
  onSave: (g: {
    maxThinkingTokens: number
    maxOutputTokens: number
  }) => Promise<void>
}> = ({ generation, onSave }) => {
  const [draft, setDraft] = useState(generation)
  const [saving, setSaving] = useState(false)
  useEffect(() => setDraft(generation), [generation])

  const clamp = (v: number) =>
    Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0
  const dirty =
    draft.maxThinkingTokens !== generation.maxThinkingTokens ||
    draft.maxOutputTokens !== generation.maxOutputTokens
  const save = async () => {
    setSaving(true)
    try {
      await onSave(draft)
    } finally {
      setSaving(false)
    }
  }

  return (
    <MindCard>
      <div className="mb-3 flex items-center gap-2">
        <Gauge className="h-4 w-4 text-violet-400" />
        <h3 className="text-sm font-semibold text-white">Response limits</h3>
        <span className="ml-auto text-xs text-gray-500">
          0 = uncapped · ~30 tokens/sec
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TargetInput
          label="Max thinking tokens"
          onChange={(v) =>
            setDraft((d) => ({ ...d, maxThinkingTokens: clamp(v) }))
          }
          value={draft.maxThinkingTokens}
        />
        <TargetInput
          label="Max response tokens"
          onChange={(v) =>
            setDraft((d) => ({ ...d, maxOutputTokens: clamp(v) }))
          }
          value={draft.maxOutputTokens}
        />
      </div>
      <div className="mt-3 flex justify-end">
        <button
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
          disabled={!dirty || saving}
          onClick={() => void save()}
          type="button"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Save limits
        </button>
      </div>
    </MindCard>
  )
}
