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

  return (
    <button
      className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900/50
               text-white rounded-lg font-medium transition-colors flex items-center 
               justify-center gap-2 disabled:cursor-not-allowed text-base min-h-[48px]
               disabled:text-slate-300"
      disabled={
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
      }
      type="submit"
    >
      {getButtonText()}
    </button>
  )
}
