import { describe, expect, it } from 'vitest'

import { findNewOutgoingTxid } from '../sentTxid'

const tx = (
  txid: string,
  sent: number,
  received: number,
  confirmed = false
) => ({
  confirmation_time: confirmed ? { timestamp: 1 } : null,
  received,
  sent,
  txid,
})

describe('findNewOutgoingTxid', () => {
  it('returns the new outgoing transaction', () => {
    const before = ['old']
    const after = [tx('old', 5000, 0, true), tx('new', 10_000, 3000)]
    expect(findNewOutgoingTxid(before, after)).toBe('new')
  })

  it('ignores new incoming transactions', () => {
    expect(findNewOutgoingTxid([], [tx('in', 0, 5000)])).toBeUndefined()
  })

  it('prefers the single unconfirmed send when several are new', () => {
    const after = [tx('a', 1000, 0, true), tx('b', 2000, 0)]
    expect(findNewOutgoingTxid([], after)).toBe('b')
  })

  it('gives up when the result is ambiguous', () => {
    expect(
      findNewOutgoingTxid([], [tx('a', 1000, 0), tx('b', 2000, 0)])
    ).toBeUndefined()
  })
})
