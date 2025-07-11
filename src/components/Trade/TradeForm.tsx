import { ArrowDownUp } from 'lucide-react'
import React, { useState, useCallback } from 'react'
import { twJoin } from 'tailwind-merge'

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
  const [isSwapping, setIsSwapping] = useState(false)

  const onSwapAssets = useCallback(async () => {
    if (selectedPair && hasChannels && hasTradablePairs && !isSwapInProgress) {
      setIsSwapping(true)
      setIsFromAmountLoading(true)
      setIsToAmountLoading(true)

      const fromAsset = form.getValues().fromAsset
      const toAsset = form.getValues().toAsset
      const currentFromAmount = form.getValues().from
      const currentToAmount = form.getValues().to

      form.setValue('from', '')
      form.setValue('to', '')

      form.setValue('fromAsset', toAsset)
      form.setValue('toAsset', fromAsset)

      await updateMinMaxAmounts()

      const newFromAmount = parseAssetAmount(currentToAmount, toAsset)
      const newToAmount = parseAssetAmount(currentFromAmount, fromAsset)

      form.setValue('from', formatAmount(newFromAmount, toAsset))
      form.setValue('to', formatAmount(newToAmount, fromAsset))

      setIsFromAmountLoading(false)
      setIsToAmountLoading(false)
      setIsSwapping(false)

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

  const formContainerClasses = twJoin(
    'w-full max-w-2xl mx-auto',
    'transition-all duration-500 ease-out',
    'animate-fade-in'
  )

  const formCardClasses = twJoin(
    'bg-gradient-to-br from-slate-900/90 via-slate-900/85 to-slate-800/90',
    'backdrop-blur-2xl',
    'rounded-3xl',
    'border border-slate-700/40',
    'p-6',
    'shadow-2xl shadow-slate-900/50',
    'transition-all duration-500 ease-out',
    'hover:shadow-slate-900/60',
    'hover:border-slate-600/50',
    'group'
  )

  const swapButtonClasses = twJoin(
    'p-3 rounded-2xl',
    'bg-gradient-to-br from-slate-800/90 to-slate-900/90',
    'border',
    'transition-all duration-300 ease-out',
    'transform hover:scale-110 active:scale-95',
    hasChannels && hasTradablePairs && !isSwapInProgress
      ? twJoin(
          'border-blue-500/40 hover:border-blue-400/60',
          'cursor-pointer',
          'hover:shadow-lg hover:shadow-blue-500/20',
          'hover:from-slate-800/95 hover:to-slate-900/95'
        )
      : 'border-slate-700/40 opacity-50 cursor-not-allowed'
  )

  return (
    <div className={formContainerClasses}>
      <div className={formCardClasses}>
        {/* Enhanced Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-slate-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl -z-10"></div>

        <div className="mb-4">
          <MakerSelector onMakerChange={refreshData} />
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="relative">
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

            {/* Enhanced Swap Button */}
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-6 z-10">
              <button
                className={swapButtonClasses}
                disabled={!hasChannels || !hasTradablePairs || isSwapInProgress}
                onClick={() => onSwapAssets()}
                type="button"
              >
                <ArrowDownUp
                  className={twJoin(
                    'w-6 h-6 text-blue-400',
                    'transition-all duration-300',
                    isSwapping
                      ? 'animate-spin text-blue-300'
                      : 'group-hover:text-blue-300'
                  )}
                />
              </button>
            </div>

            <div className="mt-12">
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
                onRefresh={refreshAmounts}
                useEnhancedSelector={true}
                value={form.getValues().to}
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
