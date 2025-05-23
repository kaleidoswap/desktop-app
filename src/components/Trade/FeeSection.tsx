import React from 'react'

import { formatAssetAmountWithPrecision } from '../../helpers/number'
import { mapAssetIdToTicker } from '../../routes/trade/market-maker/assetUtils'
import { NiaAsset } from '../../slices/nodeApi/nodeApi.slice'

interface FeeSectionProps {
  fees: {
    baseFee: number
    variableFee: number
    totalFee: number
    feeRate: number
  }
  quoteResponse: any | null
  toAsset: string
  bitcoinUnit: string
  assets: NiaAsset[]
  displayAsset: (asset: string) => string
}

const MSATS_PER_SAT = 1000

export const FeeSection: React.FC<FeeSectionProps> = ({
  fees,
  quoteResponse,
  toAsset,
  bitcoinUnit,
  assets,
  displayAsset,
}) => {
  if (!fees.totalFee) return null

  const formatFeeAmount = (amount: number) => {
    // Handle BTC differently
    if (quoteResponse?.to_asset === 'BTC' || toAsset === 'BTC') {
      // Convert millisat to sat for BTC
      return formatAssetAmountWithPrecision(
        Math.round(amount / MSATS_PER_SAT),
        'BTC',
        bitcoinUnit,
        assets
      )
    } else if (quoteResponse?.fee?.fee_asset) {
      // Use fee asset for RGB assets
      const feeAssetTicker = mapAssetIdToTicker(
        quoteResponse.fee.fee_asset,
        assets
      )
      return formatAssetAmountWithPrecision(
        amount,
        feeAssetTicker,
        bitcoinUnit,
        assets
      )
    } else {
      // Fallback to default formatting if fee_asset is not available
      return formatAssetAmountWithPrecision(amount, 'BTC', 'MSAT', assets)
    }
  }

  // Determine the fee asset for display
  const getFeeAssetDisplay = () => {
    // Check if we have a quote response with fee_asset info
    if (quoteResponse?.fee?.fee_asset) {
      const feeAssetTicker = mapAssetIdToTicker(
        quoteResponse.fee.fee_asset,
        assets
      )
      return displayAsset(feeAssetTicker)
    } else if (quoteResponse?.to_asset === 'BTC' || toAsset === 'BTC') {
      // If to_asset is BTC, use BTC as fee asset
      return displayAsset('BTC')
    } else {
      // Fallback
      return displayAsset('BTC')
    }
  }

  return (
    <div className="mt-2 p-3 bg-slate-800/80 rounded-lg">
      <h3 className="text-slate-300 text-sm font-medium mb-1">Fees</h3>
      <div className="grid grid-cols-2 gap-1 text-xs">
        <span className="text-slate-400">Base fee:</span>
        <span className="text-slate-200 text-right">
          {formatFeeAmount(fees.baseFee)} {getFeeAssetDisplay()}
        </span>

        <span className="text-slate-400">Variable fee:</span>
        <span className="text-slate-200 text-right">
          {formatFeeAmount(fees.variableFee)} {getFeeAssetDisplay()}
        </span>

        <span className="text-slate-400">Total fee:</span>
        <span className="text-slate-200 text-right">
          {formatFeeAmount(fees.totalFee)} {getFeeAssetDisplay()}
        </span>

        <span className="text-slate-400">Fee rate:</span>
        <span className="text-slate-200 text-right">
          {(fees.feeRate * 100).toFixed(2)}%
        </span>
      </div>

      <div className="mt-2 pt-2 border-t border-slate-700/50">
        <p className="text-slate-400 text-xs">
          ℹ️ Fees are already subtracted from the "to" amount shown above
        </p>
      </div>
    </div>
  )
}
