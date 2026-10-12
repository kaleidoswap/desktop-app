import { transport } from './transport'

export type Side = 'sell' | 'buy'

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
  take: (orderId: string) => post<unknown>('/api/take', { order_id: orderId }),
  trades: () => get<Trade[]>('/api/trades'),
}
