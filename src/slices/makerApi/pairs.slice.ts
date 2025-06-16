import { PayloadAction, createSlice } from '@reduxjs/toolkit'

import { TradingPair } from '../makerApi/makerApi.slice'

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

interface QuoteResponse {
  rfq_id: string
  from_asset: string
  from_amount: number
  to_asset: string
  to_amount: number
  price: number
  price_precision: number
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
}

const initialState: PairsState = {
  assets: [],
  feed: {},
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
    setTradingPairs: (state, action: PayloadAction<TradingPair[]>) => {
      state.values = action.payload
      state.assets = [
        ...new Set(action.payload.map((p) => p.base_asset).sort()),
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
      const key = `${quote.from_asset}/${quote.to_asset}/${quote.from_amount}`
      state.quotes[key] = quote
    },
  },
})

export const {
  setTradingPairs,
  setWsConnected,
  updatePrice,
  updateQuote,
  clearQuote,
} = pairsSlice.actions

export const pairsReducer = pairsSlice.reducer
