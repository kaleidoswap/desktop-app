import type { Balance, Info, Order, Trade } from '../api'

/** Demo contract from the acceptance example. Not a wallet and not a live offer. */
export const DEMO = {
  network: 2_000,
  platform: 1_000,
  price: 10_000,
  rgb: 1_000,
} as const

const assetId = 'rgb:demo-fixture'

export const demoInfo = (): Info => ({
  address: 'demo-address-not-a-wallet',
  dev: true,
  fee_bps: 100,
  min_confirmations: 1,
  min_fee_sat: 1_000,
  name: 'wallet-signetcustom',
  network: 'signetcustom',
  network_fee_sat: DEMO.network,
  npub: 'npub1demo000000000000000000000000000000000000000000000000000',
  registry: null,
  registry_assets: 0,
  relays: [],
  taker_wait_secs: 30,
})

export const demoOrder = (
  side: 'sell' | 'buy',
  extra: Partial<Order> = {}
): Order => ({
  amount: 100,
  asset_id: assetId,
  away: false,
  expiry: 0,
  impersonates: null,
  last_seen: 1_700_000_000,
  maker: 'demo-maker',
  mine: false,
  name: 'Demo asset',
  network_fee_sat: DEMO.network,
  order_id: side === 'sell' ? 'demo-sell' : 'demo-buy',
  platform_fee_sat: DEMO.platform,
  precision: 0,
  price_sat: DEMO.price,
  registry: null,
  rgb_output_sat: DEMO.rgb,
  side,
  state: 'open',
  ticker: 'DEMO',
  unit_price: DEMO.price / 100,
  verified: true,
  ...extra,
})

export const demoBalance = (): Balance => ({
  assets: [
    {
      asset_id: assetId,
      name: 'Demo asset',
      precision: 0,
      spendable: 1_000,
      ticker: 'DEMO',
      total: 1_000,
    },
  ],
  btc_coins: [20_000, 20_000],
  btc_settled_sat: 50_000,
  btc_spendable_sat: 50_000,
})

const baseTrade = (extra: Partial<Trade>): Trade => ({
  amount: 100,
  asset_id: assetId,
  confirmations: 1,
  error: null,
  fee_sat: DEMO.platform,
  id: 'demo-trade',
  precision: 0,
  price_sat: DEMO.price,
  required: 1,
  role: 'taker',
  side: 'buy',
  status: 'settled',
  ticker: 'DEMO',
  ts: 1_700_000_000,
  txid: null,
  ...extra,
})

export const demoTrades = (): Trade[] => [
  baseTrade({
    id: 'demo-buy',
    network_fee_sat: DEMO.network,
    platform_fee_sat: DEMO.platform,
    rgb_output_sat: DEMO.rgb,
    side: 'buy',
    txid: 'demo-txid-buy',
  }),
  baseTrade({
    id: 'demo-sell',
    network_fee_sat: DEMO.network,
    platform_fee_sat: DEMO.platform,
    rgb_output_sat: DEMO.rgb,
    role: 'taker',
    side: 'sell',
    txid: 'demo-txid-sell',
  }),
  baseTrade({
    fee_sat: DEMO.platform,
    id: 'demo-legacy',
    role: 'taker',
    side: 'buy',
    status: 'settled',
  }),
]

export const demoOrders = (): Order[] => [
  demoOrder('sell', { mine: true, order_id: 'demo-maker-sell' }),
  demoOrder('buy', { mine: true, order_id: 'demo-maker-buy' }),
]
