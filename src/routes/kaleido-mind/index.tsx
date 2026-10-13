// KaleidoMind — desktop "brain". This is the section LAYOUT: it owns the single
// useMind() instance and renders the shared header + loading banner, with the
// active sub-page (Brain / Models / Skills / Chat) in the Outlet.

import { FlaskConical, Loader2 } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import {
  KALEIDO_MIND_CHAT_PATH,
  KALEIDO_MIND_PATH,
} from '../../app/router/paths'
import { mindClient, type MindEvent } from '../../api/mind'
import { useMind } from '../../hooks/useMind'

import { MockModeBanner } from './mock-mode-banner'
import { RuntimeInstall } from './runtime-install'
import { StatusPill, type ChatMsg } from './shared'
import { StartBrainModal } from './start-brain-modal'

export const Component: React.FC = () => {
  const mind = useMind()
  const { status } = mind
  const providerOn = status?.on === true
  const { pathname } = useLocation()
  // The chat page (index + /chat) shows its own inline brain-setup launcher when
  // offline, so the popup would double up there — only nudge from other tabs.
  const onChatRoute =
    pathname === KALEIDO_MIND_PATH || pathname === KALEIDO_MIND_CHAT_PATH

  // Chat state lives here so it persists across the Mind sub-tabs.
  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    try {
      const parsed = JSON.parse(
        localStorage.getItem('kaleido-mind.chat-history.v1') ?? '[]'
      )
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const activeChatRef = useRef<string | null>(null)
  const stoppedRef = useRef(false)

  const latestMessages = useRef(messages)
  latestMessages.current = messages
  const persistMessages = (history: ChatMsg[]) => {
    try {
      localStorage.setItem(
        'kaleido-mind.chat-history.v1',
        JSON.stringify(
          history
            .slice(-100)
            .map(({ streaming: _streaming, ...message }) => message)
        )
      )
    } catch {
      // Storage can be unavailable or full. Keep the live conversation usable.
    }
  }
  useEffect(() => {
    const timer = setTimeout(() => persistMessages(messages), 250)
    return () => clearTimeout(timer)
  }, [messages])
  useEffect(() => () => persistMessages(latestMessages.current), [])

  // The agent can message you unprompted — a finished task, a liquidity alert.
  // Those arrive as `agent_message` events and append to the conversation as
  // assistant turns, even while you're on another Mind sub-tab.
  useEffect(() => {
    const off = mindClient.on((e: MindEvent) => {
      if (e.type !== 'agent_message') return
      setMessages((m) => [
        ...m,
        {
          createdAt: e.at,
          id: crypto.randomUUID(),
          role: 'assistant',
          text: e.text,
        },
      ])
    })
    return off
  }, [])

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col gap-3 overflow-y-auto">
      {/* The app's section header already shows the "KaleidoMind" title. The
          chat carries its own status in its header, so only the other tabs
          get this slim experimental + status row. */}
      {!onChatRoute && (
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300">
            <FlaskConical className="h-3 w-3" />
            Experimental
          </span>
          <StatusPill
            model={status?.activeModelName}
            on={providerOn}
            tps={status?.tokensPerSecond}
          />
        </div>
      )}

      {/* Gate: the agent runtime is downloaded on demand (not bundled). Show the
          install screen until it's available; dev (sibling repos) skips this. */}
      {mind.runtimeInstalled === null ? (
        <div className="flex flex-1 items-center justify-center text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : mind.runtimeInstalled === false ? (
        <RuntimeInstall mind={mind} />
      ) : (
        <>
          {mind.actionError && (
            <p
              className="rounded-lg border border-status-danger/30 bg-status-danger/10 p-3 text-sm text-status-danger"
              role="alert"
            >
              {mind.actionError}
            </p>
          )}
          <MockModeBanner
            busy={
              mind.runtimeProgress !== null &&
              mind.runtimeProgress.phase !== 'error'
            }
            device={status?.inferenceDevice}
            onDownload={() => void mind.installRuntime()}
          />
          <Outlet
            context={{
              chat: {
                activeChatRef,
                input,
                messages,
                sending,
                setInput,
                setMessages,
                setSending,
                stoppedRef,
              },
              mind,
            }}
          />

          {/* Offline prompt — pops up on Mind pages (except chat, which has its
              own inline launcher) when the brain isn't running. Always mounted
              (rather than conditionally on onChatRoute) so its "dismissed" state
              survives switching between Mind sub-tabs — otherwise remounting on
              every tab change reset the dismissal and the modal reappeared. */}
          <StartBrainModal mind={mind} suppressed={onChatRoute} />
        </>
      )}
    </div>
  )
}
