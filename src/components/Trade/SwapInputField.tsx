import { RefreshCw } from 'lucide-react'
import React, { useEffect } from 'react'

import { logger } from '../../utils/logger'

import { SizeButtons } from './SizeButtons'

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
  assetOptions: { ticker: string; value: string }[]
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
}) => {
  // Log component rendering for debugging
  useEffect(() => {
    logger.debug(
      `SwapInputField rendering: label=${label}, value=${value}, isLoading=${isLoading}, readOnly=${readOnly}`
    )
  }, [label, value, isLoading, readOnly])

  // Force definite boolean value for isLoading to avoid any undefined being treated as falsy
  const isLoadingState = isLoading === true

  return (
    <div className="space-y-3 bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm rounded-lg p-3 border border-slate-700/50 shadow-lg">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="w-1 h-1 rounded-full bg-blue-500"></div>
          <h3 className="text-sm font-semibold text-white">{label}</h3>
        </div>
        {availableAmount && (
          <div
            className={`flex items-center gap-1.5 text-xs text-slate-400 ${amountAnimationClass}`}
          >
            <span className="font-medium">
              {availableAmountLabel}{' '}
              <span className="text-slate-300">{availableAmount}</span>
            </span>
            {onRefresh && (
              <button
                className="p-1 rounded hover:bg-slate-700/50 transition-colors group"
                disabled={disabled}
                onClick={onRefresh}
                title="Refresh amounts"
                type="button"
              >
                <RefreshCw
                  className={`w-3 h-3 group-hover:text-blue-400 transition-colors ${isLoadingState ? 'animate-spin text-blue-400' : ''}`}
                />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Input Section */}
      <div className="flex flex-col sm:flex-row gap-2">
        {isLoadingState && (!readOnly || !value) ? (
          <div
            className={`flex-1 px-3 py-3 bg-slate-900/70 rounded-lg border border-slate-600/50 
                     text-slate-400 min-h-[48px] flex items-center justify-center text-sm font-medium
                     backdrop-blur-sm ${amountAnimationClass}`}
          >
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span>{isLoadingLabel}</span>
            </div>
          </div>
        ) : (
          <input
            className={`flex-1 px-3 py-3 bg-slate-900/70 rounded-lg border border-slate-600/50 
                   text-white text-base font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
                   placeholder:text-slate-500 min-h-[48px] backdrop-blur-sm transition-all duration-200
                   ${readOnly ? 'bg-slate-800/50 text-slate-300 cursor-default' : 'hover:border-slate-500/70'} ${inputAnimationClass}`}
            disabled={disabled}
            onChange={onAmountChange}
            placeholder="0.00"
            readOnly={readOnly}
            type="text"
            value={value}
          />
        )}
        <div className="flex-shrink-0 sm:w-auto w-full">
          <AssetSelect
            disabled={disabled}
            onChange={onAssetChange}
            options={assetOptions}
            value={asset}
          />
        </div>
      </div>

      {/* Footer Section */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {showMinAmount && minAmount && (
            <div className={`text-slate-400 ${amountAnimationClass}`}>
              <span className="text-slate-500">Min:</span>{' '}
              <span className="font-medium text-slate-300">
                {formatAmount(minAmount, asset)} {getDisplayAsset(asset)}
              </span>
            </div>
          )}
          {showMaxHtlc && maxHtlcAmount && asset === 'BTC' && (
            <div className="relative group">
              <span
                className={`text-slate-400 cursor-help border-b border-dotted border-slate-500 hover:text-slate-300 transition-colors ${amountAnimationClass}`}
              >
                <span className="text-slate-500">Max HTLC:</span>{' '}
                <span className="font-medium">
                  {formatAmount(maxHtlcAmount, 'BTC')} {getDisplayAsset('BTC')}
                </span>
              </span>
              <div
                className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 
                        bg-slate-800/95 backdrop-blur-sm text-xs text-slate-200 rounded-lg w-64 hidden group-hover:block
                        shadow-xl border border-slate-600/50 z-20"
              >
                <div className="relative">
                  <div className="text-left space-y-1">
                    <p className="font-medium text-white">
                      Maximum HTLC Amount
                    </p>
                    <p className="text-slate-300">
                      Maximum amount that can be sent in a single payment
                      (HTLC).
                    </p>
                    <p className="text-slate-400 text-xs">
                      This value considers both your available balance and
                      channel capacity limits.
                    </p>
                  </div>
                  <div
                    className="absolute w-1.5 h-1.5 bg-slate-800 rotate-45 
                            left-1/2 bottom-0 transform -translate-x-1/2 translate-y-1/2
                            border-r border-b border-slate-600/50"
                  ></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {showSizeButtons && onSizeClick && (
          <div className="flex-shrink-0">
            <SizeButtons
              disabled={disabled}
              onSizeClick={onSizeClick}
              selectedSize={selectedSize}
            />
          </div>
        )}
      </div>
    </div>
  )
}
