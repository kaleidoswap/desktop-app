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

/** The trading wallet's account name on a network: one wallet per network, whatever node is used. */
export const walletAccountFor = (option: Pick<P2pNetworkOption, 'network'>) =>
  `wallet-${option.network}`
