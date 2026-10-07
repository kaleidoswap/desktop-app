import { describe, expect, it } from 'vitest'

import { getDefaultMakerUrls, NETWORK_DEFAULTS } from '../networks'

describe('NETWORK_DEFAULTS', () => {
  it('has no default maker or LSP on mainnet', () => {
    expect(NETWORK_DEFAULTS.Mainnet.default_maker_url).toBe('')
    expect(NETWORK_DEFAULTS.Mainnet.default_lsp_url).toBe('')
    expect(getDefaultMakerUrls('Mainnet')).toEqual([])
  })

  it('does not reference retired KaleidoSwap API hosts', () => {
    const json = JSON.stringify(NETWORK_DEFAULTS)
    for (const host of [
      '//api.kaleidoswap.com',
      'api.testnet.kaleidoswap.com',
      'api.staging.kaleidoswap.com',
      'api.regtest.kaleidoswap.com',
    ]) {
      expect(json).not.toContain(host)
    }
  })

  it('seeds Mutinynet with both public makers', () => {
    expect(getDefaultMakerUrls('SignetCustom')).toEqual([
      'https://api.mutinynet2.kaleidoswap.com/',
      'https://api.signet.kaleidoswap.com/',
    ])
  })
})
