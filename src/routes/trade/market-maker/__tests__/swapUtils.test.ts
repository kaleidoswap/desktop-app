import { describe, it, expect, vi } from 'vitest'

// Mock modules with side effects before importing the module under test
vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('../../../../utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}))
vi.mock('../../../../slices/makerApi/makerApi.slice', () => ({
  getAssetId: vi.fn((asset: any) => asset.ticker),
  normalizePairs: vi.fn((pairs: any[]) => pairs),
}))
vi.mock('i18next', () => ({ default: { language: 'en' } }))

import { validateSwapString } from '../swapUtils'

// ─── validateSwapString ───────────────────────────────────────────────────────

describe('validateSwapString', () => {
  const FROM_AMOUNT = 1_000_000
  const FROM_ASSET = 'BTC'
  const TO_AMOUNT = 50_000_000
  const TO_ASSET = 'rgb:test-usdt-id'
  const PAYMENT_HASH = 'abc123paymenthash'

  const makeSwapString = (
    fromAmount = FROM_AMOUNT,
    fromAsset = FROM_ASSET,
    toAmount = TO_AMOUNT,
    toAsset = TO_ASSET,
    extra = 'extra-data',
    hash = PAYMENT_HASH
  ) => `${fromAmount}/${fromAsset}/${toAmount}/${toAsset}/${extra}/${hash}`

  it('accepts a valid swap string', () => {
    expect(
      validateSwapString(
        makeSwapString(),
        FROM_AMOUNT,
        FROM_ASSET,
        TO_AMOUNT,
        TO_ASSET,
        PAYMENT_HASH
      )
    ).toBe(true)
  })

  it('rejects a swap string with fewer than 6 parts', () => {
    expect(
      validateSwapString(
        '100/BTC/200',
        FROM_AMOUNT,
        FROM_ASSET,
        TO_AMOUNT,
        TO_ASSET,
        PAYMENT_HASH
      )
    ).toBe(false)
  })

  it('rejects a swap string with more than 6 parts', () => {
    const extra = makeSwapString() + '/extra'
    expect(
      validateSwapString(
        extra,
        FROM_AMOUNT,
        FROM_ASSET,
        TO_AMOUNT,
        TO_ASSET,
        PAYMENT_HASH
      )
    ).toBe(false)
  })

  it('rejects when fromAmount does not match', () => {
    expect(
      validateSwapString(
        makeSwapString(9_999_999),
        FROM_AMOUNT,
        FROM_ASSET,
        TO_AMOUNT,
        TO_ASSET,
        PAYMENT_HASH
      )
    ).toBe(false)
  })

  it('rejects when fromAsset does not match', () => {
    expect(
      validateSwapString(
        makeSwapString(FROM_AMOUNT, 'WRONG'),
        FROM_AMOUNT,
        FROM_ASSET,
        TO_AMOUNT,
        TO_ASSET,
        PAYMENT_HASH
      )
    ).toBe(false)
  })

  it('rejects when toAmount does not match', () => {
    expect(
      validateSwapString(
        makeSwapString(FROM_AMOUNT, FROM_ASSET, 1),
        FROM_AMOUNT,
        FROM_ASSET,
        TO_AMOUNT,
        TO_ASSET,
        PAYMENT_HASH
      )
    ).toBe(false)
  })

  it('rejects when toAsset does not match', () => {
    expect(
      validateSwapString(
        makeSwapString(FROM_AMOUNT, FROM_ASSET, TO_AMOUNT, 'wrong-asset'),
        FROM_AMOUNT,
        FROM_ASSET,
        TO_AMOUNT,
        TO_ASSET,
        PAYMENT_HASH
      )
    ).toBe(false)
  })

  it('rejects when payment_hash does not match', () => {
    expect(
      validateSwapString(
        makeSwapString(
          FROM_AMOUNT,
          FROM_ASSET,
          TO_AMOUNT,
          TO_ASSET,
          'extra',
          'wrong-hash'
        ),
        FROM_AMOUNT,
        FROM_ASSET,
        TO_AMOUNT,
        TO_ASSET,
        PAYMENT_HASH
      )
    ).toBe(false)
  })

  it('treats BTC and btc as the same asset (case-insensitive)', () => {
    expect(
      validateSwapString(
        makeSwapString(FROM_AMOUNT, 'btc'),
        FROM_AMOUNT,
        'BTC',
        TO_AMOUNT,
        TO_ASSET,
        PAYMENT_HASH
      )
    ).toBe(true)
  })

  it('treats uppercase BTC in expected and lowercase btc in string as equal', () => {
    expect(
      validateSwapString(
        makeSwapString(FROM_AMOUNT, 'BTC'),
        FROM_AMOUNT,
        'btc',
        TO_AMOUNT,
        TO_ASSET,
        PAYMENT_HASH
      )
    ).toBe(true)
  })
})
