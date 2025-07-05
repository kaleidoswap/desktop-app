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
    if (isQuoteLoading && !hasValidQuote) return 'Getting Latest Quote...'
    // Prioritize valid quote - if we have one, don't show loading states
    if (!hasValidQuote && (isToAmountLoading || isPriceLoading))
      return 'Preparing Swap...'
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

  const getButtonIcon = () => {
    if (!wsConnected) return '🔌'
    if (isLoading) return '⏳'
    if (!hasChannels) return '📡'
    if (!hasTradablePairs) return '🚫'
    if (errorMessage) return '⚠️'
    if (hasZeroAmount) return '💰'
    if (isSwapInProgress) return '🔄'
    if (!hasValidQuote) return '⏱️'
    // Show refresh icon if quote is loading in background but we have a valid quote
    if (isQuoteLoading && hasValidQuote) return '🔄'
    return '⚡'
  }

  const isDisabled =
    !wsConnected ||
    (isQuoteLoading && !hasValidQuote) || // Only block on quote loading if no valid quote exists
    // Only block on loading states if we don't have a valid quote
    (!hasValidQuote && (isToAmountLoading || isPriceLoading)) ||
    !!errorMessage ||
    !hasChannels ||
    !hasTradablePairs ||
    isSwapInProgress ||
    hasZeroAmount ||
    !hasValidQuote

  const isLoading =
    (isQuoteLoading && !hasValidQuote) || // Only show loading if no valid quote exists
    // Only show loading for amount/price loading if we don't have a valid quote
    (!hasValidQuote && (isToAmountLoading || isPriceLoading)) ||
    isSwapInProgress

  const getButtonVariant = () => {
    if (isDisabled) {
      if (errorMessage) return 'error'
      if (!hasChannels || !hasTradablePairs) return 'warning'
      return 'disabled'
    }
    return 'success'
  }

  const buttonVariant = getButtonVariant()

  const getButtonStyles = () => {
    const baseStyles = `relative w-full py-3.5 px-5 rounded-xl font-bold text-base transition-all duration-300 
                       flex items-center justify-center gap-2.5 min-h-[56px] border-2 backdrop-blur-sm
                       focus:outline-none focus:ring-4 transform-gpu`

    switch (buttonVariant) {
      case 'error':
        return `${baseStyles} bg-gradient-to-r from-red-600/80 to-red-700/80 border-red-500/50 text-red-100
                hover:from-red-500/80 hover:to-red-600/80 hover:border-red-400/60 cursor-not-allowed
                focus:ring-red-500/30`
      case 'warning':
        return `${baseStyles} bg-gradient-to-r from-amber-600/80 to-orange-600/80 border-amber-500/50 text-amber-100
                cursor-not-allowed focus:ring-amber-500/30`
      case 'disabled':
        return `${baseStyles} bg-gradient-to-r from-slate-800/60 to-slate-900/60 border-slate-700/40 text-slate-400 
                cursor-not-allowed focus:ring-slate-500/20`
      case 'success':
        return `${baseStyles} bg-gradient-to-r from-blue-600 to-purple-600 border-blue-500/50 text-white 
                hover:from-blue-500 hover:to-purple-500 hover:border-blue-400/70 hover:scale-[1.02] 
                active:scale-[0.98] cursor-pointer shadow-lg hover:shadow-xl hover:shadow-blue-500/25
                focus:ring-blue-500/40`
      default:
        return baseStyles
    }
  }

  return (
    <div className="relative group">
      {/* Enhanced Glow Effect for Ready State */}
      {buttonVariant === 'success' && (
        <>
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/40 to-purple-500/40 rounded-xl blur-xl opacity-60 group-hover:opacity-80 transition-opacity duration-300"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-xl blur-2xl opacity-40 group-hover:opacity-60 transition-opacity duration-300"></div>
        </>
      )}

      {/* Progress Background for Loading States */}
      {isLoading && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent rounded-xl animate-pulse"></div>
      )}

      <button
        aria-label={getButtonText()}
        className={getButtonStyles()}
        disabled={isDisabled}
        type="submit"
      >
        {/* Loading Spinner */}
        {isLoading && (
          <div className="relative">
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-0 w-5 h-5 border-2 border-current/30 rounded-full"></div>
          </div>
        )}

        {/* Button Icon */}
        {!isLoading && (
          <span aria-hidden="true" className="text-lg" role="img">
            {getButtonIcon()}
          </span>
        )}

        {/* Button Text */}
        <span className="font-bold tracking-wide">{getButtonText()}</span>

        {/* Background Quote Refresh Indicator */}
        {isQuoteLoading && hasValidQuote && buttonVariant === 'success' && (
          <div className="absolute top-2 right-2">
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></div>
          </div>
        )}

        {/* Success State Sparkle Effect */}
        {buttonVariant === 'success' && !isLoading && (
          <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
            <div className="absolute top-2 right-2 w-1 h-1 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 animation-delay-100"></div>
            <div className="absolute top-3 right-7 w-0.5 h-0.5 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 animation-delay-200"></div>
            <div className="absolute bottom-2.5 left-3 w-1 h-1 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 animation-delay-300"></div>
          </div>
        )}
      </button>
    </div>
  )
}
