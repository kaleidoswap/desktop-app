import { describe, it, expect, vi } from 'vitest'

vi.mock('react-toastify', () => ({
  toast: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))
vi.mock('../../../../utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}))
vi.mock('../../../../slices/makerApi/makerApi.slice', () => ({
  normalizePairs: vi.fn((pairs: any[]) => pairs),
  TradingPair: {},
}))
vi.mock('i18next', () => ({ default: { language: 'en' } }))

import {
  findComplementaryAsset,
  getAvailableAssets,
  getUnconfirmedAssets,
  getAvailableAssetTickers,
  validateTradingPairs,
  isPairSafeToTrade,
  getAssetConflictsForTicker,
  mapAssetIdToTicker,
  mapTickerToAssetId,
  isAssetId,
  getDefaultMakerUrls,
} from '../assetUtils'

import type { TradingPair } from '../../../../slices/makerApi/makerApi.slice'

// ─── Test helpers ─────────────────────────────────────────────────────────────

/** Build a TradingPair with populated computed fields */
const makePair = (
  baseAsset: string,
  baseAssetId: string,
  quoteAsset: string,
  quoteAssetId: string,
  overrides: Partial<TradingPair> = {}
): TradingPair => ({
  id: `${baseAsset}-${quoteAsset}`,
  base: {
    ticker: baseAsset,
    name: baseAsset,
    precision: 8,
    protocol_ids: { RGB: baseAssetId },
    endpoints: [],
  },
  quote: {
    ticker: quoteAsset,
    name: quoteAsset,
    precision: 8,
    protocol_ids: { RGB: quoteAssetId },
    endpoints: [],
  },
  base_asset: baseAsset,
  quote_asset: quoteAsset,
  base_asset_id: baseAssetId,
  quote_asset_id: quoteAssetId,
  routes: [],
  is_active: true,
  ...overrides,
})

/** Build a minimal channel object for testing */
const makeChannel = (
  assetId: string | null,
  ready: boolean,
  outbound = 1000,
  inbound = 0
) => ({
  asset_id: assetId ?? undefined,
  ready,
  outbound_balance_msat: outbound,
  inbound_balance_msat: inbound,
})

/** Build a minimal SDK Asset object */
const makeAsset = (ticker: string, rgbId?: string) => ({
  ticker,
  name: ticker,
  precision: 8,
  protocol_ids: rgbId ? { RGB: rgbId } : undefined,
  is_active: true,
})

const BTC_USDT = makePair('BTC', 'BTC', 'USDT', 'rgb:usdt-id')
const BTC_ETH = makePair('BTC', 'BTC', 'ETH', 'rgb:eth-id')

// ─── findComplementaryAsset ────────────────────────────────────────────────────

describe('findComplementaryAsset', () => {
  it('finds the complement of the base asset', () => {
    expect(findComplementaryAsset('BTC', [BTC_USDT])).toBe('USDT')
  })

  it('finds the complement of the quote asset', () => {
    expect(findComplementaryAsset('USDT', [BTC_USDT])).toBe('BTC')
  })

  it('returns undefined when no pair contains the asset', () => {
    expect(findComplementaryAsset('DOGE', [BTC_USDT])).toBeUndefined()
  })

  it('returns the first complement when multiple pairs exist', () => {
    const result = findComplementaryAsset('BTC', [BTC_USDT, BTC_ETH])
    expect(['USDT', 'ETH']).toContain(result)
  })

  it('returns undefined for an empty pairs list', () => {
    expect(findComplementaryAsset('BTC', [])).toBeUndefined()
  })
})

// ─── getAvailableAssets ────────────────────────────────────────────────────────

describe('getAvailableAssets', () => {
  it('returns ["BTC"] when channels is empty', () => {
    expect(getAvailableAssets([], [])).toEqual(['BTC'])
  })

  it('includes BTC always', () => {
    const result = getAvailableAssets([], [])
    expect(result).toContain('BTC')
  })

  it('includes asset_id for ready channels with balance', () => {
    const channel = makeChannel('rgb:usdt-id', true, 5000)
    const result = getAvailableAssets([channel], [])
    expect(result).toContain('rgb:usdt-id')
  })

  it('excludes asset_id for channels that are not ready', () => {
    const channel = makeChannel('rgb:usdt-id', false, 5000)
    const result = getAvailableAssets([channel], [])
    expect(result).not.toContain('rgb:usdt-id')
  })

  it('excludes channels with zero balance', () => {
    const channel = makeChannel('rgb:usdt-id', true, 0, 0)
    const result = getAvailableAssets([channel], [])
    expect(result).not.toContain('rgb:usdt-id')
  })

  it('includes channels that have inbound balance (not just outbound)', () => {
    const channel = makeChannel('rgb:usdt-id', true, 0, 5000)
    const result = getAvailableAssets([channel], [])
    expect(result).toContain('rgb:usdt-id')
  })

  it('deduplicates repeated asset IDs', () => {
    const ch1 = makeChannel('rgb:usdt-id', true, 5000)
    const ch2 = makeChannel('rgb:usdt-id', true, 3000)
    const result = getAvailableAssets([ch1, ch2], [])
    expect(result.filter((id) => id === 'rgb:usdt-id')).toHaveLength(1)
  })
})

// ─── getUnconfirmedAssets ─────────────────────────────────────────────────────

describe('getUnconfirmedAssets', () => {
  it('returns empty array when channels is empty', () => {
    expect(getUnconfirmedAssets([], [])).toEqual([])
  })

  it('returns asset_ids for channels that are NOT ready', () => {
    const channel = makeChannel('rgb:usdt-id', false)
    expect(getUnconfirmedAssets([channel], [])).toContain('rgb:usdt-id')
  })

  it('excludes ready channels', () => {
    const channel = makeChannel('rgb:usdt-id', true, 5000)
    expect(getUnconfirmedAssets([channel], [])).not.toContain('rgb:usdt-id')
  })

  it('excludes channels without an asset_id', () => {
    const channel = makeChannel(null, false)
    expect(getUnconfirmedAssets([channel], [])).toHaveLength(0)
  })
})

// ─── getAvailableAssetTickers ─────────────────────────────────────────────────

describe('getAvailableAssetTickers', () => {
  it('always includes BTC', () => {
    expect(getAvailableAssetTickers([], [])).toContain('BTC')
  })

  it('maps asset_id to ticker via assets list', () => {
    const channel = makeChannel('rgb:usdt-id', true, 5000)
    const asset = makeAsset('USDT', 'rgb:usdt-id')
    const result = getAvailableAssetTickers([channel], [asset])
    expect(result).toContain('USDT')
  })

  it('excludes assets with no ready channel', () => {
    const channel = makeChannel('rgb:usdt-id', false, 0, 0)
    const asset = makeAsset('USDT', 'rgb:usdt-id')
    const result = getAvailableAssetTickers([channel], [asset])
    expect(result).not.toContain('USDT')
  })
})

// ─── validateTradingPairs ─────────────────────────────────────────────────────

describe('validateTradingPairs', () => {
  it('returns all pairs when there are no conflicts', () => {
    const { validPairs, conflicts } = validateTradingPairs([BTC_USDT, BTC_ETH])
    expect(validPairs).toHaveLength(2)
    expect(conflicts).toHaveLength(0)
  })

  it('detects a conflict when the same ticker has two different asset IDs', () => {
    const conflict1 = makePair('BTC', 'BTC', 'USDT', 'rgb:usdt-v1')
    const conflict2 = makePair('BTC', 'BTC', 'USDT', 'rgb:usdt-v2')
    const { validPairs, conflicts } = validateTradingPairs([
      conflict1,
      conflict2,
    ])
    expect(conflicts.length).toBeGreaterThan(0)
    expect(validPairs).toHaveLength(0)
  })

  it('keeps pairs that are not involved in conflicts', () => {
    const conflict1 = makePair('BTC', 'BTC', 'USDT', 'rgb:usdt-v1')
    const conflict2 = makePair('BTC', 'BTC', 'USDT', 'rgb:usdt-v2')
    const safe = makePair('BTC', 'BTC', 'ETH', 'rgb:eth-id')
    const { validPairs } = validateTradingPairs([conflict1, conflict2, safe])
    expect(validPairs).toContain(safe)
  })

  it('handles an empty array', () => {
    const { validPairs, conflicts } = validateTradingPairs([])
    expect(validPairs).toHaveLength(0)
    expect(conflicts).toHaveLength(0)
  })
})

// ─── isPairSafeToTrade ────────────────────────────────────────────────────────

describe('isPairSafeToTrade', () => {
  it('returns true for a pair with no conflicts', () => {
    expect(isPairSafeToTrade(BTC_USDT, [BTC_USDT, BTC_ETH])).toBe(true)
  })

  it('returns false when the pair involves a conflicting ticker', () => {
    const conflict1 = makePair('BTC', 'BTC', 'USDT', 'rgb:usdt-v1')
    const conflict2 = makePair('BTC', 'BTC', 'USDT', 'rgb:usdt-v2')
    expect(isPairSafeToTrade(conflict1, [conflict1, conflict2])).toBe(false)
  })
})

// ─── getAssetConflictsForTicker ───────────────────────────────────────────────

describe('getAssetConflictsForTicker', () => {
  it('returns empty array when there are no conflicts', () => {
    expect(getAssetConflictsForTicker('BTC', [BTC_USDT])).toEqual([])
  })

  it('returns conflicting asset IDs for a ticker with conflicts', () => {
    const conflict1 = makePair('BTC', 'BTC', 'USDT', 'rgb:usdt-v1')
    const conflict2 = makePair('BTC', 'BTC', 'USDT', 'rgb:usdt-v2')
    const result = getAssetConflictsForTicker('USDT', [conflict1, conflict2])
    expect(result).toContain('rgb:usdt-v1')
    expect(result).toContain('rgb:usdt-v2')
  })
})

// ─── mapAssetIdToTicker ────────────────────────────────────────────────────────

describe('mapAssetIdToTicker', () => {
  const assets = [makeAsset('USDT', 'rgb:usdt-id')]

  it('returns "BTC" unchanged', () => {
    expect(mapAssetIdToTicker('BTC', [])).toBe('BTC')
  })

  it('maps a known asset ID to its ticker via the assets list', () => {
    expect(mapAssetIdToTicker('rgb:usdt-id', assets)).toBe('USDT')
  })

  it('falls back to trading pairs when asset not in user assets', () => {
    const pair = makePair('BTC', 'BTC', 'ETH', 'rgb:eth-id')
    expect(mapAssetIdToTicker('rgb:eth-id', [], [pair])).toBe('ETH')
  })

  it('shortens unknown rgb: asset IDs', () => {
    const result = mapAssetIdToTicker('rgb:Dg!Mttpk-NSLmSJF', [])
    expect(result).toMatch(/^RGB:/)
    expect(result).toContain('...')
  })

  it('shortens other unknown long IDs', () => {
    const result = mapAssetIdToTicker('x'.repeat(30), [])
    expect(result).toContain('...')
  })
})

// ─── mapTickerToAssetId ───────────────────────────────────────────────────────

describe('mapTickerToAssetId', () => {
  it('returns "BTC" for ticker "BTC"', () => {
    expect(mapTickerToAssetId('BTC')).toBe('BTC')
  })

  it('returns "BTC" for ticker "SAT"', () => {
    expect(mapTickerToAssetId('SAT')).toBe('BTC')
  })

  it('maps a known ticker to its asset ID using trading pairs', () => {
    const pair = makePair('BTC', 'BTC', 'USDT', 'rgb:usdt-id')
    expect(mapTickerToAssetId('USDT', [pair])).toBe('rgb:usdt-id')
  })

  it('maps a base asset ticker to its asset ID', () => {
    const pair = makePair('ETH', 'rgb:eth-id', 'BTC', 'BTC')
    expect(mapTickerToAssetId('ETH', [pair])).toBe('rgb:eth-id')
  })

  it('returns the ticker unchanged when not found in pairs', () => {
    expect(mapTickerToAssetId('UNKNOWN', [BTC_USDT])).toBe('UNKNOWN')
  })
})

// ─── isAssetId ────────────────────────────────────────────────────────────────

describe('isAssetId', () => {
  it('returns true for strings starting with "rgb:"', () => {
    expect(isAssetId('rgb:Dg!Mttpk-NSLmSJF-iDdTsdE')).toBe(true)
  })

  it('returns true for strings longer than 20 characters', () => {
    expect(isAssetId('x'.repeat(21))).toBe(true)
  })

  it('returns false for short ticker symbols', () => {
    expect(isAssetId('BTC')).toBe(false)
    expect(isAssetId('USDT')).toBe(false)
  })

  it('returns false for empty/falsy values', () => {
    expect(isAssetId('')).toBe(false)
  })
})

// ─── getDefaultMakerUrls ──────────────────────────────────────────────────────

describe('getDefaultMakerUrls', () => {
  it('always includes the primary URL', () => {
    const result = getDefaultMakerUrls('https://maker.example.com')
    expect(result).toContain('https://maker.example.com')
  })

  it('adds localhost:8000 as fallback when not already the primary', () => {
    const result = getDefaultMakerUrls('https://maker.example.com')
    expect(result).toContain('http://localhost:8000')
  })

  it('does not add localhost duplicate when localhost is already primary', () => {
    const result = getDefaultMakerUrls('http://localhost:8000')
    const count = result.filter((u) => u === 'http://localhost:8000').length
    expect(count).toBe(1)
  })

  it('does not add localhost duplicate for localhost with trailing slash', () => {
    const result = getDefaultMakerUrls('http://localhost:8000/')
    const count = result.filter((u) =>
      u.startsWith('http://localhost:8000')
    ).length
    expect(count).toBe(1)
  })

  it('deduplicates URLs', () => {
    const result = getDefaultMakerUrls('https://maker.example.com')
    const unique = new Set(result)
    expect(unique.size).toBe(result.length)
  })
})
