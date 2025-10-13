import {
  Loader2,
  AlertCircle,
  Zap,
  Ban,
  Wallet,
  RefreshCw,
  Plug,
  Clock,
  ShoppingCart,
} from 'lucide-react'
import React from 'react'
import { twJoin } from 'tailwind-merge'

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
  missingChannelAsset?: {
    asset: string
    assetId: string
    isFromAsset: boolean
  } | null
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
  missingChannelAsset = null,
}) => {
  const getButtonText = () => {
    if (!wsConnected) return 'Connecting...'
    if (missingChannelAsset) {
      return `Buy ${missingChannelAsset.asset} in Channel`
    }
    if (isQuoteLoading && !hasValidQuote) return 'Getting Latest Quote...'
    if (!hasValidQuote && (isToAmountLoading || isPriceLoading))
      return 'Preparing Swap...'
    if (!hasChannels) return 'No Channels Available'
    if (!hasTradablePairs) return 'No Tradable Pairs'
    if (errorMessage) {
      if (errorMessage.includes('You can only receive up to')) {
        return 'Exceeds Max Receivable'
      }
      if (errorMessage.includes('awaiting confirmation')) {
        return 'Channel Not Ready'
      }
      return 'Invalid Amount'
    }
    if (hasZeroAmount) return 'Enter Amount'
    if (isSwapInProgress) return 'Swap in Progress...'
    if (!hasValidQuote) return 'Waiting for Quote...'
    return 'Swap Now'
  }

  const getButtonIcon = () => {
    if (!wsConnected) return <Plug className="w-5 h-5" />
    if (missingChannelAsset) return <ShoppingCart className="w-5 h-5" />
    if (isLoading) return <Loader2 className="w-5 h-5 animate-spin" />
    if (!hasChannels) return <Ban className="w-5 h-5" />
    if (!hasTradablePairs) return <Ban className="w-5 h-5" />
    if (errorMessage) return <AlertCircle className="w-5 h-5" />
    if (hasZeroAmount) return <Wallet className="w-5 h-5" />
    if (isSwapInProgress) return <RefreshCw className="w-5 h-5 animate-spin" />
    if (!hasValidQuote) return <Clock className="w-5 h-5" />
    if (isQuoteLoading && hasValidQuote)
      return <RefreshCw className="w-5 h-5 animate-spin" />
    return <Zap className="w-5 h-5" />
  }

  const isDisabled =
    (!wsConnected ||
      (isQuoteLoading && !hasValidQuote) ||
      (!hasValidQuote && (isToAmountLoading || isPriceLoading)) ||
      !!errorMessage ||
      !hasChannels ||
      !hasTradablePairs ||
      isSwapInProgress ||
      hasZeroAmount ||
      !hasValidQuote) &&
    !missingChannelAsset // Allow clicking when channel is missing

  const isLoading =
    (isQuoteLoading && !hasValidQuote) ||
    (!hasValidQuote && (isToAmountLoading || isPriceLoading)) ||
    isSwapInProgress

  const getButtonVariant = () => {
    if (missingChannelAsset) return 'success' // Show as actionable button
    if (isDisabled) {
      if (errorMessage) return 'error'
      if (!hasChannels || !hasTradablePairs) return 'warning'
      return 'disabled'
    }
    return 'success'
  }

  const buttonVariant = getButtonVariant()

  const getButtonStyles = () => {
    const baseStyles = twJoin(
      'relative w-full py-4 px-6 rounded-2xl font-bold text-base',
      'transition-all duration-300 ease-out',
      'flex items-center justify-center gap-3',
      'min-h-[60px] border-2 backdrop-blur-xl',
      'focus:outline-none focus:ring-4 transform-gpu',
      'tracking-wide'
    )

    const variants = {
      disabled: twJoin(
        baseStyles,
        'bg-gradient-to-br from-slate-800/80 via-slate-800/70 to-slate-900/80',
        'border-slate-700/40',
        'text-slate-400',
        'cursor-not-allowed',
        'focus:ring-slate-500/20',
        'shadow-lg shadow-slate-900/30'
      ),
      error: twJoin(
        baseStyles,
        'bg-gradient-to-br from-red-600/90 via-red-600/80 to-red-700/90',
        'border-red-500/50',
        'text-red-50',
        'cursor-not-allowed',
        'focus:ring-red-500/30',
        'shadow-lg shadow-red-900/20'
      ),
      success: twJoin(
        baseStyles,
        'bg-gradient-to-br from-blue-600/90 via-blue-600/80 to-purple-600/90',
        'border-blue-500/50',
        'text-white',
        'hover:from-blue-500/90 hover:via-blue-500/80 hover:to-purple-500/90',
        'hover:border-blue-400/70',
        'hover:scale-[1.02]',
        'active:scale-[0.98]',
        'cursor-pointer',
        'shadow-lg hover:shadow-xl',
        'hover:shadow-blue-500/25',
        'focus:ring-blue-500/40'
      ),
      warning: twJoin(
        baseStyles,
        'bg-gradient-to-br from-amber-600/90 via-amber-600/80 to-orange-600/90',
        'border-amber-500/50',
        'text-amber-50',
        'cursor-not-allowed',
        'focus:ring-amber-500/30',
        'shadow-lg shadow-amber-900/20'
      ),
    }

    return variants[buttonVariant]
  }

  return (
    <div className="relative group">
      {/* Enhanced Glow Effects */}
      {buttonVariant === 'success' && (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 via-blue-400/20 to-purple-500/30 rounded-2xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 via-purple-400/10 to-purple-400/20 rounded-2xl blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100"></div>
        </>
      )}

      {/* Loading State Background Animation */}
      {isLoading && (
        <div className="absolute inset-0 overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shimmer"></div>
        </div>
      )}

      <button
        aria-label={getButtonText()}
        className={getButtonStyles()}
        disabled={isDisabled}
        type="submit"
      >
        {/* Button Icon */}
        <span className="transition-transform duration-300 group-hover:scale-110">
          {getButtonIcon()}
        </span>

        {/* Button Text */}
        <span className="font-bold tracking-wide">{getButtonText()}</span>

        {/* Background Quote Refresh Indicator */}
        {isQuoteLoading && hasValidQuote && buttonVariant === 'success' && (
          <div className="absolute top-2 right-2">
            <div className="w-2 h-2 bg-blue-400/80 rounded-full animate-pulse"></div>
          </div>
        )}

        {/* Success State Sparkle Effects */}
        {buttonVariant === 'success' && !isLoading && (
          <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
            <div className="absolute top-2 right-3 w-1.5 h-1.5 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100"></div>
            <div className="absolute top-4 right-8 w-1 h-1 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-200"></div>
            <div className="absolute bottom-3 left-4 w-1.5 h-1.5 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-300"></div>
          </div>
        )}
      </button>
    </div>
  )
}
