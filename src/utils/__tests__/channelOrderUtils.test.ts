import { describe, it, expect } from 'vitest'
import {
  extractErrorMessage,
  buildChannelOrderPayload,
  validateChannelParams,
  formatRtkQueryError,
} from '../channelOrderUtils'
import type {
  AssetInfo,
  CreateChannelOrderParams,
  LspOptions,
} from '../channelOrderUtils'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_PARAMS: CreateChannelOrderParams = {
  capacitySat: 500_000,
  clientBalanceSat: 100_000,
  channelExpireBlocks: 4032,
  clientPubKey: 'abc123pubkey',
  addressRefund: 'bc1qrefundaddress',
}

const LSP_OPTIONS: LspOptions = {
  min_required_channel_confirmations: 3,
  min_funding_confirms_within_blocks: 1,
  min_onchain_payment_confirmations: 6,
  supports_zero_channel_reserve: false,
  min_onchain_payment_size_sat: 1000,
  max_channel_expiry_blocks: 6048,
  min_initial_client_balance_sat: 10_000,
  max_initial_client_balance_sat: 1_000_000,
  min_initial_lsp_balance_sat: 0,
  max_initial_lsp_balance_sat: 5_000_000,
  min_channel_balance_sat: 20_000,
  max_channel_balance_sat: 10_000_000,
}

const ASSET: AssetInfo = {
  name: 'Test Token',
  ticker: 'TEST',
  asset_id: 'rgb:test-asset-id',
  precision: 8,
  min_initial_client_amount: 0,
  max_initial_client_amount: 100_000_000,
  min_initial_lsp_amount: 0,
  max_initial_lsp_amount: 100_000_000,
  min_channel_amount: 1_000_000,
  max_channel_amount: 500_000_000,
}

// ─── extractErrorMessage ──────────────────────────────────────────────────────

describe('extractErrorMessage', () => {
  it('returns string errors directly', () => {
    expect(extractErrorMessage('something went wrong')).toBe(
      'something went wrong'
    )
  })

  it('extracts "message" field from an object', () => {
    expect(extractErrorMessage({ message: 'bad request' })).toBe('bad request')
  })

  it('extracts "error" field from an object', () => {
    expect(extractErrorMessage({ error: 'not found' })).toBe('not found')
  })

  it('extracts "detail" field from an object', () => {
    expect(extractErrorMessage({ detail: 'forbidden' })).toBe('forbidden')
  })

  it('recurses into nested error objects', () => {
    expect(extractErrorMessage({ error: { message: 'inner error' } })).toBe(
      'inner error'
    )
  })

  it('extracts from the first element of an array', () => {
    expect(extractErrorMessage([{ message: 'first item error' }])).toBe(
      'first item error'
    )
  })

  it('stringifies unknown objects and truncates at 200 chars', () => {
    const big: Record<string, string> = {}
    for (let i = 0; i < 50; i++) big[`key${i}`] = `value${i}`
    const result = extractErrorMessage(big)
    expect(result.length).toBeLessThanOrEqual(203) // 200 + "..."
    expect(result.endsWith('...')).toBe(true)
  })

  it('returns "Unknown error format" for null', () => {
    expect(extractErrorMessage(null)).toBe('Unknown error format')
  })
})

// ─── buildChannelOrderPayload ─────────────────────────────────────────────────

describe('buildChannelOrderPayload', () => {
  it('builds a minimal payload correctly', () => {
    const payload = buildChannelOrderPayload(BASE_PARAMS)
    expect(payload.client_pubkey).toBe(BASE_PARAMS.clientPubKey)
    expect(payload.client_balance_sat).toBe(100_000)
    expect(payload.lsp_balance_sat).toBe(400_000) // capacity - clientBalance
    expect(payload.channel_expiry_blocks).toBe(4032)
    expect(payload.announce_channel).toBe(true)
    expect(payload.refund_onchain_address).toBe(BASE_PARAMS.addressRefund)
  })

  it('uses lspOptions values for confirmation fields', () => {
    const payload = buildChannelOrderPayload({
      ...BASE_PARAMS,
      lspOptions: LSP_OPTIONS,
    })
    expect(payload.required_channel_confirmations).toBe(3)
    expect(payload.funding_confirms_within_blocks).toBe(1)
  })

  it('falls back to defaults when lspOptions is absent', () => {
    const payload = buildChannelOrderPayload(BASE_PARAMS)
    expect(payload.required_channel_confirmations).toBe(3)
    expect(payload.funding_confirms_within_blocks).toBe(1)
  })

  it('omits asset fields when assetId is not provided', () => {
    const payload = buildChannelOrderPayload(BASE_PARAMS)
    expect(payload.asset_id).toBeUndefined()
    expect(payload.lsp_asset_amount).toBeUndefined()
    expect(payload.client_asset_amount).toBeUndefined()
    expect(payload.rfq_id).toBeUndefined()
  })

  it('includes asset_id when provided', () => {
    const payload = buildChannelOrderPayload({
      ...BASE_PARAMS,
      assetId: ASSET.asset_id,
    })
    expect(payload.asset_id).toBe(ASSET.asset_id)
  })

  it('includes lsp_asset_amount when positive', () => {
    const payload = buildChannelOrderPayload({
      ...BASE_PARAMS,
      assetId: ASSET.asset_id,
      lspAssetAmount: 5_000_000,
    })
    expect(payload.lsp_asset_amount).toBe(5_000_000)
  })

  it('omits lsp_asset_amount when zero', () => {
    const payload = buildChannelOrderPayload({
      ...BASE_PARAMS,
      assetId: ASSET.asset_id,
      lspAssetAmount: 0,
    })
    expect(payload.lsp_asset_amount).toBeUndefined()
  })

  it('includes client_asset_amount when positive', () => {
    const payload = buildChannelOrderPayload({
      ...BASE_PARAMS,
      assetId: ASSET.asset_id,
      clientAssetAmount: 2_000_000,
    })
    expect(payload.client_asset_amount).toBe(2_000_000)
  })

  it('includes rfq_id when provided with an asset', () => {
    const payload = buildChannelOrderPayload({
      ...BASE_PARAMS,
      assetId: ASSET.asset_id,
      rfqId: 'rfq-xyz-123',
    })
    expect(payload.rfq_id).toBe('rfq-xyz-123')
  })

  it('does not include rfq_id without an assetId', () => {
    const payload = buildChannelOrderPayload({
      ...BASE_PARAMS,
      rfqId: 'rfq-xyz-123',
    })
    expect(payload.rfq_id).toBeUndefined()
  })
})

// ─── validateChannelParams ────────────────────────────────────────────────────

describe('validateChannelParams', () => {
  const MIN_CAPACITY = 100_000
  const MAX_CAPACITY = 5_000_000

  it('returns isValid: true for valid parameters', () => {
    const result = validateChannelParams(
      BASE_PARAMS,
      [],
      MIN_CAPACITY,
      MAX_CAPACITY
    )
    expect(result.isValid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('rejects capacity below minimum', () => {
    const result = validateChannelParams(
      { ...BASE_PARAMS, capacitySat: 50_000 },
      [],
      MIN_CAPACITY,
      MAX_CAPACITY
    )
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('100,000')
  })

  it('rejects capacity above maximum', () => {
    const result = validateChannelParams(
      { ...BASE_PARAMS, capacitySat: 10_000_000 },
      [],
      MIN_CAPACITY,
      MAX_CAPACITY
    )
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('5,000,000')
  })

  it('rejects client balance below lsp minimum', () => {
    const result = validateChannelParams(
      { ...BASE_PARAMS, clientBalanceSat: 5_000, lspOptions: LSP_OPTIONS },
      [],
      MIN_CAPACITY,
      MAX_CAPACITY
    )
    expect(result.isValid).toBe(false)
    // The error message uses raw number formatting (no commas)
    expect(result.error).toContain('10000')
  })

  it('rejects client balance above lsp maximum', () => {
    const result = validateChannelParams(
      { ...BASE_PARAMS, clientBalanceSat: 2_000_000, lspOptions: LSP_OPTIONS },
      [],
      MIN_CAPACITY,
      MAX_CAPACITY
    )
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('1000000')
  })

  it('rejects when client balance exceeds capacity', () => {
    const result = validateChannelParams(
      { ...BASE_PARAMS, clientBalanceSat: 600_000 },
      [],
      MIN_CAPACITY,
      MAX_CAPACITY
    )
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('cannot be greater than capacity')
  })

  it('rejects channel expiry beyond lsp maximum', () => {
    const result = validateChannelParams(
      { ...BASE_PARAMS, channelExpireBlocks: 10_000, lspOptions: LSP_OPTIONS },
      [],
      MIN_CAPACITY,
      MAX_CAPACITY
    )
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('6048')
  })

  it('rejects an unknown asset id', () => {
    const result = validateChannelParams(
      { ...BASE_PARAMS, assetId: 'unknown-id' },
      [ASSET],
      MIN_CAPACITY,
      MAX_CAPACITY
    )
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('not supported')
  })

  it('rejects lsp_asset_amount below asset minimum', () => {
    const result = validateChannelParams(
      { ...BASE_PARAMS, assetId: ASSET.asset_id, lspAssetAmount: 500_000 },
      [ASSET],
      MIN_CAPACITY,
      MAX_CAPACITY
    )
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('at least')
  })

  it('rejects lsp_asset_amount above asset maximum', () => {
    const result = validateChannelParams(
      {
        ...BASE_PARAMS,
        assetId: ASSET.asset_id,
        lspAssetAmount: 1_000_000_000,
      },
      [ASSET],
      MIN_CAPACITY,
      MAX_CAPACITY
    )
    expect(result.isValid).toBe(false)
    expect(result.error).toContain('cannot exceed')
  })

  it('accepts valid asset parameters', () => {
    const result = validateChannelParams(
      { ...BASE_PARAMS, assetId: ASSET.asset_id, lspAssetAmount: 10_000_000 },
      [ASSET],
      MIN_CAPACITY,
      MAX_CAPACITY
    )
    expect(result.isValid).toBe(true)
  })
})

// ─── formatRtkQueryError ──────────────────────────────────────────────────────

describe('formatRtkQueryError', () => {
  it('handles FETCH_ERROR status', () => {
    const result = formatRtkQueryError({
      status: 'FETCH_ERROR',
      error: 'TypeError: Failed to fetch',
    })
    expect(result).toContain('Network error')
  })

  it('handles TIMEOUT_ERROR status', () => {
    const result = formatRtkQueryError({
      status: 'TIMEOUT_ERROR',
      error: 'timeout',
    })
    expect(result).toContain('timeout')
  })

  it('handles PARSING_ERROR status', () => {
    const result = formatRtkQueryError({
      status: 'PARSING_ERROR',
      error: 'bad json',
      originalStatus: 200,
      data: '',
    })
    expect(result).toContain('parsing error')
  })

  it('handles 400 client error with message in data', () => {
    const result = formatRtkQueryError({
      status: 400,
      data: { message: 'bad params' },
    })
    expect(result).toContain('400')
    expect(result).toContain('bad params')
  })

  it('handles 401 with no data message', () => {
    const result = formatRtkQueryError({ status: 401, data: null })
    expect(result).toContain('401')
    expect(result).toContain('Authentication')
  })

  it('handles 403', () => {
    const result = formatRtkQueryError({ status: 403, data: null })
    expect(result).toContain('403')
    expect(result).toContain('forbidden')
  })

  it('handles 404', () => {
    const result = formatRtkQueryError({ status: 404, data: null })
    expect(result).toContain('404')
    expect(result).toContain('not found')
  })

  it('handles 422', () => {
    const result = formatRtkQueryError({ status: 422, data: null })
    expect(result).toContain('422')
  })

  it('handles 429', () => {
    const result = formatRtkQueryError({ status: 429, data: null })
    expect(result).toContain('429')
    expect(result).toContain('Too many')
  })

  it('handles 500 server error', () => {
    const result = formatRtkQueryError({ status: 500, data: null })
    expect(result).toContain('500')
    expect(result).toContain('Server error')
  })

  it('appends server error detail when present in data', () => {
    const result = formatRtkQueryError({
      status: 503,
      data: { error: 'DB unavailable' },
    })
    expect(result).toContain('503')
    expect(result).toContain('DB unavailable')
  })
})
