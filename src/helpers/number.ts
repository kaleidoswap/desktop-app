import Decimal from 'decimal.js'

import { NiaAsset } from '../slices/nodeApi/nodeApi.slice'

export const SATOSHIS_PER_BTC = 100000000
export const MSATS_PER_SAT = 1000

export const msatToSat = (msats: number): number => msats / MSATS_PER_SAT
export const satToMsat = (sats: number): number => sats * MSATS_PER_SAT

export const numberFormatter = {
  format: (value: number, precision: number = 2) =>
    (Math.floor(value / 0.01) * 0.01).toFixed(precision),
}

export const satoshiToBTC = (value: number): string =>
  new Decimal(value).mul(0.00000001).toFixed(8)

export const BTCtoSatoshi = (value: number): number =>
  new Decimal(value).mul(100000000).toNumber()

export const formatBitcoinAmount = (
  amount: number,
  bitcoinUnit: string,
  precision: number = 8
): string => {
  if (bitcoinUnit === 'SAT') {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
      useGrouping: true,
    }).format(Math.round(amount))
  } else {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: precision,
      minimumFractionDigits: precision,
      useGrouping: true,
    }).format(amount / SATOSHIS_PER_BTC)
  }
}

export const parseBitcoinAmount = (
  amount: string,
  bitcoinUnit: 'BTC' | 'SAT'
): number => {
  const cleanAmount = amount.replace(/[^\d.-]/g, '')
  if (bitcoinUnit === 'SAT') {
    return parseInt(cleanAmount, 10)
  } else {
    return Math.round(parseFloat(cleanAmount) * SATOSHIS_PER_BTC)
  }
}

export const formatAmount = (
  amount: number,
  asset_ticker: string,
  assets: NiaAsset[],
  bitcoinUnit: 'BTC' | 'SAT'
): string => {
  const asset = assets.find((a) => a.ticker === asset_ticker) || {
    precision: 8,
  }
  if (asset_ticker === 'BTC') {
    return formatBitcoinAmount(amount, bitcoinUnit, asset.precision)
  } else {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: asset.precision,
      minimumFractionDigits: asset.precision,
      useGrouping: true,
    }).format(amount / Math.pow(10, asset.precision))
  }
}

export const parseAssetAmount = (
  amount: string,
  asset_ticker: string,
  assets: NiaAsset[],
  bitcoinUnit: 'BTC' | 'SAT'
): number => {
  if (asset_ticker === 'BTC') {
    return parseBitcoinAmount(amount, bitcoinUnit)
  } else {
    const asset = assets.find((a) => a.ticker === asset_ticker) || {
      precision: 8,
    }
    const cleanAmount = amount.replace(/[^\d.-]/g, '')
    return Math.round(parseFloat(cleanAmount) * Math.pow(10, asset.precision))
  }
}

export const formatNumberInput = (value: string, precision: number): string => {
  // Remove all characters except digits and decimal point
  let cleanValue = value.replace(/[^\d.]/g, '')

  // Handle multiple decimal points
  const parts = cleanValue.split('.')
  if (parts.length > 2) {
    cleanValue = parts[0] + '.' + parts.slice(1).join('')
  }

  // If it's just a decimal point or empty, return as is
  if (cleanValue === '.' || !cleanValue) return cleanValue

  // If ends with decimal point, preserve it
  const endsWithDecimal = value.endsWith('.')

  try {
    const num = parseFloat(cleanValue)
    if (isNaN(num)) return ''

    // Don't format if still typing decimals
    if (
      endsWithDecimal ||
      (cleanValue.includes('.') && cleanValue.split('.')[1].length <= precision)
    ) {
      return cleanValue
    }

    // Only format complete numbers
    return num.toLocaleString('en-US', {
      maximumFractionDigits: precision,
      minimumFractionDigits: 0,
    })
  } catch {
    return cleanValue
  }
}

/**
 * Gets the precision for a given asset based on its ticker and bitcoin unit setting
 * @param asset The asset ticker
 * @param bitcoinUnit The bitcoin unit (BTC or SAT)
 * @param assets List of assets with precision information
 * @returns The precision value for the asset
 */
export const getAssetPrecision = (
  asset: string,
  bitcoinUnit: string,
  assets?: NiaAsset[]
): number => {
  // Normalize asset ticker to uppercase for case-insensitive comparison
  const normalizedAsset = asset.toUpperCase()

  // Handle Bitcoin precision based on unit
  if (normalizedAsset === 'BTC') {
    return getBitcoinPrecision(bitcoinUnit)
  }

  // If assets array is provided, look for the asset's precision
  if (assets && assets.length > 0) {
    const assetInfo = assets.find(
      (a) => a.ticker.toUpperCase() === normalizedAsset
    )
    if (assetInfo && typeof assetInfo.precision === 'number') {
      return assetInfo.precision
    }
  }

  // Default precision if asset not found or assets list not provided
  return 8
}

export const getBitcoinPrecision = (bitcoinUnit: string): number => {
  switch (bitcoinUnit.toUpperCase()) {
    case 'SAT':
      return 0
    case 'MSAT':
      return 3
    case 'BTC':
      return 8
    default:
      return 8
  }
}

/**
 * Formats an amount for a specific asset with proper precision
 * @param amount The amount to format (in base units)
 * @param asset The asset ticker
 * @param bitcoinUnit The bitcoin unit (BTC or SAT)
 * @param assets List of assets with precision information
 * @returns Formatted amount string
 */
export const formatAssetAmountWithPrecision = (
  amount: number,
  asset: string,
  bitcoinUnit: string,
  assets?: NiaAsset[]
): string => {
  const precision = getAssetPrecision(asset, bitcoinUnit, assets)

  // For precision 0, the amount is already in base units, no division needed
  // Example: amount = 3000, precision = 0 -> display as "3,000"
  if (precision === 0) {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
      useGrouping: true,
    }).format(amount)
  }

  // For assets with precision > 0, divide by 10^precision to get display units
  // Example: amount = 300000000, precision = 8 -> display as "3.00000000"
  const divisor = Math.pow(10, precision)
  const formattedAmount = (amount / divisor).toFixed(precision)

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: precision,
    minimumFractionDigits: precision,
    useGrouping: true,
  }).format(parseFloat(formattedAmount))
}

/**
 * Parses a string amount for a specific asset with proper precision
 * @param amount The amount string to parse (display format)
 * @param asset The asset ticker
 * @param bitcoinUnit The bitcoin unit (BTC or SAT)
 * @param assets List of assets with precision information
 * @returns Parsed amount as a number (in base units)
 */
export const parseAssetAmountWithPrecision = (
  amount: string | undefined | null,
  asset: string,
  bitcoinUnit: string,
  assets?: NiaAsset[]
): number => {
  const precision = getAssetPrecision(asset, bitcoinUnit, assets)

  // Handle undefined, null or empty string
  if (!amount) {
    return 0
  }

  try {
    // Remove commas and other formatting characters but preserve digits, decimal point and minus sign
    const cleanAmount = amount.replace(/[^\d.-]/g, '')
    const parsedAmount = parseFloat(cleanAmount)

    // Handle NaN or invalid numbers
    if (isNaN(parsedAmount)) {
      return 0
    }

    // For precision 0, the display value is already in base units
    // Example: input "3,000" -> clean "3000" -> return 3000
    if (precision === 0) {
      return Math.round(parsedAmount)
    }

    // For assets with precision > 0, multiply by 10^precision to get base units
    // Example: input "3.00000000" -> clean "3.00000000" -> return 300000000
    const multiplier = Math.pow(10, precision)
    return Math.round(parsedAmount * multiplier)
  } catch (error) {
    return 0
  }
}

/**
 * Calculates the exchange rate between two assets
 * @param price The price from the feed
 * @param size The size from the feed (optional in newer versions)
 * @param isInverted Whether the pair is inverted from the user's perspective
 * @returns The calculated exchange rate
 */
export const calculateExchangeRate = (
  price: number,
  size?: number,
  isInverted?: boolean
): number => {
  // If size is not provided (or is 0), assume price is already the correct rate
  const rate = size && size !== 0 ? price / size : price
  return isInverted ? 1 / rate : rate
}

/**
 * Formats an exchange rate with appropriate precision
 * @param rate The exchange rate to format
 * @param precision The precision to use for formatting
 * @returns Formatted exchange rate string
 */
export const formatExchangeRate = (rate: number, precision: number): string => {
  const adjustedPrecision = precision > 4 ? precision : 4

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: adjustedPrecision,
    minimumFractionDigits: precision,
    useGrouping: true,
  }).format(rate)
}

/**
 * Gets the display asset name based on the asset ticker and bitcoin unit
 * @param asset The asset ticker
 * @param bitcoinUnit The bitcoin unit (BTC or SAT)
 * @returns The display asset name
 */
export const getDisplayAsset = (asset: string, bitcoinUnit: string): string => {
  return asset === 'BTC' && bitcoinUnit === 'SAT' ? 'SAT' : asset
}

/**
 * Formats a number with commas for thousands separator
 * @param value The number to format
 * @returns The formatted number string
 */
export const formatNumberWithCommas = (value: string | number): string => {
  const parts = value.toString().split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return parts.join('.')
}

/**
 * Parses a formatted number string to a plain number string
 * @param value The formatted number string (can be undefined, null, or string)
 * @returns The plain number string
 *  */
export const parseNumberWithCommas = (
  value: string | undefined | null
): string => {
  if (!value) {
    return ''
  }
  return value.replace(/[^\d.]/g, '')
}

/**
 * Calculates and formats the exchange rate for display, handling inversion, precision, and bitcoin units.
 * @param fromAsset The asset being sent
 * @param toAsset The asset being received
 * @param price The price value (from WebSocket)
 * @param selectedPair The selected trading pair (with base/quote info)
 * @param bitcoinUnit The bitcoin unit (BTC, SAT, etc.)
 * @param getAssetPrecision Function to get asset precision
 * @returns Formatted exchange rate string
 */
export const calculateAndFormatRate = (
  fromAsset: string,
  toAsset: string,
  price: number | null,
  selectedPair: { base_asset: string; quote_asset: string } | null,
  bitcoinUnit: string,
  getAssetPrecision: (asset: string) => number
): string => {
  if (!price || !selectedPair) return 'Price not available'

  let rate = price
  const displayFromAsset = fromAsset
  const displayToAsset = toAsset

  const isInverted =
    fromAsset === selectedPair.quote_asset &&
    toAsset === selectedPair.base_asset

  // Get precisions for both assets
  const fromPrecision = getAssetPrecision(displayFromAsset)
  const toPrecision = getAssetPrecision(displayToAsset)

  const fromUnit = displayFromAsset === 'BTC' ? bitcoinUnit : displayFromAsset
  const toUnit = displayToAsset === 'BTC' ? bitcoinUnit : displayToAsset

  // Calculate the rate considering asset precisions
  if (isInverted) {
    // When inverted, we need to show how many fromAsset units per toAsset unit
    // First convert price to base units, then invert and scale by precision difference
    const basePrice = price / Math.pow(10, toPrecision)
    rate = (1 / basePrice) * Math.pow(10, fromPrecision - toPrecision)
  } else {
    // When not inverted, we need to show how many toAsset units per fromAsset unit
    // The price is already in the correct units, just need to adjust for display
    rate = price / Math.pow(10, toPrecision)
  }

  // Handle SAT unit conversion if needed
  if (fromUnit === 'SAT') {
    rate = rate / SATOSHIS_PER_BTC
  } else if (toUnit === 'SAT') {
    rate = rate * SATOSHIS_PER_BTC
  }

  // Determine the appropriate precision for display
  // For small rates (< 0.01), use more precision
  // For large rates, use less precision but at least 2 decimal places
  let displayPrecision = 2
  if (rate < 0.01) {
    displayPrecision = Math.min(Math.max(fromPrecision, toPrecision), 8)
  } else if (rate < 1) {
    displayPrecision = 4
  } else if (rate < 100) {
    displayPrecision = 2
  } else {
    displayPrecision = 0
  }

  // Format the rate with the determined precision
  const formattedRate = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: displayPrecision,
    minimumFractionDigits: displayPrecision,
    useGrouping: true,
  }).format(rate)

  return formattedRate
}
