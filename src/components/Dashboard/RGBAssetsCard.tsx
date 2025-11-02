import { Coins, TrendingUp } from 'lucide-react'
import React, { useState } from 'react'

import { Card } from '../ui'

interface RGBAsset {
  asset_id: string
  name: string
  ticker: string
  precision: number
  onChainBalance: number
  offChainBalance: number
}

interface RGBAssetsCardProps {
  assets: RGBAsset[]
  bitcoinUnit: string
  onAssetClick?: (assetId: string) => void
}

export const RGBAssetsCard: React.FC<RGBAssetsCardProps> = ({
  assets,
  onAssetClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  if (assets.length === 0) {
    return (
      <Card className="mb-6 bg-gradient-to-br from-emerald-900/20 to-teal-900/20 border-emerald-500/30">
        <div className="p-6 text-center">
          <div className="inline-flex p-4 bg-emerald-500/20 rounded-full mb-4">
            <Coins className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            No RGB Assets
          </h3>
          <p className="text-sm text-slate-400">
            You don't have any RGB assets yet. Start by issuing or receiving RGB
            assets.
          </p>
        </div>
      </Card>
    )
  }

  const totalAssets = assets.length
  const assetsToShow = isExpanded ? assets : assets.slice(0, 3)

  return (
    <Card className="mb-6 bg-gradient-to-br from-emerald-900/20 to-teal-900/20 border-emerald-500/30">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/20 rounded-xl">
              <Coins className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">RGB Assets</h3>
              <p className="text-xs text-slate-400">
                {totalAssets} asset{totalAssets !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <TrendingUp className="w-5 h-5 text-emerald-400" />
        </div>

        {/* Assets List */}
        <div className="space-y-3">
          {assetsToShow.map((asset) => {
            const totalBalance = asset.onChainBalance + asset.offChainBalance
            return (
              <div
                className="p-4 bg-slate-800/50 rounded-xl hover:bg-slate-800/70 transition-colors cursor-pointer"
                key={asset.asset_id}
                onClick={() => onAssetClick?.(asset.asset_id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">
                      {asset.ticker}
                    </span>
                    <span className="text-xs text-slate-400">{asset.name}</span>
                  </div>
                  <span className="text-sm font-medium text-white">
                    {totalBalance.toFixed(asset.precision)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    On-Chain: {asset.onChainBalance.toFixed(asset.precision)}
                  </span>
                  <span className="text-slate-500">
                    LN: {asset.offChainBalance.toFixed(asset.precision)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Show More/Less Button */}
        {totalAssets > 3 && (
          <button
            className="w-full mt-4 py-2 text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded
              ? 'Show Less'
              : `Show ${totalAssets - 3} More Asset${totalAssets - 3 !== 1 ? 's' : ''}`}
          </button>
        )}
      </div>
    </Card>
  )
}
