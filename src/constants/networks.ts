export interface NetworkDefaults {
  rpc_connection_url: string
  indexer_url: string
  proxy_endpoint: string
  daemon_listening_port: string
  ldk_peer_listening_port: string
  default_lsp_url: string
  default_maker_url: string
}

export const NETWORK_DEFAULTS: Record<string, NetworkDefaults> = {
  BitfinexRegtest: {
    daemon_listening_port: '3001',
    default_lsp_url: 'https://api.regtest.kaleidoswap.com/',
    default_maker_url: 'https://api.regtest.kaleidoswap.com/',
    indexer_url: 'electrum.rgbtools.org:50041',
    ldk_peer_listening_port: '9735',
    proxy_endpoint: 'rpcs://proxy.iriswallet.com/0.2/json-rpc',
    rpc_connection_url: 'user:password@regtest-bitcoind.rgbtools.org:80',
  },
  // Node started by the kaleidoswap-maker docker stack (`make start-channels`).
  // The rgb-lightning-node runs INSIDE the compose network, so it reaches its
  // backends via docker-internal hostnames (bitcoind / esplora / myproxy.local),
  // not localhost — even though the desktop connects to it on localhost:3001.
  LocalDockerRegtest: {
    daemon_listening_port: '3001',
    default_lsp_url: 'http://localhost:8000/',
    default_maker_url: 'http://localhost:8000/',
    indexer_url: 'http://esplora:3000',
    ldk_peer_listening_port: '9735',
    proxy_endpoint: 'rpc://myproxy.local:3000/json-rpc',
    rpc_connection_url: 'user:password@bitcoind:18443',
  },
  LocalRegtest: {
    daemon_listening_port: '3001',
    default_lsp_url: 'http://localhost:8000/',
    default_maker_url: 'http://localhost:8000/',
    indexer_url: 'localhost:50001',
    ldk_peer_listening_port: '9735',
    proxy_endpoint: 'rpc://myproxy.local:3000/json-rpc',
    rpc_connection_url: 'user:password@localhost:18443',
  },
  Mainnet: {
    daemon_listening_port: '3001',
    default_lsp_url: 'https://api.kaleidoswap.com/',
    default_maker_url: 'https://api.kaleidoswap.com/',
    indexer_url: '127.0.0.1:50001',
    ldk_peer_listening_port: '9735',
    proxy_endpoint: 'rpc://127.0.0.1:3000/json-rpc',
    rpc_connection_url: 'user:password@127.0.0.1:8332',
  },
  Regtest: {
    daemon_listening_port: '3001',
    default_lsp_url: 'https://api.regtest.kaleidoswap.com/',
    default_maker_url: 'https://api.regtest.kaleidoswap.com/',
    indexer_url: 'electrum.rgbtools.org:50041',
    ldk_peer_listening_port: '9735',
    proxy_endpoint: 'rpcs://proxy.iriswallet.com/0.2/json-rpc',
    rpc_connection_url: 'user:password@regtest-bitcoind.rgbtools.org:80',
  },

  Signet: {
    daemon_listening_port: '3001',
    default_lsp_url: '',
    default_maker_url: '',
    indexer_url: '',
    ldk_peer_listening_port: '9735',
    proxy_endpoint: 'rpcs://proxy.iriswallet.com/0.2/json-rpc',
    rpc_connection_url: '',
  },
  SignetCustom: {
    daemon_listening_port: '3001',
    default_lsp_url: 'https://api.mutinynet2.kaleidoswap.com/',
    default_maker_url: 'https://api.mutinynet2.kaleidoswap.com/',
    indexer_url: 'https://esplora.signet.kaleidoswap.com',
    ldk_peer_listening_port: '9735',
    proxy_endpoint: 'rpcs://proxy.iriswallet.com/0.2/json-rpc',
    rpc_connection_url:
      'user:default_password@bitcoind.signet.kaleidoswap.com:38332',
  },
  Testnet: {
    daemon_listening_port: '3001',
    default_lsp_url: 'https://api.testnet.kaleidoswap.com/',
    default_maker_url: 'https://api.testnet.kaleidoswap.com/',
    indexer_url: 'ssl://electrum.iriswallet.com:50013',
    ldk_peer_listening_port: '9735',
    proxy_endpoint: 'rpcs://proxy.iriswallet.com/0.2/json-rpc',
    rpc_connection_url: 'user:password@electrum.iriswallet.com:18332',
  },
}

// Mutinynet (SignetCustom) has two interchangeable public endpoints. A fresh
// node is seeded with BOTH so the user can switch the default in Settings; the
// first entry (mutinynet2) is the default — it matches
// NETWORK_DEFAULTS.SignetCustom.default_maker_url / default_lsp_url.
export const SIGNET_CUSTOM_MAKER_URLS = [
  'https://api.mutinynet2.kaleidoswap.com/',
  'https://api.signet.kaleidoswap.com/',
]

// The maker URLs to seed a brand-new node's config with. Mutinynet ships both
// endpoints (see above); every other network seeds just its single default.
export const getDefaultMakerUrls = (network: string): string[] => {
  if (network === 'SignetCustom') return [...SIGNET_CUSTOM_MAKER_URLS]
  const url = NETWORK_DEFAULTS[network]?.default_maker_url
  return url ? [url] : []
}
