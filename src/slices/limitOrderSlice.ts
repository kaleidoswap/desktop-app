import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type LimitOrderSide = 'buy' | 'sell'
export type LimitOrderStatus =
  'active' | 'paused' | 'filled' | 'expired' | 'cancelled'

export interface LimitOrderExecution {
  id: string
  timestamp: number
  fromAmount: number
  fromAssetTicker: string
  toAmount: number
  toAssetTicker: string
  executionPrice: number
  feeSats?: number
  status: 'success' | 'failed'
  error?: string
}

export interface LimitOrder {
  id: string
  side: LimitOrderSide
  status: LimitOrderStatus
  createdAt: number

  // Pair definition
  pairId: string
  baseAssetTicker: string
  baseAssetId: string
  quoteAssetTicker: string
  quoteAssetId: string

  // Order parameters
  limitPrice: number
  amount: number
  amountRaw: number

  // Expiration
  expiresAt?: number

  // Execution tracking
  executions: LimitOrderExecution[]
  filledAt?: number
}

interface LimitOrderState {
  orders: LimitOrder[]
}

const initialState: LimitOrderState = {
  orders: [],
}

export const limitOrderSlice = createSlice({
  initialState,
  name: 'limitOrders',
  reducers: {
    cancelLimitOrder(state, action: PayloadAction<string>) {
      const order = state.orders.find((o) => o.id === action.payload)
      if (order && (order.status === 'active' || order.status === 'paused')) {
        order.status = 'cancelled'
      }
    },

    createLimitOrder(
      state,
      action: PayloadAction<{
        side: LimitOrderSide
        pairId: string
        baseAssetTicker: string
        baseAssetId: string
        quoteAssetTicker: string
        quoteAssetId: string
        limitPrice: number
        amount: number
        amountRaw: number
        expiresAt?: number
      }>
    ) {
      const {
        side,
        pairId,
        baseAssetTicker,
        baseAssetId,
        quoteAssetTicker,
        quoteAssetId,
        limitPrice,
        amount,
        amountRaw,
        expiresAt,
      } = action.payload

      const order: LimitOrder = {
        amount,
        amountRaw,
        baseAssetId,
        baseAssetTicker,
        createdAt: Date.now(),
        executions: [],
        expiresAt,
        id: crypto.randomUUID(),
        limitPrice,
        pairId,
        quoteAssetId,
        quoteAssetTicker,
        side,
        status: 'active',
      }

      state.orders.unshift(order)
    },

    deleteLimitOrder(state, action: PayloadAction<string>) {
      state.orders = state.orders.filter((o) => o.id !== action.payload)
    },

    expireLimitOrder(state, action: PayloadAction<string>) {
      const order = state.orders.find((o) => o.id === action.payload)
      if (order && order.status === 'active') {
        order.status = 'expired'
      }
    },

    pauseLimitOrder(state, action: PayloadAction<string>) {
      const order = state.orders.find((o) => o.id === action.payload)
      if (order && order.status === 'active') {
        order.status = 'paused'
      }
    },

    recordLimitExecution(
      state,
      action: PayloadAction<{
        orderId: string
        fromAmount: number
        fromAssetTicker: string
        toAmount: number
        toAssetTicker: string
        executionPrice: number
        feeSats?: number
        status: 'success' | 'failed'
        error?: string
      }>
    ) {
      const {
        orderId,
        fromAmount,
        fromAssetTicker,
        toAmount,
        toAssetTicker,
        executionPrice,
        feeSats,
        status,
        error,
      } = action.payload
      const order = state.orders.find((o) => o.id === orderId)
      if (!order) return

      const execution: LimitOrderExecution = {
        error,
        executionPrice,
        feeSats,
        fromAmount,
        fromAssetTicker,
        id: crypto.randomUUID(),
        status,
        timestamp: Date.now(),
        toAmount,
        toAssetTicker,
      }
      order.executions.push(execution)

      if (status === 'success') {
        order.status = 'filled'
        order.filledAt = execution.timestamp
      }
    },

    resumeLimitOrder(state, action: PayloadAction<string>) {
      const order = state.orders.find((o) => o.id === action.payload)
      if (order && order.status === 'paused') {
        order.status = 'active'
      }
    },

    setLimitOrders(state, action: PayloadAction<LimitOrder[]>) {
      state.orders = action.payload
    },
  },
})

export const {
  cancelLimitOrder,
  createLimitOrder,
  deleteLimitOrder,
  expireLimitOrder,
  pauseLimitOrder,
  recordLimitExecution,
  resumeLimitOrder,
  setLimitOrders,
} = limitOrderSlice.actions
export const limitOrderReducer = limitOrderSlice.reducer
