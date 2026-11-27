import { bech32 } from '@scure/base'

/** Normalize full NIP-19 and hexadecimal public keys before assigning an avatar. */
export function canonicalNpub(value?: string | null): string | null {
  if (!value) return null
  if (/^[a-f\d]{64}$/i.test(value)) {
    const bytes = Uint8Array.from(value.match(/../g)!, (pair) =>
      parseInt(pair, 16)
    )
    return bech32.encodeFromBytes('npub', bytes)
  }
  if (value.length !== 63) return null
  const key = bech32.decodeUnsafe(value)
  if (!key || key.prefix !== 'npub') return null
  const bytes = bech32.fromWordsUnsafe(key.words)
  return bytes && bytes.length === 32
    ? bech32.encodeFromBytes('npub', bytes)
    : null
}

/** Robohash Set 1 splits the SHA-512 hex digest into 11-character slots. */
export async function robotParts(npub: string) {
  const digest = await crypto.subtle.digest(
    'SHA-512',
    new TextEncoder().encode(npub)
  )
  const hex = Array.from(new Uint8Array(digest), (v) =>
    v.toString(16).padStart(2, '0')
  ).join('')
  const pick = (slot: number) =>
    parseInt(hex.slice(slot * 11, (slot + 1) * 11), 16) % 10
  const colors = [
    'blue',
    'brown',
    'green',
    'grey',
    'orange',
    'pink',
    'purple',
    'red',
    'white',
    'yellow',
  ]
  // Rows are ordered by upstream selection order. Paint body and face under the features.
  return {
    color: colors[pick(0)]!,
    layers: [3, 4, 2, 1, 0].map((row) => ({ column: pick(row + 4), row })),
  }
}
