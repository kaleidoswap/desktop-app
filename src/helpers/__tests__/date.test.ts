import { describe, it, expect } from 'vitest'
import { formatDate } from '../date'

// Unix epoch for 2024-01-15 10:30:00 UTC
const FIXED_TIMESTAMP = new Date('2024-01-15T10:30:00.000Z').getTime()

describe('formatDate', () => {
  it('returns a non-empty string', () => {
    expect(formatDate(FIXED_TIMESTAMP)).toBeTruthy()
  })

  it('includes the year', () => {
    expect(formatDate(FIXED_TIMESTAMP)).toContain('2024')
  })

  it('includes the day of the month', () => {
    const result = formatDate(FIXED_TIMESTAMP)
    expect(result).toMatch(/15/)
  })

  it('includes Jan', () => {
    const result = formatDate(FIXED_TIMESTAMP)
    expect(result).toContain('Jan')
  })

  it('produces different output for 12h vs 24h mode', () => {
    const result24h = formatDate(FIXED_TIMESTAMP, true)
    const result12h = formatDate(FIXED_TIMESTAMP, false)
    // 12h format includes AM/PM while 24h does not (in en-US locale)
    expect(result12h).toMatch(/AM|PM/)
    // 24h format should not include AM/PM
    expect(result24h).not.toMatch(/AM|PM/)
  })

  it('defaults to 24h mode', () => {
    const withDefault = formatDate(FIXED_TIMESTAMP)
    const explicit24h = formatDate(FIXED_TIMESTAMP, true)
    expect(withDefault).toBe(explicit24h)
  })
})
