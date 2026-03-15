import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../../utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
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
      status: 'TIMEOUT_ERROR',
      error: 'timeout',
    } as any)
    expect(result).toContain('timed out')
  })

  it('handles FETCH_ERROR with timeout in message', () => {
    const result = handleApiError({
      status: 'FETCH_ERROR',
      error: 'connection timeout',
    } as any)
    expect(result).toContain('timed out')
  })

  it('handles FETCH_ERROR without timeout', () => {
    const result = handleApiError({
      status: 'FETCH_ERROR',
      error: 'Failed to fetch',
    } as any)
    expect(result).toContain('Network error')
  })

  it('returns "No error details available" when data is falsy', () => {
    const result = handleApiError({ status: 400, data: null } as any)
    expect(result).toBe('No error details available')
  })

  it('returns string data directly', () => {
    const result = handleApiError({ status: 400, data: 'bad request' } as any)
    expect(result).toBe('bad request')
  })

  it('extracts detail field from object, stripping status code prefix', () => {
    const result = handleApiError({
      status: 400,
      data: { detail: '400: Bad input' },
    } as any)
    expect(result).toBe('Bad input')
  })

  it('returns detail field as-is when no status code prefix', () => {
    const result = handleApiError({
      status: 400,
      data: { detail: 'invalid parameters' },
    } as any)
    expect(result).toBe('invalid parameters')
  })

  it('extracts and strips "Error: " prefix from error field', () => {
    const result = handleApiError({
      status: 500,
      data: { error: 'Error: something failed' },
    } as any)
    expect(result).toBe('something failed')
  })

  it('strips "API Error (N): " prefix from error field', () => {
    const result = handleApiError({
      status: 500,
      data: { error: 'API Error (500): server down' },
    } as any)
    expect(result).toBe('server down')
  })

  it('returns error field as-is when no recognized prefix', () => {
    const result = handleApiError({
      status: 500,
      data: { error: 'internal failure' },
    } as any)
    expect(result).toBe('internal failure')
  })

  it('falls back to JSON.stringify for unrecognized object data', () => {
    const result = handleApiError({
      status: 500,
      data: { unknown: 'field' },
    } as any)
    expect(result).toContain('unknown')
  })

  it('stringifies non-object, non-string data', () => {
    const result = handleApiError({ status: 500, data: 42 } as any)
    expect(result).toBe('42')
  })
})
