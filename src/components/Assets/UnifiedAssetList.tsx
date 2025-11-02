import { Coins, Zap } from 'lucide-react'
import React, { useState, useMemo } from 'react'

import sparkLogo from '../../assets/spark-logo.svg'

import { WalletTypeFilter, type WalletFilterType } from './WalletTypeFilter'

export interface RGBAssetItem {
  asset_id: string
  name: string
  ticker: string
  precision: number
  onChainBalance: number
  offChainBalance: number
  type: 'rgb'
}

export interface SparkAssetItem {
  tokenIdentifier: string
  balance: bigint
  tokenPublicKey: string
  name?: string
  ticker?: string
  type: 'spark'
}

type UnifiedAsset = RGBAssetItem | SparkAssetItem

interface UnifiedAssetListProps {
  rgbAssets: RGBAssetItem[]
  sparkAssets: SparkAssetItem[]
  onAssetClick?: (asset: UnifiedAsset) => void
}

export const UnifiedAssetList: React.FC<UnifiedAssetListProps> = ({
  rgbAssets,
  sparkAssets,
  onAssetClick,
}) => {
  const [activeFilter, setActiveFilter] = useState<WalletFilterType>('all')

  const filteredAssets = useMemo(() => {
    const rgb: UnifiedAsset[] = rgbAssets.map((a) => ({
      ...a,
      type: 'rgb' as const,
    }))
    const spark: UnifiedAsset[] = sparkAssets.map((a) => ({
      ...a,
      type: 'spark' as const,
    }))

    switch (activeFilter) {
      case 'rgb':
        return rgb
      case 'spark':
        return spark
      case 'all':
      default:
        return [...rgb, ...spark]
    }
  }, [rgbAssets, sparkAssets, activeFilter])

  if (rgbAssets.length === 0 && sparkAssets.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-900 rounded-lg border border-slate-700">
        <div className="inline-flex p-4 bg-slate-800 rounded-full mb-4">
          <Coins className="w-8 h-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No Assets</h3>
        <p className="text-sm text-slate-400">
          You don't have any assets yet. Start by issuing or receiving assets.
        </p>
      </div>
    )
  }

  return (
    <div>
      <WalletTypeFilter
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        rgbCount={rgbAssets.length}
        sparkCount={sparkAssets.length}
      />

      <div className="space-y-3">
        {filteredAssets.map((asset) => {
          if (asset.type === 'rgb') {
            const totalBalance = asset.onChainBalance + asset.offChainBalance
            return (
              <div
                className="p-4 bg-slate-900 hover:bg-slate-800/70 transition-colors cursor-pointer rounded-lg border border-slate-700"
                key={asset.asset_id}
                onClick={() => onAssetClick?.(asset)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                      <Coins className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">
                          {asset.ticker}
                        </span>
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-xs text-emerald-400 rounded-full">
                          RGB
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">
                        {asset.name}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-white">
                      {totalBalance.toFixed(asset.precision)}
                    </div>
                    <div className="text-xs text-slate-400">Total</div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-700 pt-2">
                  <span>
                    On-Chain: {asset.onChainBalance.toFixed(asset.precision)}
                  </span>
                  <span>
                    LN: {asset.offChainBalance.toFixed(asset.precision)}
                  </span>
                </div>
              </div>
            )
          } else {
            const displayName = asset.ticker || asset.name || 'Unknown Token'
            const balance = Number(asset.balance) / 100000000 // Assuming 8 decimals

            return (
              <div
                className="p-4 bg-slate-900 hover:bg-slate-800/70 transition-colors cursor-pointer rounded-lg border border-slate-700"
                key={asset.tokenIdentifier}
                onClick={() => onAssetClick?.(asset)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <img alt="Spark" className="w-5 h-5" src={sparkLogo} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">
                          {displayName}
                        </span>
                        <span className="px-2 py-0.5 bg-blue-500/20 text-xs text-blue-400 rounded-full">
                          Spark
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 truncate max-w-[200px]">
                        {asset.tokenIdentifier}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-white">
                      {balance.toFixed(8)}
                    </div>
                    <div className="text-xs text-slate-400">Off-Chain</div>
                  </div>
                </div>
              </div>
            )
          }
        })}
      </div>

      {filteredAssets.length === 0 && (
        <div className="p-8 text-center bg-slate-900 rounded-lg border border-slate-700">
          <div className="inline-flex p-4 bg-slate-800 rounded-full mb-4">
            {activeFilter === 'rgb' ? (
              <Coins className="w-8 h-8 text-emerald-400" />
            ) : (
              <Zap className="w-8 h-8 text-blue-400" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            No {activeFilter === 'rgb' ? 'RGB' : 'Spark'} Assets
          </h3>
          <p className="text-sm text-slate-400">
            You don't have any {activeFilter === 'rgb' ? 'RGB' : 'Spark'} assets
            yet.
          </p>
        </div>
      )}
    </div>
  )
}
