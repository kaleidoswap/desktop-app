import { describe, expect, it } from 'vitest'

import type { Balance, Order } from '../api'
import {
  baseForSats,
  pickableAssets,
  quoteSwap,
  quoteSwapBase,
  swapAssets,
} from '../swap'

let n = 0
const order = (o: Partial<Order>): Order => ({
  amount: 1000,
  asset_id: 'rgb:usd',
  away: false,
  expiry: 0,
  impersonates: null,
  last_seen: 0,
  maker: 'm1',
  mine: false,
  name: 'Dollar',
  network_fee_sat: 2000,
  order_id: `o${n++}`,
  platform_fee_sat: 1000,
  precision: 2,
  price_sat: 15_000,
  registry: null,
  rgb_output_sat: 1000,
  side: 'sell',
  state: null,
  ticker: 'USD',
  unit_price: 1500,
  verified: false,
  ...o,
})

const balance = (b: Partial<Balance> = {}): Balance => ({
  assets: [],
  btc_coins: [100_000, 100_000],
  btc_settled_sat: 200_000,
  btc_spendable_sat: 200_000,
  ...b,
})

const usd = { assetId: 'rgb:usd', precision: 2 }

describe('swapAssets', () => {
  it('lists assets with offers first, then held ones, never the user own orders', () => {
    const assets = swapAssets(
      [
        order({}),
        order({}),
        order({ asset_id: 'rgb:mine', mine: true, ticker: 'MINE' }),
      ],
      balance({
        assets: [
          {
            asset_id: 'rgb:held',
            name: 'Held',
            precision: 0,
            spendable: 5,
            ticker: 'HLD',
            total: 5,
          },
          {
            asset_id: 'rgb:empty',
            name: 'Empty',
            precision: 0,
            spendable: 0,
            ticker: 'EMP',
            total: 0,
          },
        ],
      })
    )
    expect(assets.map((a) => [a.ticker, a.offers])).toEqual([
      ['USD', 2],
      ['HLD', 0],
    ])
  })
})

describe('quoteSwap', () => {
  it('buys from the cheapest makers and counts them', () => {
    const book = [
      order({ maker: 'a', unit_price: 1500 }),
      order({ maker: 'b', unit_price: 1505 }),
      order({ maker: 'c', unit_price: 1600 }),
    ]
    const q = quoteSwap(book, usd, 'buy', '20', balance())
    expect(q.problem).toBeNull()
    expect(q.wantBase).toBe(2000)
    expect(q.plan.picks.map((o) => o.maker)).toEqual(['a', 'b'])
    expect(q.makers).toBe(2)
  })

  it('says when there is no amount, or nobody on the other side', () => {
    expect(quoteSwap([order({})], usd, 'buy', '', balance()).problem).toBe(
      'no_amount'
    )
    expect(
      quoteSwap([order({ side: 'sell' })], usd, 'sell', '5', balance()).problem
    ).toBe('no_offers')
  })

  it('says when offers are bigger than the amount asked', () => {
    const q = quoteSwap([order({ amount: 5000 })], usd, 'buy', '10', balance())
    expect(q.problem).toBe('too_small')
    expect(q.plan.nextFit?.amount).toBe(5000)
  })

  it('fills part of the amount when whole offers do not add up to it', () => {
    const q = quoteSwap([order({})], usd, 'buy', '15', balance())
    expect(q.problem).toBe('partial')
    expect(q.plan.baseAmount).toBe(1000)
  })

  it('needs a free coin for each swap, and enough bitcoin overall', () => {
    expect(
      quoteSwap([order({})], usd, 'buy', '10', balance({ btc_coins: [500] }))
        .problem
    ).toBe('no_free_coin')
    expect(
      quoteSwap(
        [order({})],
        usd,
        'buy',
        '10',
        balance({ btc_settled_sat: 1000 })
      ).problem
    ).toBe('not_enough_btc')
  })

  it('selling needs the asset in the wallet', () => {
    const bid = order({ side: 'buy' })
    expect(quoteSwap([bid], usd, 'sell', '10', balance()).problem).toBe(
      'not_enough_asset'
    )
    const held = balance({
      assets: [
        {
          asset_id: 'rgb:usd',
          name: 'Dollar',
          precision: 2,
          spendable: 1000,
          ticker: 'USD',
          total: 1000,
        },
      ],
    })
    expect(quoteSwap([bid], usd, 'sell', '10', held).problem).toBeNull()
  })
})

describe('listing', () => {
  const book = [
    order({ asset_id: 'rgb:usd', ticker: 'USD', verified: true }),
    order({ asset_id: 'rgb:fake', impersonates: 'USD', ticker: 'USD' }),
    order({ asset_id: 'rgb:fake', impersonates: 'USD', ticker: 'USD' }),
    order({ asset_id: 'rgb:other', ticker: 'OTH' }),
  ]

  it('marks listed assets and imitations, listed first', () => {
    const assets = swapAssets(book, balance())
    expect(assets.map((a) => [a.assetId, a.listed, a.imitates])).toEqual([
      ['rgb:usd', true, null],
      ['rgb:fake', false, 'USD'],
      ['rgb:other', false, null],
    ])
  })

  it('offers only listed assets unless the user asks for the rest', () => {
    const assets = swapAssets(book, balance())
    expect(pickableAssets(assets, false).map((a) => a.assetId)).toEqual([
      'rgb:usd',
    ])
    expect(pickableAssets(assets, true)).toHaveLength(3)
  })

  it('offers everything on a network without a listing', () => {
    const assets = swapAssets(
      [order({}), order({ asset_id: 'rgb:x' })],
      balance()
    )
    expect(pickableAssets(assets, false)).toHaveLength(2)
  })
})

describe('quoteSwap estimate', () => {
  it('prices the swap even when the wallet cannot pay for it', () => {
    const book = [order({ maker: 'a' }), order({ maker: 'b' })]
    const poor = quoteSwap(
      book,
      usd,
      'buy',
      '20',
      balance({ btc_coins: [872], btc_settled_sat: 872 })
    )
    expect(poor.problem).toBe('not_enough_btc')
    expect(poor.estimate.baseAmount).toBe(2000)
    expect(poor.makers).toBe(2)
  })

  it('tells a missing free coin apart from missing bitcoin', () => {
    const book = [order({ maker: 'a' }), order({ maker: 'b' })]
    const q = quoteSwapBase(
      book,
      usd,
      'buy',
      2000,
      balance({ btc_coins: [200_000] })
    )
    expect(q.problem).toBe('no_free_coin')
    expect(q.plan.baseAmount).toBe(1000)
    expect(q.estimate.baseAmount).toBe(2000)
  })
})

describe('baseForSats', () => {
  const book = [
    order({ maker: 'a', unit_price: 1500 }),
    order({ maker: 'b', unit_price: 1505 }),
    order({ maker: 'c', unit_price: 1600 }),
  ]

  it('buying, takes the most whole orders the sats can pay for', () => {
    const one = quoteSwapBase(book, usd, 'buy', 1000, balance()).estimate
    const two = quoteSwapBase(book, usd, 'buy', 2000, balance()).estimate
    expect(baseForSats(book, usd, 'buy', one.reserveSat)).toBe(1000)
    expect(baseForSats(book, usd, 'buy', two.reserveSat - 1)).toBe(1000)
    expect(baseForSats(book, usd, 'buy', two.reserveSat)).toBe(2000)
    expect(baseForSats(book, usd, 'buy', one.reserveSat - 1)).toBe(0)
  })

  it('selling, takes the fewest whole orders that bring the sats in', () => {
    const bids = book.map((o) => ({
      ...o,
      side: 'buy' as const,
      unit_price: 1500,
    }))
    const one = quoteSwapBase(bids, usd, 'sell', 1000, balance()).estimate
    expect(baseForSats(bids, usd, 'sell', 1)).toBe(1000)
    expect(baseForSats(bids, usd, 'sell', one.sats + 1)).toBe(2000)
  })

  it('is zero for no sats', () => {
    expect(baseForSats(book, usd, 'buy', 0)).toBe(0)
    expect(baseForSats(book, usd, 'buy', Number.NaN)).toBe(0)
  })
})

describe('swapAssets collectibles', () => {
  it('names a held asset without a ticker by its name', () => {
    const [a] = swapAssets(
      [],
      balance({
        assets: [
          {
            asset_id: 'rgb:art',
            name: 'Painting',
            precision: 0,
            spendable: 1,
            ticker: '',
            total: 1,
          },
        ],
      })
    )
    expect(a.ticker).toBe('Painting')
  })
})
