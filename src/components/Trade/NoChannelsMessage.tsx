import { openUrl } from '@tauri-apps/plugin-opener'
import {
  Link,
  Plus,
  ShoppingCart,
  HelpCircle,
  Wallet,
  ExternalLink,
  RefreshCcw,
} from 'lucide-react'
import React from 'react'

import {
  CREATE_NEW_CHANNEL_PATH,
  ORDER_CHANNEL_PATH,
} from '../../app/router/paths'
import { useAppDispatch } from '../../app/store/hooks'
import { uiSliceActions } from '../../slices/ui/ui.slice'

import { MakerSelector } from './MakerSelector'

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
  const { supportedAssets, registryUrl } = makerInfo
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
    <div className="max-w-2xl w-full bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800/50 overflow-hidden">
      <div className="border-b border-slate-700/50 px-4 pt-3 pb-2">
        <MakerSelector hasNoPairs onMakerChange={onMakerChange} />
      </div>
      <div className="p-6">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center">
            <Link className="w-6 h-6 text-blue-500" />
          </div>
          <h2 className="text-xl font-bold text-white">
            No Trading Channels Available
          </h2>
          <p className="text-slate-400 text-center text-sm max-w-md">
            {getRecommendationMessage()}
          </p>

          <button
            className="mt-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
            onClick={async () => {
              try {
                await onMakerChange()
              } catch (error) {
                console.error('Failed to refresh channels:', error)
              }
            }}
          >
            <RefreshCcw className="w-4 h-4" />
            Refresh
          </button>

          <div className="mt-2 p-4 bg-slate-800/60 rounded-xl border border-slate-700/40 w-full max-w-lg shadow-sm">
            <h3 className="text-sm font-semibold text-slate-200 mb-3.5 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-blue-400" />
              Quick Start Guide
            </h3>
            <ul className="text-sm text-slate-300 space-y-3.5">
              <li className="flex items-center gap-3 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-blue-500/30 text-blue-300 flex items-center justify-center flex-shrink-0 text-[11px] font-medium border border-blue-500/20 shadow-inner">
                  1
                </div>
                <div className="flex-1 flex items-center">
                  <button
                    className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1.5 font-medium py-1"
                    onClick={() => openUrl(registryUrl)}
                  >
                    Check supported assets and pairs
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
              <li className="flex items-center gap-3 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-blue-500/30 text-blue-300 flex items-center justify-center flex-shrink-0 text-[11px] font-medium border border-blue-500/20 shadow-inner">
                  2
                </div>
                <div className="flex-1">
                  {supportedAssets.length > 0 ? (
                    <>
                      This maker supports:{' '}
                      <span className="text-emerald-400 font-medium">
                        {supportedAssets.slice(0, 3).join(', ')}
                      </span>
                      {supportedAssets.length > 3 && (
                        <span className="text-emerald-400 font-medium">
                          ...
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      Buy a channel from an LSP or open one directly with your
                      assets
                    </>
                  )}
                </div>
              </li>
              <li className="flex items-center gap-3 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-blue-500/30 text-blue-300 flex items-center justify-center flex-shrink-0 text-[11px] font-medium border border-blue-500/20 shadow-inner">
                  3
                </div>
                <div className="flex-1">
                  Return to start trading once your channel is active
                </div>
              </li>
            </ul>
          </div>

          <div className="flex gap-4 pt-3 justify-center">
            {primaryAction === 'buy' ? (
              <>
                <button
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg 
                       font-medium transition-colors flex items-center gap-2 text-base shadow-md"
                  onClick={() => onNavigate(ORDER_CHANNEL_PATH)}
                >
                  <ShoppingCart className="w-5 h-5" />
                  Buy Channel
                </button>
                {recommendedAction === 'both' && (
                  <button
                    className="px-6 py-3 border border-blue-500/50 text-blue-500 rounded-lg 
                         hover:bg-blue-500/10 transition-colors flex items-center gap-2 text-base shadow-sm"
                    onClick={() => onNavigate(CREATE_NEW_CHANNEL_PATH)}
                  >
                    <Plus className="w-5 h-5" />
                    Open Channel
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg 
                       font-medium transition-colors flex items-center gap-2 text-base shadow-md"
                  onClick={() => onNavigate(CREATE_NEW_CHANNEL_PATH)}
                >
                  <Plus className="w-5 h-5" />
                  Open Channel
                </button>
                {recommendedAction === 'both' && (
                  <button
                    className="px-6 py-3 border border-blue-500/50 text-blue-500 rounded-lg 
                         hover:bg-blue-500/10 transition-colors flex items-center gap-2 text-base shadow-sm"
                    onClick={() => onNavigate(ORDER_CHANNEL_PATH)}
                  >
                    <ShoppingCart className="w-5 h-5" />
                    Buy Channel
                  </button>
                )}
              </>
            )}
          </div>
          <div className="flex gap-3 pt-2 justify-center"></div>
        </div>
      </div>
    </div>
  )
}

export const createTradingChannelsMessageProps = (
  assets: { ticker: string; asset_id: string }[],
  tradablePairs: { base_asset: string; quote_asset: string }[],
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
  makerUrl: string | null
}

export const WebSocketDisconnectedMessage: React.FC<
  WebSocketDisconnectedMessageProps
> = ({ onMakerChange, makerUrl }) => {
  const handleRefreshConnection = async () => {
    try {
      await onMakerChange()
    } catch (error) {
      console.error('Failed to refresh connection:', error)
    }
  }

  return (
    <div className="max-w-2xl w-full bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-amber-700/30 overflow-hidden">
      <div className="border-b border-slate-700/50 px-4 pt-3 pb-2">
        <MakerSelector hasNoPairs={false} onMakerChange={onMakerChange} />
      </div>
      <div className="p-6">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center">
            <HelpCircle className="w-6 h-6 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-white">Connection Issue</h2>
          <p className="text-slate-400 text-center text-sm max-w-md">
            You have trading channels available, but we're having trouble
            maintaining a real-time connection to the market maker. The app will
            automatically try to reconnect.
          </p>

          <button
            className="mt-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
            onClick={handleRefreshConnection}
          >
            <RefreshCcw className="w-4 h-4" />
            Refresh Connection
          </button>

          <div className="mt-2 p-4 bg-slate-800/60 rounded-xl border border-slate-700/40 w-full max-w-lg shadow-sm">
            <h3 className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-amber-400" />
              Troubleshooting Tips
            </h3>
            <ul className="text-sm text-slate-300 space-y-3">
              <li className="flex items-start gap-2.5 rounded-lg">
                <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center flex-shrink-0 text-[10px] font-medium border border-amber-500/10 shadow-inner mt-0.5">
                  1
                </div>
                <div className="flex-1">Check your internet connection</div>
              </li>
              <li className="flex items-start gap-2.5 rounded-lg">
                <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center flex-shrink-0 text-[10px] font-medium border border-amber-500/10 shadow-inner mt-0.5">
                  2
                </div>
                <div className="flex-1">
                  Try selecting a different market maker
                </div>
              </li>
              <li className="flex items-start gap-2.5 rounded-lg">
                <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center flex-shrink-0 text-[10px] font-medium border border-amber-500/10 shadow-inner mt-0.5">
                  3
                </div>
                <div className="flex-1">Wait a few minutes and try again</div>
              </li>
            </ul>
          </div>

          {makerUrl && (
            <div className="w-full pt-1">
              <p className="text-xs text-slate-500 text-center">
                Attempting to connect to:{' '}
                <span className="text-amber-400/90 font-mono text-xs break-all">
                  {makerUrl}
                </span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
