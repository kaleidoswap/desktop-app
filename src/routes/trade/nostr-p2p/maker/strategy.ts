/**
 * The strategy screen's model: a form in whole units and percentages, converted to and from
 * p2pd's bot config (`BotMarket`, base units and basis points), and the ladder it will quote,
 * computed the way p2pd's bot does (docs/BOT.md).
 */

import type { BotConfig, BotMarket } from './makerApi'

/** Where the reference price comes from, as the client thinks of it. */
export type PriceKind = 'feed' | 'fixed' | 'issuer'

export interface StrategyForm {
  asset_id: string
  ticker: string
  precision: number
  priceKind: PriceKind
  /** Market feed: the price file on the maker's host, kept up to date by its feed. */
  feedPath: string
  feedMaxAgeSecs: number
  /** Fixed and issuer-set: sats per whole unit. */
  satPerUnit: number
  /** Issuer-set: how far from the price a swap may be signed, in percent. */
  bandPct: number
  /** Distance of the best quote from the reference, in basis points. */
  distanceBps: number
  levels: number
  /** Extra distance of each further level, in basis points. */
  stepBps: number
  /** Size of the best level, in whole units. 0: no quotes on that side. */
  askSize: number
  bidSize: number
  /** Each level is this much larger than the one before it. */
  growth: number
  skew: { on: boolean; target: number; range: number; maxBps: number }
  breaker: { on: boolean; moveBps: number; cooldownSecs: number }
  dailyNet: { on: boolean; units: number }
}

/** Where the hosted maker's feed writes its prices (the tenant VM's shared price file). */
export const DEFAULT_FEED_PATH = '/shared/prices.json'

export const toBase = (units: number, precision: number): number =>
  Math.round(units * 10 ** precision)

export const fromBase = (base: number, precision: number): number =>
  base / 10 ** precision

export function defaultForm(asset: {
  asset_id: string
  ticker?: string | null
  precision: number
}): StrategyForm {
  return {
    askSize: 100,
    asset_id: asset.asset_id,
    bandPct: 2,
    bidSize: 100,
    breaker: { cooldownSecs: 300, moveBps: 300, on: true },
    dailyNet: { on: false, units: 1_000 },
    distanceBps: 100,
    feedMaxAgeSecs: 120,
    feedPath: DEFAULT_FEED_PATH,
    growth: 1.5,
    levels: 3,
    precision: asset.precision,
    priceKind: 'feed',
    satPerUnit: 0,
    skew: { maxBps: 80, on: false, range: 400, target: 500 },
    stepBps: 50,
    ticker: asset.ticker ?? '',
  }
}

export function toBotMarket(f: StrategyForm): BotMarket {
  const base = (u: number) => toBase(u, f.precision)
  return {
    ask_amount: base(f.askSize),
    asset_id: f.asset_id,
    bid_amount: base(f.bidSize),
    circuit_breaker: f.breaker.on
      ? {
          cooldown_secs: f.breaker.cooldownSecs,
          max_move_bps: f.breaker.moveBps,
        }
      : null,
    level_step_bps: f.stepBps,
    levels: f.levels,
    max_daily_net: f.dailyNet.on ? base(f.dailyNet.units) : null,
    precision: f.precision,
    price:
      f.priceKind === 'feed'
        ? {
            max_age_secs: f.feedMaxAgeSecs,
            path: f.feedPath,
            source: 'file',
          }
        : { sat_per_unit: f.satPerUnit, source: 'fixed' },
    size_growth: f.growth,
    skew: f.skew.on
      ? {
          max_bps: f.skew.maxBps,
          range: base(f.skew.range),
          target: base(f.skew.target),
        }
      : null,
    spread_bps: f.distanceBps,
  }
}

/**
 * The form for a market read back from the maker. p2pd has one fixed source; whether the client
 * meant it as a plain fixed price or an issuer-set band is the app's own note (`hint`).
 */
export function fromBotMarket(
  m: BotMarket,
  meta: { ticker?: string | null; kind?: PriceKind; bandPct?: number } = {}
): StrategyForm {
  const unit = (b: number) => fromBase(b, m.precision)
  const d = defaultForm({ ...m, ticker: meta.ticker })
  return {
    ...d,
    askSize: unit(m.ask_amount),
    bandPct: meta.bandPct ?? d.bandPct,
    bidSize: unit(m.bid_amount),
    breaker: m.circuit_breaker
      ? {
          cooldownSecs: m.circuit_breaker.cooldown_secs ?? 300,
          moveBps: m.circuit_breaker.max_move_bps,
          on: true,
        }
      : { ...d.breaker, on: false },
    dailyNet:
      m.max_daily_net != null
        ? { on: true, units: unit(m.max_daily_net) }
        : { ...d.dailyNet, on: false },
    distanceBps: m.spread_bps,
    feedMaxAgeSecs:
      m.price.source === 'file'
        ? (m.price.max_age_secs ?? d.feedMaxAgeSecs)
        : d.feedMaxAgeSecs,
    feedPath: m.price.source === 'file' ? m.price.path : d.feedPath,
    growth: m.size_growth,
    levels: m.levels,
    priceKind:
      m.price.source === 'file'
        ? 'feed'
        : meta.kind === 'issuer'
          ? 'issuer'
          : 'fixed',
    satPerUnit: m.price.source === 'fixed' ? m.price.sat_per_unit : 0,
    skew: m.skew
      ? {
          maxBps: m.skew.max_bps,
          on: true,
          range: unit(m.skew.range),
          target: unit(m.skew.target),
        }
      : { ...d.skew, on: false },
    stepBps: m.level_step_bps,
  }
}

/** Replace (or add) one market in a config, keeping the config's other settings. */
export function withMarket(config: BotConfig, market: BotMarket): BotConfig {
  const others = config.markets.filter((m) => m.asset_id !== market.asset_id)
  return { ...config, markets: [...others, market] }
}

export function withoutMarket(config: BotConfig, assetId: string): BotConfig {
  return {
    ...config,
    markets: config.markets.filter((m) => m.asset_id !== assetId),
  }
}

/** What is wrong with the form, as i18n keys under `p2pMaker.strategy.errors`. */
export function strategyErrors(f: StrategyForm): string[] {
  const out: string[] = []
  if (!f.asset_id.startsWith('rgb:')) out.push('asset')
  if (f.priceKind === 'feed' && !f.feedPath.trim()) out.push('feed')
  if (f.priceKind !== 'feed' && !(f.satPerUnit > 0)) out.push('price')
  if (f.priceKind === 'issuer' && !(f.bandPct > 0 && f.bandPct <= 50))
    out.push('band')
  if (!Number.isInteger(f.levels) || f.levels < 1 || f.levels > 20)
    out.push('levels')
  if (!(f.growth > 0) || !Number.isFinite(f.growth)) out.push('growth')
  if (!(f.distanceBps >= 0) || !(f.stepBps >= 0)) out.push('distance')
  if (!(f.askSize >= 0) || !(f.bidSize >= 0) || f.askSize + f.bidSize === 0)
    out.push('size')
  if (f.skew.on && !(f.skew.range > 0)) out.push('skewRange')
  if (f.skew.on && !(f.skew.maxBps >= 0 && f.skew.maxBps < 10_000))
    out.push('skewMax')
  if (f.breaker.on && !(f.breaker.moveBps > 0)) out.push('breaker')
  if (f.dailyNet.on && !(f.dailyNet.units > 0)) out.push('dailyNet')
  return out
}

export interface LadderLevel {
  side: 'ask' | 'bid'
  index: number
  /** Sats per whole unit. */
  price: number
  /** Whole units. */
  size: number
  /** What the level is worth, in sats. */
  totalSat: number
  /** Left out by the daily net cap. */
  capped: boolean
  /** Priced outside an issuer-set band: the signer would refuse it. */
  outsideBand: boolean
}

/**
 * The ladder the bot quotes around `reference` (sats per whole unit) with `holding` whole units
 * of the asset: p2pd's level prices and sizes, the skew shift, and the daily net cap at a net of 0.
 */
export function ladder(
  f: StrategyForm,
  reference: number,
  holding = f.skew.target
): { center: number; levels: LadderLevel[] } {
  let shiftBps = 0
  if (f.skew.on && f.skew.range > 0) {
    const lean = (holding - f.skew.target) / f.skew.range
    shiftBps = -Math.max(-1, Math.min(1, lean)) * f.skew.maxBps
  }
  const center = reference * (1 + shiftBps / 10_000)
  const band = f.priceKind === 'issuer' ? f.bandPct / 100 : null
  const levels: LadderLevel[] = []
  for (const side of ['ask', 'bid'] as const) {
    const first = side === 'ask' ? f.askSize : f.bidSize
    if (!(first > 0)) continue
    let used = 0
    for (let i = 0; i < f.levels; i++) {
      const off = (f.distanceBps + i * f.stepBps) / 10_000
      const price = side === 'ask' ? center * (1 + off) : center * (1 - off)
      const size = first * f.growth ** i
      used += size
      const capped = f.dailyNet.on && used > f.dailyNet.units + 1e-9
      // the signer refuses only what costs the client: selling under, buying over the band
      const outsideBand =
        band !== null &&
        (side === 'ask'
          ? price < reference * (1 - band)
          : price > reference * (1 + band))
      levels.push({
        capped,
        index: i,
        outsideBand,
        price,
        side,
        size,
        totalSat: Math.max(1, Math.round(price * size)),
      })
    }
  }
  return { center, levels }
}

/** The app's own note of what a fixed price means, per market (p2pd stores only the number). */
const HINT_KEY = 'p2p-maker.price-kind'

export function readPriceHints(): Record<
  string,
  { kind: PriceKind; bandPct?: number }
> {
  try {
    return JSON.parse(localStorage.getItem(HINT_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function savePriceHint(f: StrategyForm) {
  try {
    const all = readPriceHints()
    all[f.asset_id] = { bandPct: f.bandPct, kind: f.priceKind }
    localStorage.setItem(HINT_KEY, JSON.stringify(all))
  } catch {
    // the hint is only a convenience
  }
}
