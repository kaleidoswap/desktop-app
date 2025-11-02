import { createSlice, PayloadAction } from '@reduxjs/toolkit'

import type { MultiWalletConfig } from '../../types/spark'

interface SettingsState {
  bitcoinUnit: string
  nodeConnectionString: string
  sparkWalletsConfig: MultiWalletConfig
  showSparkWallet: boolean
  showRgbAssets: boolean
  showSparkAssets: boolean
}

const initialState: SettingsState = {
  bitcoinUnit: 'SAT',
  nodeConnectionString: 'http://localhost:3001',
  showRgbAssets: true,
  showSparkAssets: true,
  showSparkWallet: true,
  sparkWalletsConfig: {
    activeWalletId: undefined,
    defaultNetwork: 'regtest',
    wallets: {},
  },
}

export const settingsSlice = createSlice({
  initialState,
  name: 'settings',
  reducers: {
    removeSparkWalletConfig(state, action: PayloadAction<string>) {
      delete state.sparkWalletsConfig.wallets[action.payload]
    },
    setActiveSparkWallet(state, action: PayloadAction<string | undefined>) {
      state.sparkWalletsConfig.activeWalletId = action.payload
    },
    setBitcoinUnit(state, action: PayloadAction<string>) {
      state.bitcoinUnit = action.payload
    },
    setNodeConnectionString(state, action: PayloadAction<string>) {
      state.nodeConnectionString = action.payload
    },
    setShowRgbAssets(state, action: PayloadAction<boolean>) {
      state.showRgbAssets = action.payload
    },
    setShowSparkAssets(state, action: PayloadAction<boolean>) {
      state.showSparkAssets = action.payload
    },
    setShowSparkWallet(state, action: PayloadAction<boolean>) {
      state.showSparkWallet = action.payload
    },
    setSparkWalletsConfig(state, action: PayloadAction<MultiWalletConfig>) {
      state.sparkWalletsConfig = action.payload
    },
    updateSparkWalletConfig(
      state,
      action: PayloadAction<{ walletId: string; config: any }>
    ) {
      state.sparkWalletsConfig.wallets[action.payload.walletId] =
        action.payload.config
    },
  },
})

export const {
  setBitcoinUnit,
  setNodeConnectionString,
  setSparkWalletsConfig,
  updateSparkWalletConfig,
  removeSparkWalletConfig,
  setActiveSparkWallet,
  setShowSparkWallet,
  setShowRgbAssets,
  setShowSparkAssets,
} = settingsSlice.actions
export const settingsReducer = settingsSlice.reducer
