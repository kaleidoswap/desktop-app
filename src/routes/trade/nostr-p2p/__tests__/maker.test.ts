import { describe, expect, it } from 'vitest'

import { fillsToday, openQuotes, utcDayStart } from '../maker/LiveScreen'
import { isPaired } from '../maker/MakerSection'
import { makerAvailableOn, type MakerView } from '../maker/makerApi'
import {
  buildPolicy,
  fromRule,
  ruleErrors,
  ruleFor,
  samePolicy,
  toRule,
} from '../maker/policy'
import {
  defaultForm,
  fromBotMarket,
  ladder,
  strategyErrors,
  toBotMarket,
  withMarket,
  withoutMarket,
} from '../maker/strategy'

const ASSET = { asset_id: 'rgb:tusd', precision: 2, ticker: 'TUSD' }

describe('maker strategy', () => {
  it('converts whole units and percentages to p2pd base units and bps, and back', () => {
    const f = {
      ...defaultForm(ASSET),
      askSize: 12.5,
      dailyNet: { on: true, units: 300 },
      priceKind: 'fixed' as const,
      satPerUnit: 1_000,
      skew: { maxBps: 80, on: true, range: 400, target: 500 },
    }
    const m = toBotMarket(f)
    expect(m.ask_amount).toBe(1_250)
    expect(m.price).toEqual({ sat_per_unit: 1_000, source: 'fixed' })
    expect(m.skew).toEqual({ max_bps: 80, range: 40_000, target: 50_000 })
    expect(m.max_daily_net).toBe(30_000)
    expect(m.circuit_breaker).toEqual({ cooldown_secs: 300, max_move_bps: 300 })
    const back = fromBotMarket(m, { ticker: 'TUSD' })
    expect(back).toEqual({ ...f, bandPct: back.bandPct })
  })

  it('reads a feed back as a feed, and a fixed price as issuer-set only with the app note', () => {
    const feed = toBotMarket(defaultForm(ASSET))
    expect(feed.price).toEqual({
      max_age_secs: 120,
      path: '/shared/prices.json',
      source: 'file',
    })
    expect(fromBotMarket(feed).priceKind).toBe('feed')
    const fixed = toBotMarket({
      ...defaultForm(ASSET),
      priceKind: 'issuer',
      satPerUnit: 5,
    })
    expect(fromBotMarket(fixed).priceKind).toBe('fixed')
    expect(fromBotMarket(fixed, { bandPct: 3, kind: 'issuer' })).toMatchObject({
      bandPct: 3,
      priceKind: 'issuer',
    })
  })

  it('builds the ladder the way p2pd does: distance, steps, growth', () => {
    const f = {
      ...defaultForm(ASSET),
      askSize: 10,
      bidSize: 10,
      distanceBps: 100,
      growth: 2,
      levels: 3,
      stepBps: 50,
    }
    const { levels } = ladder(f, 1_000)
    const asks = levels.filter((l) => l.side === 'ask')
    const bids = levels.filter((l) => l.side === 'bid')
    expect(asks.map((l) => +l.price.toFixed(6))).toEqual([1_010, 1_015, 1_020])
    expect(bids.map((l) => +l.price.toFixed(6))).toEqual([990, 985, 980])
    expect(asks.map((l) => l.size)).toEqual([10, 20, 40])
    expect(asks[0].totalSat).toBe(10_100)
  })

  it('leans the ladder against inventory and leaves out what the daily cap cannot cover', () => {
    const f = {
      ...defaultForm(ASSET),
      dailyNet: { on: true, units: 25 },
      growth: 1,
      levels: 3,
      skew: { maxBps: 100, on: true, range: 100, target: 500 },
    }
    // holding 100 over target: the full lean, down 1%
    const heavy = ladder({ ...f, askSize: 10, bidSize: 10 }, 1_000, 600)
    expect(heavy.center).toBeCloseTo(990)
    expect(heavy.levels.filter((l) => l.capped).map((l) => l.index)).toEqual([
      2, 2,
    ])
  })

  it('flags levels an issuer-set band would have the signer refuse', () => {
    const f = {
      ...defaultForm(ASSET),
      bandPct: 1,
      priceKind: 'issuer' as const,
      satPerUnit: 1_000,
      skew: { maxBps: 300, on: true, range: 10, target: 0 },
    }
    // holding far above target: asks drop under the band
    const { levels } = ladder(f, 1_000, 100)
    expect(levels.some((l) => l.side === 'ask' && l.outsideBand)).toBe(true)
    expect(levels.some((l) => l.side === 'bid' && l.outsideBand)).toBe(false)
  })

  it('reports what p2pd would refuse before it is sent', () => {
    expect(strategyErrors({ ...defaultForm(ASSET), feedPath: ' ' })).toEqual([
      'feed',
    ])
    const bad = {
      ...defaultForm({ ...ASSET, asset_id: 'tusd' }),
      askSize: 0,
      bidSize: 0,
      levels: 21,
      priceKind: 'fixed' as const,
    }
    expect(strategyErrors(bad)).toEqual(['asset', 'price', 'levels', 'size'])
  })

  it('replaces one market in a config and keeps the rest', () => {
    const a = toBotMarket(defaultForm(ASSET))
    const b = toBotMarket(defaultForm({ ...ASSET, asset_id: 'rgb:gold' }))
    const cfg = withMarket(
      { markets: [a, b], refresh_secs: 20 },
      { ...a, levels: 5 }
    )
    expect(cfg.refresh_secs).toBe(20)
    expect(cfg.markets.map((m) => [m.asset_id, m.levels])).toEqual([
      ['rgb:gold', 3],
      ['rgb:tusd', 5],
    ])
    expect(withoutMarket(cfg, 'rgb:gold').markets).toHaveLength(1)
  })
})

describe('maker signing policy', () => {
  const market = toBotMarket({
    ...defaultForm(ASSET),
    askSize: 10,
    bidSize: 0,
    growth: 2,
    levels: 3,
    priceKind: 'issuer',
    satPerUnit: 1_000,
  })

  it('starts from the strategy: its sides, its largest level, its price and band', () => {
    const r = ruleFor(market, {
      bandPct: 3,
      priceKind: 'issuer',
      ticker: 'TUSD',
    })
    expect(r).toMatchObject({
      bandPct: 3,
      buy: false,
      maxDailyNet: 400,
      maxSwap: 40,
      refKind: 'fixed',
      refValue: 1_000,
      sell: true,
    })
  })

  it('leaves buying off even when the strategy quotes bids: a purchase trusts the host', () => {
    const both = toBotMarket({
      ...defaultForm(ASSET),
      askSize: 10,
      bidSize: 10,
    })
    expect(ruleFor(both)).toMatchObject({
      buy: false,
      maxSwapSat: 0,
      sell: true,
    })
  })

  it('turns into the rule the signer checks, in base units and bps', () => {
    const r = ruleFor(market, {
      bandPct: 2.5,
      priceKind: 'issuer',
      ticker: 'TUSD',
    })
    const rule = toRule(r)
    expect(rule).toMatchObject({
      band_bps: 250,
      max_daily_net_units: 40_000,
      max_swap_sat: null,
      max_swap_units: 4_000,
      reference: { kind: 'fixed', sat_per_unit: 1_000 },
      ticker: 'TUSD',
    })
    expect(fromRule(rule)).toEqual(r)
  })

  it('refuses a rule that allows nothing or has no reference', () => {
    const r = ruleFor(market)
    expect(ruleErrors({ ...r, buy: false, refValue: 0, sell: false })).toEqual([
      'sides',
      'reference',
    ])
    expect(ruleErrors({ ...r, bandPct: 60 })).toEqual(['band'])
  })

  it('compares policies whatever order their fields come in', () => {
    const p = buildPolicy('signetcustom', 'npub1x', [ruleFor(market)])
    const fromRust = JSON.parse(
      JSON.stringify({
        version: 1,
        // eslint-disable-next-line sort-keys-fix/sort-keys-fix
        network: 'signetcustom',
        // eslint-disable-next-line sort-keys-fix/sort-keys-fix
        maker_npub: 'npub1x',
        markets: p.markets,
      })
    )
    expect(samePolicy(p, fromRust)).toBe(true)
    expect(samePolicy(p, { ...fromRust, maker_npub: 'npub1y' })).toBe(false)
  })
})

describe('maker section', () => {
  it('is offered on Mutinynet and the local regtest stack only', () => {
    expect(makerAvailableOn('signetcustom')).toBe(true)
    expect(makerAvailableOn('regtest')).toBe(true)
    expect(makerAvailableOn('mainnet')).toBe(false)
    expect(makerAvailableOn('signet')).toBe(false)
  })

  const view = (v: Partial<MakerView>): MakerView =>
    ({ endpoint: null, has_token: false, mode: null, ...v }) as MakerView

  it('lets the strategy be set only once the maker is reachable', () => {
    expect(isPaired(view({}))).toBe(false)
    expect(isPaired(view({ mode: 'hosted' }))).toBe(false)
    const endpoint = { maker_npub: 'npub1x', url: 'https://m' }
    expect(isPaired(view({ endpoint, has_token: true, mode: 'hosted' }))).toBe(
      true
    )
    expect(isPaired(view({ mode: 'self_hosted' }))).toBe(true)
    expect(isPaired(view({ endpoint, mode: 'self_hosted' }))).toBe(false)
  })

  it('counts open quotes and the maker fills of the UTC day', () => {
    const now = Date.UTC(2026, 10, 13, 12)
    const day = utcDayStart(now)
    expect(new Date(day * 1000).toISOString()).toBe('2026-11-13T00:00:00.000Z')
    const o = (state: string | null) => ({ state }) as never
    expect(
      openQuotes([o('open'), o('matching'), o('cancelled'), o(null)])
    ).toHaveLength(2)
    const t = (role: string, status: string, ts: number) =>
      ({ role, status, ts }) as never
    const fills = fillsToday(
      [
        t('maker', 'settled', day + 10),
        t('maker', 'broadcast', day + 20),
        t('taker', 'settled', day + 30),
        t('maker', 'failed', day + 40),
        t('maker', 'settled', day - 10),
      ],
      now
    )
    expect(fills).toHaveLength(2)
  })
})
