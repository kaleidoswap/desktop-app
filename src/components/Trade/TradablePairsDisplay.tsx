import { ArrowRightLeft, TrendingUp, Coins, Copy } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { TradingPair } from '../../slices/makerApi/makerApi.slice'

interface TradablePairsDisplayProps {
  pairs: TradingPair[]
  title?: string
  maxPairsToShow?: number
}

export const TradablePairsDisplay: React.FC<TradablePairsDisplayProps> = ({
  pairs,
  title,
  maxPairsToShow = 6,
}) => {
  const { t } = useTranslation()
  const displayTitle = title || t('trade.tradablePairs.title')
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }
  if (pairs.length === 0) {
    return (
      <div className="p-4 bg-surface-overlay/60 rounded-xl border border-border-default/40 w-full max-w-lg">
        <div className="flex items-center justify-center text-content-secondary py-4">
          <Coins className="w-5 h-5 mr-2" />
          <span className="text-sm">{t('trade.tradablePairs.noPairs')}</span>
        </div>
      </div>
    )
  }

  const displayPairs = pairs.slice(0, maxPairsToShow)
  const remainingCount = pairs.length - maxPairsToShow

  return (
    <div className="p-4 bg-surface-overlay/60 rounded-xl border border-border-default/40 w-full max-w-lg">
      <h3 className="text-sm font-semibold text-content-primary mb-3 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-emerald-400" />
        {displayTitle}
        <span className="text-xs text-content-secondary font-normal">
          ({t('trade.tradablePairs.pairCount', { count: pairs.length })})
        </span>
      </h3>

      <div className="grid grid-cols-1 gap-2">
        {displayPairs.map((pair, index) => (
          <div
            className="flex items-center justify-between p-3 bg-surface-high/40 rounded-lg border border-border-default/30"
            key={pair.id || `${pair.base_asset}-${pair.quote_asset}-${index}`}
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">
                  {pair.base_asset}
                </span>
                <ArrowRightLeft className="w-3 h-3 text-content-secondary" />
                <span className="text-sm font-medium text-white">
                  {pair.quote_asset}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-content-secondary">
                <button
                  className="font-mono truncate max-w-[80px] hover:text-blue-400 hover:bg-surface-elevated/30 px-1 py-0.5 rounded transition-colors flex items-center gap-1"
                  onClick={() =>
                    pair.base_asset_id && copyToClipboard(pair.base_asset_id)
                  }
                  title={t('trade.tradablePairs.clickToCopy', {
                    id: pair.base_asset_id,
                  })}
                >
                  {pair.base_asset_id?.slice(0, 8)}...
                  <Copy className="w-2 h-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                <ArrowRightLeft className="w-2 h-2" />
                <button
                  className="font-mono truncate max-w-[80px] hover:text-blue-400 hover:bg-surface-elevated/30 px-1 py-0.5 rounded transition-colors flex items-center gap-1"
                  onClick={() =>
                    pair.quote_asset_id && copyToClipboard(pair.quote_asset_id)
                  }
                  title={t('trade.tradablePairs.clickToCopy', {
                    id: pair.quote_asset_id,
                  })}
                >
                  {pair.quote_asset_id?.slice(0, 8)}...
                  <Copy className="w-2 h-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${pair.is_active ? 'bg-emerald-400' : 'bg-content-tertiary'}`}
              ></div>
              <span className="text-xs text-content-secondary">
                {pair.is_active
                  ? t('trade.tradablePairs.active')
                  : t('trade.tradablePairs.inactive')}
              </span>
            </div>
          </div>
        ))}

        {remainingCount > 0 && (
          <div className="flex items-center justify-center p-2 text-content-secondary text-xs">
            {t('trade.tradablePairs.morePairs', { count: remainingCount })}
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-border-default/30">
        <div className="text-xs text-content-secondary text-center">
          {t('trade.tradablePairs.openChannelHint')}
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
  title,
}) => {
  const { t } = useTranslation()
  const displayTitle = title || t('trade.supportedAssets.title')
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
    <div className="p-4 bg-surface-overlay/60 rounded-xl border border-border-default/40 w-full max-w-lg">
      <h3 className="text-sm font-semibold text-content-primary mb-3 flex items-center gap-2">
        <Coins className="w-4 h-4 text-blue-400" />
        {displayTitle}
        <span className="text-xs text-content-secondary font-normal">
          (
          {t('trade.supportedAssets.assetCount', {
            count: uniqueAssets.length,
          })}
          )
        </span>
      </h3>

      <div className="flex flex-wrap gap-2">
        {uniqueAssets.map((asset, index) => (
          <button
            className="px-3 py-2 bg-surface-high/50 rounded-lg border border-border-default/30 flex flex-col gap-1 hover:bg-surface-elevated/50 hover:border-blue-500/30 transition-colors group"
            key={`${asset.assetId}-${index}`}
            onClick={() => copyToClipboard(asset.assetId)}
            title={t('trade.supportedAssets.clickToCopyAssetId', {
              id: asset.assetId,
            })}
          >
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-white">
                {asset.ticker}
              </span>
              <Copy className="w-3 h-3 text-content-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="text-xs text-content-secondary font-mono group-hover:text-blue-400 transition-colors">
              {asset.assetId?.slice(0, 8)}...
            </span>
          </button>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-border-default/30">
        <div className="text-xs text-content-secondary text-center">
          {t('trade.supportedAssets.tradeHint')}
        </div>
      </div>
    </div>
  )
}
