// KaleidoMind — desktop "brain". This is the section LAYOUT: it owns the single
// useMind() instance and renders the shared header + loading banner, with the
// active sub-page (Brain / Pairing / Models / Skills / Chat) in the Outlet.

import { Brain, Loader2 } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'

import { mindClient, type MindEvent } from '../../api/mind'
import { useMind } from '../../hooks/useMind'

import { RuntimeInstall } from './runtime-install'
import { StatusPill, labelForPhase, type ChatMsg } from './shared'
import { StartBrainModal } from './start-brain-modal'

export const Component: React.FC = () => {
  const mind = useMind()
  const { status } = mind
  const providerOn = status?.on === true

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

          {/* Offline prompt — pops up on any Mind page when the brain isn't running. */}
          <StartBrainModal mind={mind} />
        </>
      )}
    </div>
  )
}
