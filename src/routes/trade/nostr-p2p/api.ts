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
  state: string | null
  last_seen: number
  away: boolean
  verified: boolean
  impersonates: string | null
  registry: RegistryNote | null
}

export type TradeStatus = 'negotiating' | 'broadcast' | 'settled' | 'failed'

export interface Trade {
  id: string
  side: Side
  role: 'maker' | 'taker'
  asset_id: string
  ticker: string | null
  amount: number
  price_sat: number
  fee_sat: number
  status: TradeStatus
  txid: string | null
  error: string | null
  /** Blocks on the swap transaction, and how many it needs before it counts as settled. */
  confirmations: number
  required: number
  ts: number
}

export interface NewOrder {
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

export const marketApi = {
  /** Null when the daemon reads no registry. */
  asset: (contractId: string) =>
    get<AssetFacts | null>(`/api/asset/${contractId}`),
  balance: () => get<Balance>('/api/balance'),
  book: () => get<Order[]>('/api/book'),
  cancel: (id: string) =>
    transport().request<void>(
      'DELETE',
      `/api/orders/${encodeURIComponent(id)}`
    ),
  info: () => get<Info>('/api/info'),
  orders: () => get<Order[]>('/api/orders'),
  placeOrder: (o: NewOrder) => post<Order>('/api/orders', o),
  // the daemon refuses if the order is no longer on the terms that were reviewed
  take: (o: Order) =>
    post<unknown>('/api/take', {
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
