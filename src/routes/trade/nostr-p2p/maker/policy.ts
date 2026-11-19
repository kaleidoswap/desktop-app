/**
 * The signing policy screen's model: one rule per market in whole units and percentages, to and
 * from the `MarketRule` the signer checks (base units, basis points). The checks mirror
 * `src-tauri/src/maker/policy.rs`; the signer makes them again and is the one that counts.
 */

import type { BotMarket, MarketRule, SigningPolicy } from './makerApi'
import { fromBase, toBase, type StrategyForm } from './strategy'

export interface RuleForm {
  asset_id: string
  ticker: string
  precision: number
  sell: boolean
  buy: boolean
  refKind: 'fixed' | 'usd_peg'
  /** Sats per whole unit (fixed) or USD per unit (USD peg). */
  refValue: number
  bandPct: number
  maxSwap: number
  /** Most sats per swap; 0 for no limit. */
  maxSwapSat: number
  maxDailyNet: number
}

export const toRule = (r: RuleForm): MarketRule => ({
  asset_id: r.asset_id,
  band_bps: Math.round(r.bandPct * 100),
  buy: r.buy,
  max_daily_net_units: toBase(r.maxDailyNet, r.precision),
  max_swap_sat: r.maxSwapSat > 0 ? Math.round(r.maxSwapSat) : null,
  max_swap_units: toBase(r.maxSwap, r.precision),
  precision: r.precision,
  reference:
    r.refKind === 'fixed'
      ? { kind: 'fixed', sat_per_unit: r.refValue }
      : { kind: 'usd_peg', usd_per_unit: r.refValue },
  sell: r.sell,
  ticker: r.ticker.trim() || null,
})

export const fromRule = (m: MarketRule): RuleForm => ({
  asset_id: m.asset_id,
  bandPct: m.band_bps / 100,
  buy: m.buy,
  maxDailyNet: fromBase(m.max_daily_net_units, m.precision),
  maxSwap: fromBase(m.max_swap_units, m.precision),
  maxSwapSat: m.max_swap_sat ?? 0,
  precision: m.precision,
  refKind: m.reference.kind,
  refValue:
    m.reference.kind === 'fixed'
      ? m.reference.sat_per_unit
      : m.reference.usd_per_unit,
  sell: m.sell,
  ticker: m.ticker ?? '',
})

/**
 * A first rule for a market the strategy quotes: selling if it quotes asks (buying stays off: the
 * signer cannot yet check the asset a purchase delivers, so it trusts the host), its largest level as the
 * most per swap, its daily net cap (or ten swaps), and, for an issuer-set or fixed price, that
 * price and band as the reference.
 */
export function ruleFor(
  m: BotMarket,
  form?: Pick<StrategyForm, 'priceKind' | 'bandPct' | 'ticker'>
): RuleForm {
  const unit = (b: number) => fromBase(b, m.precision)
  const largest =
    Math.max(m.ask_amount, m.bid_amount) * m.size_growth ** (m.levels - 1)
  const maxSwap = unit(Math.ceil(largest))
  return {
    asset_id: m.asset_id,
    bandPct: form?.priceKind === 'issuer' ? form.bandPct : 2,
    // a purchase trusts the host's check of the asset delivered: off until the user opts in
    buy: false,
    maxDailyNet: m.max_daily_net != null ? unit(m.max_daily_net) : maxSwap * 10,
    maxSwap,
    maxSwapSat: 0,
    precision: m.precision,
    refKind: 'fixed',
    refValue: m.price.source === 'fixed' ? m.price.sat_per_unit : 0,
    sell: m.ask_amount > 0,
    ticker: form?.ticker ?? '',
  }
}

/** What is wrong with a rule, as i18n keys under `p2pMaker.policy.errors`. */
export function ruleErrors(r: RuleForm): string[] {
  const out: string[] = []
  if (!r.sell && !r.buy) out.push('sides')
  if (!(r.refValue > 0)) out.push('reference')
  if (!(r.bandPct >= 0.01 && r.bandPct <= 50)) out.push('band')
  if (!(toBase(r.maxSwap, r.precision) > 0)) out.push('maxSwap')
  if (!(r.maxDailyNet >= 0)) out.push('maxDailyNet')
  if (!(r.maxSwapSat >= 0)) out.push('maxSwapSat')
  return out
}

export const buildPolicy = (
  network: string,
  makerNpub: string,
  rules: RuleForm[]
): SigningPolicy => ({
  maker_npub: makerNpub,
  markets: rules.map(toRule),
  network,
  version: 1,
})

/** Policies are compared as the signer sees them, so an unchanged form is not signed again. */
export const samePolicy = (a: SigningPolicy, b: SigningPolicy): boolean =>
  canonical(a) === canonical(b)

const canonical = (v: unknown): string =>
  Array.isArray(v)
    ? `[${v.map(canonical).join(',')}]`
    : v && typeof v === 'object'
      ? `{${Object.keys(v)
          .sort()
          .map(
            (k) =>
              `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`
          )
          .join(',')}}`
      : JSON.stringify(v ?? null)
