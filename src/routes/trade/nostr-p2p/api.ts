import { transport } from './transport'

export type Side = 'sell' | 'buy'

/** What the registry lists about an order's asset, set next to the maker's own claim. */
export interface RegistryNote {
  listed: boolean
  /** The ticker the registry lists the asset under, when it differs from the maker's. */
  ticker_differs: string | null
  /** Other listed contracts that carry the same ticker. */
  same_ticker_listed: number
  listed_by: string[]
}

export interface RegistryListing {
  contract_id: string
  ticker: string
  name: string
  precision: number | null
  schema_type: string | null
  listed_by: string[]
}

/** What the index publishes about one asset, each fact on its own. None of them is a verdict. */
export interface RegistryDetail {
  contract_valid: boolean | null
  /** Someone signed a declaration for it. Not that they are its issuer. */
  issuer_signed: boolean
  issuer_address: string | null
  issuer_verified: boolean
  issuer_proof: string | null
  issuer_identified: boolean
  dispute: boolean
  impersonation_warning: boolean
  same_ticker: number
  contested_by: number
}

export interface AssetFacts {
  listed: RegistryListing | null
  same_ticker_listed: number
  detail: RegistryDetail | null
}

export interface Info {
  nostr_profiles?: boolean
  name: string
  network: string
  npub: string
  address: string
  relays: string[]
  fee_bps: number
  min_fee_sat: number
  network_fee_sat: number
  min_confirmations: number
  taker_wait_secs: number
  /** The RGBMap index being read, and how many assets it listed at the last fetch. */
  registry: string | null
  registry_assets: number
  dev: boolean
}

export interface AssetBalance {
  asset_id: string
  ticker: string
  name: string
  precision: number
  total: number
  spendable: number
}

export interface Balance {
  btc_spendable_sat: number
  /** Bitcoin not confirmed yet: a deposit shows here first. Absent from an older daemon. */
  /** Confirmed bitcoin: what a swap can use. Absent from an older daemon. */
  btc_settled_sat?: number
  btc_pending_sat?: number
  /** When the wallet last synced (unix seconds). Absent from an older daemon. */
  synced_at?: number
  /** Bitcoin coins free for a swap, largest first. Each swap spends coins of its own. Absent from an older daemon. */
  btc_coins?: number[]
  assets: AssetBalance[]
}

export interface Order {
  order_id: string
  side: Side
  asset_id: string
  ticker: string | null
  name: string | null
  precision: number
  amount: number
  price_sat: number
  unit_price: number
  platform_fee_sat: number
  network_fee_sat: number
  rgb_output_sat: number
  expiry: number
  mine: boolean
  maker: string
  /** The maker's whole Nostr key. Absent from an older daemon. */
  maker_npub?: string
  state: string | null
  last_seen: number
  away: boolean
  verified: boolean
  impersonates: string | null
  registry: RegistryNote | null
}

export interface MakerReputation {
  verified: boolean
  settled: number
  volume_sat: number
  counterparties: number
  self_trades: number
  negotiations: number
  aborted: number
  abort_rate: number | null
  presence: number | null
  computed_at: number
  expires_at: number
  event_id: string
}

/** Who a maker says it is (its Nostr profile), with its NIP-05 name checked against the domain. */
export interface MakerProfile {
  npub: string
  name: string | null
  picture: string | null
  nip05: string | null
  nip05_verified: boolean
  /** Checked by the daemon against the Mosaik signing key for this network. */
  reputation?: MakerReputation | null
  issuer_assets?: string[]
}

export type TradeStatus = 'negotiating' | 'broadcast' | 'settled' | 'failed'

export interface Trade {
  id: string
  side: Side
  role: 'maker' | 'taker'
  /** Participant public keys recorded for this swap. Older daemons may omit either. */
  maker_npub?: string | null
  taker_npub?: string | null
  asset_id: string
  ticker: string | null
  amount: number
  /**
   * Display decimals for `amount`, which is in base units. Absent from an older
   * daemon: look the asset up on screen instead of guessing a scale.
   */
  precision?: number
  price_sat: number
  /**
   * Platform fee. Older daemons send only this. It is not the network fee or
   * the RGB output, and it must not be split or replaced from today's policy.
   */
  fee_sat: number
  /**
   * Platform fee from the accepted offer. Present with the other two new
   * fields on new trades, omitted with them on older ones. A reported 0 is real.
   */
  platform_fee_sat?: number
  /** Network fee from the accepted offer. Same presence rule. A reported 0 is real. */
  network_fee_sat?: number
  /**
   * Bitcoin the asset buyer locks to the RGB output and keeps. Not a fee.
   * Same presence rule. A reported 0 is real.
   */
  rgb_output_sat?: number
  status: TradeStatus
  txid: string | null
  error: string | null
  /** Blocks on the swap transaction, and how many it needs before it counts as settled. */
  confirmations: number
  required: number
  /** The maker has answered the request. Absent from an older daemon. */
  answered?: boolean
  ts: number
}

export interface NewOrder {
  expected_npub?: string
  side: Side
  asset_id: string
  /** Asset units, in base units. */
  amount: number
  /** What the whole order is worth, in sats. */
  price_sat: number
  ttl_secs: number
}

const get = <T>(path: string) => transport().request<T>('GET', path)
const post = <T>(path: string, body: unknown) =>
  transport().request<T>('POST', path, body)

/** The bitcoin a swap can spend: confirmed coins, falling back to the spendable figure of an older daemon. */
export const availableSats = (b: Balance | undefined): number =>
  b ? (b.btc_settled_sat ?? b.btc_spendable_sat) : 0

/**
 * How long a maker that is online has to answer a request. One that is around answers in seconds;
 * the taker would rather try the next maker than wait minutes. A maker marked away keeps the long wait.
 */
export const ANSWER_WINDOW_SECS = 30
/** A maker marked away may be back soon, so it gets longer, but not the daemon's full ten minutes. */
export const ANSWER_WINDOW_AWAY_SECS = 120

function signedPath(path: string, expectedNpub?: string) {
  return expectedNpub
    ? path + '?signer=' + encodeURIComponent(expectedNpub)
    : path
}

export const marketApi = {
  /** Null when the daemon reads no registry. */
  asset: (contractId: string) =>
    get<AssetFacts | null>(`/api/asset/${contractId}`),
  balance: () => get<Balance>('/api/balance'),
  book: () => get<Order[]>('/api/book'),
  cancel: (id: string, expectedNpub?: string) =>
    transport().request<void>(
      'DELETE',
      signedPath(`/api/orders/${encodeURIComponent(id)}`, expectedNpub)
    ),
  info: () => get<Info>('/api/info'),
  /** Profiles of up to 20 makers. Checking a NIP-05 name asks its domain, so ask only on demand. */
  makers: (npubs: string[]) =>
    get<MakerProfile[]>(`/api/makers?npubs=${npubs.join(',')}`),
  orders: () => get<Order[]>('/api/orders'),

  placeOrder: ({ expected_npub, ...order }: NewOrder) =>
    post<Order>(signedPath('/api/orders', expected_npub), order),
  /** Sync the wallet with the chain now, instead of waiting for the next automatic sync. */
  refresh: () => post<void>('/api/refresh', {}),
  // the daemon refuses if the order is no longer on the terms that were reviewed
  take: (
    o: Order,
    opts?: { answerWithinSecs?: number; expectedNpub?: string }
  ) =>
    post<unknown>(signedPath('/api/take', opts?.expectedNpub), {
      ...(opts?.answerWithinSecs
        ? { answer_within_secs: opts.answerWithinSecs }
        : {}),
      order_id: o.order_id,
      reviewed: {
        amount: o.amount,
        asset_id: o.asset_id,
        network_fee_sat: o.network_fee_sat,
        platform_fee_sat: o.platform_fee_sat,
        price_sat: o.price_sat,
        rgb_output_sat: o.rgb_output_sat,
        side: o.side,
      },
    }),
  trades: () => get<Trade[]>('/api/trades'),
}
