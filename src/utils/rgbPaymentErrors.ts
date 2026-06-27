/**
 * Maps cryptic rgb-lightning-node payment errors to friendly, actionable
 * translation keys.
 *
 * The node returns terse, developer-oriented strings (e.g. "The provided
 * recipient ID is for a different network than the wallet's one"). End users
 * have no way to act on those. This module recognises the common ones and
 * returns an i18n key so the UI can show a clear explanation of what went wrong
 * and how to fix it.
 */

export interface FriendlyPaymentError {
  /** i18n key resolving to a clear, actionable message. */
  key: string
}

const PATTERNS: Array<{ test: RegExp; key: string }> = [
  {
    
    key: 'withdrawModal.main.errors.recipientNetworkMismatch',
    // APIError::InvalidRecipientNetwork
test: /different network than the wallet/i,
  },
  {
    
    key: 'withdrawModal.main.errors.invalidRecipientId',
    // APIError::InvalidRecipientID
test: /recipient ID is neither a blinded UTXO or a script/i,
  },
  {
    
    key: 'withdrawModal.main.errors.invalidRecipientData',
    // APIError::InvalidRecipientData
test: /provided recipient data is invalid/i,
  },
  {
    
    key: 'withdrawModal.main.errors.invalidRecipientData',
    // APIError::InvalidRecipientMap
test: /provided recipient map is invalid/i,
  },
  {
    
    key: 'withdrawModal.main.errors.invalidTransportEndpoint',
    // APIError::InvalidTransportEndpoint(s) / InvalidProxyEndpoint
test: /(transport endpoint|proxy endpoint|proxy protocol)/i,
  },
  {
    
    key: 'withdrawModal.main.errors.insufficientUtxos',
    // APIError::NoAvailableUtxos and friends (kept generic on purpose)
test: /(no available UTXOs|not enough UTXOs|insufficient UTXOs|no uncolored UTXOs)/i,
  },
]

/**
 * Returns a friendly i18n key for a known rgb-lightning-node payment error, or
 * `null` if the message is not recognised (caller should fall back to the raw
 * message).
 */
export function resolveRgbPaymentErrorKey(
  rawMessage: string | undefined | null
): string | null {
  if (!rawMessage) return null
  const match = PATTERNS.find((p) => p.test.test(rawMessage))
  return match ? match.key : null
}
