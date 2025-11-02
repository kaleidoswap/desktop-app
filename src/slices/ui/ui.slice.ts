import {
  PayloadAction,
  createDraftSafeSelector,
  createSlice,
} from '@reduxjs/toolkit'

export type DepositModal = {
  assetId: string | undefined
  type: 'deposit'
}

export type WithdrawModal = {
  assetId: string | undefined
  type: 'withdraw'
}

export type SparkDepositModal = {
  type: 'spark-deposit'
}

export type SparkWithdrawModal = {
  type: 'spark-withdraw'
}

export type SparkL1WithdrawModal = {
  type: 'spark-l1-withdraw'
}

export type WalletTypeSelectionModal = {
  type: 'wallet-type-selection'
  context?: 'setup' | 'dashboard'
}

export type AddWalletModal = {
  type: 'add-wallet'
  walletType?: 'spark' | 'arkade'
}

export type ManageWalletsModal = {
  type: 'manage-wallets'
}

export type UnifiedWalletActionModal = {
  type: 'unified-wallet-action'
  action?: 'deposit' | 'withdraw'
  assetId?: string
}

type Modal =
  | DepositModal
  | WithdrawModal
  | SparkDepositModal
  | SparkWithdrawModal
  | SparkL1WithdrawModal
  | WalletTypeSelectionModal
  | AddWalletModal
  | ManageWalletsModal
  | UnifiedWalletActionModal
  | {
      type: 'none'
    }

interface SliceState {
  modal: Modal
}

const initialState: SliceState = {
  modal: {
    type: 'none',
  },
}

export const uiSlice = createSlice({
  initialState,
  name: 'ui',
  reducers: {
    setModal: (state, action: PayloadAction<Modal>) => {
      state.modal = action.payload
    },
  },
})

export const uiSliceActions = {
  ...uiSlice.actions,
}

// Selectors
const selfSelector = (state: { ui: SliceState }) => state.ui
const modalSelector = createDraftSafeSelector(
  selfSelector,
  (state) => state.modal
)

export const uiSliceSeletors = {
  modal: modalSelector,
}
