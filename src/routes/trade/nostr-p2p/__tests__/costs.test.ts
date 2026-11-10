import { describe, expect, it, vi } from 'vitest'

import type { Trade } from '../api'
import {
  combineSettlements,
  makerEstimate,
  makerSettlement,
  settle,
  takerSettlement,
  tradeSettlement,
} from '../costs'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))

const offer = {
  network_fee_sat: 2_000,
  platform_fee_sat: 1_000,
  price_sat: 10_000,
  rgb_output_sat: 1_000,
}

const trade = (extra: Partial<Trade>): Trade => ({
  amount: 100,
  asset_id: 'rgb:demo',
  confirmations: 0,
  error: null,
  fee_sat: 1_000,
  id: 't',
  price_sat: 10_000,
  required: 1,
  role: 'taker',
  side: 'buy',
  status: 'settled',
  ticker: 'DEMO',
  ts: 0,
  txid: null,
  ...extra,
})

describe('who reserves what', () => {
  it('reserves 14000 for a taker buying and keeps the RGB output', () => {
    const s = takerSettlement({ ...offer, side: 'sell' })
    expect(s).toMatchObject({
      receiveSat: 0,
      reserveSat: 14_000,
      retainedSat: 1_000,
      side: 'buy',
      youFundRgb: true,
      youPayFees: true,
    })
  })

  it('reserves 0 for a maker selling and still shows the gross price', () => {
    const s = makerSettlement({ ...offer, side: 'sell' })
    expect(s).toMatchObject({
      receiveSat: 10_000,
      reserveSat: 0,
      retainedSat: 0,
      youFundRgb: false,
      youPayFees: false,
    })
  })

  it('reserves 11000 for a maker buying: price and RGB output, not the taker fees', () => {
    const s = makerSettlement({ ...offer, side: 'buy' })
    expect(s.reserveSat).toBe(11_000)
    expect(s.receiveSat).toBe(0)
    expect(s.retainedSat).toBe(1_000)
    expect(s.youPayFees).toBe(false)
  })

  it('reserves 3000 for a taker selling and does not reduce the gross price', () => {
    const s = takerSettlement({ ...offer, side: 'buy' })
    expect(s.reserveSat).toBe(3_000)
    expect(s.receiveSat).toBe(10_000)
    expect(s.receiveSat).not.toBe(7_000)
    expect(s.retainedSat).toBe(0)
  })

  it('adds two taker buys to 28000 and two taker sells to 6000 reserved', () => {
    const buys = [
      takerSettlement({ ...offer, side: 'sell' }),
      takerSettlement({ ...offer, side: 'sell' }),
    ]
    expect(combineSettlements(buys)?.reserveSat).toBe(28_000)
    const sells = [
      takerSettlement({ ...offer, side: 'buy' }),
      takerSettlement({ ...offer, side: 'buy' }),
    ]
    const both = combineSettlements(sells)
    expect(both?.reserveSat).toBe(6_000)
    expect(both?.receiveSat).toBe(20_000)
  })

  it('keeps a reported zero and does not treat it as missing', () => {
    const s = settle({
      networkFeeSat: 0,
      platformFeeSat: 0,
      priceSat: 10_000,
      rgbOutputSat: 0,
      role: 'taker',
      side: 'buy',
    })
    expect(s.reserveSat).toBe(10_000)
    expect(s.platformFeeSat).toBe(0)
    expect(s.networkFeeSat).toBe(0)
    expect(s.rgbOutputSat).toBe(0)
  })
})

describe('older trades', () => {
  it('uses fee_sat as the platform fee and does not invent the rest', () => {
    const s = tradeSettlement(
      trade({
        fee_sat: 1_000,
        role: 'taker',
        side: 'buy',
      })
    )
    expect(s.platformFeeSat).toBe(1_000)
    expect(s.platformFromLegacy).toBe(true)
    expect(s.networkFeeSat).toBeNull()
    expect(s.rgbOutputSat).toBeNull()
    expect(s.reserveSat).toBeNull()
    expect(s.receiveSat).toBe(0)
  })

  it('does not fill a legacy maker buy from a fee schedule', () => {
    const legacy = tradeSettlement(
      trade({ fee_sat: 1_000, role: 'maker', side: 'buy' })
    )
    const guessed = makerEstimate({
      feeBps: 100,
      minFeeSat: 1_000,
      networkFeeSat: 2_000,
      priceSat: 10_000,
      side: 'buy',
    })
    expect(legacy.networkFeeSat).toBeNull()
    expect(legacy.rgbOutputSat).toBeNull()
    expect(legacy.reserveSat).toBeNull()
    expect(guessed.settlement.networkFeeSat).toBe(2_000)
    expect(legacy.networkFeeSat).not.toBe(guessed.settlement.networkFeeSat)
  })

  it('uses the offer split when all three fields are present, including zeros', () => {
    const s = tradeSettlement(
      trade({
        fee_sat: 9_999,
        network_fee_sat: 0,
        platform_fee_sat: 0,
        rgb_output_sat: 0,
        role: 'taker',
        side: 'sell',
      })
    )
    expect(s.platformFromLegacy).toBe(false)
    expect(s.platformFeeSat).toBe(0)
    expect(s.networkFeeSat).toBe(0)
    expect(s.reserveSat).toBe(0)
    expect(s.receiveSat).toBe(10_000)
  })
})
