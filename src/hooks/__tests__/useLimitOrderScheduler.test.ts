import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'

import { LimitOrder, limitOrderReducer } from '../../slices/limitOrderSlice'

// ─── Shared mutable mock state (hoisted so vi.mock factories can close over it) ──
const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  execSwap: vi.fn(),
  getQuote: vi.fn(),
  initSwap: vi.fn(),
  invoke: vi.fn(),
  listAssetsData: undefined as any,
  listChannelsData: undefined as any,
  nodeInfo: { data: undefined as any, isSuccess: false },
  state: {} as any,
  toast: {
    error: vi.fn(),
    loading: vi.fn(() => 'toast-1'),
    success: vi.fn(),
    update: vi.fn(),
    warn: vi.fn(),
  },
  whitelistTrade: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('react-toastify', () => ({ toast: mocks.toast }))
vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))
vi.mock('../../app/store', () => ({
  store: { getState: () => mocks.state },
}))
vi.mock('../../app/store/hooks', () => ({
  useAppDispatch: () => mocks.dispatch,
  useAppSelector: (selector: (s: any) => any) => selector(mocks.state),
}))
vi.mock('../../slices/makerApi/makerApi.slice', () => ({
  makerApi: {
    endpoints: {
      execSwap: { useLazyQuery: () => [mocks.execSwap] },
      getQuote: { useLazyQuery: () => [mocks.getQuote] },
      initSwap: { useLazyQuery: () => [mocks.initSwap] },
    },
  },
}))
vi.mock('../../slices/nodeApi/nodeApi.slice', () => ({
  nodeApi: {
    endpoints: {
      listAssets: { useQuery: () => ({ data: mocks.listAssetsData }) },
      listChannels: { useQuery: () => ({ data: mocks.listChannelsData }) },
      nodeInfo: { useQuery: () => mocks.nodeInfo },
      whitelistTrade: { useMutation: () => [mocks.whitelistTrade] },
    },
  },
}))
vi.mock('../../routes/trade/market-maker/apiUtils', () => ({
  handleApiError: (error: any) =>
    String(error?.data?.error ?? error?.error ?? 'API error'),
}))
vi.mock('../../routes/trade/market-maker/swapUtils', () => ({
  validateSwapString: vi.fn(() => true),
}))

import {
  LIMIT_ORDER_SCHEDULER_INTERVAL_MS,
  executeLimitOrderManually,
  getAssetLayer,
  normalizeLimitError,
  useLimitOrderScheduler,
} from '../useLimitOrderScheduler'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const USDT_ASSET_ID = 'rgb:usdt-asset-id'
const PAIR_ID = 'btc-usdt'
const QUOTE_PRECISION = 6

const PAIR = {
  base: {
    endpoints: [{ layer: 'BTC_LN', min_amount: 1 }],
    precision: 8,
    ticker: 'BTC',
  },
  id: PAIR_ID,
  quote: {
    endpoints: [{ layer: 'RGB_LN', min_amount: 1000 }],
    precision: QUOTE_PRECISION,
    ticker: 'USDT',
  },
}

/** Orders returned by the mocked `limit_get_orders` Tauri command. */
let dbOrders: LimitOrder[] = []
/** Display price returned by the polling quote (converted to raw internally). */
let pollPrice: number
/** Response returned for the execution-sized quote request. */
let execQuoteResponse: any

const toRawPrice = (displayPrice: number) =>
  Math.round(displayPrice * Math.pow(10, QUOTE_PRECISION))

const makeOrder = (overrides: Partial<LimitOrder> = {}): LimitOrder => ({
  amount: 0.001,
  amountRaw: 100_000_000, // 100 USDT at precision 6
  baseAssetId: 'BTC',
  baseAssetTicker: 'BTC',
  createdAt: Date.now(),
  executions: [],
  id: 'lo-1',
  limitPrice: 100_000,
  pairId: PAIR_ID,
  quoteAssetId: USDT_ASSET_ID,
  quoteAssetTicker: 'USDT',
  side: 'buy',
  status: 'active',
  ...overrides,
})

const makeExecQuote = (displayPrice: number) => ({
  data: {
    from_asset: { asset_id: USDT_ASSET_ID },
    price: toRawPrice(displayPrice),
    rfq_id: 'rfq-lo-1',
    to_asset: { amount: 100_000, asset_id: 'BTC' },
  },
})

/** Flush pending microtasks (promise chains) without advancing timers. */
const flush = async () => {
  for (let i = 0; i < 30; i++) {
    await Promise.resolve()
  }
}

const tick = async (ms = LIMIT_ORDER_SCHEDULER_INTERVAL_MS) => {
  await vi.advanceTimersByTimeAsync(ms)
  await flush()
}

let hookHandle: { rerender: () => void; unmount: () => void } | null = null

const mountScheduler = async () => {
  hookHandle = renderHook(() => useLimitOrderScheduler())
  await flush()
  return hookHandle
}

/** getQuote calls whose from-amount matches the polling min-amount. */
const pollQuoteCalls = () =>
  mocks.getQuote.mock.calls.filter((call) => call[0].from_asset.amount === 1000)

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()

  dbOrders = []
  pollPrice = 100_000
  execQuoteResponse = makeExecQuote(99_500)
  mocks.nodeInfo = { data: { pubkey: 'node-pubkey' }, isSuccess: true }
  mocks.listAssetsData = {
    nia: [{ asset_id: USDT_ASSET_ID, precision: 6, ticker: 'USDT' }],
  }
  mocks.listChannelsData = { channels: [] }
  mocks.state = {
    limitOrders: { orders: [] },
    nodeSettings: { data: { name: 'test-account' } },
    pairs: { values: [PAIR] },
  }

  // Dispatch applies the real limit order reducer for realistic transitions
  mocks.dispatch.mockImplementation((action: any) => {
    mocks.state = {
      ...mocks.state,
      limitOrders: limitOrderReducer(mocks.state.limitOrders, action),
    }
  })

  mocks.invoke.mockImplementation(async (cmd: string) => {
    if (cmd === 'limit_get_orders') {
      return dbOrders.map((o) => JSON.stringify(o))
    }
    return undefined
  })

  // Price polls use the pair's min_amount (1000); execution quotes use amountRaw
  mocks.getQuote.mockImplementation(async (args: any) => {
    if (args.from_asset.amount === 1000) {
      return { data: { price: toRawPrice(pollPrice) } }
    }
    return execQuoteResponse
  })
  mocks.initSwap.mockResolvedValue({
    data: { payment_hash: 'hash-lo-1', swapstring: 'swap-string-lo-1' },
  })
  mocks.whitelistTrade.mockResolvedValue({ data: {} })
  mocks.execSwap.mockResolvedValue({ data: {} })
})

afterEach(() => {
  hookHandle?.unmount()
  hookHandle = null
  vi.useRealTimers()
})

// ─── Pure helpers ────────────────────────────────────────────────────────────

describe('getAssetLayer', () => {
  it('always maps BTC to BTC_LN', () => {
    expect(getAssetLayer('BTC', 'BTC', [])).toBe('BTC_LN')
    expect(getAssetLayer('btc', 'whatever', [])).toBe('BTC_LN')
    expect(getAssetLayer('WHATEVER', 'btc', [])).toBe('BTC_LN')
  })

  it('reads the layer from the pair endpoint data', () => {
    expect(getAssetLayer('USDT', USDT_ASSET_ID, [PAIR as any])).toBe('RGB_LN')
  })

  it('falls back to RGB_LN for unknown assets or missing endpoints', () => {
    expect(getAssetLayer('UNKNOWN', 'unknown-id', [PAIR as any])).toBe('RGB_LN')
    const pairWithoutEndpoints = {
      ...PAIR,
      quote: { precision: 6, ticker: 'USDT' },
    }
    expect(
      getAssetLayer('USDT', USDT_ASSET_ID, [pairWithoutEndpoints as any])
    ).toBe('RGB_LN')
  })
})

describe('normalizeLimitError', () => {
  it('maps insufficient balance errors to the auto-pause message', () => {
    const { userMessage } = normalizeLimitError(
      new Error('insufficient outbound liquidity')
    )
    expect(userMessage).toBe(
      'Insufficient channel balance for this limit order. Order auto-paused.'
    )
  })

  it('maps network errors to a connectivity message', () => {
    expect(normalizeLimitError('Failed to fetch').userMessage).toContain(
      'Could not reach maker API'
    )
  })

  it('maps timeouts to a retry message', () => {
    expect(
      normalizeLimitError(new Error('Limit order quote request timed out'))
        .userMessage
    ).toBe('Request timed out. Will retry on next check.')
  })

  it('maps expired quotes to a retry message', () => {
    expect(
      normalizeLimitError({ data: { error: 'quote has expired' } }).userMessage
    ).toContain('Quote expired')
  })

  it('strips error prefixes and falls back to the raw message', () => {
    const { userMessage } = normalizeLimitError(
      new Error('API Error (400): bad amount')
    )
    expect(userMessage).toBe('bad amount')
    expect(normalizeLimitError('').userMessage).toBe(
      'Limit order execution failed.'
    )
  })
})

// ─── Scheduler behavior ──────────────────────────────────────────────────────

describe('useLimitOrderScheduler', () => {
  it('hydrates orders from the DB when the node is ready', async () => {
    dbOrders = [makeOrder()]
    await mountScheduler()

    expect(mocks.invoke).toHaveBeenCalledWith('limit_get_orders')
    expect(mocks.state.limitOrders.orders).toHaveLength(1)
    expect(mocks.state.limitOrders.orders[0].id).toBe('lo-1')
  })

  it('skips ticks entirely while the node is locked', async () => {
    mocks.nodeInfo = { data: undefined, isSuccess: false }
    await mountScheduler()
    await tick()

    expect(mocks.getQuote).not.toHaveBeenCalled()
  })

  it('expires an active order past its expiration without polling a price', async () => {
    dbOrders = [makeOrder({ expiresAt: Date.now() - 1000 })]
    await mountScheduler()
    await tick()

    expect(mocks.state.limitOrders.orders[0].status).toBe('expired')
    expect(mocks.getQuote).not.toHaveBeenCalled()
  })

  it('does not trigger a buy when the market price is above the limit', async () => {
    dbOrders = [makeOrder({ limitPrice: 95_000 })]
    pollPrice = 100_000
    await mountScheduler()
    await tick()

    expect(pollQuoteCalls()).toHaveLength(1)
    expect(mocks.getQuote).toHaveBeenCalledTimes(1)
    expect(mocks.initSwap).not.toHaveBeenCalled()
  })

  it('executes a buy through the full pipeline when price drops to the limit', async () => {
    dbOrders = [makeOrder({ limitPrice: 100_000 })]
    pollPrice = 99_000
    execQuoteResponse = makeExecQuote(99_500)
    await mountScheduler()
    await tick()

    // Price poll used the pair's min amount and correct layers
    expect(pollQuoteCalls()[0][0]).toEqual({
      from_asset: { amount: 1000, asset_id: USDT_ASSET_ID, layer: 'RGB_LN' },
      to_asset: { asset_id: 'BTC', layer: 'BTC_LN' },
    })
    // Execution quote spends the order's raw quote-asset amount
    expect(mocks.getQuote).toHaveBeenCalledWith({
      from_asset: {
        amount: 100_000_000,
        asset_id: USDT_ASSET_ID,
        layer: 'RGB_LN',
      },
      to_asset: { asset_id: 'BTC', layer: 'BTC_LN' },
    })
    expect(mocks.initSwap).toHaveBeenCalledWith({
      from_amount: 100_000_000,
      from_asset: USDT_ASSET_ID,
      rfq_id: 'rfq-lo-1',
      to_amount: 100_000,
      to_asset: 'BTC',
    })
    expect(mocks.whitelistTrade).toHaveBeenCalledWith({
      swapstring: 'swap-string-lo-1',
    })
    expect(mocks.execSwap).toHaveBeenCalledWith({
      payment_hash: 'hash-lo-1',
      swapstring: 'swap-string-lo-1',
      taker_pubkey: 'node-pubkey',
    })

    const order = mocks.state.limitOrders.orders[0]
    expect(order.status).toBe('filled')
    expect(order.executions[0]).toMatchObject({
      executionPrice: 99_500,
      fromAmount: 100_000_000,
      fromAssetTicker: 'USDT',
      status: 'success',
      toAmount: 100_000,
      toAssetTicker: 'BTC',
    })

    // Once filled the order is no longer polled or re-executed
    const callsSoFar = mocks.getQuote.mock.calls.length
    await tick()
    expect(mocks.getQuote).toHaveBeenCalledTimes(callsSoFar)
  })

  it('triggers a buy when the market price exactly equals the limit price', async () => {
    // Inclusive comparison: an at-market limit order executes on the very
    // first scheduler tick after creation (see issue #92)
    dbOrders = [makeOrder({ limitPrice: 100_000 })]
    pollPrice = 100_000
    await mountScheduler()
    await tick()

    expect(mocks.initSwap).toHaveBeenCalledTimes(1)
    expect(mocks.state.limitOrders.orders[0].status).toBe('filled')
  })

  it('executes a sell when the market price rises to the limit', async () => {
    dbOrders = [
      makeOrder({
        amountRaw: 100_000_000, // msats of BTC being sold
        id: 'lo-sell',
        limitPrice: 100_000,
        side: 'sell',
      }),
    ]
    pollPrice = 101_000
    execQuoteResponse = {
      data: {
        from_asset: { asset_id: 'BTC' },
        price: toRawPrice(100_500),
        rfq_id: 'rfq-lo-1',
        to_asset: { amount: 100_000_000, asset_id: USDT_ASSET_ID },
      },
    }
    await mountScheduler()
    await tick()

    // Sell spends the base asset (BTC) to receive the quote asset
    expect(mocks.getQuote).toHaveBeenCalledWith({
      from_asset: { amount: 100_000_000, asset_id: 'BTC', layer: 'BTC_LN' },
      to_asset: { asset_id: USDT_ASSET_ID, layer: 'RGB_LN' },
    })
    const order = mocks.state.limitOrders.orders[0]
    expect(order.status).toBe('filled')
    expect(order.executions[0].executionPrice).toBe(100_500)
  })

  it('does not execute a sell while the market price is below the limit', async () => {
    dbOrders = [makeOrder({ limitPrice: 200_000, side: 'sell' })]
    pollPrice = 100_000
    await mountScheduler()
    await tick()

    expect(mocks.initSwap).not.toHaveBeenCalled()
  })

  it('caches the polled price for 30s before refetching', async () => {
    dbOrders = [makeOrder({ limitPrice: 200_000, side: 'sell' })] // never triggers
    pollPrice = 100_000
    await mountScheduler()

    await tick() // t=20s → fetch
    expect(pollQuoteCalls()).toHaveLength(1)

    await tick() // t=40s → cache still fresh (20s < 30s TTL)
    expect(pollQuoteCalls()).toHaveLength(1)

    await tick() // t=60s → cache expired → refetch
    expect(pollQuoteCalls()).toHaveLength(2)
  })

  it('skips the order for the tick when the price poll fails', async () => {
    dbOrders = [makeOrder()]
    mocks.getQuote.mockResolvedValue({ error: { status: 500 } })
    await mountScheduler()
    await tick()

    expect(mocks.initSwap).not.toHaveBeenCalled()
    expect(mocks.state.limitOrders.orders[0].status).toBe('active')
  })

  it('rejects execution when the quoted price slips past the limit', async () => {
    dbOrders = [makeOrder({ limitPrice: 100_000 })]
    pollPrice = 99_000
    execQuoteResponse = makeExecQuote(104_000) // 4% above the buy limit
    await mountScheduler()
    await tick()

    expect(mocks.initSwap).not.toHaveBeenCalled()
    const order = mocks.state.limitOrders.orders[0]
    expect(order.status).toBe('active')
    expect(order.executions[0].status).toBe('failed')
    expect(order.executions[0].error).toContain('Slippage too high: 4.00%')
  })

  it('auto-pauses the order on insufficient balance errors', async () => {
    dbOrders = [makeOrder({ limitPrice: 100_000 })]
    pollPrice = 99_000
    execQuoteResponse = {
      error: { data: { error: 'insufficient balance for swap' }, status: 400 },
    }
    await mountScheduler()
    await tick()

    const order = mocks.state.limitOrders.orders[0]
    expect(order.status).toBe('paused')
    expect(order.executions[0]).toMatchObject({ status: 'failed' })
    expect(order.executions[0].error).toBe(
      'Insufficient channel balance for this limit order. Order auto-paused.'
    )
  })

  it('records a failure but keeps the order active when execSwap errors', async () => {
    dbOrders = [makeOrder({ limitPrice: 100_000 })]
    pollPrice = 99_000
    mocks.execSwap.mockResolvedValue({
      error: { data: { error: 'quote has expired' }, status: 410 },
    })
    await mountScheduler()
    await tick()

    const order = mocks.state.limitOrders.orders[0]
    expect(order.status).toBe('active')
    expect(order.executions[0].status).toBe('failed')
    expect(order.executions[0].error).toContain('Quote expired')
  })

  it('persists updated orders to the DB after an execution', async () => {
    dbOrders = [makeOrder({ limitPrice: 100_000 })]
    pollPrice = 99_000
    await mountScheduler()
    await tick()

    mocks.invoke.mockClear()
    hookHandle!.rerender() // orders selector changed → mirror effect runs
    await flush()

    expect(mocks.invoke).toHaveBeenCalledWith('limit_upsert_order', {
      orderId: 'lo-1',
      payload: expect.stringContaining('"status":"filled"'),
    })
  })
})

describe('executeLimitOrderManually', () => {
  it('warns when the scheduler is not mounted', () => {
    executeLimitOrderManually('lo-1')
    expect(mocks.toast.warn).toHaveBeenCalledWith(
      'Limit order scheduler not ready'
    )
  })

  it('refuses to execute while the node is locked', async () => {
    mocks.nodeInfo = { data: undefined, isSuccess: false }
    await mountScheduler()

    executeLimitOrderManually('lo-1')
    await flush()

    expect(mocks.toast.warn).toHaveBeenCalledWith(
      'Limit order: node not ready — wallet must be unlocked'
    )
    expect(mocks.getQuote).not.toHaveBeenCalled()
  })

  it('executes an active order on demand, bypassing the price trigger', async () => {
    dbOrders = [makeOrder({ limitPrice: 100_000 })]
    await mountScheduler()

    executeLimitOrderManually('lo-1')
    await flush()

    expect(mocks.initSwap).toHaveBeenCalledTimes(1)
    expect(mocks.state.limitOrders.orders[0].status).toBe('filled')
  })

  it('skips orders that are unknown or not active', async () => {
    dbOrders = [makeOrder({ status: 'paused' })]
    await mountScheduler()

    executeLimitOrderManually('lo-1')
    executeLimitOrderManually('missing-order')
    await flush()

    expect(mocks.getQuote).not.toHaveBeenCalled()
  })
})
