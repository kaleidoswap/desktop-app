import { describe, expect, it } from 'vitest'

import {
  createAssetLiquiditySection,
  createBitcoinLiquiditySection,
} from '../orderSummaryUtils'

describe('createBitcoinLiquiditySection', () => {
  it('builds the shared bitcoin section styles and values', () => {
    expect(
      createBitcoinLiquiditySection({
        iconSrc: '/btc.svg',
        inbound: 75_000,
        inboundLabel: '75,000 sats',
        outbound: 25_000,
        outboundLabel: '25,000 sats',
        ticker: 'Bitcoin',
        title: 'Confirmed channel',
        totalLabel: '100,000 sats',
      })
    ).toEqual({
      accentClassName: 'text-amber-300',
      backgroundClassName: 'bg-amber-400/6',
      borderClassName: 'border-amber-400/15',
      iconAlt: 'BTC',
      iconSrc: '/btc.svg',
      inbound: 75_000,
      inboundColor: 'bg-blue-400/50',
      inboundLabel: '75,000 sats',
      outbound: 25_000,
      outboundColor: 'bg-amber-400',
      outboundLabel: '25,000 sats',
      ticker: 'Bitcoin',
      title: 'Confirmed channel',
      totalLabel: '100,000 sats',
    })
  })
})

describe('createAssetLiquiditySection', () => {
  it('builds the shared asset section styles and values', () => {
    expect(
      createAssetLiquiditySection({
        iconSrc: '/asset.svg',
        inbound: 12.5,
        inboundLabel: '12.5 USDT',
        outbound: 7.5,
        outboundLabel: '7.5 USDT',
        subtitle: 'Tether USD',
        ticker: 'USDT',
        title: 'Tether USD (USDT)',
        titleClassName: 'text-cyan-300',
        totalLabel: '20 USDT',
      })
    ).toEqual({
      accentClassName: 'text-cyan-300',
      backgroundClassName: 'bg-cyan-400/6',
      borderClassName: 'border-cyan-400/15',
      iconAlt: 'USDT',
      iconSrc: '/asset.svg',
      inbound: 12.5,
      inboundColor: 'bg-sky-400/35',
      inboundLabel: '12.5 USDT',
      outbound: 7.5,
      outboundColor: 'bg-cyan-400',
      outboundLabel: '7.5 USDT',
      subtitle: 'Tether USD',
      ticker: 'USDT',
      title: 'Tether USD (USDT)',
      titleClassName: 'text-cyan-300',
      totalLabel: '20 USDT',
    })
  })
})
