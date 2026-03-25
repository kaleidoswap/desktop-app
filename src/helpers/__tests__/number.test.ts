import { describe, it, expect, vi } from 'vitest'

// Mock i18next before importing the module under test
vi.mock('i18next', () => ({
  default: { language: 'en' },
}))

import {
  SATOSHIS_PER_BTC,
  MSATS_PER_SAT,
  msatToSat,
  satToMsat,
  satoshiToBTC,
  BTCtoSatoshi,
  getNumberLocale,
  getBitcoinPrecision,
  getAssetPrecision,
  formatBitcoinAmount,
  parseBitcoinAmount,
  formatAssetAmountWithPrecision,
  parseAssetAmountWithPrecision,
  calculateExchangeRate,
  formatExchangeRate,
  getDisplayAsset,
  formatNumberWithCommas,
  parseNumberWithCommas,
  calculateAndFormatRate,
  numberFormatter,
} from '../number'

// Minimal NiaAsset stub used across tests
const makeAsset = (ticker: string, precision: number) => ({
  added_at: 0,
  asset_id: `id-${ticker}`,
  balance: {
    future: 0,
    offchain_inbound: 0,
    offchain_outbound: 0,
    settled: 0,
    spendable: 0,
  },
  details: null,
  issued_supply: 1_000_000,
  media: null,
  name: ticker,
  precision,
  ticker,
  timestamp: 0,
})

// ─── Constants ────────────────────────────────────────────────────────────────

describe('constants', () => {
  it('SATOSHIS_PER_BTC equals 100_000_000', () => {
    expect(SATOSHIS_PER_BTC).toBe(100_000_000)
  })

  it('MSATS_PER_SAT equals 1000', () => {
    expect(MSATS_PER_SAT).toBe(1000)
  })
})

// ─── Unit conversion helpers ─────────────────────────────────────────────────

describe('msatToSat', () => {
  it('converts millisats to sats', () => {
    expect(msatToSat(3000)).toBe(3)
  })
  it('returns fractional sats for non-multiples', () => {
    expect(msatToSat(1500)).toBe(1.5)
  })
})

describe('satToMsat', () => {
  it('converts sats to millisats', () => {
    expect(satToMsat(5)).toBe(5000)
  })
})

describe('satoshiToBTC', () => {
  it('converts 100_000_000 sats to "1.00000000"', () => {
    expect(satoshiToBTC(100_000_000)).toBe('1.00000000')
  })
  it('converts 1 sat to "0.00000001"', () => {
    expect(satoshiToBTC(1)).toBe('0.00000001')
  })
  it('converts 0 sats to "0.00000000"', () => {
    expect(satoshiToBTC(0)).toBe('0.00000000')
  })
})

describe('BTCtoSatoshi', () => {
  it('converts 1 BTC to 100_000_000 sats', () => {
    expect(BTCtoSatoshi(1)).toBe(100_000_000)
  })
  it('converts 0.00000001 BTC to 1 sat', () => {
    expect(BTCtoSatoshi(0.00000001)).toBe(1)
  })
  it('converts 0 BTC to 0', () => {
    expect(BTCtoSatoshi(0)).toBe(0)
  })
})

// ─── getNumberLocale ──────────────────────────────────────────────────────────

describe('getNumberLocale', () => {
  it('returns en-US for English', () => {
    // i18next is mocked with language = 'en'
    expect(getNumberLocale()).toBe('en-US')
  })
})

// ─── numberFormatter ──────────────────────────────────────────────────────────

describe('numberFormatter.format', () => {
  it('formats to 2 decimal places by default', () => {
    expect(numberFormatter.format(3.14159)).toBe('3.14')
  })
  it('truncates (does not round) to precision', () => {
    expect(numberFormatter.format(3.999)).toBe('3.99')
  })
})

// ─── getBitcoinPrecision ───────────────────────────────────────────────────────

describe('getBitcoinPrecision', () => {
  it('returns 0 for SAT', () => expect(getBitcoinPrecision('SAT')).toBe(0))
  it('returns 0 for lowercase sat', () =>
    expect(getBitcoinPrecision('sat')).toBe(0))
  it('returns 3 for MSAT', () => expect(getBitcoinPrecision('MSAT')).toBe(3))
  it('returns 8 for BTC', () => expect(getBitcoinPrecision('BTC')).toBe(8))
  it('returns 8 for unknown unit', () =>
    expect(getBitcoinPrecision('UNKNOWN')).toBe(8))
  it('returns 8 for empty string (falsy)', () =>
    expect(getBitcoinPrecision('')).toBe(8))
})

// ─── getAssetPrecision ────────────────────────────────────────────────────────

describe('getAssetPrecision', () => {
  const assets = [makeAsset('USDT', 6), makeAsset('ASSET', 2)]

  it('returns 0 for BTC with SAT unit', () => {
    expect(getAssetPrecision('BTC', 'SAT')).toBe(0)
  })
  it('returns 8 for BTC with BTC unit', () => {
    expect(getAssetPrecision('BTC', 'BTC')).toBe(8)
  })
  it('looks up precision from assets array', () => {
    expect(getAssetPrecision('USDT', 'BTC', assets)).toBe(6)
  })
  it('is case-insensitive for asset ticker', () => {
    expect(getAssetPrecision('usdt', 'BTC', assets)).toBe(6)
  })
  it('defaults to 8 when asset not found', () => {
    expect(getAssetPrecision('MISSING', 'BTC', assets)).toBe(8)
  })
  it('returns 8 for empty asset string', () => {
    expect(getAssetPrecision('', 'BTC', assets)).toBe(8)
  })
})

// ─── formatBitcoinAmount ──────────────────────────────────────────────────────

describe('formatBitcoinAmount', () => {
  it('formats sats as integer string with grouping', () => {
    expect(formatBitcoinAmount(1_000_000, 'SAT')).toBe('1,000,000')
  })
  it('rounds sats to the nearest integer', () => {
    expect(formatBitcoinAmount(999.7, 'SAT')).toBe('1,000')
  })
  it('formats BTC with 8 decimal places', () => {
    expect(formatBitcoinAmount(100_000_000, 'BTC')).toBe('1.00000000')
  })
  it('formats small BTC value', () => {
    expect(formatBitcoinAmount(1, 'BTC')).toBe('0.00000001')
  })
})

// ─── parseBitcoinAmount ───────────────────────────────────────────────────────

describe('parseBitcoinAmount', () => {
  it('parses a SAT string to integer', () => {
    expect(parseBitcoinAmount('1,000,000', 'SAT')).toBe(1_000_000)
  })
  it('parses a BTC string to satoshis', () => {
    expect(parseBitcoinAmount('1.00000000', 'BTC')).toBe(100_000_000)
  })
  it('strips non-numeric characters', () => {
    expect(parseBitcoinAmount('0.00000001 BTC', 'BTC')).toBe(1)
  })
})

// ─── formatAssetAmountWithPrecision ──────────────────────────────────────────

describe('formatAssetAmountWithPrecision', () => {
  it('handles precision 0 (SAT) - no division', () => {
    expect(formatAssetAmountWithPrecision(3000, 'BTC', 'SAT')).toBe('3,000')
  })
  it('handles precision 8 (BTC)', () => {
    expect(formatAssetAmountWithPrecision(300_000_000, 'BTC', 'BTC')).toBe(
      '3.00000000'
    )
  })
  it('handles precision 6 for an asset', () => {
    const assets = [makeAsset('USDT', 6)]
    expect(
      formatAssetAmountWithPrecision(1_000_000, 'USDT', 'BTC', assets)
    ).toBe('1.000000')
  })
  it('formats large amounts with thousands separator', () => {
    const assets = [makeAsset('USDT', 6)]
    expect(
      formatAssetAmountWithPrecision(10_000_000_000, 'USDT', 'BTC', assets)
    ).toBe('10,000.000000')
  })
})

// ─── parseAssetAmountWithPrecision ────────────────────────────────────────────

describe('parseAssetAmountWithPrecision', () => {
  it('returns 0 for null', () => {
    expect(parseAssetAmountWithPrecision(null, 'BTC', 'SAT')).toBe(0)
  })
  it('returns 0 for undefined', () => {
    expect(parseAssetAmountWithPrecision(undefined, 'BTC', 'SAT')).toBe(0)
  })
  it('returns 0 for empty string', () => {
    expect(parseAssetAmountWithPrecision('', 'BTC', 'SAT')).toBe(0)
  })
  it('returns 0 for non-numeric string', () => {
    expect(parseAssetAmountWithPrecision('abc', 'BTC', 'BTC')).toBe(0)
  })
  it('parses SAT (precision 0) without multiplication', () => {
    expect(parseAssetAmountWithPrecision('3,000', 'BTC', 'SAT')).toBe(3000)
  })
  it('parses BTC (precision 8) and returns sats', () => {
    expect(parseAssetAmountWithPrecision('1.00000000', 'BTC', 'BTC')).toBe(
      100_000_000
    )
  })
  it('round-trips with formatAssetAmountWithPrecision for precision 6', () => {
    const assets = [makeAsset('USDT', 6)]
    const formatted = formatAssetAmountWithPrecision(
      1_500_000,
      'USDT',
      'BTC',
      assets
    )
    expect(
      parseAssetAmountWithPrecision(formatted, 'USDT', 'BTC', assets)
    ).toBe(1_500_000)
  })
})

// ─── calculateExchangeRate ────────────────────────────────────────────────────

describe('calculateExchangeRate', () => {
  it('returns price directly when no size given', () => {
    expect(calculateExchangeRate(100)).toBe(100)
  })
  it('divides price by size when size is provided', () => {
    expect(calculateExchangeRate(200, 4)).toBe(50)
  })
  it('inverts the rate when isInverted is true', () => {
    expect(calculateExchangeRate(50, undefined, true)).toBe(1 / 50)
  })
  it('falls back to price when size is 0', () => {
    expect(calculateExchangeRate(100, 0)).toBe(100)
  })
})

// ─── formatExchangeRate ───────────────────────────────────────────────────────

describe('formatExchangeRate', () => {
  it('uses minimum precision decimal digits', () => {
    // minimumFractionDigits=precision=2, maximumFractionDigits=4 → "1.50"
    const result = formatExchangeRate(1.5, 2)
    expect(result).toBe('1.50')
  })
  it('shows up to adjustedPrecision digits when needed', () => {
    // precision=2 → adjustedPrecision=4; 1.12345 → "1.1235" (4 dp, rounded)
    const result = formatExchangeRate(1.12345, 2)
    expect(result).toBe('1.1235')
  })
  it('uses specified precision when > 4', () => {
    const result = formatExchangeRate(1.5, 6)
    expect(result).toBe('1.500000')
  })
})

// ─── getDisplayAsset ──────────────────────────────────────────────────────────

describe('getDisplayAsset', () => {
  it('returns SAT when asset is BTC and unit is SAT', () => {
    expect(getDisplayAsset('BTC', 'SAT')).toBe('SAT')
  })
  it('returns BTC when asset is BTC and unit is BTC', () => {
    expect(getDisplayAsset('BTC', 'BTC')).toBe('BTC')
  })
  it('returns the asset unchanged for non-BTC assets', () => {
    expect(getDisplayAsset('USDT', 'SAT')).toBe('USDT')
  })
})

// ─── formatNumberWithCommas ───────────────────────────────────────────────────

describe('formatNumberWithCommas', () => {
  it('adds commas for thousands', () => {
    expect(formatNumberWithCommas(1000000)).toBe('1,000,000')
  })
  it('handles decimal numbers', () => {
    expect(formatNumberWithCommas('1234.56')).toBe('1,234.56')
  })
  it('does not modify small numbers', () => {
    expect(formatNumberWithCommas(999)).toBe('999')
  })
})

// ─── parseNumberWithCommas ────────────────────────────────────────────────────

describe('parseNumberWithCommas', () => {
  it('removes commas', () => {
    expect(parseNumberWithCommas('1,234,567')).toBe('1234567')
  })
  it('returns empty string for null', () => {
    expect(parseNumberWithCommas(null)).toBe('')
  })
  it('returns empty string for undefined', () => {
    expect(parseNumberWithCommas(undefined)).toBe('')
  })
  it('preserves decimal point', () => {
    expect(parseNumberWithCommas('1,234.56')).toBe('1234.56')
  })
})

// ─── calculateAndFormatRate ───────────────────────────────────────────────────

describe('calculateAndFormatRate', () => {
  const pair = { base_asset: 'BTC', quote_asset: 'USDT' }
  const getPrecision = (asset: string) => (asset === 'BTC' ? 8 : 6)

  it('returns "Price not available" when price is null', () => {
    expect(
      calculateAndFormatRate('BTC', 'USDT', null, pair, 'BTC', getPrecision)
    ).toBe('Price not available')
  })

  it('returns "Price not available" when selectedPair is null', () => {
    expect(
      calculateAndFormatRate('BTC', 'USDT', 50000, null, 'BTC', getPrecision)
    ).toBe('Price not available')
  })

  it('computes a non-inverted rate', () => {
    // price = 50_000_000_000 (in USDT base units with precision 6 = 50,000 USDT)
    // rate = price / 10^toPrecision = 50_000_000_000 / 1_000_000 = 50,000
    const result = calculateAndFormatRate(
      'BTC',
      'USDT',
      50_000_000_000,
      pair,
      'BTC',
      getPrecision
    )
    expect(result).toBe('50,000')
  })

  it('computes an inverted rate (USDT -> BTC)', () => {
    const result = calculateAndFormatRate(
      'USDT',
      'BTC',
      50_000_000_000,
      pair,
      'BTC',
      getPrecision
    )
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})
