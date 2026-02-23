/**
 * Request Defaults and Interceptors
 * 
 * Centralized handling of default request parameters
 */

import type {
  SendBtcRequest,
  SendRgbRequest,
  CreateUtxosRequest,
  RefreshTransfersRequest as RefreshRequest,
  FailTransfersRequest,
} from 'kaleidoswap-sdk';

/**
 * Default values for common request parameters
 */
export const DEFAULT_SKIP_SYNC = false;

/**
 * Request types that require skip_sync field
 */
export type SkipSyncRequest =
  | SendBtcRequest
  | SendRgbRequest
  | CreateUtxosRequest
  | RefreshRequest
  | FailTransfersRequest;

/**
 * Ensure skip_sync is present in requests that require it
 */
export function ensureSkipSync<T extends Partial<SkipSyncRequest>>(
  request: T
): T & { skip_sync: boolean } {
  return {
    skip_sync: DEFAULT_SKIP_SYNC,
    ...request,
  };
}

/**
 * Request options for node API calls
 */
export interface NodeRequestOptions {
  skipSync?: boolean;
  skipValidation?: boolean;
}

/**
 * Apply default options to a request
 */
export function applyRequestDefaults<T>(
  request: T,
  options?: NodeRequestOptions
): T & Partial<SkipSyncRequest> {
  const defaults: Partial<SkipSyncRequest> = {};

  if (options?.skipSync !== undefined) {
    defaults.skip_sync = options.skipSync;
  }

  return {
    ...request,
    ...defaults,
  };
}
