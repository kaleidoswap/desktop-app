/**
 * The trading wallet, speaking the RGB Lightning node's client interface.
 *
 * The app's wallet screens (balances, assets, history, deposit and withdraw) ask `nodeApi`, which
 * wraps a node client. This class answers the same calls for the part a trading wallet has, through
 * the daemon, so those screens work on it as they are. What only a node has (channels, peers,
 * Lightning payments, swaps) answers with an empty list; anything else says it is not available.
 */

import type { RlnClient } from 'kaleido-sdk/rln'

import { NodeApiWrapper } from '../../../api/node-api-wrapper'

import { marketApi } from './api'
import { transport } from './transport'

const post = <T>(path: string, body: unknown = {}) =>
  transport().request<T>('POST', path, body)

const notAvailable = (what: string) => async () => {
  throw new Error(`${what} is not available for the P2P wallet`)
}

/** What a node reports for Lightning that a trading wallet does not have: nothing. */
const NO_LIGHTNING = {
  listChannels: { channels: [] },
  listPayments: { payments: [] },
  listPeers: { peers: [] },
  listSwaps: { maker: [], taker: [] },
} as const

export function createP2pWalletClient(): RlnClient {
  const client = {
    // an invoice with the amount and asset of the node's request, in the daemon's own terms
    createRgbInvoice: async (body: {
      asset_id?: string | null
      assignment?: { type?: string; value?: number } | null
      expiration_timestamp?: number
    }) => {
      const amount = body.assignment?.value ?? 0
      const now = Math.floor(Date.now() / 1000)
      const out = await post<{
        invoice: string
        recipient_id: string
        expiration_timestamp: number
      }>('/api/rgb/invoice', {
        amount,
        ...(body.asset_id ? { asset_id: body.asset_id } : {}),
        ...(body.expiration_timestamp
          ? { duration_secs: Math.max(60, body.expiration_timestamp - now) }
          : {}),
      })
      return { ...out, batch_transfer_idx: 0 }
    },

    getAddress: async () => ({ address: (await marketApi.info()).address }),

    getAssetBalance: (body: { asset_id: string }) =>
      post('/api/rln/assetbalance', body),

    getBtcBalance: () => post('/api/rln/btcbalance'),

    getNetworkInfo: async () => ({
      height: 0,
      network: (await marketApi.info()).network,
    }),

    getNodeInfo: async () => {
      const info = await marketApi.info()
      return {
        account_xpub_colored: '',
        account_xpub_vanilla: '',
        channel_asset_max_amount: 0,
        channel_asset_min_amount: 0,
        channel_capacity_max_sat: 0,
        channel_capacity_min_sat: 0,
        eventual_close_fees_sat: 0,
        local_balance_sat: 0,
        max_media_upload_size_mb: 0,
        network_nodes: 0,
        num_channels: 0,
        num_peers: 0,
        num_usable_channels: 0,
        pending_outbound_payments_sat: 0,
        pubkey: info.npub,
        rgb_channel_capacity_min_sat: 0,
        rgb_htlc_min_msat: 0,
      }
    },

    listAssets: () => post('/api/rln/listassets'),

    listTransactions: () => post('/api/rln/listtransactions'),

    listTransfers: (body: {
      asset_filter?: { type?: string; value?: string }
    }) =>
      post('/api/rln/listtransfers', { asset_id: body?.asset_filter?.value }),

    listUnspents: () => post('/api/rln/listunspents'),

    refreshTransfers: async () => {
      await marketApi.refresh()
    },

    sendBtc: (body: { address: string; amount: number; fee_rate?: number }) =>
      post('/api/btc/send', {
        address: body.address,
        amount_sat: body.amount,
        fee_rate: body.fee_rate,
      }),

    sendRgb: (body: unknown) => post('/api/rln/sendrgb', body),

    syncRgbWallet: async () => {
      await marketApi.refresh()
    },
  }

  // anything else: the Lightning lists answer empty, the rest says it is not available
  return new Proxy(client, {
    get(target, prop: string) {
      if (prop in target) return target[prop as keyof typeof target]
      if (prop in NO_LIGHTNING)
        return async () => NO_LIGHTNING[prop as keyof typeof NO_LIGHTNING]
      return notAvailable(prop)
    },
  }) as unknown as RlnClient
}

/** The node API wrapper over the trading wallet, for `setWalletOverride`. */
export const createP2pWalletWrapper = () =>
  new NodeApiWrapper(createP2pWalletClient())
