import type { BreezSdk } from '@breeztech/breez-sdk-spark'
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type {
  SparkWalletState,
  SparkWalletInfo,
  SparkPayment,
} from '../../types/spark'

const initialState: SparkWalletState = {
  connected: false,
  connecting: false,
  error: null,
  info: null,
  payments: [],
  sdk: null,
}

const sparkSlice = createSlice({
  initialState,
  name: 'spark',
  reducers: {
    addPayment: (state, action: PayloadAction<SparkPayment>) => {
      state.payments.unshift(action.payload)
    },
    clearError: (state) => {
      state.error = null
    },
    setConnected: (
      state,
      action: PayloadAction<{ sdk: BreezSdk; connected: boolean }>
    ) => {
      state.sdk = action.payload.sdk
      state.connected = action.payload.connected
      state.connecting = false
      state.error = null
    },
    setConnecting: (state, action: PayloadAction<boolean>) => {
      state.connecting = action.payload
      if (action.payload) {
        state.error = null
      }
    },
    setDisconnected: (state) => {
      state.sdk = null
      state.connected = false
      state.connecting = false
      state.info = null
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload
      state.connecting = false
    },
    setPayments: (state, action: PayloadAction<SparkPayment[]>) => {
      state.payments = action.payload
    },
    setWalletInfo: (state, action: PayloadAction<SparkWalletInfo>) => {
      state.info = action.payload
    },
    updatePayment: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<SparkPayment> }>
    ) => {
      const index = state.payments.findIndex((p) => p.id === action.payload.id)
      if (index !== -1) {
        state.payments[index] = {
          ...state.payments[index],
          ...action.payload.updates,
        }
      }
    },
  },
})

export const sparkSliceActions = sparkSlice.actions
export const sparkSliceReducer = sparkSlice.reducer
