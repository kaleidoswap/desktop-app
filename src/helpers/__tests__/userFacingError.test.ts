import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'

import { toUserFacingError } from '../userFacingError'

const t = ((_key: string, fallback?: string) => fallback ?? _key) as TFunction

describe('toUserFacingError', () => {
  it('hides runtime type errors behind a friendly message and keeps details', () => {
    const result = toUserFacingError(
      new TypeError("Cannot read properties of undefined (reading 'invoke')"),
      t
    )
    expect(result.message).toBe(
      'This feature is only available in the desktop app.'
    )
    expect(result.details).toContain("reading 'invoke'")
  })

  it('maps RTK Query fetch errors to an unreachable-node message', () => {
    const result = toUserFacingError(
      { error: 'TypeError: Failed to fetch', status: 'FETCH_ERROR' },
      t
    )
    expect(result.message).toMatch(/Could not reach the node/)
  })

  it('maps 401 responses and strips the SDK prefix from details', () => {
    const result = toUserFacingError(
      { data: { error: 'API Error (401): Invalid password' }, status: 401 },
      t
    )
    expect(result.message).toMatch(/Authentication failed/)
    expect(result.details).toBe('Invalid password')
  })

  it('passes short human-readable node messages through unchanged', () => {
    const result = toUserFacingError(
      { data: { error: 'API Error (400): Not enough UTXOs to open channel' } },
      t
    )
    expect(result.message).toBe('Not enough UTXOs to open channel')
  })

  it('falls back to the generic message for JSON blobs and long text', () => {
    expect(toUserFacingError({ foo: { bar: 1 } }, t).message).toBe(
      'Something went wrong. Please try again.'
    )
    expect(toUserFacingError('x'.repeat(200), t).message).toBe(
      'Something went wrong. Please try again.'
    )
  })

  it('uses the caller fallback key', () => {
    const tt = ((key: string, fallback?: string) =>
      key === 'errors.user.loadOrders'
        ? 'Could not load orders.'
        : fallback) as TFunction
    expect(
      toUserFacingError(
        new TypeError('x is not a function'),
        tt,
        'errors.user.loadOrders'
      ).message
    ).toBe('Could not load orders.')
  })
})
