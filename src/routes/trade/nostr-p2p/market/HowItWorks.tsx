import { Check, X } from 'lucide-react'
import { useState } from 'react'

import { useTr } from './hooks'
import { cx } from './ui'

const KEY = 'p2p-market.guide-dismissed'

const read = (): boolean => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

const write = (dismissed: boolean) => {
  try {
    if (dismissed) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    // the guide just comes back next time
  }
}

interface Props {
  /** The trading wallet holds something. */
  funded: boolean
  /** The user has an order or a trade. */
  active: boolean
  confirmations: number
  onDeposit?: () => void
}

/** Three steps that say how the market works, and which one the user is on. */
export function HowItWorks({
  funded,
  active,
  confirmations,
  onDeposit,
}: Props) {
  const tr = useTr()
  const [dismissed, setDismissed] = useState(read)

  const close = (v: boolean) => {
    setDismissed(v)
    write(v)
  }

  if (dismissed) {
    return (
      <button
        className="self-start text-caption text-content-tertiary transition-colors hover:text-content-secondary"
        onClick={() => close(false)}
        type="button"
      >
        {tr('guide.show', 'How does this work?')}
      </button>
    )
  }

  const steps = [
    {
      body: tr(
        'guide.s1Body',
        'The market trades from a separate trading wallet. Move bitcoin there from your node, plus any RGB asset you want to sell.'
      ),
      cta: !funded && onDeposit ? tr('guide.s1Cta', 'Deposit now') : null,
      done: funded,
      title: tr('guide.s1', 'Deposit'),
    },
    {
      body: tr(
        'guide.s2Body',
        'Market: trade right now with the best open orders. Limit: post your own price and wait for someone to take it.'
      ),
      cta: null,
      done: active,
      title: tr('guide.s2', 'Buy or sell'),
    },
    {
      body:
        confirmations > 0
          ? tr(
              'guide.s3Body',
              'Swaps are on-chain and settle after {{n}} confirmations. Withdraw back to your node whenever you like.',
              { n: confirmations }
            )
          : tr(
              'guide.s3BodyNow',
              'Swaps are on-chain. Withdraw back to your node whenever you like.'
            ),
      cta: null,
      done: false,
      title: tr('guide.s3', 'Settle and withdraw'),
    },
  ]
  const current = steps.findIndex((s) => !s.done)

  return (
    <section
      aria-label={tr('guide.title', 'How it works')}
      className="relative grid gap-3 rounded-2xl bg-surface-card/70 p-3 sm:grid-cols-3"
    >
      {steps.map((s, i) => (
        <div
          className={cx(
            'flex gap-3 rounded-xl p-3',
            i === current ? 'bg-primary/10' : 'bg-surface-inset/60'
          )}
          key={s.title}
        >
          <span
            className={cx(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-caption font-bold',
              s.done
                ? 'bg-primary text-text-on-accent'
                : i === current
                  ? 'bg-primary/20 text-primary'
                  : 'bg-surface-raised text-content-tertiary'
            )}
          >
            {s.done ? <Check aria-hidden size={14} /> : i + 1}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-body font-medium text-content-primary">
              {s.title}
            </p>
            <p className="text-caption text-content-secondary">{s.body}</p>
            {s.cta && (
              <button
                className="mt-1 self-start rounded-lg bg-primary px-3 py-1 text-caption font-bold text-text-on-accent hover:opacity-90"
                onClick={onDeposit}
                type="button"
              >
                {s.cta}
              </button>
            )}
          </div>
        </div>
      ))}
      <button
        aria-label={tr('guide.hide', 'Hide this guide')}
        className="absolute right-2 top-2 rounded-md p-1 text-content-tertiary hover:text-content-primary"
        onClick={() => close(true)}
        type="button"
      >
        <X aria-hidden size={14} />
      </button>
    </section>
  )
}
