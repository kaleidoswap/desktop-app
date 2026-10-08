// Remote brain: the desktop serves its loaded model to the phone over an
// OpenAI-compatible API (src-tauri/src/remote_brain.rs). Inference only — the
// phone keeps its own wallet tools and confirmation gate.

import { invoke } from '@tauri-apps/api/core'

export interface RemoteBrainStatus {
  enabled: boolean
  running: boolean
  lan: boolean
  host: string
  port: number
  token: string
  lanAddress: string | null
  error: string | null
}

/** What Rate scans to point `@kaleidorg/mind/openai` at this desktop. */
export interface RemoteBrainPairing {
  type: 'kaleido-mind-remote'
  v: 1
  name: string
  model: string
  host: string
  port: number
  baseUrl: string
  token: string
  tls: false
}

export const remoteBrain = {
  configure: (enabled: boolean, lan: boolean) =>
    invoke<RemoteBrainStatus>('remote_brain_configure', { enabled, lan }),
  rotateToken: () => invoke<RemoteBrainStatus>('remote_brain_rotate_token'),
  status: () => invoke<RemoteBrainStatus>('remote_brain_status'),
}

/**
 * The QR payload, or null while there is nothing a phone can reach: the server
 * must be running on a LAN address (a loopback address is useless to a phone).
 */
export const buildPairingPayload = (
  status: RemoteBrainStatus | null,
  model: string | null
): RemoteBrainPairing | null => {
  if (!status?.running || !status.lan || !status.host || !status.token) {
    return null
  }
  return {
    baseUrl: `http://${status.host}:${status.port}/v1`,
    host: status.host,
    model: model ?? '',
    name: 'KaleidoSwap Desktop',
    port: status.port,
    tls: false,
    token: status.token,
    type: 'kaleido-mind-remote',
    v: 1,
  }
}
