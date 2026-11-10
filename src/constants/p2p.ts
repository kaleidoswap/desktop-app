/**
 * The networks the P2P market is available on. Which relays, esplora, RGB proxy and fee address
 * each one uses is decided by the app itself (in the Rust side), not here: the page only names a
 * network, so nothing in it can point the daemon somewhere else.
 */

export interface P2pNetworkOption {
  /** The app's network name, which is what the page asks to start. */
  key: string
  label: string
  /** The daemon's name for the network (`signetcustom` for Mutinynet). */
  network: string
}

/**
 * Account name of the first trading wallet on a network. Keys already in the OS
 * keychain were stored under this name (`wallet-signetcustom` on Mutinynet), so
 * it must not change.
 */
export const legacyWalletAccount = (network: string) => `wallet-${network}`

const walletSuffix = (walletId: string) =>
  walletId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)

/**
 * The trading wallet's account name. It is both the p2pd data-dir suffix and the
 * OS keychain account (service `kaleidoswap-p2pd`).
 *
 * The first wallet on a network stays `wallet-${network}`, so people are not
 * locked out of keys they already created. Any other wallet gets its own suffix:
 * two clients on the same OS user then do not share files, the Secret Service
 * entry, or `p2pd.pid` (which would let one start's `reap_orphan` stop the other).
 *
 * An empty id is the first wallet. A non-empty id always produces a different name.
 */
export const walletAccountFor = (
  option: Pick<P2pNetworkOption, 'network'>,
  walletId?: string | null
) => {
  const legacy = legacyWalletAccount(option.network)
  if (!(walletId ?? '').trim()) return legacy
  const suffix = walletSuffix(walletId ?? '') || 'extra'
  const account = `${legacy}-${suffix}`
  return account === legacy ? `${legacy}-extra` : account
}

/**
 * An id for a wallet after the first. Never empty, and distinct from `taken`,
 * so {@link walletAccountFor} gives it a different keychain entry.
 */
export function allocateWalletId(
  name: string,
  taken: readonly string[]
): string {
  const base = walletSuffix(name) || 'wallet'
  const used = new Set(taken)
  if (!used.has(base)) return base
  for (let n = 2; n < 1000; n++) {
    const id = `${base}-${n}`.slice(0, 32)
    if (!used.has(id)) return id
  }
  return `${base}-${taken.length + 1}`
}
