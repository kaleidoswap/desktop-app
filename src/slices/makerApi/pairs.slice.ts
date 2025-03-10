import { PayloadAction, createSlice } from '@reduxjs/toolkit'

import { TradingPair } from '../makerApi/makerApi.slice'

interface PriceData {
  price: number
  size: number
  rfq_id: string
}

interface QuoteResponse {
  from_asset: string
  to_asset: string
  from_amount: number
  to_amount: number
  taker_to_amount: number
  price: number
  base_fee: number
  variable_fee: number
  final_fee: number
  fee_rate: number
  price_precision: number
  timestamp: number
  expires_at: number
  rfq_id: string
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
    setTradingPairs: (state, action: PayloadAction<TradingPair[]>) => {
      state.values = action.payload
      state.assets = [
        ...new Set(action.payload.map((p) => p.base_asset).sort()),
      ]
    },
    setWsConnected: (state, action: PayloadAction<boolean>) => {
      state.wsConnected = action.payload
    },
    subscribeToPair: (state, action: PayloadAction<string>) => {
      if (!state.subscribedPairs.includes(action.payload)) {
        state.subscribedPairs.push(action.payload)
      }
    },
    unsubscribeFromPair: (state, action: PayloadAction<string>) => {
      state.subscribedPairs = state.subscribedPairs.filter(
        (pair) => pair !== action.payload
      )
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
  subscribeToPair,
  unsubscribeFromPair,
  updatePrice,
  updateQuote,
} = pairsSlice.actions

export const pairsReducer = pairsSlice.reducer
