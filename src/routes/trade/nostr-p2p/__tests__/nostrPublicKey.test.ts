import { expect, it } from 'vitest'
import { canonicalNpub, robotParts } from '../nostrPublicKey'

const hex = '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'
const npub = 'npub10xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqpkge6d'

it('uses the same Robohash set and parts as upstream for the canonical npub', async () => {
  expect(canonicalNpub(hex)).toBe(npub)
  expect(canonicalNpub(npub.toUpperCase())).toBe(npub)
  expect(canonicalNpub(npub)).toBe(npub)
  expect(await robotParts(npub)).toEqual({
    color: 'blue',
    layers: [
      { column: 4, row: 3 },
      { column: 3, row: 4 },
      { column: 8, row: 2 },
      { column: 9, row: 1 },
      { column: 0, row: 0 },
    ],
  })
})

it.each([
  null,
  'Alice',
  'npub1short',
  npub.slice(0, -1) + 'a',
  npub.replace('n', 'N'),
  npub.replace('npub', 'nsec'),
])(
  'does not assign an avatar to missing, truncated or invalid keys',
  (input) => {
    expect(canonicalNpub(input)).toBeNull()
  }
)
