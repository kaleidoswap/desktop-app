import React from 'react'
import { UseFormReturn } from 'react-hook-form'

import {
  SwapInputField,
  ExchangeRateSection,
  SwapButton,
} from '../../../components/Trade'
import { SwapIcon } from '../../../icons/Swap'
import { TradingPair } from '../../../slices/makerApi/makerApi.slice'

import { Fields } from './types'

interface SwapFormProps {
  form: UseFormReturn<Fields>
  fromAssetOptions: { ticker: string; value: string; assetId?: string }[]
  toAssetOptions: { ticker: string; value: string; assetId?: string }[]
  formatAmount: (amount: number, asset: string) => string
  displayAsset: (asset: string) => string
  onSizeClick: (size: number) => void
  onSwapAssets: () => void
  hasChannels: boolean
  hasTradablePairs: boolean
  isSwapInProgress: boolean
  isToAmountLoading: boolean
  isPriceLoading: boolean
  wsConnected: boolean
  minFromAmount: number
  maxFromAmount: number
  maxToAmount: number
  max_outbound_htlc_sat: number
  selectedSize: number
  errorMessage: string | null
  selectedPair: TradingPair | null
  price: number | null
  handleFromAmountChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleToAmountChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleAssetChange: (field: 'fromAsset' | 'toAsset', value: string) => void
  refreshAmounts: () => void
  getAssetPrecision: (asset: string) => number
  bitcoinUnit: string
  copyToClipboard: (text: string) => void
  onSubmit: () => void
}

export const SwapForm: React.FC<SwapFormProps> = ({
  form,
  fromAssetOptions,
  toAssetOptions,
  formatAmount,
  displayAsset,
  onSizeClick,
  onSwapAssets,
  hasChannels,
  hasTradablePairs,
  isSwapInProgress,
  isToAmountLoading,
  isPriceLoading,
  wsConnected,
  minFromAmount,
  maxFromAmount,
  maxToAmount,
  max_outbound_htlc_sat,
  selectedSize,
  errorMessage,
  selectedPair,
  price,
  handleFromAmountChange,
  handleToAmountChange,
  handleAssetChange,
  refreshAmounts,
  getAssetPrecision,
  bitcoinUnit,
  onSubmit,
}) => {
  // Check if either amount is zero or empty
  const fromAmount = form.getValues().from
  const toAmount = form.getValues().to
  const hasZeroAmount =
    !fromAmount || fromAmount === '0' || !toAmount || toAmount === '0'

  // Handle keyDown events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Only handle Enter key
    if (e.key === 'Enter') {
      // Check if this is an input field where Enter is expected behavior
      const target = e.target as HTMLElement
      const isInputField =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

      // If not in a field that needs Enter for its own purpose
      if (!isInputField) {
        // Always prevent default Enter behavior to avoid unwanted form submission
        e.preventDefault()

        // Only proceed with submission if all conditions are met
        if (
          hasChannels &&
          hasTradablePairs &&
          !isSwapInProgress &&
          !isToAmountLoading &&
          !isPriceLoading &&
          wsConnected &&
          !hasZeroAmount &&
          !errorMessage
        ) {
          console.log('Enter key pressed - calling onSubmit')
          e.stopPropagation()
          onSubmit()
        } else {
          console.log('Enter key pressed but form is not valid for submission')
        }
      }
    }
  }

  return (
    <div className="swap-form-container w-full max-w-2xl">
      {/* Main Swap Card */}
      <div className="bg-gradient-to-b from-slate-900/95 to-slate-800/95 backdrop-blur-xl rounded-3xl border border-slate-700/30 shadow-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700/30 bg-gradient-to-r from-slate-800/50 to-slate-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"></div>
              <h2 className="text-lg font-semibold text-white">Swap</h2>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}
              ></div>
              <span className="text-xs text-slate-400">
                {wsConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="p-6">
          <form
            className="space-y-6"
            onKeyDown={handleKeyDown}
            onSubmit={form.handleSubmit(onSubmit)}
          >
            {/* From Input */}
            <div className="space-y-1">
              <SwapInputField
                asset={form.getValues().fromAsset}
                assetOptions={fromAssetOptions}
                availableAmount={`${formatAmount(maxFromAmount, form.getValues().fromAsset)} ${displayAsset(form.getValues().fromAsset)}`}
                availableAmountLabel="Available:"
                disabled={!hasChannels || !hasTradablePairs || isSwapInProgress}
                formatAmount={formatAmount}
                getDisplayAsset={displayAsset}
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
            </div>

            {/* Swap Button */}
            <div className="flex justify-center -my-3 relative z-10">
              <button
                className={`group p-3 rounded-2xl border-4 border-slate-800 bg-gradient-to-br from-slate-800 to-slate-900 transition-all duration-300 hover:scale-110 active:scale-95
                  ${
                    hasChannels && hasTradablePairs && !isSwapInProgress
                      ? 'hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/20 cursor-pointer'
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                onClick={() =>
                  hasChannels &&
                  hasTradablePairs &&
                  !isSwapInProgress &&
                  onSwapAssets()
                }
                type="button"
              >
                <div className="relative">
                  {/* Glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg blur-md opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="relative w-5 h-5 text-slate-300 group-hover:text-white transition-colors">
                    <SwapIcon />
                  </div>
                </div>
              </button>
            </div>

            {/* To Input */}
            <div className="space-y-1">
              <SwapInputField
                asset={form.getValues().toAsset}
                assetOptions={toAssetOptions}
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
            </div>

            {/* Exchange Rate Section */}
            {selectedPair && (
              <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-700/30">
                <ExchangeRateSection
                  bitcoinUnit={bitcoinUnit}
                  formatAmount={formatAmount}
                  fromAsset={form.getValues().fromAsset}
                  getAssetPrecision={getAssetPrecision}
                  isPriceLoading={isPriceLoading}
                  price={price}
                  selectedPair={selectedPair}
                  toAsset={form.getValues().toAsset}
                />
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                  <p className="text-red-400 text-sm font-medium">
                    {errorMessage}
                  </p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <SwapButton
                errorMessage={errorMessage}
                hasChannels={hasChannels}
                hasTradablePairs={hasTradablePairs}
                hasValidQuote={!!selectedPair && !!price}
                hasZeroAmount={hasZeroAmount}
                isPriceLoading={isPriceLoading}
                isSwapInProgress={isSwapInProgress}
                isToAmountLoading={isToAmountLoading}
                wsConnected={wsConnected}
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
