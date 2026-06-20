// Chat — talk to the local brain. Routes through skills + connected MCP tools.

import {
  Brain,
  ChevronRight,
  Clock,
  Coins,
  Cpu,
  Gauge,
  History,
  Loader2,
  Plus,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react'
import React, { useRef, useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'

import { ToolEventView, fmtSats } from './cards'
import {
  useMindContext,
  useMindChat,
  type ChatMsgStats,
  type ChatToolEvent,
} from './shared'
import { FollowupActions, WelcomeActions } from './welcome-actions'

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
  table: ({ node: _node, ...p }) => (
    <div className="mb-2 overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-xs" {...p} />
    </div>
  ),
  td: ({ node: _node, ...p }) => (
    <td
      className="border border-divider/15 px-2 py-1 text-content-secondary"
      {...p}
    />
  ),
  th: ({ node: _node, ...p }) => (
    <th
      className="border border-divider/20 px-2 py-1 text-left font-semibold text-content-primary"
      {...p}
    />
  ),
  ul: ({ node: _node, ...p }) => (
    <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0" {...p} />
  ),
}

// remark-gfm → proper lists/tables/strikethrough; remark-breaks → a single
// newline becomes a <br>. Small local models emit line-separated text (not
// blank-line-separated paragraphs), which plain CommonMark collapses into one
// run-on blob — these keep the model's intended line/list structure.
const MarkdownText: React.FC<{ text: string }> = ({ text }) => (
  <ReactMarkdown
    components={MD_COMPONENTS}
    remarkPlugins={[remarkGfm, remarkBreaks]}
  >
    {text}
  </ReactMarkdown>
)

/**
 * Per-response stats footer — real QVAC numbers (tok/s, tokens used, the backend
 * device) plus the wall-clock timing the user actually waited.
 */
const StatsFooter: React.FC<{ stats: ChatMsgStats }> = ({ stats }) => {
  const { tokensPerSecond, tokens, promptTokens, latencyMs, device } = stats
  const hasAny =
    (typeof tokensPerSecond === 'number' && tokensPerSecond > 0) ||
    typeof tokens === 'number' ||
    typeof latencyMs === 'number' ||
    !!device
  if (!hasAny) return null
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 border-t border-divider/10 pt-1.5 text-[0.65rem] text-content-tertiary">
      {typeof tokensPerSecond === 'number' && tokensPerSecond > 0 && (
        <span className="inline-flex items-center gap-1">
          <Gauge className="h-3 w-3" />
          {tokensPerSecond.toFixed(1)} tok/s
        </span>
      )}
      {typeof tokens === 'number' && (
        <span
          className="inline-flex items-center gap-1"
          title={
            typeof promptTokens === 'number'
              ? `${promptTokens.toLocaleString('en-US')} prompt + ${Math.max(
                  0,
                  tokens - promptTokens
                ).toLocaleString('en-US')} completion`
              : undefined
          }
        >
          <Coins className="h-3 w-3" />
          {tokens.toLocaleString('en-US')} tokens
        </span>
      )}
      {typeof latencyMs === 'number' && (
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {(latencyMs / 1000).toFixed(latencyMs < 10_000 ? 1 : 0)}s
        </span>
      )}
      {device && (
        <span className="inline-flex items-center gap-1">
          {device === 'gpu' ? (
            <Zap className="h-3 w-3" />
          ) : (
            <Cpu className="h-3 w-3" />
          )}
          {device === 'gpu' ? 'GPU' : 'CPU'}
        </span>
      )}
    </div>
  )
}

/**
 * Collapsible view of the model's `<think>` reasoning for an assistant turn.
 * Streams open WHILE the model is thinking (so you watch it reason live), then
 * auto-collapses the moment the visible answer starts — a Claude-like
 * thinking→answer transition. The user can still expand/collapse manually.
 */
const ThinkingDisclosure: React.FC<{
  text: string
  live?: boolean
  hasContent?: boolean
}> = ({ text, live = false, hasContent = false }) => {
  // Actively reasoning = streaming this turn with no visible answer yet.
  const reasoning = live && !hasContent
  // Auto: open while there's no visible answer yet (you watch it think), then
  // collapse once the answer appears. `pinnedOpen` lets a manual toggle win.
  const [pinnedOpen, setPinnedOpen] = useState<boolean | null>(null)
  const open = pinnedOpen ?? !hasContent
  return (
    <div className="mb-2 overflow-hidden rounded-lg border border-primary/20 bg-primary/5">
      <button
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-medium text-primary transition-colors hover:bg-primary/10"
        onClick={() => setPinnedOpen(!open)}
        type="button"
      >
        <ChevronRight
          className={`h-3 w-3 transition-transform ${open ? 'rotate-90' : ''}`}
        />
        <Sparkles className={`h-3 w-3 ${reasoning ? 'animate-pulse' : ''}`} />
        <span>{reasoning ? 'Thinking…' : 'Thought process'}</span>
        <span className="ml-auto text-[0.65rem] font-normal text-content-tertiary">
          {open ? 'Hide' : 'Show'}
        </span>
      </button>
      {open && (
        <div className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words border-t border-primary/15 bg-surface-base/60 px-3 py-2.5 font-mono text-[0.72rem] leading-relaxed text-content-tertiary">
          {text}
        </div>
      )}
    </div>
  )
}

/** Compact human form of a pending tool call's arguments. */
function describeArgs(args: Record<string, unknown>): string {
  const parts = Object.entries(args)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
  return parts.join('\n')
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
  // Real inference backend + throughput (from the SDK's per-turn stats) — shown
  // in the header so "is the GPU actually being used?" is answered where you chat.
  const device = mind.status?.inferenceDevice
  const onGpu = device === 'gpu'
  const deviceLabel =
    device === 'gpu'
      ? 'Metal/GPU'
      : device === 'cpu'
        ? 'CPU'
        : device === 'mock'
          ? 'Mock'
          : 'detecting'
  const tps = mind.status?.tokensPerSecond

  // Persisted across Mind sub-tabs (owned by the layout).
  const { messages, setMessages, input, setInput } = useMindChat()
  const [sending, setSending] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const scrollToEnd = () =>
    setTimeout(
      () => listRef.current?.scrollTo(0, listRef.current.scrollHeight),
      50
    )

  const send = async (override?: string) => {
    const prompt = (override ?? input).trim()
    if (!prompt || sending || !providerOn) return
    const assistantId = crypto.randomUUID()
    const now = Date.now()
    setInput('')
    setMessages((m) => [
      ...m,
      { createdAt: now, id: crypto.randomUUID(), role: 'user', text: prompt },
      {
        createdAt: now,
        id: assistantId,
        role: 'assistant',
        streaming: true,
        text: '',
        thinking: '',
      },
    ])
    setSending(true)
    scrollToEnd()
    // Correlate tool calls↔results by (name, occurrence). The sidecar fires the
    // call event fire-and-forget after an async lookup, so a fast result can
    // race ahead of its call — counting per name makes the i-th call and i-th
    // result resolve to the same event key regardless of arrival order.
    const callSeq = new Map<string, number>()
    const resultSeq = new Map<string, number>()
    const upsertToolEvent = (
      key: string,
      patch: Partial<ChatToolEvent>,
      fallback: ChatToolEvent
    ) => {
      setMessages((current) =>
        current.map((message) => {
          if (message.id !== assistantId) return message
          const events = message.toolEvents ?? []
          const index = events.findIndex((e) => e.id === key)
          if (index >= 0) {
            const next = events.slice()
            next[index] = { ...next[index], ...patch }
            return { ...message, toolEvents: next }
          }
          return { ...message, toolEvents: [...events, fallback] }
        })
      )
      scrollToEnd()
    }
    try {
      const reply = await mind.chat(prompt, {
        onThinking: (delta) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    thinking: `${message.thinking ?? ''}${delta}`,
                  }
                : message
            )
          )
          scrollToEnd()
        },
        onToken: (delta) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, text: `${message.text}${delta}` }
                : message
            )
          )
          scrollToEnd()
        },
        onToolCall: (call) => {
          const n = (callSeq.get(call.name) ?? 0) + 1
          callSeq.set(call.name, n)
          const key = `${call.name}#${n}`
          upsertToolEvent(
            key,
            { arguments: call.arguments },
            {
              arguments: call.arguments,
              id: key,
              name: call.name,
              status: 'running',
            }
          )
        },
        onToolResult: (res) => {
          const n = (resultSeq.get(res.name) ?? 0) + 1
          resultSeq.set(res.name, n)
          const key = `${res.name}#${n}`
          const status: ChatToolEvent['status'] = res.ok ? 'done' : 'error'
          upsertToolEvent(
            key,
            { result: res.result, status },
            {
              arguments: res.arguments,
              id: key,
              name: res.name,
              result: res.result,
              status,
            }
          )
        },
      })
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                followups: reply.followups,
                stats: {
                  device: reply.device,
                  latencyMs: reply.latencyMs,
                  promptTokens: reply.promptTokens,
                  tokens: reply.tokens,
                  tokensPerSecond: reply.tokensPerSecond,
                },
                streaming: false,
                text: reply.text,
                thinking: reply.thinking ?? message.thinking,
              }
            : message
        )
      )
    } catch (e) {
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                streaming: false,
                text: `⚠️ ${e instanceof Error ? e.message : String(e)}`,
              }
            : message
        )
      )
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
        <div className="ml-auto flex flex-shrink-0 items-center gap-2">
          {providerOn && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.7rem] font-medium ${
                onGpu
                  ? 'bg-status-success/15 text-status-success'
                  : device === 'cpu'
                    ? 'bg-status-warning/15 text-status-warning'
                    : 'bg-surface-overlay text-content-tertiary'
              }`}
              title={
                onGpu
                  ? 'Inference is running on the GPU (Metal)'
                  : device === 'cpu'
                    ? 'Running on CPU — GPU/Metal was unavailable. See Brain → Recent activity.'
                    : 'Detecting inference backend…'
              }
            >
              {onGpu ? (
                <Zap className="h-3 w-3" />
              ) : (
                <Cpu className="h-3 w-3" />
              )}
              {deviceLabel}
              {typeof tps === 'number' && tps > 0
                ? ` · ${tps.toFixed(0)} tok/s`
                : ''}
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-medium ${
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
        <button
          className="inline-flex items-center gap-1.5 rounded-md border border-border-default px-2.5 py-1.5 text-xs text-content-secondary hover:bg-surface-overlay disabled:opacity-40 disabled:hover:bg-transparent"
          disabled={messages.length === 0 || sending}
          onClick={() => {
            setMessages([])
            setInput('')
            setShowHistory(false)
          }}
          title="Start a new chat"
          type="button"
        >
          <Plus className="h-3.5 w-3.5" />
          New chat
        </button>
        <button
          className="inline-flex items-center gap-1.5 rounded-md border border-border-default px-2.5 py-1.5 text-xs text-content-secondary hover:bg-surface-overlay"
          onClick={() => setShowHistory((value) => !value)}
          type="button"
        >
          <History className="h-3.5 w-3.5" />
          History
        </button>
      </div>

      {showHistory && (
        <div className="border-b border-divider/15 bg-surface-overlay/40 px-5 py-3">
          <div className="mb-2 flex items-center">
            <p className="text-xs font-semibold text-content-primary">
              Saved conversation · {messages.length} messages
            </p>
            <div className="ml-auto flex gap-2">
              <button
                className="inline-flex items-center gap-1 text-xs text-content-tertiary hover:text-content-primary"
                onClick={() => {
                  setMessages([])
                  setShowHistory(false)
                }}
                type="button"
              >
                <Plus className="h-3.5 w-3.5" /> New chat
              </button>
              <button
                className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
                onClick={() => setMessages([])}
                type="button"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </button>
            </div>
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-xs text-content-tertiary">
                No saved messages yet.
              </p>
            ) : (
              messages.map((message, index) => (
                <div
                  className="flex gap-2 rounded px-2 py-1 text-xs hover:bg-surface-overlay"
                  key={message.id ?? index}
                >
                  <span className="w-14 shrink-0 font-medium text-content-tertiary">
                    {message.role === 'user' ? 'You' : 'Mind'}
                  </span>
                  <span className="truncate text-content-secondary">
                    {message.text || message.thinking || 'Thinking…'}
                  </span>
                  {message.createdAt && (
                    <span className="ml-auto shrink-0 text-[0.65rem] text-content-tertiary">
                      {new Date(message.createdAt).toLocaleString()}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4" ref={listRef}>
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
              <Brain className="h-7 w-7 text-primary" />
            </div>
            <p className="text-base font-semibold text-content-primary">
              Your sovereign financial agent
            </p>
            <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-content-tertiary">
              I run locally and help with your wallet, node and portfolio. Pick
              a starting point, or just ask.
            </p>
            <WelcomeActions
              disabled={!providerOn || sending}
              onPick={(p) => void send(p)}
              providerOn={providerOn}
            />
          </div>
        ) : (
          messages.map((m, i) =>
            m.role === 'user' ? (
              <div className="flex justify-end" key={m.id ?? i}>
                <div className="max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-secondary px-3.5 py-2.5 text-sm text-white shadow-sm">
                  {m.text}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2.5" key={m.id ?? i}>
                <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary/15">
                  <Brain className="h-4 w-4 text-primary" />
                </div>
                <div className="max-w-[88%] break-words rounded-2xl rounded-tl-md border border-divider/10 bg-surface-overlay px-3.5 py-2.5 text-sm leading-relaxed text-content-primary">
                  {m.thinking && (
                    <ThinkingDisclosure
                      hasContent={!!m.text}
                      live={m.streaming}
                      text={m.thinking}
                    />
                  )}
                  {m.toolEvents?.map((ev) => (
                    <ToolEventView event={ev} key={ev.id} />
                  ))}
                  {m.text ? (
                    <MarkdownText text={m.text} />
                  ) : m.streaming && !m.thinking && !m.toolEvents?.length ? (
                    <span className="inline-flex items-center gap-2 text-content-tertiary">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      Thinking…
                    </span>
                  ) : null}
                  {!m.streaming &&
                    m.followups &&
                    m.followups.length > 0 &&
                    i === messages.length - 1 && (
                      <FollowupActions
                        actions={m.followups}
                        disabled={!providerOn || sending}
                        onPick={(p) => void send(p)}
                      />
                    )}
                  {!m.streaming && m.stats && <StatsFooter stats={m.stats} />}
                </div>
              </div>
            )
          )
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
        {/* While the model is working, make it unmistakable that input is paused. */}
        {sending && (
          <div className="mb-2 flex items-center gap-2 px-1 text-xs font-medium text-primary">
            <span className="flex items-end gap-0.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
            </span>
            KaleidoMind is responding… please wait
          </div>
        )}
        <div
          className={`flex items-center gap-2 rounded-xl border bg-surface-overlay/40 py-1.5 pl-3 pr-1.5 transition-colors ${
            sending
              ? 'border-primary/40 opacity-70'
              : 'border-border-default focus-within:border-primary/50'
          }`}
        >
          <input
            className="flex-1 bg-transparent py-1.5 text-sm text-content-primary placeholder-content-tertiary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!providerOn || sending}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder={
              sending
                ? 'Waiting for KaleidoMind to finish…'
                : providerOn
                  ? 'Message KaleidoMind…'
                  : 'Start a model first'
            }
            value={input}
          />
          <button
            aria-label={sending ? 'KaleidoMind is responding' : 'Send message'}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-surface-base transition-all hover:bg-primary-emphasis active:scale-95 disabled:opacity-40"
            disabled={!providerOn || sending || !input.trim()}
            onClick={() => send()}
            type="button"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </section>
  )
}
