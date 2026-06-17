/**
 * Request Defaults and Interceptors
 *
 * Centralized handling of default request parameters
 */

import type {
  CreateUtxosRequest,
  FailTransfersRequest,
  RefreshRequest,
  SendBtcRequest,
} from 'kaleido-sdk/rln'

/**
 * Default values for common request parameters
 */
export const DEFAULT_SKIP_SYNC = false

/**
 * Request types that require skip_sync field.
 *
 * Note: SendRgbRequest dropped its skip_sync field in kaleido-sdk 0.1.8, so it
 * is no longer part of this union — sendRgb is sent without skip_sync.
 */
export type SkipSyncRequest =
  | SendBtcRequest
  | CreateUtxosRequest
  | RefreshRequest
  | FailTransfersRequest

/**
 * Ensure skip_sync is present in requests that require it
 */
export function ensureSkipSync<T extends Partial<SkipSyncRequest>>(
  request: T
): T & { skip_sync: boolean } {
  return {
    skip_sync: DEFAULT_SKIP_SYNC,
    ...request,
  }
}

/**
 * Ensure a RefreshRequest carries its required fields.
 *
 * RLN 0.7.1 made `filter` required on /refreshtransfers (kaleido-sdk 0.1.10+).
 * An empty filter refreshes all pending transfers, matching the prior
 * filter-less behavior.
 */
export function ensureRefreshDefaults(
  request: Partial<RefreshRequest>
): RefreshRequest {
  return {
    filter: [],
    skip_sync: DEFAULT_SKIP_SYNC,
    ...request,
  }
}

/**
 * Request options for node API calls
 */
export interface NodeRequestOptions {
  skipSync?: boolean
  skipValidation?: boolean
}

/**
 * Apply default options to a request
 */
export function applyRequestDefaults<T>(
  request: T,
  options?: NodeRequestOptions
): T & Partial<SkipSyncRequest> {
  const defaults: Partial<SkipSyncRequest> = {}

  if (options?.skipSync !== undefined) {
    defaults.skip_sync = options.skipSync
  }

  return {
    ...request,
    ...defaults,
  }
}
