import { describe, it, expect } from 'vitest'
import { shortenAddress, isValidPubkeyAndAddress } from '../address'

const VALID_PUBKEY = 'a'.repeat(66)

// ─── shortenAddress ───────────────────────────────────────────────────────────

describe('shortenAddress', () => {
  it('returns the address unchanged when length <= 41', () => {
    const addr = 'a'.repeat(41)
    expect(shortenAddress(addr)).toBe(addr)
  })

  it('truncates addresses longer than 41 characters', () => {
    const addr = 'a'.repeat(80)
    const result = shortenAddress(addr)
    expect(result).toContain('...')
    expect(result.length).toBeLessThan(addr.length)
  })

  it('produces symmetric truncation around the ellipsis', () => {
    const addr =
      'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const result = shortenAddress(addr)
    const [before, after] = result.split('...')
    expect(before.length).toBe(after.length)
  })
})

// ─── isValidPubkeyAndAddress ──────────────────────────────────────────────────

describe('isValidPubkeyAndAddress — pubkey-only format', () => {
  it('accepts a valid 66-char hex pubkey', () => {
    expect(isValidPubkeyAndAddress(VALID_PUBKEY)).toBe(true)
  })

  it('rejects a 65-char hex string', () => {
    expect(isValidPubkeyAndAddress('a'.repeat(65))).toBe(false)
  })

  it('rejects a 67-char hex string', () => {
    expect(isValidPubkeyAndAddress('a'.repeat(67))).toBe(false)
  })

  it('rejects a 66-char string containing non-hex characters', () => {
    expect(isValidPubkeyAndAddress('z'.repeat(66))).toBe(false)
  })
})

describe('isValidPubkeyAndAddress — full pubkey@host:port format', () => {
  it('accepts a valid pubkey@host:port string', () => {
    expect(isValidPubkeyAndAddress(`${VALID_PUBKEY}@localhost:9735`)).toBe(true)
  })

  it('accepts an IP address as host', () => {
    expect(isValidPubkeyAndAddress(`${VALID_PUBKEY}@192.168.1.1:9735`)).toBe(
      true
    )
  })

  it('accepts port 1 (minimum valid port)', () => {
    expect(isValidPubkeyAndAddress(`${VALID_PUBKEY}@host:1`)).toBe(true)
  })

  it('accepts port 65535 (maximum valid port)', () => {
    expect(isValidPubkeyAndAddress(`${VALID_PUBKEY}@host:65535`)).toBe(true)
  })

  it('rejects port 0', () => {
    expect(isValidPubkeyAndAddress(`${VALID_PUBKEY}@host:0`)).toBe(false)
  })

  it('rejects port 65536', () => {
    expect(isValidPubkeyAndAddress(`${VALID_PUBKEY}@host:65536`)).toBe(false)
  })

  it('rejects a non-numeric port', () => {
    expect(isValidPubkeyAndAddress(`${VALID_PUBKEY}@host:abc`)).toBe(false)
  })

  it('rejects a string with no @ separator', () => {
    expect(isValidPubkeyAndAddress('localhost:9735')).toBe(false)
  })

  it('rejects a string with multiple @ separators', () => {
    expect(isValidPubkeyAndAddress(`${VALID_PUBKEY}@host@extra:9735`)).toBe(
      false
    )
  })

  it('rejects a string with no port separator', () => {
    expect(isValidPubkeyAndAddress(`${VALID_PUBKEY}@localhost`)).toBe(false)
  })

  it('rejects a short pubkey in pubkey@host:port format', () => {
    expect(isValidPubkeyAndAddress(`${'a'.repeat(60)}@host:9735`)).toBe(false)
  })

  it('rejects a pubkey with non-hex chars in pubkey@host:port format', () => {
    expect(isValidPubkeyAndAddress(`${'z'.repeat(66)}@host:9735`)).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidPubkeyAndAddress('')).toBe(false)
  })
})
