import type { Balance, Order, Side } from './api'
import { planMarket, type MarketPlan } from './book'
import { tickerOf, toBase } from './format'

/** An asset the swap can trade: one with offers in the book, or one the wallet holds. */
export interface SwapAsset {
  assetId: string
  ticker: string
  name: string | null
  precision: number
  offers: number
  /** On the app's listing: the asset is the one its ticker names. */
  listed: boolean
  /** The listed asset this one copies the ticker of: very likely an imitation. */
  imitates: string | null
  /** Cheapest price a maker sells at, sats per display unit. */
  bestAsk: number | null
  /** Highest price a maker buys at, sats per display unit. */
  bestBid: number | null
}

/** Assets with offers first (most offers first), then the ones the wallet holds. */
export function swapAssets(
  book: Order[],
  balance: Balance | undefined
): SwapAsset[] {
  const by = new Map<string, SwapAsset>()
  for (const o of book) {
    if (o.mine) continue
    const a = by.get(o.asset_id) ?? {
      assetId: o.asset_id,
      bestAsk: null,
      bestBid: null,
      imitates: null,
      listed: false,
      name: o.name,
      offers: 0,
      precision: o.precision,
      ticker: tickerOf(o),
    }
    a.offers += 1
    a.listed ||= o.verified
    a.imitates ??= o.impersonates
    if (o.side === 'sell')
      a.bestAsk =
        a.bestAsk === null ? o.unit_price : Math.min(a.bestAsk, o.unit_price)
    else
      a.bestBid =
        a.bestBid === null ? o.unit_price : Math.max(a.bestBid, o.unit_price)
    by.set(o.asset_id, a)
  }
  for (const a of balance?.assets ?? []) {
    if (by.has(a.asset_id) || a.total <= 0) continue
    by.set(a.asset_id, {
      assetId: a.asset_id,
      bestAsk: null,
      bestBid: null,
      imitates: null,
      listed: false,
      name: a.name,
      offers: 0,
      precision: a.precision,
      ticker: a.ticker || tickerOf({ asset_id: a.asset_id, ticker: null }),
    })
  }
  return [...by.values()].sort(
    (x, y) =>
      Number(y.listed) - Number(x.listed) ||
      y.offers - x.offers ||
      x.ticker.localeCompare(y.ticker)
  )
}

/**
 * The assets to offer in the picker: listed ones, plus the unlisted when the user asked to see them.
 * With nothing listed at all (a network without a listing), everything shows.
 */
export const pickableAssets = (assets: SwapAsset[], showUnlisted: boolean) =>
  showUnlisted || !assets.some((a) => a.listed)
    ? assets
    : assets.filter((a) => a.listed)

/** Why the swap as asked cannot go ahead, the first reason that applies. */
export type SwapProblem =
  | 'no_amount'
  | 'no_offers'
  | 'too_small'
  | 'partial'
  | 'not_enough_btc'
  | 'not_enough_asset'
  | 'no_free_coin'
  | null

export interface SwapQuote {
  plan: MarketPlan
  /** Asset units asked for, in base units. */
  wantBase: number
  /** Makers whose orders fill the swap. */
  makers: number
  problem: SwapProblem
}

/**
 * The swap the user asked for, against the book: `side` is what the user does with the asset,
 * `amount` how much of it, as typed. Orders fill whole, so a swap may fill less than asked.
 */
export function quoteSwap(
  book: Order[],
  asset: Pick<SwapAsset, 'assetId' | 'precision'>,
  side: Side,
  amount: string,
  balance: Balance | undefined,
  slippage = 0.01
): SwapQuote {
  const wantBase = toBase(amount, asset.precision)
  const orders = book.filter((o) => o.asset_id === asset.assetId)
  const plan = planMarket(orders, side, wantBase, slippage, {
    coins: balance?.btc_coins,
  })
  const makers = new Set(plan.picks.map((o) => o.maker)).size
  const available = orders.some(
    (o) => !o.mine && o.side === (side === 'buy' ? 'sell' : 'buy')
  )
  const btc = balance?.btc_settled_sat ?? balance?.btc_spendable_sat ?? 0
  const held =
    balance?.assets.find((a) => a.asset_id === asset.assetId)?.spendable ?? 0

  let problem: SwapProblem = null
  if (wantBase <= 0) problem = 'no_amount'
  else if (!available) problem = 'no_offers'
  else if (plan.picks.length === 0)
    problem = plan.noCoinFor > 0 ? 'no_free_coin' : 'too_small'
  else if (side === 'buy' && plan.reserveSat > btc) problem = 'not_enough_btc'
  else if (side === 'sell' && plan.baseAmount > held)
    problem = 'not_enough_asset'
  else if (plan.baseAmount < wantBase) problem = 'partial'

  return { makers, plan, problem, wantBase }
}

/** Assets matching what the user typed: ticker, name, or (part of) the asset id. Exact id first. */
export function searchAssets(assets: SwapAsset[], query: string): SwapAsset[] {
  const q = query.trim().toLowerCase()
  if (!q) return assets
  const hits = assets.filter(
    (a) =>
      a.ticker.toLowerCase().includes(q) ||
      (a.name ?? '').toLowerCase().includes(q) ||
      a.assetId.toLowerCase().includes(q)
  )
  const rank = (a: SwapAsset) =>
    a.assetId.toLowerCase() === q
      ? 0
      : a.ticker.toLowerCase() === q
        ? 1
        : a.ticker.toLowerCase().startsWith(q)
          ? 2
          : 3
  return hits.sort((x, y) => rank(x) - rank(y))
}
