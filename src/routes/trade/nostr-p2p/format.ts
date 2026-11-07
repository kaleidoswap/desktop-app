import type { Order } from './api'

export const units = (amount: number, precision: number) =>
  amount / 10 ** precision

export function fmtUnits(amount: number, precision: number): string {
  return units(amount, precision).toLocaleString('en-US', {
    maximumFractionDigits: precision,
    minimumFractionDigits: 0,
  })
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

/** What taking this order costs the taker, fees included. A seller's fees come out of its coin. */
export function takerCost(o: Order): {
  pay: number
  receive: number
  fees: number
} {
  const fees = o.platform_fee_sat + o.network_fee_sat
  return o.side === 'sell'
    ? { fees, pay: o.price_sat + fees, receive: 0 }
    : { fees, pay: 0, receive: o.price_sat }
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
