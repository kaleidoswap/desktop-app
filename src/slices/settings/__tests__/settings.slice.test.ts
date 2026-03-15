import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock localStorage and matchMedia before importing the slice
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
})
Object.defineProperty(globalThis, 'window', {
  value: {
    matchMedia: vi.fn(() => ({ matches: false })),
  },
  writable: true,
})

// Also mock priceApi.slice to avoid RTK createApi side effects
vi.mock('../../priceApi/priceApi.slice', () => ({
  FiatCurrency: {},
}))

import {
  settingsReducer,
  setBitcoinUnit,
  setFiatCurrency,
  setLanguage,
  setNodeConnectionString,
  setTheme,
} from '../settings.slice'

beforeEach(() => {
  localStorageMock.clear()
  localStorageMock.getItem.mockClear()
  localStorageMock.setItem.mockClear()
})

// The slice is imported at module level so we use a fresh reducer call approach.
// We build the initial state by calling reducer with undefined.
const getInitialState = () => settingsReducer(undefined, { type: '@@INIT' })

// ─── setBitcoinUnit ────────────────────────────────────────────────────────

describe('setBitcoinUnit', () => {
  it('updates bitcoinUnit', () => {
    const state = settingsReducer(getInitialState(), setBitcoinUnit('BTC'))
    expect(state.bitcoinUnit).toBe('BTC')
  })
})

// ─── setFiatCurrency ───────────────────────────────────────────────────────

describe('setFiatCurrency', () => {
  it('updates fiatCurrency', () => {
    const state = settingsReducer(getInitialState(), setFiatCurrency('eur'))
    expect(state.fiatCurrency).toBe('eur')
  })

  it('persists to localStorage', () => {
    settingsReducer(getInitialState(), setFiatCurrency('eur'))
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'kaleidoswap_fiat_currency',
      'eur'
    )
  })
})

// ─── setLanguage ───────────────────────────────────────────────────────────

describe('setLanguage', () => {
  it('updates language', () => {
    const state = settingsReducer(getInitialState(), setLanguage('fr'))
    expect(state.language).toBe('fr')
  })

  it('persists to localStorage', () => {
    settingsReducer(getInitialState(), setLanguage('fr'))
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'kaleidoswap_language',
      'fr'
    )
  })
})

// ─── setNodeConnectionString ───────────────────────────────────────────────

describe('setNodeConnectionString', () => {
  it('updates nodeConnectionString', () => {
    const state = settingsReducer(
      getInitialState(),
      setNodeConnectionString('http://example.com:3001')
    )
    expect(state.nodeConnectionString).toBe('http://example.com:3001')
  })
})

// ─── setTheme ──────────────────────────────────────────────────────────────

describe('setTheme', () => {
  it('updates theme to light', () => {
    const state = settingsReducer(getInitialState(), setTheme('light'))
    expect(state.theme).toBe('light')
  })

  it('updates theme to dark', () => {
    const state = settingsReducer(getInitialState(), setTheme('dark'))
    expect(state.theme).toBe('dark')
  })

  it('persists theme to localStorage', () => {
    settingsReducer(getInitialState(), setTheme('light'))
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'kaleidoswap_theme',
      'light'
    )
  })
})
