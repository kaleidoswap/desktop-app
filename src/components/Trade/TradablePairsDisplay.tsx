import { ArrowRightLeft, TrendingUp, Coins, Copy } from 'lucide-react'
import React from 'react'

import { TradingPair } from '../../slices/makerApi/makerApi.slice'

interface TradablePairsDisplayProps {
  pairs: TradingPair[]
  title?: string
  maxPairsToShow?: number
}

export const TradablePairsDisplay: React.FC<TradablePairsDisplayProps> = ({
  pairs,
  title = 'Available Trading Pairs',
  maxPairsToShow = 6,
}) => {
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }
  if (pairs.length === 0) {
    return (
      <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/40 w-full max-w-lg">
        <div className="flex items-center justify-center text-slate-400 py-4">
          <Coins className="w-5 h-5 mr-2" />
          <span className="text-sm">No trading pairs available</span>
        </div>
      </div>
    )
  }

  const displayPairs = pairs.slice(0, maxPairsToShow)
  const remainingCount = pairs.length - maxPairsToShow

  return (
    <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/40 w-full max-w-lg">
      <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-emerald-400" />
        {title}
        <span className="text-xs text-slate-400 font-normal">
          ({pairs.length} pairs)
        </span>
      </h3>

      <div className="grid grid-cols-1 gap-2">
        {displayPairs.map((pair, index) => (
          <div
            className="flex items-center justify-between p-3 bg-slate-700/40 rounded-lg border border-slate-600/30"
            key={pair.id || `${pair.base_asset}-${pair.quote_asset}-${index}`}
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">
                  {pair.base_asset}
                </span>
                <ArrowRightLeft className="w-3 h-3 text-slate-400" />
                <span className="text-sm font-medium text-white">
                  {pair.quote_asset}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <button
                  className="font-mono truncate max-w-[80px] hover:text-blue-400 hover:bg-slate-600/30 px-1 py-0.5 rounded transition-colors flex items-center gap-1"
                  onClick={() =>
                    pair.base_asset_id && copyToClipboard(pair.base_asset_id)
                  }
                  title={`Click to copy: ${pair.base_asset_id}`}
                >
                  {pair.base_asset_id?.slice(0, 8)}...
                  <Copy className="w-2 h-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                <ArrowRightLeft className="w-2 h-2" />
                <button
                  className="font-mono truncate max-w-[80px] hover:text-blue-400 hover:bg-slate-600/30 px-1 py-0.5 rounded transition-colors flex items-center gap-1"
                  onClick={() =>
                    pair.quote_asset_id && copyToClipboard(pair.quote_asset_id)
                  }
                  title={`Click to copy: ${pair.quote_asset_id}`}
                >
                  {pair.quote_asset_id?.slice(0, 8)}...
                  <Copy className="w-2 h-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${pair.is_active ? 'bg-emerald-400' : 'bg-slate-500'}`}
              ></div>
              <span className="text-xs text-slate-400">
                {pair.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        ))}

        {remainingCount > 0 && (
          <div className="flex items-center justify-center p-2 text-slate-400 text-xs">
            + {remainingCount} more pairs available
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-600/30">
        <div className="text-xs text-slate-400 text-center">
          Open a channel with any of these assets to start trading
        </div>
      </div>
    </div>
  )
}

// Component to display unique assets from trading pairs
interface SupportedAssetsDisplayProps {
  pairs: TradingPair[]
  title?: string
}

export const SupportedAssetsDisplay: React.FC<SupportedAssetsDisplayProps> = ({
  pairs,
  title = 'Supported Assets',
}) => {
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }
  // Extract unique asset-ID pairs from trading pairs
  const assetEntries: Array<[string, { ticker: string; assetId: string }]> =
    pairs
      .flatMap((pair) => [
        [
          pair.base_asset_id,
          { assetId: pair.base_asset_id, ticker: pair.base_asset },
        ],
        [
          pair.quote_asset_id,
          { assetId: pair.quote_asset_id, ticker: pair.quote_asset },
        ],
      ])
      .filter(([assetId]) => assetId) as Array<
      [string, { ticker: string; assetId: string }]
    >

  const uniqueAssets = Array.from(new Map(assetEntries).values()).sort((a, b) =>
    a.ticker.localeCompare(b.ticker)
  )

  if (uniqueAssets.length === 0) {
    return null
  }

  return (
    <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/40 w-full max-w-lg">
      <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
        <Coins className="w-4 h-4 text-blue-400" />
        {title}
        <span className="text-xs text-slate-400 font-normal">
          ({uniqueAssets.length} assets)
        </span>
      </h3>

      <div className="flex flex-wrap gap-2">
        {uniqueAssets.map((asset, index) => (
          <button
            className="px-3 py-2 bg-slate-700/50 rounded-lg border border-slate-600/30 flex flex-col gap-1 hover:bg-slate-600/50 hover:border-blue-500/30 transition-colors group"
            key={`${asset.assetId}-${index}`}
            onClick={() => copyToClipboard(asset.assetId)}
            title={`Click to copy Asset ID: ${asset.assetId}`}
          >
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-white">
                {asset.ticker}
              </span>
              <Copy className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="text-xs text-slate-400 font-mono group-hover:text-blue-400 transition-colors">
              {asset.assetId?.slice(0, 8)}...
            </span>
          </button>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-600/30">
        <div className="text-xs text-slate-400 text-center">
          You can trade between any combination of these assets
        </div>
      </div>
    </div>
  )
}
