import { describe, expect, it } from 'vitest'

import { BTC_ASSET_ID } from '../../../../../constants'
import { buildSentSummary } from '../sentSummary'

const assets = [{ asset_id: 'rgb:usdt', ticker: 'USDT' }]

describe('buildSentSummary', () => {
  it('labels an on-chain BTC send in the user unit', () => {
    const s = buildSentSummary(
      { address: 'tb1qdest', amount: '25,000', asset_id: BTC_ASSET_ID },
      'onchain',
      'ab'.repeat(32),
      'SAT',
      assets
    )
    expect(s.amountLabel).toBe(`${(25000).toLocaleString()} SATS`)
    expect(s.destination).toBe('tb1qdest')
    expect(s.reference).toBe('ab'.repeat(32))
  })

  it('takes the amount from a fixed-amount Lightning invoice', () => {
    const s = buildSentSummary(
      {
        address: 'lntbs1...',
        amount: null,
        asset_id: BTC_ASSET_ID,
        decodedInvoice: { amt_msat: 150_000_000 },
      },
      'lightning',
      'hash',
      'BTC',
      assets
    )
    expect(s.amountLabel).toBe('0.00150000 BTC')
  })

  it('uses the RGB asset ticker', () => {
    const s = buildSentSummary(
      { address: 'utxob:abc', amount: 42, asset_id: 'rgb:usdt' },
      'rgb',
      undefined,
      'SAT',
      assets
    )
    expect(s.amountLabel).toBe('42 USDT')
    expect(s.reference).toBeUndefined()
  })

  it('still reports the kind without send data', () => {
    expect(buildSentSummary(null, 'lightning', 'h', 'SAT', [])).toEqual({
      kind: 'lightning',
      reference: 'h',
    })
  })
})
