import { describe, expect, it, vi } from 'vitest'

import type { AssetFacts, RegistryDetail, RegistryNote } from '../api'
import { registryFacts } from '../market/registry'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))

const detail = (extra: Partial<RegistryDetail> = {}): RegistryDetail => ({
  contested_by: 0,
  contract_valid: true,
  dispute: false,
  impersonation_warning: false,
  issuer_address: 'tb1qabc',
  issuer_identified: false,
  issuer_proof: null,
  issuer_signed: true,
  issuer_verified: false,
  same_ticker: 0,
  ...extra,
})
const facts = (
  d: RegistryDetail | null,
  extra: Partial<AssetFacts> = {}
): AssetFacts => ({
  detail: d,
  listed: {
    contract_id: 'rgb:A',
    listed_by: [],
    name: 'Demo',
    precision: 8,
    schema_type: null,
    ticker: 'DEMO',
  },
  same_ticker_listed: 0,
  ...extra,
})
const note = (extra: Partial<RegistryNote> = {}): RegistryNote => ({
  listed: true,
  listed_by: [],
  same_ticker_listed: 0,
  ticker_differs: null,
  ...extra,
})
const ids = (f: ReturnType<typeof registryFacts>) =>
  f.map((x) => `${x.id}:${x.tone}`)

describe('what the registry says about an asset', () => {
  it('says nothing when no registry is read', () => {
    expect(registryFacts(null, null)).toEqual([])
    expect(registryFacts(null, undefined)).toEqual([])
  })

  it('keeps a signed declaration apart from proof that the signer is the issuer', () => {
    expect(ids(registryFacts(note(), facts(detail())))).toEqual([
      'listing:default',
      'contract:success',
      'declaration:default',
      'proof:warning',
    ])
    expect(
      ids(registryFacts(note(), facts(detail({ issuer_verified: true }))))
    ).toContain('proof:success')
  })

  it('shows an asset the registry has never seen as not listed, with no claims about it', () => {
    const none = facts(detail({ contract_valid: null, issuer_signed: false }), {
      listed: null,
    })
    expect(ids(registryFacts(note({ listed: false }), none))).toEqual([
      'listing:muted',
      'declaration:muted',
    ])
  })

  it('warns when the maker calls the asset something else', () => {
    const f = registryFacts(note({ ticker_differs: 'USDT' }), undefined)
    expect(f).toEqual([
      { id: 'listing', tone: 'default', vars: { by: '' } },
      { id: 'tickerDiffers', tone: 'warning', vars: { ticker: 'USDT' } },
    ])
  })

  it('counts the larger of the shared-ticker figures', () => {
    const f = registryFacts(
      note({ same_ticker_listed: 3 }),
      facts(detail({ same_ticker: 1 }), { same_ticker_listed: 2 })
    )
    expect(f.find((x) => x.id === 'sameTicker')).toEqual({
      id: 'sameTicker',
      tone: 'warning',
      vars: { n: 3 },
    })
  })

  it('puts impersonation, disputes and an invalid contract in danger', () => {
    const f = registryFacts(
      note(),
      facts(
        detail({
          contract_valid: false,
          dispute: true,
          impersonation_warning: true,
        })
      )
    )
    expect(ids(f)).toEqual(
      expect.arrayContaining([
        'contract:danger',
        'impersonation:danger',
        'dispute:danger',
      ])
    )
  })

  it('names who lists it', () => {
    const f = registryFacts(
      note({ listed_by: ['kaleidoswap', 'other'] }),
      undefined
    )
    expect(f[0]).toEqual({
      id: 'listing',
      tone: 'default',
      vars: { by: 'kaleidoswap, other' },
    })
  })
})
