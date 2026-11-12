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

/**
 * Where the user is in three steps, in one slim line: which step they are on, one sentence about
 * it, and the one action that moves them on. Once they have funded the wallet and traded it steps
 * out of the way.
 */
export function HowItWorks({
  funded,
  active,
  confirmations,
  onDeposit,
}: Props) {
  const tr = useTr()
  const [dismissed, setDismissed] = useState(read)
  const [openAgain, setOpenAgain] = useState(false)

  const close = (v: boolean) => {
    setDismissed(v)
    setOpenAgain(!v)
    write(v)
  }

  // someone who has deposited and traded needs no guide unless they ask for it
  const done = funded && active
  if ((dismissed || done) && !openAgain) {
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
        'Add BTC on the selected network to this trading wallet. To sell an asset, deposit it here too.'
      ),
      done: funded,
      title: tr('guide.s1', 'Deposit'),
    },
    {
      body: tr(
        'guide.s2Body',
        'Choose Market to accept an offer, or Limit to publish your price. Keep desktop online while your offer or swap is active.'
      ),
      done: active,
      title: tr('guide.s2', 'Buy or sell'),
    },
    {
      body:
        confirmations > 0
          ? tr(
              'guide.s3Body',
              'Follow the swap in Activity. After {{n}} confirmations, settled funds become available to withdraw.',
              { n: confirmations }
            )
          : tr(
              'guide.s3BodyNow',
              'Follow the swap in Activity. Settled, unreserved funds can be withdrawn.'
            ),
      done: false,
      title: tr('guide.s3', 'Settle and withdraw'),
    },
  ]
  const current = Math.max(
    0,
    steps.findIndex((s) => !s.done)
  )
  const here = steps[current]!

  return (
    <section
      aria-label={tr('guide.title', 'How it works')}
      className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl bg-surface-card/70 py-2.5 pl-4 pr-10 relative"
    >
      <ol className="flex items-center gap-2">
        {steps.map((s, i) => (
          <li className="flex items-center gap-2" key={s.title}>
            <span
              aria-current={i === current ? 'step' : undefined}
              className={cx(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-tiny font-bold',
                s.done
                  ? 'bg-primary text-text-on-accent'
                  : i === current
                    ? 'bg-primary/20 text-primary'
                    : 'bg-surface-raised text-content-tertiary'
              )}
            >
              {s.done ? <Check aria-hidden size={12} /> : i + 1}
            </span>
            <span
              className={cx(
                'text-caption',
                i === current
                  ? 'font-medium text-content-primary'
                  : 'text-content-tertiary'
              )}
            >
              {s.title}
            </span>
            {i < steps.length - 1 && (
              <span aria-hidden className="h-px w-4 bg-surface-raised" />
            )}
          </li>
        ))}
      </ol>
      <p className="min-w-48 flex-1 text-caption text-content-secondary">
        {here.body}
      </p>
      {current === 0 && onDeposit && (
        <button
          className="shrink-0 rounded-lg bg-primary px-3 py-1 text-caption font-bold text-text-on-accent hover:opacity-90"
          onClick={onDeposit}
          type="button"
        >
          {tr('guide.s1Cta', 'Deposit now')}
        </button>
      )}
      <button
        aria-label={tr('guide.hide', 'Hide this guide')}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-content-tertiary hover:text-content-primary"
        onClick={() => close(true)}
        type="button"
      >
        <X aria-hidden size={14} />
      </button>
    </section>
  )
}
