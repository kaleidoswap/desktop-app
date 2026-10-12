import { describe, expect, it, vi } from 'vitest'

import type { Order } from '../api'
import { planMarket, splitBook, withDepth } from '../book'
import { fmtPrice, fmtUnits, takerCost, timeLeft, toBase } from '../format'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))

let n = 0
const order = (
  side: 'sell' | 'buy',
  amount: number,
  priceSat: number,
  extra: Partial<Order> = {}
): Order => ({
  amount,
  asset_id: 'rgb:A',
  away: false,
  expiry: 0,
  impersonates: null,
  last_seen: 0,
  maker: 'm',
  mine: false,
  name: 'Demo',
  network_fee_sat: 2000,
  order_id: `o${n++}`,
  platform_fee_sat: 1000,
  precision: 0,
  price_sat: priceSat,
  rgb_output_sat: 1000,
  side,
  state: null,
  ticker: 'DEMO',
  unit_price: priceSat / amount,
  verified: false,
  ...extra,
})

describe('the book', () => {
  it('puts the cheapest seller and the highest buyer first', () => {
    const { asks, bids } = splitBook([
      order('sell', 100, 6000),
      order('sell', 100, 5000),
      order('buy', 100, 4000),
      order('buy', 100, 4500),
    ])
    expect(asks.map((o) => o.unit_price)).toEqual([50, 60])
    expect(bids.map((o) => o.unit_price)).toEqual([45, 40])
  })

  it('accumulates size outward from the best price', () => {
    const rows = withDepth([
      order('sell', 100, 5000),
      order('sell', 300, 18000),
    ])
    expect(rows.map((r) => r.cum)).toEqual([100, 400])
  })
})

describe('a market order', () => {
  const book = [
    order('sell', 1000, 50_000), // 50
    order('sell', 500, 25_500), // 51
    order('sell', 2000, 120_000), // 60
    order('buy', 800, 39_200), // 49
    order('buy', 400, 18_000), // 45
  ]

  it('buys the best-priced orders that fit inside the amount', () => {
    const plan = planMarket(book, 'buy', 1500, 0.05)
    expect(plan.picks.map((o) => o.amount)).toEqual([1000, 500])
    expect(plan.baseAmount).toBe(1500)
    expect(plan.shortBy).toBe(0)
    // 75_500 sats of price plus two sets of fees
    expect(plan.sats).toBe(75_500 + 2 * 3000)
    expect(plan.fees).toBe(6000)
    expect(plan.avgPrice).toBeCloseTo(75_500 / 1500)
  })

  it('stays inside the price limit and says what was left out', () => {
    const plan = planMarket(book, 'buy', 5000, 0.05)
    expect(plan.picks).toHaveLength(2) // the 60 ask is more than 5% above the best
    expect(plan.beyondLimit).toBe(1)
    expect(plan.shortBy).toBe(3500)
  })

  it('tells the user which order would fit when nothing does', () => {
    const plan = planMarket(book, 'buy', 400, 0.05)
    expect(plan.picks).toEqual([])
    expect(plan.nextFit?.amount).toBe(1000)
    expect(plan.shortBy).toBe(400)
  })

  it('sells into the highest bids and receives their price', () => {
    const plan = planMarket(book, 'sell', 1200, 0.2)
    expect(plan.picks.map((o) => o.amount)).toEqual([800, 400])
    expect(plan.baseAmount).toBe(1200)
    expect(plan.sats).toBe(39_200 + 18_000)
  })

  it('never trades against its own orders', () => {
    const mine = order('sell', 1000, 40_000, { mine: true })
    const plan = planMarket([mine, ...book], 'buy', 1000, 0.05)
    expect(plan.picks.map((o) => o.mine)).toEqual([false])
    expect(plan.picks[0]?.unit_price).toBe(50)
  })

  it('plans nothing against an empty side', () => {
    const plan = planMarket([order('buy', 100, 4000)], 'buy', 100, 0.05)
    expect(plan.picks).toEqual([])
    expect(plan.avgPrice).toBe(0)
  })
})

describe('numbers', () => {
  it('a buyer pays price and fees, a seller gets the price', () => {
    expect(takerCost(order('sell', 1000, 50_000))).toEqual({
      fees: 3000,
      pay: 53_000,
      receive: 0,
    })
    expect(takerCost(order('buy', 1000, 50_000))).toEqual({
      fees: 3000,
      pay: 0,
      receive: 50_000,
    })
  })

  it('reads typed amounts without float drift', () => {
    expect(toBase('1.5', 2)).toBe(150)
    expect(toBase('0.1', 8)).toBe(10_000_000)
    expect(toBase('', 2)).toBe(0)
    expect(toBase('1e3', 2)).toBe(0)
  })

  it('formats prices with the precision a small price needs', () => {
    expect(fmtPrice(1234)).toBe('1,234')
    expect(fmtPrice(50)).toBe('50.00')
    expect(fmtPrice(150)).toBe('150.0')
    expect(fmtPrice(1.5)).toBe('1.50')
    expect(fmtPrice(0.0123)).toBe('0.0123')
    expect(fmtPrice(0)).toBe('–')
    expect(fmtUnits(150, 2)).toBe('1.5')
  })

  it('counts time left in the largest sensible unit', () => {
    const now = 1_000_000_000_000
    const at = (s: number) => Math.floor(now / 1000) + s
    expect(timeLeft(at(30), now)).toBe('30s')
    expect(timeLeft(at(600), now)).toBe('10m')
    expect(timeLeft(at(7200), now)).toBe('2h')
    expect(timeLeft(at(-5), now)).toBe('expired')
  })
})
