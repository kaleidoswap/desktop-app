import {
  TrendingUp,
  Zap,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  Network,
  Users,
  Plus,
  Coins,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  Copy,
  Check,
  Settings,
  ArrowLeftRight,
  Palette,
  Wallet,
  Sparkles,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

import {
  CREATE_NEW_CHANNEL_PATH,
  ORDER_CHANNEL_PATH,
  TRADE_MARKET_MAKER_PATH,
  CHANNELS_PATH,
} from '../../app/router/paths'
import { useAppDispatch, useAppSelector } from '../../app/store/hooks'
import bitcoinLogo from '../../assets/bitcoin-logo.svg'
import defaultRgbIcon from '../../assets/rgb-symbol-color.svg'
import sparkLogo from '../../assets/spark-logo.svg'
import { IssueAssetModal } from '../../components/IssueAssetModal'
import { PeerManagementModal } from '../../components/PeerManagementModal'
import { Button, Card, LoadingPlaceholder } from '../../components/ui'
import { UTXOManagementModal } from '../../components/UTXOManagementModal'
import { UnifiedDepositWithdrawModal } from '../../components/WalletActions'
import { formatBitcoinAmount } from '../../helpers/number'
import { useAssetIcon } from '../../helpers/utils'
import { nodeApi, NiaAsset } from '../../slices/nodeApi/nodeApi.slice'
import { uiSliceActions } from '../../slices/ui/ui.slice'

// Asset Icon Component
const AssetIconImg: React.FC<{ ticker: string; className?: string }> = ({
  ticker,
  className = 'h-8 w-8',
}) => {
  const [imgSrc, setImgSrc] = useAssetIcon(ticker, defaultRgbIcon)

  return (
    <img
      alt={`${ticker} icon`}
      className={className}
      onError={() => setImgSrc(defaultRgbIcon)}
      src={imgSrc}
    />
  )
}

// Asset Card Component
interface AssetCardProps {
  asset: NiaAsset
  balance?: { offChain: number; onChain: number }
  onSpend: () => void
  onReceive: () => void
  onSwap: () => void
}

const AssetCard: React.FC<AssetCardProps> = ({
  asset,
  balance,
  onSpend,
  onReceive,
  onSwap,
}) => {
  const totalAssetBalance = (balance?.onChain || 0) + (balance?.offChain || 0)

  return (
    <div className="flex items-center justify-between p-4 bg-slate-950/50 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-all group">
      <div className="flex items-center gap-4">
        <div className="p-2 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-lg">
          <AssetIconImg className="w-8 h-8" ticker={asset.ticker} />
        </div>
        <div>
          <div className="font-semibold text-white group-hover:text-cyan-400 transition-colors">
            {asset.name}
          </div>
          <div className="text-sm text-slate-400">{asset.ticker}</div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="font-bold text-white text-lg">
            {(totalAssetBalance / Math.pow(10, asset.precision)).toFixed(
              asset.precision
            )}
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span>
              On-chain:{' '}
              {(
                (balance?.onChain || 0) / Math.pow(10, asset.precision)
              ).toFixed(2)}
            </span>
            <span className="text-slate-600">•</span>
            <span>
              LN:{' '}
              {(
                (balance?.offChain || 0) / Math.pow(10, asset.precision)
              ).toFixed(2)}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg transition-colors text-sm font-medium"
            onClick={onReceive}
            title="Receive"
          >
            <ArrowDownRight className="w-4 h-4" />
            Receive
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors text-sm font-medium"
            onClick={onSpend}
            title="Spend"
          >
            <ArrowUpRight className="w-4 h-4" />
            Spend
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors text-sm font-medium"
            onClick={onSwap}
            title="Swap"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Swap
          </button>
        </div>
      </div>
    </div>
  )
}

export const DashboardV2 = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const [assets, assetsResponse] = nodeApi.endpoints.listAssets.useLazyQuery()
  const [btcBalance, btcBalanceResponse] =
    nodeApi.endpoints.btcBalance.useLazyQuery()
  const [listChannels, listChannelsResponse] =
    nodeApi.endpoints.listChannels.useLazyQuery()
  const [nodeInfo, nodeInfoResponse] = nodeApi.endpoints.nodeInfo.useLazyQuery()
  const [networkInfo, networkInfoResponse] =
    nodeApi.endpoints.networkInfo.useLazyQuery()
  const [assetBalance] = nodeApi.endpoints.assetBalance.useLazyQuery()
  const [refreshTransfers] =
    nodeApi.endpoints.refreshRgbTransfers.useLazyQuery()
  const [sync] = nodeApi.endpoints.sync.useLazyQuery()

  const bitcoinUnit = useAppSelector((state) => state.settings.bitcoinUnit)
  const sparkInfo = useAppSelector((state) => state.spark.info)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showUnifiedModal, setShowUnifiedModal] = useState(false)
  const [modalAction, setModalAction] = useState<'deposit' | 'withdraw'>(
    'deposit'
  )
  const [assetBalances, setAssetBalances] = useState<
    Record<string, { offChain: number; onChain: number }>
  >({})
  const [copiedPubkey, setCopiedPubkey] = useState(false)
  const [showUTXOModal, setShowUTXOModal] = useState(false)
  const [showPeerModal, setShowPeerModal] = useState(false)
  const [showIssueAssetModal, setShowIssueAssetModal] = useState(false)
  const [assetFilter, setAssetFilter] = useState<'all' | 'rgb' | 'spark'>('all')
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [showChannelDetails, setShowChannelDetails] = useState(false)

  const refreshData = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([
        assets(),
        listChannels(),
        btcBalance({ skip_sync: false }),
        refreshTransfers({ skip_sync: false }),
        sync(),
        nodeInfo(),
        networkInfo(),
      ])
    } finally {
      setIsRefreshing(false)
    }
  }, [
    assets,
    btcBalance,
    listChannels,
    refreshTransfers,
    sync,
    nodeInfo,
    networkInfo,
  ])

  useEffect(() => {
    refreshData()
  }, [refreshData])

  // Calculate balances
  useEffect(() => {
    const fetchAssetBalances = async () => {
      if (!assetsResponse.data?.nia) return

      const balances: Record<string, { offChain: number; onChain: number }> = {}

      for (const asset of assetsResponse.data.nia) {
        try {
          const balance = await assetBalance({
            asset_id: asset.asset_id,
          }).unwrap()
          balances[asset.asset_id] = {
            offChain: balance.offchain_outbound || 0,
            onChain: balance.spendable || 0,
          }
        } catch (error) {
          console.error(`Failed to fetch balance for ${asset.asset_id}:`, error)
        }
      }

      setAssetBalances(balances)
    }

    fetchAssetBalances()
  }, [assetsResponse.data, assetBalance])

  const onChainBalance = btcBalanceResponse.data?.vanilla.spendable || 0
  const onChainColoredBalance = btcBalanceResponse.data?.colored.spendable || 0
  const channels = listChannelsResponse?.data?.channels || []
  const offChainBalance = channels.reduce(
    (sum, channel) => sum + channel.local_balance_sat,
    0
  )
  const sparkBalance = sparkInfo?.balanceSats || 0
  const totalBalance =
    offChainBalance + onChainBalance + onChainColoredBalance + sparkBalance

  const isLoading =
    btcBalanceResponse.isLoading || listChannelsResponse.isLoading

  const rgbAssets = (assetsResponse.data?.nia || []).filter(
    (asset) => asset.ticker !== 'BTC'
  )

  const handleOpenDepositWithdraw = (action: 'deposit' | 'withdraw') => {
    setModalAction(action)
    setShowUnifiedModal(true)
  }

  const handleCopyPubkey = () => {
    if (nodeInfoResponse.data?.pubkey) {
      navigator.clipboard.writeText(nodeInfoResponse.data.pubkey)
      setCopiedPubkey(true)
      toast.success('Node public key copied to clipboard')
      setTimeout(() => setCopiedPubkey(false), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Hero Balance Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500/20 via-blue-500/15 to-purple-500/20 border border-cyan-500/30 p-8 shadow-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(6,182,212,0.15),transparent_70%)] pointer-events-none" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl" />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-cyan-500/30 to-blue-500/30 rounded-xl">
                  <TrendingUp className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <div className="text-sm text-slate-400 mb-0.5">
                    Total Balance
                  </div>
                  <div className="text-xs text-slate-500">
                    All wallets combined
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border-green-500/30"
                  icon={<ArrowDownRight className="w-4 h-4" />}
                  onClick={() => handleOpenDepositWithdraw('deposit')}
                  size="sm"
                >
                  Deposit
                </Button>
                <Button
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30"
                  icon={<ArrowUpRight className="w-4 h-4" />}
                  onClick={() => handleOpenDepositWithdraw('withdraw')}
                  size="sm"
                >
                  Withdraw
                </Button>
                <Button
                  disabled={isRefreshing}
                  icon={
                    <RefreshCw
                      className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
                    />
                  }
                  onClick={refreshData}
                  size="sm"
                  variant="outline"
                >
                  {isRefreshing ? 'Refreshing' : 'Refresh'}
                </Button>
              </div>
            </div>

            {isLoading ? (
              <LoadingPlaceholder width="w-96" />
            ) : (
              <div className="mb-8">
                <div className="text-6xl font-bold text-white mb-3 tracking-tight">
                  {totalBalance.toLocaleString()}
                  <span className="text-3xl text-cyan-400 ml-2">sats</span>
                </div>
                <div className="text-xl text-slate-300">
                  ≈ {formatBitcoinAmount(totalBalance, bitcoinUnit)}{' '}
                  {bitcoinUnit}
                </div>
              </div>
            )}

            {/* Compact Balance Breakdown */}
            <div className="grid grid-cols-3 gap-3">
              <div className="group relative bg-slate-900/60 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50 hover:border-orange-500/50 transition-all cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 to-orange-500/0 group-hover:from-orange-500/5 group-hover:to-orange-500/10 rounded-xl transition-all" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-orange-500/20 rounded-lg">
                      <img
                        alt="Bitcoin"
                        className="w-4 h-4"
                        src={bitcoinLogo}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-300">
                      On-Chain
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">
                    {isLoading ? (
                      <LoadingPlaceholder />
                    ) : (
                      `${Math.round((onChainBalance + onChainColoredBalance) / 1000)}k`
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    {(onChainBalance + onChainColoredBalance).toLocaleString()}{' '}
                    sats
                  </div>
                </div>
              </div>

              <div className="group relative bg-slate-900/60 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50 hover:border-yellow-500/50 transition-all cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/0 to-yellow-500/0 group-hover:from-yellow-500/5 group-hover:to-yellow-500/10 rounded-xl transition-all" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-yellow-500/20 rounded-lg">
                      <Zap className="w-4 h-4 text-yellow-400" />
                    </div>
                    <span className="text-xs font-medium text-slate-300">
                      Lightning
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">
                    {isLoading ? (
                      <LoadingPlaceholder />
                    ) : (
                      `${Math.round(offChainBalance / 1000)}k`
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    {offChainBalance.toLocaleString()} sats
                  </div>
                </div>
              </div>

              <div className="group relative bg-slate-900/60 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50 hover:border-purple-500/50 transition-all cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-purple-500/0 group-hover:from-purple-500/5 group-hover:to-purple-500/10 rounded-xl transition-all" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-purple-500/20 rounded-lg">
                      <img alt="Spark" className="w-4 h-4" src={sparkLogo} />
                    </div>
                    <span className="text-xs font-medium text-slate-300">
                      Spark
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">
                    {sparkBalance > 0
                      ? `${Math.round(sparkBalance / 1000)}k`
                      : '0'}
                  </div>
                  <div className="text-xs text-slate-400">
                    {sparkBalance.toLocaleString()} sats
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* RLN Network Card */}
          <Card className="bg-slate-900/60 border-cyan-500/30 hover:border-cyan-500/50 hover:shadow-cyan-500/20 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Network className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-semibold text-slate-200">
                  RLN Network
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs text-slate-400">Connected</span>
              </div>
            </div>
            {isLoading ? (
              <LoadingPlaceholder height="h-20" width="w-full" />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Network</span>
                  <span className="text-slate-200 font-medium">
                    {networkInfoResponse.data?.network || 'Unknown'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Block Height</span>
                  <span className="text-slate-200 font-medium">
                    {networkInfoResponse.data?.height?.toLocaleString() || '—'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-slate-400">Pubkey:</span>
                  <span className="text-slate-500 font-mono truncate flex-1">
                    {nodeInfoResponse.data?.pubkey?.substring(0, 20)}...
                  </span>
                  <button
                    className="p-1 hover:bg-slate-700/50 rounded transition-colors"
                    onClick={handleCopyPubkey}
                    title="Copy full pubkey"
                  >
                    {copiedPubkey ? (
                      <Check className="w-3 h-3 text-green-400" />
                    ) : (
                      <Copy className="w-3 h-3 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </Card>

          {/* Channels Card with Liquidity Bar */}
          <Card className="bg-slate-900/60 border-yellow-500/30 hover:border-yellow-500/50 hover:shadow-yellow-500/20 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                <h3 className="text-lg font-semibold text-slate-200">
                  Channels
                </h3>
              </div>
              <button
                className="text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1"
                onClick={() => setShowChannelDetails(!showChannelDetails)}
              >
                {showChannelDetails ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
                {showChannelDetails ? 'Hide' : 'Details'}
              </button>
            </div>
            {isLoading ? (
              <LoadingPlaceholder height="h-20" width="w-full" />
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div>
                    <div className="text-lg font-bold text-white">
                      {channels?.length || 0}
                    </div>
                    <div className="text-xs text-slate-400">Total</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-green-400">
                      {channels?.filter((c) => c.ready).length || 0}
                    </div>
                    <div className="text-xs text-slate-400">Active</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">
                      {Math.round(
                        channels.reduce((sum, c) => sum + c.capacity_sat, 0) /
                          1000
                      )}
                      k
                    </div>
                    <div className="text-xs text-slate-400">Capacity</div>
                  </div>
                </div>

                {/* Liquidity Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Local</span>
                    <span>Remote</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400"
                      style={{
                        width: `${
                          channels.length > 0
                            ? (offChainBalance /
                                channels.reduce(
                                  (sum, c) => sum + c.capacity_sat,
                                  0
                                )) *
                              100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>{offChainBalance.toLocaleString()} sats</span>
                    <span>
                      {(
                        channels.reduce((sum, c) => sum + c.capacity_sat, 0) -
                        offChainBalance
                      ).toLocaleString()}{' '}
                      sats
                    </span>
                  </div>
                </div>

                {showChannelDetails && (
                  <div className="space-y-2 max-h-32 overflow-y-auto mt-3 pt-3 border-t border-slate-700">
                    {channels.map((channel) => (
                      <div
                        className="flex items-center justify-between p-2 bg-slate-950/50 rounded text-xs"
                        key={channel.channel_id}
                      >
                        <div className="flex-1 truncate">
                          <div className="font-mono text-white truncate">
                            {channel.channel_id.slice(0, 16)}...
                          </div>
                          <div className="text-slate-400">
                            {channel.local_balance_sat.toLocaleString()} sats
                          </div>
                        </div>
                        <div
                          className={`w-2 h-2 rounded-full ${channel.ready ? 'bg-green-500' : 'bg-yellow-500'}`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs"
                    icon={<Plus className="w-3 h-3" />}
                    onClick={() => navigate(CREATE_NEW_CHANNEL_PATH)}
                    size="sm"
                  >
                    Open
                  </Button>
                  <Button
                    className="flex-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs"
                    icon={<ShoppingCart className="w-3 h-3" />}
                    onClick={() => navigate(ORDER_CHANNEL_PATH)}
                    size="sm"
                  >
                    Buy
                  </Button>
                  <Button
                    className="flex-1 bg-slate-700/50 hover:bg-slate-700 text-slate-300 border-slate-600 text-xs"
                    icon={<Settings className="w-3 h-3" />}
                    onClick={() => navigate(CHANNELS_PATH)}
                    size="sm"
                  >
                    Manage
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Advanced Settings - Collapsible */}
        <Card className="bg-slate-900/60 border-slate-700">
          <button
            className="w-full flex items-center justify-between"
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
          >
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-slate-400" />
              <h3 className="text-lg font-semibold text-slate-200">
                Advanced Settings
              </h3>
            </div>
            {showAdvancedSettings ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {showAdvancedSettings && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-700">
              {/* RGB Settings */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Palette className="w-4 h-4 text-orange-400" />
                  <h4 className="text-sm font-semibold text-slate-300">
                    RGB Settings
                  </h4>
                </div>
                <Button
                  className="w-full bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs"
                  icon={<Wallet className="w-3 h-3" />}
                  onClick={() => setShowUTXOModal(true)}
                  size="sm"
                >
                  Manage UTXOs
                </Button>
                <Button
                  className="w-full bg-slate-700/50 hover:bg-slate-700 text-slate-300 border-slate-600 text-xs"
                  icon={<Users className="w-3 h-3" />}
                  onClick={() => setShowPeerModal(true)}
                  size="sm"
                >
                  Manage Peers
                </Button>
              </div>

              {/* Spark Settings */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <h4 className="text-sm font-semibold text-slate-300">
                    Spark Settings
                  </h4>
                </div>
                <Button
                  className="w-full bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs"
                  disabled
                  icon={<Settings className="w-3 h-3" />}
                  onClick={() => toast.info('Spark settings coming soon')}
                  size="sm"
                >
                  Configure Spark
                </Button>
                <Button
                  className="w-full bg-slate-700/50 hover:bg-slate-700 text-slate-300 border-slate-600 text-xs"
                  disabled
                  icon={<Wallet className="w-3 h-3" />}
                  onClick={() =>
                    toast.info('Spark wallet management coming soon')
                  }
                  size="sm"
                >
                  Manage Wallets
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Assets Section */}
        {rgbAssets.length > 0 && (
          <Card className="bg-slate-900/50 border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-white text-lg">
                  Your Assets
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  className="bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/30 text-xs"
                  icon={<Plus className="w-3 h-3" />}
                  onClick={() => setShowIssueAssetModal(true)}
                  size="sm"
                >
                  Issue Asset
                </Button>
                {/* Asset Filter */}
                <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
                  <button
                    className={`px-3 py-1 text-xs rounded-md transition-all ${
                      assetFilter === 'all'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'text-slate-400 hover:text-slate-300'
                    }`}
                    onClick={() => setAssetFilter('all')}
                  >
                    All
                  </button>
                  <button
                    className={`px-3 py-1 text-xs rounded-md transition-all ${
                      assetFilter === 'rgb'
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                        : 'text-slate-400 hover:text-slate-300'
                    }`}
                    onClick={() => setAssetFilter('rgb')}
                  >
                    RGB
                  </button>
                  <button
                    className={`px-3 py-1 text-xs rounded-md transition-all ${
                      assetFilter === 'spark'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'text-slate-400 hover:text-slate-300'
                    }`}
                    onClick={() => setAssetFilter('spark')}
                  >
                    Spark
                  </button>
                </div>
                <Button
                  className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs"
                  icon={<ArrowLeftRight className="w-3 h-3" />}
                  onClick={() => navigate(TRADE_MARKET_MAKER_PATH)}
                  size="sm"
                >
                  Swaps
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {rgbAssets
                .filter(() => {
                  if (assetFilter === 'rgb') return true // All current assets are RGB
                  if (assetFilter === 'spark') return false // No Spark assets yet
                  return true // 'all' filter
                })
                .map((asset) => (
                  <AssetCard
                    asset={asset}
                    balance={assetBalances[asset.asset_id]}
                    key={asset.asset_id}
                    onReceive={() => {
                      dispatch(
                        uiSliceActions.setModal({
                          assetId: asset.asset_id,
                          type: 'deposit',
                        })
                      )
                    }}
                    onSpend={() => {
                      dispatch(
                        uiSliceActions.setModal({
                          assetId: asset.asset_id,
                          type: 'withdraw',
                        })
                      )
                    }}
                    onSwap={() => {
                      navigate(TRADE_MARKET_MAKER_PATH)
                    }}
                  />
                ))}
              {assetFilter === 'spark' && (
                <div className="text-center text-sm text-slate-400 py-8">
                  No Spark assets yet
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Modals */}
      {showUTXOModal && (
        <UTXOManagementModal
          bitcoinUnit={bitcoinUnit}
          onClose={() => setShowUTXOModal(false)}
        />
      )}

      {showPeerModal && (
        <PeerManagementModal onClose={() => setShowPeerModal(false)} />
      )}

      {showIssueAssetModal && (
        <IssueAssetModal
          onClose={() => setShowIssueAssetModal(false)}
          onSuccess={refreshData}
        />
      )}

      {/* Unified Modal */}
      {showUnifiedModal && (
        <UnifiedDepositWithdrawModal
          defaultAction={modalAction}
          onClose={() => setShowUnifiedModal(false)}
        />
      )}
    </div>
  )
}
