export const SATS_PER_BTC = 100_000_000

/** An amount typed in the user's display unit ('SAT' or 'BTC') in whole sats. */
export const toSats = (amount: number, unit: string): number =>
  Math.round(unit === 'SAT' ? amount : amount * SATS_PER_BTC)

/** An amount typed in the user's display unit in millisatoshis. */
export const toMsat = (amount: number, unit: string): number =>
  toSats(amount, unit) * 1000
