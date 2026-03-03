import { X } from 'lucide-react'
import React from 'react'

import { calculateAndFormatRate } from '../../helpers/number'
import { TradingPair } from '../../slices/makerApi/makerApi.slice'
import { AssetOption } from '../Trade'

interface SwapConfirmationProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  fromAmount: string
  fromAsset: string
  toAmount: string
  toAsset: string
  exchangeRate: number
  selectedPair: TradingPair | null
  bitcoinUnit: string
  getAssetPrecision: (asset: string) => number
  isLoading?: boolean
}

export const SwapConfirmation: React.FC<SwapConfirmationProps> = ({
  isOpen,
  onClose,
  onConfirm,
  fromAmount,
  fromAsset,
  toAmount,
  toAsset,
  exchangeRate,
  selectedPair,
  bitcoinUnit,
  getAssetPrecision,
  isLoading = false,
}) => {
  if (!isOpen) return null

  const getDisplayAsset = (asset: string) => {
    return asset === 'BTC' && bitcoinUnit === 'SAT' ? 'SAT' : asset
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-surface-base border border-border-subtle rounded-2xl max-w-lg w-full mx-4 overflow-hidden">
        <div className="p-6 border-b border-border-subtle">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">Confirm Swap</h3>
            <button
              className="p-2 hover:bg-surface-overlay rounded-lg transition-colors"
              onClick={onClose}
            >
              <X className="w-5 h-5 text-content-secondary" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="bg-surface-overlay/50 rounded-lg p-4 space-y-2">
              <div className="text-sm text-content-secondary">You Send</div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AssetOption ticker={getDisplayAsset(fromAsset)} />
                  <span className="text-2xl font-medium text-white">
                    {fromAmount}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-surface-overlay/50 rounded-lg p-4 space-y-2">
              <div className="text-sm text-content-secondary">You Receive</div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AssetOption ticker={getDisplayAsset(toAsset)} />
                  <span className="text-2xl font-medium text-white">
                    {toAmount}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface-overlay/50 rounded-lg p-4 space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-content-secondary">Exchange Rate</span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-medium">1</span>
                  <AssetOption ticker={getDisplayAsset(fromAsset)} />
                </div>
                <span className="text-content-secondary">=</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-medium">
                    {calculateAndFormatRate(
                      fromAsset,
                      toAsset,
                      exchangeRate,
                      selectedPair
                        ? {
                            ...selectedPair,
                            base_asset: selectedPair.base_asset || '',
                            quote_asset: selectedPair.quote_asset || '',
                          }
                        : null,
                      bitcoinUnit,
                      getAssetPrecision
                    )}
                  </span>
                  <AssetOption ticker={getDisplayAsset(toAsset)} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-border-subtle">
          <div className="flex gap-4">
            <button
              className="flex-1 px-6 py-3 border border-border-default text-content-secondary 
                       rounded-xl hover:bg-surface-overlay transition-colors"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="flex-1 px-6 py-3 bg-primary hover:bg-primary-emphasis
                       disabled:opacity-60 text-primary-foreground rounded-xl font-medium
                       transition-colors disabled:cursor-not-allowed"
              disabled={isLoading}
              onClick={onConfirm}
              type="button"
            >
              {isLoading ? 'Confirming...' : 'Confirm Swap'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
