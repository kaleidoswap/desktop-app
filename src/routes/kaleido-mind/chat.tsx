// Chat — talk to the local brain. Routes through skills + connected MCP tools.

import { Brain, Loader2, Send, ShieldAlert } from 'lucide-react'
import React, { useRef, useState } from 'react'

import { useMindContext, useMindChat } from './shared'

/** Compact human form of a pending tool call's arguments. */
function describeArgs(args: Record<string, unknown>): string {
  const parts = Object.entries(args)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
  return parts.join('\n')
}

/** Format a sats value (number or numeric string) → "12,345 sats", else null. */
function fmtSats(n: unknown): string | null {
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(v) ? `${v.toLocaleString('en-US')} sats` : null
}

interface ConfirmSummary {
  title: string
  rows: { label: string; value: string }[]
  note?: string
}

/**
 * Human-readable summary for known spend tools so the confirm card shows real
 * terms (what you pay, what you get) instead of raw JSON args. Returns null for
 * unknown tools → caller falls back to describeArgs.
 */
function summarizeConfirm(
  name: string,
  args: Record<string, unknown>
): ConfirmSummary | null {
  if (name === 'kaleidoswap_lsp_create_asset_channel') {
    const asset = String(args.asset ?? 'asset')
    const amount = String(args.asset_amount ?? '')
    const rows: { label: string; value: string }[] = []
    const total = fmtSats(args.total_sat)
    const price = fmtSats(args.btc_amount_sat)
    const fee = fmtSats(args.channel_fee_sat)
    if (total) rows.push({ label: 'You pay', value: total })
    if (price) rows.push({ label: 'Asset price', value: price })
    if (fee) rows.push({ label: 'Channel fee', value: fee })
    return {
      note: `Opens a new Lightning channel pre-loaded with ${amount} ${asset}. The channel opens after you pay.`,
      rows,
      title: `Buy ${amount} ${asset}`.trim(),
    }
  }
  return null
}

export const Component: React.FC = () => {
  const mind = useMindContext()
  const providerOn = mind.status?.on === true

  // Persisted across Mind sub-tabs (owned by the layout).
  const { messages, setMessages, input, setInput } = useMindChat()
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

  return (
    <section className="flex min-h-[360px] flex-1 flex-col rounded-xl border border-gray-800 bg-gray-900/40 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Brain className="h-5 w-5 text-gray-300" />
        <h2 className="font-semibold text-white">Chat</h2>
        {!providerOn && (
          <span className="text-xs text-gray-500">— start a model to chat</span>
        )}
      </div>
      <div className="mb-3 flex-1 space-y-3 overflow-y-auto pr-1" ref={listRef}>
        {messages.length === 0 && (
          <p className="text-sm text-gray-600">
            Ask the agent anything — it routes through skills and the connected
            MCP tools.
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
      {mind.pendingConfirm && (
        <div className="mb-3 rounded-xl border border-amber-600/60 bg-amber-950/30 p-4">
          <div className="mb-2 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-amber-200">
              Approve this action?
            </span>
          </div>
          {(() => {
            const { name, arguments: args } = mind.pendingConfirm.call
            const summary = summarizeConfirm(name, args)
            if (summary) {
              return (
                <>
                  <p className="mb-2 text-base font-semibold text-white">
                    {summary.title}
                  </p>
                  {summary.rows.length > 0 && (
                    <div className="mb-2 space-y-1">
                      {summary.rows.map((r) => (
                        <div
                          className="flex justify-between gap-4 text-sm"
                          key={r.label}
                        >
                          <span className="text-amber-200/80">{r.label}</span>
                          <span className="font-mono text-white">
                            {r.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {summary.note && (
                    <p className="mb-3 text-xs text-gray-400">{summary.note}</p>
                  )}
                </>
              )
            }
            return (
              <>
                <p className="mb-1 font-mono text-sm text-white">
                  {name.replace(/_/g, ' ')}
                </p>
                <pre className="mb-3 whitespace-pre-wrap font-mono text-xs text-gray-300">
                  {describeArgs(args)}
                </pre>
              </>
            )
          })()}
          <div className="flex gap-2">
            <button
              className="flex-1 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
              onClick={() => void mind.respondConfirm(false, 'declined')}
            >
              Decline
            </button>
            <button
              className="flex-1 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-gray-950 hover:bg-amber-400"
              onClick={() => void mind.respondConfirm(true)}
            >
              Approve
            </button>
          </div>
        </div>
      )}
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
  )
}
