import { NiaAsset } from '../../../slices/nodeApi/nodeApi.slice'

import { mapAssetIdToTicker, isAssetId } from './assetUtils'

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
