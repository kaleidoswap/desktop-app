/**
 * Where the on-chain P2P market lives for each network the app can be on.
 *
 * The market needs a Nostr relay that admits the swap event kinds, an RGB proxy both sides can
 * reach, an esplora for the network, and the address the platform fee is paid to. Those are
 * deployment facts, so they come from the build environment; a network with no relay configured has
 * no P2P market yet and the page says so instead of guessing.
 */

export interface P2pNetworkConfig {
  /** The network name the daemon understands. */
  network: 'regtest' | 'signet' | 'signetcustom' | 'testnet' | 'mainnet'
  /** An esplora HTTP API (the daemon does not speak electrum). */
  indexerUrl: string
  /** The RGB proxy as an http(s) JSON-RPC URL. */
  proxyUrl: string
  relays: string[]
  feeAddress: string
}

const env = import.meta.env as Record<string, string | undefined>

const fromEnv = (
  prefix: string,
  network: P2pNetworkConfig['network']
): P2pNetworkConfig | undefined => {
  const relays = (env[`${prefix}_RELAYS`] ?? '')
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean)
  const indexerUrl = env[`${prefix}_ESPLORA_URL`]
  const proxyUrl = env[`${prefix}_PROXY_URL`]
  const feeAddress = env[`${prefix}_FEE_ADDRESS`]
  if (!relays.length || !indexerUrl || !proxyUrl || !feeAddress)
    return undefined
  return { feeAddress, indexerUrl, network, proxyUrl, relays }
}

/** Keyed by the app's `BitcoinNetwork` names. */
export const P2P_NETWORKS: Record<string, P2pNetworkConfig | undefined> = {
  LocalRegtest: fromEnv('VITE_P2P_REGTEST', 'regtest'),
  SignetCustom: fromEnv('VITE_P2P_SIGNETCUSTOM', 'signetcustom'),
}

export const p2pConfigFor = (network: string): P2pNetworkConfig | null =>
  P2P_NETWORKS[network] ?? null

const NETWORK_LABELS: Record<string, string> = {
  LocalRegtest: 'Regtest',
  SignetCustom: 'Mutinynet',
}

export interface P2pNetworkOption {
  /** The app's network name, which keys the configuration. */
  key: string
  label: string
  config: P2pNetworkConfig
}

/** The networks that have a market configured: what the page lets the user pick from. */
export const p2pNetworkOptions = (): P2pNetworkOption[] =>
  Object.entries(P2P_NETWORKS).flatMap(([key, config]) =>
    config ? [{ config, key, label: NETWORK_LABELS[key] ?? key }] : []
  )

/** The trading wallet's account name on a network: one wallet per network, whatever node is used. */
export const walletAccountFor = (config: P2pNetworkConfig): string =>
  `wallet-${config.network}`
