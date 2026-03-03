import {
  RefreshCw,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Info,
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
  Unlock,
  Download,
  Upload,
  History,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import {
  CHANNELS_PATH,
  CREATE_NEW_CHANNEL_PATH,
  ORDER_CHANNEL_PATH,
  WALLET_HISTORY_DEPOSITS_PATH,
} from '../../app/router/paths'
import { useAppDispatch } from '../../app/store/hooks'
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'
import { useSettings } from '../../hooks/useSettings'
import { AssetRow } from '../../components/AssetRow'
import { IssueAssetModal } from '../../components/IssueAssetModal'
import { PeerManagementModal } from '../../components/PeerManagementModal'
import { Button, LoadingPlaceholder } from '../../components/ui'
import { UTXOManagementModal } from '../../components/UTXOManagementModal'
import { BitcoinNetwork } from '../../constants'
import { formatBitcoinAmount } from '../../helpers/number'
import { useAssetIcon } from '../../helpers/utils'
import { useBitcoinPrice } from '../../hooks/useBitcoinPrice'
import defaultRgbIcon from '../../assets/rgb-symbol-color.svg'
import { Asset as NiaAsset } from 'kaleidoswap-sdk'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'
import { uiSliceActions } from '../../slices/ui/ui.slice'

const BtcIcon: React.FC<{ className?: string }> = ({ className = 'h-6 w-6' }) => {
  const [imgSrc, setImgSrc] = useAssetIcon('BTC', defaultRgbIcon)
  return (
    <img alt="BTC icon" className={className} onError={() => setImgSrc(defaultRgbIcon)} src={imgSrc} />
  )
}

export const Component = () => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [assets, assetsResponse] = nodeApi.endpoints.listAssets.useLazyQuery()
  const [btcBalance, btcBalanceResponse] =
    nodeApi.endpoints.btcBalance.useLazyQuery()
  const [listChannels, listChannelsResponse] =
    nodeApi.endpoints.listChannels.useLazyQuery()
  const [assetBalance] = nodeApi.endpoints.assetBalance.useLazyQuery()
  const [refreshTransfers] = nodeApi.endpoints.refresh.useMutation()
  const [assetBalances, setAssetBalances] = useState<
    Record<string, { offChain: number; onChain: number }>
  >({})
  const [assetsMap, setAssetsMap] = useState<Record<string, NiaAsset>>({})
  const { bitcoinUnit } = useSettings()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [getNodeInfo, nodeInfoResponse] =
    nodeApi.endpoints.nodeInfo.useLazyQuery()
  const [getNetworkInfo, networkInfoResponse] =
    nodeApi.endpoints.networkInfo.useLazyQuery()
  const [showUTXOModal, setShowUTXOModal] = useState(false)
  const [showPeerModal, setShowPeerModal] = useState(false)
  const [showIssueAssetModal, setShowIssueAssetModal] = useState(false)
  const { copied: pubkeyCopied, copy: copyPubkey } = useCopyToClipboard()

  const refreshData = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([
        assets(),
        listChannels(),
        btcBalance(),
        refreshTransfers({}),
        getNodeInfo(),
        getNetworkInfo(),
      ])
    } finally {
      setIsRefreshing(false)
    }
  }, [assets, btcBalance, listChannels, refreshTransfers, getNodeInfo, getNetworkInfo])

  useEffect(() => {
    if (assetsResponse.data?.nia) {
      const newAssetsMap: Record<string, NiaAsset> = {}
      assetsResponse.data.nia.forEach((asset) => {
        if (asset.asset_id) newAssetsMap[asset.asset_id] = asset as NiaAsset
      })
      setAssetsMap(newAssetsMap)
    }
  }, [assetsResponse.data])

  useEffect(() => {
    refreshData()
    const intervalId = setInterval(refreshData, 5000)
    return () => clearInterval(intervalId)
  }, [refreshData])

  useEffect(() => {
    const fetchAssetBalances = async () => {
      const newBalances: Record<string, { offChain: number; onChain: number }> = {}
      for (const asset of assetsResponse.data?.nia || []) {
        if (asset.asset_id) {
          const balance = await assetBalance({ asset_id: asset.asset_id })
          newBalances[asset.asset_id] = {
            offChain: balance.data?.offchain_outbound || 0,
            onChain: balance.data?.future || 0,
          }
        }
      }
      setAssetBalances(newBalances)
    }
    if (assetsResponse.data) fetchAssetBalances()
  }, [assetsResponse.data, btcBalanceResponse.data, listChannelsResponse.data, assetBalance])

  const { formatFiat, btcPrice } = useBitcoinPrice()

  const network = networkInfoResponse.data?.network as unknown as BitcoinNetwork | undefined
  const isMainnet = network === 'Mainnet'

  const onChainSpendableBalance = btcBalanceResponse.data?.vanilla?.spendable || 0
  const onChainColoredSpendableBalance = btcBalanceResponse.data?.colored?.spendable || 0

  const channels = listChannelsResponse?.data?.channels || []
  const offChainBalance = channels.reduce(
    (sum, ch) => sum + (ch.local_balance_sat || 0), 0
  )
  const totalBalance =
    offChainBalance + onChainSpendableBalance + onChainColoredSpendableBalance
  const totalInboundLiquidity = channels.reduce(
    (sum, ch) => sum + (ch.inbound_balance_msat || 0) / 1000, 0
  )
  const totalOutboundLiquidity = channels.reduce(
    (sum, ch) => sum + (ch.outbound_balance_msat || 0) / 1000, 0
  )

  const isLoading = btcBalanceResponse.isLoading || listChannelsResponse.isLoading

  const liquidityTotal = totalInboundLiquidity + totalOutboundLiquidity
  const outboundPct = liquidityTotal > 0 ? (totalOutboundLiquidity / liquidityTotal) * 100 : 50
  const inboundPct = liquidityTotal > 0 ? (totalInboundLiquidity / liquidityTotal) * 100 : 50

  const pubkey = nodeInfoResponse.data?.pubkey || ''
  const niaAssets = assetsResponse.data?.nia || []

  const handleCopyPubkey = () => {
    if (!pubkey) return
    copyPubkey(pubkey)
  }

  const btcOnChain = onChainSpendableBalance + onChainColoredSpendableBalance

  return (
    <div className="w-full h-full flex flex-col animate-in fade-in duration-500">
      {/* Modals */}
      {showIssueAssetModal && (
        <IssueAssetModal onClose={() => setShowIssueAssetModal(false)} onSuccess={refreshData} />
      )}
      {showUTXOModal && (
        <UTXOManagementModal bitcoinUnit={bitcoinUnit} onClose={() => setShowUTXOModal(false)} />
      )}
      {showPeerModal && (
        <PeerManagementModal onClose={() => setShowPeerModal(false)} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">

        {/* ── LEFT COLUMN: Balance + Assets ── */}
        <div className="lg:col-span-7 flex flex-col gap-5 min-h-0">

          {/* Balance Card */}
          <div className="relative overflow-hidden bg-surface-overlay rounded-2xl border border-border-default/60 shadow-xl p-6 group">
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-secondary/5 rounded-full blur-3xl pointer-events-none" />

            {/* Total balance */}
            <div className="relative z-10 mb-5">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
                  {t('dashboard.totalBalance')}
                </p>
                <div className="flex items-center gap-2">
                  <div className="relative group/warn">
                    <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border cursor-default ${isMainnet
                        ? 'text-status-success bg-status-success/10 border-status-success/20'
                        : network
                          ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                          : 'text-content-tertiary bg-surface-elevated border-border-default/40'
                      }`}>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isMainnet ? 'bg-status-success' : network ? 'bg-amber-400 animate-pulse' : 'bg-content-tertiary'}`} />
                      {network || '—'}
                      {!isMainnet && network && <AlertTriangle className="w-3 h-3" />}
                    </span>
                    {!isMainnet && network && (
                      <div className="absolute right-0 top-7 w-52 bg-surface-elevated text-content-primary text-xs rounded-xl py-2.5 px-3 opacity-0 group-hover/warn:opacity-100 transition-opacity pointer-events-none border border-amber-500/30 shadow-lg z-30">
                        <p className="font-semibold text-amber-400 mb-1">{t('dashboard.testnetWarning')}</p>
                        <p className="text-content-tertiary leading-relaxed">{t('dashboard.testnetWarningDesc')}</p>
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-mono text-content-tertiary">
                    #{networkInfoResponse.data?.height || '—'}
                  </span>
                </div>
              </div>
              <div className="flex items-baseline gap-2.5 mb-1.5">
                <span className="text-4xl font-bold text-content-primary leading-none">
                  {isLoading
                    ? <LoadingPlaceholder width="w-48" />
                    : formatBitcoinAmount(totalBalance, bitcoinUnit)}
                </span>
                <span className="text-xl font-semibold text-primary">{bitcoinUnit}</span>
              </div>
              <div className="flex items-center gap-4 text-sm flex-wrap">
                {!isLoading && formatFiat(totalBalance) && (
                  <span className="text-content-secondary">≈ {formatFiat(totalBalance)}</span>
                )}
                {btcPrice !== undefined && (
                  <span className="flex items-center gap-1 text-xs text-content-tertiary">
                    <TrendingUp className="w-3 h-3 text-primary" />
                    {t('dashboard.btcPrice')}: <span className="text-content-secondary ml-0.5">{formatFiat(100_000_000)}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Actions — compact 3-button row */}
            <div className="relative z-10 grid grid-cols-3 gap-2">
              <button
                className="flex items-center justify-center gap-1 px-2 py-2 rounded-xl bg-status-success/15 hover:bg-status-success/25 border border-status-success/30 hover:border-status-success/50 text-status-success text-xs font-semibold transition-all overflow-hidden"
                onClick={() => dispatch(uiSliceActions.setModal({ assetId: niaAssets[0]?.asset_id, type: 'deposit' }))}
              >
                <Download className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{t('dashboard.deposit')}</span>
              </button>
              <button
                className="flex items-center justify-center gap-1 px-2 py-2 rounded-xl bg-status-danger/15 hover:bg-status-danger/25 border border-status-danger/30 hover:border-status-danger/50 text-status-danger text-xs font-semibold transition-all overflow-hidden"
                onClick={() => dispatch(uiSliceActions.setModal({ assetId: niaAssets[0]?.asset_id, type: 'withdraw' }))}
              >
                <Upload className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{t('dashboard.withdraw')}</span>
              </button>
              <button
                className="flex items-center justify-center gap-1 px-2 py-2 rounded-xl bg-surface-elevated/60 hover:bg-surface-elevated border border-border-default/40 hover:border-border-default text-content-secondary hover:text-content-primary text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                disabled={isRefreshing}
                onClick={refreshData}
              >
                {isRefreshing
                  ? <LoaderIcon className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                  : <RefreshCw className="w-3.5 h-3.5 flex-shrink-0" />}
                <span className="truncate">{isRefreshing ? t('dashboard.refreshing') : t('dashboard.refresh')}</span>
              </button>
            </div>
          </div>

          {/* Assets Card */}
          <div className="flex-1 min-h-0 flex flex-col bg-surface-overlay rounded-2xl border border-border-default/60 shadow-xl overflow-hidden">
            {/* Card header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-default/40">
              <h3 className="text-base font-bold text-content-primary">{t('dashboard.assets')}</h3>
              <div className="flex items-center gap-2">
                <Button
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
            <div className="grid grid-cols-4 gap-2 text-[11px] font-semibold uppercase tracking-wider text-content-tertiary border-b border-border-default/30">
              <div className="px-4 py-2.5">{t('dashboard.asset')}</div>
              <div className="px-4 py-2.5">{t('dashboard.offChainBalance')}</div>
              <div className="px-4 py-2.5">{t('dashboard.onChainBalance')}</div>
              <div className="px-4 py-2.5 text-center">{t('dashboard.actions')}</div>
            </div>

            {/* Bitcoin row — always first */}
            <div className="group grid grid-cols-4 gap-2 items-center hover:bg-surface-elevated/50 transition-colors border-b border-border-default/20">
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
                {isLoading ? <LoadingPlaceholder /> : (
                  <div className="font-bold">{formatBitcoinAmount(offChainBalance, bitcoinUnit)}</div>
                )}
              </div>
              {/* On-chain */}
              <div className="text-sm py-3 px-4">
                {isLoading ? <LoadingPlaceholder /> : (
                  <div className="font-bold">{formatBitcoinAmount(btcOnChain, bitcoinUnit)}</div>
                )}
              </div>
              {/* Actions */}
              <div className="py-3 px-2 flex justify-center">
                <div className="flex items-center gap-0.5">
                  {[
                    { icon: <Download className="w-3.5 h-3.5" />, label: t('dashboard.deposit'), color: 'text-primary hover:bg-primary/15', onClick: () => dispatch(uiSliceActions.setModal({ assetId: niaAssets[0]?.asset_id, type: 'deposit' })) },
                    { icon: <Upload className="w-3.5 h-3.5" />, label: t('dashboard.withdraw'), color: 'text-status-danger hover:bg-status-danger/15', onClick: () => dispatch(uiSliceActions.setModal({ assetId: niaAssets[0]?.asset_id, type: 'withdraw' })) },
                    { icon: <History className="w-3.5 h-3.5" />, label: t('dashboard.history'), color: 'text-secondary hover:bg-secondary/15', onClick: () => navigate(WALLET_HISTORY_DEPOSITS_PATH) },
                  ].map(({ icon, label, color, onClick }) => (
                    <div key={label} className="relative group/btn">
                      <button
                        className={`p-1.5 rounded-lg transition-colors duration-150 ${color}`}
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
              {niaAssets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-content-tertiary">
                  <Database className="w-10 h-10 mb-3 opacity-40" />
                  <p className="text-sm font-medium">No RGB assets found.</p>
                  <p className="text-xs mt-1 opacity-70">Issue an asset or deposit to get started.</p>
                </div>
              ) : (
                niaAssets.map((asset) => (
                  <AssetRow
                    asset={asset as NiaAsset}
                    key={asset.asset_id}
                    offChainBalance={(assetBalances[asset.asset_id || ''] || {}).offChain || 0}
                    onChainBalance={(assetBalances[asset.asset_id || ''] || {}).onChain || 0}
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
                <h3 className="text-base font-bold text-content-primary">{t('dashboard.lightningChannels')}</h3>
                {channels.length > 0 && (
                  <span className="text-xs font-bold bg-secondary/15 text-secondary border border-secondary/20 rounded-full px-2 py-0.5">
                    {channels.filter(c => c.ready).length}/{channels.length}
                  </span>
                )}
              </div>
              {channels.length > 0 && (
                <span className="text-xs text-status-success flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
                  Online
                </span>
              )}
            </div>

            {/* Node ID row */}
            <div className="flex items-center justify-between bg-surface-elevated/60 px-3 py-2 rounded-lg border border-dashed border-border-default mb-4">
              <div className="flex items-center gap-1.5 min-w-0">
                <Lock className="w-3 h-3 text-content-tertiary flex-shrink-0" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-content-tertiary flex-shrink-0">Node ID</span>
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
                {pubkeyCopied
                  ? <Check className="w-3.5 h-3.5 text-status-success" />
                  : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Channel list — flex-1 scrollable */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 -mr-1">
              {isLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="h-16 bg-surface-elevated/50 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : channels.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center h-full">
                  <Zap className="w-7 h-7 text-content-tertiary mb-2 opacity-50" />
                  <p className="text-xs text-content-tertiary">{t('dashboard.noChannelsFound')}</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {channels.map((ch) => {
                    const asset = assetsMap[ch.asset_id || '']
                    const btcTotal = (ch.outbound_balance_msat || 0) + (ch.inbound_balance_msat || 0)
                    const btcOutPct = btcTotal > 0 ? ((ch.outbound_balance_msat || 0) / btcTotal) * 100 : 50
                    const btcInPct = btcTotal > 0 ? ((ch.inbound_balance_msat || 0) / btcTotal) * 100 : 50
                    const assetTotal = (ch.asset_local_amount || 0) + (ch.asset_remote_amount || 0)
                    const assetOutPct = assetTotal > 0 ? ((ch.asset_local_amount || 0) / assetTotal) * 100 : 50
                    const assetInPct = assetTotal > 0 ? ((ch.asset_remote_amount || 0) / assetTotal) * 100 : 50
                    return (
                      <div key={ch.channel_id} className="group/ch bg-surface-elevated/60 hover:bg-surface-elevated/90 rounded-xl border border-border-subtle/40 hover:border-border-default/50 p-3 transition-all duration-200">
                        {/* Channel header row */}
                        <div className="flex items-center justify-between text-xs mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ch.is_usable ? 'bg-status-success' : 'bg-status-danger'}`} />
                            <span className="text-content-secondary font-medium truncate">
                              {ch.peer_alias || ch.peer_pubkey?.slice(0, 10)}…
                            </span>
                            {asset && (
                              <span className="text-[10px] font-bold text-secondary bg-secondary/10 border border-secondary/20 px-1.5 py-0.5 rounded flex-shrink-0">{asset.ticker}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {ch.ready
                              ? <span className="text-[10px] font-semibold text-status-success border border-status-success/30 px-1.5 py-0.5 rounded uppercase">{t('channelCard.status.open')}</span>
                              : <span className="text-[10px] font-semibold text-amber-400 border border-amber-400/30 px-1.5 py-0.5 rounded uppercase">{t('channelCard.status.pending')}</span>}
                            {ch.public
                              ? <Unlock className="w-3 h-3 text-content-tertiary" />
                              : <Lock className="w-3 h-3 text-secondary/70" />}
                          </div>
                        </div>

                        {/* BTC liquidity bar */}
                        <div className="mb-1.5">
                          <div className="flex items-center justify-between text-[10px] text-content-tertiary mb-0.5 max-h-0 overflow-hidden group-hover/ch:max-h-4 transition-all duration-200">
                            <span className="flex items-center gap-0.5 text-amber-400">
                              <ArrowUpRight className="w-2.5 h-2.5" />
                              {formatBitcoinAmount((ch.outbound_balance_msat || 0) / 1000, bitcoinUnit)}
                            </span>
                            <span className="text-content-tertiary/50 font-medium">BTC</span>
                            <span className="flex items-center gap-0.5 text-blue-400">
                              {formatBitcoinAmount((ch.inbound_balance_msat || 0) / 1000, bitcoinUnit)}
                              <ArrowDownRight className="w-2.5 h-2.5" />
                            </span>
                          </div>
                          <div className="relative h-1.5 bg-surface-high/60 rounded-full overflow-hidden">
                            <div className="absolute left-0 top-0 h-full bg-amber-500 rounded-l-full" style={{ width: `${btcOutPct}%` }} />
                            <div className="absolute right-0 top-0 h-full bg-blue-500 rounded-r-full" style={{ width: `${btcInPct}%` }} />
                            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-surface-high/80" />
                          </div>
                        </div>

                        {/* Asset liquidity bar (if RGB channel) */}
                        {asset && (
                          <div>
                            <div className="flex items-center justify-between text-[10px] text-content-tertiary mb-0.5 max-h-0 overflow-hidden group-hover/ch:max-h-4 transition-all duration-200">
                              <span className="flex items-center gap-0.5 text-indigo-400">
                                <ArrowUpRight className="w-2.5 h-2.5" />
                                {ch.asset_local_amount || 0}
                              </span>
                              <span className="text-secondary/70 font-medium">{asset.ticker}</span>
                              <span className="flex items-center gap-0.5 text-fuchsia-400">
                                {ch.asset_remote_amount || 0}
                                <ArrowDownRight className="w-2.5 h-2.5" />
                              </span>
                            </div>
                            <div className="relative h-1.5 bg-surface-high/60 rounded-full overflow-hidden">
                              <div className="absolute left-0 top-0 h-full bg-indigo-500 rounded-l-full" style={{ width: `${assetOutPct}%` }} />
                              <div className="absolute right-0 top-0 h-full bg-fuchsia-500 rounded-r-full" style={{ width: `${assetInPct}%` }} />
                              <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-surface-high/80" />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Liquidity totals */}
            {channels.length > 0 && !isLoading && (
              <div className="border-t border-border-default/40 mt-4 pt-3">
                <div className="flex justify-between text-xs text-content-tertiary mb-1.5">
                  <span className="flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3 text-amber-400" />
                    {formatBitcoinAmount(totalOutboundLiquidity, bitcoinUnit)} {bitcoinUnit}
                  </span>
                  <span className="flex items-center gap-1">
                    {formatBitcoinAmount(totalInboundLiquidity, bitcoinUnit)} {bitcoinUnit}
                    <ArrowDownRight className="w-3 h-3 text-blue-400" />
                  </span>
                </div>
                <div className="relative w-full bg-surface-elevated/60 rounded-full h-1.5 overflow-hidden">
                  <div className="absolute left-0 top-0 h-full bg-amber-500 rounded-l-full transition-all duration-500" style={{ width: `${outboundPct}%` }} />
                  <div className="absolute right-0 top-0 h-full bg-blue-500 rounded-r-full transition-all duration-500" style={{ width: `${inboundPct}%` }} />
                  <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-surface-high/80" />
                </div>
              </div>
            )}

            {/* Action strip */}
            <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-border-default/40">
              {/* Primary: Manage */}
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors flex-shrink-0"
                onClick={() => navigate(CHANNELS_PATH)}
              >
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                {t('dashboard.manage')}
              </button>
              <div className="flex-1" />
              {/* Secondary: icon-only */}
              {[
                { icon: <Plus className="w-3.5 h-3.5" />, label: t('dashboard.openChannel'), onClick: () => navigate(CREATE_NEW_CHANNEL_PATH) },
                { icon: <ShoppingCart className="w-3.5 h-3.5" />, label: t('channels.buyChannel'), onClick: () => navigate(ORDER_CHANNEL_PATH) },
                { icon: <Users className="w-3.5 h-3.5" />, label: t('dashboard.peers'), onClick: () => setShowPeerModal(true) },
              ].map(({ icon, label, onClick }) => (
                <div key={label} className="relative group/act">
                  <button
                    className="p-1.5 rounded-lg hover:bg-surface-elevated text-content-tertiary hover:text-content-primary transition-colors"
                    onClick={onClick}
                    title={label}
                  >
                    {icon}
                  </button>
                  <div className="absolute bottom-full mb-1.5 right-0 bg-surface-high text-content-primary text-[10px] rounded-md py-0.5 px-1.5 opacity-0 group-hover/act:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-border-default/40 shadow-lg z-20">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 text-xs text-content-tertiary px-1 mt-2">
        <Info className="h-3 w-3 flex-shrink-0" />
        <p>{t('dashboard.liquidityInfo')}</p>
      </div>
    </div>
  )
}
