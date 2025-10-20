import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import React, { useState } from 'react'

import { formatAssetAmountWithPrecision } from '../../helpers/number'
import { mapAssetIdToTicker } from '../../routes/trade/market-maker/assetUtils'
import { TradingPair } from '../../slices/makerApi/makerApi.slice'
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
  tradablePairs?: TradingPair[]
}

const MSATS_PER_SAT = 1000

export const FeeSection: React.FC<FeeSectionProps> = ({
  fees,
  quoteResponse,
  toAsset,
  bitcoinUnit,
  assets,
  displayAsset,
  tradablePairs,
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
      // Use precision directly from quote if available
      // This handles assets not in our listAssets
      if (quoteResponse.fee.fee_asset_precision !== undefined) {
        const precision = quoteResponse.fee.fee_asset_precision
        const divisor = Math.pow(10, precision)
        const formattedAmount = amount / divisor

        // For zero or very small amounts, show minimal decimals
        if (formattedAmount === 0) {
          return '0'
        }

        // Determine the number of significant decimals to show
        const minDecimals =
          formattedAmount < 0.01 ? precision : Math.min(precision, 6)

        return new Intl.NumberFormat('en-US', {
          maximumFractionDigits: precision,
          minimumFractionDigits: minDecimals,
          useGrouping: true,
        }).format(formattedAmount)
      }
      // Fallback to asset-based formatting if precision not in quote
      const feeAssetTicker = mapAssetIdToTicker(
        quoteResponse.fee.fee_asset,
        assets,
        tradablePairs
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
        assets,
        tradablePairs
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
    <div className="group relative z-10 overflow-visible">
      <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/60 backdrop-blur-xl rounded-xl border border-slate-700/30 shadow-lg hover:shadow-xl transition-all duration-300 overflow-visible">
        {/* Compact Header */}
        <div className="px-3 py-2.5 border-b border-slate-700/20">
          <button
            className="w-full flex items-center justify-between text-left hover:text-white transition-colors"
            onClick={() => setIsExpanded(!isExpanded)}
            type="button"
          >
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500"></div>
              <h3 className="text-sm font-semibold text-slate-200">
                Fee Breakdown
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-base font-bold text-white">
                  {formatFeeAmount(fees.totalFee)} {feeAssetDisplay}
                </div>
                <div className="text-xs text-slate-400">
                  {(fees.feeRate * 100).toFixed(2)}% of trade
                </div>
              </div>
              <div className="p-0.5 rounded-md bg-slate-700/50 text-slate-400 group-hover:bg-slate-600/50 transition-colors">
                {isExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </div>
            </div>
          </button>
        </div>

        {/* Expandable Content */}
        <div
          className={`transition-all duration-300 ${isExpanded ? 'max-h-96 overflow-visible' : 'max-h-0 overflow-hidden'}`}
        >
          <div className="p-3 space-y-3 relative">
            {/* Fee Breakdown */}
            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-center justify-between p-2.5 bg-slate-800/40 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  <span className="text-slate-300 font-medium text-sm">
                    Base Fee
                  </span>
                  <div className="group/tooltip relative">
                    <Info className="w-3.5 h-3.5 text-slate-500 cursor-help hover:text-slate-300 transition-colors" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-xs text-slate-100 rounded-lg w-60 opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 shadow-xl border border-slate-600 z-[100] pointer-events-none whitespace-normal">
                      Fixed fee charged regardless of transaction amount
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
                        <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-slate-600"></div>
                        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-transparent border-t-slate-800 -mt-px"></div>
                      </div>
                    </div>
                  </div>
                </div>
                <span className="text-white font-semibold text-sm">
                  {formatFeeAmount(fees.baseFee)} {feeAssetDisplay}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-800/40 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                  <span className="text-slate-300 font-medium text-sm">
                    Variable Fee
                  </span>
                  <div className="group/tooltip relative">
                    <Info className="w-3.5 h-3.5 text-slate-500 cursor-help hover:text-slate-300 transition-colors" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-xs text-slate-100 rounded-lg w-60 opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 shadow-xl border border-slate-600 z-[100] pointer-events-none whitespace-normal">
                      Percentage-based fee calculated on transaction amount
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
                        <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-slate-600"></div>
                        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-transparent border-t-slate-800 -mt-px"></div>
                      </div>
                    </div>
                  </div>
                </div>
                <span className="text-white font-semibold text-sm">
                  {formatFeeAmount(fees.variableFee)} {feeAssetDisplay}
                </span>
              </div>
            </div>

            {/* Total Summary */}
            <div className="p-3 bg-gradient-to-r from-slate-700/40 to-slate-800/40 rounded-lg border border-slate-600/30">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-semibold text-sm">
                  Total Fee
                </span>
                <div className="text-right">
                  <div className="text-lg font-bold text-white">
                    {formatFeeAmount(fees.totalFee)} {feeAssetDisplay}
                  </div>
                  <div className="text-xs text-slate-400">
                    {(fees.feeRate * 100).toFixed(2)}% of trade value
                  </div>
                </div>
              </div>
            </div>

            {/* Compact Important Notice */}
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-blue-500 mt-1.5"></div>
                <div className="flex-1">
                  <p className="text-blue-200 text-xs font-medium mb-1">
                    Fee Deduction
                  </p>
                  <p className="text-blue-300/80 text-xs leading-relaxed">
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
