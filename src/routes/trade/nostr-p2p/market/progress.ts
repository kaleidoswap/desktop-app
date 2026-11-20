import type { Trade } from '../api'

export type Stage =
  'requested' | 'signing' | 'confirming' | 'settled' | 'failed'

export interface Failure {
  id: string
  error: string
}

export interface Progress {
  stage: Stage
  /** Blocks on the swap transaction (the least of them when there are several swaps). */
  confirmations: number
  required: number
  txids: string[]
  /** Swaps that did not start or did not finish. The others carry on. */
  failures: Failure[]
}

/**
 * Where a set of swaps taken together stands, from the daemon's trade list. Nothing listed yet
 * means the request is still on its way to the maker. A swap that failed does not stop the others:
 * the stage is that of the swaps still going, and `failed` only once none is.
 */
export function swapProgress(trades: Trade[]): Progress {
  const failures = trades
    .filter((t) => t.status === 'failed')
    .map((t) => ({ error: t.error ?? '', id: t.id }))
  const live = trades.filter((t) => t.status !== 'failed')
  const txids = live.flatMap((t) => (t.txid ? [t.txid] : []))
  const through = live.filter(
    (t) => t.status === 'broadcast' || t.status === 'settled'
  )
  const base = {
    confirmations: through.length
      ? Math.min(
          ...through.map((t) =>
            t.status === 'settled' ? t.required : t.confirmations
          )
        )
      : 0,
    failures,
    required: Math.max(0, ...live.map((t) => t.required)),
    txids,
  }
  if (!trades.length) return { ...base, stage: 'requested' }
  if (!live.length) return { ...base, stage: 'failed' }
  // still waiting for the maker: negotiating, and nobody has answered (an older daemon, which does
  // not say, is taken to have been answered, as before)
  if (live.every((t) => t.status === 'negotiating' && t.answered === false))
    return { ...base, stage: 'requested' }
  if (live.every((t) => t.status === 'settled'))
    return { ...base, stage: 'settled' }
  if (through.length === live.length) return { ...base, stage: 'confirming' }
  return { ...base, stage: 'signing' }
}

/** The failures people can do something about get a name; the rest are shown as the daemon said. */
export function failureKind(raw: string): 'funds' | 'other' {
  return /insufficient bitcoin funds/i.test(raw) ? 'funds' : 'other'
}

/** The maker never answered the request: the signal to try another one. */
export const noAnswer = (raw: string | null | undefined): boolean =>
  /timed out waiting for proposal/i.test(raw ?? '')

/** The steps of a swap, in order. A failed swap sits at none of them. */
export const STEPS = ['requested', 'signing', 'confirming', 'settled'] as const

export interface TradeStage {
  stage: Stage
  /** Index in [`STEPS`] of the step the swap is on; -1 for a failed one. */
  step: number
  /** Who the swap is waiting for, when it is waiting on the other side. */
  waitingOn: 'maker' | 'taker' | null
  /** Why a failed swap failed, in the daemon's words, and whether the user can act on it. */
  failure?: { error: string; kind: 'funds' | 'noAnswer' | 'other' }
}

/** Where one swap stands, for the row that shows it. */
export function tradeStage(t: Trade): TradeStage {
  const { stage } = swapProgress([t])
  const step = stage === 'failed' ? -1 : STEPS.indexOf(stage)
  // a taker waits for the maker's proposal; a maker, once it has sent one, for the taker's signature
  const waitingOn =
    stage === 'requested' && t.role === 'taker'
      ? 'maker'
      : stage === 'signing' && t.role === 'maker'
        ? 'taker'
        : null
  if (stage !== 'failed') return { stage, step, waitingOn }
  const error = t.error ?? ''
  return {
    failure: {
      error,
      kind: noAnswer(error)
        ? 'noAnswer'
        : failureKind(error) === 'funds'
          ? 'funds'
          : 'other',
    },
    stage,
    step,
    waitingOn: null,
  }
}
