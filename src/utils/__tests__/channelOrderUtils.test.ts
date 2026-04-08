import { describe, it, expect } from 'vitest'
import {
  extractErrorMessage,
  buildChannelOrderPayload,
  validateChannelParams,
  formatRtkQueryError,
  getChannelOrderAccessToken,
  getChannelOrderFailureStatus,
  getChannelOrderPaymentSnapshot,
  getChannelOrderTerminalStatus,
} from '../channelOrderUtils'
import type {
  AssetInfo,
  ChannelOrderStatusLike,
  CreateChannelOrderParams,
  LspOptions,
} from '../channelOrderUtils'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_PARAMS: CreateChannelOrderParams = {
  addressRefund: 'bc1qrefundaddress',
  capacitySat: 500_000,
  channelExpireBlocks: 4032,
  clientBalanceSat: 100_000,
  clientPubKey: 'abc123pubkey',
}

const LSP_OPTIONS: LspOptions = {
  max_channel_balance_sat: 10_000_000,
  max_channel_expiry_blocks: 6048,
  max_initial_client_balance_sat: 1_000_000,
  max_initial_lsp_balance_sat: 5_000_000,
  min_channel_balance_sat: 20_000,
  min_funding_confirms_within_blocks: 1,
  min_initial_client_balance_sat: 10_000,
  min_initial_lsp_balance_sat: 0,
  min_onchain_payment_confirmations: 6,
  min_onchain_payment_size_sat: 1000,
  min_required_channel_confirmations: 3,
  supports_zero_channel_reserve: false,
}

const ASSET: AssetInfo = {
  asset_id: 'rgb:test-asset-id',
  max_channel_amount: 500_000_000,
  max_initial_client_amount: 100_000_000,
  max_initial_lsp_amount: 100_000_000,
  min_channel_amount: 1_000_000,
  min_initial_client_amount: 0,
  min_initial_lsp_amount: 0,
  name: 'Test Token',
  precision: 8,
  ticker: 'TEST',
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
      error: 'TypeError: Failed to fetch',
      status: 'FETCH_ERROR',
    })
    expect(result).toContain('Network error')
  })

  it('handles TIMEOUT_ERROR status', () => {
    const result = formatRtkQueryError({
      error: 'timeout',
      status: 'TIMEOUT_ERROR',
    })
    expect(result).toContain('timeout')
  })

  it('handles PARSING_ERROR status', () => {
    const result = formatRtkQueryError({
      data: '',
      error: 'bad json',
      originalStatus: 200,
      status: 'PARSING_ERROR',
    })
    expect(result).toContain('parsing error')
  })

  it('handles 400 client error with message in data', () => {
    const result = formatRtkQueryError({
      data: { message: 'bad params' },
      status: 400,
    })
    expect(result).toContain('400')
    expect(result).toContain('bad params')
  })

  it('handles 401 with no data message', () => {
    const result = formatRtkQueryError({ data: null, status: 401 })
    expect(result).toContain('401')
    expect(result).toContain('Authentication')
  })

  it('handles 403', () => {
    const result = formatRtkQueryError({ data: null, status: 403 })
    expect(result).toContain('403')
    expect(result).toContain('forbidden')
  })

  it('handles 404', () => {
    const result = formatRtkQueryError({ data: null, status: 404 })
    expect(result).toContain('404')
    expect(result).toContain('not found')
  })

  it('handles 422', () => {
    const result = formatRtkQueryError({ data: null, status: 422 })
    expect(result).toContain('422')
  })

  it('handles 429', () => {
    const result = formatRtkQueryError({ data: null, status: 429 })
    expect(result).toContain('429')
    expect(result).toContain('Too many')
  })

  it('handles 500 server error', () => {
    const result = formatRtkQueryError({ data: null, status: 500 })
    expect(result).toContain('500')
    expect(result).toContain('Server error')
  })

  it('appends server error detail when present in data', () => {
    const result = formatRtkQueryError({
      data: { error: 'DB unavailable' },
      status: 503,
    })
    expect(result).toContain('503')
    expect(result).toContain('DB unavailable')
  })
})

// ─── channel order payment helpers ───────────────────────────────────────────

describe('getChannelOrderPaymentSnapshot', () => {
  it('detects lightning payments in HOLD state', () => {
    const order: ChannelOrderStatusLike = {
      payment: {
        bolt11: { state: 'HOLD' },
        onchain: { state: 'EXPECT_PAYMENT' },
      },
    }

    expect(getChannelOrderPaymentSnapshot(order)).toEqual({
      actualPaymentState: 'HOLD',
      bolt11State: 'HOLD',
      onchainState: 'EXPECT_PAYMENT',
      paymentMethod: 'lightning',
      paymentReceived: true,
    })
  })

  it('detects onchain payments in PAID state', () => {
    const order: ChannelOrderStatusLike = {
      payment: {
        bolt11: { state: 'EXPECT_PAYMENT' },
        onchain: { state: 'PAID' },
      },
    }

    expect(getChannelOrderPaymentSnapshot(order)).toEqual({
      actualPaymentState: 'PAID',
      bolt11State: 'EXPECT_PAYMENT',
      onchainState: 'PAID',
      paymentMethod: 'onchain',
      paymentReceived: true,
    })
  })

  it('detects payment states regardless of casing', () => {
    const order: ChannelOrderStatusLike = {
      payment: {
        bolt11: { state: 'paid' },
      },
    }

    expect(getChannelOrderPaymentSnapshot(order).paymentReceived).toBe(true)
  })

  it('reports no received payment when still waiting', () => {
    const order: ChannelOrderStatusLike = {
      payment: {
        bolt11: { state: 'EXPECT_PAYMENT' },
      },
    }

    expect(getChannelOrderPaymentSnapshot(order)).toEqual({
      actualPaymentState: 'EXPECT_PAYMENT',
      bolt11State: 'EXPECT_PAYMENT',
      onchainState: null,
      paymentMethod: null,
      paymentReceived: false,
    })
  })
})

describe('getChannelOrderAccessToken', () => {
  it('prefers access_token when both token fields are present', () => {
    expect(
      getChannelOrderAccessToken({
        access_token: 'access-token',
        token: 'legacy-token',
      })
    ).toBe('access-token')
  })

  it('falls back to token when access_token is missing', () => {
    expect(getChannelOrderAccessToken({ token: 'legacy-token' })).toBe(
      'legacy-token'
    )
  })

  it('returns null when no order token is available', () => {
    expect(getChannelOrderAccessToken({})).toBeNull()
  })
})

describe('getChannelOrderFailureStatus', () => {
  const NOW = new Date('2026-03-27T10:00:00.000Z').getTime()

  it('returns expired when no payment was ever made', () => {
    const order: ChannelOrderStatusLike = {
      order_state: 'FAILED',
      payment: {
        bolt11: { state: 'EXPECT_PAYMENT' },
        onchain: { state: 'EXPIRED' },
      },
    }

    expect(getChannelOrderFailureStatus(order, NOW)).toBe('expired')
  })

  it('returns expired when the payment window has passed', () => {
    const order: ChannelOrderStatusLike = {
      order_state: 'FAILED',
      payment: {
        bolt11: { expires_at: '2026-03-27T09:59:00.000Z', state: 'PENDING' },
      },
    }

    expect(getChannelOrderFailureStatus(order, NOW)).toBe('expired')
  })

  it('returns error when payment was made but the order still failed', () => {
    const order: ChannelOrderStatusLike = {
      order_state: 'FAILED',
      payment: {
        bolt11: { state: 'PAID' },
      },
    }

    expect(getChannelOrderFailureStatus(order, NOW)).toBe('error')
  })
})

describe('getChannelOrderTerminalStatus', () => {
  const NOW = new Date('2026-03-27T10:00:00.000Z').getTime()

  it('maps completed orders to success', () => {
    expect(
      getChannelOrderTerminalStatus({ order_state: 'COMPLETED' }, NOW)
    ).toBe('success')
  })

  it('maps completed state aliases to success', () => {
    expect(getChannelOrderTerminalStatus({ status: 'completed' }, NOW)).toBe(
      'success'
    )
    expect(getChannelOrderTerminalStatus({ state: 'succeeded' }, NOW)).toBe(
      'success'
    )
  })

  it('maps failed orders through the shared failure classifier', () => {
    expect(
      getChannelOrderTerminalStatus(
        {
          order_state: 'FAILED',
          payment: {
            bolt11: { state: 'EXPECT_PAYMENT' },
          },
        },
        NOW
      )
    ).toBe('expired')
  })

  it('returns null for non-terminal orders', () => {
    expect(
      getChannelOrderTerminalStatus({ order_state: 'CREATED' }, NOW)
    ).toBeNull()
  })
})
