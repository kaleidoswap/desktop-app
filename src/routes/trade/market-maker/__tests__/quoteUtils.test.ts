import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))
vi.mock('../../../../utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}))
vi.mock('../../../../slices/makerApi/makerApi.slice', () => ({
  normalizePairs: vi.fn((pairs: any[]) => pairs),
}))
vi.mock('i18next', () => ({ default: { language: 'en' } }))
vi.mock('../../../../app/hubs/websocketService', () => ({
  webSocketService: {
    requestQuote: vi.fn(),
    isConnectionReadyForCommunication: vi.fn(() => true),
  },
}))

import {
  debouncedQuoteRequest,
  clearDebouncedQuoteRequest,
  startQuoteRequestTimer,
  stopQuoteRequestTimer,
  createAmountChangeQuoteHandler,
} from '../quoteUtils'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  clearDebouncedQuoteRequest()
  stopQuoteRequestTimer()
})

// ─── debouncedQuoteRequest ────────────────────────────────────────────────

describe('debouncedQuoteRequest', () => {
  it('calls requestQuoteFn after the default delay', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    debouncedQuoteRequest(fn)
    expect(fn).not.toHaveBeenCalled()
    await vi.runAllTimersAsync()
    expect(fn).toHaveBeenCalledOnce()
  })

  it('uses a custom delay when provided', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    debouncedQuoteRequest(fn, 200)
    vi.advanceTimersByTime(199)
    expect(fn).not.toHaveBeenCalled()
    await vi.runAllTimersAsync()
    expect(fn).toHaveBeenCalledOnce()
  })

  it('debounces rapid calls — only fires once', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    debouncedQuoteRequest(fn)
    debouncedQuoteRequest(fn)
    debouncedQuoteRequest(fn)
    await vi.runAllTimersAsync()
    expect(fn).toHaveBeenCalledOnce()
  })
})

// ─── clearDebouncedQuoteRequest ───────────────────────────────────────────

describe('clearDebouncedQuoteRequest', () => {
  it('prevents the pending timer from firing', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    debouncedQuoteRequest(fn)
    clearDebouncedQuoteRequest()
    await vi.runAllTimersAsync()
    expect(fn).not.toHaveBeenCalled()
  })

  it('is safe to call when no timer is pending', () => {
    expect(() => clearDebouncedQuoteRequest()).not.toThrow()
  })
})

// ─── startQuoteRequestTimer / stopQuoteRequestTimer ───────────────────────

describe('startQuoteRequestTimer', () => {
  it('calls requestQuote repeatedly at the given interval', () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    startQuoteRequestTimer(fn, 1000)
    vi.advanceTimersByTime(3000)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('replaces any existing timer when called again', () => {
    const fn1 = vi.fn().mockResolvedValue(undefined)
    const fn2 = vi.fn().mockResolvedValue(undefined)
    startQuoteRequestTimer(fn1, 1000)
    startQuoteRequestTimer(fn2, 1000)
    vi.advanceTimersByTime(2000)
    expect(fn1).not.toHaveBeenCalled()
    expect(fn2).toHaveBeenCalledTimes(2)
  })
})

describe('stopQuoteRequestTimer', () => {
  it('stops the interval from firing', () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    startQuoteRequestTimer(fn, 1000)
    vi.advanceTimersByTime(1000)
    stopQuoteRequestTimer()
    vi.advanceTimersByTime(5000)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('is safe to call when no timer is running', () => {
    expect(() => stopQuoteRequestTimer()).not.toThrow()
  })
})

// ─── createAmountChangeQuoteHandler ──────────────────────────────────────

describe('createAmountChangeQuoteHandler', () => {
  const makeEvent = (value: string) =>
    ({ target: { value } }) as React.ChangeEvent<HTMLInputElement>

  it('sets loading states and schedules a quote request for valid amount', async () => {
    const requestQuote = vi.fn().mockResolvedValue(undefined)
    const setIsQuoteLoading = vi.fn()
    const setIsToAmountLoading = vi.fn()

    const handler = createAmountChangeQuoteHandler(
      requestQuote,
      setIsQuoteLoading,
      setIsToAmountLoading
    )
    handler(makeEvent('1000'))

    expect(setIsQuoteLoading).toHaveBeenCalledWith(true)
    expect(setIsToAmountLoading).toHaveBeenCalledWith(true)

    await vi.runAllTimersAsync()
    expect(requestQuote).toHaveBeenCalledOnce()
  })

  it('does not set loading states when hasValidQuote returns true', async () => {
    const requestQuote = vi.fn().mockResolvedValue(undefined)
    const setIsQuoteLoading = vi.fn()
    const setIsToAmountLoading = vi.fn()
    const hasValidQuote = vi.fn(() => true)

    const handler = createAmountChangeQuoteHandler(
      requestQuote,
      setIsQuoteLoading,
      setIsToAmountLoading,
      hasValidQuote
    )
    handler(makeEvent('1000'))

    expect(setIsQuoteLoading).not.toHaveBeenCalledWith(true)
    expect(setIsToAmountLoading).not.toHaveBeenCalledWith(true)
  })

  it('clears loading states when value is empty', () => {
    const requestQuote = vi.fn().mockResolvedValue(undefined)
    const setIsQuoteLoading = vi.fn()
    const setIsToAmountLoading = vi.fn()

    const handler = createAmountChangeQuoteHandler(
      requestQuote,
      setIsQuoteLoading,
      setIsToAmountLoading
    )
    handler(makeEvent(''))

    expect(setIsQuoteLoading).toHaveBeenCalledWith(false)
    expect(setIsToAmountLoading).toHaveBeenCalledWith(false)
    expect(requestQuote).not.toHaveBeenCalled()
  })

  it('clears loading states when value is "0"', () => {
    const requestQuote = vi.fn().mockResolvedValue(undefined)
    const setIsQuoteLoading = vi.fn()

    const handler = createAmountChangeQuoteHandler(
      requestQuote,
      setIsQuoteLoading
    )
    handler(makeEvent('0'))

    expect(setIsQuoteLoading).toHaveBeenCalledWith(false)
    expect(requestQuote).not.toHaveBeenCalled()
  })

  it('debounces rapid input changes', async () => {
    const requestQuote = vi.fn().mockResolvedValue(undefined)
    const handler = createAmountChangeQuoteHandler(requestQuote)

    handler(makeEvent('100'))
    handler(makeEvent('200'))
    handler(makeEvent('300'))

    await vi.runAllTimersAsync()
    expect(requestQuote).toHaveBeenCalledOnce()
  })
})
