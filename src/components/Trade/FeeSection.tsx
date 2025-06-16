import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import React, { useState } from 'react'

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
  const [isExpanded, setIsExpanded] = useState(false)

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

  const feeAssetDisplay = getFeeAssetDisplay()

  return (
    <div className="group relative z-10">
      <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-700/30 shadow-lg hover:shadow-xl transition-all duration-300 overflow-visible">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-700/20">
          <button
            className="w-full flex items-center justify-between text-left hover:text-white transition-colors"
            onClick={() => setIsExpanded(!isExpanded)}
            type="button"
          >
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500"></div>
              <h3 className="text-base font-semibold text-slate-200">
                Fee Breakdown
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-lg font-bold text-white">
                  {formatFeeAmount(fees.totalFee)} {feeAssetDisplay}
                </div>
                <div className="text-sm text-slate-400">
                  {(fees.feeRate * 100).toFixed(2)}% of trade
                </div>
              </div>
              <div className="p-1 rounded-lg bg-slate-700/50 text-slate-400 group-hover:bg-slate-600/50 transition-colors">
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </div>
          </button>
        </div>

        {/* Expandable Content */}
        <div
          className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-96' : 'max-h-0'}`}
        >
          <div className="p-5 space-y-4">
            {/* Fee Breakdown */}
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between p-3 bg-slate-800/40 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-slate-300 font-medium">Base Fee</span>
                  <div className="group/tooltip relative">
                    <Info className="w-4 h-4 text-slate-500 cursor-help hover:text-slate-300 transition-colors" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900/95 backdrop-blur-sm text-xs text-slate-200 rounded-lg w-64 hidden group-hover/tooltip:block shadow-2xl border border-slate-600/50 z-[9999] pointer-events-none">
                      Fixed fee charged regardless of transaction amount
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900/95"></div>
                    </div>
                  </div>
                </div>
                <span className="text-white font-semibold">
                  {formatFeeAmount(fees.baseFee)} {feeAssetDisplay}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-800/40 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                  <span className="text-slate-300 font-medium">
                    Variable Fee
                  </span>
                  <div className="group/tooltip relative">
                    <Info className="w-4 h-4 text-slate-500 cursor-help hover:text-slate-300 transition-colors" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900/95 backdrop-blur-sm text-xs text-slate-200 rounded-lg w-64 hidden group-hover/tooltip:block shadow-2xl border border-slate-600/50 z-[9999] pointer-events-none">
                      Percentage-based fee calculated on transaction amount
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900/95"></div>
                    </div>
                  </div>
                </div>
                <span className="text-white font-semibold">
                  {formatFeeAmount(fees.variableFee)} {feeAssetDisplay}
                </span>
              </div>
            </div>

            {/* Total Summary */}
            <div className="p-4 bg-gradient-to-r from-slate-700/40 to-slate-800/40 rounded-xl border border-slate-600/30">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-semibold">Total Fee</span>
                <div className="text-right">
                  <div className="text-xl font-bold text-white">
                    {formatFeeAmount(fees.totalFee)} {feeAssetDisplay}
                  </div>
                  <div className="text-sm text-slate-400">
                    {(fees.feeRate * 100).toFixed(2)}% of trade value
                  </div>
                </div>
              </div>
            </div>

            {/* Important Notice */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2"></div>
                <div className="flex-1">
                  <p className="text-blue-200 text-sm font-medium mb-1">
                    Fee Deduction
                  </p>
                  <p className="text-blue-300/80 text-sm leading-relaxed">
                    Fees are automatically deducted from the amount you receive.
                    The displayed "You Receive" amount already accounts for all
                    fees.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
