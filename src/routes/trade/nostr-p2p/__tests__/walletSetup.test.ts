import { describe, expect, it } from 'vitest'

import { allocateWalletId, walletAccountFor } from '../../../../constants/p2p'
import { normalizePhrase } from '../WalletSetup'

describe('recovery phrase handling', () => {
  it('normalizes what a person types', () => {
    expect(normalizePhrase('  Abandon   ABILITY\table\nabout ')).toBe(
      'abandon ability able about'
    )
  })
})

describe('trading wallet account', () => {
  it('keeps the first wallet on the name its keys were created under', () => {
    expect(walletAccountFor({ network: 'signetcustom' })).toBe(
      'wallet-signetcustom'
    )
    expect(walletAccountFor({ network: 'signetcustom' }, '')).toBe(
      'wallet-signetcustom'
    )
    expect(walletAccountFor({ network: 'signetcustom' }, '   ')).toBe(
      'wallet-signetcustom'
    )
  })

  it('gives a second wallet its own account, files and keychain entry', () => {
    const first = walletAccountFor({ network: 'signetcustom' })
    const second = walletAccountFor({ network: 'signetcustom' }, 'bob')
    expect(second).toBe('wallet-signetcustom-bob')
    expect(second).not.toBe(first)
    expect(second.startsWith(`${first}-`)).toBe(true)
    // a name that does not survive sanitizing still must not share the first entry
    expect(walletAccountFor({ network: 'signetcustom' }, '???')).not.toBe(first)
  })

  it('allocates an id that cannot collapse onto a wallet already in use', () => {
    expect(allocateWalletId('Bob', [])).toBe('bob')
    expect(allocateWalletId('Bob', ['bob'])).toBe('bob-2')
    expect(allocateWalletId('???', [])).toBe('wallet')
    const accounts = ['', 'bob', 'bob-2'].map((id) =>
      walletAccountFor({ network: 'signetcustom' }, id)
    )
    expect(new Set(accounts).size).toBe(accounts.length)
  })
})
