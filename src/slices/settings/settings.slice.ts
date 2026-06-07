import { createSlice } from '@reduxjs/toolkit'

import { FiatCurrency } from '../priceApi/priceApi.slice'

export type Theme = 'dark' | 'light'

// Which capabilities the app surfaces. 'both' is the default; 'node' / 'mind'
// run a single capability and collapse the other to an "activate" affordance.
export type AppMode = 'both' | 'node' | 'mind'

export const APP_MODE_KEY = 'kaleidoswap_app_mode'

export const isNodeEnabled = (mode: AppMode) => mode !== 'mind'
export const isMindEnabled = (mode: AppMode) => mode !== 'node'

interface SettingsState {
  bitcoinUnit: string
  nodeConnectionString: string
  language: string
  fiatCurrency: FiatCurrency
  theme: Theme
  appMode: AppMode
}

// Load initial language from localStorage (where i18n stores it)
const getInitialLanguage = (): string => {
  try {
    return localStorage.getItem('kaleidoswap_language') || 'en'
  } catch {
    return 'en'
  }
}

const getInitialFiatCurrency = (): FiatCurrency => {
  try {
    return (
      (localStorage.getItem('kaleidoswap_fiat_currency') as FiatCurrency) ||
      'usd'
    )
  } catch {
    return 'usd'
  }
}

const getInitialTheme = (): Theme => {
  // Light mode temporarily disabled until styling is fixed
  return 'dark'
}

const getInitialAppMode = (): AppMode => {
  try {
    const stored = localStorage.getItem(APP_MODE_KEY)
    if (stored === 'node' || stored === 'mind' || stored === 'both') {
      return stored
    }
  } catch {
    /* ignore */
  }
  return 'both'
}

const initialState: SettingsState = {
  appMode: getInitialAppMode(),
  bitcoinUnit: 'SAT',
  fiatCurrency: getInitialFiatCurrency(),
  language: getInitialLanguage(),
  nodeConnectionString: 'http://localhost:3001',
  theme: getInitialTheme(),
}

export const settingsSlice = createSlice({
  initialState,
  name: 'settings',
  reducers: {
    setAppMode(state, action) {
      state.appMode = action.payload
      try {
        localStorage.setItem(APP_MODE_KEY, action.payload)
      } catch {
        // Silently fail if localStorage is not available
      }
    },
    setBitcoinUnit(state, action) {
      state.bitcoinUnit = action.payload
    },
    setFiatCurrency(state, action) {
      state.fiatCurrency = action.payload
      try {
        localStorage.setItem('kaleidoswap_fiat_currency', action.payload)
      } catch {
        // Silently fail if localStorage is not available
      }
    },
    setLanguage(state, action) {
      state.language = action.payload
      // Also save to localStorage so i18n can read it on next app start
      try {
        localStorage.setItem('kaleidoswap_language', action.payload)
      } catch {
        // Silently fail if localStorage is not available
      }
    },
    setNodeConnectionString(state, action) {
      state.nodeConnectionString = action.payload
    },
    setTheme(state, action) {
      state.theme = action.payload
      try {
        localStorage.setItem('kaleidoswap_theme', action.payload)
      } catch {
        // Silently fail if localStorage is not available
      }
    },
  },
})

export const {
  setAppMode,
  setBitcoinUnit,
  setFiatCurrency,
  setLanguage,
  setNodeConnectionString,
  setTheme,
} = settingsSlice.actions
export const settingsReducer = settingsSlice.reducer
