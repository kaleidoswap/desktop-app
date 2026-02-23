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
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()

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
            {t('trade.noChannels.insufficientBalance')}
          </h2>
          <p className="text-slate-400 text-center text-base max-w-md">
            {t('trade.noChannels.insufficientBalanceMessage')}
          </p>

          <div className="flex gap-3 pt-4">
            <button
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl
                     font-medium transition-colors flex items-center gap-2 text-base"
              onClick={handleShowDepositModal}
            >
              <Wallet className="w-5 h-5" />
              {t('trade.noChannels.depositBTC')}
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
          {t('trade.noChannels.noRGBChannels')}
        </h2>
        <p className="text-slate-400 text-center text-base max-w-md">
          {t('trade.noChannels.noRGBChannelsMessage')}
        </p>

        <div className="flex gap-4 pt-4">
          <button
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl
                     font-medium transition-colors flex items-center gap-2 text-base"
            onClick={() => onNavigate(CREATE_NEW_CHANNEL_PATH)}
          >
            <Plus className="w-5 h-5" />
            {t('trade.noChannels.openChannel')}
          </button>
          <button
            className="px-6 py-3 border border-blue-500/50 text-blue-500 rounded-xl
                     hover:bg-blue-500/10 transition-colors flex items-center gap-2 text-base"
            onClick={() => onNavigate(ORDER_CHANNEL_PATH)}
          >
            <ShoppingCart className="w-5 h-5" />
            {t('trade.noChannels.buyFromLSP')}
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
  const { t } = useTranslation()

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
            {t('trade.noChannels.insufficientBalance')}
          </h2>
          <p className="text-slate-400 text-center text-sm max-w-md">
            {t('trade.noChannels.insufficientBalanceMessage')}
          </p>

          <button
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl
                   font-medium transition-colors flex items-center gap-2 text-sm mt-1"
            onClick={handleShowDepositModal}
          >
            <Wallet className="w-4 h-4" />
            {t('trade.noChannels.depositBTC')}
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
      return t('trade.noChannels.recommendationCompatible')
    } else if (recommendedAction === 'buy') {
      return t('trade.noChannels.recommendationBuy')
    } else if (recommendedAction === 'open') {
      return t('trade.noChannels.recommendationOpen')
    }
    return t('trade.noChannels.recommendationDefault')
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
                  <h3 className="text-lg font-bold text-white">
                    {t('trade.noChannels.marketMaker')}
                  </h3>
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

              <h1 className="text-5xl lg:text-6xl font-bold bg-gradient-to-r from-white via-cyan-100 to-blue-100 bg-clip-text text-transparent leading-tight mb-4 px-4 max-w-4xl mx-auto break-words">
                {t('trade.noChannels.noTradingChannels')}
              </h1>

              <p className="text-xl text-slate-300 leading-relaxed max-w-3xl mx-auto mb-8 px-4">
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
                      <span className="relative z-10">
                        {t('trade.noChannels.buyChannel')}
                      </span>
                    </button>
                    {recommendedAction === 'both' && (
                      <button
                        className="group relative px-10 py-4 border-2 border-blue-500/70 hover:border-blue-400 text-blue-400 hover:text-blue-300 rounded-2xl font-bold text-xl transition-all duration-300 flex items-center justify-center gap-3 shadow-xl hover:shadow-blue-500/25 hover:scale-105 backdrop-blur-sm hover:bg-blue-500/10 min-w-[200px]"
                        onClick={() => onNavigate(CREATE_NEW_CHANNEL_PATH)}
                      >
                        <Plus className="w-6 h-6" />
                        {t('trade.noChannels.openChannel')}
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
                      <span className="relative z-10">
                        {t('trade.noChannels.openChannel')}
                      </span>
                    </button>
                    {recommendedAction === 'both' && (
                      <button
                        className="group relative px-10 py-4 border-2 border-emerald-500/70 hover:border-emerald-400 text-emerald-400 hover:text-emerald-300 rounded-2xl font-bold text-xl transition-all duration-300 flex items-center justify-center gap-3 shadow-xl hover:shadow-emerald-500/25 hover:scale-105 backdrop-blur-sm hover:bg-emerald-500/10 min-w-[200px]"
                        onClick={() => onNavigate(ORDER_CHANNEL_PATH)}
                      >
                        <ShoppingCart className="w-6 h-6" />
                        {t('trade.noChannels.buyChannel')}
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Information Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto mt-12 px-4">
                {tradingPairs.length > 0 ? (
                  <>
                    <div className="bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-600/50 p-6 shadow-2xl">
                      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-purple-400/2 to-transparent rounded-3xl pointer-events-none"></div>
                      <div className="relative">
                        <TradablePairsDisplay
                          maxPairsToShow={8}
                          pairs={tradingPairs}
                          title={t('trade.noChannels.availableTradingPairs')}
                        />
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-600/50 p-6 shadow-2xl">
                      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-cyan-400/2 to-transparent rounded-3xl pointer-events-none"></div>
                      <div className="relative">
                        <SupportedAssetsDisplay
                          pairs={tradingPairs}
                          title={t('trade.noChannels.supportedAssets')}
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
                            {t('trade.noChannels.quickStartGuide')}
                          </h3>
                          <p className="text-slate-400 text-lg leading-relaxed">
                            {t('trade.noChannels.quickStartMessage')}
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
                              {t('trade.noChannels.checkSupportedAssets')}
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            <p className="text-slate-400 text-sm">
                              {t('trade.noChannels.checkSupportedAssetsMessage')}
                            </p>
                          </div>

                          <div className="group text-center p-6 rounded-2xl hover:bg-slate-800/40 transition-all duration-300">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500/30 via-green-500/25 to-emerald-500/30 text-emerald-300 flex items-center justify-center mx-auto mb-4 text-xl font-bold border border-emerald-500/40 shadow-lg">
                              2
                            </div>
                            <h4 className="font-semibold text-lg text-white mb-2">
                              {t('trade.noChannels.createYourChannel')}
                            </h4>
                            <p className="text-slate-400 text-sm">
                              {t('trade.noChannels.createChannelMessage')}
                            </p>
                          </div>

                          <div className="group text-center p-6 rounded-2xl hover:bg-slate-800/40 transition-all duration-300">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/30 via-pink-500/25 to-purple-500/30 text-purple-300 flex items-center justify-center mx-auto mb-4 text-xl font-bold border border-purple-500/40 shadow-lg">
                              3
                            </div>
                            <h4 className="font-semibold text-lg text-white mb-2">
                              {t('trade.noChannels.startTrading')}
                            </h4>
                            <p className="text-slate-400 text-sm">
                              {t('trade.noChannels.startTradingMessage')}
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
  assets: any[],
  tradablePairs: TradingPair[],
  hasEnoughBalance: boolean,
  onNavigate: (path: string) => void,
  onMakerChange: () => Promise<void>
): NoTradingChannelsMessageProps => {
  const supportedAssets = tradablePairs
    .flatMap((pair) => [pair.base_asset, pair.quote_asset])
    .filter((v): v is string => !!v)
    .filter((v, i, a) => a.indexOf(v) === i)

  // Improve asset ID extraction: check protocol_ids or fallback to asset_id (if exists on ancient caching) or ticker
  const ownedAssets = assets
    .map((asset) => {
      return asset.protocol_ids?.['RGB'] || asset.asset_id || asset.ticker
    })
    .filter((id): id is string => !!id)

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

// New component for channels that exist but are not ready yet
interface ChannelsNotReadyMessageProps {
  onRefresh: () => Promise<void>
}

export const ChannelsNotReadyMessage: React.FC<
  ChannelsNotReadyMessageProps
> = ({ onRefresh }) => {
  const { t } = useTranslation()

  return (
    <div className="max-w-2xl w-full bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800/50 p-8">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center">
          <Clock className="w-8 h-8 text-yellow-500" />
        </div>
        <h2 className="text-2xl font-bold text-white">
          {t('trade.channelsNotReady.title')}
        </h2>
        <p className="text-slate-400 text-center text-base max-w-md">
          {t('trade.channelsNotReady.message')}
        </p>

        <div className="w-full max-w-md bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              <span className="text-yellow-400 font-medium">
                {t('trade.channelsNotReady.channelStatus')}
              </span>
            </div>
            <span className="text-slate-400 text-sm">
              {t('trade.channelsNotReady.initializing')}
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-700/30 rounded-full h-2 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 w-3/4 animate-pulse rounded-full"></div>
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl
                     font-medium transition-colors flex items-center gap-2 text-base
                     shadow-lg hover:shadow-yellow-500/25"
            onClick={onRefresh}
          >
            <RefreshCcw className="w-5 h-5" />
            {t('trade.channelsNotReady.checkStatus')}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg mt-4">
          <div className="bg-slate-800/40 rounded-xl border border-slate-700/30 p-4">
            <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center mb-3 border border-blue-500/20">
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <h4 className="text-sm font-semibold text-blue-300 mb-1">
              {t('trade.channelsNotReady.setupTime')}
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              {t('trade.channelsNotReady.setupTimeMessage')}
            </p>
          </div>

          <div className="bg-slate-800/40 rounded-xl border border-slate-700/30 p-4">
            <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center mb-3 border border-green-500/20">
              <RefreshCcw className="w-5 h-5 text-green-400" />
            </div>
            <h4 className="text-sm font-semibold text-green-300 mb-1">
              {t('trade.channelsNotReady.autoRefresh')}
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              {t('trade.channelsNotReady.autoRefreshMessage')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
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
  const { t } = useTranslation()
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
              {t('trade.connectionIssues.connectionLost')}
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
              {(t('trade.noChannels.marketMaker') || '').toUpperCase()}
            </h3>
            <p className="text-xs text-slate-400">
              {t('trade.connectionIssues.marketMakerSelector')}
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
            <h3 className="text-xl font-bold text-white">{t('trade.connectionIssues.connectionIssue')}</h3>
            <p className="text-slate-300 text-center max-w-md leading-relaxed">
              {t('trade.connectionIssues.connectionLostMessage')}
              <br />
              <span className="text-slate-400 text-sm">
                {t('trade.connectionIssues.preventsTradingMessage')}
              </span>
            </p>
          </div>

          <button
            className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-red-500/25 hover:scale-105"
            onClick={handleRefreshConnection}
          >
            <RefreshCcw className="w-5 h-5" />
            {t('trade.connectionIssues.retryConnection')}
          </button>

          {/* Troubleshooting Grid */}
          <div className="grid grid-cols-3 gap-4 w-full max-w-lg mt-8">
            <div className="bg-slate-800/40 rounded-xl border border-slate-700/30 p-4 text-center hover:bg-slate-800/60 transition-colors">
              <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-blue-500/20">
                <Globe className="w-5 h-5 text-blue-400" />
              </div>
              <h4 className="text-sm font-semibold text-blue-300 mb-1">
                {t('trade.connectionIssues.network')}
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                {t('trade.connectionIssues.checkInternetMessage')}
              </p>
            </div>

            <div className="bg-slate-800/40 rounded-xl border border-slate-700/30 p-4 text-center hover:bg-slate-800/60 transition-colors">
              <div className="w-10 h-10 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-yellow-500/20">
                <RefreshCcw className="w-5 h-5 text-yellow-400" />
              </div>
              <h4 className="text-sm font-semibold text-yellow-300 mb-1">
                {t('trade.connectionIssues.switchMaker')}
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                {t('trade.connectionIssues.tryDifferentMaker')}
              </p>
            </div>

            <div className="bg-slate-800/40 rounded-xl border border-slate-700/30 p-4 text-center hover:bg-slate-800/60 transition-colors">
              <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-green-500/20">
                <Clock className="w-5 h-5 text-green-400" />
              </div>
              <h4 className="text-sm font-semibold text-green-300 mb-1">
                {t('trade.connectionIssues.wait')}
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                {t('trade.connectionIssues.serverBusy')}
              </p>
            </div>
          </div>

          {makerUrl && (
            <div className="w-full pt-6 border-t border-slate-700/30">
              <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/40">
                <p className="text-xs text-slate-400 text-center">
                  {t('trade.connectionIssues.currentMaker')}{' '}
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
    const { t } = useTranslation()
    return (
      <div className="max-w-3xl w-full bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800/50 overflow-hidden shadow-xl">
        {/* Header */}
        <div className="border-b border-slate-700/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
              <h2 className="text-lg font-bold text-white">
                {isConnecting
                  ? t('trade.connectionIssues.connectingToMaker')
                  : t('trade.connectionIssues.connectionTimeout')}
              </h2>
            </div>
            {isConnecting && (
              <span className="text-sm text-slate-400">
                {t('trade.connectionIssues.elapsedTime', { seconds: elapsedSeconds })}
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
                {(t('trade.noChannels.marketMaker') || '').toUpperCase()}
              </h3>
              <p className="text-xs text-slate-400">
                {isConnecting
                  ? t('trade.connectionIssues.tryingSwitchMessage')
                  : t('trade.connectionIssues.switchIfUnavailable')}
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
                {isConnecting ? t('trade.connectionIssues.establishingConnection') : t('trade.connectionIssues.connectionTimeout')}
              </h3>
              <p className="text-slate-300 text-center max-w-md leading-relaxed">
                {isConnecting ? (
                  <>
                    {t('trade.connectionIssues.connectingMessage')}
                    <br />
                    <span className="text-slate-400 text-sm">
                      {t('trade.connectionIssues.usuallyFastMessage')}
                    </span>
                  </>
                ) : (
                  <>
                    {t('trade.connectionIssues.timeoutMessage')}
                    <br />
                    <span className="text-slate-400 text-sm">
                      {t('trade.connectionIssues.serverUnreachableMessage')}
                    </span>
                  </>
                )}
              </p>
              {isConnecting && (
                <p className="text-slate-500 text-sm">
                  {t('trade.connectionIssues.connectingForSeconds', { seconds: elapsedSeconds })}
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                className={`px-6 py-3 ${isConnecting ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'} text-white rounded-lg transition-colors font-medium flex items-center gap-2`}
                onClick={onRetry}
              >
                <RefreshCcw className="w-5 h-5" />
                {isConnecting ? t('trade.connectionIssues.cancelAndRetry') : t('trade.connectionIssues.retryConnection')}
              </button>
            </div>

            {/* Troubleshooting Grid */}
            <div className="grid grid-cols-3 gap-4 w-full max-w-lg mt-8">
              <div className="bg-slate-800/40 rounded-xl border border-slate-700/30 p-4 text-center hover:bg-slate-800/60 transition-colors">
                <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-blue-500/20">
                  <Globe className="w-5 h-5 text-blue-400" />
                </div>
                <h4 className="text-sm font-semibold text-blue-300 mb-1">
                  {t('trade.connectionIssues.network')}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {t('trade.connectionIssues.checkInternetMessage')}
                </p>
              </div>

              <div className="bg-slate-800/40 rounded-xl border border-slate-700/30 p-4 text-center hover:bg-slate-800/60 transition-colors">
                <div className="w-10 h-10 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-yellow-500/20">
                  <RefreshCcw className="w-5 h-5 text-yellow-400" />
                </div>
                <h4 className="text-sm font-semibold text-yellow-300 mb-1">
                  {t('trade.connectionIssues.switchMaker')}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {t('trade.connectionIssues.tryDifferentMaker')}
                </p>
              </div>

              <div className="bg-slate-800/40 rounded-xl border border-slate-700/30 p-4 text-center hover:bg-slate-800/60 transition-colors">
                <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-green-500/20">
                  <Clock className="w-5 h-5 text-green-400" />
                </div>
                <h4 className="text-sm font-semibold text-green-300 mb-1">
                  {t('trade.connectionIssues.wait')}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {isConnecting ? t('trade.connectionIssues.connectionInProgress') : t('trade.connectionIssues.serverBusy')}
                </p>
              </div>
            </div>

            {makerUrl && (
              <div className="w-full pt-6 border-t border-slate-700/30">
                <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/40">
                  <p className="text-xs text-slate-400 text-center">
                    {t('trade.connectionIssues.currentMaker')}{' '}
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
