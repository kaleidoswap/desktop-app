import type { BreezSdk } from '@breeztech/breez-sdk-spark'
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type {
  SparkWalletState,
  SparkWalletInfo,
  SparkPayment,
  SparkWalletInstance,
  WalletStatus,
} from '../../types/spark'

const initialState: SparkWalletState = {
  activeWalletId: null,
  // Legacy single wallet support (backward compatible)
  connected: false,
  connecting: false,
  error: null,
  info: null,
  multiWalletEnabled: false,

  payments: [],

  sdk: null,
  // Multi-wallet support
  wallets: {},
}

const sparkSlice = createSlice({
  initialState,
  name: 'spark',
  reducers: {
    // Legacy actions (backward compatible)
    addPayment: (state, action: PayloadAction<SparkPayment>) => {
      state.payments.unshift(action.payload)

      // Also add to active wallet if multi-wallet enabled
      if (state.multiWalletEnabled && state.activeWalletId) {
        const walletId = action.payload.walletId || state.activeWalletId
        if (!state.wallets[walletId]) {
          state.wallets[walletId] = {
            config: {} as any,
            createdAt: Date.now(),
            error: null,
            id: walletId,
            info: null,
            label: 'Spark Wallet',
            sdk: null,
            status: 'disconnected',
          }
        }
      }
    },
    addWallet: (state, action: PayloadAction<SparkWalletInstance>) => {
      state.wallets[action.payload.id] = action.payload

      // If no active wallet, set this as active
      if (!state.activeWalletId) {
        state.activeWalletId = action.payload.id
      }
    },

    clearError: (state) => {
      state.error = null
    },

    // Multi-wallet actions
    enableMultiWallet: (state, action: PayloadAction<boolean>) => {
      state.multiWalletEnabled = action.payload
    },

    removeWallet: (state, action: PayloadAction<string>) => {
      const walletId = action.payload
      delete state.wallets[walletId]

      // If removing active wallet, set another as active
      if (state.activeWalletId === walletId) {
        const remainingWallets = Object.keys(state.wallets)
        state.activeWalletId =
          remainingWallets.length > 0 ? remainingWallets[0] : null
      }
    },

    setActiveWallet: (state, action: PayloadAction<string>) => {
      if (state.wallets[action.payload]) {
        state.activeWalletId = action.payload
      }
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
    setWalletError: (
      state,
      action: PayloadAction<{ walletId: string; error: string | null }>
    ) => {
      const { walletId, error } = action.payload
      if (state.wallets[walletId]) {
        state.wallets[walletId].error = error
      }
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
    updateWalletInfo: (
      state,
      action: PayloadAction<{ walletId: string; info: SparkWalletInfo }>
    ) => {
      const { walletId, info } = action.payload
      if (state.wallets[walletId]) {
        state.wallets[walletId].info = info
      }
    },
    updateWalletSdk: (
      state,
      action: PayloadAction<{ walletId: string; sdk: BreezSdk | null }>
    ) => {
      const { walletId, sdk } = action.payload
      if (state.wallets[walletId]) {
        state.wallets[walletId].sdk = sdk
      }
    },
    updateWalletStatus: (
      state,
      action: PayloadAction<{ walletId: string; status: WalletStatus }>
    ) => {
      const { walletId, status } = action.payload
      if (state.wallets[walletId]) {
        state.wallets[walletId].status = status
      }
    },
  },
})

export const sparkSliceActions = sparkSlice.actions
export const sparkSliceReducer = sparkSlice.reducer
