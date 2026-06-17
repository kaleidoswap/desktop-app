// Chat — talk to the local brain. Routes through skills + connected MCP tools.

import { Brain, Loader2, Send, ShieldAlert } from 'lucide-react'
import React, { useRef, useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'

import { useMindContext, useMindChat } from './shared'

/**
 * Render the agent's Markdown (bold, lists, IDs) instead of raw `**text**`.
 * Styled for the dark assistant bubble; long hex ids/code wrap instead of
 * blowing out the bubble width.
 */
const MD_COMPONENTS: Components = {
  a: ({ node: _node, ...p }) => (
    <a
      className="text-primary underline underline-offset-2 hover:text-primary-emphasis"
      rel="noreferrer"
      target="_blank"
      {...p}
    />
  ),
  code: ({ node: _node, ...p }) => (
    <code
      className="break-all rounded bg-surface-base px-1 py-0.5 font-mono text-[0.82em] text-content-secondary"
      {...p}
    />
  ),
  em: ({ node: _node, ...p }) => (
    <em className="italic text-content-secondary" {...p} />
  ),
  h1: ({ node: _node, ...p }) => (
    <p className="mb-1 text-sm font-semibold text-content-primary" {...p} />
  ),
  h2: ({ node: _node, ...p }) => (
    <p className="mb-1 text-sm font-semibold text-content-primary" {...p} />
  ),
  h3: ({ node: _node, ...p }) => (
    <p className="mb-1 text-sm font-semibold text-content-primary" {...p} />
  ),
  li: ({ node: _node, ...p }) => <li className="leading-relaxed" {...p} />,
  ol: ({ node: _node, ...p }) => (
    <ol className="mb-2 list-decimal space-y-1 pl-4 last:mb-0" {...p} />
  ),
  p: ({ node: _node, ...p }) => (
    <p className="mb-2 leading-relaxed last:mb-0" {...p} />
  ),
  strong: ({ node: _node, ...p }) => (
    <strong className="font-semibold text-content-primary" {...p} />
  ),
  ul: ({ node: _node, ...p }) => (
    <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0" {...p} />
  ),
}

const MarkdownText: React.FC<{ text: string }> = ({ text }) => (
  <ReactMarkdown components={MD_COMPONENTS}>{text}</ReactMarkdown>
)

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

/** Starter prompts shown on the empty chat — one tap to try the agent. */
const SUGGESTIONS = [
  'What can you do?',
  "What's my balance?",
  'Do I have channels?',
  'Buy 100 USDT',
]

export const Component: React.FC = () => {
  const mind = useMindContext()
  const providerOn = mind.status?.on === true

  // Persisted across Mind sub-tabs (owned by the layout).
  const { messages, setMessages, input, setInput } = useMindChat()
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const scrollToEnd = () =>
    setTimeout(
      () => listRef.current?.scrollTo(0, listRef.current.scrollHeight),
      50
    )

  const send = async (override?: string) => {
    const prompt = (override ?? input).trim()
    if (!prompt || sending || !providerOn) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text: prompt }])
    setSending(true)
    scrollToEnd()
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
      scrollToEnd()
    }
  }

  return (
    <section className="flex min-h-[440px] flex-1 flex-col overflow-hidden rounded-2xl border border-border-default bg-surface-base/50">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-divider/15 px-5 py-3.5">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/15">
          <Brain className="h-[1.05rem] w-[1.05rem] text-primary" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold leading-tight text-content-primary">
            Chat
          </h2>
          <p className="truncate text-xs leading-tight text-content-tertiary">
            {providerOn
              ? 'Ask about balances, channels, swaps…'
              : 'Start a model to chat'}
          </p>
        </div>
        <span
          className={`ml-auto inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-medium ${
            providerOn
              ? 'bg-primary/15 text-primary'
              : 'bg-surface-overlay text-content-tertiary'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              providerOn ? 'animate-pulse bg-primary' : 'bg-content-tertiary'
            }`}
          />
          {providerOn ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4" ref={listRef}>
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
              <Brain className="h-7 w-7 text-primary" />
            </div>
            <p className="text-base font-semibold text-content-primary">
              How can I help?
            </p>
            <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-content-tertiary">
              Your local AI brain for Bitcoin, Lightning &amp; RGB — read
              balances and channels, or run a swap, right from chat.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  className="rounded-full border border-border-default bg-surface-overlay/50 px-3.5 py-1.5 text-xs font-medium text-content-secondary transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:text-content-primary disabled:opacity-40 disabled:hover:translate-y-0"
                  disabled={!providerOn || sending}
                  key={s}
                  onClick={() => void send(s)}
                  type="button"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) =>
            m.role === 'user' ? (
              <div className="flex justify-end" key={i}>
                <div className="max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-secondary px-3.5 py-2.5 text-sm text-white shadow-sm">
                  {m.text}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2.5" key={i}>
                <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary/15">
                  <Brain className="h-4 w-4 text-primary" />
                </div>
                <div className="max-w-[80%] break-words rounded-2xl rounded-tl-md border border-divider/10 bg-surface-overlay px-3.5 py-2.5 text-sm leading-relaxed text-content-primary">
                  <MarkdownText text={m.text} />
                </div>
              </div>
            )
          )
        )}
        {sending && (
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary/15">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            <div className="inline-flex items-center gap-2 rounded-2xl rounded-tl-md border border-divider/10 bg-surface-overlay px-3.5 py-2.5 text-sm text-content-tertiary">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />{' '}
              thinking…
            </div>
          </div>
        )}
      </div>

      {/* Spend confirmation */}
      {mind.pendingConfirm && (
        <div className="mx-4 mb-3 rounded-xl border border-amber-600/60 bg-amber-950/30 p-4">
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
      <div className="border-t border-divider/15 px-4 py-3">
        <div className="flex items-center gap-2 rounded-xl border border-border-default bg-surface-overlay/40 py-1.5 pl-3 pr-1.5 transition-colors focus-within:border-primary/50">
          <input
            className="flex-1 bg-transparent py-1.5 text-sm text-content-primary placeholder-content-tertiary focus:outline-none disabled:opacity-50"
            disabled={!providerOn || sending}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder={
              providerOn ? 'Message KaleidoMind…' : 'Start a model first'
            }
            value={input}
          />
          <button
            aria-label="Send message"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-surface-base transition-all hover:bg-primary-emphasis active:scale-95 disabled:opacity-40"
            disabled={!providerOn || sending || !input.trim()}
            onClick={() => send()}
            type="button"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  )
}
