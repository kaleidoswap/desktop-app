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
      name: o.name,
      offers: 0,
      precision: o.precision,
      ticker: tickerOf(o),
    }
    a.offers += 1
    by.set(o.asset_id, a)
  }
  for (const a of balance?.assets ?? []) {
    if (by.has(a.asset_id) || a.total <= 0) continue
    by.set(a.asset_id, {
      assetId: a.asset_id,
      name: a.name,
      offers: 0,
      precision: a.precision,
      ticker: a.ticker || tickerOf({ asset_id: a.asset_id, ticker: null }),
    })
  }
  return [...by.values()].sort(
    (x, y) => y.offers - x.offers || x.ticker.localeCompare(y.ticker)
  )
}

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
