import { describe, expect, it, vi } from 'vitest'

vi.mock('kaleido-sdk', () => ({
  KaleidoClient: {
    create: vi.fn((config: { baseUrl: string }) => ({ config, rln: {} })),
  },
}))

import { getMakerClient, MakerNotConfiguredError } from '../client'

const stateWith = (default_maker_url?: string) => ({
  nodeSettings: {
    data: { default_maker_url, node_url: 'http://127.0.0.1:3001' },
  },
})

describe('getMakerClient', () => {
  it.each([undefined, '', '   '])(
    'rejects when no maker URL is configured (%j)',
    async (url) => {
      await expect(getMakerClient(stateWith(url))).rejects.toBeInstanceOf(
        MakerNotConfiguredError
      )
    }
  )

  it('uses the configured maker URL', async () => {
    const client = (await getMakerClient(
      stateWith('https://maker.example.com')
    )) as unknown as { config: { baseUrl: string } }
    expect(client.config.baseUrl).toBe('https://maker.example.com')
  })
})
