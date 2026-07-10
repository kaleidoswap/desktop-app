import {
  RefreshCw,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Plus,
  Loader as LoaderIcon,
  Database,
  Users,
  TrendingUp,
  Copy,
  Check,
  ShoppingCart,
  ExternalLink,
  Lock,
  Download,
  Upload,
  History,
  Brain,
  ArrowRight,
  ZapOff,
  Info,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import {
  CHANNELS_PATH,
  CREATE_NEW_CHANNEL_PATH,
  ORDER_CHANNEL_PATH,
  TRADE_PATH,
  WALLET_HISTORY_DEPOSITS_PATH,
  KALEIDO_MIND_PATH,
} from '../../app/router/paths'
import { useAppDispatch, useAppSelector } from '../../app/store/hooks'
import { setAppMode, isMindEnabled } from '../../slices/settings/settings.slice'
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'
import { useSettings } from '../../hooks/useSettings'
import { AssetRow } from '../../components/AssetRow'
import { IssueAssetModal } from '../../components/IssueAssetModal'
import { PeerManagementModal } from '../../components/PeerManagementModal'
import { Button, LoadingPlaceholder } from '../../components/ui'
import { UTXOManagementModal } from '../../components/UTXOManagementModal'
import { CloseChannelModal } from '../../components/CloseChannelModal'
import { InfoModal } from '../../components/ChannelCard'
import { formatBitcoinAmount } from '../../helpers/number'
import { useAssetIcon } from '../../helpers/utils'
import { getAllRgbAssets } from '../../utils/rgbUtils'
import { useBitcoinPrice } from '../../hooks/useBitcoinPrice'
import defaultRgbIcon from '../../assets/rgb-logo.svg'
import type { AssetNIA as NiaAsset } from 'kaleido-sdk/rln'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'
import { uiSliceActions } from '../../slices/ui/ui.slice'

const BtcIcon: React.FC<{ className?: string }> = ({
  className = 'h-6 w-6',
}) => {
  const [imgSrc, setImgSrc] = useAssetIcon('BTC', defaultRgbIcon)
  return (
    <img
      alt="BTC icon"
      className={className}
      onError={() => setImgSrc(defaultRgbIcon)}
      src={imgSrc}
    />
  )
}

const ChannelAssetBadge: React.FC<{ ticker: string }> = ({ ticker }) => {
  const [imgSrc, setImgSrc] = useAssetIcon(ticker, defaultRgbIcon)
  const isUsdt = ticker === 'USDT'
  return (
    <span
      className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
        isUsdt
          ? 'bg-[#26A17B]/10 border border-[#26A17B]/20'
          : 'text-secondary bg-secondary/10 border border-secondary/20'
      }`}
      style={isUsdt ? { color: '#26A17B' } : {}}
    >
      <img
        alt={ticker}
        className="w-3 h-3 rounded-full object-contain"
        onError={() => setImgSrc(defaultRgbIcon)}
        src={imgSrc}
      />
      {ticker}
    </span>
  )
}

const BarAssetLabel: React.FC<{ ticker: string }> = ({ ticker }) => {
  const [imgSrc, setImgSrc] = useAssetIcon(ticker, defaultRgbIcon)
  const isUsdt = ticker === 'USDT'
  return (
    <span
      className="flex items-center justify-center gap-1 font-medium"
      style={isUsdt ? { color: '#26A17B' } : {}}
    >
      <img
        alt={ticker}
        className="w-3 h-3 rounded-full object-contain"
        onError={() => setImgSrc(defaultRgbIcon)}
        src={imgSrc}
      />
      <span className={isUsdt ? '' : 'text-content-secondary'}>{ticker}</span>
    </span>
  )
}

export const Component = () => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const appMode = useAppSelector((state) => state.settings.appMode)
  const mindActive = isMindEnabled(appMode)
  const activateMind = () => {
    dispatch(setAppMode('both'))
    navigate(KALEIDO_MIND_PATH)
  }
  const [assets, assetsResponse] = nodeApi.endpoints.listAssets.useLazyQuery()
  const [btcBalance, btcBalanceResponse] =
    nodeApi.endpoints.btcBalance.useLazyQuery()
  const [listChannels, listChannelsResponse] =
    nodeApi.endpoints.listChannels.useLazyQuery()
  const [assetBalance] = nodeApi.endpoints.assetBalance.useLazyQuery()
  const [refreshTransfers] = nodeApi.endpoints.refresh.useMutation()
  const [assetBalances, setAssetBalances] = useState<
    Record<string, { offChain: number; onChain: number; incoming: number }>
  >({})
  const [assetsMap, setAssetsMap] = useState<Record<string, NiaAsset>>({})
  const { bitcoinUnit } = useSettings()
  const [isRefreshing, setIsRefreshing] = useState(false)
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
    setIsRefreshing(true)
    try {
      // Settle any incoming RGB transfers BEFORE reading the asset list.
      // refreshtransfers is what registers a newly received asset and moves its
      // balance from "incoming" to spendable; running it concurrently with
      // listAssets meant the dashboard read the pre-refresh state and only
      // surfaced received assets a poll (or never) later. Errors are logged
      // rather than swallowed so a failing refresh is visible.
      try {
        await refreshTransfers({}).unwrap()
      } catch (err) {
        console.error('refreshTransfers failed during dashboard refresh:', err)
      }
      await Promise.all([assets(), listChannels(), btcBalance()])
    } finally {
      setIsRefreshing(false)
    }
  }, [assets, btcBalance, listChannels, refreshTransfers])

  useEffect(() => {
    if (assetsResponse.data) {
      const newAssetsMap: Record<string, NiaAsset> = {}
      getAllRgbAssets(assetsResponse.data).forEach((asset) => {
        if (asset.asset_id) newAssetsMap[asset.asset_id] = asset
      })
      setAssetsMap(newAssetsMap)
    }
  }, [assetsResponse.data])

  // Fetch nodeInfo and networkInfo once on mount (they rarely change)
  useEffect(() => {
    getNodeInfo()
    getNetworkInfo()
  }, [getNodeInfo, getNetworkInfo])

  useEffect(() => {
    refreshData()
    const intervalId = setInterval(refreshData, 30_000)
    return () => clearInterval(intervalId)
  }, [refreshData])

  useEffect(() => {
    const fetchAssetBalances = async () => {
      const newBalances: Record<
        string,
        { offChain: number; onChain: number; incoming: number }
      > = {}
      for (const asset of getAllRgbAssets(assetsResponse.data)) {
        if (asset.asset_id) {
          const balance = await assetBalance({ asset_id: asset.asset_id })
          const spendable = balance.data?.spendable || 0
          const future = balance.data?.future || 0
          newBalances[asset.asset_id] = {
            incoming: Math.max(0, future - spendable),
            offChain: balance.data?.offchain_outbound || 0,
            onChain: spendable,
          }
        }
      }
      setAssetBalances(newBalances)
    }
    if (assetsResponse.data) fetchAssetBalances()
  }, [
    assetsResponse.data,
    btcBalanceResponse.data,
    listChannelsResponse.data,
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

  const isAssetsLoading =
    assetsResponse.isUninitialized ||
    (assetsResponse.isLoading && !assetsResponse.data)

  const liquidityTotal = totalInboundLiquidity + totalOutboundLiquidity
  const outboundPct =
    liquidityTotal > 0 ? (totalOutboundLiquidity / liquidityTotal) * 100 : 50
  const inboundPct =
    liquidityTotal > 0 ? (totalInboundLiquidity / liquidityTotal) * 100 : 50

  const pubkey = nodeInfoResponse.data?.pubkey || ''
  const niaAssets = getAllRgbAssets(assetsResponse.data)

  const handleCopyPubkey = () => {
    if (!pubkey) return
    copyPubkey(pubkey)
  }

  const btcOnChain = onChainSpendableBalance + onChainColoredSpendableBalance

  const renderBalanceWithIncoming = (
    balance: number,
    incoming: number,
    formatFn: (val: number) => React.ReactNode
  ) => {
    if (incoming > 0) {
      return (
        <div className="flex flex-col">
          <span className="font-bold">{formatFn(balance)}</span>
          <span className="text-[10px] text-content-tertiary font-medium">
            +{formatFn(incoming)} incoming
          </span>
        </div>
      )
    }
    return <div className="font-bold">{formatFn(balance)}</div>
  }

  return (
    <div className="w-full h-full flex flex-col animate-in fade-in duration-500">
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

      {/* KaleidoMind not active in this mode — offer a way to activate it */}
      {!mindActive && (
        <button
          className="group mb-5 flex w-full items-center gap-4 rounded-xl border border-purple/30 bg-gradient-to-r from-purple/10 to-transparent px-5 py-4 text-left transition-all duration-300 hover:border-purple/50 hover:from-purple/15"
          onClick={activateMind}
          type="button"
        >
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-purple/15 text-purple">
            <Brain className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-white">
              {t('dashboard.activateMindTitle', {
                defaultValue: 'Add KaleidoMind',
              })}
            </div>
            <div className="text-xs text-content-secondary">
              {t('dashboard.activateMindDesc', {
                defaultValue:
                  'Run a local AI brain alongside your node — chat, models and phone pairing.',
              })}
            </div>
          </div>
          <ArrowRight className="h-5 w-5 flex-shrink-0 text-purple transition-transform duration-300 group-hover:translate-x-1" />
        </button>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* ── LEFT COLUMN: Balance + Assets ── */}
        <div className="lg:col-span-7 flex flex-col gap-5 min-h-0">
          {/* Balance Card */}
          <div className="relative overflow-hidden bg-surface-overlay rounded-2xl border border-border-default/60 shadow-xl p-6 group">
            {/* Refresh icon — top right */}
            <div className="absolute top-4 right-4 z-20">
              <button
                aria-label={
                  isRefreshing
                    ? t('dashboard.refreshing')
                    : t('dashboard.refresh')
                }
                className="p-1.5 rounded-md bg-transparent hover:bg-white/5 border border-white/30 hover:border-white/50 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={isRefreshing}
                onClick={refreshData}
                title={
                  isRefreshing
                    ? t('dashboard.refreshing')
                    : t('dashboard.refresh')
                }
              >
                {isRefreshing ? (
                  <LoaderIcon className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-secondary/5 rounded-full blur-3xl pointer-events-none" />

            {/* Total balance */}
            <div className="relative z-10 mb-5">
              <div className="mb-1.5">
                <p className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
                  {t('dashboard.totalBalance')}
                </p>
              </div>
              <div className="flex items-baseline gap-2.5 mb-1.5">
                <span className="text-4xl font-bold text-content-primary leading-none">
                  {isLoading ? (
                    <LoadingPlaceholder width="w-48" />
                  ) : (
                    formatBitcoinAmount(totalBalance, bitcoinUnit)
                  )}
                </span>
                <span className="text-xl font-semibold text-white">
                  {bitcoinUnit === 'SAT' ? 'SATS' : bitcoinUnit}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm flex-wrap">
                {!isLoading && formatFiat(totalBalance) && (
                  <span className="text-content-secondary">
                    ≈ {formatFiat(totalBalance)}
                  </span>
                )}
                {btcPrice !== undefined && (
                  <span className="flex items-center gap-1 text-xs text-content-tertiary">
                    <TrendingUp className="w-3 h-3 text-primary" />
                    {t('dashboard.btcPrice')}:{' '}
                    <span className="text-content-secondary ml-0.5">
                      {formatFiat(100_000_000)}
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Actions — compact 3-button row */}
            <div className="relative z-10 grid grid-cols-3 gap-2">
              <button
                className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-status-success/15 hover:bg-status-success/25 border border-status-success/30 hover:border-status-success/50 text-status-success text-xs font-semibold transition-all overflow-hidden"
                onClick={() =>
                  dispatch(
                    uiSliceActions.setModal({
                      assetId: niaAssets[0]?.asset_id,
                      type: 'deposit',
                    })
                  )
                }
              >
                <Download className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{t('dashboard.deposit')}</span>
              </button>
              <button
                className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 hover:border-white/30 text-white text-xs font-semibold transition-all overflow-hidden"
                onClick={() => navigate(TRADE_PATH)}
              >
                <ArrowLeftRight className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{t('dashboard.swap', 'Swap')}</span>
              </button>
              <button
                className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 hover:border-violet-500/50 text-violet-400 text-xs font-semibold transition-all overflow-hidden"
                onClick={() =>
                  dispatch(
                    uiSliceActions.setModal({
                      assetId: niaAssets[0]?.asset_id,
                      type: 'withdraw',
                    })
                  )
                }
              >
                <Upload className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{t('dashboard.withdraw')}</span>
              </button>
            </div>
          </div>

          {/* Assets Card */}
          <div className="flex-1 min-h-0 flex flex-col bg-surface-overlay rounded-2xl border border-border-default/60 shadow-xl overflow-hidden">
            {/* Card header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-default/40">
              <h3 className="text-base font-bold text-content-primary">
                {t('dashboard.assets')}
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  className="border-white/30 hover:border-white/50"
                  icon={<Database className="w-4 h-4" />}
                  onClick={() => setShowUTXOModal(true)}
                  size="sm"
                  variant="outline"
                >
                  {t('dashboard.manageUTXOs')}
                </Button>
                <Button
                  icon={<Plus className="w-4 h-4" />}
                  onClick={() => setShowIssueAssetModal(true)}
                  size="sm"
                >
                  {t('dashboard.issueAsset')}
                </Button>
              </div>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-4 gap-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 border-b border-border-default/30">
              <div className="px-4 py-2.5">{t('dashboard.asset')}</div>
              <div className="px-4 py-2.5">
                {t('dashboard.offChainBalance')}
              </div>
              <div className="px-4 py-2.5">{t('dashboard.onChainBalance')}</div>
              <div className="px-4 py-2.5 text-center">
                {t('dashboard.actions')}
              </div>
            </div>

            {/* Bitcoin row — always first */}
            <div className="group grid grid-cols-4 gap-2 items-center bg-surface-elevated/40 hover:bg-surface-elevated/70 transition-colors border-b border-border-default/20">
              {/* Asset cell */}
              <div className="py-3 px-4 text-sm truncate flex items-center">
                <BtcIcon className="h-6 w-6 mr-2 flex-shrink-0" />
                <div>
                  <div className="font-bold">BTC</div>
                  <div>Bitcoin</div>
                </div>
              </div>
              {/* Off-chain */}
              <div className="text-sm py-3 px-4">
                {isLoading ? (
                  <LoadingPlaceholder />
                ) : (
                  <div className="font-bold">
                    {formatBitcoinAmount(offChainBalance, bitcoinUnit)}
                  </div>
                )}
              </div>
              {/* On-chain */}
              <div className="text-sm py-3 px-4">
                {isLoading ? (
                  <LoadingPlaceholder />
                ) : (
                  renderBalanceWithIncoming(btcOnChain, btcIncoming, (val) =>
                    formatBitcoinAmount(val, bitcoinUnit)
                  )
                )}
              </div>
              {/* Actions */}
              <div className="py-3 px-2 flex justify-center">
                <div className="flex items-center gap-0.5">
                  {[
                    {
                      color: 'text-status-success hover:bg-status-success/15',
                      icon: <Download className="w-3.5 h-3.5" />,
                      label: t('dashboard.deposit'),
                      onClick: () =>
                        dispatch(
                          uiSliceActions.setModal({
                            assetId: niaAssets[0]?.asset_id,
                            type: 'deposit',
                          })
                        ),
                    },
                    {
                      color: 'text-violet-400 hover:bg-violet-500/15',
                      icon: <Upload className="w-3.5 h-3.5" />,
                      label: t('dashboard.withdraw'),
                      onClick: () =>
                        dispatch(
                          uiSliceActions.setModal({
                            assetId: niaAssets[0]?.asset_id,
                            type: 'withdraw',
                          })
                        ),
                    },
                    {
                      color: 'text-white hover:bg-white/10',
                      icon: <History className="w-3.5 h-3.5" />,
                      label: t('dashboard.history'),
                      onClick: () => navigate(WALLET_HISTORY_DEPOSITS_PATH),
                    },
                  ].map(({ icon, label, color, onClick }) => (
                    <div className="relative group/btn" key={label}>
                      <button
                        className={`p-1.5 rounded-md transition-colors duration-150 ${color}`}
                        onClick={onClick}
                        title={label}
                      >
                        {icon}
                      </button>
                      <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-surface-high text-content-primary text-[10px] rounded-md py-0.5 px-1.5 opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-border-default/40 shadow-lg z-20">
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RGB asset rows — scrollable */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
              {isAssetsLoading ? (
                <div className="space-y-0">
                  {[0, 1, 2].map((i) => (
                    <div
                      className="grid grid-cols-4 gap-2 items-center border-b border-border-default/20 px-4 py-3"
                      key={i}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-surface-elevated/50 animate-pulse flex-shrink-0" />
                        <LoadingPlaceholder width="w-16" />
                      </div>
                      <LoadingPlaceholder />
                      <LoadingPlaceholder />
                      <div className="flex justify-center gap-1">
                        <div className="w-6 h-6 rounded-lg bg-surface-elevated/50 animate-pulse" />
                        <div className="w-6 h-6 rounded-lg bg-surface-elevated/50 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : niaAssets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-content-tertiary">
                  <Database className="w-10 h-10 mb-3 opacity-40" />
                  <p className="text-sm font-medium">No RGB assets found.</p>
                  <p className="text-xs mt-1 opacity-70">
                    Issue an asset or deposit to get started.
                  </p>
                </div>
              ) : (
                niaAssets.map((asset: any) => (
                  <AssetRow
                    asset={asset as NiaAsset}
                    incomingBalance={
                      (assetBalances[asset.asset_id || ''] || {}).incoming || 0
                    }
                    isLoading={!(asset.asset_id in assetBalances)}
                    key={asset.asset_id}
                    offChainBalance={
                      (assetBalances[asset.asset_id || ''] || {}).offChain || 0
                    }
                    onChainBalance={
                      (assetBalances[asset.asset_id || ''] || {}).onChain || 0
                    }
                  />
                ))
              )}
            </div>
          </div>
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
                    {channels.filter((c: any) => c.ready).length}/
                    {channels.length}
                  </span>
                </span>
              )}
            </div>

            {/* Node ID row */}
            <div className="flex items-center justify-between bg-surface-elevated/60 px-3 py-2 rounded-lg border border-dashed border-border-default mb-4">
              <div className="flex items-center gap-1.5 min-w-0">
                <Lock className="w-3 h-3 text-content-tertiary flex-shrink-0" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-content-tertiary flex-shrink-0">
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
                            {asset ? (
                              <ChannelAssetBadge ticker={asset.ticker} />
                            ) : (
                              <ChannelAssetBadge ticker="BTC" />
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {ch.ready ? (
                              <span className="text-[10px] font-semibold text-status-success border border-status-success/30 px-1.5 py-0.5 rounded uppercase">
                                {t('channelCard.status.open')}
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-amber-400 border border-amber-400/30 px-1.5 py-0.5 rounded uppercase">
                                {t('channelCard.status.pending')}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* BTC liquidity bar */}
                        <div className="mb-1.5">
                          <div className="max-h-0 overflow-hidden group-hover/ch:max-h-8 transition-all duration-200 flex items-center justify-between text-[10px] mb-0.5">
                            <span className="flex items-center gap-1 text-content-secondary font-medium">
                              <BtcIcon className="w-3 h-3" />
                              BTC
                            </span>
                            <span className="flex items-center gap-1 font-mono">
                              <span className="flex items-center gap-0.5 text-purple-400">
                                <ArrowUpRight className="w-2.5 h-2.5" />
                                {formatBitcoinAmount(
                                  (ch.outbound_balance_msat || 0) / 1000,
                                  bitcoinUnit
                                )}
                              </span>
                              <span className="text-content-tertiary/40">
                                /
                              </span>
                              <span className="flex items-center gap-0.5 text-emerald-400">
                                {formatBitcoinAmount(
                                  (ch.inbound_balance_msat || 0) / 1000,
                                  bitcoinUnit
                                )}
                                <ArrowDownRight className="w-2.5 h-2.5" />
                              </span>
                            </span>
                          </div>
                          <div className="relative h-1.5 bg-surface-high/60 rounded-full overflow-hidden">
                            <div
                              className="absolute left-0 top-0 h-full bg-[#9365FF] rounded-l-full"
                              style={{ width: `${btcOutPct}%` }}
                            />
                            <div
                              className="absolute right-0 top-0 h-full bg-emerald-500 rounded-r-full"
                              style={{ width: `${btcInPct}%` }}
                            />
                            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-surface-high/80" />
                          </div>
                          <div className="max-h-0 overflow-hidden group-hover/ch:max-h-4 transition-all duration-200 flex justify-between text-[8px] font-semibold uppercase tracking-wider mt-0.5">
                            <span className="text-[#9365FF]/70">Outbound</span>
                            <span className="text-emerald-400/70">Inbound</span>
                          </div>
                        </div>

                        {/* Asset liquidity bar (if RGB channel) */}
                        {asset && (
                          <div>
                            <div className="max-h-0 overflow-hidden group-hover/ch:max-h-8 transition-all duration-200 flex items-center justify-between text-[10px] mb-0.5">
                              <BarAssetLabel ticker={asset.ticker} />
                              <span className="flex items-center gap-1 font-mono">
                                <span className="flex items-center gap-0.5 text-purple-400">
                                  <ArrowUpRight className="w-2.5 h-2.5" />
                                  {ch.asset_local_amount || 0}
                                </span>
                                <span className="text-content-tertiary/40">
                                  /
                                </span>
                                <span className="flex items-center gap-0.5 text-emerald-400">
                                  {ch.asset_remote_amount || 0}
                                  <ArrowDownRight className="w-2.5 h-2.5" />
                                </span>
                              </span>
                            </div>
                            <div className="relative h-1.5 bg-surface-high/60 rounded-full overflow-hidden">
                              <div
                                className="absolute left-0 top-0 h-full bg-[#9365FF] rounded-l-full"
                                style={{ width: `${assetOutPct}%` }}
                              />
                              <div
                                className="absolute right-0 top-0 h-full bg-emerald-500 rounded-r-full"
                                style={{ width: `${assetInPct}%` }}
                              />
                              <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-surface-high/80" />
                            </div>
                            <div className="max-h-0 overflow-hidden group-hover/ch:max-h-4 transition-all duration-200 flex justify-between text-[8px] font-semibold uppercase tracking-wider mt-0.5">
                              <span className="text-[#9365FF]/70">
                                Outbound
                              </span>
                              <span className="text-emerald-400/70">
                                Inbound
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Close + Details — visible on hover */}
                        <div className="overflow-hidden max-h-0 group-hover/ch:max-h-10 transition-all duration-200">
                          <div className="flex items-center justify-between pt-2 mt-1 border-t border-border-default/30">
                            <button
                              className="flex items-center gap-1 text-[10px] text-content-tertiary hover:text-red-400 hover:bg-red-500/10 px-1.5 py-0.5 rounded transition-colors"
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
                              className="flex items-center gap-1 text-[10px] text-white border border-white/30 hover:border-white/50 px-2 py-0.5 rounded-md hover:bg-surface-high/50 transition-colors"
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
                    className="absolute left-0 top-0 h-full bg-[#9365FF] rounded-l-full transition-all duration-500"
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
                  <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-surface-high text-content-primary text-[10px] rounded-md py-0.5 px-1.5 opacity-0 group-hover/act:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-border-default/40 shadow-lg z-20">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
