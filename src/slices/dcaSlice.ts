import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type DcaOrderType = 'scheduled' | 'price-target'
export type DcaOrderStatus = 'active' | 'paused' | 'completed' | 'cancelled'

// Stored as fractional hours; 1/60 ≈ 0.01667 = 1 minute
export type DcaIntervalHours = number

export interface DcaExecution {
  id: string
  timestamp: number
  fromAmountUsdt: number
  toAmountSats: number
  priceBtcUsdt: number
  feeSats?: number
  status: 'success' | 'failed'
  error?: string
}

export interface DcaOrder {
  id: string
  type: DcaOrderType
  status: DcaOrderStatus
  amountUsdt: number
  createdAt: number
  executions: DcaExecution[]

  // Scheduled
  intervalHours?: DcaIntervalHours
  lastExecutedAt?: number
  nextExecutionAt?: number

  // Price-target
  creationPriceBtcUsdt?: number
  targetDropPercent?: number
  triggerPriceBtcUsdt?: number
}

interface DcaState {
  orders: DcaOrder[]
}

const initialState: DcaState = {
  orders: [],
}

export const dcaSlice = createSlice({
  initialState,
  name: 'dca',
  reducers: {
    cancelOrder(state, action: PayloadAction<string>) {
      const order = state.orders.find((o) => o.id === action.payload)
      if (order) {
        order.status = 'cancelled'
      }
    },

    createOrder(
      state,
      action: PayloadAction<{
        type: DcaOrderType
        amountUsdt: number
        intervalHours?: DcaIntervalHours
        targetDropPercent?: number
        creationPriceBtcUsdt?: number
      }>
    ) {
      const {
        type,
        amountUsdt,
        intervalHours,
        targetDropPercent,
        creationPriceBtcUsdt,
      } = action.payload

      const now = Date.now()
      const order: DcaOrder = {
        amountUsdt,
        createdAt: now,
        executions: [],
        id: crypto.randomUUID(),
        status: 'active',
        type,
      }

      if (type === 'scheduled' && intervalHours) {
        order.intervalHours = intervalHours
        order.lastExecutedAt = now
        order.nextExecutionAt = now + intervalHours * 3600 * 1000
      }

      if (
        type === 'price-target' &&
        targetDropPercent &&
        creationPriceBtcUsdt
      ) {
        order.targetDropPercent = targetDropPercent
        order.creationPriceBtcUsdt = creationPriceBtcUsdt
        order.triggerPriceBtcUsdt =
          creationPriceBtcUsdt * (1 - targetDropPercent / 100)
      }

      state.orders.unshift(order)
    },

    deleteOrder(state, action: PayloadAction<string>) {
      state.orders = state.orders.filter((o) => o.id !== action.payload)
    },

    pauseOrder(state, action: PayloadAction<string>) {
      const order = state.orders.find((o) => o.id === action.payload)
      if (order && order.status === 'active') {
        order.status = 'paused'
      }
    },

    recordExecution(
      state,
      action: PayloadAction<{
        orderId: string
        fromAmountUsdt: number
        toAmountSats: number
        priceBtcUsdt: number
        feeSats?: number
        status: 'success' | 'failed'
        error?: string
      }>
    ) {
      const {
        orderId,
        fromAmountUsdt,
        toAmountSats,
        priceBtcUsdt,
        feeSats,
        status,
        error,
      } = action.payload
      const order = state.orders.find((o) => o.id === orderId)
      if (!order) return

      const execution: DcaExecution = {
        error,
        feeSats,
        fromAmountUsdt,
        id: crypto.randomUUID(),
        priceBtcUsdt,
        status,
        timestamp: Date.now(),
        toAmountSats,
      }
      order.executions.push(execution)

      if (status === 'success') {
        order.lastExecutedAt = execution.timestamp

        if (order.type === 'scheduled' && order.intervalHours) {
          order.nextExecutionAt =
            execution.timestamp + order.intervalHours * 3600 * 1000
        }
      }
    },

    resumeOrder(state, action: PayloadAction<string>) {
      const order = state.orders.find((o) => o.id === action.payload)
      if (order && order.status === 'paused') {
        order.status = 'active'
        if (order.type === 'scheduled' && order.intervalHours) {
          const now = Date.now()
          order.lastExecutedAt = now
          order.nextExecutionAt = now + order.intervalHours * 3600 * 1000
        }
      }
    },

    setOrders(state, action: PayloadAction<DcaOrder[]>) {
      state.orders = action.payload
    },

    updateAfterExecution(
      state,
      action: PayloadAction<{ orderId: string; newCreationPrice: number }>
    ) {
      const { orderId, newCreationPrice } = action.payload
      const order = state.orders.find((o) => o.id === orderId)
      if (order && order.type === 'price-target' && order.targetDropPercent) {
        order.creationPriceBtcUsdt = newCreationPrice
        order.triggerPriceBtcUsdt =
          newCreationPrice * (1 - order.targetDropPercent / 100)
      }
    },
  },
})

export const {
  cancelOrder,
  createOrder,
  deleteOrder,
  pauseOrder,
  recordExecution,
  resumeOrder,
  setOrders,
  updateAfterExecution,
} = dcaSlice.actions
export const dcaReducer = dcaSlice.reducer
