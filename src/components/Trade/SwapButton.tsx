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
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  // Check if we have an unconfirmed channel (channel pending confirmation)
  const hasUnconfirmedChannel = errorMessage?.includes('awaiting confirmation')

  const getButtonText = () => {
    if (!wsConnected) return t('trade.swapButton.connecting')
    // Only show "Buy channel" if there's truly no channel (not just unconfirmed)
    if (missingChannelAsset && !hasUnconfirmedChannel) {
      return t('trade.swapButton.buyChannel', {
        asset: missingChannelAsset.asset,
      })
    }
    if (isQuoteLoading && !hasValidQuote)
      return t('trade.swapButton.gettingQuote')
    if (!hasValidQuote && (isToAmountLoading || isPriceLoading))
      return t('trade.swapButton.preparingSwap')
    if (!hasChannels) return t('trade.swapButton.noChannels')
    if (!hasTradablePairs) return t('trade.swapButton.noTradablePairs')
    if (errorMessage) {
      if (errorMessage.includes('You can only receive up to')) {
        return t('trade.swapButton.exceedsMax')
      }
      if (hasUnconfirmedChannel) {
        return t('trade.swapButton.channelAwaiting')
      }
      return t('trade.swapButton.invalidAmount')
    }
    if (hasZeroAmount) return t('trade.swapButton.enterAmount')
    if (isSwapInProgress) return t('trade.swapButton.swapInProgress')
    if (!hasValidQuote) return t('trade.swapButton.waitingQuote')
    return t('trade.swapButton.swapNow')
  }

  const getButtonIcon = () => {
    if (!wsConnected) return <Plug className="w-5 h-5" />
    // Only show shopping cart if there's truly no channel (not just unconfirmed)
    if (missingChannelAsset && !hasUnconfirmedChannel)
      return <ShoppingCart className="w-5 h-5" />
    if (isLoading) return <Loader2 className="w-5 h-5 animate-spin" />
    if (!hasChannels) return <Ban className="w-5 h-5" />
    if (!hasTradablePairs) return <Ban className="w-5 h-5" />
    if (hasUnconfirmedChannel) return <Clock className="w-5 h-5" />
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
    // Allow clicking when channel is missing BUT NOT when it's just unconfirmed
    !(missingChannelAsset && !hasUnconfirmedChannel)

  const isLoading =
    (isQuoteLoading && !hasValidQuote) ||
    (!hasValidQuote && (isToAmountLoading || isPriceLoading)) ||
    isSwapInProgress

  const getButtonVariant = () => {
    // Only show as actionable (success) if there's truly no channel (not just unconfirmed)
    if (missingChannelAsset && !hasUnconfirmedChannel) return 'success'
    if (isDisabled) {
      if (hasUnconfirmedChannel) return 'warning' // Show warning for unconfirmed channels
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
        'bg-surface-base',
        'border-border-default/25',
        'text-content-disabled',
        'cursor-not-allowed',
        'opacity-60'
      ),
      error: twJoin(
        baseStyles,
        'bg-red-700/80',
        'border-red-600/50',
        'text-red-50',
        'cursor-not-allowed',
        'focus:ring-red-500/30',
        'shadow-md'
      ),
      success: twJoin(
        baseStyles,
        'bg-primary',
        'border-primary/40',
        'text-primary-foreground',
        'hover:opacity-90',
        'hover:scale-[1.01]',
        'active:scale-[0.99]',
        'cursor-pointer',
        'shadow-lg shadow-primary/20'
      ),
      warning: twJoin(
        baseStyles,
        'bg-amber-600/80',
        'border-amber-500/50',
        'text-amber-50',
        'cursor-not-allowed',
        'focus:ring-amber-500/30',
        'shadow-md'
      ),
    }

    return variants[buttonVariant]
  }

  return (
    <button
      aria-label={getButtonText()}
      className={getButtonStyles()}
      disabled={isDisabled}
      type="submit"
    >
      {/* Button Icon */}
      <span className="transition-transform duration-200">
        {getButtonIcon()}
      </span>

      {/* Button Text */}
      <span className="font-bold tracking-wide">{getButtonText()}</span>

      {/* Background Quote Refresh Indicator */}
      {isQuoteLoading && hasValidQuote && buttonVariant === 'success' && (
        <div className="absolute top-2 right-2">
          <div className="w-2 h-2 bg-white/50 rounded-full animate-pulse"></div>
        </div>
      )}
    </button>
  )
}
