import React, { useState, useCallback } from 'react'

import { SwapIcon } from '../../icons/Swap'
import { logger } from '../../utils/logger'

import { MakerSelector } from './MakerSelector'
import { SwapInputField } from './SwapInputField'

interface TradeFormProps {
  form: any
  hasChannels: boolean
  hasTradablePairs: boolean
  isSwapInProgress: boolean
  maxFromAmount: number
  maxToAmount: number
  max_outbound_htlc_sat: number
  minFromAmount: number
  selectedSize: number
  selectedPair: any
  formatAmount: (amount: number, asset: string) => string
  displayAsset: (asset: string) => string
  getAssetOptions: (
    excludeAsset: string
  ) => Array<{ ticker: string; value: string }>
  handleAssetChange: (field: 'fromAsset' | 'toAsset', value: string) => void
  handleFromAmountChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleToAmountChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onSizeClick: (size: number) => void
  refreshAmounts: () => void
  refreshData: () => Promise<void>
  onSubmit: () => void
  updateMinMaxAmounts: () => Promise<void>
  parseAssetAmount: (amount: string, asset: string) => number
}

export const TradeForm: React.FC<TradeFormProps> = ({
  form,
  hasChannels,
  hasTradablePairs,
  isSwapInProgress,
  maxFromAmount,
  maxToAmount,
  max_outbound_htlc_sat,
  minFromAmount,
  selectedSize,
  selectedPair,
  formatAmount,
  displayAsset,
  getAssetOptions,
  handleAssetChange,
  handleFromAmountChange,
  handleToAmountChange,
  onSizeClick,
  refreshAmounts,
  refreshData,
  onSubmit,
  updateMinMaxAmounts,
  parseAssetAmount,
}) => {
  const [isFromAmountLoading, setIsFromAmountLoading] = useState(false)
  const [isToAmountLoading, setIsToAmountLoading] = useState(false)

  const onSwapAssets = useCallback(async () => {
    if (selectedPair && hasChannels && hasTradablePairs && !isSwapInProgress) {
      setIsFromAmountLoading(true)
      setIsToAmountLoading(true)

      const fromAsset = form.getValues().fromAsset
      const toAsset = form.getValues().toAsset
      const currentFromAmount = form.getValues().from
      const currentToAmount = form.getValues().to

      // Clear amounts temporarily to show loading state
      form.setValue('from', '')
      form.setValue('to', '')

      form.setValue('fromAsset', toAsset)
      form.setValue('toAsset', fromAsset)

      await updateMinMaxAmounts()

      // Calculate new amounts based on the inverted rate
      const newFromAmount = parseAssetAmount(currentToAmount, toAsset)
      const newToAmount = parseAssetAmount(currentFromAmount, fromAsset)

      // Apply the new amounts with proper formatting
      form.setValue('from', formatAmount(newFromAmount, toAsset))
      form.setValue('to', formatAmount(newToAmount, fromAsset))

      setIsFromAmountLoading(false)
      setIsToAmountLoading(false)

      logger.info('Swapped assets')
    }
  }, [
    selectedPair,
    hasChannels,
    hasTradablePairs,
    isSwapInProgress,
    form,
    updateMinMaxAmounts,
    parseAssetAmount,
    formatAmount,
  ])

  return (
    <div className="swap-form-container w-full max-w-2xl">
      <div className="bg-gradient-to-b from-slate-900/80 to-slate-800/80 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-4 shadow-lg w-full">
        <div className="mb-2">
          <MakerSelector hasNoPairs={false} onMakerChange={refreshData} />
        </div>

        <form className="space-y-3" onSubmit={onSubmit}>
          <SwapInputField
            asset={form.getValues().fromAsset}
            assetOptions={getAssetOptions(form.getValues().toAsset)}
            availableAmount={`${formatAmount(maxFromAmount, form.getValues().fromAsset)} ${displayAsset(form.getValues().fromAsset)}`}
            availableAmountLabel="Available:"
            disabled={!hasChannels || !hasTradablePairs || isSwapInProgress}
            formatAmount={formatAmount}
            getDisplayAsset={displayAsset}
            isLoading={isFromAmountLoading}
            label="You Send"
            maxAmount={maxFromAmount}
            maxHtlcAmount={max_outbound_htlc_sat}
            minAmount={minFromAmount}
            onAmountChange={handleFromAmountChange}
            onAssetChange={(value) => handleAssetChange('fromAsset', value)}
            onRefresh={refreshAmounts}
            onSizeClick={onSizeClick}
            selectedSize={selectedSize}
            showMaxHtlc
            showMinAmount
            showSizeButtons
            useEnhancedSelector={true}
            value={form.getValues().from}
          />

          <div className="flex justify-center my-0">
            <button
              className={`p-1.5 rounded-lg bg-slate-800 border transition-all transform hover:scale-110
                ${
                  hasChannels && hasTradablePairs && !isSwapInProgress
                    ? 'border-blue-500/50 hover:border-blue-500 cursor-pointer'
                    : 'border-slate-700 opacity-50 cursor-not-allowed'
                }`}
              onClick={() => onSwapAssets()}
              type="button"
            >
              <SwapIcon />
            </button>
          </div>

          <SwapInputField
            asset={form.getValues().toAsset}
            assetOptions={getAssetOptions(form.getValues().fromAsset)}
            availableAmount={`${formatAmount(maxToAmount, form.getValues().toAsset)} ${displayAsset(form.getValues().toAsset)}`}
            availableAmountLabel="Can receive up to:"
            disabled={!hasChannels || !hasTradablePairs || isSwapInProgress}
            formatAmount={formatAmount}
            getDisplayAsset={displayAsset}
            isLoading={isToAmountLoading}
            label="You Receive (Estimated)"
            maxAmount={maxToAmount}
            onAmountChange={handleToAmountChange}
            onAssetChange={(value) => handleAssetChange('toAsset', value)}
            useEnhancedSelector={true}
            value={form.getValues().to}
          />
        </form>
      </div>
    </div>
  )
}
