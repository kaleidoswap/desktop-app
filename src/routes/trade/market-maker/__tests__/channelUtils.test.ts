import { describe, it, expect, vi } from 'vitest'
import type { Channel } from 'kaleido-sdk/rln'

vi.mock('../../../../utils/logger', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

import {
  isTradableChannel,
  hasTradableChannels,
  getTradableChannels,
  countTradableChannels,
  getTradableChannelDiagnostics,
  getChannelDiagnosticsMessage,
  hasReadyChannelForAsset,
  hasOnlyUnconfirmedChannelsForAsset,
  getReadyChannelCountForAsset,
  getChannelsForAsset,
  getAssetChannelStatus,
} from '../channelUtils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeChannel = (overrides: Record<string, any> = {}) =>
  ({
    asset_id: 'rgb:asset-id',
    inbound_balance_msat: 0,
    next_outbound_htlc_minimum_msat: 1,
    outbound_balance_msat: 1000,
    ready: true,
    ...overrides,
  }) as unknown as Channel

// ─── isTradableChannel ─────────────────────────────────────────────────────

describe('isTradableChannel', () => {
  it('returns true for a fully valid channel', () => {
    expect(isTradableChannel(makeChannel())).toBe(true)
  })

  it('returns false when ready is false', () => {
    expect(isTradableChannel(makeChannel({ ready: false }))).toBe(false)
  })

  it('returns false when both balances are zero', () => {
    expect(
      isTradableChannel(
        makeChannel({ inbound_balance_msat: 0, outbound_balance_msat: 0 })
      )
    ).toBe(false)
  })

  it('returns true when only inbound balance is positive', () => {
    expect(
      isTradableChannel(
        makeChannel({ inbound_balance_msat: 500, outbound_balance_msat: 0 })
      )
    ).toBe(true)
  })

  it('returns false when next_outbound_htlc_minimum_msat is 0', () => {
    expect(
      isTradableChannel(makeChannel({ next_outbound_htlc_minimum_msat: 0 }))
    ).toBe(false)
  })

  it('returns false when asset_id is null', () => {
    expect(isTradableChannel(makeChannel({ asset_id: null }))).toBe(false)
  })

  it('returns false when asset_id is undefined', () => {
    expect(isTradableChannel(makeChannel({ asset_id: undefined }))).toBe(false)
  })
})

// ─── hasTradableChannels ──────────────────────────────────────────────────

describe('hasTradableChannels', () => {
  it('returns false for an empty array', () => {
    expect(hasTradableChannels([])).toBe(false)
  })

  it('returns true when at least one tradable channel exists', () => {
    expect(hasTradableChannels([makeChannel()])).toBe(true)
  })

  it('returns false when all channels are non-tradable', () => {
    expect(hasTradableChannels([makeChannel({ ready: false })])).toBe(false)
  })
})

// ─── getTradableChannels ──────────────────────────────────────────────────

describe('getTradableChannels', () => {
  it('returns only tradable channels', () => {
    const good = makeChannel()
    const bad = makeChannel({ ready: false })
    expect(getTradableChannels([good, bad])).toEqual([good])
  })

  it('returns empty array when none are tradable', () => {
    expect(getTradableChannels([makeChannel({ ready: false })])).toEqual([])
  })
})

// ─── countTradableChannels ────────────────────────────────────────────────

describe('countTradableChannels', () => {
  it('returns 0 for empty array', () => {
    expect(countTradableChannels([])).toBe(0)
  })

  it('counts only tradable channels', () => {
    const channels = [
      makeChannel(),
      makeChannel(),
      makeChannel({ ready: false }),
    ]
    expect(countTradableChannels(channels)).toBe(2)
  })
})

// ─── getTradableChannelDiagnostics ────────────────────────────────────────

describe('getTradableChannelDiagnostics', () => {
  it('returns zeroes for an empty array', () => {
    const d = getTradableChannelDiagnostics([])
    expect(d.totalChannels).toBe(0)
    expect(d.tradableChannels).toBe(0)
    expect(d.readyChannels).toBe(0)
    expect(d.channelsWithBalance).toBe(0)
    expect(d.channelsWithAssetId).toBe(0)
  })

  it('correctly counts each category', () => {
    const channels = [
      makeChannel(), // tradable: ✓ ready ✓ balance ✓ assetId
      makeChannel({ ready: false }), // not ready
      makeChannel({ inbound_balance_msat: 0, outbound_balance_msat: 0 }), // no balance
      makeChannel({ asset_id: null }), // no assetId
    ]
    const d = getTradableChannelDiagnostics(channels)
    expect(d.totalChannels).toBe(4)
    expect(d.tradableChannels).toBe(1)
    expect(d.readyChannels).toBe(3) // second has no balance but is ready; third is ready
    expect(d.channelsWithBalance).toBe(3) // first + second + fourth
    expect(d.channelsWithAssetId).toBe(3) // first + second + third
  })
})

// ─── getChannelDiagnosticsMessage ────────────────────────────────────────

describe('getChannelDiagnosticsMessage', () => {
  it('returns "No channels found" for empty input', () => {
    expect(getChannelDiagnosticsMessage([])).toContain('No channels found')
  })

  it('reports tradable count when channels are tradable', () => {
    const channels = [makeChannel(), makeChannel()]
    const msg = getChannelDiagnosticsMessage(channels)
    expect(msg).toContain('2')
    expect(msg).toContain('tradable')
  })

  it('reports "not ready" when no ready channels exist', () => {
    const channels = [makeChannel({ ready: false })]
    const msg = getChannelDiagnosticsMessage(channels)
    expect(msg).toContain('not ready')
  })

  it('reports no balance when channels are ready but have no balance', () => {
    const channels = [
      makeChannel({
        inbound_balance_msat: 0,
        next_outbound_htlc_minimum_msat: 0,
        outbound_balance_msat: 0,
      }),
    ]
    const msg = getChannelDiagnosticsMessage(channels)
    expect(msg).toMatch(/no balance|not ready|no tradable/)
  })
})

// ─── hasReadyChannelForAsset ──────────────────────────────────────────────

describe('hasReadyChannelForAsset', () => {
  it('returns false for null assetId', () => {
    expect(hasReadyChannelForAsset([makeChannel()], null)).toBe(false)
  })

  it('returns true when a ready channel exists for the asset', () => {
    expect(hasReadyChannelForAsset([makeChannel()], 'rgb:asset-id')).toBe(true)
  })

  it('returns false when no channel exists for the asset', () => {
    expect(hasReadyChannelForAsset([makeChannel()], 'rgb:other-id')).toBe(false)
  })

  it('returns false when all channels for the asset are not ready', () => {
    expect(
      hasReadyChannelForAsset([makeChannel({ ready: false })], 'rgb:asset-id')
    ).toBe(false)
  })
})

// ─── hasOnlyUnconfirmedChannelsForAsset ──────────────────────────────────

describe('hasOnlyUnconfirmedChannelsForAsset', () => {
  it('returns false for null assetId', () => {
    expect(hasOnlyUnconfirmedChannelsForAsset([], null)).toBe(false)
  })

  it('returns false when no channels exist for asset', () => {
    expect(
      hasOnlyUnconfirmedChannelsForAsset([makeChannel()], 'rgb:other-id')
    ).toBe(false)
  })

  it('returns true when all channels for asset are not ready', () => {
    expect(
      hasOnlyUnconfirmedChannelsForAsset(
        [makeChannel({ ready: false })],
        'rgb:asset-id'
      )
    ).toBe(true)
  })

  it('returns false when at least one channel is ready', () => {
    const channels = [makeChannel(), makeChannel({ ready: false })]
    expect(hasOnlyUnconfirmedChannelsForAsset(channels, 'rgb:asset-id')).toBe(
      false
    )
  })
})

// ─── getReadyChannelCountForAsset ────────────────────────────────────────

describe('getReadyChannelCountForAsset', () => {
  it('returns 0 for null assetId', () => {
    expect(getReadyChannelCountForAsset([makeChannel()], null)).toBe(0)
  })

  it('counts only ready channels for the given asset', () => {
    const channels = [
      makeChannel(), // ready, 'rgb:asset-id'
      makeChannel({ ready: false }), // not ready, 'rgb:asset-id'
      makeChannel({ asset_id: 'rgb:other' }), // ready, different asset
    ]
    expect(getReadyChannelCountForAsset(channels, 'rgb:asset-id')).toBe(1)
  })
})

// ─── getChannelsForAsset ──────────────────────────────────────────────────

describe('getChannelsForAsset', () => {
  it('returns empty array for null assetId', () => {
    expect(getChannelsForAsset([makeChannel()], null)).toEqual([])
  })

  it('returns only channels matching the given assetId', () => {
    const target = makeChannel()
    const other = makeChannel({ asset_id: 'rgb:other' })
    expect(getChannelsForAsset([target, other], 'rgb:asset-id')).toEqual([
      target,
    ])
  })
})

// ─── getAssetChannelStatus ────────────────────────────────────────────────

describe('getAssetChannelStatus', () => {
  it('returns empty status for null assetId', () => {
    const status = getAssetChannelStatus([makeChannel()], null)
    expect(status.hasChannels).toBe(false)
    expect(status.hasReadyChannels).toBe(false)
    expect(status.readyChannelCount).toBe(0)
    expect(status.totalChannelCount).toBe(0)
    expect(status.allUnconfirmed).toBe(false)
  })

  it('reports correct counts for a mix of ready and unconfirmed channels', () => {
    const channels = [makeChannel(), makeChannel({ ready: false })]
    const status = getAssetChannelStatus(channels, 'rgb:asset-id')
    expect(status.hasChannels).toBe(true)
    expect(status.hasReadyChannels).toBe(true)
    expect(status.readyChannelCount).toBe(1)
    expect(status.totalChannelCount).toBe(2)
    expect(status.allUnconfirmed).toBe(false)
  })

  it('sets allUnconfirmed when all channels are not ready', () => {
    const status = getAssetChannelStatus(
      [makeChannel({ ready: false })],
      'rgb:asset-id'
    )
    expect(status.allUnconfirmed).toBe(true)
    expect(status.hasReadyChannels).toBe(false)
  })

  it('sets hasChannels false when no channels exist for the asset', () => {
    const status = getAssetChannelStatus([], 'rgb:asset-id')
    expect(status.hasChannels).toBe(false)
    expect(status.allUnconfirmed).toBe(false)
  })
})
