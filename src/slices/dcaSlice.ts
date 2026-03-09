import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export type DcaOrderType = 'scheduled' | 'price-target'
export type DcaOrderStatus = 'active' | 'paused' | 'completed' | 'cancelled'

export type DcaIntervalHours = 1 | 4 | 8 | 24 | 168

export interface DcaExecution {
  id: string
  timestamp: number
  fromAmountUsdt: number
  toAmountSats: number
  priceBtcUsdt: number
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

const STORAGE_KEY = 'kaleidoswap_dca_orders'

const loadFromStorage = (): DcaOrder[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const saveToStorage = (orders: DcaOrder[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
  } catch {
    // Silently fail
  }
}

const initialState: DcaState = {
  orders: loadFromStorage(),
}

export const dcaSlice = createSlice({
  initialState,
  name: 'dca',
  reducers: {
    cancelOrder(state, action: PayloadAction<string>) {
      const order = state.orders.find((o) => o.id === action.payload)
      if (order) {
        order.status = 'cancelled'
        saveToStorage(state.orders)
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
      const { type, amountUsdt, intervalHours, targetDropPercent, creationPriceBtcUsdt } =
        action.payload

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
        order.nextExecutionAt = now + intervalHours * 3600 * 1000
      }

      if (type === 'price-target' && targetDropPercent && creationPriceBtcUsdt) {
        order.targetDropPercent = targetDropPercent
        order.creationPriceBtcUsdt = creationPriceBtcUsdt
        order.triggerPriceBtcUsdt = creationPriceBtcUsdt * (1 - targetDropPercent / 100)
      }

      state.orders.unshift(order)
      saveToStorage(state.orders)
    },

    pauseOrder(state, action: PayloadAction<string>) {
      const order = state.orders.find((o) => o.id === action.payload)
      if (order && order.status === 'active') {
        order.status = 'paused'
        saveToStorage(state.orders)
      }
    },

    recordExecution(
      state,
      action: PayloadAction<{
        orderId: string
        fromAmountUsdt: number
        toAmountSats: number
        priceBtcUsdt: number
        status: 'success' | 'failed'
        error?: string
      }>
    ) {
      const { orderId, fromAmountUsdt, toAmountSats, priceBtcUsdt, status, error } =
        action.payload
      const order = state.orders.find((o) => o.id === orderId)
      if (!order) return

      const execution: DcaExecution = {
        error,
        fromAmountUsdt,
        id: crypto.randomUUID(),
        priceBtcUsdt,
        status,
        timestamp: Date.now(),
        toAmountSats,
      }
      order.executions.push(execution)
      order.lastExecutedAt = execution.timestamp

      if (order.type === 'scheduled' && order.intervalHours) {
        order.nextExecutionAt = execution.timestamp + order.intervalHours * 3600 * 1000
      }

      saveToStorage(state.orders)
    },

    resumeOrder(state, action: PayloadAction<string>) {
      const order = state.orders.find((o) => o.id === action.payload)
      if (order && order.status === 'paused') {
        order.status = 'active'
        // Reset next execution for scheduled orders
        if (order.type === 'scheduled' && order.intervalHours) {
          order.nextExecutionAt = Date.now() + order.intervalHours * 3600 * 1000
        }
        saveToStorage(state.orders)
      }
    },

    updateAfterExecution(
      state,
      action: PayloadAction<{ orderId: string; newCreationPrice: number }>
    ) {
      const { orderId, newCreationPrice } = action.payload
      const order = state.orders.find((o) => o.id === orderId)
      if (order && order.type === 'price-target' && order.targetDropPercent) {
        order.creationPriceBtcUsdt = newCreationPrice
        order.triggerPriceBtcUsdt = newCreationPrice * (1 - order.targetDropPercent / 100)
        saveToStorage(state.orders)
      }
    },
  },
})

export const { createOrder, cancelOrder, pauseOrder, resumeOrder, recordExecution, updateAfterExecution } =
  dcaSlice.actions
export const dcaReducer = dcaSlice.reducer
