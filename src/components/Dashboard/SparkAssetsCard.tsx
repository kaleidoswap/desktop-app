import { Zap } from 'lucide-react'
import React, { useState } from 'react'

import { useAppSelector } from '../../app/store/hooks'
import sparkLogo from '../../assets/spark-logo.svg'
import { Card } from '../ui'

interface SparkAsset {
  tokenIdentifier: string
  balance: bigint
  tokenPublicKey: string
  name?: string
  ticker?: string
}

interface SparkAssetsCardProps {
  assets: SparkAsset[]
  onAssetClick?: (tokenIdentifier: string) => void
}

export const SparkAssetsCard: React.FC<SparkAssetsCardProps> = ({
  assets,
  onAssetClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const sparkConnected = useAppSelector((state) => state.spark.connected)

  if (!sparkConnected) {
    return (
      <Card className="mb-6 bg-gradient-to-br from-blue-900/20 to-indigo-900/20 border-blue-500/30">
        <div className="p-6 text-center">
          <div className="inline-flex p-4 bg-blue-500/20 rounded-full mb-4">
            <img alt="Spark" className="w-8 h-8" src={sparkLogo} />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Spark Wallet Not Connected
          </h3>
          <p className="text-sm text-slate-400">
            Connect a Spark wallet to view and manage Spark assets.
          </p>
        </div>
      </Card>
    )
  }

  if (assets.length === 0) {
    return (
      <Card className="mb-6 bg-gradient-to-br from-blue-900/20 to-indigo-900/20 border-blue-500/30">
        <div className="p-6 text-center">
          <div className="inline-flex p-4 bg-blue-500/20 rounded-full mb-4">
            <img alt="Spark" className="w-8 h-8" src={sparkLogo} />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            No Spark Assets
          </h3>
          <p className="text-sm text-slate-400">
            You don't have any Spark assets yet. Start by receiving tokens on
            Spark.
          </p>
        </div>
      </Card>
    )
  }

  const totalAssets = assets.length
  const assetsToShow = isExpanded ? assets : assets.slice(0, 3)

  return (
    <Card className="mb-6 bg-gradient-to-br from-blue-900/20 to-indigo-900/20 border-blue-500/30">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <img alt="Spark" className="w-6 h-6" src={sparkLogo} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Spark Assets</h3>
              <p className="text-xs text-slate-400">
                {totalAssets} asset{totalAssets !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <Zap className="w-5 h-5 text-blue-400" />
        </div>

        {/* Assets List */}
        <div className="space-y-3">
          {assetsToShow.map((asset) => {
            const displayName = asset.ticker || asset.name || 'Unknown Token'
            const balance = Number(asset.balance) / 100000000 // Assuming 8 decimals

            return (
              <div
                className="p-4 bg-slate-800/50 rounded-xl hover:bg-slate-800/70 transition-colors cursor-pointer"
                key={asset.tokenIdentifier}
                onClick={() => onAssetClick?.(asset.tokenIdentifier)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">
                      {displayName}
                    </span>
                    <span className="px-2 py-0.5 bg-blue-500/20 text-xs text-blue-400 rounded-full">
                      Spark
                    </span>
                  </div>
                  <span className="text-sm font-medium text-white">
                    {balance.toFixed(8)}
                  </span>
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {asset.tokenIdentifier}
                </div>
              </div>
            )
          })}
        </div>

        {/* Show More/Less Button */}
        {totalAssets > 3 && (
          <button
            className="w-full mt-4 py-2 text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors"
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
