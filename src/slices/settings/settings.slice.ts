import { createSlice } from '@reduxjs/toolkit'

interface SettingsState {
  bitcoinUnit: string
  nodeConnectionString: string
  language: string
}

const initialState: SettingsState = {
  bitcoinUnit: 'SAT',
  language: 'en',
  nodeConnectionString: 'http://localhost:3001',
}

export const settingsSlice = createSlice({
  initialState,
  name: 'settings',
  reducers: {
    setBitcoinUnit(state, action) {
      state.bitcoinUnit = action.payload
    },
    setLanguage(state, action) {
      state.language = action.payload
    },
    setNodeConnectionString(state, action) {
      state.nodeConnectionString = action.payload
    },
  },
})

export const { setBitcoinUnit, setLanguage, setNodeConnectionString } =
  settingsSlice.actions
export const settingsReducer = settingsSlice.reducer
