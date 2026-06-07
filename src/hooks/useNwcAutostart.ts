import { invoke } from '@tauri-apps/api/core'
import { useEffect } from 'react'

import { useAppSelector } from '../app/store/hooks'
import { nodeApi } from '../slices/nodeApi/nodeApi.slice'
import { logger } from '../utils/logger'

/**
 * Starts the NWC wallet service as soon as the node is unlocked, so the desktop
 * hub serves app connections without the user having to open the NWC page.
 *
 * The service identity is a random key persisted per account (no password
 * needed), and `nwc_start_service` is idempotent, so calling it on readiness is
 * safe. Stop is handled by the lock/logout/quit paths.
 */
export function useNwcAutostart() {
  const accountName = useAppSelector((s) => s.nodeSettings.data.name)

  const { data: nodeInfoData, isSuccess } = nodeApi.endpoints.nodeInfo.useQuery(
    undefined,
    { pollingInterval: 30_000, skip: !accountName }
  )
  const isNodeReady =
    isSuccess && !!(nodeInfoData as { pubkey?: string })?.pubkey

  useEffect(() => {
    if (isNodeReady) {
      invoke('nwc_start_service').catch((err) =>
        logger.error('nwc_start_service failed', err)
      )
    }
  }, [isNodeReady])
}
