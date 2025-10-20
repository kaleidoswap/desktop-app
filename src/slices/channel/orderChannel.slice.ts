import {
  PayloadAction,
  createDraftSafeSelector,
  createSlice,
} from '@reduxjs/toolkit'
import * as z from 'zod'

import { RootState } from '../../app/store'
import { MIN_CHANNEL_CAPACITY, MAX_CHANNEL_CAPACITY } from '../../constants'

export const OrderChannelFormSchema = z.object({
  assetId: z.string(),
  capacitySat: z
    .number()
    .max(MAX_CHANNEL_CAPACITY, 'Maximum amount is 100000000 satoshis'),
  channelExpireBlocks: z.number().gte(0),
  clientBalanceSat: z.number().gte(0),
  lspAssetAmount: z.number().gte(0).optional(), // LSP-side asset amount for receiving
})

export type TChannelRequestForm = z.infer<typeof OrderChannelFormSchema>

interface SliceState {
  forms: {
    request: TChannelRequestForm
  }
}

export const initialState: SliceState = {
  forms: {
    request: {
      assetId: '',
      capacitySat: MIN_CHANNEL_CAPACITY,
      channelExpireBlocks: 4320, // 1 month
      clientBalanceSat: 0,
      lspAssetAmount: 0,
    },
  },
}
export const orderChannelSlice = createSlice({
  initialState,
  name: 'orderChannel',
  reducers: {
    setChannelRequestForm: (
      state,
      action: PayloadAction<Partial<SliceState['forms']['request']>>
    ) => {
      state.forms.request = {
        ...state.forms.request,
        ...action.payload,
      }
    },
  },
})

export const orderChannelSliceActions = {
  ...orderChannelSlice.actions,
}

// Selectors
const selfSelector = (state: { channel: SliceState }) => state.channel
const formSelector = createDraftSafeSelector(
  selfSelector,
  (_state: RootState, formKey: keyof SliceState['forms']) => formKey,
  (state, formKey) => state.forms[formKey]
)
export const orderChannelSliceSelectors = {
  form: formSelector,
}
