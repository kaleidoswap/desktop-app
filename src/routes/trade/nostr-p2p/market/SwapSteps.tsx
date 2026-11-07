import { Check } from 'lucide-react'

import { useTr } from './hooks'
import { STEPS, tradeStage } from './progress'
import { cx } from './ui'

import type { Trade } from '../api'

/**
 * Where a swap is, as the steps it goes through, with a line on what it is waiting for. A failed
 * swap shows why in words, since that is what the user can act on.
 */
export function SwapSteps({ trade }: { trade: Trade }) {
  const tr = useTr()
  const { stage, step, waitingOn, failure } = tradeStage(trade)

  const names: Record<(typeof STEPS)[number], string> = {
    confirming: tr('swap.confirming', 'Confirming'),
    requested: tr('swap.requested', 'Requested'),
    settled: tr('swap.settled', 'Settled'),
    signing: tr('swap.signing', 'Signing'),
  }

  const detail = failure
    ? failure.kind === 'funds'
      ? tr(
          'swap.failedFunds',
          'Not enough bitcoin to cover the swap and its fees. Add funds and try again.'
        )
      : failure.kind === 'noAnswer'
        ? tr(
            'swap.failedNoAnswer',
            'The maker did not answer. Nothing was spent; try another order.'
          )
        : failure.error ||
          tr('swap.failed', 'The swap did not complete. Nothing was spent.')
    : stage === 'requested'
      ? waitingOn === 'maker'
        ? tr(
            'swap.waitMaker',
            'Waiting for the maker to answer. The maker must be online.'
          )
        : tr('swap.requestIn', 'Request received.')
      : stage === 'signing'
        ? waitingOn === 'taker'
          ? tr('swap.waitTaker', 'Waiting for the other side to sign.')
          : tr('swap.signingNow', 'Both sides are signing.')
        : stage === 'confirming'
          ? trade.required > 0
            ? tr(
                'swap.confirmBlocks',
                'On chain: {{have}} of {{need}} confirmations.',
                { have: trade.confirmations, need: trade.required }
              )
            : tr('swap.onChain', 'On chain, waiting for confirmations.')
          : null

  return (
    <div className="col-span-full flex flex-col gap-1.5 pt-1">
      <ol
        aria-label={tr('swap.steps', 'Swap progress')}
        className="flex items-center gap-1"
      >
        {STEPS.map((name, i) => {
          const done = step > i || stage === 'settled'
          const current = step === i && stage !== 'settled'
          return (
            <li className="flex flex-1 items-center gap-1" key={name}>
              <span
                aria-current={current ? 'step' : undefined}
                className={cx(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px]',
                  done && 'bg-status-success text-text-on-accent',
                  current && !failure && 'bg-primary text-text-on-accent',
                  !done && !current && 'bg-surface-high text-content-tertiary',
                  failure && 'bg-status-danger-subtle text-status-danger'
                )}
              >
                {done ? <Check size={10} /> : i + 1}
              </span>
              <span
                className={cx(
                  'truncate text-[11px]',
                  current || done
                    ? 'text-content-secondary'
                    : 'text-content-tertiary'
                )}
              >
                {names[name]}
              </span>
              {i < STEPS.length - 1 && (
                <span
                  className={cx(
                    'h-px flex-1',
                    done ? 'bg-status-success' : 'bg-surface-high'
                  )}
                />
              )}
            </li>
          )
        })}
      </ol>
      {detail && (
        <p
          className={cx(
            'text-[11px]',
            failure ? 'text-status-danger' : 'text-content-tertiary'
          )}
        >
          {detail}
        </p>
      )}
    </div>
  )
}
