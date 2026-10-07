import { describe, it, expect } from 'vitest'
import {
  buildUnlockRequest,
  DESKTOP_ANNOUNCE_ALIAS,
  isValidBitcoindRpcUrl,
} from '../unlock'

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

describe('isValidBitcoindRpcUrl', () => {
  it('accepts an empty URL (indexer-only sync)', () => {
    expect(isValidBitcoindRpcUrl('')).toBe(true)
    expect(isValidBitcoindRpcUrl('  ')).toBe(true)
  })

  it('accepts user:password@host:port', () => {
    expect(isValidBitcoindRpcUrl('alice:hunter2@127.0.0.1:8332')).toBe(true)
    expect(isValidBitcoindRpcUrl('alice:@node.local:38332')).toBe(true)
  })

  it('rejects URLs parseRpcUrl would misread', () => {
    expect(isValidBitcoindRpcUrl('http://localhost:18443')).toBe(false)
    expect(isValidBitcoindRpcUrl('alice:hunter2@localhost')).toBe(false)
    expect(isValidBitcoindRpcUrl('alice:pa@ss@localhost:8332')).toBe(false)
  })
})
