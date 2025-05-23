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
  selectedSize?: number
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
    logger.debug(`SwapInputField rendering: label=${label}, value=${value}, isLoading=${isLoading}, readOnly=${readOnly}`);
  }, [label, value, isLoading, readOnly]);
  
  // Force definite boolean value for isLoading to avoid any undefined being treated as falsy
  const isLoadingState = isLoading === true;

  return (
    <div className="space-y-1.5 bg-slate-800/50 rounded-lg p-2.5">
      <div className="flex justify-between items-center">
        <div className="text-sm font-medium text-slate-400">{label}</div>
        {availableAmount && (
          <div
            className={`flex items-center gap-1 text-xs text-slate-400 ${amountAnimationClass}`}
          >
            <span>
              {availableAmountLabel} {availableAmount}
            </span>
            {onRefresh && (
              <button
                className="p-0.5 rounded hover:bg-slate-700/50 transition-colors"
                disabled={disabled}
                onClick={onRefresh}
                title="Refresh amounts"
                type="button"
              >
                <RefreshCw
                  className={`w-3 h-3 ${isLoadingState ? 'animate-spin' : ''}`}
                />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {isLoadingState && (!readOnly || !value) ? (
          <div
            className={`flex-1 px-3 py-1.5 bg-slate-900/50 rounded-lg border border-slate-700 
                     text-slate-400 min-h-[34px] flex items-center input-loading ${amountAnimationClass}`}
          >
            {isLoadingLabel}
          </div>
        ) : (
          <input
            className={`flex-1 px-3 py-1.5 bg-slate-900/50 rounded-lg border border-slate-700 
                   text-white text-base focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                   placeholder:text-slate-600 min-h-[34px] ${readOnly ? 'bg-slate-800/50 text-slate-300' : ''} ${inputAnimationClass}`}
            disabled={disabled}
            onChange={onAmountChange}
            type="text"
            value={value}
            readOnly={readOnly}
          />
        )}
        <AssetSelect
          disabled={disabled}
          onChange={onAssetChange}
          options={assetOptions}
          value={asset}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {showMinAmount && minAmount && (
          <div className={`text-slate-500 ${amountAnimationClass}`}>
            Min: {formatAmount(minAmount, asset)} {getDisplayAsset(asset)}
          </div>
        )}
        {showMaxHtlc && maxHtlcAmount && asset === 'BTC' && (
          <div className="relative group">
            <span
              className={`text-slate-500 cursor-help border-b border-dotted border-slate-600 ${amountAnimationClass}`}
            >
              Max HTLC: {formatAmount(maxHtlcAmount, 'BTC')}{' '}
              {getDisplayAsset('BTC')}
            </span>
            <div
              className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 
                      bg-slate-800 text-xs text-slate-200 rounded-lg w-64 hidden group-hover:block
                      shadow-lg border border-slate-700 z-10"
            >
              <div className="relative">
                <div className="text-left space-y-1">
                  <p>
                    Maximum amount that can be sent in a single payment (HTLC).
                  </p>
                  <p className="text-slate-400">
                    This value considers both your available balance and channel
                    capacity limits.
                  </p>
                </div>
                <div
                  className="absolute w-2 h-2 bg-slate-800 rotate-45 
                          left-1/2 bottom-0 transform -translate-x-1/2 translate-y-1/2
                          border-r border-b border-slate-700"
                ></div>
              </div>
            </div>
          </div>
        )}

        {showSizeButtons && selectedSize !== undefined && onSizeClick && (
          <div className="ml-auto">
            <SizeButtons
              disabled={disabled}
              onSizeClick={onSizeClick}
              selectedSize={selectedSize}
            />
          </div>
        )}
      </div>
    </div>
  );
};
