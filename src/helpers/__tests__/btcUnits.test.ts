import { describe, expect, it } from 'vitest'

import { toMsat, toSats } from '../btcUnits'

describe('btc unit conversion', () => {
  it('converts SAT and BTC display amounts to sats', () => {
    expect(toSats(25_000, 'SAT')).toBe(25_000)
    expect(toSats(0.00025, 'BTC')).toBe(25_000)
  })

  it('rounds away floating point noise', () => {
    // 0.1 + 0.2 BTC style errors must not leak a fractional sat.
    expect(toSats(0.29, 'BTC')).toBe(29_000_000)
    expect(toSats(0.00000001, 'BTC')).toBe(1)
  })

  it('converts to millisatoshis', () => {
    expect(toMsat(1, 'SAT')).toBe(1000)
    expect(toMsat(0.001, 'BTC')).toBe(100_000_000)
  })
})
