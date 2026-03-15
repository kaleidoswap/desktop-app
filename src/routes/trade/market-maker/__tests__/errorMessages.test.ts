import { describe, it, expect, vi } from 'vitest'

vi.mock('i18next', () => ({ default: { language: 'en' } }))
vi.mock('../../../../slices/makerApi/makerApi.slice', () => ({
  normalizePairs: vi.fn((pairs: any[]) => pairs),
}))
vi.mock('../../../../utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}))

import {
  ASSET_CONFLICT_MESSAGES,
  parseAmountValidationError,
  getValidationError,
  getValidationWarning,
  getFieldError,
} from '../errorMessages'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatAmount = (amount: number, _asset: string) => amount.toLocaleString()
const displayAsset = (asset: string) => asset

// ─── ASSET_CONFLICT_MESSAGES ──────────────────────────────────────────────────

describe('ASSET_CONFLICT_MESSAGES', () => {
  it('CONFLICT_WARNING includes the ticker name', () => {
    expect(ASSET_CONFLICT_MESSAGES.CONFLICT_WARNING('USDT')).toContain('USDT')
  })

  it('TICKER_CONFLICT includes ticker and pair count', () => {
    const msg = ASSET_CONFLICT_MESSAGES.TICKER_CONFLICT(
      'USDT',
      ['id1', 'id2'],
      2
    )
    expect(msg).toContain('USDT')
    expect(msg).toContain('2')
  })

  it('MULTIPLE_CONFLICTS includes conflict count and excluded pair count', () => {
    const msg = ASSET_CONFLICT_MESSAGES.MULTIPLE_CONFLICTS(3, 5, 10)
    expect(msg).toContain('3')
    expect(msg).toContain('5')
    expect(msg).toContain('10')
  })

  it('NO_TRADABLE_PAIRS is a non-empty string', () => {
    expect(typeof ASSET_CONFLICT_MESSAGES.NO_TRADABLE_PAIRS).toBe('string')
    expect(ASSET_CONFLICT_MESSAGES.NO_TRADABLE_PAIRS.length).toBeGreaterThan(0)
  })

  it('NO_VALID_PAIRS is a non-empty string', () => {
    expect(typeof ASSET_CONFLICT_MESSAGES.NO_VALID_PAIRS).toBe('string')
    expect(ASSET_CONFLICT_MESSAGES.NO_VALID_PAIRS.length).toBeGreaterThan(0)
  })
})

// ─── parseAmountValidationError ───────────────────────────────────────────────

describe('parseAmountValidationError', () => {
  it('returns null for unrelated error messages', () => {
    expect(
      parseAmountValidationError(
        'some unrelated error',
        formatAmount,
        displayAsset
      )
    ).toBeNull()
  })

  it('returns a min-order message when got < min', () => {
    const msg =
      'For pair BTC/USDT, the amount must be between 1000 and 5000 but got 500'
    const result = parseAmountValidationError(msg, formatAmount, displayAsset)
    expect(result).not.toBeNull()
    expect(result).toContain('minimum')
  })

  it('returns a max-order message when got > max', () => {
    const msg =
      'For pair BTC/USDT, the amount must be between 1000 and 5000 but got 9000'
    const result = parseAmountValidationError(msg, formatAmount, displayAsset)
    expect(result).not.toBeNull()
    expect(result).toContain('maximum')
  })

  it('returns a fallback message for generic "amount must be between" errors', () => {
    const msg = 'The amount must be between some values'
    const result = parseAmountValidationError(msg, formatAmount, displayAsset)
    expect(result).not.toBeNull()
    expect(result).toContain('amount')
  })

  it('returns null when message does not match any pattern', () => {
    const result = parseAmountValidationError(
      'Network timeout',
      formatAmount,
      displayAsset
    )
    expect(result).toBeNull()
  })
})

// ─── getValidationError ────────────────────────────────────────────────────────

describe('getValidationError', () => {
  const defaults = {
    toAmount: 0,
    maxToAmount: 1_000_000,
    toAsset: 'USDT',
    assets: [],
  }

  it('returns null while quote is loading', () => {
    const result = getValidationError(
      1000,
      defaults.toAmount,
      100,
      10_000,
      defaults.maxToAmount,
      10_000_000,
      'BTC',
      defaults.toAsset,
      formatAmount,
      displayAsset,
      defaults.assets,
      false,
      true // isQuoteLoading = true
    )
    expect(result).toBeNull()
  })

  it('returns null while price is loading', () => {
    const result = getValidationError(
      1000,
      defaults.toAmount,
      100,
      10_000,
      defaults.maxToAmount,
      10_000_000,
      'BTC',
      defaults.toAsset,
      formatAmount,
      displayAsset,
      defaults.assets,
      false,
      false,
      true // isPriceLoading = true
    )
    expect(result).toBeNull()
  })

  it('returns null when missingChannelAsset is set', () => {
    const result = getValidationError(
      1000,
      defaults.toAmount,
      100,
      10_000,
      defaults.maxToAmount,
      10_000_000,
      'BTC',
      defaults.toAsset,
      formatAmount,
      displayAsset,
      defaults.assets,
      false,
      false,
      false,
      { asset: 'USDT', assetId: 'rgb:id', isFromAsset: true }
    )
    expect(result).toBeNull()
  })

  it('returns an insufficient balance error when maxFromAmount is 0', () => {
    const result = getValidationError(
      1000,
      defaults.toAmount,
      100,
      0,
      defaults.maxToAmount,
      10_000_000,
      'BTC',
      defaults.toAsset,
      formatAmount,
      displayAsset
    )
    expect(result).not.toBeNull()
    expect(result).toContain('Insufficient')
  })

  it('returns "enter amount" error when fromAmount is 0', () => {
    const result = getValidationError(
      0,
      defaults.toAmount,
      100,
      10_000,
      defaults.maxToAmount,
      10_000_000,
      'BTC',
      defaults.toAsset,
      formatAmount,
      displayAsset
    )
    expect(result).not.toBeNull()
    expect(result).toContain('enter an amount')
  })

  it('returns a minimum order size error when fromAmount < minFromAmount', () => {
    const result = getValidationError(
      50,
      defaults.toAmount,
      100,
      10_000,
      defaults.maxToAmount,
      10_000_000,
      'BTC',
      defaults.toAsset,
      formatAmount,
      displayAsset
    )
    expect(result).not.toBeNull()
    expect(result).toContain('minimum')
  })

  it('returns an HTLC limit error for BTC when fromAmount > maxOutboundHtlcSat', () => {
    const result = getValidationError(
      2_000_000,
      defaults.toAmount,
      0,
      10_000_000,
      defaults.maxToAmount,
      1_000_000,
      'BTC',
      defaults.toAsset,
      formatAmount,
      displayAsset
    )
    expect(result).not.toBeNull()
    expect(result).toContain('channel constraints')
  })

  it('returns null for valid parameters', () => {
    const result = getValidationError(
      1000,
      defaults.toAmount,
      100,
      10_000,
      defaults.maxToAmount,
      10_000_000,
      'BTC',
      defaults.toAsset,
      formatAmount,
      displayAsset
    )
    expect(result).toBeNull()
  })
})

// ─── getValidationWarning ─────────────────────────────────────────────────────

describe('getValidationWarning', () => {
  it('returns null while loading', () => {
    const result = getValidationWarning(
      5000,
      0,
      10_000,
      100_000,
      'BTC',
      'USDT',
      formatAmount,
      displayAsset,
      [],
      false,
      true // isQuoteLoading
    )
    expect(result).toBeNull()
  })

  it('returns null when missingChannelAsset is set', () => {
    const result = getValidationWarning(
      5000,
      0,
      1000,
      100_000,
      'BTC',
      'USDT',
      formatAmount,
      displayAsset,
      [],
      false,
      false,
      false,
      { asset: 'USDT', assetId: 'rgb:id', isFromAsset: true }
    )
    expect(result).toBeNull()
  })

  it('warns when fromAmount exceeds maxFromAmount', () => {
    const result = getValidationWarning(
      20_000,
      0,
      10_000,
      100_000,
      'BTC',
      'USDT',
      formatAmount,
      displayAsset
    )
    expect(result).not.toBeNull()
    expect(result).toContain('send up to')
  })

  it('warns when toAmount exceeds maxToAmount', () => {
    const result = getValidationWarning(
      500,
      200_000,
      10_000,
      100_000,
      'BTC',
      'USDT',
      formatAmount,
      displayAsset
    )
    expect(result).not.toBeNull()
    expect(result).toContain('receive up to')
  })

  it('returns null when amounts are within bounds', () => {
    const result = getValidationWarning(
      1000,
      500,
      10_000,
      100_000,
      'BTC',
      'USDT',
      formatAmount,
      displayAsset
    )
    expect(result).toBeNull()
  })
})

// ─── getFieldError ────────────────────────────────────────────────────────────

describe('getFieldError', () => {
  it('returns empty string when field has no error', () => {
    expect(getFieldError('from', {})).toBe('')
  })

  it('returns the error message for a field with an error', () => {
    const errors = { from: { message: 'Required field' } }
    expect(getFieldError('from', errors)).toBe('Required field')
  })
})
