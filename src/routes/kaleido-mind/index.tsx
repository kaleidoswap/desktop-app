// KaleidoMind — desktop "brain" control panel.
//
// Run a local QVAC model, expose it over P2P so the phone can delegate to it
// (pairing QR), manage models, and chat with the skill- + MCP-routed agent.

import { QRCodeSVG } from 'qrcode.react'
import {
  Brain,
  Check,
  Copy,
  Cpu,
  Download,
  Loader2,
  Play,
  Send,
  Square,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import React, { useMemo, useRef, useState } from 'react'

import { useMind } from '../../hooks/useMind'

function gb(bytes: number): string {
  if (!bytes) return '—'
  const v = bytes / 1024 ** 3
  return v < 1 ? `${Math.round(bytes / 1024 ** 2)} MB` : `${v.toFixed(1)} GB`
}

interface ChatMsg {
  role: 'user' | 'assistant'
  text: string
}

export const Component: React.FC = () => {
  const mind = useMind()
  const { status } = mind

  const installedIds = useMemo(
    () => new Set(mind.installed.map((m) => m.id)),
    [mind.installed]
  )

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

  // ── Chat ──
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const send = async () => {
    const prompt = input.trim()
    if (!prompt || sending) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text: prompt }])
    setSending(true)
    try {
      const reply = await mind.chat(prompt)
      setMessages((m) => [...m, { role: 'assistant', text: reply }])
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: `⚠️ ${e instanceof Error ? e.message : String(e)}`,
        },
      ])
    } finally {
      setSending(false)
      setTimeout(
        () => listRef.current?.scrollTo(0, listRef.current.scrollHeight),
        50
      )
    }
  }

  const providerOn = status?.on === true

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-6 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="h-7 w-7 text-violet-400" />
          <div>
            <h1 className="text-xl font-bold text-white">KaleidoMind</h1>
            <p className="text-sm text-gray-400">
              Local AI brain — runs a model on this desktop and lets your phone
              delegate to it.
            </p>
          </div>
        </div>
        <StatusPill
          model={status?.activeModelName}
          on={providerOn}
          tps={status?.tokensPerSecond}
        />
      </div>

      {/* Loading banner */}
      {mind.loading && (
        <div className="flex items-center gap-2 rounded-lg border border-violet-700/40 bg-violet-900/20 px-4 py-2 text-sm text-violet-200">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>
            {labelForPhase(mind.loading.phase)}
            {typeof mind.loading.percentage === 'number'
              ? ` · ${mind.loading.percentage}%`
              : ''}
            {mind.loading.message ? ` — ${mind.loading.message}` : ''}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pairing */}
        <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-300" />
            <h2 className="font-semibold text-white">Pair your phone</h2>
          </div>
          {providerOn && status?.publicKey ? (
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-lg bg-white p-3">
                <QRCodeSVG size={168} value={status.publicKey} />
              </div>
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
                  {status.publicKey.slice(0, 10)}…{status.publicKey.slice(-6)}
                </span>
              </button>
              <p className="text-center text-xs text-gray-500">
                In the KaleidoSwap app: AI → Settings → “Scan QR from desktop”
                (or paste the key).
              </p>
              {status.peers.length > 0 && (
                <div className="mt-1 w-full rounded-md bg-gray-800/50 p-2 text-xs text-gray-300">
                  {status.peers.length} phone
                  {status.peers.length > 1 ? 's' : ''} connected
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Start the brain with a model below to show a pairing QR. The phone
              scans it to run inference here instead of on-device.
            </p>
          )}
        </section>

        {/* Models */}
        <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Cpu className="h-5 w-5 text-gray-300" />
            <h2 className="font-semibold text-white">Models</h2>
          </div>
          <div className="flex flex-col gap-2">
            {mind.catalog.length === 0 && (
              <p className="text-sm text-gray-500">Loading catalog…</p>
            )}
            {mind.catalog.map((m) => {
              const isInstalled = installedIds.has(m.id)
              const isActive = status?.activeModelId === m.id && providerOn
              const dl = mind.downloads[m.id]
              const downloading = typeof dl === 'number'
              return (
                <div
                  className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2"
                  key={m.id}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-white">
                        {m.displayName}
                      </span>
                      {isActive && (
                        <span className="rounded-full bg-green-600/30 px-2 py-0.5 text-[10px] font-semibold text-green-300">
                          Running
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {m.quant} · {gb(m.sizeBytes)} · ~{m.ramHintGb} GB RAM
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {downloading ? (
                      <div className="flex items-center gap-2">
                        <span className="w-10 text-right text-xs text-violet-300">
                          {dl}%
                        </span>
                        <button
                          className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-red-400"
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
                            className="flex items-center gap-1 rounded-md bg-red-600/80 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-600"
                            onClick={() => mind.stopProvider()}
                          >
                            <Square className="h-3.5 w-3.5" /> Stop
                          </button>
                        ) : (
                          <button
                            className="flex items-center gap-1 rounded-md bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-40"
                            disabled={providerOn}
                            onClick={() => mind.startProvider(m.id)}
                          >
                            <Play className="h-3.5 w-3.5" /> Start
                          </button>
                        )}
                        <button
                          className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-red-400 disabled:opacity-30"
                          disabled={isActive}
                          onClick={() => mind.deleteModel(m.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        className="flex items-center gap-1 rounded-md border border-gray-700 px-2.5 py-1 text-xs text-gray-200 hover:bg-gray-800"
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
        </section>
      </div>

      {/* Chat */}
      <section className="flex min-h-[280px] flex-1 flex-col rounded-xl border border-gray-800 bg-gray-900/40 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Brain className="h-5 w-5 text-gray-300" />
          <h2 className="font-semibold text-white">Chat</h2>
          {!providerOn && (
            <span className="text-xs text-gray-500">
              — start a model to chat
            </span>
          )}
        </div>
        <div
          className="mb-3 flex-1 space-y-3 overflow-y-auto pr-1"
          ref={listRef}
        >
          {messages.length === 0 && (
            <p className="text-sm text-gray-600">
              Ask the agent anything — it routes through skills and the
              connected MCP tools.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              className={m.role === 'user' ? 'text-right' : 'text-left'}
              key={i}
            >
              <span
                className={`inline-block max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                  m.role === 'user'
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-800 text-gray-100'
                }`}
              >
                {m.text}
              </span>
            </div>
          ))}
          {sending && (
            <div className="text-left">
              <span className="inline-flex items-center gap-2 rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-300">
                <Loader2 className="h-4 w-4 animate-spin" /> thinking…
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-violet-500 focus:outline-none disabled:opacity-50"
            disabled={!providerOn || sending}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder={
              providerOn ? 'Message KaleidoMind…' : 'Start a model first'
            }
            value={input}
          />
          <button
            className="flex items-center justify-center rounded-lg bg-violet-600 p-2.5 text-white hover:bg-violet-500 disabled:opacity-40"
            disabled={!providerOn || sending || !input.trim()}
            onClick={send}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </section>
    </div>
  )
}

function StatusPill({
  on,
  model,
  tps,
}: {
  on: boolean
  model?: string | null
  tps?: number | null
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
        on ? 'bg-green-600/20 text-green-300' : 'bg-gray-700/40 text-gray-400'
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${on ? 'bg-green-400' : 'bg-gray-500'}`}
      />
      {on ? (
        <span>
          {model ?? 'Running'}
          {typeof tps === 'number' ? ` · ${tps.toFixed(0)} tok/s` : ''}
        </span>
      ) : (
        <span>Stopped</span>
      )}
    </div>
  )
}

function labelForPhase(phase: string): string {
  switch (phase) {
    case 'loading_model':
      return 'Loading model'
    case 'model_loaded':
      return 'Model loaded'
    case 'starting_p2p':
      return 'Connecting P2P'
    case 'ready':
      return 'Ready'
    case 'p2p_failed':
      return 'P2P unavailable (desktop-only)'
    case 'aborted':
      return 'Aborted'
    default:
      return phase
  }
}
