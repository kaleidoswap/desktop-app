// Chat — talk to the local brain. Routes through skills + connected MCP tools.

import { Brain, Loader2, Send } from 'lucide-react'
import React, { useRef, useState } from 'react'

import { useMindContext, useMindChat } from './shared'

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
