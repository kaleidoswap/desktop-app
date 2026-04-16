import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../../utils/logger', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

import { handleApiError } from '../apiUtils'

// ─── handleApiError ───────────────────────────────────────────────────────

describe('handleApiError', () => {
  it('returns "Unknown error occurred" for falsy input', () => {
    expect(handleApiError(null as any)).toBe('Unknown error occurred')
  })

  it('returns string errors directly', () => {
    expect(handleApiError('plain string' as any)).toBe('plain string')
  })

  it('handles TIMEOUT_ERROR', () => {
    const result = handleApiError({
      error: 'timeout',
      status: 'TIMEOUT_ERROR',
    } as any)
    expect(result).toContain('timed out')
  })

  it('handles FETCH_ERROR with timeout in message', () => {
    const result = handleApiError({
      error: 'connection timeout',
      status: 'FETCH_ERROR',
    } as any)
    expect(result).toContain('timed out')
  })

  it('handles FETCH_ERROR without timeout', () => {
    const result = handleApiError({
      error: 'Failed to fetch',
      status: 'FETCH_ERROR',
    } as any)
    expect(result).toContain('quote may have expired')
  })

  it('returns "No error details available" when data is falsy', () => {
    const result = handleApiError({ data: null, status: 400 } as any)
    expect(result).toBe('No error details available')
  })

  it('returns string data directly', () => {
    const result = handleApiError({ data: 'bad request', status: 400 } as any)
    expect(result).toBe('bad request')
  })

  it('extracts detail field from object, stripping status code prefix', () => {
    const result = handleApiError({
      data: { detail: '400: Bad input' },
      status: 400,
    } as any)
    expect(result).toBe('Bad input')
  })

  it('returns detail field as-is when no status code prefix', () => {
    const result = handleApiError({
      data: { detail: 'invalid parameters' },
      status: 400,
    } as any)
    expect(result).toBe('invalid parameters')
  })

  it('extracts and strips "Error: " prefix from error field', () => {
    const result = handleApiError({
      data: { error: 'Error: something failed' },
      status: 500,
    } as any)
    expect(result).toBe('something failed')
  })

  it('strips "API Error (N): " prefix from error field', () => {
    const result = handleApiError({
      data: { error: 'API Error (500): server down' },
      status: 500,
    } as any)
    expect(result).toBe('server down')
  })

  it('returns error field as-is when no recognized prefix', () => {
    const result = handleApiError({
      data: { error: 'internal failure' },
      status: 500,
    } as any)
    expect(result).toBe('internal failure')
  })

  it('falls back to JSON.stringify for unrecognized object data', () => {
    const result = handleApiError({
      data: { unknown: 'field' },
      status: 500,
    } as any)
    expect(result).toContain('unknown')
  })

  it('stringifies non-object, non-string data', () => {
    const result = handleApiError({ data: 42, status: 500 } as any)
    expect(result).toBe('42')
  })
})
