import { RefreshCw } from 'lucide-react'
import React, { useEffect } from 'react'

import { logger } from '../../utils/logger'

import { AssetOptionData } from './AssetSelectionModal'
import { AssetSelectWithModal } from './AssetSelectWithModal'

import { AssetSelect } from './index'

// Enhanced animation classes
const inputAnimationClass = 'transition-all duration-300 ease-out'
const amountAnimationClass = 'transition-all duration-300 ease-out'
const containerAnimationClass = 'transition-all duration-500 ease-out'

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
  maxAmount,
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
  useEffect(() => {
    logger.debug(
      `SwapInputField rendering: label=${label}, value=${value}, isLoading=${isLoading}, readOnly=${readOnly}`
    )
  }, [label, value, isLoading, readOnly])

  const isLoadingState = isLoading === true

  const enhancedAssetOptions: AssetOptionData[] = assetOptions.map(
    (option) => ({
      assetId: option.assetId || option.value,
      label: option.ticker,
      ticker: option.ticker,
      value: option.value,
    })
  )

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onAmountChange) return

    const numericValue = e.target.value.replace(/[^\d.]/g, '')
    const parsedValue = parseFloat(numericValue)

    // If maxAmount is defined and the input value is greater than maxAmount,
    // format maxAmount and use that instead
    if (
      maxAmount !== undefined &&
      !isNaN(parsedValue) &&
      parsedValue > maxAmount
    ) {
      const formattedMaxAmount = formatAmount(maxAmount, asset)
      e.target.value = formattedMaxAmount
    }

    onAmountChange(e)
  }

  return (
    <div className={`group ${containerAnimationClass}`}>
      {/* Main Container - Modern Glassmorphic Design */}
      <div
        className={`
          bg-gradient-to-br from-slate-800/40 via-slate-900/50 to-slate-900/60 
          backdrop-blur-2xl rounded-2xl 
          border border-slate-700/30
          shadow-lg hover:shadow-2xl
          hover:border-slate-600/50 
          ${containerAnimationClass}
          group-hover:scale-[1.01]
          group-hover:from-slate-800/50
          group-hover:to-slate-900/70
        `}
      >
        {/* Enhanced Header Section */}
        <div className="px-5 py-3 border-b border-slate-700/20">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 group-hover:scale-110 transition-transform duration-300"></div>
              <h3 className="text-sm font-semibold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">
                {label}
              </h3>
            </div>
            {availableAmount && (
              <div
                className={`flex items-center gap-2 text-xs ${amountAnimationClass}`}
              >
                <span className="font-medium text-slate-400">
                  {availableAmountLabel}{' '}
                  <span className="text-slate-200 font-semibold group-hover:text-white transition-colors">
                    {availableAmount}
                  </span>
                </span>
                {onRefresh && (
                  <button
                    className="p-1.5 rounded-lg hover:bg-slate-700/60 active:scale-95 transition-all duration-200 group/refresh"
                    disabled={disabled}
                    onClick={onRefresh}
                    title="Refresh amounts"
                    type="button"
                  >
                    <RefreshCw
                      className={`w-4 h-4 text-slate-400 group-hover/refresh:text-blue-400 transition-all duration-200 
                        ${isLoadingState ? 'animate-spin text-blue-400' : ''}`}
                    />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Input Section */}
        <div className="p-4">
          <div className="flex flex-row gap-3">
            {/* Amount Input with Loading State */}
            <div className="flex-1 min-w-0">
              {isLoadingState && (!readOnly || !value) ? (
                <div
                  className={`
                    px-4 py-3 
                    bg-slate-900/50 
                    rounded-xl
                    border border-slate-600/40 
                    text-slate-400 
                    h-12
                    flex items-center justify-center 
                    text-sm font-medium
                    backdrop-blur-sm 
                    ${amountAnimationClass}
                  `}
                >
                  <div className="flex items-center space-x-2.5">
                    <div className="w-4 h-4 border-2 border-blue-500/80 border-t-transparent rounded-full animate-spin"></div>
                    <span className="hidden sm:inline bg-gradient-to-r from-blue-400 to-blue-300 bg-clip-text text-transparent">
                      {isLoadingLabel}
                    </span>
                    <span className="sm:hidden">Loading...</span>
                  </div>
                </div>
              ) : (
                <input
                  className={`
                    w-full px-4 py-3 
                    bg-slate-900/50 
                    rounded-xl
                    border border-slate-600/40 
                    text-white text-lg font-semibold 
                    focus:border-blue-500/60 
                    focus:ring-2 focus:ring-blue-500/20
                    placeholder:text-slate-500 
                    h-12 
                    backdrop-blur-sm 
                    hover:border-slate-500/60 
                    focus:outline-none
                    ${readOnly ? 'bg-slate-800/40 text-slate-300 cursor-default' : ''} 
                    ${inputAnimationClass}
                    group-hover:bg-slate-900/60
                  `}
                  disabled={disabled}
                  onChange={handleAmountChange}
                  placeholder="0.00"
                  readOnly={readOnly}
                  type="text"
                  value={value}
                />
              )}
            </div>

            {/* Enhanced Asset Selector */}
            <div className="flex-shrink-0 w-32 sm:w-36 md:w-40 lg:w-44">
              {useEnhancedSelector ? (
                <AssetSelectWithModal
                  className="w-full h-12"
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

          {/* Enhanced Size Buttons */}
          {showSizeButtons && onSizeClick && (
            <div className="mt-4 pt-4 border-t border-slate-700/20">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-medium text-slate-300">
                  Quick Amount
                </span>
                <span className="text-xs text-slate-500 hidden sm:block">
                  % of available
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[25, 50, 75, 100].map((percentage) => (
                  <button
                    className={`
                      px-2 py-2 
                      rounded-xl 
                      font-medium 
                      text-xs 
                      transition-all 
                      duration-200 
                      border
                      backdrop-blur-sm
                      active:scale-95
                      ${
                        selectedSize === percentage
                          ? 'bg-blue-600/20 border-blue-500/60 text-blue-400 shadow-lg shadow-blue-500/20'
                          : 'bg-slate-800/60 border-slate-600/40 text-slate-400 hover:bg-slate-700/60 hover:border-slate-500/60 hover:text-slate-300'
                      }
                      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-[1.02]'}
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

        {/* Enhanced Footer Section */}
        {(showMinAmount || showMaxHtlc) && (
          <div className="px-4 pb-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
              {showMinAmount && minAmount && (
                <div className={`text-slate-400 ${amountAnimationClass}`}>
                  <span className="text-slate-500">Min:</span>{' '}
                  <span className="font-medium text-slate-200 group-hover:text-white transition-colors">
                    {formatAmount(minAmount, asset)} {getDisplayAsset(asset)}
                  </span>
                </div>
              )}
              {showMaxHtlc && maxHtlcAmount && asset === 'BTC' && (
                <div className="relative group/tooltip">
                  <span
                    className={`
                      text-slate-400 
                      cursor-help 
                      border-b 
                      border-dotted 
                      border-slate-500 
                      hover:text-slate-200 
                      transition-colors 
                      ${amountAnimationClass}
                    `}
                  >
                    <span className="text-slate-500">Max HTLC:</span>{' '}
                    <span className="font-medium group-hover:text-white">
                      {formatAmount(maxHtlcAmount, 'BTC')}{' '}
                      {getDisplayAsset('BTC')}
                    </span>
                  </span>
                  <div
                    className="
                      absolute 
                      bottom-full 
                      left-1/2 
                      transform 
                      -translate-x-1/2 
                      mb-2 
                      px-4 
                      py-2.5
                      bg-slate-800/95 
                      backdrop-blur-sm 
                      text-xs 
                      text-slate-200 
                      rounded-xl 
                      w-64 
                      hidden 
                      group-hover/tooltip:block
                      shadow-2xl 
                      border 
                      border-slate-600/50 
                      z-30
                    "
                  >
                    <div className="relative">
                      Maximum amount that can be sent through this payment
                      channel
                      <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-slate-800/95 border-r border-b border-slate-600/50 rotate-45"></div>
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
