import { describe, expect, it } from 'vitest'

import { memoryWalletStore } from './memoryWalletStore'
import { walletAccountFor } from '../../../../constants/p2p'
import {
  originalWallet,
  readSelectedWalletId,
  readWalletList,
  removeWallet,
  saveWallet,
  writeSelectedWalletId,
} from '../wallets'

describe('saved trading wallets', () => {
  it('always keeps the original wallet, and adds another without replacing it', () => {
    const store = memoryWalletStore()
    expect(readWalletList('signetcustom', store)).toEqual([originalWallet()])
    const next = saveWallet('signetcustom', { id: 'bob', label: 'Bob' }, store)
    expect(next.map((w) => w.id)).toEqual(['', 'bob'])
    expect(readWalletList('signetcustom', store).map((w) => w.label)).toEqual([
      'Trading wallet',
      'Bob',
    ])
  })

  it('selects a second wallet and falls back to the original when it is gone', () => {
    const store = memoryWalletStore()
    saveWallet('signetcustom', { id: 'bob', label: 'Bob' }, store)
    writeSelectedWalletId('signetcustom', 'bob', store)
    expect(readSelectedWalletId('signetcustom', store)).toBe('bob')
    removeWallet('signetcustom', 'bob', store)
    expect(readSelectedWalletId('signetcustom', store)).toBe('')
    expect(readWalletList('signetcustom', store)).toEqual([originalWallet()])
    expect(walletAccountFor({ network: 'signetcustom' }, '')).not.toBe(
      walletAccountFor({ network: 'signetcustom' }, 'bob')
    )
  })
})
