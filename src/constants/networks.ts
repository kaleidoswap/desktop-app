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
    default_lsp_url: 'https://api.signet.kaleidoswap.com/',
    default_maker_url: 'https://api.signet.kaleidoswap.com/',
    indexer_url: 'electrum.signet.kaleidoswap.com:60601',
    ldk_peer_listening_port: '9735',
    proxy_endpoint: 'rpcs://proxy.signet.kaleidoswap.com/json-rpc',
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
