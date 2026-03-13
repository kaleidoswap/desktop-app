import { RefreshCw } from 'lucide-react'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { logger } from '../../utils/logger'

import { AssetOptionData } from './AssetSelectionModal'
import { AssetSelectWithModal } from './AssetSelectWithModal'

import { AssetSelect } from './index'

const inputAnimationClass = 'transition-all duration-300 ease-out'
const amountAnimationClass = 'transition-all duration-300 ease-out'

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
  showMaxAmount?: boolean
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
  availableAmountLabel,
  maxAmount,
  minAmount,
  maxHtlcAmount,
  isLoading,
  isLoadingLabel,
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
  showMaxAmount = false,
  showMaxHtlc = false,
  showSizeButtons,
  selectedSize,
  onSizeClick,
  readOnly = false,
  useEnhancedSelector = true,
}) => {
  const { t } = useTranslation()
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
    if (parsedValue < 0 || numericValue.startsWith('-')) {
      e.target.value = ''
      onAmountChange(e)
      return
    }
    if (
      maxAmount !== undefined &&
      !isNaN(parsedValue) &&
      parsedValue > maxAmount
    ) {
      e.target.value = formatAmount(maxAmount, asset)
    }
    onAmountChange(e)
  }

  return (
    <div className="bg-surface-overlay/70 rounded-xl border border-border-default/40 hover:border-border-default/60 transition-all duration-300">
      {/* Header row: label | available amount + refresh | size chips */}
      <div className="px-4 py-2 border-b border-border-default/20 flex items-center justify-between gap-2">
        {/* Label */}
        <span className="text-xs font-semibold text-content-tertiary uppercase tracking-wider shrink-0">
          {label}
        </span>

        {/* Right side: available + refresh + size chips */}
        <div className="flex items-center gap-2 min-w-0">
          {availableAmount && (
            <div
              className={`flex items-center gap-1 text-xs ${amountAnimationClass} shrink-0`}
            >
              <span className="text-content-tertiary">
                {availableAmountLabel || t('trade.swapInput.available')}:
              </span>
              <span className="text-content-primary font-medium">
                {availableAmount}
              </span>
              {onRefresh && (
                <button
                  className="p-0.5 rounded hover:bg-surface-high/60 active:scale-95 transition-all duration-200 group/refresh"
                  disabled={disabled}
                  onClick={onRefresh}
                  title={t('trade.swapInput.refreshAmounts')}
                  type="button"
                >
                  <RefreshCw
                    className={`w-3 h-3 text-content-tertiary group-hover/refresh:text-primary transition-colors ${isLoadingState ? 'animate-spin text-primary' : ''}`}
                  />
                </button>
              )}
            </div>
          )}

          {/* Inline size chips */}
          {showSizeButtons && onSizeClick && (
            <div className="flex items-center gap-1">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  className={`px-2 py-0.5 rounded text-xs font-semibold border transition-all duration-150 active:scale-95 ${
                    selectedSize === pct
                      ? 'bg-primary/25 border-primary/50 text-primary'
                      : 'bg-surface-high/40 border-border-default/30 text-content-tertiary hover:text-white hover:border-border-default/60'
                  } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                  disabled={disabled}
                  key={pct}
                  onClick={() => onSizeClick(pct)}
                  type="button"
                >
                  {pct}%
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Input row */}
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Amount */}
        <div className="flex-1 min-w-0">
          {isLoadingState && (!readOnly || !value) ? (
            <div
              className={`px-4 py-2 bg-surface-base/50 rounded-lg border border-border-default/30 h-14 flex items-center gap-2 ${amountAnimationClass}`}
            >
              <div className="w-4 h-4 border-2 border-primary/60 border-t-transparent rounded-full animate-spin shrink-0"></div>
              <span className="text-content-secondary text-sm">
                {isLoadingLabel || t('trade.swapInput.estimating')}
              </span>
            </div>
          ) : (
            <div className="relative">
              <input
                className={`w-full pl-4 pr-16 py-2 bg-surface-base/50 rounded-lg border border-border-default/30 text-white text-2xl font-semibold focus:border-primary/60 focus:ring-2 focus:ring-primary/15 placeholder:text-content-tertiary/50 h-14 hover:border-border-default/50 focus:outline-none ${readOnly ? 'text-content-secondary cursor-default' : ''} ${inputAnimationClass}`}
                disabled={disabled}
                onChange={handleAmountChange}
                placeholder={t('trade.swapInput.placeholder')}
                readOnly={readOnly}
                type="text"
                value={value}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary/50 text-sm font-semibold pointer-events-none select-none tracking-wide">
                {getDisplayAsset(asset)}
              </span>
            </div>
          )}
        </div>

        {/* Asset selector */}
        <div className="shrink-0 w-36">
          {useEnhancedSelector ? (
            <AssetSelectWithModal
              className="w-full h-14"
              disabled={disabled}
              fieldLabel={label}
              onChange={onAssetChange}
              options={enhancedAssetOptions}
              placeholder={t('trade.swapInput.selectAsset')}
              searchPlaceholder={t('trade.swapInput.searchAsset')}
              title={t('trade.swapInput.selectAssetTitle')}
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

      {/* Footer: min/max/htlc info — only when needed */}
      {(showMinAmount || showMaxAmount || showMaxHtlc) && (
        <div className="px-4 pb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-content-tertiary">
          {showMinAmount && minAmount && (
            <span>
              Min:{' '}
              <span className="text-content-secondary font-medium">
                {formatAmount(minAmount, asset)} {getDisplayAsset(asset)}
              </span>
            </span>
          )}
          {showMaxAmount && maxAmount && (
            <span>
              Max:{' '}
              <span className="text-content-secondary font-medium">
                {formatAmount(maxAmount, asset)} {getDisplayAsset(asset)}
              </span>
            </span>
          )}
          {showMaxHtlc && maxHtlcAmount && asset === 'BTC' && (
            <div className="relative group/tooltip">
              <span className="cursor-help border-b border-dotted border-border-subtle hover:text-content-secondary transition-colors">
                Max HTLC:{' '}
                <span className="font-medium">
                  {formatAmount(maxHtlcAmount, 'BTC')} {getDisplayAsset('BTC')}
                </span>
              </span>
              <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-surface-overlay text-xs text-content-primary rounded-xl w-64 hidden group-hover/tooltip:block shadow-2xl border border-border-default/50 z-30">
                {t('trade.swapInput.maxHtlcTooltip')}
                <div className="absolute -bottom-2 left-4 w-2 h-2 bg-surface-overlay border-r border-b border-border-default/50 rotate-45"></div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
