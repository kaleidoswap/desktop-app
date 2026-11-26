import { invoke } from '@tauri-apps/api/core'
import {
  desktopPathname,
  MAINNET_ACTIVITY_PATH,
  MAINNET_MARKET_PATH,
  MAINNET_NODE_PATH,
  MAINNET_SETTINGS_PATH,
  MAINNET_WALLET_PATH,
  P2P_ACTIVITY_PATH,
  P2P_BALANCE_PATH,
  P2P_NODE_PATH,
  P2P_SETTINGS_PATH,
  P2P_TRADE_PATH,
  WALLET_SETUP_PATH,
} from '../../app/router/paths'
import { walletAccountFor } from '../../constants/p2p'
import { p2pNetworks, p2pProfileGet } from '../trade/nostr-p2p/p2p'
import {
  readWalletList,
  readSelectedWalletId,
  savedNetwork,
} from '../trade/nostr-p2p/wallets'

const sections = [
  [MAINNET_MARKET_PATH, P2P_TRADE_PATH],
  [MAINNET_ACTIVITY_PATH, P2P_ACTIVITY_PATH],
  [MAINNET_NODE_PATH, P2P_NODE_PATH],
  [MAINNET_WALLET_PATH, P2P_BALANCE_PATH],
  [MAINNET_SETTINGS_PATH, P2P_SETTINGS_PATH],
] as const

export function switchNetworkPath(path: string, mainnet: boolean): string {
  const pathname = desktopPathname(path)
  const pair = sections.find(
    ([main, test]) => pathname === main || pathname === test
  )
  return (pair ?? sections[3])[mainnet ? 0 : 1]
}

type Profile = 'mainnet' | 'test' | 'node'
const entryKey = 'kaleidoswap.desktop.last-profile'
const walletContextKey = 'kaleidoswap.desktop.last-wallet-context'

export function lastWalletContext(): 'mainnet' | 'test' {
  try {
    const last =
      localStorage.getItem(walletContextKey) ?? localStorage.getItem(entryKey)
    return last === 'test' ? 'test' : 'mainnet'
  } catch {
    return 'mainnet'
  }
}

export function rememberWalletContext(context: 'mainnet' | 'test') {
  try {
    localStorage.setItem(walletContextKey, context)
  } catch {
    // The location still identifies the wallet context for this visit.
  }
}

export function rememberProfile(profile: Profile) {
  try {
    const walletContext = profile === 'node' ? lastWalletContext() : profile
    rememberWalletContext(walletContext)
    localStorage.setItem(entryKey, profile)
  } catch {
    // Native account discovery also works without stored UI preferences.
  }
}

export async function findTradingWallet() {
  const preferred = savedNetwork()
  const networks = (await p2pNetworks()).sort(
    (a, b) => Number(b.key === preferred) - Number(a.key === preferred)
  )
  for (const network of networks) {
    const selected = readSelectedWalletId(network.network)
    const wallets = readWalletList(network.network).sort(
      (a, b) => Number(b.id === selected) - Number(a.id === selected)
    )
    for (const wallet of wallets) {
      if (await p2pProfileGet(walletAccountFor(network, wallet.id)))
        return { network, wallet }
    }
  }
  return null
}

// Older versions had no profile preference. Keep their account picker on upgrade.
export async function startupPath(mindOnly: boolean): Promise<string> {
  try {
    const last = localStorage.getItem(entryKey)
    if (last === 'mainnet') return MAINNET_WALLET_PATH
    if (last === 'test') return P2P_BALANCE_PATH
    if (last === 'node') return WALLET_SETUP_PATH
  } catch {
    // Continue with native account discovery.
  }
  if (mindOnly) return WALLET_SETUP_PATH
  if (!('__TAURI_INTERNALS__' in window)) return MAINNET_WALLET_PATH
  try {
    const accounts = await invoke<unknown[]>('get_accounts')
    if (accounts.length) return WALLET_SETUP_PATH
  } catch {
    // Keep the account picker accessible when the native node database is unavailable.
    return WALLET_SETUP_PATH
  }
  // A build without the test daemon can still open its mainnet wallet.
  const existing = await findTradingWallet().catch(() => null)
  return existing ? WALLET_SETUP_PATH : MAINNET_WALLET_PATH
}
