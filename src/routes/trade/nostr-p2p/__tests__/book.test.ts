import { describe, expect, it, vi } from 'vitest'

import type { Order } from '../api'
import {
  nextMakers,
  ordersAwaitingRelay,
  ordersOnScreen,
  planMarket,
  splitBook,
  withDepth,
} from '../book'
import {
  fmtPrice,
  fmtTradeAmount,
  fmtUnits,
  takerCost,
  timeLeft,
  toBase,
  tradePrecision,
  tradeUnitPrice,
} from '../format'

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
  registry: null,
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
    // price, plus the taker fees, plus the RGB output on each buy
    expect(plan.sats).toBe(75_500 + 2 * 3000 + 2 * 1000)
    expect(plan.reserveSat).toBe(plan.sats)
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
    // gross price, not the price minus the fees the taker also reserves
    expect(plan.sats).toBe(39_200 + 18_000)
    expect(plan.reserveSat).toBe(2 * 3000)
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

describe('a market order and what the wallet and the makers allow', () => {
  const maker = (m: string) => ({ maker: m })
  const asks = [
    order('sell', 100, 5000, maker('A')), // reserves 9000
    order('sell', 100, 5100, maker('A')),
    order('sell', 100, 5200, maker('B')),
    order('sell', 100, 5300, maker('A')),
    order('sell', 100, 5400, maker('A')), // a fourth from A
  ]

  it('asks one maker for no more swaps at once than it takes', () => {
    const plan = planMarket(asks, 'buy', 1000, 0.2)
    expect(plan.picks.filter((o) => o.maker === 'A')).toHaveLength(3)
    expect(plan.tooManyFromMaker).toBe(1)
    expect(plan.picks).toHaveLength(4)
  })

  it('takes no more orders than the wallet has coins for', () => {
    // two coins that can each cover one reservation (price + 3000 fees + 1000 rgb)
    const plan = planMarket(asks, 'buy', 1000, 0.2, { coins: [9300, 9200] })
    expect(plan.picks).toHaveLength(2)
    expect(plan.noCoinFor).toBe(3)
    expect(plan.picks.map((o) => o.unit_price)).toEqual([50, 51])
  })

  it('gives each swap a coin large enough for what it pays', () => {
    // one coin is too small for any order, the other covers exactly one
    const plan = planMarket(asks, 'buy', 1000, 0.2, { coins: [1000, 9000] })
    expect(plan.picks).toHaveLength(1)
    expect(plan.noCoinFor).toBe(4)
  })

  it('does not hold a seller to coins: it is paid in bitcoin', () => {
    const bids = [
      order('buy', 100, 4000, maker('A')),
      order('buy', 100, 3900, maker('B')),
    ]
    const plan = planMarket(bids, 'sell', 1000, 0.2, { coins: [] })
    expect(plan.picks).toHaveLength(2)
    expect(plan.noCoinFor).toBe(0)
  })

  it('does not limit by coins when the daemon does not say', () => {
    expect(planMarket(asks, 'buy', 1000, 0.2).picks.length).toBe(4)
  })
})

describe('numbers', () => {
  it('a buying taker reserves 14000, not 13000, and keeps the RGB output', () => {
    const buy = order('sell', 100, 10_000, {
      network_fee_sat: 2_000,
      platform_fee_sat: 1_000,
      rgb_output_sat: 1_000,
    })
    expect(takerCost(buy)).toEqual({
      fees: 3_000,
      pay: 14_000,
      receive: 0,
      reserveSat: 14_000,
      retainedSat: 1_000,
    })
    const another = order('sell', 100, 10_000, {
      network_fee_sat: 2_000,
      platform_fee_sat: 1_000,
      rgb_output_sat: 1_000,
    })
    expect(takerCost(buy).reserveSat + takerCost(another).reserveSat).toBe(
      28_000
    )
  })

  it('a selling taker reserves only the fees and is still paid the gross price', () => {
    expect(
      takerCost(
        order('buy', 100, 10_000, {
          network_fee_sat: 2_000,
          platform_fee_sat: 1_000,
          rgb_output_sat: 1_000,
        })
      )
    ).toEqual({
      fees: 3_000,
      pay: 3_000,
      receive: 10_000,
      reserveSat: 3_000,
      retainedSat: 0,
    })
  })

  it('a coin of 13000 does not cover the 14000 buy reservation', () => {
    const ask = order('sell', 100, 10_000, {
      network_fee_sat: 2_000,
      platform_fee_sat: 1_000,
      rgb_output_sat: 1_000,
    })
    expect(planMarket([ask], 'buy', 100, 1, { coins: [13_000] }).picks).toEqual(
      []
    )
    const covered = planMarket([ask], 'buy', 100, 1, { coins: [14_000] })
    expect(covered.picks).toHaveLength(1)
    expect(covered.reserveSat).toBe(14_000)
    expect(covered.sats).toBe(14_000)
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

describe('trying another maker', () => {
  it('suggests other makers, the ones around first and then the best price', () => {
    const asked = order('sell', 100, 41_000, { maker: 'asked' })
    const book = [
      asked,
      order('sell', 100, 40_000, { away: true, maker: 'far' }),
      order('sell', 100, 45_000, { maker: 'near-dear' }),
      order('sell', 100, 42_000, { maker: 'near-cheap' }),
      order('buy', 100, 30_000, { maker: 'other-side' }),
      order('sell', 100, 39_000, { asset_id: 'rgb:B', maker: 'other-asset' }),
      order('sell', 100, 38_000, { maker: 'me', mine: true }),
    ]
    const got = nextMakers(book, asked, new Set([asked.order_id]))
    expect(got.map((o) => o.maker)).toEqual(['near-cheap', 'near-dear', 'far'])
  })

  it('does not suggest the same maker or an order already tried', () => {
    const asked = order('sell', 100, 41_000, { maker: 'asked' })
    const same = order('sell', 100, 40_000, { maker: 'asked' })
    const tried = order('sell', 100, 42_000, { maker: 'b' })
    const fresh = order('sell', 100, 43_000, { maker: 'c' })
    const got = nextMakers(
      [asked, same, tried, fresh],
      asked,
      new Set([tried.order_id])
    )
    expect(got).toEqual([fresh])
  })

  it('prefers the dearest buyer when taking a buy order', () => {
    const asked = order('buy', 100, 30_000, { maker: 'asked' })
    const book = [
      asked,
      order('buy', 100, 28_000, { maker: 'b' }),
      order('buy', 100, 29_000, { maker: 'c' }),
    ]
    expect(nextMakers(book, asked, new Set()).map((o) => o.maker)).toEqual([
      'c',
      'b',
    ])
  })
})

describe('a limit the relays have not echoed yet', () => {
  it('shows this wallet’s own open order when the book is still empty', () => {
    const mine = order('sell', 100, 50_000, {
      mine: true,
      order_id: 'mine',
      state: 'open',
    })
    const shown = ordersOnScreen([], [mine])
    expect(shown.map((o) => o.order_id)).toEqual(['mine'])
    expect(shown[0]?.mine).toBe(true)
    expect(ordersAwaitingRelay([], [mine])).toEqual(['mine'])
  })

  it('does not duplicate an order the book already has, or invent anyone else’s', () => {
    const theirs = order('buy', 100, 40_000, { maker: 'them', order_id: 't' })
    const echoed = order('sell', 100, 50_000, {
      away: true,
      order_id: 'mine',
    })
    const local = order('sell', 100, 50_000, {
      away: false,
      mine: true,
      order_id: 'mine',
      state: 'open',
    })
    const shown = ordersOnScreen([theirs, echoed], [local])
    expect(shown.map((o) => o.order_id)).toEqual(['t', 'mine'])
    expect(shown.find((o) => o.order_id === 'mine')?.away).toBe(true)
    expect(ordersAwaitingRelay([theirs, echoed], [local])).toEqual([])
  })

  it('leaves out an own order that is no longer open', () => {
    const done = order('sell', 100, 50_000, {
      mine: true,
      order_id: 'mine',
      state: 'filled',
    })
    expect(ordersOnScreen([], [done])).toEqual([])
    expect(ordersAwaitingRelay([], [done])).toEqual([])
  })
})

describe('trade amounts', () => {
  it('uses the precision the trade carries', () => {
    const trade = { amount: 150, asset_id: 'rgb:A', precision: 2 }
    expect(tradePrecision(trade, [])).toBe(2)
    expect(fmtTradeAmount(trade.amount, 2)).toBe('1.5')
    expect(tradeUnitPrice({ ...trade, price_sat: 3000 })).toBe(2000)
  })

  it('looks up a missing precision from an asset already on screen', () => {
    const trade = { amount: 100_000_000, asset_id: 'rgb:A', price_sat: 50_000 }
    const known = [{ asset_id: 'rgb:A', precision: 8 }]
    expect(tradePrecision(trade, known)).toBe(8)
    expect(fmtTradeAmount(trade.amount, tradePrecision(trade, known))).toBe('1')
    expect(tradeUnitPrice(trade, known)).toBe(50_000)
  })

  it('does not invent a scale when nothing on screen knows the asset', () => {
    const trade = { amount: 150, asset_id: 'rgb:missing', price_sat: 3000 }
    expect(tradePrecision(trade, [{ asset_id: 'rgb:A', precision: 8 }])).toBe(
      null
    )
    expect(fmtTradeAmount(trade.amount, null)).toBe('150')
    expect(tradeUnitPrice(trade, [])).toBeUndefined()
  })
})
