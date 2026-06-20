// Shared helpers + typed context for the KaleidoMind sub-routes.
//
// The MindLayout (./index.tsx) owns a single `useMind()` instance and exposes
// it to every child page via React Router's Outlet context, so the sidecar
// subscription and provider status are shared across Brain/Pairing/Models/
// Skills/Chat instead of being re-created per page.

import type { Dispatch, SetStateAction } from 'react'
import { useOutletContext } from 'react-router-dom'

import type { SuggestedAction } from '../../api/mind'
import type { UseMindResult } from '../../hooks/useMind'

/**
 * A tool the agent ran during an assistant turn — rendered live as a "running"
 * pill, then as a typed result card when it returns. Correlated back to its
 * call by tool `name` (the sidecar fires the call event fire-and-forget, so a
 * fast result can arrive before its call — see chat.tsx).
 */
export interface ChatToolEvent {
  id: string
  name: string
  arguments?: Record<string, unknown>
  status: 'running' | 'done' | 'error'
  result?: unknown
}

/** Per-response inference stats (real QVAC numbers), shown under the answer. */
export interface ChatMsgStats {
  tokensPerSecond?: number
  tokens?: number
  promptTokens?: number
  latencyMs?: number
  device?: 'gpu' | 'cpu' | null
}

export interface ChatMsg {
  id?: string
  role: 'user' | 'assistant'
  text: string
  /** The model's `<think>` reasoning for an assistant turn, shown collapsed. */
  thinking?: string
  /** Tools the agent invoked this turn, in arrival order (cards + live pills). */
  toolEvents?: ChatToolEvent[]
  /** Contextual next-step cards proposed by the agent after this reply. */
  followups?: SuggestedAction[]
  /** tok/s, tokens used, timing for this answer (QVAC). */
  stats?: ChatMsgStats
  createdAt?: number
  streaming?: boolean
}

// Chat state is owned by the layout so the conversation survives navigating
// between Mind sub-tabs (Brain / Pairing / Models / Skills / Chat).
export interface MindChatState {
  messages: ChatMsg[]
  setMessages: Dispatch<SetStateAction<ChatMsg[]>>
  input: string
  setInput: Dispatch<SetStateAction<string>>
}

interface MindOutletContext {
  mind: UseMindResult
  chat: MindChatState
}

export function useMindContext(): UseMindResult {
  return useOutletContext<MindOutletContext>().mind
}

export function useMindChat(): MindChatState {
  return useOutletContext<MindOutletContext>().chat
}

export function gb(bytes: number): string {
  if (!bytes) return '—'
  const v = bytes / 1024 ** 3
  return v < 1 ? `${Math.round(bytes / 1024 ** 2)} MB` : `${v.toFixed(1)} GB`
}

export function labelForPhase(phase: string): string {
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

export function StatusPill({
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
        on
          ? 'bg-status-success/15 text-status-success'
          : 'bg-surface-overlay text-content-tertiary'
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${on ? 'bg-status-success' : 'bg-content-tertiary'}`}
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

// Card wrapper shared by the Mind sub-pages for a consistent look.
export function MindCard({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-xl border border-border-default bg-surface-base/50 p-5 ${className}`}
    >
      {children}
    </section>
  )
}
