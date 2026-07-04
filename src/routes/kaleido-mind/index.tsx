// KaleidoMind — desktop "brain". This is the section LAYOUT: it owns the single
// useMind() instance and renders the shared header + loading banner, with the
// active sub-page (Brain / Pairing / Models / Skills / Chat) in the Outlet.

import { FlaskConical, Loader2 } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import {
  KALEIDO_MIND_CHAT_PATH,
  KALEIDO_MIND_PATH,
} from '../../app/router/paths'
import { mindClient, type MindEvent } from '../../api/mind'
import { useMind } from '../../hooks/useMind'

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

  useEffect(() => {
    // Thinking/content can arrive token-by-token. Debounce persistence so live
    // streaming does not synchronously rewrite localStorage for every token.
    const timer = setTimeout(() => {
      localStorage.setItem(
        'kaleido-mind.chat-history.v1',
        JSON.stringify(
          messages
            .slice(-100)
            .map(({ streaming: _streaming, ...message }) => message)
        )
      )
    }, 250)
    return () => clearTimeout(timer)
  }, [messages])

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
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-6 overflow-y-auto p-6">
      {/* Header — the app's section header already shows the "KaleidoMind"
          title, so here we just flag the feature as experimental + show status. */}
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300">
          <FlaskConical className="h-3.5 w-3.5" />
          Experimental
        </span>
        <StatusPill
          model={status?.activeModelName}
          on={providerOn}
          tps={status?.tokensPerSecond}
        />
      </div>

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
          <Outlet
            context={{ chat: { input, messages, setInput, setMessages }, mind }}
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
