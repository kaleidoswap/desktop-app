/**
 * Which trading wallets this computer knows about, per network.
 * The wallet id is not the keychain account: an empty id is the original
 * wallet (`wallet-${network}`), and any other id is turned into its own
 * account by `walletAccountFor`.
 */

export interface TradingWallet {
  /** Empty for the original wallet on this network. */
  id: string
  label: string
}

export interface WalletStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const ORIGINAL_WALLET_LABEL = 'Trading wallet'

export const originalWallet = (): TradingWallet => ({
  id: '',
  label: ORIGINAL_WALLET_LABEL,
})

const listKey = (network: string) => `p2p-market.wallets.${network}`
const selectedKey = (network: string) => `p2p-market.wallet.${network}`

const isExtra = (v: unknown): v is TradingWallet => {
  if (!v || typeof v !== 'object') return false
  const w = v as TradingWallet
  return (
    typeof w.id === 'string' &&
    w.id.length > 0 &&
    w.id !== 'default' &&
    typeof w.label === 'string' &&
    w.label.trim().length > 0
  )
}

const readExtras = (network: string, storage: WalletStore): TradingWallet[] => {
  try {
    const raw = storage.getItem(listKey(network))
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    const seen = new Set<string>()
    const extras: TradingWallet[] = []
    for (const item of parsed) {
      if (!isExtra(item) || seen.has(item.id)) continue
      seen.add(item.id)
      extras.push({ id: item.id, label: item.label.trim() })
    }
    return extras
  } catch {
    return []
  }
}

const writeExtras = (
  network: string,
  extras: TradingWallet[],
  storage: WalletStore
) => {
  storage.setItem(listKey(network), JSON.stringify(extras))
}

/** The original wallet first, then any others saved on this network. */
export function readWalletList(
  network: string,
  storage: WalletStore = localStorage
): TradingWallet[] {
  return [originalWallet(), ...readExtras(network, storage)]
}

/** Remember a wallet after the first. The original wallet is always implied. */
export function saveWallet(
  network: string,
  wallet: TradingWallet,
  storage: WalletStore = localStorage
): TradingWallet[] {
  if (!wallet.id || !wallet.label.trim())
    return readWalletList(network, storage)
  const extras = readExtras(network, storage).filter((w) => w.id !== wallet.id)
  extras.push({ id: wallet.id, label: wallet.label.trim() })
  writeExtras(network, extras, storage)
  return [originalWallet(), ...extras]
}

/** Drop a wallet that was named but never finished. The original stays. */
export function removeWallet(
  network: string,
  id: string,
  storage: WalletStore = localStorage
): TradingWallet[] {
  if (!id) return readWalletList(network, storage)
  const extras = readExtras(network, storage).filter((w) => w.id !== id)
  writeExtras(network, extras, storage)
  if (readSelectedWalletId(network, storage) === id) {
    storage.removeItem(selectedKey(network))
  }
  return [originalWallet(), ...extras]
}

/** The wallet to open. Unknown or missing ids fall back to the original. */
export function readSelectedWalletId(
  network: string,
  storage: WalletStore = localStorage
): string {
  try {
    const id = storage.getItem(selectedKey(network)) ?? ''
    if (!id) return ''
    return readExtras(network, storage).some((w) => w.id === id) ? id : ''
  } catch {
    return ''
  }
}

export function writeSelectedWalletId(
  network: string,
  id: string,
  storage: WalletStore = localStorage
) {
  if (!id) storage.removeItem(selectedKey(network))
  else storage.setItem(selectedKey(network), id)
}
