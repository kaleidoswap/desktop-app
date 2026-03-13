import { createSlice } from '@reduxjs/toolkit'

import { FiatCurrency } from '../priceApi/priceApi.slice'

export type Theme = 'dark' | 'light'

interface SettingsState {
  bitcoinUnit: string
  nodeConnectionString: string
  language: string
  fiatCurrency: FiatCurrency
  theme: Theme
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
  try {
    const stored = localStorage.getItem('kaleidoswap_theme') as Theme | null
    if (stored === 'dark' || stored === 'light') return stored
    if (window.matchMedia('(prefers-color-scheme: light)').matches)
      return 'light'
  } catch {
    // Silently fail if localStorage / matchMedia not available
  }
  return 'dark'
}

const initialState: SettingsState = {
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
  setBitcoinUnit,
  setFiatCurrency,
  setLanguage,
  setNodeConnectionString,
  setTheme,
} = settingsSlice.actions
export const settingsReducer = settingsSlice.reducer
