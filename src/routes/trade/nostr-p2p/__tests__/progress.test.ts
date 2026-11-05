import { describe, expect, it, vi } from 'vitest'

import type { Trade } from '../api'
import { failureKind, noAnswer, swapProgress } from '../market/progress'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))

const trade = (extra: Partial<Trade>): Trade => ({
  amount: 1000,
  asset_id: 'rgb:A',
  confirmations: 0,
  error: null,
  fee_sat: 1000,
  id: 'o1',
  price_sat: 50_000,
  required: 3,
  role: 'taker',
  side: 'buy',
  status: 'negotiating',
  ticker: 'DEMO',
  ts: 0,
  txid: null,
  ...extra,
})

describe('how far a swap has got', () => {
  it('is waiting on the maker until a trade shows up', () => {
    expect(swapProgress([]).stage).toBe('requested')
  })

  it('is signing while any swap is still being negotiated', () => {
    expect(
      swapProgress([
        trade({}),
        trade({ id: 'o2', status: 'broadcast', txid: 'aa' }),
      ]).stage
    ).toBe('signing')
  })

  it('counts confirmations once everything is broadcast, by the shallowest swap', () => {
    const p = swapProgress([
      trade({ confirmations: 2, status: 'broadcast', txid: 'aa' }),
      trade({ confirmations: 1, id: 'o2', status: 'broadcast', txid: 'bb' }),
    ])
    expect(p).toMatchObject({
      confirmations: 1,
      required: 3,
      stage: 'confirming',
      txids: ['aa', 'bb'],
    })
  })

  it('is settled only when every swap is', () => {
    const s = (id: string) => trade({ id, status: 'settled', txid: id })
    expect(swapProgress([s('a'), s('b')]).stage).toBe('settled')
    expect(
      swapProgress([s('a'), trade({ id: 'b', status: 'broadcast', txid: 'b' })])
        .stage
    ).toBe('confirming')
  })

  it('keeps going with the swaps that did not fail', () => {
    const p = swapProgress([
      trade({ error: 'the maker did not answer', status: 'failed' }),
      trade({ confirmations: 1, id: 'o2', status: 'broadcast', txid: 'b' }),
    ])
    expect(p).toMatchObject({
      confirmations: 1,
      failures: [{ error: 'the maker did not answer', id: 'o1' }],
      stage: 'confirming',
      txids: ['b'],
    })
  })

  it('is failed once every swap is', () => {
    const p = swapProgress([
      trade({ error: 'nope', status: 'failed' }),
      trade({ error: 'nope too', id: 'o2', status: 'failed' }),
    ])
    expect(p.stage).toBe('failed')
    expect(p.failures).toHaveLength(2)
  })

  it('recognises a wallet with no free coin left', () => {
    expect(
      failureKind(
        "rgb-lib: Insufficient bitcoin funds: needed '29500', available '0'"
      )
    ).toBe('funds')
    expect(failureKind('the maker did not answer')).toBe('other')
  })
})

describe('a maker that does not answer', () => {
  it('is told apart from other failures', () => {
    expect(noAnswer('timed out waiting for proposal')).toBe(true)
    expect(noAnswer('Timed out waiting for proposal')).toBe(true)
    expect(noAnswer('swap aborted by peer: no thanks')).toBe(false)
    expect(noAnswer(null)).toBe(false)
  })
})

describe('a request waiting for the maker', () => {
  it('is requested until the maker answers, then signing', () => {
    expect(
      swapProgress([trade({ answered: false, status: 'negotiating' })]).stage
    ).toBe('requested')
    expect(
      swapProgress([trade({ answered: true, status: 'negotiating' })]).stage
    ).toBe('signing')
    // an older daemon does not say
    expect(swapProgress([trade({ status: 'negotiating' })]).stage).toBe(
      'signing'
    )
  })
})
