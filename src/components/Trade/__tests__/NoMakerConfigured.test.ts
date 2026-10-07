import { describe, expect, it } from 'vitest'

import { isValidMakerUrl } from '../NoMakerConfigured'

describe('isValidMakerUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isValidMakerUrl('https://maker.example.com')).toBe(true)
    expect(isValidMakerUrl(' http://localhost:8000/ ')).toBe(true)
  })

  it('rejects empty, malformed and non-http URLs', () => {
    expect(isValidMakerUrl('')).toBe(false)
    expect(isValidMakerUrl('maker.example.com')).toBe(false)
    expect(isValidMakerUrl('ws://maker.example.com')).toBe(false)
  })
})
