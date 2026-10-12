import type { AssetFacts, RegistryNote } from '../api'

export type FactTone = 'success' | 'default' | 'muted' | 'warning' | 'danger'

export type FactId =
  | 'listing'
  | 'tickerDiffers'
  | 'contract'
  | 'declaration'
  | 'proof'
  | 'sameTicker'
  | 'impersonation'
  | 'dispute'
  | 'contested'

export interface Fact {
  id: FactId
  tone: FactTone
  vars?: Record<string, string | number>
}

/**
 * What the registry published about an asset, as separate facts in the order they matter. None of
 * them is a verdict: a signed declaration does not make the signer the issuer, and the absence of
 * a warning does not make an asset safe. Nothing is returned when the daemon reads no registry.
 *
 * @param note   what came with the order, next to the maker's own ticker
 * @param facts  what was asked of the index for this asset; `undefined` while it is still loading
 */
export function registryFacts(
  note: RegistryNote | null,
  facts: AssetFacts | null | undefined
): Fact[] {
  if (facts === null || (facts === undefined && note === null)) return []
  const out: Fact[] = []
  const listed = facts?.listed ?? null
  const by = (listed?.listed_by ?? note?.listed_by ?? []).join(', ')
  out.push(
    listed || note?.listed
      ? { id: 'listing', tone: 'default', vars: { by } }
      : { id: 'listing', tone: 'muted', vars: { by: '' } }
  )
  if (note?.ticker_differs) {
    out.push({
      id: 'tickerDiffers',
      tone: 'warning',
      vars: { ticker: note.ticker_differs },
    })
  }
  const d = facts?.detail
  if (!d) return out

  if (d.contract_valid === true) out.push({ id: 'contract', tone: 'success' })
  if (d.contract_valid === false) out.push({ id: 'contract', tone: 'danger' })

  if (d.issuer_signed) {
    out.push({
      id: 'declaration',
      tone: 'default',
      vars: { address: d.issuer_address ?? '' },
    })
    out.push(
      d.issuer_verified
        ? { id: 'proof', tone: 'success' }
        : { id: 'proof', tone: 'warning' }
    )
  } else {
    out.push({ id: 'declaration', tone: 'muted', vars: { address: '' } })
  }

  const same = Math.max(
    d.same_ticker,
    facts?.same_ticker_listed ?? 0,
    note?.same_ticker_listed ?? 0
  )
  if (same > 0)
    out.push({ id: 'sameTicker', tone: 'warning', vars: { n: same } })
  if (d.impersonation_warning) out.push({ id: 'impersonation', tone: 'danger' })
  if (d.dispute) out.push({ id: 'dispute', tone: 'danger' })
  if (d.contested_by > 0)
    out.push({ id: 'contested', tone: 'warning', vars: { n: d.contested_by } })
  return out
}
