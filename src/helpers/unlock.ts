import {
  LdkChainSyncBlockSyncMode,
  LdkChainSyncTransactionSyncMode,
} from 'kaleido-sdk/rln'
import type { LdkChainSync, UnlockRequest } from 'kaleido-sdk/rln'

import { parseRpcUrl } from './utils'

export const DESKTOP_ANNOUNCE_ALIAS = 'kaleidoswap-desktop'

interface UnlockNodeSettings {
  rpc_connection_url: string
  indexer_url: string
}

interface BuildUnlockRequestArgs {
  nodeSettings: UnlockNodeSettings
  password: string
  announceAlias?: string
  announceAddresses?: string[]
}

/**
 * RLN 0.9.0 picks how LDK follows the chain per unlock: from bitcoind
 * (BlockSync) or from the indexer alone (TransactionSync). A node configured
 * without an RPC connection URL gets indexer-only sync rather than the bogus
 * localhost credentials `parseRpcUrl` falls back to.
 */
export const buildChainSync = (
  nodeSettings: UnlockNodeSettings
): LdkChainSync => {
  if (!nodeSettings.rpc_connection_url?.trim()) {
    return {
      config: { indexer_url: nodeSettings.indexer_url },
      mode: LdkChainSyncTransactionSyncMode.TransactionSync,
    }
  }

  const rpcConfig = parseRpcUrl(nodeSettings.rpc_connection_url)
  return {
    config: {
      bitcoind_rpc_host: rpcConfig.host,
      bitcoind_rpc_password: rpcConfig.password,
      bitcoind_rpc_port: rpcConfig.port,
      bitcoind_rpc_username: rpcConfig.username,
    },
    mode: LdkChainSyncBlockSyncMode.BlockSync,
  }
}

export const buildUnlockRequest = ({
  nodeSettings,
  password,
  announceAlias,
  announceAddresses = [],
}: BuildUnlockRequestArgs): UnlockRequest => ({
  announce_addresses: announceAddresses,
  announce_alias: announceAlias,
  indexer_url: nodeSettings.indexer_url,
  ldk_chain_sync: buildChainSync(nodeSettings),
  password,
})
