import { describe, expect, it } from 'vitest'
import { summarizeChannelBalances } from '../channelBalances'

describe('channel balance summary', () => {
  it('does not confuse the local balance with liquidity after reserves', () => {
    expect(
      summarizeChannelBalances([
        {
          inbound_balance_msat: 78340000,
          local_balance_sat: 20000,
          outbound_balance_msat: 19000000,
        },
      ])
    ).toEqual({ inboundSat: 78340, localBalanceSat: 20000, outboundSat: 19000 })
  })
  it('aggregates millisats before rounding', () => {
    expect(
      summarizeChannelBalances([
        { outbound_balance_msat: 1500 },
        { outbound_balance_msat: 1500 },
      ]).outboundSat
    ).toBe(3)
  })
  it('handles an empty successful channel list', () => {
    expect(summarizeChannelBalances([])).toEqual({
      inboundSat: 0,
      localBalanceSat: 0,
      outboundSat: 0,
    })
  })
})
