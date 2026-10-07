import { describe, expect, it } from 'vitest'

import { isUsdt, orderOtherAssets, type PickerAsset } from '../assetOrder'

const asset = (
  ticker: string,
  hasBalance = false,
  name?: string
): PickerAsset => ({
  asset_id: `rgb:${ticker.toLowerCase()}`,
  hasBalance,
  name,
  ticker,
})

describe('orderOtherAssets', () => {
  const assets = [
    asset('ZETA'),
    asset('USDT', true, 'Tether USD'),
    asset('ALPHA'),
    asset('XAUT', true),
    asset('KLD'),
  ]

  it('puts recent assets first, in recency order', () => {
    const order = orderOtherAssets(assets, ['rgb:kld', 'rgb:zeta'], 'rgb:usdt')
    expect(order.map((a) => a.ticker).slice(0, 2)).toEqual(['KLD', 'ZETA'])
  })

  it('then held assets, then alphabetical, without the pinned asset', () => {
    const order = orderOtherAssets(assets, [], 'rgb:usdt')
    expect(order.map((a) => a.ticker)).toEqual(['XAUT', 'ALPHA', 'KLD', 'ZETA'])
  })
})

describe('isUsdt', () => {
  it('matches the ticker or the Tether USD name', () => {
    expect(isUsdt({ ticker: 'usdt' })).toBe(true)
    expect(isUsdt({ name: 'Tether USD', ticker: 'USDT0' })).toBe(true)
    expect(isUsdt({ name: 'Tether Gold', ticker: 'XAUT' })).toBe(false)
  })
})
