import { describe, expect, it } from 'vitest'

import { getTxExplorerUrl } from '../explorer'

const TXID = '7c2c95b9c2aa0a7d140495b664de7973b76561de833f0dd84def3efa08941664'

describe('getTxExplorerUrl', () => {
  it('maps each public network to its explorer', () => {
    expect(getTxExplorerUrl('Mainnet', TXID)).toBe(
      `https://mempool.space/tx/${TXID}`
    )
    expect(getTxExplorerUrl('SignetCustom', TXID)).toBe(
      `https://mutinynet.com/tx/${TXID}`
    )
    expect(getTxExplorerUrl('Signet', TXID)).toBe(
      `https://mempool.space/signet/tx/${TXID}`
    )
    expect(getTxExplorerUrl('Testnet4', TXID)).toBe(
      `https://mempool.space/testnet4/tx/${TXID}`
    )
  })

  it('returns null for regtest, unknown networks and non-txids', () => {
    expect(getTxExplorerUrl('Regtest', TXID)).toBeNull()
    expect(getTxExplorerUrl(undefined, TXID)).toBeNull()
    // A Lightning payment hash is also 64 hex chars, so callers must only
    // pass on-chain txids; malformed values are rejected here.
    expect(getTxExplorerUrl('Mainnet', 'not-a-txid')).toBeNull()
    expect(getTxExplorerUrl('Mainnet', '')).toBeNull()
  })
})
