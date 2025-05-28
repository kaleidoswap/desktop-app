import React from 'react'

interface SwapButtonProps {
  wsConnected: boolean
  isToAmountLoading: boolean
  isPriceLoading: boolean
  isQuoteLoading?: boolean
  errorMessage: string | null
  hasChannels: boolean
  hasTradablePairs: boolean
  isSwapInProgress: boolean
  hasZeroAmount?: boolean
  hasValidQuote?: boolean
}

export const SwapButton: React.FC<SwapButtonProps> = ({
  wsConnected,
  isToAmountLoading,
  isPriceLoading,
  isQuoteLoading,
  errorMessage,
  hasChannels,
  hasTradablePairs,
  isSwapInProgress,
  hasZeroAmount = false,
  hasValidQuote = false,
}) => {
  const getButtonText = () => {
    if (!wsConnected) return 'Connecting...'
    if (isQuoteLoading) return 'Getting Latest Quote...'
    if (isToAmountLoading || isPriceLoading) return 'Preparing Swap...'
    if (!hasChannels) return 'No Channels Available'
    if (!hasTradablePairs) return 'No Tradable Pairs'
    if (errorMessage) {
      // Special handling for exceed max receivable error
      if (errorMessage.includes('You can only receive up to')) {
        return 'Exceeds Max Receivable'
      }
      return 'Invalid Amount'
    }
    if (hasZeroAmount) return 'Enter Amount'
    if (isSwapInProgress) return 'Swap in Progress...'
    if (!hasValidQuote) return 'Waiting for Quote...'
    return 'Swap Now'
  }

  const isDisabled =
    !wsConnected ||
    isQuoteLoading ||
    isToAmountLoading ||
    isPriceLoading ||
    !!errorMessage ||
    !hasChannels ||
    !hasTradablePairs ||
    isSwapInProgress ||
    hasZeroAmount ||
    !hasValidQuote

  const isLoading =
    isQuoteLoading || isToAmountLoading || isPriceLoading || isSwapInProgress

  return (
    <div className="relative">
      {/* Glow effect for enabled state */}
      {!isDisabled && (
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/30 to-purple-500/30 rounded-xl blur-lg opacity-75"></div>
      )}

      <button
        className={`relative w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-300 
                   flex items-center justify-center gap-3 min-h-[56px] border-2 backdrop-blur-sm
                   ${
                     isDisabled
                       ? 'bg-slate-800/50 border-slate-700/50 text-slate-400 cursor-not-allowed'
                       : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-blue-500/50 hover:border-blue-400 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
                   }`}
        disabled={isDisabled}
        type="submit"
      >
        {isLoading && (
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
        )}
        <span>{getButtonText()}</span>
      </button>
    </div>
  )
}
