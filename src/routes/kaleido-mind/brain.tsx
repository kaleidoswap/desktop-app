// Brain — KaleidoMind overview + settings. Summarizes the provider state and
// lets you start/stop the brain; Settings exposes the public key and logs.

import {
  Check,
  Copy,
  Cpu,
  Gauge,
  Play,
  Settings as SettingsIcon,
  Square,
  Users,
} from 'lucide-react'
import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { KALEIDO_MIND_MODELS_PATH } from '../../app/router/paths'

import { MindCard, useMindContext } from './shared'

export const Component: React.FC = () => {
  const mind = useMindContext()
  const navigate = useNavigate()
  const { status } = mind
  const providerOn = status?.on === true

  const installed = mind.installed
  const [selectedModel, setSelectedModel] = useState<string>('')
  const activeModelId = status?.activeModelId ?? ''
  const startModelId = selectedModel || installed[0]?.id || ''

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

  const stats = useMemo(
    () => [
      {
        icon: <Cpu className="h-4 w-4" />,
        label: 'Active model',
        value: providerOn
          ? `${status?.activeModelName ?? 'Running'} · ${
              status?.inferenceDevice === 'gpu'
                ? 'Metal/GPU'
                : status?.inferenceDevice === 'cpu'
                  ? 'CPU'
                  : status?.inferenceDevice === 'mock'
                    ? 'Mock'
                    : 'detecting'
            }`
          : '—',
      },
      {
        icon: <Gauge className="h-4 w-4" />,
        label: 'Throughput',
        value:
          providerOn && typeof status?.tokensPerSecond === 'number'
            ? `${status.tokensPerSecond.toFixed(0)} tok/s`
            : '—',
      },
      {
        icon: <Users className="h-4 w-4" />,
        label: 'Paired phones',
        value: providerOn ? String(status?.peers.length ?? 0) : '—',
      },
    ],
    [providerOn, status]
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Overview */}
      <MindCard>
        <div className="mb-4 flex items-center gap-2">
          <Cpu className="h-5 w-5 text-gray-300" />
          <h2 className="font-semibold text-white">Overview</h2>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map((s) => (
            <div
              className="rounded-lg border border-gray-800 bg-gray-900/60 p-3"
              key={s.label}
            >
              <div className="flex items-center gap-2 text-xs text-gray-500">
                {s.icon}
                {s.label}
              </div>
              <div className="mt-1 truncate text-sm font-semibold text-white">
                {s.value}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {providerOn ? (
            <button
              className="flex items-center gap-1.5 rounded-md bg-red-600/80 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600"
              onClick={() => mind.stopProvider()}
            >
              <Square className="h-4 w-4" /> Stop brain
            </button>
          ) : installed.length > 0 ? (
            <>
              <select
                className="rounded-md border border-gray-700 bg-gray-900 px-2.5 py-1.5 text-sm text-white focus:border-violet-500 focus:outline-none"
                onChange={(e) => setSelectedModel(e.target.value)}
                value={startModelId}
              >
                {installed.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                  </option>
                ))}
              </select>
              <button
                className="flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
                disabled={!startModelId}
                onClick={() => startModelId && mind.startProvider(startModelId)}
              >
                <Play className="h-4 w-4" /> Start brain
              </button>
            </>
          ) : (
            <button
              className="flex items-center gap-1.5 rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-800"
              onClick={() => navigate(KALEIDO_MIND_MODELS_PATH)}
            >
              <Cpu className="h-4 w-4" /> Get a model to start
            </button>
          )}
          {activeModelId && (
            <span className="text-xs text-gray-500">
              active: <span className="font-mono">{activeModelId}</span>
            </span>
          )}
        </div>
      </MindCard>

      {/* Settings */}
      <MindCard>
        <div className="mb-4 flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-gray-300" />
          <h2 className="font-semibold text-white">Settings</h2>
        </div>

        <div className="space-y-4">
          <div>
            <div className="mb-1 text-xs text-gray-500">
              Provider public key
            </div>
            {status?.publicKey ? (
              <button
                className="flex items-center gap-2 rounded-md border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800"
                onClick={copyKey}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span className="font-mono">
                  {status.publicKey.slice(0, 12)}…{status.publicKey.slice(-8)}
                </span>
              </button>
            ) : (
              <p className="text-sm text-gray-600">
                Available once the brain is running.
              </p>
            )}
          </div>

          <div>
            <div className="mb-1 text-xs text-gray-500">Recent activity</div>
            <div className="max-h-40 overflow-y-auto rounded-md border border-gray-800 bg-black/30 p-2 font-mono text-[11px] leading-relaxed text-gray-400">
              {mind.logs.length === 0 ? (
                <span className="text-gray-600">No log output yet.</span>
              ) : (
                mind.logs.slice(-50).map((line, i) => <div key={i}>{line}</div>)
              )}
            </div>
          </div>
        </div>
      </MindCard>
    </div>
  )
}
