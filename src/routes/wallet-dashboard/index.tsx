import { Button as KaleidoButton } from 'kaleido-ui'
import {
  Server,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Users,
  TrendingUp,
  Copy,
  Check,
  ShoppingCart,
  ExternalLink,
  Lock,
  ZapOff,
  Info,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'

import {
  CHANNELS_PATH,
  CREATE_NEW_CHANNEL_PATH,
  ORDER_CHANNEL_PATH,
  TRADE_PATH,
  WALLET_HISTORY_DEPOSITS_PATH,
  WALLET_HISTORY_ASSETS_PATH,
  WALLET_SETUP_PATH,
} from '../../app/router/paths'
import { useAppDispatch, useAppSelector } from '../../app/store/hooks'
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'
import { useSettings } from '../../hooks/useSettings'
import { AssetDetailsModal } from '../../components/AssetDetailsModal'
import {
  WalletOverview,
  WalletPage,
  type WalletAsset,
} from '../../components/Wallet/WalletOverview'
import { BTC_ASSET_ID } from '../../constants'
import { IssueAssetModal } from '../../components/IssueAssetModal'
import { PeerManagementModal } from '../../components/PeerManagementModal'
import { UTXOManagementModal } from '../../components/UTXOManagementModal'
import { CloseChannelModal } from '../../components/CloseChannelModal'
import { InfoModal } from '../../components/ChannelCard'
import { formatBitcoinAmount } from '../../helpers/number'
import { useAssetIcon } from '../../helpers/utils'
import { getAllRgbAssets } from '../../utils/rgbUtils'
import { useBitcoinPrice } from '../../hooks/useBitcoinPrice'
import bitcoinIcon from '../../assets/bitcoin-logo.svg'
import defaultRgbIcon from '../../assets/rgb-logo.svg'
import type { AssetNIA as NiaAsset } from 'kaleido-sdk/rln'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'
import { uiSliceActions } from '../../slices/ui/ui.slice'
import { logger } from '../../utils/logger'
import { fmtUnits as formatAssetUnits } from '../trade/nostr-p2p/format'

const AssetIcon: React.FC<{ className?: string; ticker: string }> = ({
  className = 'h-6 w-6 shrink-0',
  ticker,
}) => {
  const [imgSrc, setImgSrc] = useAssetIcon(ticker, defaultRgbIcon)
  return (
    <img
      alt=""
      className={className}
      onError={() => setImgSrc(defaultRgbIcon)}
      src={imgSrc}
    />
  )
}

const ChannelAssetBadge: React.FC<{ ticker: string }> = ({ ticker }) => {
  const isUsdt = ticker === 'USDT'
  return (
    <span
      className={`flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
        isUsdt
          ? 'bg-asset-usdt/10 border border-asset-usdt/20'
          : 'text-secondary bg-secondary/10 border border-secondary/20'
      }`}
      style={isUsdt ? { color: '#26A17B' } : {}}
    >
      <AssetIcon
        className="size-3 rounded-full object-contain"
        ticker={ticker}
      />
      {ticker}
    </span>
  )
}

// Ticker only — the icon already appears in the channel's header badge
// (ChannelAssetBadge), so repeating it inside the bar would duplicate it.
const BarAssetLabel: React.FC<{ ticker: string }> = ({ ticker }) => {
  const isUsdt = ticker === 'USDT'
  return (
    <span
      className="flex items-center justify-center font-medium"
      style={isUsdt ? { color: '#26A17B' } : {}}
    >
      <span className={isUsdt ? '' : 'text-content-secondary'}>{ticker}</span>
    </span>
  )
}

export const Component = () => {
  const account = useAppSelector((state) => state.nodeSettings.data)
  return (
    <NodeWallet
      key={JSON.stringify([account.network, account.name, account.node_url])}
    />
  )
}

function NodeWallet() {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [assets, assetsResponse] = nodeApi.endpoints.listAssets.useLazyQuery()
  const [btcBalance, btcBalanceResponse] =
    nodeApi.endpoints.btcBalance.useLazyQuery()
  const [listChannels, listChannelsResponse] =
    nodeApi.endpoints.listChannels.useLazyQuery()
  const [assetBalance] = nodeApi.endpoints.assetBalance.useLazyQuery()
  const [refreshTransfers, transfersResponse] =
    nodeApi.endpoints.refresh.useMutation()
  const [assetBalances, setAssetBalances] = useState<
    Record<
      string,
      { offChain?: number; onChain?: number; incoming: number } | null
    >
  >({})
  const [assetDetails, setAssetDetails] = useState<NiaAsset | null>(null)
  const { bitcoinUnit } = useSettings()
  const refreshRequest = useRef<symbol | null>(null)
  const isRefreshing =
    transfersResponse.isLoading ||
    assetsResponse.isFetching ||
    btcBalanceResponse.isFetching ||
    listChannelsResponse.isFetching
  const [getNodeInfo, nodeInfoResponse] =
    nodeApi.endpoints.nodeInfo.useLazyQuery()
  const [getNetworkInfo] = nodeApi.endpoints.networkInfo.useLazyQuery()
  const [showUTXOModal, setShowUTXOModal] = useState(false)
  const [showPeerModal, setShowPeerModal] = useState(false)
  const [showIssueAssetModal, setShowIssueAssetModal] = useState(false)
  const [closeChannelTarget, setCloseChannelTarget] = useState<{
    channelId: string
    peerPubkey: string
  } | null>(null)
  const [infoChannelTarget, setInfoChannelTarget] = useState<any | null>(null)
  const { copied: pubkeyCopied, copy: copyPubkey } = useCopyToClipboard()

  const refreshData = useCallback(async () => {
    const request = Symbol()
    refreshRequest.current = request
    // Refresh registers incoming RGB transfers before the asset list is read.
    try {
      await refreshTransfers({}).unwrap()
    } catch (err) {
      logger.error('refreshTransfers failed during dashboard refresh:', err)
    }
    if (request === refreshRequest.current)
      await Promise.all([assets(), listChannels(), btcBalance()])
  }, [assets, btcBalance, listChannels, refreshTransfers])

  const niaAssets = useMemo(
    () => getAllRgbAssets(assetsResponse.data),
    [assetsResponse.data]
  )
  const assetsMap = useMemo(
    () => Object.fromEntries(niaAssets.map((asset) => [asset.asset_id, asset])),
    [niaAssets]
  )

  // Fetch nodeInfo and networkInfo once on mount (they rarely change)
  useEffect(() => {
    getNodeInfo()
    getNetworkInfo()
  }, [getNodeInfo, getNetworkInfo])

  useEffect(() => {
    refreshData()
    const intervalId = setInterval(refreshData, 30_000)
    return () => {
      refreshRequest.current = null
      clearInterval(intervalId)
    }
  }, [refreshData])

  useEffect(() => {
    let current = true
    const readAssetBalances = async () => {
      const entries = await Promise.all(
        niaAssets.map(async (asset) => {
          const { data, isError } = await assetBalance({
            asset_id: asset.asset_id,
          })
          const balance =
            data && !isError
              ? {
                  incoming:
                    data.future != null && data.spendable != null
                      ? Math.max(0, data.future - data.spendable)
                      : 0,
                  offChain: data.offchain_outbound,
                  onChain: data.spendable,
                }
              : null
          return [asset.asset_id, balance] as const
        })
      )
      if (current) setAssetBalances(Object.fromEntries(entries))
    }
    if (niaAssets.length) void readAssetBalances()
    return () => {
      current = false
    }
  }, [
    niaAssets,
    assetsResponse.fulfilledTimeStamp,
    btcBalanceResponse.fulfilledTimeStamp,
    listChannelsResponse.fulfilledTimeStamp,
    assetBalance,
  ])

  const { formatFiat, btcPrice } = useBitcoinPrice()

  const onChainSpendableBalance =
    btcBalanceResponse.data?.vanilla?.spendable || 0
  const onChainFutureBalance = btcBalanceResponse.data?.vanilla?.future || 0
  const btcIncoming = Math.max(
    0,
    onChainFutureBalance - onChainSpendableBalance
  )
  const onChainColoredSpendableBalance =
    btcBalanceResponse.data?.colored?.spendable || 0

  const channels = listChannelsResponse?.data?.channels || []
  const offChainBalance = channels.reduce(
    (sum: number, ch: any) => sum + (ch.local_balance_sat || 0),
    0
  )
  const totalBalance =
    offChainBalance + onChainSpendableBalance + onChainColoredSpendableBalance
  const totalInboundLiquidity = channels.reduce(
    (sum: number, ch: any) => sum + (ch.inbound_balance_msat || 0) / 1000,
    0
  )
  const totalOutboundLiquidity = channels.reduce(
    (sum: number, ch: any) => sum + (ch.outbound_balance_msat || 0) / 1000,
    0
  )

  // Treat the pre-trigger (uninitialized) window as loading too. These are lazy
  // queries, so on first mount — before refreshData() fires them — RTK reports
  // isLoading=false with no data yet. Without this the balance would flash "0"
  // before the first fetch resolves; we want a loading placeholder instead.
  const isLoading =
    btcBalanceResponse.isUninitialized ||
    listChannelsResponse.isUninitialized ||
    (btcBalanceResponse.isLoading && !btcBalanceResponse.data) ||
    (listChannelsResponse.isLoading && !listChannelsResponse.data)

  const hasUsableChannel = channels.some(
    (channel) => channel.ready && channel.is_usable
  )

  const balanceUnavailable =
    btcBalanceResponse.data?.vanilla?.spendable == null ||
    btcBalanceResponse.data?.colored?.spendable == null ||
    !listChannelsResponse.data
  const dataUnavailable =
    btcBalanceResponse.isError ||
    listChannelsResponse.isError ||
    assetsResponse.isError ||
    niaAssets.some((asset) => assetBalances[asset.asset_id] === null)

  const isAssetsLoading =
    assetsResponse.isUninitialized ||
    (assetsResponse.isLoading && !assetsResponse.data)

  const liquidityTotal = totalInboundLiquidity + totalOutboundLiquidity
  const outboundPct =
    liquidityTotal > 0 ? (totalOutboundLiquidity / liquidityTotal) * 100 : 50
  const inboundPct =
    liquidityTotal > 0 ? (totalInboundLiquidity / liquidityTotal) * 100 : 50

  const pubkey = nodeInfoResponse.data?.pubkey || ''

  const handleCopyPubkey = () => {
    if (!pubkey) return
    copyPubkey(pubkey)
  }

  const btcOnChain = onChainSpendableBalance + onChainColoredSpendableBalance

  const btcUnit = bitcoinUnit === 'SAT' ? 'sats' : bitcoinUnit
  const displayBtc = (value: number) => formatBitcoinAmount(value, bitcoinUnit)
  const rows: WalletAsset[] = niaAssets.map((asset) => {
    const row = assetBalances[asset.asset_id]
    const display = (amount: number) =>
      formatAssetUnits(amount, asset.precision ?? 0)
    return {
      amounts: [
        row?.offChain == null ? null : display(row.offChain),
        row?.onChain == null ? null : display(row.onChain),
      ],
      description: asset.name,
      icon: <AssetIcon ticker={asset.ticker} />,
      id: asset.asset_id,
      loading: row === undefined,
      onDetails: () => setAssetDetails(asset),
      pending: row?.incoming
        ? `+${display(row.incoming)} · ${t('btcHistory.pending')}`
        : undefined,
      ticker: asset.ticker,
    }
  })
  const openReceive = (assetId?: string) =>
    dispatch(uiSliceActions.setModal({ assetId, type: 'deposit' }))
  const openSend = (assetId?: string) =>
    dispatch(uiSliceActions.setModal({ assetId, type: 'withdraw' }))

  return (
    <WalletPage
      action={
        <KaleidoButton asChild size="sm" variant="quiet">
          <Link to={WALLET_SETUP_PATH}>
            <Server aria-hidden size={16} />
            {t('unified.manageNodes')}
          </Link>
        </KaleidoButton>
      }
    >
      {!isLoading && !dataUnavailable && !balanceUnavailable && (
        <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-default bg-surface-overlay p-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-content-primary">
              {t(
                hasUsableChannel
                  ? 'ux.lightningAvailable'
                  : channels.length > 0
                    ? 'navigation.channels'
                    : totalBalance > 0
                      ? 'dashboard.openFirstChannel'
                      : 'dashboard.noFunds'
              )}
            </h2>
            <p className="mt-1 text-sm text-content-secondary">
              {t(
                hasUsableChannel
                  ? 'ux.checkSwapAvailability'
                  : channels.length > 0
                    ? channels.some((channel) => !channel.ready)
                      ? 'ux.channelPending'
                      : 'ux.channelUnavailable'
                    : totalBalance > 0
                      ? 'channels.noChannelsYet'
                      : 'dashboard.noFundsMessage'
              )}
            </p>
          </div>
          <button
            className="shrink-0 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            onClick={() => {
              if (hasUsableChannel) navigate(TRADE_PATH)
              else if (channels.length > 0) navigate(CHANNELS_PATH)
              else if (totalBalance > 0) navigate(ORDER_CHANNEL_PATH)
              else
                dispatch(
                  uiSliceActions.setModal({
                    assetId: BTC_ASSET_ID,
                    type: 'deposit',
                  })
                )
            }}
            type="button"
          >
            {t(
              hasUsableChannel
                ? 'dashboard.swap'
                : channels.length > 0
                  ? 'channels.manageChannels'
                  : totalBalance > 0
                    ? 'channels.buyAChannel'
                    : 'dashboard.deposit'
            )}
          </button>
        </section>
      )}
      {assetDetails && (
        <AssetDetailsModal
          asset={assetDetails}
          isOpen
          onClose={() => setAssetDetails(null)}
        />
      )}
      {/* Modals */}
      {showIssueAssetModal && (
        <IssueAssetModal
          onClose={() => setShowIssueAssetModal(false)}
          onSuccess={refreshData}
        />
      )}
      {showUTXOModal && (
        <UTXOManagementModal
          bitcoinUnit={bitcoinUnit}
          onClose={() => setShowUTXOModal(false)}
        />
      )}
      {showPeerModal && (
        <PeerManagementModal onClose={() => setShowPeerModal(false)} />
      )}
      {closeChannelTarget && (
        <CloseChannelModal
          channelId={closeChannelTarget.channelId}
          isOpen={true}
          onClose={() => setCloseChannelTarget(null)}
          onSuccess={() => {
            setCloseChannelTarget(null)
            refreshData()
          }}
          peerPubkey={closeChannelTarget.peerPubkey}
        />
      )}
      {infoChannelTarget && (
        <InfoModal
          asset={assetsMap[infoChannelTarget.asset_id || ''] ?? null}
          bitcoinUnit={bitcoinUnit}
          channel={infoChannelTarget}
          isOpen={true}
          onClose={() => setInfoChannelTarget(null)}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        <div className="min-w-0 lg:col-span-7">
          <WalletOverview
            assets={rows}
            assetsState={
              isAssetsLoading
                ? 'loading'
                : !assetsResponse.data
                  ? 'unavailable'
                  : 'ready'
            }
            balance={
              balanceUnavailable
                ? null
                : displayBtc(totalBalance) + ' ' + btcUnit
            }
            balanceDetails={
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-content-secondary">
                {!isLoading &&
                  !balanceUnavailable &&
                  formatFiat(totalBalance) && (
                    <span>≈ {formatFiat(totalBalance)}</span>
                  )}
                {btcPrice !== undefined && (
                  <span className="flex items-center gap-1 text-xs text-content-tertiary">
                    <TrendingUp aria-hidden size={13} />
                    {t('dashboard.btcPrice')} · {formatFiat(100_000_000)}
                  </span>
                )}
              </div>
            }
            balanceLabel={t('dashboard.totalBalance') + ' · BTC'}
            balanceLoading={isLoading}
            bitcoinRow={{
              amounts: [
                listChannelsResponse.data ? displayBtc(offChainBalance) : null,
                btcBalanceResponse.data?.vanilla?.spendable != null &&
                btcBalanceResponse.data?.colored?.spendable != null
                  ? displayBtc(btcOnChain)
                  : null,
              ],
              description: 'Bitcoin',
              icon: (
                <img alt="" className="size-6 shrink-0" src={bitcoinIcon} />
              ),
              id: BTC_ASSET_ID,
              loading: isLoading,
              pending:
                btcIncoming > 0
                  ? `+${displayBtc(btcIncoming)} · ${t('btcHistory.pending')}`
                  : undefined,
              ticker: 'BTC',
            }}
            columns={[
              t('dashboard.offChainBalance'),
              t('dashboard.onChainBalance'),
            ]}
            emptyMessage={t('trade.assetModal.noAssetsFound')}
            error={dataUnavailable ? t('ux.dataUnavailable') : undefined}
            marketAction={{
              label: t('dashboard.swap'),
              onClick: () => navigate(TRADE_PATH),
            }}
            onAssetHistory={(id) =>
              navigate(
                id === BTC_ASSET_ID
                  ? WALLET_HISTORY_DEPOSITS_PATH
                  : `${WALLET_HISTORY_ASSETS_PATH}?assetId=${encodeURIComponent(id)}`
              )
            }
            onAssetSend={openSend}
            onIssue={() => setShowIssueAssetModal(true)}
            onManageCoins={() => setShowUTXOModal(true)}
            onReceive={openReceive}
            onRefresh={refreshData}
            onSend={openSend}
            refreshing={isRefreshing}
          />
        </div>

        {/* ── RIGHT COLUMN: Node + Channels ── */}
        <div className="lg:col-span-5 flex flex-col min-h-0">
          {/* Single node card */}
          <div className="flex-1 min-h-0 flex flex-col bg-surface-overlay rounded-2xl border border-border-default/60 p-5">
            {/* Header: title + channel count */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-content-primary">
                  {t('dashboard.lightningChannels')}
                </h3>
              </div>
              {channels.length > 0 && (
                <span className="text-xs text-status-success flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
                  Online
                  <span className="font-bold text-status-success">
                    {channels.filter((c: any) => c.ready && c.is_usable).length}
                    /{channels.length}
                  </span>
                </span>
              )}
            </div>

            {/* Node ID row */}
            <div className="flex items-center justify-between bg-surface-elevated/60 px-3 py-2 rounded-lg border border-dashed border-border-default mb-4">
              <div className="flex items-center gap-1.5 min-w-0">
                <Lock className="w-3 h-3 text-content-tertiary flex-shrink-0" />
                <span className="text-xs font-semibold uppercase tracking-wider text-content-tertiary flex-shrink-0">
                  Node ID
                </span>
                <code className="text-xs font-mono text-primary truncate">
                  {pubkey ? `${pubkey.slice(0, 14)}…${pubkey.slice(-6)}` : '—'}
                </code>
              </div>
              <button
                className="text-content-tertiary hover:text-content-primary transition-colors flex-shrink-0 ml-2"
                onClick={handleCopyPubkey}
                title={pubkey}
                type="button"
              >
                {pubkeyCopied ? (
                  <Check className="w-3.5 h-3.5 text-status-success" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* Channel list — flex-1 scrollable */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 -mr-1">
              {isLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      className="h-16 bg-surface-elevated/50 rounded-xl animate-pulse"
                      key={i}
                    />
                  ))}
                </div>
              ) : !listChannelsResponse.data ? (
                <p className="text-sm text-content-tertiary">
                  {t('p2pMarket.market.cost.unavailable')}
                </p>
              ) : channels.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center h-full">
                  <Zap className="w-7 h-7 text-content-tertiary mb-2 opacity-50" />
                  <p className="text-xs text-content-tertiary">
                    {t('dashboard.noChannelsFound')}
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {channels.map((ch: any) => {
                    const asset = assetsMap[ch.asset_id || '']
                    const btcTotal =
                      (ch.outbound_balance_msat || 0) +
                      (ch.inbound_balance_msat || 0)
                    const btcOutPct =
                      btcTotal > 0
                        ? ((ch.outbound_balance_msat || 0) / btcTotal) * 100
                        : 50
                    const btcInPct =
                      btcTotal > 0
                        ? ((ch.inbound_balance_msat || 0) / btcTotal) * 100
                        : 50
                    const assetTotal =
                      (ch.asset_local_amount || 0) +
                      (ch.asset_remote_amount || 0)
                    const assetOutPct =
                      assetTotal > 0
                        ? ((ch.asset_local_amount || 0) / assetTotal) * 100
                        : 50
                    const assetInPct =
                      assetTotal > 0
                        ? ((ch.asset_remote_amount || 0) / assetTotal) * 100
                        : 50
                    return (
                      <div
                        className="group/ch bg-surface-base/35 hover:bg-surface-base/50 rounded-xl border border-border-default/50 hover:border-border-default p-3 transition-colors duration-200"
                        key={ch.channel_id}
                      >
                        {/* Channel header row */}
                        <div className="flex items-center justify-between text-xs mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-2 h-2 rounded-full flex-shrink-0 ${!ch.ready ? 'bg-amber-400 animate-pulse' : ch.is_usable ? 'bg-status-success' : 'bg-status-danger'}`}
                            />
                            <span className="text-content-secondary font-medium truncate">
                              {ch.peer_alias || ch.peer_pubkey?.slice(0, 10)}…
                            </span>
                            {asset && (
                              <ChannelAssetBadge ticker={asset.ticker} />
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {ch.ready ? (
                              <span className="text-xs font-semibold text-status-success border border-status-success/30 px-1.5 py-0.5 rounded uppercase">
                                {t('channelCard.status.open')}
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-amber-400 border border-amber-400/30 px-1.5 py-0.5 rounded uppercase">
                                {t('channelCard.status.pending')}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* BTC liquidity bar — purple, collapsed (no out/in labels) */}
                        <div className="mb-1.5">
                          <div className="grid grid-cols-3 items-center text-xs mb-0.5">
                            <span className="flex items-center gap-0.5 text-purple">
                              <ArrowUpRight className="w-2.5 h-2.5" />
                              {formatBitcoinAmount(
                                (ch.outbound_balance_msat || 0) / 1000,
                                bitcoinUnit
                              )}
                            </span>
                            <span className="flex items-center justify-center gap-1 text-content-secondary font-medium">
                              <img
                                alt=""
                                className="size-3"
                                src={bitcoinIcon}
                              />
                              BTC
                            </span>
                            <span className="flex items-center gap-0.5 text-[#C4B5FD] justify-end">
                              {formatBitcoinAmount(
                                (ch.inbound_balance_msat || 0) / 1000,
                                bitcoinUnit
                              )}
                              <ArrowDownRight className="w-2.5 h-2.5" />
                            </span>
                          </div>
                          <div className="relative h-1.5 bg-surface-high/60 rounded-full overflow-hidden">
                            <div
                              className="absolute left-0 top-0 h-full bg-purple rounded-l-full"
                              style={{ width: `${btcOutPct}%` }}
                            />
                            <div
                              className="absolute right-0 top-0 h-full bg-[#C4B5FD] rounded-r-full"
                              style={{ width: `${btcInPct}%` }}
                            />
                          </div>
                        </div>

                        {/* Asset liquidity bar (if RGB) — green, collapsed */}
                        {asset && (
                          <div>
                            <div className="grid grid-cols-3 items-center text-xs mb-0.5">
                              <span className="flex items-center gap-0.5 text-[#10B981]">
                                <ArrowUpRight className="w-2.5 h-2.5" />
                                {formatAssetUnits(
                                  ch.asset_local_amount || 0,
                                  asset.precision ?? 0
                                )}
                              </span>
                              <BarAssetLabel ticker={asset.ticker} />
                              <span className="flex items-center gap-0.5 text-[#6EE7B7] justify-end">
                                {formatAssetUnits(
                                  ch.asset_remote_amount || 0,
                                  asset.precision ?? 0
                                )}
                                <ArrowDownRight className="w-2.5 h-2.5" />
                              </span>
                            </div>
                            <div className="relative h-1.5 bg-surface-high/60 rounded-full overflow-hidden">
                              <div
                                className="absolute left-0 top-0 h-full bg-[#10B981] rounded-l-full"
                                style={{ width: `${assetOutPct}%` }}
                              />
                              <div
                                className="absolute right-0 top-0 h-full bg-[#6EE7B7] rounded-r-full"
                                style={{ width: `${assetInPct}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Close + Details — visible on hover */}
                        <div className="transition-all duration-200">
                          <div className="flex items-center justify-between pt-2 mt-1 border-t border-border-default/30">
                            <button
                              className="flex items-center gap-1 text-xs text-content-tertiary hover:text-red-400 hover:bg-red-500/10 px-1.5 py-0.5 rounded transition-colors"
                              onClick={(e) => {
                                e.stopPropagation()
                                setCloseChannelTarget({
                                  channelId: ch.channel_id,
                                  peerPubkey: ch.peer_pubkey,
                                })
                              }}
                              type="button"
                            >
                              <ZapOff className="w-3 h-3" />
                              {t('channelCard.buttons.close')}
                            </button>
                            <button
                              className="flex items-center gap-1 text-xs text-white border border-white/30 hover:border-white/50 px-2 py-0.5 rounded-md hover:bg-surface-high/50 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation()
                                setInfoChannelTarget(ch)
                              }}
                              type="button"
                            >
                              <Info className="w-3 h-3" />
                              {t('channelCard.buttons.details')}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Liquidity totals */}
            {channels.length > 0 && !isLoading && (
              <div className="border-t border-border-default/40 mt-4 pt-3">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="flex items-center gap-1 text-purple-400">
                    <ArrowUpRight className="w-3 h-3" />
                    {formatBitcoinAmount(
                      totalOutboundLiquidity,
                      bitcoinUnit
                    )}{' '}
                    {bitcoinUnit}
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    {formatBitcoinAmount(totalInboundLiquidity, bitcoinUnit)}{' '}
                    {bitcoinUnit}
                    <ArrowDownRight className="w-3 h-3" />
                  </span>
                </div>
                <div className="relative w-full bg-surface-elevated/60 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full bg-purple rounded-l-full transition-all duration-500"
                    style={{ width: `${outboundPct}%` }}
                  />
                  <div
                    className="absolute right-0 top-0 h-full bg-emerald-500 rounded-r-full transition-all duration-500"
                    style={{ width: `${inboundPct}%` }}
                  />
                  <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-surface-high/80" />
                </div>
              </div>
            )}

            {/* Action strip */}
            <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-border-default/40">
              {/* Primary: Manage */}
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-transparent hover:bg-white/5 border border-white/30 hover:border-white/50 text-white text-xs font-semibold transition-colors flex-shrink-0"
                onClick={() => navigate(CHANNELS_PATH)}
              >
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                {t('dashboard.manage')}
              </button>
              <div className="flex-1" />
              {/* Secondary: icon-only */}
              {[
                {
                  icon: <Plus className="w-3.5 h-3.5" />,
                  label: t('channels.createNewChannel'),
                  onClick: () => navigate(CREATE_NEW_CHANNEL_PATH),
                },
                {
                  icon: <ShoppingCart className="w-3.5 h-3.5" />,
                  label: t('channels.buyChannel'),
                  onClick: () => navigate(ORDER_CHANNEL_PATH),
                },
                {
                  icon: <Users className="w-3.5 h-3.5" />,
                  label: t('dashboard.peers'),
                  onClick: () => setShowPeerModal(true),
                },
              ].map(({ icon, label, onClick }) => (
                <div className="relative group/act" key={label}>
                  <button
                    className="icon-action p-1.5 rounded-md bg-transparent hover:bg-white/5 border border-white/30 hover:border-white/50 text-white transition-colors"
                    onClick={onClick}
                    title={label}
                  >
                    {icon}
                  </button>
                  <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-surface-high text-content-primary text-xs rounded-md py-0.5 px-1.5 opacity-0 group-hover/act:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-border-default/40 shadow-lg z-20">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </WalletPage>
  )
}
