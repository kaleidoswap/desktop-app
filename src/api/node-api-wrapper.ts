import type { NetworkInfoResponse } from 'kaleido-sdk'
import type {
  RlnClient,
  AddressResponse,
  AssetBalanceRequest,
  AssetBalanceResponse,
  BackupRequest,
  BtcBalanceResponse,
  CloseChannelRequest,
  ConnectPeerRequest,
  ConnectPeerResponse,
  CreateUtxosRequest,
  DecodeLNInvoiceRequest,
  DecodeLNInvoiceResponse,
  DecodeRGBInvoiceRequest,
  DecodeRGBInvoiceResponse,
  DisconnectPeerRequest,
  EstimateFeeRequest,
  EstimateFeeResponse,
  InvoiceStatusRequest,
  InvoiceStatusResponse,
  InitResponse,
  InitRequest,
  IssueAssetNIARequest,
  IssueAssetNIAResponse,
  ListAssetsResponse,
  ListChannelsResponse,
  ListPaymentsResponse,
  ListTransactionsResponse,
  ListTransfersResponse,
  ListUnspentsResponse,
  LNInvoiceRequest,
  CreateLNInvoiceResponse as LNInvoiceResponse,
  MakerExecuteRequest,
  MakerExecuteResponse,
  MakerInitRequest,
  MakerInitResponse,
  NodeInfoResponse,
  OpenChannelRequest,
  OpenChannelResponse,
  RefreshRequest,
  RestoreRequest,
  RgbInvoiceRequest,
  RgbInvoiceResponse,
  SendBtcRequest,
  SendPaymentRequest,
  SendPaymentResponse,
  SendRgbRequest,
  SendRgbResponse,
  SignMessageRequest,
  SignMessageResponse,
  UnlockRequest,
  KeysendRequest,
  KeysendResponse,
  ListPeersResponse,
  ListSwapsResponse,
  TakerRequest as WhitelistTradeRequest,
} from 'kaleido-sdk/rln'

import { ensureSkipSync } from './request-defaults'
import { transformSdkError } from './errors'
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'

export type ApiResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: FetchBaseQueryError }

export type CreateUtxosInput = Omit<CreateUtxosRequest, 'skip_sync'>
export type LNInvoiceInput = Omit<LNInvoiceRequest, 'expiry_sec'>
export type OpenChannelInput = Omit<
  OpenChannelRequest,
  'public' | 'push_msat' | 'with_anchors'
>
export type RefreshInput = Partial<Pick<RefreshRequest, 'skip_sync'>>
export type SendBtcInput = Omit<SendBtcRequest, 'skip_sync'>
export type SendRgbInput = Omit<SendRgbRequest, 'skip_sync'>
export type RgbInvoiceInput = Omit<RgbInvoiceRequest, 'min_confirmations'>

export class NodeApiWrapper {
  constructor(private readonly client: RlnClient) {}

  private async execute<T>(fn: () => Promise<T>): Promise<ApiResult<T>> {
    try {
      const data = await fn()
      return { data }
    } catch (error) {
      return { error: transformSdkError(error) }
    }
  }

  // ============================================================================
  // Wallet Management
  // ============================================================================

  async getNodeInfo(): Promise<ApiResult<NodeInfoResponse>> {
    return this.execute(() => this.client.getNodeInfo())
  }

  async getNetworkInfo(): Promise<ApiResult<NetworkInfoResponse>> {
    return this.execute(() => this.client.getNetworkInfo())
  }

  async initWallet(request: InitRequest): Promise<ApiResult<InitResponse>> {
    return this.execute(() => this.client.initWallet(request))
  }

  async unlockWallet(request: UnlockRequest): Promise<ApiResult<void>> {
    return this.execute(() => this.client.unlockWallet(request))
  }

  async lockWallet(): Promise<ApiResult<void>> {
    return this.execute(() => this.client.lockWallet())
  }

  async backup(request: BackupRequest): Promise<ApiResult<void>> {
    return this.execute(() => this.client.backup(request))
  }

  async restore(request: RestoreRequest): Promise<ApiResult<void>> {
    return this.execute(() => this.client.restore(request))
  }

  async shutdown(): Promise<ApiResult<void>> {
    return this.execute(() => this.client.shutdown())
  }

  // ============================================================================
  // BTC Operations
  // ============================================================================

  async getAddress(): Promise<ApiResult<AddressResponse>> {
    return this.execute(() => this.client.getAddress())
  }

  async getBtcBalance(
    skipSync = false
  ): Promise<ApiResult<BtcBalanceResponse>> {
    return this.execute(() => this.client.getBtcBalance(skipSync))
  }

  async sendBtc(request: SendBtcInput): Promise<ApiResult<void>> {
    return this.execute(() => this.client.sendBtc(ensureSkipSync(request)))
  }

  async listTransactions(): Promise<ApiResult<ListTransactionsResponse>> {
    return this.execute(() => this.client.listTransactions())
  }

  async listUnspents(): Promise<ApiResult<ListUnspentsResponse>> {
    return this.execute(() => this.client.listUnspents())
  }

  async createUtxos(request: CreateUtxosInput): Promise<ApiResult<void>> {
    return this.execute(() => this.client.createUtxos(ensureSkipSync(request)))
  }

  async estimateFee(
    request: EstimateFeeRequest
  ): Promise<ApiResult<EstimateFeeResponse>> {
    return this.execute(() => this.client.estimateFee(request))
  }

  // ============================================================================
  // RGB Asset Operations
  // ============================================================================

  async listAssets(
    filterAssetSchemas: Parameters<RlnClient['listAssets']>[0] = []
  ): Promise<ApiResult<ListAssetsResponse>> {
    return this.execute(() => this.client.listAssets(filterAssetSchemas))
  }

  async getAssetBalance(
    request: AssetBalanceRequest
  ): Promise<ApiResult<AssetBalanceResponse>> {
    return this.execute(() => this.client.getAssetBalance(request))
  }

  async issueAssetNIA(
    request: IssueAssetNIARequest
  ): Promise<ApiResult<IssueAssetNIAResponse>> {
    return this.execute(() => this.client.issueAssetNIA(request))
  }

  async sendRgb(request: SendRgbInput): Promise<ApiResult<SendRgbResponse>> {
    return this.execute(() => this.client.sendRgb(ensureSkipSync(request)))
  }

  async listTransfers(
    assetId: string
  ): Promise<ApiResult<ListTransfersResponse>> {
    return this.execute(() => this.client.listTransfers({ asset_id: assetId }))
  }

  async refreshTransfers(request?: RefreshInput): Promise<ApiResult<void>> {
    return this.execute(() =>
      this.client.refreshTransfers(ensureSkipSync(request || {}))
    )
  }

  // ============================================================================
  // Lightning Network - Channels
  // ============================================================================

  async listChannels(): Promise<ApiResult<ListChannelsResponse>> {
    return this.execute(() => this.client.listChannels())
  }

  async openChannel(
    request: OpenChannelInput
  ): Promise<ApiResult<OpenChannelResponse>> {
    const body: OpenChannelRequest = {
      ...request,
      // Protocol requirements — always enforced regardless of caller input
      public: true,
      push_msat: 3100000,
      with_anchors: true,
      // Floor asset_amount to an integer if provided
      ...(request.asset_amount != null && request.asset_amount > 0
        ? { asset_amount: Math.floor(request.asset_amount) }
        : {}),
    }
    return this.execute(() => this.client.openChannel(body))
  }

  async closeChannel(request: CloseChannelRequest): Promise<ApiResult<void>> {
    return this.execute(() => this.client.closeChannel(request))
  }

  // ============================================================================
  // Lightning Network - Peers
  // ============================================================================

  async listPeers(): Promise<ApiResult<ListPeersResponse>> {
    return this.execute(() => this.client.listPeers())
  }

  async connectPeer(
    request: ConnectPeerRequest
  ): Promise<ApiResult<ConnectPeerResponse>> {
    return this.execute(() => this.client.connectPeer(request))
  }

  async disconnectPeer(
    request: DisconnectPeerRequest
  ): Promise<ApiResult<void>> {
    return this.execute(() => this.client.disconnectPeer(request))
  }

  // ============================================================================
  // Lightning Network - Invoices & Payments
  // ============================================================================

  async createLNInvoice(
    request: LNInvoiceInput
  ): Promise<ApiResult<LNInvoiceResponse>> {
    // Always set expiry_sec; for RGB invoices force a fixed route-hint amount
    const body: LNInvoiceRequest = request.asset_id
      ? { ...request, amt_msat: request.amt_msat ?? 3000000, expiry_sec: 3600 }
      : { ...request, expiry_sec: 3600 }
    return this.execute(() => this.client.createLNInvoice(body))
  }

  async createRgbInvoice(
    request: RgbInvoiceInput
  ): Promise<ApiResult<RgbInvoiceResponse>> {
    return this.execute(() =>
      this.client.createRgbInvoice({ ...request, min_confirmations: 1 })
    )
  }

  async decodeLNInvoice(
    request: DecodeLNInvoiceRequest | string
  ): Promise<ApiResult<DecodeLNInvoiceResponse>> {
    return this.execute(() => this.client.decodeLNInvoice(request))
  }

  async decodeRgbInvoice(
    request: DecodeRGBInvoiceRequest
  ): Promise<ApiResult<DecodeRGBInvoiceResponse>> {
    return this.execute(() => this.client.decodeRgbInvoice(request))
  }

  async getInvoiceStatus(
    request: InvoiceStatusRequest
  ): Promise<ApiResult<InvoiceStatusResponse>> {
    return this.execute(() => this.client.getInvoiceStatus(request))
  }

  async sendPayment(
    request: SendPaymentRequest
  ): Promise<ApiResult<SendPaymentResponse>> {
    return this.execute(() => this.client.sendPayment(request))
  }

  async keysend(request: KeysendRequest): Promise<ApiResult<KeysendResponse>> {
    return this.execute(() => this.client.keysend(request))
  }

  async listPayments(): Promise<ApiResult<ListPaymentsResponse>> {
    return this.execute(() => this.client.listPayments())
  }

  // ============================================================================
  // Swaps
  // ============================================================================

  async listSwaps(): Promise<ApiResult<ListSwapsResponse>> {
    return this.execute(() => this.client.listSwaps())
  }

  async whitelistTrade(
    request: WhitelistTradeRequest | string
  ): Promise<ApiResult<void>> {
    return this.execute(() => this.client.whitelistSwap(request))
  }

  async makerInit(
    request: MakerInitRequest
  ): Promise<ApiResult<MakerInitResponse>> {
    return this.execute(() => this.client.makerInit(request))
  }

  async makerExecute(
    request: MakerExecuteRequest
  ): Promise<ApiResult<MakerExecuteResponse>> {
    return this.execute(() => this.client.makerExecute(request))
  }

  async taker(request: { swapstring: string }): Promise<ApiResult<void>> {
    return this.execute(() =>
      this.client.whitelistSwap(request as WhitelistTradeRequest)
    )
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  async signMessage(
    request: SignMessageRequest
  ): Promise<ApiResult<SignMessageResponse>> {
    return this.execute(() => this.client.signMessage(request))
  }
}
