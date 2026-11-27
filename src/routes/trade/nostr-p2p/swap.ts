import { availableSats, type Balance, type Order, type Side } from './api'
import { planMarket, type MarketPlan } from './book'
import { isPrecision, tickerOf } from './format'

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
    if (o.mine || !isPrecision(o.precision)) continue
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
    if (by.has(a.asset_id) || a.total <= 0 || !isPrecision(a.precision))
      continue
    by.set(a.asset_id, {
      assetId: a.asset_id,
      bestAsk: null,
      bestBid: null,
      imitates: null,
      listed: false,
      name: a.name,
      offers: 0,
      precision: a.precision,
      // a collectible has no ticker: its name stands in
      ticker:
        a.ticker || a.name || tickerOf({ asset_id: a.asset_id, ticker: null }),
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
  | 'not_enough_btc'
  | 'not_enough_asset'
  | 'no_free_coin'
  | 'partial'
  | 'target_unavailable'
  | null

export interface SwapQuote {
  /** What the swap would be with the wallet's coins as they are: what can actually be taken. */
  plan: MarketPlan
  /** The same swap as if the wallet had coins enough: the price to show even when it cannot pay. */
  estimate: MarketPlan
  /** Asset units asked for, in base units. */
  wantBase: number
  /** Makers whose orders fill the swap. */
  makers: number
  problem: SwapProblem
}

/** No binary-float rounding or implicit truncation of fractional sats. */
export function parseSwapInput(text: string, precision: number): number | null {
  const normalized = text.trim().replace(',', '.')
  if (!normalized || normalized === '.') return 0
  if (!isPrecision(precision) || !/^\d*\.?\d*$/.test(normalized)) return null
  const [whole, fraction = ''] = normalized.split('.')
  if (fraction.length > precision) return null
  const base = Number(whole + fraction.padEnd(precision, '0'))
  return Number.isSafeInteger(base) ? base : null
}

export function plainSwapAmount(base: number, precision: number) {
  const digits = String(base).padStart(precision + 1, '0')
  if (!precision) return digits
  const fraction = digits.slice(-precision).replace(/0+$/, '')
  return digits.slice(0, -precision) + (fraction ? `.${fraction}` : '')
}

type AssetUnits = Pick<SwapAsset, 'assetId' | 'precision'>

export function quoteSwapAmount(
  book: Order[],
  asset: AssetUnits,
  side: Side,
  denomination: 'asset' | 'btc',
  amount: number,
  balance: Balance | undefined,
  slippage = 0.01
): SwapQuote {
  const now = Math.floor(Date.now() / 1000)
  const orders = book.filter(
    (o) =>
      !o.mine &&
      o.asset_id === asset.assetId &&
      o.precision === asset.precision &&
      o.side === (side === 'buy' ? 'sell' : 'buy') &&
      (o.expiry === 0 || o.expiry > now) &&
      (o.state == null || o.state === 'open') &&
      o.unit_price > 0 &&
      Number.isFinite(o.unit_price) &&
      [
        o.amount,
        o.price_sat,
        o.network_fee_sat,
        o.platform_fee_sat,
        o.rgb_output_sat,
      ].every((n) => Number.isSafeInteger(n) && n >= 0) &&
      o.amount > 0 &&
      o.price_sat > 0
  )
  const satAmount = denomination === 'btc' ? amount : undefined
  const cap = denomination === 'asset' ? amount : Number.MAX_SAFE_INTEGER
  const limits = { includeFeesInPrice: true, satAmount }
  const plan = planMarket(orders, side, cap, slippage, {
    coins: balance?.btc_coins,
    ...limits,
  })
  const estimate = planMarket(orders, side, cap, slippage, limits)
  const btc = availableSats(balance)
  const held =
    balance?.assets.find((a) => a.asset_id === asset.assetId)?.spendable ?? 0
  const wantBase = denomination === 'asset' ? amount : estimate.baseAmount
  let problem: SwapProblem = null
  if (!Number.isSafeInteger(amount) || amount <= 0) problem = 'no_amount'
  else if (!orders.length) problem = 'no_offers'
  else if (!estimate.picks.length) problem = 'too_small'
  else if ((plan.picks.length ? plan.reserveSat : estimate.reserveSat) > btc)
    problem = 'not_enough_btc'
  else if (side === 'sell' && estimate.baseAmount > held)
    problem = 'not_enough_asset'
  else if (
    side === 'buy' &&
    plan.baseAmount < estimate.baseAmount &&
    !(denomination === 'btc' && plan.picks.length)
  )
    problem = 'no_free_coin'
  else if (side === 'sell' && satAmount !== undefined && plan.sats < satAmount)
    problem = 'target_unavailable'
  else if (denomination === 'asset' && plan.baseAmount < amount)
    problem = 'partial'

  const preview = !problem || problem === 'partial' ? plan : estimate
  const makers = new Set(preview.picks.map((o) => o.maker)).size
  return { estimate, makers, plan, problem, wantBase }
}

export const quoteSwapBase = (
  book: Order[],
  asset: AssetUnits,
  side: Side,
  wantBase: number,
  balance: Balance | undefined,
  slippage = 0.01
) => quoteSwapAmount(book, asset, side, 'asset', wantBase, balance, slippage)

export const quoteSwap = (
  book: Order[],
  asset: AssetUnits,
  side: Side,
  amount: string,
  balance: Balance | undefined,
  slippage = 0.01
) =>
  quoteSwapBase(
    book,
    asset,
    side,
    parseSwapInput(amount, asset.precision) ?? 0,
    balance,
    slippage
  )

export const baseForSats = (
  book: Order[],
  asset: AssetUnits,
  side: Side,
  sats: number,
  slippage = 0.01
): number =>
  Number.isSafeInteger(sats) && sats > 0
    ? quoteSwapAmount(book, asset, side, 'btc', sats, undefined, slippage)
        .estimate.baseAmount
    : 0

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
