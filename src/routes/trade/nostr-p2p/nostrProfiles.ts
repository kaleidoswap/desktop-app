import { marketApi } from './api'
import { transport } from './transport'

export interface NostrProfiles {
  supported: boolean
  active: string
  profiles: { npub: string; label: string | null }[]
}

const path = '/api/nostr/profiles'
const changed = () => new Error('The active Nostr profile changed.')

async function list(expected: string): Promise<NostrProfiles> {
  const info = await marketApi.info()
  if (info.npub !== expected) throw changed()
  if (!info.nostr_profiles) {
    return {
      active: info.npub,
      profiles: [{ label: null, npub: info.npub }],
      supported: false,
    }
  }
  const result = await transport().request<NostrProfiles>('GET', path)
  if (result.active !== expected) throw changed()
  return result
}

export const nostrProfiles = {
  create(expected: string, label: string): Promise<NostrProfiles> {
    return transport().request('POST', path, { expected, label })
  },
  forget(expected: string, target: string): Promise<NostrProfiles> {
    return transport().request('POST', path + '/forget', { expected, target })
  },
  list,
  async select(expected: string, target: string): Promise<NostrProfiles> {
    const next = await transport().request<NostrProfiles>(
      'POST',
      path + '/select',
      { expected, target }
    )
    if (next.active !== target) throw changed()
    // p2pd drains its old signer before bringing up the new one on the same socket.
    // Acknowledging the request alone does not establish who signs subsequent offers.
    const deadline = Date.now() + 120_000
    do {
      const info = await marketApi.info().catch(() => null)
      if (info?.npub === target) return list(target)
      if (info && info.npub !== expected) throw changed()
      await new Promise((resolve) => setTimeout(resolve, 500))
    } while (Date.now() < deadline)
    throw new Error('The new Nostr signer has not come online yet.')
  },
}
