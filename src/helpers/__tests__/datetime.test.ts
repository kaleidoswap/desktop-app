import { describe, it, expect } from 'vitest'
import { formatTimeAgo, blocksToTime } from '../datetime'

// ─── formatTimeAgo ────────────────────────────────────────────────────────────

describe('formatTimeAgo', () => {
  const now = new Date()

  const secondsAgo = (s: number) => new Date(now.getTime() - s * 1000)

  it('shows seconds for timestamps less than a minute ago', () => {
    const result = formatTimeAgo(secondsAgo(30))
    expect(result).toMatch(/\d+ seconds ago/)
  })

  it('shows minutes for timestamps between 1 and 60 minutes ago', () => {
    const result = formatTimeAgo(secondsAgo(90))
    expect(result).toMatch(/\d+ minutes? ago/)
  })

  it('shows hours for timestamps between 1 and 24 hours ago', () => {
    const result = formatTimeAgo(secondsAgo(3700))
    expect(result).toMatch(/\d+ hours? ago/)
  })

  it('shows days for timestamps more than 24 hours ago', () => {
    const result = formatTimeAgo(secondsAgo(86500))
    expect(result).toMatch(/\d+ days? ago/)
  })

  it('reports the correct number of seconds', () => {
    const result = formatTimeAgo(secondsAgo(45))
    expect(result).toBe('45 seconds ago')
  })

  it('reports the correct number of minutes', () => {
    const result = formatTimeAgo(secondsAgo(120))
    expect(result).toBe('2 minutes ago')
  })

  it('reports the correct number of hours', () => {
    const result = formatTimeAgo(secondsAgo(7200))
    expect(result).toBe('2 hours ago')
  })

  it('reports the correct number of days', () => {
    const result = formatTimeAgo(secondsAgo(172800))
    expect(result).toBe('2 days ago')
  })
})

// ─── blocksToTime ─────────────────────────────────────────────────────────────

describe('blocksToTime', () => {
  it('returns "less than a minute" for 0 blocks', () => {
    expect(blocksToTime(0)).toBe('less than a minute')
  })

  it('converts blocks to minutes', () => {
    // 1 block = 10 minutes
    expect(blocksToTime(1)).toBe('10 minutes')
  })

  it('converts 6 blocks to 1 hour', () => {
    expect(blocksToTime(6)).toBe('1 hour')
  })

  it('converts 144 blocks to 1 day', () => {
    // 144 blocks * 10 min = 1440 min = 1 day
    expect(blocksToTime(144)).toBe('1 day')
  })

  it('handles plural day', () => {
    expect(blocksToTime(288)).toBe('2 days')
  })

  it('handles plural hour', () => {
    expect(blocksToTime(12)).toBe('2 hours')
  })

  it('handles mixed days, hours and minutes', () => {
    // 145 blocks = 1450 min = 1 day + 10 minutes
    expect(blocksToTime(145)).toBe('1 day, 10 minutes')
  })

  it('handles mixed hours and minutes', () => {
    // 7 blocks = 70 min = 1 hour, 10 minutes
    expect(blocksToTime(7)).toBe('1 hour, 10 minutes')
  })

  it('handles mixed days and hours (no leftover minutes)', () => {
    // 150 blocks = 1500 min = 1 day + 1 hour
    expect(blocksToTime(150)).toBe('1 day, 1 hour')
  })
})
