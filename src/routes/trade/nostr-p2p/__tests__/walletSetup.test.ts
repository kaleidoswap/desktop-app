import { describe, expect, it } from 'vitest'

import { walletAccountFor } from '../../../../constants/p2p'
import { challengePassed, normalizePhrase, pickChallenge } from '../WalletSetup'

const PHRASE =
  'abandon ability able about above absent absorb abstract absurd abuse access accident'

describe('recovery phrase handling', () => {
  it('normalizes what a person types', () => {
    expect(normalizePhrase('  Abandon   ABILITY\table\nabout ')).toBe(
      'abandon ability able about'
    )
  })

  it('asks for three distinct words, in order', () => {
    // a source of randomness that repeats itself must not give the same word twice
    const seq = [0.1, 0.1, 0.5, 0.5, 0.9]
    let i = 0
    const positions = pickChallenge(12, () => seq[i++ % seq.length]!)
    expect(positions).toEqual([1, 6, 10])
    expect(new Set(positions).size).toBe(3)
  })

  it('never asks for more words than the phrase has', () => {
    expect(pickChallenge(2).length).toBe(2)
  })

  it('accepts the right words and refuses a wrong or missing one', () => {
    const positions = [2, 7, 11]
    expect(
      challengePassed(PHRASE, positions, ['able', 'abstract', 'accident'])
    ).toBe(true)
    expect(
      challengePassed(PHRASE, positions, [' ABLE ', 'Abstract', 'accident'])
    ).toBe(true)
    expect(
      challengePassed(PHRASE, positions, ['able', 'abstract', 'access'])
    ).toBe(false)
    expect(challengePassed(PHRASE, positions, ['able', 'abstract'])).toBe(false)
  })
})

describe('trading wallet account', () => {
  it('is one per network, whatever node is connected', () => {
    expect(
      walletAccountFor({
        feeAddress: 'tb1q',
        indexerUrl: 'https://x',
        network: 'signetcustom',
        proxyUrl: 'https://p',
        relays: ['wss://r'],
      })
    ).toBe('wallet-signetcustom')
  })
})
