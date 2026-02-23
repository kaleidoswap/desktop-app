import { PayloadAction, createSlice } from '@reduxjs/toolkit'

import { TradingPair } from '../makerApi/makerApi.slice'
import { ApiComponents } from 'kaleidoswap-sdk'

interface PriceData {
  price: number
  size: number
  rfq_id: string
}

export interface FeeDetails {
  base_fee: number
  variable_fee: number
  fee_rate: number
  fee_asset: string
  final_fee: number
  fee_asset_precision: number
}

// Use SwapLeg from SDK for proper typing
export type SwapLeg = ApiComponents['schemas']['SwapLeg']

interface QuoteResponse {
  rfq_id: string
  from_asset: SwapLeg  // Changed from string to SwapLeg
  to_asset: SwapLeg    // Changed from string to SwapLeg
  price: number
  timestamp: number
  expires_at: number
  fee: FeeDetails
}

export interface PairsState {
  assets: string[]
  feed: { [key: string]: PriceData }
  quotes: { [key: string]: QuoteResponse }
  values: TradingPair[]
  ticker: Record<string, number>
  subscribedPairs: string[]
  wsConnected: boolean
  quoteError: string | null
}

const initialState: PairsState = {
  assets: [],
  feed: {},
  quoteError: null,
  quotes: {},
  subscribedPairs: [],
  ticker: {},
  values: [],
  wsConnected: false,
}

export const pairsSlice = createSlice({
  initialState,
  name: 'pairs',
  reducers: {
    clearQuote: (
      state,
      action: PayloadAction<{
        fromAsset: string
        toAsset: string
        fromAmount: number
      }>
    ) => {
      const { fromAsset, toAsset, fromAmount } = action.payload
      const key = `${fromAsset}/${toAsset}/${fromAmount}`
      delete state.quotes[key]
    },
    clearQuoteError: (state) => {
      state.quoteError = null
    },
    setQuoteError: (state, action: PayloadAction<string>) => {
      state.quoteError = action.payload
    },
    setTradingPairs: (state, action: PayloadAction<TradingPair[]>) => {
      state.values = action.payload
      state.assets = [
        ...new Set(
          action.payload
            .map((p) => p.base_asset)
            .filter((a): a is string => !!a)
            .sort()
        ),
      ]
    },
    setWsConnected: (state, action: PayloadAction<boolean>) => {
      state.wsConnected = action.payload
    },
    updatePrice: (state, action: PayloadAction<any>) => {
      const { pair, price, size, rfq_id } = action.payload
      state.feed[pair] = { price, rfq_id, size }
    },
    updateQuote: (state, action: PayloadAction<QuoteResponse>) => {
      const quote = action.payload
      // Use ticker for the key to match how quotes are requested
      const key = `${quote.from_asset.ticker}/${quote.to_asset.ticker}/${quote.from_asset.amount}`
      state.quotes[key] = quote
      // Clear any previous quote error when we get a successful quote
      state.quoteError = null
    },
  },
})

export const {
  setTradingPairs,
  setWsConnected,
  updatePrice,
  updateQuote,
  clearQuote,
  clearQuoteError,
  setQuoteError,
} = pairsSlice.actions

export const pairsReducer = pairsSlice.reducer
