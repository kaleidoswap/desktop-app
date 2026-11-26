import { useEffect, useState, useSyncExternalStore } from 'react'

import type { BitcoinNetwork } from '../../constants'
import type { P2pNetworkOption } from '../../constants/p2p'
import { p2pNetworks } from '../trade/nostr-p2p/p2p'
import {
  saveNetwork,
  savedNetwork,
  subscribeSavedNetwork,
} from '../trade/nostr-p2p/wallets'

// The native list is static for the running build. Regtest is only offered by
// debug builds. Reading the list does not open a wallet or start the daemon.
let available: P2pNetworkOption[] | undefined
let pending: Promise<P2pNetworkOption[]> | undefined

export function useDesktopTestNetworks(preloaded?: P2pNetworkOption[]) {
  const [networks, setNetworks] = useState(() => available ?? [])
  useEffect(() => {
    if (preloaded || !('__TAURI_INTERNALS__' in window)) return
    let mounted = true
    pending ??= p2pNetworks()
      .then((result) => {
        available = result
        return result
      })
      .catch(() => {
        pending = undefined
        return []
      })
    void pending.then((result) => {
      if (mounted) setNetworks(result)
    })
    return () => {
      mounted = false
    }
  }, [preloaded])
  return preloaded ?? networks
}

// Older account records can contain the connection preset instead of the
// canonical Regtest name. Both presets use the same P2P chain.
export const nodeWalletNetworkKey = (network: string) =>
  network === 'Regtest' || network === 'LocalDockerRegtest'
    ? 'LocalRegtest'
    : network

export function rememberNodeWalletNetwork(network: BitcoinNetwork) {
  const key = nodeWalletNetworkKey(network)
  if (
    key === 'SignetCustom' ||
    key === 'Signet' ||
    available?.some((option) => option.key === key)
  )
    saveNetwork(key)
}

export function defaultNodeNetwork(): BitcoinNetwork {
  const key = savedNetwork()
  if (key === 'LocalRegtest') return 'Regtest'
  if (key === 'Signet') return 'Signet'
  return 'SignetCustom'
}

export function useSelectedTestNetwork(options: P2pNetworkOption[]) {
  const key = useSyncExternalStore(subscribeSavedNetwork, savedNetwork)
  return options.find((option) => option.key === key) ?? options[0]
}
