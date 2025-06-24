import { RefreshCw } from 'lucide-react'
import React, { useEffect } from 'react'

import { logger } from '../../utils/logger'

import { AssetOptionData } from './AssetSelectionModal'
import { AssetSelectWithModal } from './AssetSelectWithModal'

import { AssetSelect } from './index'

// Add animation styles
const inputAnimationClass = 'transition-all duration-200 ease-in-out'
const amountAnimationClass = 'transition-all duration-300 ease-in-out'

interface SwapInputFieldProps {
  label: string
  availableAmount?: string
  availableAmountLabel?: string
  maxAmount?: number
  minAmount?: number
  maxHtlcAmount?: number
  isLoading?: boolean
  isLoadingLabel?: string
  disabled: boolean
  value: string
  asset: string
  assetOptions: { ticker: string; value: string; assetId?: string }[]
  onAmountChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onAssetChange: (value: string) => void
  onRefresh?: () => void
  formatAmount: (amount: number, asset: string) => string
  getDisplayAsset: (asset: string) => string
  showMinAmount?: boolean
  showMaxHtlc?: boolean
  showSizeButtons?: boolean
  selectedSize?: number | undefined
  onSizeClick?: (size: number) => void
  readOnly?: boolean
  useEnhancedSelector?: boolean
}

export const SwapInputField: React.FC<SwapInputFieldProps> = ({
  label,
  availableAmount,
  availableAmountLabel = 'Available:',
  minAmount,
  maxHtlcAmount,
  isLoading,
  isLoadingLabel = 'Estimating...',
  disabled,
  value,
  asset,
  assetOptions,
  onAmountChange,
  onAssetChange,
  onRefresh,
  formatAmount,
  getDisplayAsset,
  showMinAmount = false,
  showMaxHtlc = false,
  showSizeButtons,
  selectedSize,
  onSizeClick,
  readOnly = false,
  useEnhancedSelector = true,
}) => {
  // Log component rendering for debugging
  useEffect(() => {
    logger.debug(
      `SwapInputField rendering: label=${label}, value=${value}, isLoading=${isLoading}, readOnly=${readOnly}`
    )
  }, [label, value, isLoading, readOnly])

  // Force definite boolean value for isLoading to avoid any undefined being treated as falsy
  const isLoadingState = isLoading === true

  // Convert asset options to enhanced format
  const enhancedAssetOptions: AssetOptionData[] = assetOptions.map(
    (option) => ({
      assetId: option.assetId || option.value,
      label: option.ticker,
      ticker: option.ticker,
      value: option.value,
    })
  )

  return (
    <div className="group">
      {/* Main Container */}
      <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-700/30 shadow-lg hover:shadow-xl hover:border-slate-600/50 transition-all duration-300">
        {/* Header Section */}
        <div className="px-5 py-4 border-b border-slate-700/20">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"></div>
              <h3 className="text-base font-semibold text-white">{label}</h3>
            </div>
            {availableAmount && (
              <div
                className={`flex items-center gap-2 text-sm text-slate-400 ${amountAnimationClass}`}
              >
                <span className="font-medium">
                  {availableAmountLabel}{' '}
                  <span className="text-slate-200 font-semibold">
                    {availableAmount}
                  </span>
                </span>
                {onRefresh && (
                  <button
                    className="p-1.5 rounded-lg hover:bg-slate-700/60 transition-all duration-200 group/refresh"
                    disabled={disabled}
                    onClick={onRefresh}
                    title="Refresh amounts"
                    type="button"
                  >
                    <RefreshCw
                      className={`w-4 h-4 text-slate-400 group-hover/refresh:text-blue-400 transition-all duration-200 ${
                        isLoadingState ? 'animate-spin text-blue-400' : ''
                      }`}
                    />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Input Section */}
        <div className="p-5">
          <div className="flex flex-col xl:flex-row gap-4">
            {/* Amount Input */}
            <div className="flex-1">
              {isLoadingState && (!readOnly || !value) ? (
                <div
                  className={`px-4 py-4 bg-slate-900/50 rounded-xl border border-slate-600/40 
                           text-slate-400 h-14 flex items-center justify-center text-base font-medium
                           backdrop-blur-sm ${amountAnimationClass}`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span>{isLoadingLabel}</span>
                  </div>
                </div>
              ) : (
                <input
                  className={`w-full px-4 py-4 bg-slate-900/50 rounded-xl border border-slate-600/40 
                         text-white text-xl font-semibold focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20
                         placeholder:text-slate-500 h-14 backdrop-blur-sm transition-all duration-200
                         hover:border-slate-500/60 focus:outline-none
                         ${readOnly ? 'bg-slate-800/40 text-slate-300 cursor-default' : ''} ${inputAnimationClass}`}
                  disabled={disabled}
                  onChange={onAmountChange}
                  placeholder="0.00"
                  readOnly={readOnly}
                  type="text"
                  value={value}
                />
              )}
            </div>

            {/* Asset Selector */}
            <div className="flex-shrink-0 lg:w-64 xl:w-72">
              {useEnhancedSelector ? (
                <AssetSelectWithModal
                  className="w-full h-14"
                  disabled={disabled}
                  fieldLabel={label}
                  onChange={onAssetChange}
                  options={enhancedAssetOptions}
                  placeholder="Select asset"
                  searchPlaceholder="Search by ticker or asset ID..."
                  title="Select Asset"
                  value={asset}
                />
              ) : (
                <AssetSelect
                  disabled={disabled}
                  onChange={onAssetChange}
                  options={assetOptions}
                  value={asset}
                />
              )}
            </div>
          </div>

          {/* Size Buttons */}
          {showSizeButtons && onSizeClick && (
            <div className="mt-4 pt-4 border-t border-slate-700/20">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-300">
                  Quick Amount
                </span>
                <span className="text-xs text-slate-500 hidden sm:block">
                  % of available
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[25, 50, 75, 100].map((percentage) => (
                  <button
                    className={`px-2 py-2 rounded-lg font-medium text-sm transition-all duration-200 border
                      ${
                        selectedSize === percentage
                          ? 'bg-blue-600/20 border-blue-500/60 text-blue-400 shadow-md shadow-blue-500/20'
                          : 'bg-slate-800/60 border-slate-600/40 text-slate-400 hover:bg-slate-700/60 hover:border-slate-500/60 hover:text-slate-300'
                      }
                      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-[1.02] active:scale-95'}
                    `}
                    disabled={disabled}
                    key={percentage}
                    onClick={() => onSizeClick(percentage)}
                    type="button"
                  >
                    {percentage}%
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Section */}
        {(showMinAmount || showMaxHtlc) && (
          <div className="px-5 pb-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              {showMinAmount && minAmount && (
                <div className={`text-slate-400 ${amountAnimationClass}`}>
                  <span className="text-slate-500">Min:</span>{' '}
                  <span className="font-medium text-slate-200">
                    {formatAmount(minAmount, asset)} {getDisplayAsset(asset)}
                  </span>
                </div>
              )}
              {showMaxHtlc && maxHtlcAmount && asset === 'BTC' && (
                <div className="relative group/tooltip">
                  <span
                    className={`text-slate-400 cursor-help border-b border-dotted border-slate-500 hover:text-slate-200 transition-colors ${amountAnimationClass}`}
                  >
                    <span className="text-slate-500">Max HTLC:</span>{' '}
                    <span className="font-medium">
                      {formatAmount(maxHtlcAmount, 'BTC')}{' '}
                      {getDisplayAsset('BTC')}
                    </span>
                  </span>
                  <div
                    className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 px-4 py-3 
                            bg-slate-800/95 backdrop-blur-sm text-sm text-slate-200 rounded-xl w-72 hidden group-hover/tooltip:block
                            shadow-2xl border border-slate-600/50 z-30"
                  >
                    <div className="relative">
                      <div className="text-left space-y-2">
                        <p className="font-semibold text-white">
                          Maximum HTLC Amount
                        </p>
                        <p className="text-slate-300 leading-relaxed">
                          The maximum amount that can be processed in a single
                          Hash Time-Locked Contract (HTLC) transaction. This
                          limit is set by your Lightning Network channel
                          configuration.
                        </p>
                      </div>
                      {/* Tooltip Arrow */}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-800/95"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
