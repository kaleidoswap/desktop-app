import { describe, expect, it } from 'vitest'

import { resolveRgbPaymentErrorKey } from '../rgbPaymentErrors'

describe('resolveRgbPaymentErrorKey', () => {
  it('maps the network-mismatch error to a friendly key', () => {
    expect(
      resolveRgbPaymentErrorKey(
        "The provided recipient ID is for a different network than the wallet's one"
      )
    ).toBe('withdrawModal.main.errors.recipientNetworkMismatch')
  })

  it('maps an invalid recipient ID error', () => {
    expect(
      resolveRgbPaymentErrorKey(
        'The provided recipient ID is neither a blinded UTXO or a script'
      )
    ).toBe('withdrawModal.main.errors.invalidRecipientId')
  })

  it('maps a transport endpoint error', () => {
    expect(resolveRgbPaymentErrorKey('Invalid transport endpoint: foo')).toBe(
      'withdrawModal.main.errors.invalidTransportEndpoint'
    )
  })

  it('returns null for unrecognised messages', () => {
    expect(resolveRgbPaymentErrorKey('some other failure')).toBeNull()
    expect(resolveRgbPaymentErrorKey(undefined)).toBeNull()
    expect(resolveRgbPaymentErrorKey('')).toBeNull()
  })
})
