import { describe, it, expect } from 'vitest'
import { buildUnlockRequest, DESKTOP_ANNOUNCE_ALIAS } from '../unlock'

const INDEXER_URL = 'https://esplora.example.com'

describe('buildUnlockRequest', () => {
  it('syncs from bitcoind when an RPC connection URL is configured', () => {
    const request = buildUnlockRequest({
      announceAlias: DESKTOP_ANNOUNCE_ALIAS,
      nodeSettings: {
        indexer_url: INDEXER_URL,
        rpc_connection_url: 'alice:hunter2@bitcoind.example.com:38332',
      },
      password: 'walletpw',
    })

    expect(request.ldk_chain_sync).toEqual({
      config: {
        bitcoind_rpc_host: 'bitcoind.example.com',
        bitcoind_rpc_password: 'hunter2',
        bitcoind_rpc_port: 38332,
        bitcoind_rpc_username: 'alice',
      },
      mode: 'BlockSync',
    })
    expect(request.indexer_url).toBe(INDEXER_URL)
    expect(request.password).toBe('walletpw')
    expect(request.announce_alias).toBe(DESKTOP_ANNOUNCE_ALIAS)
    expect(request.announce_addresses).toEqual([])
  })

  it('syncs from the indexer alone when no RPC connection URL is set', () => {
    const request = buildUnlockRequest({
      nodeSettings: { indexer_url: INDEXER_URL, rpc_connection_url: '   ' },
      password: 'walletpw',
    })

    expect(request.ldk_chain_sync).toEqual({
      config: { indexer_url: INDEXER_URL },
      mode: 'TransactionSync',
    })
    expect(request.announce_alias).toBeUndefined()
  })
})
