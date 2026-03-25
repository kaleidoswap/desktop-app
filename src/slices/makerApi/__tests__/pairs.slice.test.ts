import { describe, it, expect, vi } from 'vitest'

// Mock RTK createApi to prevent side effects from makerApi.slice
vi.mock('../makerApi.slice', () => ({
  TradingPair: {},
  normalizePairs: vi.fn((pairs: any[]) => pairs),
}))

// Mock kaleido-sdk to prevent module resolution errors
vi.mock('kaleido-sdk', () => ({
  ApiComponents: {},
}))

import {
  pairsReducer,
  setTradingPairs,
  setWsConnected,
  updatePrice,
  updateQuote,
  clearQuote,
  clearQuoteError,
  setQuoteError,
} from '../pairs.slice'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makePair = (base: string, quote: string, baseId?: string) => ({
  base: {
    endpoints: [],
    name: base,
    precision: 8,
    protocol_ids: {},
    ticker: base,
  },
  base_asset: base,
  base_asset_id: baseId ?? base,
  id: `${base}-${quote}`,
  is_active: true,
  quote: {
    endpoints: [],
    name: quote,
    precision: 8,
    protocol_ids: {},
    ticker: quote,
  },
  quote_asset: quote,
  quote_asset_id: quote,
  routes: [],
})

const makeQuoteResponse = (
  fromTicker: string,
  toTicker: string,
  fromAmount: number
) => ({
  expires_at: Date.now() + 30000,
  fee: {
    base_fee: 0,
    fee_asset: fromTicker,
    fee_asset_precision: 8,
    fee_rate: 0,
    final_fee: 0,
    variable_fee: 0,
  },
  from_asset: { amount: fromAmount, asset_id: fromTicker, ticker: fromTicker },
  price: 50000,
  rfq_id: 'rfq-test',
  timestamp: Date.now(),
  to_asset: { amount: 50_000, asset_id: toTicker, ticker: toTicker },
})

const getInitialState = () => pairsReducer(undefined, { type: '@@INIT' })

// ─── setTradingPairs ──────────────────────────────────────────────────────

describe('setTradingPairs', () => {
  it('stores the trading pairs', () => {
    const pairs = [makePair('BTC', 'USDT')]
    const state = pairsReducer(getInitialState(), setTradingPairs(pairs as any))
    expect(state.values).toHaveLength(1)
  })

  it('populates assets from base_asset values', () => {
    const pairs = [makePair('BTC', 'USDT'), makePair('BTC', 'ETH')]
    const state = pairsReducer(getInitialState(), setTradingPairs(pairs as any))
    expect(state.assets).toContain('BTC')
  })

  it('deduplicates assets', () => {
    const pairs = [makePair('BTC', 'USDT'), makePair('BTC', 'ETH')]
    const state = pairsReducer(getInitialState(), setTradingPairs(pairs as any))
    expect(state.assets.filter((a) => a === 'BTC')).toHaveLength(1)
  })

  it('sorts assets alphabetically', () => {
    const pairs = [makePair('ETH', 'USDT'), makePair('BTC', 'USDT')]
    const state = pairsReducer(getInitialState(), setTradingPairs(pairs as any))
    expect(state.assets[0]).toBe('BTC')
  })
})

// ─── setWsConnected ───────────────────────────────────────────────────────

describe('setWsConnected', () => {
  it('sets wsConnected to true', () => {
    const state = pairsReducer(getInitialState(), setWsConnected(true))
    expect(state.wsConnected).toBe(true)
  })

  it('sets wsConnected to false', () => {
    const state = pairsReducer(
      { ...getInitialState(), wsConnected: true },
      setWsConnected(false)
    )
    expect(state.wsConnected).toBe(false)
  })
})

// ─── updatePrice ──────────────────────────────────────────────────────────

describe('updatePrice', () => {
  it('stores price data under the pair key', () => {
    const state = pairsReducer(
      getInitialState(),
      updatePrice({ pair: 'BTC/USDT', price: 50000, rfq_id: 'abc', size: 1 })
    )
    expect(state.feed['BTC/USDT']).toEqual({
      price: 50000,
      rfq_id: 'abc',
      size: 1,
    })
  })
})

// ─── updateQuote ──────────────────────────────────────────────────────────

describe('updateQuote', () => {
  it('stores the quote under the correct key', () => {
    const quote = makeQuoteResponse('BTC', 'USDT', 1000)
    const state = pairsReducer(getInitialState(), updateQuote(quote as any))
    expect(state.quotes['BTC/USDT/1000']).toBeDefined()
  })

  it('clears quoteError when a quote is received', () => {
    let state = pairsReducer(getInitialState(), setQuoteError('some error'))
    const quote = makeQuoteResponse('BTC', 'USDT', 1000)
    state = pairsReducer(state, updateQuote(quote as any))
    expect(state.quoteError).toBeNull()
  })
})

// ─── clearQuote ───────────────────────────────────────────────────────────

describe('clearQuote', () => {
  it('removes the quote for the specified key', () => {
    const quote = makeQuoteResponse('BTC', 'USDT', 1000)
    let state = pairsReducer(getInitialState(), updateQuote(quote as any))
    state = pairsReducer(
      state,
      clearQuote({ fromAmount: 1000, fromAsset: 'BTC', toAsset: 'USDT' })
    )
    expect(state.quotes['BTC/USDT/1000']).toBeUndefined()
  })

  it('does not affect other quotes', () => {
    const q1 = makeQuoteResponse('BTC', 'USDT', 1000)
    const q2 = makeQuoteResponse('BTC', 'USDT', 2000)
    let state = pairsReducer(getInitialState(), updateQuote(q1 as any))
    state = pairsReducer(state, updateQuote(q2 as any))
    state = pairsReducer(
      state,
      clearQuote({ fromAmount: 1000, fromAsset: 'BTC', toAsset: 'USDT' })
    )
    expect(state.quotes['BTC/USDT/2000']).toBeDefined()
  })
})

// ─── clearQuoteError / setQuoteError ──────────────────────────────────────

describe('setQuoteError', () => {
  it('sets the quoteError', () => {
    const state = pairsReducer(
      getInitialState(),
      setQuoteError('pair not found')
    )
    expect(state.quoteError).toBe('pair not found')
  })
})

describe('clearQuoteError', () => {
  it('clears the quoteError', () => {
    let state = pairsReducer(getInitialState(), setQuoteError('some error'))
    state = pairsReducer(state, clearQuoteError())
    expect(state.quoteError).toBeNull()
  })
})
