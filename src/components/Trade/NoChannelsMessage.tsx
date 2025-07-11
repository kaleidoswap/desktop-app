import { openUrl } from '@tauri-apps/plugin-opener'
import {
  Link,
  Plus,
  ShoppingCart,
  HelpCircle,
  Wallet,
  ExternalLink,
  RefreshCcw,
  Globe,
  Clock,
} from 'lucide-react'
import React from 'react'

import {
  CREATE_NEW_CHANNEL_PATH,
  ORDER_CHANNEL_PATH,
} from '../../app/router/paths'
import { useAppDispatch } from '../../app/store/hooks'
import { TradingPair } from '../../slices/makerApi/makerApi.slice'
import { uiSliceActions } from '../../slices/ui/ui.slice'

import { MakerSelector } from './MakerSelector'
import {
  TradablePairsDisplay,
  SupportedAssetsDisplay,
} from './TradablePairsDisplay'

interface NoChannelsMessageProps {
  onNavigate: (path: string) => void
  onMakerChange: () => Promise<void>
  hasEnoughBalance?: boolean
}

export const NoChannelsMessage: React.FC<NoChannelsMessageProps> = ({
  onNavigate,
  hasEnoughBalance = true,
}) => {
  const dispatch = useAppDispatch()

  const handleShowDepositModal = () => {
    dispatch(uiSliceActions.setModal({ assetId: undefined, type: 'deposit' }))
  }

  if (!hasEnoughBalance) {
    return (
      <div className="max-w-2xl w-full bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800/50 p-8">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
            <Wallet className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-white">
            Insufficient Bitcoin Balance
          </h2>
          <p className="text-slate-400 text-center text-base max-w-md">
            You need some bitcoin to open a channel. Please deposit some BTC to
            get started.
          </p>

          <div className="flex gap-3 pt-4">
            <button
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl 
                     font-medium transition-colors flex items-center gap-2 text-base"
              onClick={handleShowDepositModal}
            >
              <Wallet className="w-5 h-5" />
              Deposit BTC
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl w-full bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800/50 p-8">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center">
          <Link className="w-8 h-8 text-blue-500" />
        </div>
        <h2 className="text-2xl font-bold text-white">
          No RGB Channels Available
        </h2>
        <p className="text-slate-400 text-center text-base max-w-md">
          To start swapping, you need to a channel with some assets
        </p>

        <div className="flex gap-4 pt-4">
          <button
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl 
                     font-medium transition-colors flex items-center gap-2 text-base"
            onClick={() => onNavigate(CREATE_NEW_CHANNEL_PATH)}
          >
            <Plus className="w-5 h-5" />
            Open Channel
          </button>
          <button
            className="px-6 py-3 border border-blue-500/50 text-blue-500 rounded-xl 
                     hover:bg-blue-500/10 transition-colors flex items-center gap-2 text-base"
            onClick={() => onNavigate(ORDER_CHANNEL_PATH)}
          >
            <ShoppingCart className="w-5 h-5" />
            Buy from LSP
          </button>
        </div>
      </div>
    </div>
  )
}

interface MakerAssetInfo {
  supportedAssets: string[]
  registryUrl: string
  tradingPairs: TradingPair[]
}

interface UserAssetInfo {
  ownedAssets: string[]
  hasEnoughBalance: boolean
}

interface ActionConfig {
  recommendedAction: 'open' | 'buy' | 'both'
  onNavigate: (path: string) => void
  onMakerChange: () => Promise<void>
}

interface NoTradingChannelsMessageProps {
  makerInfo: MakerAssetInfo
  userInfo: UserAssetInfo
  actions: ActionConfig
}

export const NoTradingChannelsMessage: React.FC<
  NoTradingChannelsMessageProps
> = ({ makerInfo, userInfo, actions }) => {
  const { supportedAssets, registryUrl, tradingPairs } = makerInfo
  const { ownedAssets, hasEnoughBalance } = userInfo
  const { recommendedAction, onNavigate, onMakerChange } = actions

  const dispatch = useAppDispatch()

  const handleShowDepositModal = () => {
    dispatch(uiSliceActions.setModal({ assetId: undefined, type: 'deposit' }))
  }

  if (!hasEnoughBalance) {
    return (
      <div className="max-w-2xl w-full bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800/50 p-6">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center">
            <Wallet className="w-6 h-6 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-white">
            Insufficient Bitcoin Balance
          </h2>
          <p className="text-slate-400 text-center text-sm max-w-md">
            You need bitcoin to open a trading channel.
          </p>

          <button
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl 
                   font-medium transition-colors flex items-center gap-2 text-sm mt-1"
            onClick={handleShowDepositModal}
          >
            <Wallet className="w-4 h-4" />
            Deposit BTC
          </button>
        </div>
      </div>
    )
  }

  const hasCompatibleAssets = ownedAssets.some((asset) =>
    supportedAssets.includes(asset)
  )

  const primaryAction = hasCompatibleAssets
    ? 'open'
    : recommendedAction !== 'both'
      ? recommendedAction
      : 'buy'

  const getRecommendationMessage = () => {
    if (hasCompatibleAssets) {
      return 'You already have assets compatible with this market maker. You can open a channel directly.'
    } else if (recommendedAction === 'buy') {
      return 'For the quickest start, we recommend buying a channel from an LSP with assets supported by this maker.'
    } else if (recommendedAction === 'open') {
      return 'This market maker supports specific assets. You can open a channel with these assets.'
    }
    return 'To trade with this market maker, you need a channel with one of its supported assets.'
  }

  return (
    <div className="w-full h-full min-h-[calc(100vh-120px)] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative flex flex-col">
      {/* Ultra Modern Background Enhancement */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/20 via-transparent to-purple-950/20 pointer-events-none"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.1),transparent_50%)] pointer-events-none"></div>

      {/* Main Content Area */}
      <div className="flex-1 relative z-10 flex flex-col items-center justify-start p-6">
        <div className="w-full max-w-6xl">
          {/* Market Maker Selector - Now at the top level */}
          <div className="relative z-50 mb-8">
            <div className="bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-600/50 p-6 shadow-2xl max-w-md mx-auto">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-cyan-400/2 to-transparent rounded-3xl pointer-events-none"></div>
              <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse"></div>
                  <h3 className="text-lg font-bold text-white">Market Maker</h3>
                </div>
                <div className="flex-shrink-0">
                  <MakerSelector onMakerChange={onMakerChange} />
                </div>
              </div>
            </div>
          </div>

          {/* Content Container - Lower z-index than maker selector */}
          <div className="relative z-40">
            {/* Hero Section */}
            <div className="text-center mb-12">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500/20 via-cyan-500/15 to-blue-500/20 rounded-3xl flex items-center justify-center border border-blue-500/30 backdrop-blur-sm shadow-2xl">
                  <div className="relative">
                    <Link className="w-10 h-10 text-blue-400" />
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-500/30 rounded-full animate-pulse"></div>
                  </div>
                </div>
              </div>

              <h1 className="text-5xl lg:text-6xl font-bold bg-gradient-to-r from-white via-cyan-100 to-blue-100 bg-clip-text text-transparent leading-tight mb-4">
                No Trading Channels Available
              </h1>

              <p className="text-xl text-slate-300 leading-relaxed max-w-3xl mx-auto mb-8">
                {getRecommendationMessage()}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                {primaryAction === 'buy' ? (
                  <>
                    <button
                      className="group relative px-10 py-4 bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-2xl font-bold text-xl transition-all duration-300 flex items-center justify-center gap-3 shadow-2xl hover:shadow-emerald-500/25 hover:scale-105 backdrop-blur-sm min-w-[200px]"
                      onClick={() => onNavigate(ORDER_CHANNEL_PATH)}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-white/10 to-white/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <ShoppingCart className="w-6 h-6 relative z-10" />
                      <span className="relative z-10">Buy Channel</span>
                    </button>
                    {recommendedAction === 'both' && (
                      <button
                        className="group relative px-10 py-4 border-2 border-blue-500/70 hover:border-blue-400 text-blue-400 hover:text-blue-300 rounded-2xl font-bold text-xl transition-all duration-300 flex items-center justify-center gap-3 shadow-xl hover:shadow-blue-500/25 hover:scale-105 backdrop-blur-sm hover:bg-blue-500/10 min-w-[200px]"
                        onClick={() => onNavigate(CREATE_NEW_CHANNEL_PATH)}
                      >
                        <Plus className="w-6 h-6" />
                        Open Channel
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      className="group relative px-10 py-4 bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-2xl font-bold text-xl transition-all duration-300 flex items-center justify-center gap-3 shadow-2xl hover:shadow-blue-500/25 hover:scale-105 backdrop-blur-sm min-w-[200px]"
                      onClick={() => onNavigate(CREATE_NEW_CHANNEL_PATH)}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-white/10 to-white/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <Plus className="w-6 h-6 relative z-10" />
                      <span className="relative z-10">Open Channel</span>
                    </button>
                    {recommendedAction === 'both' && (
                      <button
                        className="group relative px-10 py-4 border-2 border-emerald-500/70 hover:border-emerald-400 text-emerald-400 hover:text-emerald-300 rounded-2xl font-bold text-xl transition-all duration-300 flex items-center justify-center gap-3 shadow-xl hover:shadow-emerald-500/25 hover:scale-105 backdrop-blur-sm hover:bg-emerald-500/10 min-w-[200px]"
                        onClick={() => onNavigate(ORDER_CHANNEL_PATH)}
                      >
                        <ShoppingCart className="w-6 h-6" />
                        Buy Channel
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Information Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto mt-12">
                {tradingPairs.length > 0 ? (
                  <>
                    <div className="bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-600/50 p-6 shadow-2xl">
                      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-purple-400/2 to-transparent rounded-3xl pointer-events-none"></div>
                      <div className="relative">
                        <TradablePairsDisplay
                          maxPairsToShow={8}
                          pairs={tradingPairs}
                          title="Available Trading Pairs"
                        />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-600/50 p-6 shadow-2xl">
                      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-cyan-400/2 to-transparent rounded-3xl pointer-events-none"></div>
                      <div className="relative">
                        <SupportedAssetsDisplay
                          pairs={tradingPairs}
                          title="Supported Assets"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="lg:col-span-2">
                    <div className="bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-600/50 p-8 shadow-2xl">
                      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-blue-400/2 to-transparent rounded-3xl pointer-events-none"></div>
                      <div className="relative">
                        <div className="text-center mb-8">
                          <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 via-cyan-500/15 to-blue-500/20 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-blue-500/30 shadow-2xl">
                            <HelpCircle className="w-8 h-8 text-blue-400" />
                          </div>
                          <h3 className="text-3xl font-bold text-white mb-3 bg-gradient-to-r from-white via-blue-100 to-cyan-100 bg-clip-text text-transparent">
                            Quick Start Guide
                          </h3>
                          <p className="text-slate-400 text-lg leading-relaxed">
                            Follow these steps to start trading with RGB assets
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="group text-center p-6 rounded-2xl hover:bg-slate-800/40 transition-all duration-300">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/30 via-cyan-500/25 to-blue-500/30 text-blue-300 flex items-center justify-center mx-auto mb-4 text-xl font-bold border border-blue-500/40 shadow-lg">
                              1
                            </div>
                            <button
                              className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-2 font-semibold text-lg group-hover:scale-105 transition-all duration-300 mb-2"
                              onClick={() => openUrl(registryUrl)}
                            >
                              Check supported assets
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            <p className="text-slate-400 text-sm">
                              Visit the registry to see what assets this maker
                              supports
                            </p>
                          </div>

                          <div className="group text-center p-6 rounded-2xl hover:bg-slate-800/40 transition-all duration-300">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500/30 via-green-500/25 to-emerald-500/30 text-emerald-300 flex items-center justify-center mx-auto mb-4 text-xl font-bold border border-emerald-500/40 shadow-lg">
                              2
                            </div>
                            <h4 className="font-semibold text-lg text-white mb-2">
                              Create Your Channel
                            </h4>
                            <p className="text-slate-400 text-sm">
                              Buy a channel from an LSP or open one directly
                              with your assets
                            </p>
                          </div>

                          <div className="group text-center p-6 rounded-2xl hover:bg-slate-800/40 transition-all duration-300">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/30 via-pink-500/25 to-purple-500/30 text-purple-300 flex items-center justify-center mx-auto mb-4 text-xl font-bold border border-purple-500/40 shadow-lg">
                              3
                            </div>
                            <h4 className="font-semibold text-lg text-white mb-2">
                              Start Trading
                            </h4>
                            <p className="text-slate-400 text-sm">
                              Return here once your channel is active to begin
                              trading
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const createTradingChannelsMessageProps = (
  assets: { ticker: string; asset_id: string }[],
  tradablePairs: TradingPair[],
  hasEnoughBalance: boolean,
  onNavigate: (path: string) => void,
  onMakerChange: () => Promise<void>
): NoTradingChannelsMessageProps => {
  const supportedAssets = tradablePairs
    .flatMap((pair) => [pair.base_asset, pair.quote_asset])
    .filter((v, i, a) => a.indexOf(v) === i)

  const ownedAssets = assets.map((asset) => asset.asset_id)

  const hasCompatibleAssets = ownedAssets.some((asset) =>
    supportedAssets.includes(asset)
  )

  const registryUrl = 'https://registry.kaleidoswap.com'

  return {
    actions: {
      onMakerChange,
      onNavigate,
      recommendedAction: hasCompatibleAssets ? 'open' : 'buy',
    },
    makerInfo: {
      registryUrl,
      supportedAssets,
      tradingPairs: tradablePairs,
    },
    userInfo: {
      hasEnoughBalance,
      ownedAssets,
    },
  }
}

// New component for when WebSocket is disconnected but channels are available
interface WebSocketDisconnectedMessageProps {
  onMakerChange: () => Promise<void>
  onRetryConnection: () => Promise<void>
  makerUrl: string | null
}

export const WebSocketDisconnectedMessage: React.FC<
  WebSocketDisconnectedMessageProps
> = ({ onMakerChange, onRetryConnection, makerUrl }) => {
  const handleRefreshConnection = async () => {
    try {
      await onRetryConnection()
    } catch (error) {
      console.error('Failed to refresh connection:', error)
    }
  }

  return (
    <div className="max-w-3xl w-full bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800/50 overflow-hidden shadow-xl">
      {/* Simplified Header */}
      <div className="border-b border-slate-700/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <h2 className="text-lg font-bold text-white">
              Market Maker Connection Lost
            </h2>
          </div>
        </div>
      </div>

      {/* Market Maker Selector Section */}
      <div className="bg-slate-800/40 border-b border-slate-700/50 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-yellow-400 mb-1 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              MARKET MAKER
            </h3>
            <p className="text-xs text-slate-400">
              If the current maker is unavailable, switch to another one to
              continue trading
            </p>
          </div>
          <div className="flex-shrink-0">
            <MakerSelector onMakerChange={onMakerChange} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <div className="flex flex-col items-center space-y-6">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20">
            <div className="relative">
              <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500/30 rounded-full animate-ping"></div>
            </div>
          </div>

          <div className="text-center space-y-3">
            <h3 className="text-xl font-bold text-white">Connection Issue</h3>
            <p className="text-slate-300 text-center max-w-md leading-relaxed">
              Your trading channels are available, but we're having trouble
              maintaining a real-time connection to the market maker.
              <br />
              <span className="text-slate-400 text-sm">
                This prevents live price updates and trading.
              </span>
            </p>
          </div>

          <button
            className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-red-500/25 hover:scale-105"
            onClick={handleRefreshConnection}
          >
            <RefreshCcw className="w-5 h-5" />
            Retry Connection
          </button>

          {/* Troubleshooting Grid */}
          <div className="grid grid-cols-3 gap-4 w-full max-w-lg mt-8">
            <div className="bg-slate-800/40 rounded-xl border border-slate-700/30 p-4 text-center hover:bg-slate-800/60 transition-colors">
              <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-blue-500/20">
                <Globe className="w-5 h-5 text-blue-400" />
              </div>
              <h4 className="text-sm font-semibold text-blue-300 mb-1">
                Network
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Check your internet connection
              </p>
            </div>

            <div className="bg-slate-800/40 rounded-xl border border-slate-700/30 p-4 text-center hover:bg-slate-800/60 transition-colors">
              <div className="w-10 h-10 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-yellow-500/20">
                <RefreshCcw className="w-5 h-5 text-yellow-400" />
              </div>
              <h4 className="text-sm font-semibold text-yellow-300 mb-1">
                Switch Maker
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Try a different market maker above
              </p>
            </div>

            <div className="bg-slate-800/40 rounded-xl border border-slate-700/30 p-4 text-center hover:bg-slate-800/60 transition-colors">
              <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-green-500/20">
                <Clock className="w-5 h-5 text-green-400" />
              </div>
              <h4 className="text-sm font-semibold text-green-300 mb-1">
                Wait
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Server may be temporarily busy
              </p>
            </div>
          </div>

          {makerUrl && (
            <div className="w-full pt-6 border-t border-slate-700/30">
              <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/40">
                <p className="text-xs text-slate-400 text-center">
                  Current maker:{' '}
                  <span className="text-red-400 font-mono break-all">
                    {makerUrl}
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// New component for connection timeout scenarios
interface ConnectionTimeoutMessageProps {
  onMakerChange: () => Promise<void>
  onRetry: () => void
  makerUrl: string | null
  elapsedSeconds: number
  isConnecting?: boolean
}

export const ConnectionTimeoutMessage: React.FC<
  ConnectionTimeoutMessageProps
> = ({
  onMakerChange,
  onRetry,
  makerUrl,
  elapsedSeconds,
  isConnecting = false,
}) => {
  return (
    <div className="max-w-3xl w-full bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800/50 overflow-hidden shadow-xl">
      {/* Header */}
      <div className="border-b border-slate-700/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
            <h2 className="text-lg font-bold text-white">
              {isConnecting
                ? 'Connecting to Market Maker'
                : 'Connection Timeout'}
            </h2>
          </div>
          {isConnecting && (
            <span className="text-sm text-slate-400">
              {elapsedSeconds}s elapsed
            </span>
          )}
        </div>
      </div>

      {/* Market Maker Selector Section */}
      <div className="bg-slate-800/40 border-b border-slate-700/50 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-yellow-400 mb-1 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              MARKET MAKER
            </h3>
            <p className="text-xs text-slate-400">
              {isConnecting
                ? 'Currently attempting to connect. You can switch to try another maker.'
                : 'Switch to a different maker if the current one is unavailable'}
            </p>
          </div>
          <div className="flex-shrink-0">
            <MakerSelector onMakerChange={onMakerChange} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <div className="flex flex-col items-center space-y-6">
          <div
            className={`w-16 h-16 ${isConnecting ? 'bg-blue-500/10 border-blue-500/20' : 'bg-orange-500/10 border-orange-500/20'} rounded-full flex items-center justify-center border`}
          >
            <div className="relative">
              <div
                className={`w-8 h-8 ${isConnecting ? 'bg-blue-500/20' : 'bg-orange-500/20'} rounded-full flex items-center justify-center`}
              >
                {isConnecting ? (
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                ) : (
                  <Clock className="w-4 h-4 text-orange-500" />
                )}
              </div>
              {isConnecting && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500/30 rounded-full animate-ping"></div>
              )}
            </div>
          </div>

          <div className="text-center space-y-3">
            <h3 className="text-xl font-bold text-white">
              {isConnecting ? 'Establishing Connection' : 'Connection Timeout'}
            </h3>
            <p className="text-slate-300 text-center max-w-md leading-relaxed">
              {isConnecting ? (
                <>
                  Attempting to connect to the market maker...
                  <br />
                  <span className="text-slate-400 text-sm">
                    This usually takes just a few seconds.
                  </span>
                </>
              ) : (
                <>
                  Unable to connect to the market maker within 30 seconds.
                  <br />
                  <span className="text-slate-400 text-sm">
                    The server may be unreachable or experiencing issues.
                  </span>
                </>
              )}
            </p>
            {isConnecting && (
              <p className="text-slate-500 text-sm">
                Connecting for {elapsedSeconds} seconds...
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              className={`px-6 py-3 ${isConnecting ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'} text-white rounded-lg transition-colors font-medium flex items-center gap-2`}
              onClick={onRetry}
            >
              <RefreshCcw className="w-5 h-5" />
              {isConnecting ? 'Cancel & Retry' : 'Retry Connection'}
            </button>
          </div>

          {/* Troubleshooting Grid */}
          <div className="grid grid-cols-3 gap-4 w-full max-w-lg mt-8">
            <div className="bg-slate-800/40 rounded-xl border border-slate-700/30 p-4 text-center hover:bg-slate-800/60 transition-colors">
              <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-blue-500/20">
                <Globe className="w-5 h-5 text-blue-400" />
              </div>
              <h4 className="text-sm font-semibold text-blue-300 mb-1">
                Network
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Check your internet connection
              </p>
            </div>

            <div className="bg-slate-800/40 rounded-xl border border-slate-700/30 p-4 text-center hover:bg-slate-800/60 transition-colors">
              <div className="w-10 h-10 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-yellow-500/20">
                <RefreshCcw className="w-5 h-5 text-yellow-400" />
              </div>
              <h4 className="text-sm font-semibold text-yellow-300 mb-1">
                Switch Maker
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Try a different market maker above
              </p>
            </div>

            <div className="bg-slate-800/40 rounded-xl border border-slate-700/30 p-4 text-center hover:bg-slate-800/60 transition-colors">
              <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-green-500/20">
                <Clock className="w-5 h-5 text-green-400" />
              </div>
              <h4 className="text-sm font-semibold text-green-300 mb-1">
                Wait
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                {isConnecting ? 'Connection in progress' : 'Server may be busy'}
              </p>
            </div>
          </div>

          {makerUrl && (
            <div className="w-full pt-6 border-t border-slate-700/30">
              <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/40">
                <p className="text-xs text-slate-400 text-center">
                  Current maker:{' '}
                  <span
                    className={`font-mono break-all ${isConnecting ? 'text-blue-400' : 'text-orange-400'}`}
                  >
                    {makerUrl}
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
