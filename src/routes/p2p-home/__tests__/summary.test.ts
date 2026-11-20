import { describe, expect, it } from 'vitest'

import type { Balance, Order, Trade } from '../../trade/nostr-p2p/api'
import {
  bitcoinSummary,
  heldAssets,
  makerCounts,
  marketSummary,
  recentTrades,
} from '../summary'

const order = (o: Partial<Order>): Order => ({
  amount: 100,
  asset_id: 'rgb:usd',
  away: false,
  expiry: 0,
  impersonates: null,
  last_seen: 0,
  maker: 'm1',
  mine: false,
  name: null,
  network_fee_sat: 0,
  order_id: Math.random().toString(),
  platform_fee_sat: 0,
  precision: 2,
  price_sat: 0,
  registry: null,
  rgb_output_sat: 0,
  side: 'sell',
  state: null,
  ticker: 'USD',
  unit_price: 100,
  verified: false,
  ...o,
})

describe('marketSummary', () => {
  it('takes the cheapest sell as the buy price and the best buy as the sell price', () => {
    const s = marketSummary([
      order({ side: 'sell', unit_price: 1560 }),
      order({ side: 'sell', unit_price: 1555 }),
      order({ side: 'buy', unit_price: 1540 }),
      order({ side: 'buy', unit_price: 1545 }),
    ])
    expect(s).toEqual([
      {
        assetId: 'rgb:usd',
        buyAt: 1555,
        listed: false,
        offers: 4,
        sellAt: 1545,
        ticker: 'USD',
      },
    ])
  })

  it("leaves out the user's own orders and puts the busiest asset first", () => {
    const s = marketSummary([
      order({ asset_id: 'rgb:a', ticker: 'A' }),
      order({ asset_id: 'rgb:b', ticker: 'B' }),
      order({ asset_id: 'rgb:b', side: 'buy', ticker: 'B' }),
      order({ asset_id: 'rgb:c', mine: true, ticker: 'C' }),
    ])
    expect(s.map((p) => p.ticker)).toEqual(['B', 'A'])
    expect(s[1]).toMatchObject({ buyAt: 100, sellAt: null })
  })

  it('puts listed assets first', () => {
    const s = marketSummary([
      order({ asset_id: 'rgb:a', ticker: 'A' }),
      order({ asset_id: 'rgb:a', ticker: 'A' }),
      order({ asset_id: 'rgb:b', ticker: 'B', verified: true }),
    ])
    expect(s.map((p) => [p.ticker, p.listed])).toEqual([
      ['B', true],
      ['A', false],
    ])
  })
})

describe('makerCounts', () => {
  it('counts each maker once and away makers only in the total', () => {
    expect(
      makerCounts([
        order({ maker: 'a' }),
        order({ maker: 'a' }),
        order({ away: true, maker: 'b' }),
        order({ maker: 'me', mine: true }),
      ])
    ).toEqual({ online: 1, total: 2 })
  })
})

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

describe('heldAssets and recentTrades', () => {
  it('keeps assets with a balance, largest first', () => {
    const asset = (ticker: string, total: number) => ({
      asset_id: ticker,
      name: ticker,
      precision: 0,
      spendable: total,
      ticker,
      total,
    })
    const held = heldAssets({
      assets: [asset('A', 5), asset('B', 0), asset('C', 9)],
      btc_spendable_sat: 0,
    })
    expect(held.map((a) => a.ticker)).toEqual(['C', 'A'])
  })

  it('lists the newest trades first', () => {
    const t = (id: string, ts: number) => ({ id, ts }) as Trade
    expect(
      recentTrades([t('a', 1), t('b', 3), t('c', 2)], 2).map((x) => x.id)
    ).toEqual(['b', 'c'])
  })
})
