import { describe, expect, it } from 'vitest'

import type { Balance } from '../../trade/nostr-p2p/api'
import { bitcoinSummary } from '../summary'

describe('bitcoinSummary', () => {
  it('uses confirmed bitcoin when the daemon reports it', () => {
    const b = {
      assets: [],
      btc_coins: [5, 4],
      btc_pending_sat: 300,
      btc_settled_sat: 9_000,
      btc_spendable_sat: 9_300,
    } satisfies Balance
    expect(bitcoinSummary(b)).toEqual({ coins: 2, pending: 300, ready: 9_000 })
  })

  it('falls back to spendable bitcoin for an older daemon, and to zero without a balance', () => {
    expect(bitcoinSummary({ assets: [], btc_spendable_sat: 50 })).toEqual({
      coins: 0,
      pending: 0,
      ready: 50,
    })
    expect(bitcoinSummary(undefined)).toEqual({
      coins: 0,
      pending: 0,
      ready: 0,
    })
  })
})
