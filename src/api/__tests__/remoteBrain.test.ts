import { describe, expect, it } from 'vitest'

import { buildPairingPayload, type RemoteBrainStatus } from '../remoteBrain'

const status = (patch: Partial<RemoteBrainStatus> = {}): RemoteBrainStatus => ({
  enabled: true,
  error: null,
  host: '192.168.1.20',
  lan: true,
  lanAddress: '192.168.1.20',
  port: 47615,
  running: true,
  token: 'tok',
  ...patch,
})

describe('remote brain pairing payload', () => {
  it('carries host, port, token and the OpenAI base URL', () => {
    expect(buildPairingPayload(status(), 'Qwen3.5 2B')).toEqual({
      baseUrl: 'http://192.168.1.20:47615/v1',
      host: '192.168.1.20',
      model: 'Qwen3.5 2B',
      name: 'KaleidoSwap Desktop',
      port: 47615,
      tls: false,
      token: 'tok',
      type: 'kaleido-mind-remote',
      v: 1,
    })
  })

  it('is empty unless the server is running on the LAN', () => {
    expect(buildPairingPayload(null, null)).toBeNull()
    expect(buildPairingPayload(status({ running: false }), null)).toBeNull()
    expect(
      buildPairingPayload(status({ host: '127.0.0.1', lan: false }), null)
    ).toBeNull()
    expect(buildPairingPayload(status({ token: '' }), null)).toBeNull()
  })
})
