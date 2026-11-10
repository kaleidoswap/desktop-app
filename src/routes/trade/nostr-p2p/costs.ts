import type { Order, Side, Trade } from './api'

export type Role = 'maker' | 'taker'

/**
 * What one swap reserves and what it pays this person. Amounts are sats.
 *
 * Reserved bitcoin is
 * `(buy ? price + rgb output : 0) + (taker ? platform + network : 0)`,
 * and only when every part of that sum was reported. It is not the seller's
 * proceeds: a seller is offered the gross price, and any sats they reserve
 * are fee funds on top of that.
 *
 * The taker funds the platform and network fees in both directions. Only the
 * buyer funds the RGB output, and that output stays in the buyer's wallet.
 * A missing part is null, never zero. A zero the offer actually reported stays
 * zero. Today's fee policy is not used to fill a hole in an old trade.
 */
export interface Settlement {
  role: Role
  /** What this person does. */
  side: Side
  priceSat: number | null
  platformFeeSat: number | null
  networkFeeSat: number | null
  rgbOutputSat: number | null
  /** Platform fee came from legacy `fee_sat` because the offer split was omitted. */
  platformFromLegacy: boolean
  /** This person funds the platform and network fees. */
  youPayFees: boolean
  /** This person funds the RGB output. */
  youFundRgb: boolean
  /**
   * Sats this wallet must set aside. Null when a part of the formula was not
   * reported. 0 is a real result (a maker who is selling reserves nothing).
   */
  reserveSat: number | null
  /**
   * Gross sats this person is paid. The price, for a seller. 0 for a buyer,
   * who is paid in the asset. Never the price minus fees.
   */
  receiveSat: number | null
  /**
   * RGB output kept in this wallet. Null when they fund it but the amount was
   * not reported. 0 when the other side keeps it.
   */
  retainedSat: number | null
}

export interface SettleInput {
  role: Role
  side: Side
  priceSat: number
  platformFeeSat?: number | null
  networkFeeSat?: number | null
  rgbOutputSat?: number | null
  /** Platform fee is the legacy field, not a newly reported split. */
  platformFromLegacy?: boolean
}

/** A reported sats amount. Missing, fractional, or negative stays unknown. */
export const knownSats = (n: number | null | undefined): number | null =>
  typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : null

const add = (parts: (number | null)[]): number | null =>
  parts.every((n) => n !== null)
    ? parts.reduce<number>((s, n) => s + n!, 0)
    : null

export function settle(input: SettleInput): Settlement {
  const priceSat = knownSats(input.priceSat)
  const platformFeeSat = knownSats(input.platformFeeSat)
  const networkFeeSat = knownSats(input.networkFeeSat)
  const rgbOutputSat = knownSats(input.rgbOutputSat)
  const youPayFees = input.role === 'taker'
  const youFundRgb = input.side === 'buy'
  const buyerPart = youFundRgb ? add([priceSat, rgbOutputSat]) : 0
  const takerPart = youPayFees ? add([platformFeeSat, networkFeeSat]) : 0
  const reserveSat =
    buyerPart !== null && takerPart !== null ? buyerPart + takerPart : null

  return {
    networkFeeSat,
    platformFeeSat,
    platformFromLegacy: input.platformFromLegacy === true,
    priceSat,
    receiveSat: input.side === 'sell' ? priceSat : priceSat === null ? null : 0,
    reserveSat,
    retainedSat: youFundRgb ? rgbOutputSat : 0,
    rgbOutputSat,
    role: input.role,
    side: input.side,
    youFundRgb,
    youPayFees,
  }
}

/** Taking an order: the taker does the opposite of the maker's side. */
export function takerSettlement(
  o: Pick<
    Order,
    | 'network_fee_sat'
    | 'platform_fee_sat'
    | 'price_sat'
    | 'rgb_output_sat'
    | 'side'
  >
): Settlement {
  return settle({
    networkFeeSat: o.network_fee_sat,
    platformFeeSat: o.platform_fee_sat,
    priceSat: o.price_sat,
    rgbOutputSat: o.rgb_output_sat,
    role: 'taker',
    side: o.side === 'sell' ? 'buy' : 'sell',
  })
}

/** An order this wallet posted. The side on the order is this wallet's side. */
export function makerSettlement(
  o: Pick<
    Order,
    | 'network_fee_sat'
    | 'platform_fee_sat'
    | 'price_sat'
    | 'rgb_output_sat'
    | 'side'
  >
): Settlement {
  return settle({
    networkFeeSat: o.network_fee_sat,
    platformFeeSat: o.platform_fee_sat,
    priceSat: o.price_sat,
    rgbOutputSat: o.rgb_output_sat,
    role: 'maker',
    side: o.side,
  })
}

/**
 * A limit that has not been accepted. Platform and network come from the
 * daemon's current schedule, so they are estimates of what the taker would
 * fund. The RGB output is not known until an offer exists.
 */
export function makerEstimate(input: {
  side: Side
  priceSat: number
  feeBps: number
  minFeeSat: number
  networkFeeSat: number
}): { estimates: { network: true; platform: true }; settlement: Settlement } {
  const priceSat = knownSats(input.priceSat)
  const platform =
    priceSat === null
      ? null
      : Math.max(
          Math.floor((priceSat * input.feeBps) / 10_000),
          knownSats(input.minFeeSat) ?? 0
        )
  return {
    estimates: { network: true, platform: true },
    settlement: settle({
      networkFeeSat: knownSats(input.networkFeeSat),
      platformFeeSat: platform,
      priceSat: priceSat ?? -1,
      rgbOutputSat: null,
      role: 'maker',
      side: input.side,
    }),
  }
}

const reported = (n: number | undefined): n is number =>
  n !== undefined && n !== null

/**
 * A stored swap. New records carry all three offer fields. Older records omit
 * all three and keep the platform fee in `fee_sat` only.
 */
export function tradeSettlement(t: Trade): Settlement {
  const trio =
    reported(t.platform_fee_sat) &&
    reported(t.network_fee_sat) &&
    reported(t.rgb_output_sat)
  return settle({
    networkFeeSat: trio ? t.network_fee_sat : null,
    platformFeeSat: trio ? t.platform_fee_sat : t.fee_sat,
    platformFromLegacy: !trio,
    priceSat: t.price_sat,
    rgbOutputSat: trio ? t.rgb_output_sat : null,
    role: t.role,
    side: t.side,
  })
}

const sumField = (
  items: Settlement[],
  pick: (s: Settlement) => number | null
): number | null => {
  const vals = items.map(pick)
  return vals.every((n) => n !== null)
    ? vals.reduce<number>((s, n) => s + n!, 0)
    : null
}

/** Several swaps on the same side. A missing part is not filled with zero. */
export function combineSettlements(items: Settlement[]): Settlement | null {
  const first = items[0]
  if (!first) return null
  if (items.some((s) => s.role !== first.role || s.side !== first.side))
    return null
  return {
    networkFeeSat: sumField(items, (s) => s.networkFeeSat),
    platformFeeSat: sumField(items, (s) => s.platformFeeSat),
    platformFromLegacy: items.every((s) => s.platformFromLegacy),
    priceSat: sumField(items, (s) => s.priceSat),
    receiveSat: sumField(items, (s) => s.receiveSat),
    reserveSat: sumField(items, (s) => s.reserveSat),
    retainedSat: sumField(items, (s) => s.retainedSat),
    rgbOutputSat: sumField(items, (s) => s.rgbOutputSat),
    role: first.role,
    side: first.side,
    youFundRgb: first.youFundRgb,
    youPayFees: first.youPayFees,
  }
}
