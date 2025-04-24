import {
  BaseQueryFn,
  createApi,
  FetchArgs,
  fetchBaseQuery,
  FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react'

import { RootState } from '../../app/store'

interface InitRequest {
  password: string
}

interface InitResponse {
  mnemonic: string
}
interface RestoreRequest {
  backup_path: string
  password: string
}

interface BackupRequest {
  backup_path: string
  password: string
}

interface OpenChannelRequest {
  peer_pubkey_and_opt_addr: string
  capacity_sat: number
  push_msat?: number
  asset_amount?: number
  asset_id?: string
  with_anchors?: boolean
  fee_rate_msat?: number
  fee_proportional_millionths?: number
  temporary_channel_id?: string
}

interface OpenChannelResponse {
  temporary_channel_id: string
}

interface Balance {
  settled: number
  future: number
  spendable: number
  offchain_outbound?: number
  offchain_inbound?: number
}

export interface NiaAsset {
  asset_id: string
  asset_iface: string
  ticker: string
  name: string
  details: string | null
  precision: number
  issued_supply: number
  timestamp: number
  added_at: number
  balance: Balance
  media: string | null
}

interface ListAssetsResponse {
  nia: NiaAsset[]
}

interface CloseChannelRequest {
  channel_id: string
  peer_pubkey: string
  force?: boolean
}

export interface Channel {
  channel_id: string
  funding_txid: string
  peer_pubkey: string
  peer_alias: string
  short_channel_id: number
  status: ChannelStatus
  ready: boolean
  capacity_sat: number
  local_balance_sat: number
  outbound_balance_msat: number
  inbound_balance_msat: number
  next_outbound_htlc_limit_msat: number
  next_outbound_htlc_minimum_msat: number
  is_usable: boolean
  public: boolean
  asset_id: string
  asset_local_amount: number
  asset_remote_amount: number
}
interface ListChannelsResponse {
  channels: Channel[]
}

interface NodeInfoResponse {
  pubkey: string
  num_channels: number
  num_usable_channels: number
  local_balance_sat: number
  pending_outbound_payments_sat: number
  num_peers: number
  onchain_pubkey: string
  max_media_upload_size_mb: number
  rgb_htlc_min_msat: number
  rgb_channel_capacity_min_sat: number
  channel_capacity_min_sat: number
  channel_capacity_max_sat: number
  channel_asset_min_amount: number
  channel_asset_max_amount: number
  network_nodes: number
  network_channels: number
}

interface ConnectPeerRequest {
  peer_pubkey_and_addr: string
}

interface DisconnectPeerRequest {
  peer_pubkey: string
}
interface ListPeersResponse {
  peers: Array<{
    pubkey: string
  }>
}

interface BtcBalanceRequest {
  skip_sync: boolean
}

interface CreateUTXOsRequest {
  num: number
  size: number
  fee_rate: number
  skip_sync: boolean
}

interface AddressResponse {
  address: string
}

interface IssueNiaAssetRequest {
  amounts: number[]
  ticker: string
  name: string
  precision: number
}

interface IssueNiaAssetResponse {
  asset_id: string
}

interface BTCBalanceResponse {
  vanilla: {
    settled: number
    future: number
    spendable: number
  }
  colored: {
    settled: number
    future: number
    spendable: number
  }
}

export interface ApiError {
  data: {
    error: string
  }
  status: number
}

interface AssetBalanceRequest {
  asset_id: string
}

interface AssetBalanceResponse {
  settled: number
  future: number
  spendable: number
  offchain_outbound: number
  offchain_inbound: number
}

enum ChannelStatus {
  Opening = 'Opening',
  Opened = 'Opened',
  Closing = 'Closing',
}

interface RGBInvoiceRequest {
  asset_id?: string
}

interface RGBInvoiceResponse {
  recipient_id: string
  invoice: string
  expiration_timestamp: number
}

interface LNInvoiceRequest {
  amt_msat?: number
  asset_id?: string
  asset_amount?: number
}

interface LNINvoiceResponse {
  invoice: string
}

interface SendBTCRequest {
  amount: number
  address: string
  fee_rate: number
}

interface SendBTCResponse {
  txid: string
}

interface SendAssetRequest {
  asset_id: string
  amount: number
  recipient_id: string
  fee_rate: number
  transport_endpoints: string[]
}

interface SendAssetResponse {
  txid: string
}

interface SendPaymentRequest {
  invoice: string
}

enum HTLCStatus {
  Pending = 'Pending',
  Succeeded = 'Succeeded',
  Failed = 'Failed',
}

export interface SendPaymentResponse {
  payment_hash: string
  payment_secret: string
  status: HTLCStatus
}

interface ListTransactionsRequest {
  skip_sync: boolean
}

interface ListTransactionsResponse {
  transactions: {
    transaction_type: string
    txid: string
    received: number
    sent: number
    fee: number
    confirmation_time: {
      height: number
      timestamp: number
    }
  }[]
}

interface ListPaymentsResponse {
  payments: {
    amt_msat: number
    asset_amount: number
    asset_id: string | null
    payment_hash: string
    inbound: boolean
    status: HTLCStatus
    created_at: number
    updated_at: number
    payee_pubkey: string
  }[]
}

interface ListTransfersRequest {
  asset_id: string
}

export interface Transfer {
  idx: number
  created_at: number
  updated_at: number
  status: 'WaitingCounterparty' | 'WaitingConfirmations' | 'Settled' | 'Failed'
  amount: number
  kind: 'Issuance' | 'ReceiveBlind' | 'ReceiveWitness' | 'Send'
  txid: string
  recipient_id?: string
  transport_endpoints?: Array<{
    endpoint: string
    transport_type: string
    used: boolean
  }>
}

interface ListTransfersResponse {
  transfers: Transfer[]
}

interface TakerRequest {
  swapstring: string
}

interface MakerInitRequest {
  qty_from: number
  qty_to: number
  from_asset?: string
  to_asset?: string
  timeout_sec: number
}

interface MakerInitResponse {
  payment_hash: string
  payment_secret: string
  swapstring: string
}

interface MakerExecuteRequest {
  swapstring: string
  payment_secret: string
  taker_pubkey: string
}

interface ListUnspentsResponse {
  unspents: [
    {
      utxo: {
        outpoint: string
        btc_amount: string
        colorable: boolean
      }
      rgb_allocations: [
        {
          asset_id: string
          amount: number
          settled: boolean
        },
      ]
    },
  ]
}

interface ListUnspentsRequest {
  skip_sync: boolean
}

interface RefreshTransfersRequest {
  skip_sync: boolean
}

export enum SwapStatus {
  Expired = 'Expired',
  Failed = 'Failed',
  Pending = 'Pending',
  Succeeded = 'Succeeded',
  Waiting = 'Waiting',
}

export interface SwapDetails {
  payment_hash: string
  qty_from: number
  qty_to: number
  from_asset: string | null
  to_asset: string | null
  status: SwapStatus
  requested_at: number | null
  initiated_at: number | null
  completed_at: number | null
  type?: 'maker' | 'taker'
}

interface ListSwapsResponse {
  maker: SwapDetails[]
  taker: SwapDetails[]
}

export enum Network {
  Mainnet = 'Mainnet',
  Testnet = 'Testnet',
  Regtest = 'Regtest',
  Signet = 'Signet',
}

interface NetworkInfoResponse {
  network: Network
  height: number
}

interface DecodeInvoiceRequest {
  invoice: string
}

export interface DecodeInvoiceResponse {
  amt_msat: number
  expiry_sec: number
  timestamp: number
  asset_id: string | null
  asset_amount: number | null
  payment_hash: string
  payment_secret: string
  payee_pubkey: string
  network: string
}

export interface DecodeRgbInvoiceResponse {
  recipient_id: string
  asset_iface: string | null
  asset_id: string | null
  amount: number | null
  network: string
  expiration_timestamp: number
  transport_endpoints: string[]
}

export interface DecodeRgbInvoiceRequest {
  invoice: string
}

export interface UnlockRequest {
  password: string
  bitcoind_rpc_username: string
  bitcoind_rpc_password: string
  bitcoind_rpc_host: string
  bitcoind_rpc_port: number
  indexer_url: string
  proxy_endpoint: string
}

interface InvoiceStatusRequest {
  invoice: string
}

interface InvoiceStatusResponse {
  status: 'Pending' | 'Succeeded' | 'Failed' | 'Expired'
}

interface EstimateFeeResponse {
  fee_rate: number
}

interface EstimateFeeRequest {
  blocks: number
}

export interface NodeApiError {
  status: number
  data: {
    error: string
  }
}

const dynamicBaseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  NodeApiError
> = async (args, api, extraOptions) => {
  const state = api.getState() as RootState
  const node_url = state.nodeSettings.data.node_url

  if (!node_url) {
    return {
      error: {
        data: {
          error: 'Node URL not set',
        },
        status: 400,
      },
    }
  }

  const urlEnd = typeof args === 'string' ? args : args.url
  const adjustedUrl = `${node_url}${urlEnd}`
  const adjustedArgs =
    typeof args === 'string' ? adjustedUrl : { ...args, url: adjustedUrl }

  const baseQuery = fetchBaseQuery({
    baseUrl: '',
    timeout: 300000,
    validateStatus: (response, _) => {
      return response.status >= 200 && response.status < 300
    },
  })

  try {
    const result = await baseQuery(adjustedArgs, api, extraOptions)

    if (result.error) {
      const err = result.error as FetchBaseQueryError
      return {
        error: {
          data: {
            error:
              typeof err.data === 'string'
                ? err.data
                : (err.data as any)?.error || 'Unknown error',
          },
          status: err.status as number,
        },
      }
    }

    return result
  } catch (error) {
    return {
      error: {
        data: {
          error:
            error instanceof Error ? error.message : 'Unknown error occurred',
        },
        status: 500,
      },
    }
  }
}

export const nodeApi = createApi({
  baseQuery: dynamicBaseQuery,
  endpoints: (builder) => ({
    address: builder.query<AddressResponse, void>({
      query: () => ({
        body: {},
        method: 'POST',
        url: '/address',
      }),
    }),
    assetBalance: builder.query<AssetBalanceResponse, AssetBalanceRequest>({
      query: (body) => ({
        body,
        method: 'POST',
        url: '/assetbalance',
      }),
    }),
    backup: builder.query<void, BackupRequest>({
      query: (body) => ({
        body,
        method: 'POST',
        url: '/backup',
      }),
    }),
    btcBalance: builder.query<BTCBalanceResponse, BtcBalanceRequest>({
      query: () => ({
        body: {
          skip_sync: false,
        },
        method: 'POST',
        url: '/btcbalance',
      }),
    }),
    closeChannel: builder.query<void, CloseChannelRequest>({
      query: (body) => ({
        body: {
          channel_id: body.channel_id,
          force: body.force === true,
          peer_pubkey: body.peer_pubkey,
        },
        method: 'POST',
        url: '/closechannel',
      }),
    }),
    connectPeer: builder.mutation<void, ConnectPeerRequest>({
      query: (body) => ({
        body,
        method: 'POST',
        url: '/connectpeer',
      }),
    }),
    createUTXOs: builder.query<AddressResponse, CreateUTXOsRequest>({
      query: (body) => ({
        body: {
          fee_rate: body.fee_rate,
          num: body.num,
          size: body.size,
          skip_sync: false,
          up_to: false,
        },
        method: 'POST',
        url: '/createutxos',
      }),
    }),
    decodeInvoice: builder.query<DecodeInvoiceResponse, DecodeInvoiceRequest>({
      query: (body) => ({
        body,
        method: 'POST',
        url: '/decodelninvoice',
      }),
    }),
    decodeRgbInvoice: builder.query<
      DecodeRgbInvoiceResponse,
      DecodeRgbInvoiceRequest
    >({
      query: (body) => ({
        body,
        method: 'POST',
        url: '/decodergbinvoice',
      }),
    }),
    disconnectPeer: builder.mutation<void, DisconnectPeerRequest>({
      query: (body) => ({
        body,
        method: 'POST',
        url: '/disconnectpeer',
      }),
    }),
    estimateFee: builder.query<EstimateFeeResponse, EstimateFeeRequest>({
      query: (body) => ({
        body,
        method: 'POST',
        url: '/estimatefee',
      }),
      transformResponse: (response: EstimateFeeResponse) => ({
        fee_rate: Math.round(response.fee_rate),
      }),
    }),
    init: builder.query<InitResponse, InitRequest>({
      query: (body) => ({
        body: {
          password: body.password,
        },
        method: 'POST',
        url: '/init',
      }),
    }),
    invoiceStatus: builder.query<InvoiceStatusResponse, InvoiceStatusRequest>({
      query: (body) => ({
        body,
        method: 'POST',
        url: '/invoicestatus',
      }),
    }),
    issueNiaAsset: builder.query<IssueNiaAssetResponse, IssueNiaAssetRequest>({
      query: (body) => ({
        body,
        method: 'POST',
        url: '/issueassetnia',
      }),
    }),
    listAssets: builder.query<ListAssetsResponse, void>({
      query: () => ({
        body: {
          filter_asset_schemas: ['Nia'],
        },
        method: 'POST',
        url: '/listassets',
      }),
    }),
    listChannels: builder.query<ListChannelsResponse, void>({
      query: () => '/listchannels',
    }),
    listPayments: builder.query<ListPaymentsResponse, void>({
      query: () => '/listpayments',
    }),
    listPeers: builder.query<ListPeersResponse, void>({
      query: () => '/listpeers',
    }),
    listSwaps: builder.query<ListSwapsResponse, void>({
      query: () => ({
        method: 'GET',
        url: '/listswaps',
      }),
      transformResponse: (response: ListSwapsResponse) => {
        const transformSwaps = (swaps: SwapDetails[]) =>
          swaps.map((swap) => ({
            ...swap,
            status:
              swap.status in SwapStatus ? swap.status : SwapStatus.Pending,
          }))

        return {
          maker: transformSwaps(response.maker || []),
          taker: transformSwaps(response.taker || []),
        }
      },
    }),
    listTransactions: builder.query<
      ListTransactionsResponse,
      ListTransactionsRequest
    >({
      query: (body) => ({
        body,
        method: 'POST',
        url: '/listtransactions',
      }),
    }),
    listTransfers: builder.query<ListTransfersResponse, ListTransfersRequest>({
      query: (body) => ({
        body,
        method: 'POST',
        url: '/listtransfers',
      }),
    }),
    listUnspents: builder.query<ListUnspentsResponse, ListUnspentsRequest>({
      query: (body) => ({
        body,
        method: 'POST',
        url: '/listunspents',
      }),
    }),
    lnInvoice: builder.query<LNINvoiceResponse, LNInvoiceRequest>({
      query: (body) => ({
        body: {
          ...(body.asset_id
            ? {
                amt_msat: 3000000,
                asset_amount: body.asset_amount,
                asset_id: body.asset_id,
              }
            : {
                amt_msat: body.amt_msat || 3000000,
              }),
          expiry_sec: 3600,
        },
        method: 'POST',
        url: '/lninvoice',
      }),
    }),
    lock: builder.query<void, void>({
      query: () => ({
        method: 'POST',
        url: '/lock',
      }),
    }),
    makerExecute: builder.mutation<void, MakerExecuteRequest>({
      query: (body) => ({
        body,
        method: 'POST',
        url: '/makerexecute',
      }),
    }),
    makerInit: builder.mutation<MakerInitResponse, MakerInitRequest>({
      query: (body) => ({
        body,
        method: 'POST',
        url: '/makerinit',
      }),
    }),
    networkInfo: builder.query<NetworkInfoResponse, void>({
      query: () => '/networkinfo',
    }),
    nodeInfo: builder.query<NodeInfoResponse, void>({
      query: () => '/nodeinfo',
    }),
    openChannel: builder.query<OpenChannelResponse, OpenChannelRequest>({
      query: (body) => {
        const requestBody: any = {
          capacity_sat: body.capacity_sat,
          fee_rate_msat: body.fee_rate_msat,
          peer_pubkey_and_opt_addr: body.peer_pubkey_and_opt_addr,
          public: true,
          push_msat: 3100000,
          with_anchors: true,
        }
        if (body.asset_amount && body.asset_amount > 0) {
          requestBody.asset_amount = body.asset_amount
          requestBody.asset_id = body.asset_id
        }
        return {
          body: requestBody,
          method: 'POST',
          url: '/openchannel',
        }
      },
    }),
    refreshRgbTransfers: builder.query<void, RefreshTransfersRequest>({
      query: (body) => ({
        body,
        method: 'POST',
        url: '/refreshtransfers',
      }),
    }),
    restore: builder.query<void, RestoreRequest>({
      query: (body) => ({
        body,
        method: 'POST',
        url: '/restore',
      }),
    }),
    rgbInvoice: builder.query<RGBInvoiceResponse, RGBInvoiceRequest>({
      query: (body) => ({
        body: {
          ...(body.asset_id ? { asset_id: body.asset_id } : {}),
          min_confirmations: 1,
        },
        method: 'POST',
        url: '/rgbinvoice',
      }),
    }),
    sendAsset: builder.query<SendAssetResponse, SendAssetRequest>({
      query: (body) => ({
        body: {
          amount: body.amount,
          asset_id: body.asset_id,
          donation: false,
          fee_rate: body.fee_rate,
          min_confirmations: 1,
          recipient_id: body.recipient_id,
          skip_sync: false,
          transport_endpoints: body.transport_endpoints,
        },
        method: 'POST',
        url: '/sendasset',
      }),
    }),
    sendBtc: builder.query<SendBTCResponse, SendBTCRequest>({
      query: (body) => ({
        body: {
          address: body.address,
          amount: body.amount,
          fee_rate: body.fee_rate,
          skip_sync: false,
        },
        method: 'POST',
        url: '/sendbtc',
      }),
    }),
    sendPayment: builder.query<SendPaymentResponse, SendPaymentRequest>({
      query: (body) => ({
        body: {
          invoice: body.invoice,
        },
        method: 'POST',
        url: '/sendpayment',
      }),
    }),
    shutdown: builder.query<void, void>({
      query: () => ({
        method: 'POST',
        url: '/shutdown',
      }),
    }),
    sync: builder.query<void, void>({
      query: () => ({
        method: 'POST',
        url: '/sync',
      }),
    }),
    taker: builder.query<void, TakerRequest>({
      query: (body) => ({
        body,
        method: 'POST',
        url: '/taker',
      }),
    }),
    unlock: builder.query<void, UnlockRequest>({
      query: (body) => ({
        body: {
          announce_addresses: [],
          announce_alias: '',
          bitcoind_rpc_host: body.bitcoind_rpc_host,
          bitcoind_rpc_password: body.bitcoind_rpc_password,
          bitcoind_rpc_port: body.bitcoind_rpc_port,
          bitcoind_rpc_username: body.bitcoind_rpc_username,
          indexer_url: body.indexer_url,
          password: body.password,
          proxy_endpoint: body.proxy_endpoint,
        },
        method: 'POST',
        url: '/unlock',
      }),
    }),
  }),
  reducerPath: 'nodeApi',
})
