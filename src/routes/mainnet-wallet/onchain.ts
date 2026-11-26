import { invoke } from '@tauri-apps/api/core'

export type WalletMethod = 'mnemonic' | 'passkey'
export interface WalletIdentity {
  method: WalletMethod
  fingerprint: string
  masterFingerprint: string
}

export type WalletStatus =
  { state: 'empty'; wallet: null } | { state: 'ready'; wallet: WalletIdentity }

export interface PasskeyCapability {
  available: boolean
  reason: string | null
}

interface Credential {
  credentialId: string
}
interface DerivedPhrase extends Credential {
  mnemonic: string
}

export const readWallet = () =>
  invoke<WalletStatus | 'not_bundled'>('mainnet_wallet_status')
export const generatePhrase = () => invoke<string>('mainnet_wallet_generate')
export const saveWallet = (mnemonic: string, method: WalletMethod) =>
  invoke<WalletStatus>('mainnet_wallet_create', { method, mnemonic })
export const passkeyCapability = () =>
  invoke<PasskeyCapability>('mainnet_passkey_capability')
export const registerCredential = () =>
  invoke<Credential>('mainnet_passkey_register')
export const deriveCredential = (credentialId: string | null) =>
  invoke<DerivedPhrase>('mainnet_passkey_derive', { credentialId })

// Only a pending, public credential ID lives here. A discoverable assertion also
// works after reinstalling or clearing storage, including for exporting a backup.
const pendingKey = 'kaleidoswap.mainnet.desktop-passkeys.pending.v1'
export function readPending(): string | null {
  try {
    const value = localStorage.getItem(pendingKey)
    return value && /^[A-Za-z0-9_-]{1,2048}$/.test(value) ? value : null
  } catch {
    return null
  }
}
export function rememberPending(id: string | null) {
  try {
    if (id === null) localStorage.removeItem(pendingKey)
    else localStorage.setItem(pendingKey, id)
  } catch {
    // Registration remains usable in this session and recoverable from the provider.
  }
}

export async function phraseFingerprint(phrase: string): Promise<string> {
  const bytes = new TextEncoder().encode(
    phrase.trim().toLowerCase().split(/\s+/).join(' ')
  )
  try {
    const hash = await crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(hash), (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('')
  } finally {
    bytes.fill(0)
  }
}
