import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { getNodeApiWrapper, MinimalState } from '../../api/client';
import type { NodeApiWrapper } from '../../api/node-api-wrapper';
import type { ApiResult } from '../../api/node-api-wrapper';
import type {
  AddressResponse,
  AssetBalanceResponse,
  AssetBalanceRequest,
  BackupRequest,
  BtcBalanceResponse,
  CloseChannelRequest,
  ConnectPeerRequest,
  ConnectPeerResponse,
  CreateUtxosRequest,
  DecodeLNInvoiceResponse,
  DecodeLNInvoiceRequest,
  DecodeRgbInvoiceResponse as DecodeRGBInvoiceResponse,
  DecodeRgbInvoiceRequest as DecodeRGBInvoiceRequest,
  DisconnectPeerRequest,
  EstimateFeeResponse,
  EstimateFeeRequest,
  InitRequest,
  InitResponse,
  GetInvoiceStatusResponse as InvoiceStatusResponse,
  GetInvoiceStatusRequest as InvoiceStatusRequest,
  IssueAssetNIAResponse,
  IssueAssetNIARequest,
  ListAssetsResponse,
  ListChannelsResponse,
  ListPaymentsResponse,
  ListTransactionsResponse,
  ListTransfersResponse,
  ListUnspentsResponse,
  CreateLNInvoiceResponse as LNInvoiceResponse,
  CreateLNInvoiceRequest as LNInvoiceRequest,
  MakerExecuteRequest,
  MakerExecuteResponse,
  MakerInitRequest,
  MakerInitResponse,
  NetworkInfoResponse,
  NodeInfoResponse,
  OpenChannelResponse,
  OpenChannelRequest,
  RefreshTransfersRequest as RefreshRequest,
  RestoreRequest,
  CreateRgbInvoiceResponse as RgbInvoiceResponse,
  CreateRgbInvoiceRequest as RgbInvoiceRequest,
  SendRgbResponse,
  SendRgbRequest,
  SendBtcRequest,
  SendPaymentResponse,
  SendPaymentRequest,
  SignMessageResponse,
  SignMessageRequest,
  UnlockRequest,
  KeysendResponse,
  KeysendRequest,
  ListPeersResponse,
  ListSwapsResponse,
  WhitelistTradeRequest,
} from 'kaleidoswap-sdk';

export type {
  Assignment,
  AssignmentFungible,
  Channel,
  NiaAsset,
  SwapDetails,
  Transfer,
} from './types';

export { SwapStatus } from './types';

export type {
  MakerExecuteRequest,
  MakerInitRequest,
  MakerInitResponse,
} from 'kaleidoswap-sdk';

// TakerRequest kept as local type for backward compatibility
export type { TakerRequest } from './types';

export const Network = {
  Mainnet: 'mainnet',
  Testnet: 'testnet',
  Regtest: 'regtest',
  Signet: 'signet',
} as const;
export type Network = typeof Network[keyof typeof Network];

// Re-export types for backwards compatibility
export type { SendPaymentResponse, InitResponse };

export interface NodeApiError {
  status: number;
  data: {
    error: string;
  };
}

type ApiState = { getState: () => unknown };

/**
 * Unified query function factory.
 * Works for both endpoints with arguments and void endpoints.
 * All error handling is delegated to NodeApiWrapper.execute().
 */
function queryFn<TArgs, TResult>(
  call: (wrapper: NodeApiWrapper, args: TArgs) => Promise<ApiResult<TResult>>
) {
  return async (args: TArgs, api: ApiState): Promise<{ data: TResult } | { error: FetchBaseQueryError }> => {
    try {
      const wrapper = await getNodeApiWrapper(api.getState() as MinimalState);
      const result = await call(wrapper, args);
      if ('error' in result && result.error) return { error: result.error };
      return { data: result.data as TResult };
    } catch (error) {
      return { error: { status: 500, data: { error: String(error) } } };
    }
  };
}

import { TakerRequest } from './types';

export const nodeApi = createApi({
  reducerPath: 'nodeApi',
  baseQuery: fakeBaseQuery(),
  endpoints: (builder) => ({

    // ============================================================================
    // Wallet Management
    // ============================================================================

    nodeInfo: builder.query<NodeInfoResponse, void>({
      queryFn: queryFn((w, _: void) => w.getNodeInfo()),
    }),

    networkInfo: builder.query<NetworkInfoResponse, void>({
      queryFn: queryFn((w, _: void) => w.getNetworkInfo()),
    }),

    // init/unlock/lock/shutdown are state-changing operations — mutations, not queries
    init: builder.mutation<InitResponse, InitRequest>({
      queryFn: queryFn((w, args) => w.initWallet(args)),
    }),

    unlock: builder.mutation<void, UnlockRequest>({
      queryFn: queryFn((w, args) => w.unlockWallet(args)),
    }),

    lock: builder.mutation<void, void>({
      queryFn: queryFn((w, _: void) => w.lockWallet()),
    }),

    shutdown: builder.mutation<void, void>({
      queryFn: queryFn((w, _: void) => w.shutdown()),
    }),

    backup: builder.mutation<void, BackupRequest>({
      queryFn: queryFn((w, args) => w.backup(args)),
    }),

    restore: builder.mutation<void, RestoreRequest>({
      queryFn: queryFn((w, args) => w.restore(args)),
    }),

    // ============================================================================
    // BTC Operations
    // ============================================================================

    address: builder.query<AddressResponse, void>({
      queryFn: queryFn((w, _: void) => w.getAddress()),
    }),

    btcBalance: builder.query<BtcBalanceResponse, void>({
      queryFn: queryFn((w, _: void) => w.getBtcBalance()),
    }),

    sendBtc: builder.mutation<void, SendBtcRequest>({
      queryFn: queryFn((w, args) => w.sendBtc(args)),
    }),

    listTransactions: builder.query<ListTransactionsResponse, void>({
      queryFn: queryFn((w, _: void) => w.listTransactions()),
    }),

    listUnspents: builder.query<ListUnspentsResponse, void>({
      queryFn: queryFn((w, _: void) => w.listUnspents()),
    }),

    createUtxos: builder.mutation<void, CreateUtxosRequest>({
      queryFn: queryFn((w, args) => w.createUtxos(args)),
    }),

    estimateFee: builder.query<EstimateFeeResponse, EstimateFeeRequest>({
      queryFn: queryFn((w, args) => w.estimateFee(args)),
    }),

    // ============================================================================
    // RGB Asset Operations
    // ============================================================================

    listAssets: builder.query<ListAssetsResponse, void>({
      queryFn: queryFn((w, _: void) => w.listAssets()),
    }),

    assetBalance: builder.query<AssetBalanceResponse, AssetBalanceRequest>({
      queryFn: queryFn((w, args) => w.getAssetBalance(args)),
    }),

    issueNiaAsset: builder.mutation<IssueAssetNIAResponse, IssueAssetNIARequest>({
      queryFn: queryFn((w, args) => w.issueAssetNIA(args)),
    }),

    sendRgb: builder.mutation<SendRgbResponse, SendRgbRequest>({
      queryFn: queryFn((w, args) => w.sendRgb(args)),
    }),

    listTransfers: builder.query<ListTransfersResponse, void>({
      queryFn: queryFn((w, _: void) => w.listTransfers()),
    }),

    refresh: builder.mutation<void, RefreshRequest | void>({
      queryFn: queryFn((w, args) => w.refreshTransfers(args || {})),
    }),

    // ============================================================================
    // Lightning Network - Channels
    // ============================================================================

    listChannels: builder.query<ListChannelsResponse, void>({
      queryFn: queryFn((w, _: void) => w.listChannels()),
    }),

    openChannel: builder.mutation<OpenChannelResponse, OpenChannelRequest>({
      queryFn: queryFn((w, args) => w.openChannel(args)),
    }),

    closeChannel: builder.mutation<void, CloseChannelRequest>({
      queryFn: queryFn((w, args) => w.closeChannel(args)),
    }),

    // ============================================================================
    // Lightning Network - Peers
    // ============================================================================

    listPeers: builder.query<ListPeersResponse, void>({
      queryFn: queryFn((w, _: void) => w.listPeers()),
    }),

    connectPeer: builder.mutation<ConnectPeerResponse, ConnectPeerRequest>({
      queryFn: queryFn((w, args) => w.connectPeer(args)),
    }),

    disconnectPeer: builder.mutation<void, DisconnectPeerRequest>({
      queryFn: queryFn((w, args) => w.disconnectPeer(args)),
    }),

    // ============================================================================
    // Lightning Network - Invoices & Payments
    // ============================================================================

    lnInvoice: builder.mutation<LNInvoiceResponse, LNInvoiceRequest>({
      queryFn: queryFn((w, args) => w.createLNInvoice(args)),
    }),

    rgbInvoice: builder.mutation<RgbInvoiceResponse, RgbInvoiceRequest>({
      queryFn: queryFn((w, args) => w.createRgbInvoice(args)),
    }),

    decodeInvoice: builder.query<DecodeLNInvoiceResponse, DecodeLNInvoiceRequest>({
      queryFn: queryFn((w, args) => w.decodeLNInvoice(args)),
    }),

    decodeRgbInvoice: builder.query<DecodeRGBInvoiceResponse, DecodeRGBInvoiceRequest>({
      queryFn: queryFn((w, args) => w.decodeRgbInvoice(args)),
    }),

    invoiceStatus: builder.query<InvoiceStatusResponse, InvoiceStatusRequest>({
      queryFn: queryFn((w, args) => w.getInvoiceStatus(args)),
    }),

    sendPayment: builder.mutation<SendPaymentResponse, SendPaymentRequest>({
      queryFn: queryFn((w, args) => w.sendPayment(args)),
    }),

    keysend: builder.mutation<KeysendResponse, KeysendRequest>({
      queryFn: queryFn((w, args) => w.keysend(args)),
    }),

    listPayments: builder.query<ListPaymentsResponse, void>({
      queryFn: queryFn((w, _: void) => w.listPayments()),
    }),

    // ============================================================================
    // Swaps
    // ============================================================================

    listSwaps: builder.query<ListSwapsResponse, void>({
      queryFn: queryFn((w, _: void) => w.listSwaps()),
    }),

    whitelistTrade: builder.mutation<void, WhitelistTradeRequest>({
      queryFn: queryFn((w, args) => w.whitelistTrade(args)),
    }),

    makerInit: builder.mutation<MakerInitResponse, MakerInitRequest>({
      queryFn: queryFn((w, args) => w.makerInit(args)),
    }),

    makerExecute: builder.mutation<MakerExecuteResponse, MakerExecuteRequest>({
      queryFn: queryFn((w, args) => w.makerExecute(args)),
    }),

    taker: builder.mutation<void, TakerRequest>({
      queryFn: queryFn((w, args) => w.taker(args)),
    }),

    // ============================================================================
    // Utility Methods
    // ============================================================================

    signMessage: builder.mutation<SignMessageResponse, SignMessageRequest>({
      queryFn: queryFn((w, args) => w.signMessage(args)),
    }),
  }),
});

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
} = nodeApi;
