import type { Order } from './api'
import { takerSettlement } from './costs'

export const units = (amount: number, precision: number) =>
  amount / 10 ** precision

export function fmtUnits(amount: number, precision: number): string {
  return units(amount, precision).toLocaleString('en-US', {
    maximumFractionDigits: precision,
    minimumFractionDigits: 0,
  })
}

/** A precision the daemon or an on-screen asset can actually mean. */
export const isPrecision = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 18

export interface PrecisionSource {
  asset_id: string
  precision: number
}

/**
 * How many decimals to apply to a trade amount (base units).
 * The trade's own `precision` wins. Otherwise an asset already on screen
 * (the book, or the wallet) with the same id. Unknown stays unknown: callers
 * must not invent a scale.
 */
export function tradePrecision(
  trade: { asset_id: string; precision?: number | null },
  known: readonly PrecisionSource[] = []
): number | null {
  if (isPrecision(trade.precision)) return trade.precision
  const hit = known.find((k) => k.asset_id === trade.asset_id)
  return hit && isPrecision(hit.precision) ? hit.precision : null
}

/**
 * A trade amount for display. When the scale is unknown the raw base units are
 * shown, not a balance guessed by assuming a precision.
 */
export function fmtTradeAmount(
  amount: number,
  precision: number | null
): string {
  if (precision === null) return Math.trunc(amount).toLocaleString('en-US')
  return fmtUnits(amount, precision)
}

/** Sats per display unit. Undefined when the amount's scale is not known. */
export function tradeUnitPrice(
  trade: {
    amount: number
    asset_id: string
    precision?: number | null
    price_sat: number
  },
  known: readonly PrecisionSource[] = []
): number | undefined {
  const precision = tradePrecision(trade, known)
  if (precision === null || !(trade.amount > 0)) return undefined
  const display = trade.amount / 10 ** precision
  if (!(display > 0)) return undefined
  return trade.price_sat / display
}

export const fmtSats = (n: number): string =>
  Math.round(n).toLocaleString('en-US')

/** Sats per unit: more decimals when the price is small, so cheap assets stay readable. */
export function fmtPrice(p: number): string {
  if (!isFinite(p) || p === 0) return '–'
  const d = p >= 1000 ? 0 : p >= 100 ? 1 : p >= 1 ? 2 : 4
  return p.toLocaleString('en-US', {
    maximumFractionDigits: d,
    minimumFractionDigits: d,
  })
}

export const fmtBtc = (sats: number): string =>
  (sats / 1e8).toLocaleString('en-US', {
    maximumFractionDigits: 8,
    minimumFractionDigits: 8,
  })

/** Decimal string to base units, without float drift. */
export function toBase(s: string, precision: number): number {
  const t = s.trim()
  if (!/^\d*\.?\d*$/.test(t) || t === '' || t === '.') return 0
  const [i = '0', f = ''] = t.split('.')
  const frac = (f + '0'.repeat(precision)).slice(0, precision)
  return Number(i || '0') * 10 ** precision + Number(frac || '0')
}

export function timeLeft(expiry: number, now = Date.now()): string {
  const s = expiry - Math.floor(now / 1000)
  if (s <= 0) return 'expired'
  if (s < 90) return `${s}s`
  if (s < 5400) return `${Math.round(s / 60)}m`
  if (s < 172800) return `${Math.round(s / 3600)}h`
  return `${Math.round(s / 86400)}d`
}

export function ago(ts: number, now = Date.now()): string {
  const s = Math.floor(now / 1000) - ts
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return new Date(ts * 1000).toLocaleDateString()
}

export const short = (s: string, n = 6) =>
  s.length > 2 * n + 1 ? `${s.slice(0, n)}…${s.slice(-n)}` : s

export const tickerOf = (o: { ticker: string | null; asset_id: string }) =>
  o.ticker ?? short(o.asset_id, 5)

/**
 * What the taker reserves, and the gross sats a selling taker is paid.
 * `pay` is the reservation: price and the RGB output when buying, plus the
 * platform and network fees the taker funds in either direction. `receive`
 * is the gross price when selling, never that price minus the fees.
 */
export function takerCost(o: Order): {
  pay: number
  receive: number
  fees: number
  reserveSat: number
  retainedSat: number
} {
  const s = takerSettlement(o)
  if (
    s.reserveSat === null ||
    s.receiveSat === null ||
    s.platformFeeSat === null ||
    s.networkFeeSat === null ||
    s.retainedSat === null
  ) {
    throw new Error('an order is missing a reported cost')
  }
  return {
    fees: s.platformFeeSat + s.networkFeeSat,
    pay: s.reserveSat,
    receive: s.receiveSat,
    reserveSat: s.reserveSat,
    retainedSat: s.retainedSat,
  }
}

/** The network as a person names it: the daemon says `signetcustom`, people say Mutinynet. */
export const networkLabel = (network: string): string =>
  ({
    mainnet: 'Mainnet',
    regtest: 'Regtest',
    signet: 'Signet',
    signetcustom: 'Mutinynet',
    testnet: 'Testnet',
    testnet4: 'Testnet4',
  })[network] ?? network
