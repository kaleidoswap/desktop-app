import type { Balance, Order, Trade } from '../trade/nostr-p2p/api'
import { tickerOf } from '../trade/nostr-p2p/format'

/** One asset's market as Home shows it: the best price to buy at and to sell at. */
export interface PairSummary {
  assetId: string
  ticker: string
  /** Lowest price a maker sells at (what buying costs), sats per display unit. */
  buyAt: number | null
  /** Highest price a maker buys at (what selling pays), sats per display unit. */
  sellAt: number | null
  offers: number
  /** On the app's listing. */
  listed: boolean
}

/**
 * The book by asset, others' orders only, assets with the most offers first. A maker's `sell`
 * order is what the user can buy, and its `buy` order what the user can sell into.
 */
export function marketSummary(book: Order[]): PairSummary[] {
  const by = new Map<string, PairSummary>()
  for (const o of book) {
    if (o.mine) continue
    const p =
      by.get(o.asset_id) ??
      ({
        assetId: o.asset_id,
        buyAt: null,
        listed: false,
        offers: 0,
        sellAt: null,
        ticker: tickerOf(o),
      } satisfies PairSummary)
    p.offers += 1
    p.listed ||= o.verified
    if (o.side === 'sell')
      p.buyAt =
        p.buyAt === null ? o.unit_price : Math.min(p.buyAt, o.unit_price)
    else
      p.sellAt =
        p.sellAt === null ? o.unit_price : Math.max(p.sellAt, o.unit_price)
    by.set(o.asset_id, p)
  }
  return [...by.values()].sort(
    (a, b) =>
      Number(b.listed) - Number(a.listed) ||
      b.offers - a.offers ||
      a.ticker.localeCompare(b.ticker)
  )
}

/** Makers with an order in the book that are not away, and all makers in it. */
export function makerCounts(book: Order[]): { online: number; total: number } {
  const all = new Set<string>()
  const online = new Set<string>()
  for (const o of book) {
    if (o.mine) continue
    all.add(o.maker)
    if (!o.away) online.add(o.maker)
  }
  return { online: online.size, total: all.size }
}

/** The wallet's bitcoin as Home shows it: ready to trade, still confirming, and free coins. */
export function bitcoinSummary(b: Balance | undefined): {
  ready: number
  pending: number
  coins: number
} {
  if (!b) return { coins: 0, pending: 0, ready: 0 }
  return {
    coins: b.btc_coins?.length ?? 0,
    pending: b.btc_pending_sat ?? 0,
    ready: b.btc_settled_sat ?? b.btc_spendable_sat,
  }
}

/** Assets the wallet holds, largest balance first; an asset with nothing in it is left out. */
export const heldAssets = (b: Balance | undefined) =>
  (b?.assets ?? []).filter((a) => a.total > 0).sort((x, y) => y.total - x.total)

/** The latest trades, newest first. */
export const recentTrades = (trades: Trade[] | undefined, n = 5) =>
  [...(trades ?? [])].sort((a, b) => b.ts - a.ts).slice(0, n)
