import type { Order, Side } from './api'
import { takerCost, units } from './format'

export function splitBook(orders: Order[]) {
  const asks = orders
    .filter((o) => o.side === 'sell')
    .sort((a, b) => a.unit_price - b.unit_price)
  const bids = orders
    .filter((o) => o.side === 'buy')
    .sort((a, b) => b.unit_price - a.unit_price)
  return { asks, bids }
}

/** Running total of size from the best price outward. */
export function withDepth(rows: Order[]) {
  let cum = 0
  return rows.map((order) => {
    cum += units(order.amount, order.precision)
    return { cum, order }
  })
}

export interface MarketPlan {
  /** The orders to take, best price first. Each one fills whole. */
  picks: Order[]
  /** Asset units the picks add up to. */
  baseAmount: number
  /** Sats the taker pays (buying) or receives (selling) for the picks, fees included in pay. */
  sats: number
  fees: number
  /** Volume-weighted price in sats per unit. */
  avgPrice: number
  /** Units asked for that no order could cover without going over. */
  shortBy: number
  /** The cheapest order that did not fit, to tell the user what would. */
  nextFit?: Order
  /** Orders left out because they are outside the price limit. */
  beyondLimit: number
  /** Orders left out because the wallet has no free coin left for another swap. */
  noCoinFor: number
  /** Orders left out because one maker would be asked for more than it allows at once. */
  tooManyFromMaker: number
}

export interface PlanLimits {
  /** Bitcoin coins free for a swap. Each buy spends coins of its own. Unknown: no limit. */
  coins?: number[]
  /** Swaps a maker accepts from one taker at once. */
  perMaker?: number
}

/** What a maker accepts from one taker at once, unless it was set otherwise. */
export const DEFAULT_PER_MAKER = 3

/**
 * Plan a market order against the book. Orders fill whole, so the plan takes the best-priced orders
 * that fit inside the amount asked for and stay within `slippage` of the best price.
 *
 * `side` is what the user does: buying takes asks, selling takes bids.
 */
export function planMarket(
  book: Order[],
  side: Side,
  wantBase: number,
  slippage: number,
  limits: PlanLimits = {}
): MarketPlan {
  const theirs = book.filter((o) => !o.mine)
  const { asks, bids } = splitBook(theirs)
  const rows = side === 'buy' ? asks : bids
  const best = rows[0]?.unit_price
  const limit =
    best === undefined
      ? undefined
      : side === 'buy'
        ? best * (1 + slippage)
        : best * (1 - slippage)
  const inside = (o: Order) =>
    limit === undefined
      ? false
      : side === 'buy'
        ? o.unit_price <= limit
        : o.unit_price >= limit

  const picks: Order[] = []
  let base = 0
  let nextFit: Order | undefined
  const perMaker = limits.perMaker ?? DEFAULT_PER_MAKER
  const fromMaker = new Map<string, number>()
  // a buyer's swap spends a coin of its own, large enough for what it pays
  const coins =
    side === 'buy' && limits.coins
      ? [...limits.coins].sort((a, b) => a - b)
      : null
  let noCoinFor = 0
  let tooManyFromMaker = 0
  for (const o of rows) {
    if (!inside(o)) continue
    if (base + o.amount > wantBase) {
      nextFit ??= o
      continue
    }
    if ((fromMaker.get(o.maker) ?? 0) >= perMaker) {
      tooManyFromMaker += 1
      continue
    }
    if (coins) {
      const i = coins.findIndex((c) => c >= takerCost(o).pay)
      if (i < 0) {
        noCoinFor += 1
        continue
      }
      coins.splice(i, 1)
    }
    fromMaker.set(o.maker, (fromMaker.get(o.maker) ?? 0) + 1)
    picks.push(o)
    base += o.amount
  }
  const costs = picks.map(takerCost)
  const priceSats = picks.reduce((s, o) => s + o.price_sat, 0)
  const sats =
    side === 'buy'
      ? costs.reduce((s, c) => s + c.pay, 0)
      : costs.reduce((s, c) => s + c.receive, 0)
  const unitsFilled = picks.reduce(
    (s, o) => s + units(o.amount, o.precision),
    0
  )
  return {
    avgPrice: unitsFilled ? priceSats / unitsFilled : 0,
    baseAmount: base,
    beyondLimit: rows.filter((o) => !inside(o)).length,
    fees: costs.reduce((s, c) => s + c.fees, 0),
    nextFit,
    noCoinFor,
    picks,
    sats,
    shortBy: Math.max(0, wantBase - base),
    tooManyFromMaker,
  }
}
