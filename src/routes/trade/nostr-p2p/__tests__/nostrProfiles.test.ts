import { afterEach, describe, expect, it, vi } from 'vitest'
import { marketApi, type Info } from '../api'
import { nostrProfiles } from '../nostrProfiles'
import { transport } from '../transport'

const npubA = 'npub1alice'
const npubB = 'npub1bob'
const info = (npub: string, supported = true) =>
  ({ nostr_profiles: supported, npub }) as Info
const list = {
  active: npubB,
  profiles: [
    { label: null, npub: npubA },
    { label: 'Bob', npub: npubB },
  ],
  supported: true,
}
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('Nostr profile session', () => {
  it('keeps legacy signers read-only and detects a wallet change', async () => {
    const read = vi
      .spyOn(marketApi, 'info')
      .mockResolvedValue(info(npubA, false))
    const request = vi.spyOn(transport(), 'request')
    await expect(nostrProfiles.list(npubA)).resolves.toEqual({
      active: npubA,
      profiles: [{ label: null, npub: npubA }],
      supported: false,
    })
    read.mockResolvedValue(info(npubB))
    await expect(nostrProfiles.list(npubA)).rejects.toThrow('changed')
    expect(request).not.toHaveBeenCalled()
  })

  it('waits for the actual signer and passes no private keys over IPC', async () => {
    vi.useFakeTimers()
    const request = vi.spyOn(transport(), 'request').mockResolvedValue(list)
    vi.spyOn(marketApi, 'info')
      .mockRejectedValueOnce(new Error('restarting'))
      .mockResolvedValueOnce(info(npubA))
      .mockResolvedValue(info(npubB))
    const selecting = nostrProfiles.select(npubA, npubB)
    expect(request).toHaveBeenCalledWith('POST', '/api/nostr/profiles/select', {
      expected: npubA,
      target: npubB,
    })
    await vi.advanceTimersByTimeAsync(1000)
    await expect(selecting).resolves.toEqual(list)
    expect(request).toHaveBeenLastCalledWith('GET', '/api/nostr/profiles')
  })

  it('leaves the current profile intact on a daemon conflict', async () => {
    vi.spyOn(transport(), 'request').mockRejectedValue(
      new Error('close open orders')
    )
    const read = vi.spyOn(marketApi, 'info')
    await expect(nostrProfiles.select(npubA, npubB)).rejects.toThrow(
      'close open orders'
    )
    expect(read).not.toHaveBeenCalled()
  })

  it('forgets the specified inactive profile without restarting the wallet', async () => {
    const after = {
      active: npubA,
      profiles: [{ label: null, npub: npubA }],
      supported: true,
    }
    const request = vi.spyOn(transport(), 'request').mockResolvedValue(after)
    await expect(nostrProfiles.forget(npubA, npubB)).resolves.toEqual(after)
    expect(request).toHaveBeenCalledExactlyOnceWith(
      'POST',
      '/api/nostr/profiles/forget',
      {
        expected: npubA,
        target: npubB,
      }
    )
  })

  it('submits market signatures against the npub that reviewed the operation', async () => {
    const request = vi.spyOn(transport(), 'request').mockResolvedValue(null)
    await marketApi.placeOrder({
      amount: 1,
      asset_id: 'asset',
      expected_npub: npubA,
      price_sat: 1000,
      side: 'sell',
      ttl_secs: 60,
    })
    await marketApi.cancel('order', npubB)
    expect(request).toHaveBeenCalledWith(
      'POST',
      '/api/orders?signer=' + npubA,
      {
        amount: 1,
        asset_id: 'asset',
        price_sat: 1000,
        side: 'sell',
        ttl_secs: 60,
      }
    )
    expect(request).toHaveBeenCalledWith(
      'DELETE',
      '/api/orders/order?signer=' + npubB
    )
  })
})
