import { describe, expect, it } from 'vitest'

import { getAllRgbAssets } from '../rgbUtils'

describe('getAllRgbAssets', () => {
  it('returns an empty array for missing data', () => {
    expect(getAllRgbAssets(undefined)).toEqual([])
    expect(getAllRgbAssets(null)).toEqual([])
    expect(getAllRgbAssets({})).toEqual([])
  })

  it('merges every RGB schema, not just NIA', () => {
    const data = {
      cfa: [{ asset_id: 'cfa1', name: 'Collectible', precision: 0 }],
      ifa: [
        { asset_id: 'ifa1', name: 'Inflatable', precision: 0, ticker: 'INF' },
      ],
      nia: [{ asset_id: 'nia1', name: 'Tether', precision: 0, ticker: 'USDT' }],
      uda: [{ asset_id: 'uda1', name: 'Unique', precision: 0, ticker: 'UNI' }],
    }
    const result = getAllRgbAssets(data)
    expect(result.map((a) => a.asset_id)).toEqual([
      'nia1',
      'cfa1',
      'uda1',
      'ifa1',
    ])
  })

  it('falls back to name then asset_id for the ticker when a schema has none (CFA)', () => {
    const data = {
      cfa: [{ asset_id: 'cfa1', name: 'My Collectible', precision: 0 }],
    }
    expect(getAllRgbAssets(data)[0].ticker).toBe('My Collectible')

    const noName = { cfa: [{ asset_id: 'cfa-noname', precision: 0 }] }
    expect(getAllRgbAssets(noName)[0].ticker).toBe('cfa-noname')
  })
})
