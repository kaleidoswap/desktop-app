import { describe, expect, it } from 'vitest'

import { getAllRgbAssets, onchainUsdtId, rgbIconTicker } from '../rgbUtils'
import {
  getAssetPrecision,
  parseAssetAmountWithPrecision,
} from '../../helpers/number'

describe('getAllRgbAssets', () => {
  it('returns an empty array for missing data', () => {
    expect(getAllRgbAssets(undefined)).toEqual([])
    expect(getAllRgbAssets(null)).toEqual([])
    expect(getAllRgbAssets({})).toEqual([])
  })

  it('merges every RGB schema, not just NIA', () => {
    const data = {
      bfa: [
        {
          asset_id: 'bfa1',
          known_issued_supply: 1000000,
          name: 'Bridge',
          precision: 6,
          ticker: 'USDT',
        },
      ],
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
      'bfa1',
    ])
    expect(result[4]).toMatchObject({
      known_issued_supply: 1000000,
      schema: 'BFA',
    })
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

it('identifies on-chain USDT by chain and exact contract, including an issuer-chosen duplicate ticker', () => {
  const signet = 'rgb:uVMNCuVU-U00Y_wv-6~7ZbW7-tEuUMcE-pB0wDzC-nt7Qsdc'
  const mutiny = 'rgb:2FB8lVZA-dnFf4ci-wdU9xin-Rjm72L1-LSOyAq3-KAICMoI'
  expect(onchainUsdtId('Signet')).toBe(signet)
  expect(onchainUsdtId('SignetCustom')).toBe(mutiny)
  expect(onchainUsdtId('Mainnet')).toBe(
    'rgb:A6Nr_ndv-Cx_t3_i-YfPXoL6-pT8ibp3-CR6LH5q-fQvTsp8'
  )
  expect(onchainUsdtId('Regtest')).toBeUndefined()
  expect(onchainUsdtId(undefined)).toBeUndefined()
  expect(rgbIconTicker(mutiny, 'USDT', 'Signet')).toBe('')
  expect(rgbIconTicker(signet, 'USDT', 'Signet')).toBe('USDT')
  expect(rgbIconTicker('rgb:other', 'USDT', 'Signet')).toBe('')
  expect(rgbIconTicker('rgb:other', 'BTC', 'Signet')).toBe('')

  const holdings = getAllRgbAssets({
    bfa: [{ asset_id: signet, precision: 6, ticker: 'USDT' }],
    nia: [{ asset_id: 'rgb:other', precision: 1, ticker: 'USDT' }],
  })
  expect(getAssetPrecision(signet, 'SAT', holdings)).toBe(6)
  expect(parseAssetAmountWithPrecision('1.5', signet, 'SAT', holdings)).toBe(
    1500000
  )
  expect(
    parseAssetAmountWithPrecision('1.5', 'rgb:other', 'SAT', holdings)
  ).toBe(15)
})
