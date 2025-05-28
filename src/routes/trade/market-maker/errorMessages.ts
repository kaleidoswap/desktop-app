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
  assets: NiaAsset[] = []
): string | null => {
  // Convert asset IDs to tickers for display in error messages
  const fromDisplayAsset =
    isAssetId(fromAsset) && assets.length > 0
      ? mapAssetIdToTicker(fromAsset, assets)
      : fromAsset

  const toDisplayAsset =
    isAssetId(toAsset) && assets.length > 0
      ? mapAssetIdToTicker(toAsset, assets)
      : toAsset

  // Zero amounts
  if (fromAmount === 0) {
    return 'Please enter an amount to send.'
  }

  if (toAmount === 0) {
    return 'The received amount cannot be zero. Try a different amount.'
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
    return `You can only send up to ${formatAmount(
      maxFromAmount,
      fromDisplayAsset
    )} ${displayAsset(fromDisplayAsset)}.`
  }

  if (toAmount > maxToAmount) {
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
