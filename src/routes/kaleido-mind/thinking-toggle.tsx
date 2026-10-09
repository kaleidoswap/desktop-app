import { Lightbulb, LightbulbOff } from 'lucide-react'
import React, { useEffect, useState } from 'react'

import { mindClient, normalizeLimits, RESPONSE_TOKENS } from '../../api/mind'

/**
 * Turns the model's reasoning on or off for the next turns. On mount it also
 * puts back a response cap that an older version saved as uncapped.
 */
export const ThinkingToggle: React.FC<{ disabled?: boolean }> = ({
  disabled,
}) => {
  const [thinking, setThinking] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    mindClient
      .getAgentState()
      .then(async (state) => {
        const limits = normalizeLimits(state.generation)
        if (
          state.generation.maxOutputTokens <= 0 ||
          state.generation.maxOutputTokens > RESPONSE_TOKENS.max
        ) {
          await mindClient.setGenerationLimits({
            maxOutputTokens: limits.maxOutputTokens,
          })
        }
        if (!cancelled) setThinking(limits.thinking)
      })
      .catch(() => {
        if (!cancelled) setThinking(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (thinking === null) return null

  const toggle = async () => {
    setSaving(true)
    try {
      const state = await mindClient.setGenerationLimits({
        thinking: !thinking,
      })
      setThinking(normalizeLimits(state.generation).thinking)
    } finally {
      setSaving(false)
    }
  }

  return (
    <button
      aria-pressed={thinking}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs disabled:opacity-40 ${
        thinking
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-border-default text-content-secondary hover:bg-surface-overlay'
      }`}
      disabled={disabled || saving}
      onClick={() => void toggle()}
      title={
        thinking
          ? 'The model reasons before answering. Turn off for faster replies.'
          : 'The model answers directly. Turn on for multi-step tasks.'
      }
      type="button"
    >
      {thinking ? (
        <Lightbulb className="h-3.5 w-3.5" />
      ) : (
        <LightbulbOff className="h-3.5 w-3.5" />
      )}
      Thinking {thinking ? 'on' : 'off'}
    </button>
  )
}
