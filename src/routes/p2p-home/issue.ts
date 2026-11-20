import { toBase } from '../trade/nostr-p2p/format'

/** The kinds of RGB asset the trading wallet can issue. */
export type AssetKind = 'NIA' | 'IFA' | 'CFA' | 'UDA'

export interface IssueForm {
  kind: AssetKind
  ticker: string
  name: string
  details: string
  precision: number
  /** Supply as typed, in whole units (decimals allowed up to `precision`). */
  supply: string
  /** Coins the supply is split into: more coins, more swaps at once. */
  parts: number
  /** IFA only: how much more can be minted later, in whole units. */
  inflation: string
  /** CFA and UDA: a file on this computer shown with the asset. */
  mediaPath: string | null
}

export const emptyForm = (kind: AssetKind = 'NIA'): IssueForm => ({
  details: '',
  inflation: '',
  kind,
  mediaPath: null,
  name: '',
  parts: kind === 'UDA' ? 1 : 5,
  precision: kind === 'UDA' ? 0 : 2,
  supply: kind === 'UDA' ? '1' : '',
  ticker: '',
})

/** What each kind needs from the form. */
export const needs = (kind: AssetKind) => ({
  details: kind === 'CFA' || kind === 'UDA',
  inflation: kind === 'IFA',
  media: kind === 'CFA' || kind === 'UDA',
  supply: kind !== 'UDA',
  ticker: kind !== 'CFA',
})

export const MAX_PARTS = 20

/** A ticker an RGB asset takes: 1 to 8 capital letters or digits, starting with a letter. */
export const tickerOk = (t: string) => /^[A-Z][A-Z0-9]{0,7}$/.test(t)

/** The supply spread over `parts` coins (base units), the remainder on the first. */
export function splitSupply(total: number, parts: number): number[] {
  const n = Math.max(1, Math.min(MAX_PARTS, Math.floor(parts)))
  const each = Math.floor(total / n)
  if (each === 0) return [total]
  const out = Array<number>(n).fill(each)
  out[0] += total - each * n
  return out
}

export type IssueProblem =
  'ticker' | 'name' | 'supply' | 'too_big' | 'inflation' | 'media' | null

/** The first thing wrong with the form, or null when it can be issued. */
export function checkForm(f: IssueForm): IssueProblem {
  const n = needs(f.kind)
  if (n.ticker && !tickerOk(f.ticker)) return 'ticker'
  if (!f.name.trim() || f.name.trim().length > 40) return 'name'
  if (n.supply) {
    const base = toBase(f.supply, f.precision)
    if (!(base > 0)) return 'supply'
    if (!Number.isSafeInteger(base)) return 'too_big'
  }
  if (n.inflation && f.inflation.trim()) {
    const extra = toBase(f.inflation, f.precision)
    if (!Number.isSafeInteger(extra) || extra < 0) return 'inflation'
  }
  if (f.kind === 'UDA' && !f.mediaPath) return 'media'
  return null
}

/** The daemon route and body for the form; call only once `checkForm` passes. */
export function issueRequest(f: IssueForm): { path: string; body: unknown } {
  const name = f.name.trim()
  const details = f.details.trim() || null
  const amounts = splitSupply(toBase(f.supply, f.precision), f.parts)
  switch (f.kind) {
    case 'NIA':
      return {
        body: { amounts, name, precision: f.precision, ticker: f.ticker },
        path: '/api/rln/issueassetnia',
      }
    case 'IFA': {
      const extra = f.inflation.trim() ? toBase(f.inflation, f.precision) : 0
      return {
        body: {
          amounts,
          inflation_amounts: extra > 0 ? [extra] : [],
          name,
          precision: f.precision,
          reject_list_url: null,
          ticker: f.ticker,
        },
        path: '/api/rln/issueassetifa',
      }
    }
    case 'CFA':
      return {
        body: {
          amounts,
          details,
          file_path: f.mediaPath,
          name,
          precision: f.precision,
        },
        path: '/api/rln/issueassetcfa',
      }
    case 'UDA':
      return {
        body: {
          attachments_file_paths: [],
          details,
          media_file_path: f.mediaPath,
          name,
          precision: 0,
          ticker: f.ticker,
        },
        path: '/api/rln/issueassetuda',
      }
  }
}
