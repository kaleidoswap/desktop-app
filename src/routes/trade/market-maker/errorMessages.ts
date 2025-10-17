import { NiaAsset } from '../../../slices/nodeApi/nodeApi.slice'

import { mapAssetIdToTicker, isAssetId } from './assetUtils'

/**
 * Error message constants for asset conflicts
 */
export const ASSET_CONFLICT_MESSAGES = {
  CONFLICT_WARNING: (ticker: string) =>
    `Warning: Multiple versions of "${ticker}" detected. Only one version will be available for trading.`,

  MULTIPLE_CONFLICTS: (
    conflictCount: number,
    excludedPairs: number,
    validPairs: number
  ) =>
    `Found ${conflictCount} asset conflicts. Excluded ${excludedPairs} trading pairs. ` +
    `${validPairs} valid pairs available for trading.`,

  NO_TRADABLE_PAIRS:
    'No tradable pairs available with this market maker. The maker does not offer trading pairs for assets you have channels with.',

  NO_VALID_PAIRS:
    'No valid trading pairs available after filtering asset conflicts.',

  TICKER_CONFLICT: (ticker: string, assetIds: string[], pairCount: number) =>
    `Asset conflict detected: "${ticker}" has multiple asset IDs (${assetIds.join(', ')}). ` +
    `${pairCount} trading pairs excluded for safety.`,
} as const

/**
 * Parse amount validation error from WebSocket and return user-friendly message
 */
export const parseAmountValidationError = (
  errorMessage: string,
  formatAmount: (amount: number, asset: string) => string,
  displayAsset: (asset: string) => string,
  assets: NiaAsset[] = []
): string | null => {
  // Pattern to match: "For pair BTC/USDT, the amount must be between X and Y but got Z"
  const amountErrorPattern =
    /For pair ([^,]+), the amount must be between (\d+) and (\d+) but got (\d+)/
  const match = errorMessage.match(amountErrorPattern)

  if (match) {
    const [, pairStr, minStr, maxStr, gotStr] = match
    const [fromAsset, _toAsset] = pairStr.split('/')
    const minAmount = parseInt(minStr, 10)
    const maxAmount = parseInt(maxStr, 10)
    const gotAmount = parseInt(gotStr, 10)

    // Convert asset IDs to tickers for display
    const fromDisplayAsset =
      isAssetId(fromAsset) && assets.length > 0
        ? mapAssetIdToTicker(fromAsset, assets)
        : fromAsset

    // Determine which asset is the constraint (since we know the user is setting fromAsset)
    const constraintAsset = fromDisplayAsset

    if (gotAmount < minAmount) {
      return `The minimum order size for ${displayAsset(constraintAsset)} is ${formatAmount(minAmount, constraintAsset)}.`
    } else if (gotAmount > maxAmount) {
      return `The maximum order size for ${displayAsset(constraintAsset)} is ${formatAmount(maxAmount, constraintAsset)}.`
    }
  }

  // Fallback for other amount-related errors
  if (errorMessage.includes('amount must be between')) {
    return 'Invalid amount. Please check the minimum and maximum order sizes for this trading pair.'
  }

  return null
}

/**
 * Gets a validation error message for the current form state
 */
export const getValidationError = (
  fromAmount: number,
  toAmount: number,
  minFromAmount: number,
  maxFromAmount: number,
  maxToAmount: number,
  maxOutboundHtlcSat: number,
  fromAsset: string,
  toAsset: string,
  formatAmount: (amount: number, asset: string) => string,
  displayAsset: (asset: string) => string,
  assets: NiaAsset[] = [],
  isToAmountLoading: boolean = false,
  isQuoteLoading: boolean = false,
  isPriceLoading: boolean = false,
  missingChannelAsset: {
    asset: string
    assetId: string
    isFromAsset: boolean
  } | null = null
): string | null => {
  // Don't show validation errors while any quote-related loading is happening
  if (isToAmountLoading || isQuoteLoading || isPriceLoading) {
    return null
  }

  // If a channel is missing, don't show validation errors
  // The UI will show a "Buy channel" button instead
  if (missingChannelAsset) {
    return null
  }

  // Convert asset IDs to tickers for display in error messages
  const fromDisplayAsset =
    isAssetId(fromAsset) && assets.length > 0
      ? mapAssetIdToTicker(fromAsset, assets)
      : fromAsset

  const toDisplayAsset =
    isAssetId(toAsset) && assets.length > 0
      ? mapAssetIdToTicker(toAsset, assets)
      : toAsset

  // Check if available balance is zero - show error immediately
  if (maxFromAmount === 0) {
    return `Insufficient balance. You don't have any ${displayAsset(fromDisplayAsset)} available to send.`
  }

  // Zero amounts - only check fromAmount during loading
  if (fromAmount === 0) {
    return 'Please enter an amount to send.'
  }

  // Minimum amount check
  if (fromAmount < minFromAmount) {
    return `The minimum order size is ${formatAmount(
      minFromAmount,
      fromDisplayAsset
    )} ${displayAsset(fromDisplayAsset)}.`
  }

  // Maximum amount check
  if (fromAmount > maxFromAmount) {
    // Special case: if max is 0, show a clearer insufficient balance message
    if (maxFromAmount === 0) {
      return `Insufficient balance. You don't have any ${displayAsset(fromDisplayAsset)} available to send.`
    }
    return `You can only send up to ${formatAmount(
      maxFromAmount,
      fromDisplayAsset
    )} ${displayAsset(fromDisplayAsset)}.`
  }

  // Only check maxToAmount if we're not loading any quote-related data
  if (
    !isToAmountLoading &&
    !isQuoteLoading &&
    !isPriceLoading &&
    toAmount > maxToAmount
  ) {
    // Special case: if max is 0, show a clearer message
    if (maxToAmount === 0) {
      return `Unable to receive ${displayAsset(toDisplayAsset)}. No channel capacity available.`
    }
    return `You can only receive up to ${formatAmount(
      maxToAmount,
      toDisplayAsset
    )} ${displayAsset(toDisplayAsset)}.`
  }

  // HTLC limit for BTC
  if (fromAsset === 'BTC' && fromAmount > maxOutboundHtlcSat) {
    return `Due to channel constraints, you can only send up to ${formatAmount(
      maxOutboundHtlcSat,
      'BTC'
    )} ${displayAsset('BTC')} in a single transaction.`
  }

  return null
}

/**
 * Gets a specific validation error for a given field
 * @param field The field name
 * @param errors The current validation errors
 */
export const getFieldError = (
  field: string,
  errors: Record<string, any>
): string => {
  if (!errors[field]) {
    return ''
  }

  return errors[field].message
}
