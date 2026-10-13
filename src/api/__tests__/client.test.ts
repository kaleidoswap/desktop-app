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

// Health checks have their own timeout; a slow probe must not shorten a payment.
describe('node health client', () => {
  it('uses a short timeout and preserves the wallet client timeout', async () => {
    const { KaleidoClient } = await import('kaleido-sdk')
    const { getNodeHealthApiWrapper, getKaleidoClient } =
      await import('../client')
    const state = stateWith('https://health-test.example.com')
    const wallet = await getKaleidoClient(state)
    getNodeHealthApiWrapper(state)
    expect(KaleidoClient.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ nodeUrl: 'http://127.0.0.1:3001', timeout: 5 })
    )
    expect(await getKaleidoClient(state)).toBe(wallet)
    expect(
      (wallet as unknown as { config: { timeout: number } }).config.timeout
    ).toBe(60)
  })
})
