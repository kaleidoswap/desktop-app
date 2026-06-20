// WelcomeActions — the agent's four starter actions, shown as cards on the
// empty chat (the agent's "first message"). Defaults render offline; once a
// model is online the provider supplies its own via get_suggested_actions
// (wallet / node / portfolio / trade), keeping the cards capability-aware.

import {
  ArrowLeftRight,
  Network,
  PieChart,
  Sparkles,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import React, { useEffect, useState } from 'react'

import { mindClient, type SuggestedAction } from '../../api/mind'

/** Lucide icon per suggested-action `icon` key. */
const ACTION_ICONS: Record<string, LucideIcon> = {
  node: Network,
  portfolio: PieChart,
  trade: ArrowLeftRight,
  wallet: Wallet,
}

/** Offline defaults — the same four the provider returns when a model is up. */
const DEFAULT_ACTIONS: SuggestedAction[] = [
  {
    icon: 'wallet',
    id: 'balance',
    prompt: "What's my balance?",
    subtitle: 'BTC, USDT & XAUT across your node',
    title: 'Check my balances',
  },
  {
    icon: 'node',
    id: 'node',
    prompt: 'How are my channels and node doing?',
    subtitle: 'Channels, liquidity and pending transfers',
    title: 'Node & channel health',
  },
  {
    icon: 'portfolio',
    id: 'portfolio',
    prompt: 'Review my portfolio allocation and suggest a rebalance',
    subtitle: 'Check drift vs targets and suggest a rebalance',
    title: 'Optimize my portfolio',
  },
  {
    icon: 'trade',
    id: 'buy',
    prompt: 'Buy 100 USDT',
    subtitle: 'Quote and open an asset channel',
    title: 'Buy 100 USDT',
  },
]

/**
 * Compact next-step buttons rendered UNDER an assistant reply — the agent's
 * proposed follow-ups (provided per-turn by the sidecar). One tap continues.
 */
export const FollowupActions: React.FC<{
  actions: SuggestedAction[]
  disabled: boolean
  onPick: (prompt: string) => void
}> = ({ actions, disabled, onPick }) => {
  if (!actions.length) return null
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {actions.map((a) => {
        const Icon = ACTION_ICONS[a.icon] ?? Sparkles
        return (
          <button
            className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-surface-overlay/50 px-3 py-1.5 text-xs font-medium text-content-secondary transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:text-content-primary disabled:opacity-40 disabled:hover:translate-y-0"
            disabled={disabled}
            key={a.id}
            onClick={() => onPick(a.prompt)}
            type="button"
          >
            <Icon className="h-3.5 w-3.5" />
            {a.title}
          </button>
        )
      })}
    </div>
  )
}

export const WelcomeActions: React.FC<{
  providerOn: boolean
  disabled: boolean
  onPick: (prompt: string) => void
}> = ({ disabled, onPick, providerOn }) => {
  const [actions, setActions] = useState<SuggestedAction[]>(DEFAULT_ACTIONS)

  // Ask the agent for its own starters once a model is online; fall back to the
  // defaults on any error so the first screen is never empty.
  useEffect(() => {
    if (!providerOn) return
    let alive = true
    mindClient
      .getSuggestedActions()
      .then((a) => {
        if (alive && Array.isArray(a) && a.length) setActions(a)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [providerOn])

  return (
    <div className="mt-5 grid w-full max-w-md grid-cols-1 gap-2.5 sm:grid-cols-2">
      {actions.map((a) => {
        const Icon = ACTION_ICONS[a.icon] ?? Sparkles
        return (
          <button
            className="group flex items-start gap-3 rounded-xl border border-border-default bg-surface-overlay/50 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-surface-overlay disabled:opacity-40 disabled:hover:translate-y-0"
            disabled={disabled}
            key={a.id}
            onClick={() => onPick(a.prompt)}
            type="button"
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Icon className="h-[1.05rem] w-[1.05rem]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-content-primary">
                {a.title}
              </p>
              <p className="mt-0.5 text-xs leading-snug text-content-tertiary">
                {a.subtitle}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
