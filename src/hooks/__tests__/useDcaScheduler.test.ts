import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'

import { DcaOrder, dcaReducer } from '../../slices/dcaSlice'

// ─── Shared mutable mock state (hoisted so vi.mock factories can close over it) ──
const mocks = vi.hoisted(() => ({
  btcPrice: undefined as number | undefined,
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
vi.mock('../useBitcoinPrice', () => ({
  useBitcoinPrice: () => ({ btcPrice: mocks.btcPrice }),
}))
vi.mock('../../routes/trade/market-maker/apiUtils', () => ({
  handleApiError: (error: any) =>
    String(error?.data?.error ?? error?.error ?? 'API error'),
}))
vi.mock('../../routes/trade/market-maker/swapUtils', () => ({
  validateSwapString: vi.fn(() => true),
}))

import {
  DCA_SCHEDULER_INTERVAL_MS,
  computeFeeSats,
  computeUsdtLnBalance,
  executeOrderManually,
  normalizeDcaError,
  toRustOrder,
  useDcaScheduler,
} from '../useDcaScheduler'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const USDT_ASSET_ID = 'rgb:usdt-asset-id'

/** Orders returned by the mocked `dca_get_orders` Tauri command. */
let dbOrders: DcaOrder[] = []

const makeScheduledOrder = (overrides: Partial<DcaOrder> = {}): DcaOrder => ({
  amountUsdt: 100,
  createdAt: Date.now() - 2 * 3600 * 1000,
  executions: [],
  id: 'dca-1',
  intervalHours: 1,
  lastExecutedAt: Date.now() - 61 * 60 * 1000, // due 1 minute ago
  status: 'active',
  type: 'scheduled',
  ...overrides,
})

const makePriceTargetOrder = (overrides: Partial<DcaOrder> = {}): DcaOrder => ({
  amountUsdt: 100,
  createdAt: Date.now(),
  creationPriceBtcUsdt: 100_000,
  executions: [],
  id: 'dca-pt-1',
  status: 'active',
  targetDropPercent: 10,
  triggerPriceBtcUsdt: 90_000,
  type: 'price-target',
  ...overrides,
})

/**
 * Build a quote whose received sats exactly match expectation (0% slippage).
 */
const makeQuote = (amountUsdt: number, priceBtcUsdt: number) => ({
  fee: { fee_asset: 'BTC', final_fee: 21_000 },
  from_asset: { asset_id: USDT_ASSET_ID },
  rfq_id: 'rfq-1',
  to_asset: {
    amount: Math.round((amountUsdt / priceBtcUsdt) * 1e8) * 1000, // msats
    asset_id: 'BTC',
  },
})

/** Flush pending microtasks (promise chains) without advancing timers. */
const flush = async () => {
  for (let i = 0; i < 30; i++) {
    await Promise.resolve()
  }
}

const tick = async (ms = DCA_SCHEDULER_INTERVAL_MS) => {
  await vi.advanceTimersByTimeAsync(ms)
  await flush()
}

let hookHandle: { rerender: () => void; unmount: () => void } | null = null

const mountScheduler = async () => {
  hookHandle = renderHook(() => useDcaScheduler())
  await flush()
  return hookHandle
}

const dispatchedActions = () =>
  mocks.dispatch.mock.calls.map((call) => call[0] as { type: string })

const actionsOfType = (type: string) =>
  dispatchedActions().filter((a) => a.type === type)

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()

  dbOrders = []
  mocks.btcPrice = 100_000
  mocks.nodeInfo = { data: { pubkey: 'node-pubkey' }, isSuccess: true }
  mocks.listAssetsData = {
    nia: [{ asset_id: USDT_ASSET_ID, precision: 6, ticker: 'USDT' }],
  }
  mocks.listChannelsData = {
    channels: [
      {
        asset_id: USDT_ASSET_ID,
        asset_local_amount: 1_000_000_000, // 1000 USDT at precision 6
        ready: true,
      },
    ],
  }
  mocks.state = {
    dca: { orders: [] },
    nodeSettings: { data: { name: 'test-account' } },
  }

  // Dispatch applies the real dca reducer so state transitions are realistic
  mocks.dispatch.mockImplementation((action: any) => {
    mocks.state = {
      ...mocks.state,
      dca: dcaReducer(mocks.state.dca, action),
    }
  })

  mocks.invoke.mockImplementation(async (cmd: string) => {
    if (cmd === 'dca_get_orders') return dbOrders.map((o) => JSON.stringify(o))
    return undefined
  })

  mocks.getQuote.mockResolvedValue({ data: makeQuote(100, 100_000) })
  mocks.initSwap.mockResolvedValue({
    data: { payment_hash: 'hash-1', swapstring: 'swap-string-1' },
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

describe('normalizeDcaError', () => {
  it('maps insufficient balance errors to a channel-balance message', () => {
    const { userMessage } = normalizeDcaError(
      new Error('Insufficient balance in channel')
    )
    expect(userMessage).toContain('Not enough USDT/BTC channel balance')
  })

  it('maps CORS errors to a CORS-specific message', () => {
    const { userMessage } = normalizeDcaError(
      'Origin http://localhost:1420 is not allowed'
    )
    expect(userMessage).toContain('CORS')
  })

  it('maps network errors to a connectivity message', () => {
    const { userMessage } = normalizeDcaError(new Error('Failed to fetch'))
    expect(userMessage).toContain('Could not reach maker API')
  })

  it('maps timeout errors to a retry message', () => {
    const { userMessage } = normalizeDcaError(
      new Error('DCA quote request timed out after 15s')
    )
    expect(userMessage).toBe('Request timed out. Please try again in a moment.')
  })

  it('strips error-class and API-error prefixes from unknown errors', () => {
    const { userMessage } = normalizeDcaError(
      new Error('API Error (422): something odd happened')
    )
    expect(userMessage).toBe('something odd happened')
  })

  it('extracts nested messages from API-style error objects', () => {
    const { internalMessage } = normalizeDcaError({
      data: { error: 'quote has expired' },
      status: 410,
    })
    expect(internalMessage).toBe('quote has expired')
    expect(
      normalizeDcaError({ data: { error: 'quote expired' } }).userMessage
    ).toContain('Quote expired')
  })

  it('falls back to a generic message when the error is empty', () => {
    expect(normalizeDcaError('').userMessage).toBe(
      'DCA swap failed. Please try again.'
    )
  })
})

describe('computeFeeSats', () => {
  it('returns 0 for a missing or zero fee', () => {
    expect(computeFeeSats(undefined, 100_000)).toBe(0)
    expect(computeFeeSats({ final_fee: 0 }, 100_000)).toBe(0)
  })

  it('converts BTC fees from msats to sats', () => {
    expect(computeFeeSats({ fee_asset: 'BTC', final_fee: 21_000 }, 0)).toBe(21)
    // fee_asset missing → treated as BTC
    expect(computeFeeSats({ final_fee: 1_500 }, 0)).toBe(2)
  })

  it('converts USDT fees to sats via BTC price and precision', () => {
    // 1 USDT (precision 6) at 100k USDT/BTC = 1000 sats
    expect(
      computeFeeSats(
        { fee_asset: 'USDT', fee_asset_precision: 6, final_fee: 1_000_000 },
        100_000
      )
    ).toBe(1000)
  })

  it('returns 0 for asset fees when the BTC price is unknown', () => {
    expect(computeFeeSats({ fee_asset: 'USDT', final_fee: 1_000_000 }, 0)).toBe(
      0
    )
  })
})

describe('toRustOrder', () => {
  it('converts interval hours to seconds and timestamps to unix seconds', () => {
    const order = makeScheduledOrder({
      intervalHours: 1.5,
      lastExecutedAt: 1_700_000_000_500,
    })
    expect(toRustOrder(order)).toEqual({
      amount_usdt: 100,
      id: 'dca-1',
      interval_secs: 5400,
      last_executed_at: 1_700_000_000,
      order_type: 'scheduled',
      status: 'active',
      trigger_price_usd: null,
    })
  })

  it('uses nulls for fields a price-target order does not have', () => {
    const order = makePriceTargetOrder({ lastExecutedAt: undefined })
    const rust = toRustOrder(order)
    expect(rust.interval_secs).toBeNull()
    expect(rust.last_executed_at).toBeNull()
    expect(rust.trigger_price_usd).toBe(90_000)
  })
})

describe('computeUsdtLnBalance', () => {
  const usdtAsset = { asset_id: USDT_ASSET_ID, precision: 6, ticker: 'USDT' }

  it('returns null when channels or assets are missing', () => {
    expect(computeUsdtLnBalance(undefined, [usdtAsset as any])).toBeNull()
    expect(computeUsdtLnBalance([], undefined)).toBeNull()
    expect(computeUsdtLnBalance([], [])).toBeNull() // no USDT asset
  })

  it('sums only ready channels holding the USDT asset', () => {
    const channels = [
      { asset_id: USDT_ASSET_ID, asset_local_amount: 100_000_000, ready: true },
      { asset_id: USDT_ASSET_ID, asset_local_amount: 50_000_000, ready: true },
      {
        asset_id: USDT_ASSET_ID,
        asset_local_amount: 999_000_000,
        ready: false,
      },
      { asset_id: 'other', asset_local_amount: 77_000_000, ready: true },
    ]
    expect(computeUsdtLnBalance(channels, [usdtAsset as any])).toBe(150)
  })
})

// ─── Scheduler behavior ──────────────────────────────────────────────────────

describe('useDcaScheduler', () => {
  it('starts the Rust scheduler and hydrates orders when the node is ready', async () => {
    dbOrders = [makeScheduledOrder({ lastExecutedAt: Date.now() })]
    await mountScheduler()

    expect(mocks.invoke).toHaveBeenCalledWith('dca_start_scheduler')
    expect(mocks.invoke).toHaveBeenCalledWith('dca_get_orders')
    expect(mocks.state.dca.orders).toHaveLength(1)
    expect(mocks.state.dca.orders[0].id).toBe('dca-1')
  })

  it('stops the Rust scheduler and skips ticks while the node is locked', async () => {
    mocks.nodeInfo = { data: undefined, isSuccess: false }
    await mountScheduler()
    await tick()

    expect(mocks.invoke).toHaveBeenCalledWith('dca_stop_scheduler')
    expect(mocks.invoke).not.toHaveBeenCalledWith('dca_start_scheduler')
    expect(mocks.getQuote).not.toHaveBeenCalled()
  })

  it('does not execute a scheduled order before its interval has elapsed', async () => {
    dbOrders = [makeScheduledOrder({ lastExecutedAt: Date.now() })]
    await mountScheduler()

    await tick(30 * 60 * 1000)
    expect(mocks.getQuote).not.toHaveBeenCalled()
  })

  it('executes a due scheduled order through the full swap pipeline', async () => {
    dbOrders = [makeScheduledOrder()]
    await mountScheduler()
    await tick()

    expect(mocks.getQuote).toHaveBeenCalledTimes(1)
    expect(mocks.getQuote).toHaveBeenCalledWith({
      from_asset: {
        amount: 100_000_000, // 100 USDT at precision 6
        asset_id: USDT_ASSET_ID,
        layer: 'RGB_LN',
      },
      to_asset: { asset_id: 'BTC', layer: 'BTC_LN' },
    })
    expect(mocks.initSwap).toHaveBeenCalledWith({
      from_amount: 100_000_000,
      from_asset: USDT_ASSET_ID,
      rfq_id: 'rfq-1',
      to_amount: 100_000_000, // msats
      to_asset: 'BTC',
    })
    expect(mocks.whitelistTrade).toHaveBeenCalledWith({
      swapstring: 'swap-string-1',
    })
    expect(mocks.execSwap).toHaveBeenCalledWith({
      payment_hash: 'hash-1',
      swapstring: 'swap-string-1',
      taker_pubkey: 'node-pubkey',
    })

    // Success recorded with fee converted from msats and implied price
    const order = mocks.state.dca.orders[0]
    expect(order.executions).toHaveLength(1)
    expect(order.executions[0]).toMatchObject({
      feeSats: 21,
      fromAmountUsdt: 100,
      priceBtcUsdt: 100_000,
      status: 'success',
      toAmountSats: 100_000,
    })
    expect(mocks.invoke).toHaveBeenCalledWith('dca_order_executed', {
      orderId: 'dca-1',
      timestamp: expect.any(Number),
    })
  })

  it('does not re-execute a scheduled order until the next interval', async () => {
    dbOrders = [makeScheduledOrder()]
    await mountScheduler()
    await tick()
    expect(mocks.getQuote).toHaveBeenCalledTimes(1)

    await tick()
    await tick()
    expect(mocks.getQuote).toHaveBeenCalledTimes(1)

    await tick(61 * 60 * 1000)
    expect(mocks.getQuote).toHaveBeenCalledTimes(2)
  })

  it('ignores paused orders', async () => {
    dbOrders = [makeScheduledOrder({ status: 'paused' })]
    await mountScheduler()
    await tick()
    expect(mocks.getQuote).not.toHaveBeenCalled()
  })

  it('triggers a price-target order only when price drops to the trigger', async () => {
    dbOrders = [makePriceTargetOrder()]
    mocks.btcPrice = 95_000 // above 90k trigger
    await mountScheduler()
    await tick()
    expect(mocks.getQuote).not.toHaveBeenCalled()

    mocks.btcPrice = 89_000 // below trigger
    mocks.getQuote.mockResolvedValue({ data: makeQuote(100, 89_000) })
    hookHandle!.rerender() // let the btcPrice ref sync
    await tick()

    expect(mocks.getQuote).toHaveBeenCalledTimes(1)
    const order = mocks.state.dca.orders[0]
    expect(order.executions[0].status).toBe('success')
    // After execution the trigger re-anchors to the execution price (-10%)
    expect(order.creationPriceBtcUsdt).toBe(89_000)
    expect(order.triggerPriceBtcUsdt).toBeCloseTo(80_100)
  })

  it('does not trigger a price-target order when the BTC price is unknown', async () => {
    dbOrders = [makePriceTargetOrder()]
    mocks.btcPrice = undefined
    await mountScheduler()
    await tick()
    expect(mocks.getQuote).not.toHaveBeenCalled()
  })

  it('auto-pauses an order when the USDT LN balance is insufficient', async () => {
    dbOrders = [makeScheduledOrder()]
    mocks.listChannelsData = {
      channels: [
        {
          asset_id: USDT_ASSET_ID,
          asset_local_amount: 50_000_000, // only 50 USDT
          ready: true,
        },
      ],
    }
    await mountScheduler()
    await tick()

    expect(mocks.getQuote).not.toHaveBeenCalled()
    const order = mocks.state.dca.orders[0]
    expect(order.status).toBe('paused')
    expect(order.executions[0]).toMatchObject({ status: 'failed' })
    expect(order.executions[0].error).toContain('Insufficient USDT LN balance')
  })

  it('rejects the swap when slippage exceeds the maximum', async () => {
    dbOrders = [makeScheduledOrder()]
    // Expect 100k sats at 100k USDT/BTC but only receive 95k sats (5% slippage)
    mocks.getQuote.mockResolvedValue({
      data: {
        from_asset: { asset_id: USDT_ASSET_ID },
        rfq_id: 'rfq-1',
        to_asset: { amount: 95_000_000, asset_id: 'BTC' },
      },
    })
    await mountScheduler()
    await tick()

    expect(mocks.initSwap).not.toHaveBeenCalled()
    expect(mocks.execSwap).not.toHaveBeenCalled()
    const order = mocks.state.dca.orders[0]
    expect(order.status).toBe('active')
    expect(order.executions[0].status).toBe('failed')
    expect(order.executions[0].error).toContain('Slippage too high')
  })

  it('records a failure when the quote request times out', async () => {
    dbOrders = [makeScheduledOrder()]
    mocks.getQuote.mockReturnValue(new Promise(() => {})) // never resolves
    await mountScheduler()
    await tick()
    await tick(15_000) // quote timeout fires

    const order = mocks.state.dca.orders[0]
    expect(order.executions[0].status).toBe('failed')
    expect(order.executions[0].error).toBe(
      'Request timed out. Please try again in a moment.'
    )
  })

  it('records a failure when execSwap errors and keeps the order active', async () => {
    dbOrders = [makeScheduledOrder()]
    mocks.execSwap.mockResolvedValue({
      error: { data: { error: 'quote has expired' }, status: 410 },
    })
    await mountScheduler()
    await tick()

    const order = mocks.state.dca.orders[0]
    expect(order.status).toBe('active')
    expect(order.executions[0].status).toBe('failed')
    expect(order.executions[0].error).toContain('Quote expired')
  })

  it('deduplicates enqueued executions while another is in flight', async () => {
    dbOrders = [makeScheduledOrder()]
    let resolveQuote: (value: unknown) => void = () => {}
    mocks.getQuote.mockReturnValue(
      new Promise((resolve) => {
        resolveQuote = resolve
      })
    )
    await mountScheduler()
    await tick()

    // Re-triggers while the execution is in flight: queued once, deduped after
    executeOrderManually('dca-1')
    executeOrderManually('dca-1')
    executeOrderManually('dca-1')
    await flush()
    expect(mocks.getQuote).toHaveBeenCalledTimes(1)

    resolveQuote({ data: makeQuote(100, 100_000) })
    await flush()
    expect(mocks.getQuote).toHaveBeenCalledTimes(2)
  })

  it('persists updated orders to the DB after an execution', async () => {
    dbOrders = [makeScheduledOrder()]
    await mountScheduler()
    await tick()

    mocks.invoke.mockClear()
    hookHandle!.rerender() // orders selector changed → mirror effect runs
    await flush()

    expect(mocks.invoke).toHaveBeenCalledWith('dca_upsert_order', {
      orderId: 'dca-1',
      payload: expect.stringContaining('"status":"success"'),
    })
    expect(mocks.invoke).toHaveBeenCalledWith('dca_set_orders', {
      orders: [expect.objectContaining({ id: 'dca-1' })],
    })
  })
})

describe('executeOrderManually', () => {
  it('warns when the scheduler is not mounted', () => {
    executeOrderManually('dca-1')
    expect(mocks.toast.warn).toHaveBeenCalledWith('DCA scheduler not ready')
  })

  it('refuses to execute while the node is locked', async () => {
    mocks.nodeInfo = { data: undefined, isSuccess: false }
    await mountScheduler()

    executeOrderManually('dca-1')
    await flush()

    expect(mocks.toast.warn).toHaveBeenCalledWith(
      'DCA: node not ready — wallet must be unlocked'
    )
    expect(mocks.getQuote).not.toHaveBeenCalled()
    expect(actionsOfType('dca/recordExecution')).toHaveLength(0)
  })

  it('executes an active order on demand', async () => {
    dbOrders = [makeScheduledOrder({ lastExecutedAt: Date.now() })] // not due
    await mountScheduler()

    executeOrderManually('dca-1')
    await flush()

    expect(mocks.getQuote).toHaveBeenCalledTimes(1)
    expect(mocks.state.dca.orders[0].executions[0].status).toBe('success')
  })

  it('skips orders that are unknown or not active', async () => {
    dbOrders = [makeScheduledOrder({ status: 'paused' })]
    await mountScheduler()

    executeOrderManually('dca-1')
    executeOrderManually('missing-order')
    await flush()

    expect(mocks.getQuote).not.toHaveBeenCalled()
  })
})
