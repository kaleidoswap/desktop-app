import { Copy } from 'lucide-react'
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
  fromAssetOptions: { ticker: string; value: string }[]
  toAssetOptions: { ticker: string; value: string }[]
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
  selectedPairFeed: any
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
  selectedPairFeed,
  handleFromAmountChange,
  handleToAmountChange,
  handleAssetChange,
  refreshAmounts,
  getAssetPrecision,
  bitcoinUnit,
  copyToClipboard,
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
      <div className="bg-gradient-to-b from-slate-900/80 to-slate-800/80 backdrop-blur-sm rounded-2xl border border-slate-700/50 shadow-lg w-full">
        <div className="p-4">
          <form
            className="space-y-3"
            onKeyDown={handleKeyDown}
            onSubmit={form.handleSubmit(onSubmit)}
          >
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
                onClick={() =>
                  hasChannels &&
                  hasTradablePairs &&
                  !isSwapInProgress &&
                  onSwapAssets()
                }
                type="button"
              >
                <SwapIcon />
              </button>
            </div>

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
              value={form.getValues().to}
            />

            {selectedPair && (
              <ExchangeRateSection
                bitcoinUnit={bitcoinUnit}
                formatAmount={formatAmount}
                fromAsset={form.getValues().fromAsset}
                getAssetPrecision={getAssetPrecision}
                isPriceLoading={isPriceLoading}
                selectedPair={selectedPair}
                selectedPairFeed={selectedPairFeed}
                toAsset={form.getValues().toAsset}
              />
            )}

            {errorMessage && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mt-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-red-500 font-medium">
                      Trade Error
                    </span>
                    <button
                      className="p-1 hover:bg-red-500/10 rounded transition-colors"
                      onClick={() => copyToClipboard(errorMessage)}
                      title="Copy error message"
                    >
                      <Copy className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                  <span className="text-red-400/90 text-sm leading-relaxed">
                    {errorMessage}
                  </span>
                </div>
              </div>
            )}

            <SwapButton
              errorMessage={errorMessage}
              hasChannels={hasChannels}
              hasTradablePairs={hasTradablePairs}
              hasZeroAmount={hasZeroAmount}
              isPriceLoading={isPriceLoading}
              isSwapInProgress={isSwapInProgress}
              isToAmountLoading={isToAmountLoading}
              wsConnected={wsConnected}
            />
          </form>
        </div>
      </div>
    </div>
  )
}
