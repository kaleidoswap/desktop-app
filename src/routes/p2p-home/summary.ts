import { availableSats, type Balance } from '../trade/nostr-p2p/api'

/** Confirmed bitcoin is available to trade; older daemons only report spendable bitcoin. */
export function bitcoinSummary(b: Balance | undefined): {
  ready: number
  pending: number
  coins: number
} {
  return {
    coins: b?.btc_coins?.length ?? 0,
    pending: b?.btc_pending_sat ?? 0,
    ready: availableSats(b),
  }
}
