import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { getNodeApiWrapper, MinimalState } from '../../api/client'
import type { NodeApiWrapper, ApiResult } from '../../api/node-api-wrapper'
import type {
  CreateUtxosInput,
  LNInvoiceInput,
  OpenChannelInput,
  RefreshInput,
  SendBtcInput,
  SendRgbInput,
  RgbInvoiceInput,
} from '../../api/node-api-wrapper'
import type {
  AddressResponse,
  AssetBalanceRequest,
  AssetBalanceResponse,
  BackupRequest,
  BtcBalanceResponse,
  CloseChannelRequest,
  ConnectPeerRequest,
  ConnectPeerResponse,
  DecodeLNInvoiceResponse,
  DecodeLNInvoiceRequest,
  DecodeRGBInvoiceResponse,
  DecodeRGBInvoiceRequest,
  DisconnectPeerRequest,
  EstimateFeeRequest,
  EstimateFeeResponse,
  InitRequest,
  InitResponse,
  InvoiceStatusResponse,
  InvoiceStatusRequest,
  IssueAssetNIAResponse,
  IssueAssetNIARequest,
  ListAssetsResponse,
  ListChannelsResponse,
  ListPaymentsResponse,
  ListTransactionsResponse,
  ListTransfersResponse,
  ListUnspentsResponse,
  CreateLNInvoiceResponse as LNInvoiceResponse,
  MakerExecuteRequest,
  MakerExecuteResponse,
  MakerInitRequest,
  MakerInitResponse,
  NetworkInfoResponse,
  NodeInfoResponse,
  OpenChannelResponse,
  RestoreRequest,
  RgbInvoiceResponse,
  SendRgbResponse,
  SendPaymentResponse,
  SendPaymentRequest,
  SignMessageResponse,
  SignMessageRequest,
  UnlockRequest,
  KeysendResponse,
  KeysendRequest,
  ListPeersResponse,
  ListSwapsResponse,
  TakerRequest as WhitelistTradeRequest,
} from 'kaleidoswap-sdk/rln'

export type {
  Assignment,
  AssignmentFungible,
  Channel,
  NiaAsset,
  SwapDetails,
  Transfer,
} from './types'

export { SwapStatus } from './types'

export type {
  MakerExecuteRequest,
  MakerInitRequest,
  MakerInitResponse,
} from 'kaleidoswap-sdk/rln'

// TakerRequest kept as local type for backward compatibility
export type { TakerRequest } from './types'

export const Network = {
  Mainnet: 'mainnet',
  Regtest: 'regtest',
  Signet: 'signet',
  Testnet: 'testnet',
} as const
export type Network = (typeof Network)[keyof typeof Network]

// Re-export types for backwards compatibility
export type { SendPaymentResponse, InitResponse }

export interface NodeApiError {
  status: number
  data: {
    error: string
  }
}

type ApiState = { getState: () => unknown }

/**
 * Unified query function factory.
 * Works for both endpoints with arguments and void endpoints.
 * All error handling is delegated to NodeApiWrapper.execute().
 */
function queryFn<TArgs, TResult>(
  call: (wrapper: NodeApiWrapper, args: TArgs) => Promise<ApiResult<TResult>>
) {
  return async (
    args: TArgs,
    api: ApiState
  ): Promise<{ data: TResult } | { error: FetchBaseQueryError }> => {
    try {
      const wrapper = await getNodeApiWrapper(api.getState() as MinimalState)
      const result = await call(wrapper, args)
      if ('error' in result && result.error) return { error: result.error }
      return { data: (result.data ?? null) as TResult }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return { error: { data: { error: msg }, status: 500 } }
    }
  }
}

import { TakerRequest } from './types'

export const nodeApi = createApi({
  baseQuery: fakeBaseQuery(),
  endpoints: (builder) => ({
    
    
    

    
// ============================================================================
// BTC Operations
// ============================================================================
address: builder.query<AddressResponse, void>({
      queryFn: queryFn((w, _: void) => w.getAddress()),
    }),

    







backup: builder.mutation<void, BackupRequest>({
      queryFn: queryFn((w, args) => w.backup(args)),
    }),

    
    






btcBalance: builder.query<BtcBalanceResponse, void>({
      queryFn: queryFn((w, _: void) => w.getBtcBalance()),
    }),

    





// init/unlock/lock/shutdown are state-changing operations — mutations, not queries
init: builder.mutation<InitResponse, InitRequest>({
      queryFn: queryFn((w, args) => w.initWallet(args)),
    }),

    





listTransactions: builder.query<ListTransactionsResponse, void>({
      queryFn: queryFn((w, _: void) => w.listTransactions()),
    }),

    





lock: builder.mutation<void, void>({
      queryFn: queryFn((w, _: void) => w.lockWallet()),
    }),

    





createUtxos: builder.mutation<void, CreateUtxosInput>({
      queryFn: queryFn((w, args) => w.createUtxos(args)),
    }),

    





networkInfo: builder.query<NetworkInfoResponse, void>({
      queryFn: queryFn((w, _: void) => w.getNetworkInfo()),
    }),

    
    
    

    


estimateFee: builder.query<EstimateFeeResponse, EstimateFeeRequest>({
      queryFn: queryFn((w, args) => w.estimateFee(args)),
    }),

    // ============================================================================
// Wallet Management
// ============================================================================
nodeInfo: builder.query<NodeInfoResponse, void>({
      queryFn: queryFn((w, _: void) => w.getNodeInfo()),
    }),

    assetBalance: builder.query<AssetBalanceResponse, AssetBalanceRequest>({
      queryFn: queryFn((w, args) => w.getAssetBalance(args)),
    }),

    issueNiaAsset: builder.mutation<
      IssueAssetNIAResponse,
      IssueAssetNIARequest
    >({
      queryFn: queryFn((w, args) => w.issueAssetNIA(args)),
    }),

    unlock: builder.mutation<void, UnlockRequest>({
      queryFn: queryFn((w, args) => w.unlockWallet(args)),
    }),

    // ============================================================================
// RGB Asset Operations
// ============================================================================
listAssets: builder.query<ListAssetsResponse, void>({
      queryFn: queryFn((w, _: void) => w.listAssets()),
    }),

    


shutdown: builder.mutation<void, void>({
      queryFn: queryFn((w, _: void) => w.shutdown()),
    }),

    
    
    

    


closeChannel: builder.mutation<void, CloseChannelRequest>({
      queryFn: queryFn((w, args) => w.closeChannel(args)),
    }),

    





restore: builder.mutation<void, RestoreRequest>({
      queryFn: queryFn((w, args) => w.restore(args)),
    }),

    


connectPeer: builder.mutation<ConnectPeerResponse, ConnectPeerRequest>({
      queryFn: queryFn((w, args) => w.connectPeer(args)),
    }),

    


disconnectPeer: builder.mutation<void, DisconnectPeerRequest>({
      queryFn: queryFn((w, args) => w.disconnectPeer(args)),
    }),

    





sendBtc: builder.mutation<void, SendBtcInput>({
      queryFn: queryFn((w, args) => w.sendBtc(args)),
    }),

    





decodeInvoice: builder.query<
      DecodeLNInvoiceResponse,
      DecodeLNInvoiceRequest
    >({
      queryFn: queryFn((w, args) => w.decodeLNInvoice(args)),
    }),

    
    
    

    


listUnspents: builder.query<ListUnspentsResponse, void>({
      queryFn: queryFn((w, _: void) => w.listUnspents()),
    }),

    


decodeRgbInvoice: builder.query<
      DecodeRGBInvoiceResponse,
      DecodeRGBInvoiceRequest
    >({
      queryFn: queryFn((w, args) => w.decodeRgbInvoice(args)),
    }),

    // ============================================================================
// Lightning Network - Channels
// ============================================================================
listChannels: builder.query<ListChannelsResponse, void>({
      queryFn: queryFn((w, _: void) => w.listChannels()),
    }),

    
    
    

    invoiceStatus: builder.query<InvoiceStatusResponse, InvoiceStatusRequest>({
      queryFn: queryFn((w, args) => w.getInvoiceStatus(args)),
    }),

    


listTransfers: builder.query<ListTransfersResponse, string>({
      queryFn: queryFn((w, assetId: string) => w.listTransfers(assetId)),
    }),

    


keysend: builder.mutation<KeysendResponse, KeysendRequest>({
      queryFn: queryFn((w, args) => w.keysend(args)),
    }),

    
    
    

    


sendRgb: builder.mutation<SendRgbResponse, SendRgbInput>({
      queryFn: queryFn((w, args) => w.sendRgb(args)),
    }),

    





listPayments: builder.query<ListPaymentsResponse, void>({
      queryFn: queryFn((w, _: void) => w.listPayments()),
    }),

    





refresh: builder.mutation<void, RefreshInput | void>({
      queryFn: queryFn((w, args) =>
        w.refreshTransfers(args === undefined ? undefined : args)
      ),
    }),

    





// ============================================================================
// Lightning Network - Peers
// ============================================================================
listPeers: builder.query<ListPeersResponse, void>({
      queryFn: queryFn((w, _: void) => w.listPeers()),
    }),

    





openChannel: builder.mutation<OpenChannelResponse, OpenChannelInput>({
      queryFn: queryFn((w, args) => w.openChannel(args)),
    }),

    


// ============================================================================
// Swaps
// ============================================================================
listSwaps: builder.query<ListSwapsResponse, void>({
      queryFn: queryFn((w, _: void) => w.listSwaps()),
    }),

    


// ============================================================================
// Lightning Network - Invoices & Payments
// ============================================================================
lnInvoice: builder.mutation<LNInvoiceResponse, LNInvoiceInput>({
      queryFn: queryFn((w, args) => w.createLNInvoice(args)),
    }),

    


makerExecute: builder.mutation<MakerExecuteResponse, MakerExecuteRequest>({
      queryFn: queryFn((w, args) => w.makerExecute(args)),
    }),

    
    
    

    makerInit: builder.mutation<MakerInitResponse, MakerInitRequest>({
      queryFn: queryFn((w, args) => w.makerInit(args)),
    }),

    rgbInvoice: builder.mutation<RgbInvoiceResponse, RgbInvoiceInput>({
      queryFn: queryFn((w, args) => w.createRgbInvoice(args)),
    }),

    sendPayment: builder.mutation<SendPaymentResponse, SendPaymentRequest>({
      queryFn: queryFn((w, args) => w.sendPayment(args)),
    }),

    // ============================================================================
// Utility Methods
// ============================================================================
signMessage: builder.mutation<SignMessageResponse, SignMessageRequest>({
      queryFn: queryFn((w, args) => w.signMessage(args)),
    }),

    


taker: builder.mutation<void, TakerRequest>({
      queryFn: queryFn((w, args) => w.taker(args)),
    }),

    
    
    

    whitelistTrade: builder.mutation<void, WhitelistTradeRequest>({
      queryFn: queryFn((w, args) => w.whitelistTrade(args)),
    }),
  }),
  reducerPath: 'nodeApi',
})

export const {
  useAddressQuery,
  useAssetBalanceQuery,
  useBackupMutation,
  useBtcBalanceQuery,
  useCloseChannelMutation,
  useConnectPeerMutation,
  useCreateUtxosMutation,
  useDecodeInvoiceQuery,
  useDecodeRgbInvoiceQuery,
  useDisconnectPeerMutation,
  useEstimateFeeQuery,
  useInitMutation,
  useInvoiceStatusQuery,
  useIssueNiaAssetMutation,
  useListAssetsQuery,
  useListChannelsQuery,
  useListPaymentsQuery,
  useListTransactionsQuery,
  useListTransfersQuery,
  useListUnspentsQuery,
  useLnInvoiceMutation,
  useMakerInitMutation,
  useMakerExecuteMutation,
  useTakerMutation,
  useNodeInfoQuery,
  useNetworkInfoQuery,
  useOpenChannelMutation,
  useRefreshMutation,
  useRestoreMutation,
  useRgbInvoiceMutation,
  useSendRgbMutation,
  useSendBtcMutation,
  useSendPaymentMutation,
  useSignMessageMutation,
  useUnlockMutation,
  useKeysendMutation,
  useListPeersQuery,
  useListSwapsQuery,
  useWhitelistTradeMutation,
  useShutdownMutation,
  useLockMutation,
} = nodeApi
