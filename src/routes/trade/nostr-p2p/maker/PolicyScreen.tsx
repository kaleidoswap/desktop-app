import { Fingerprint, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '../../../../components/ui'
import { fmtPrice, short } from '../format'
import { EmptyState, Panel, Pill } from '../market/ui'

import { tenant, type MakerBackend, type MakerView } from './makerApi'
import {
  dateTime,
  errorText,
  NumField,
  SectionTitle,
  Toggle,
  useMk,
} from './parts'
import {
  buildPolicy,
  fromRule,
  ruleErrors,
  ruleFor,
  samePolicy,
  type RuleForm,
} from './policy'
import { readPriceHints } from './strategy'

/**
 * Screen 3 (hosted only): what the signer in this app agrees to sign. Signed with the signer's key
 * after Touch ID where the OS has it; anything outside it is refused even if the maker asks.
 */
export function PolicyScreen({
  backend,
  view,
  onView,
  onNext,
}: {
  backend: MakerBackend
  view: MakerView
  onView: (v: MakerView) => void
  onNext: () => void
}) {
  const tm = useMk()
  const makerNpub = view.endpoint?.maker_npub ?? ''
  const [rules, setRules] = useState<RuleForm[] | null>(null)
  const [btcUsd, setBtcUsd] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // start from the signed policy when it is for this maker, else from what the strategy quotes
  useEffect(() => {
    let live = true
    const signed = view.policy?.policy
    const api = tenant(backend)
    Promise.all([
      api.bot(),
      api.book().catch(() => []),
      api.balance().catch(() => null),
    ])
      .then(([s, book, balance]) => {
        if (!live) return
        const hints = readPriceHints()
        const tickers = new Map<string, string>()
        for (const o of book) if (o.ticker) tickers.set(o.asset_id, o.ticker)
        for (const a of balance?.assets ?? [])
          if (a.ticker) tickers.set(a.asset_id, a.ticker)
        const fromSigned =
          signed && signed.maker_npub === makerNpub
            ? signed.markets.map(fromRule)
            : []
        const known = new Set(fromSigned.map((r) => r.asset_id))
        const fresh = s.config.markets
          .filter((m) => !known.has(m.asset_id))
          .map((m) =>
            ruleFor(m, {
              bandPct: hints[m.asset_id]?.bandPct ?? 2,
              priceKind: hints[m.asset_id]?.kind ?? 'fixed',
              ticker: tickers.get(m.asset_id) ?? '',
            })
          )
        setRules([...fromSigned, ...fresh])
      })
      .catch((e) => {
        if (!live) return
        setError(errorText(e))
        setRules(signed ? signed.markets.map(fromRule) : [])
      })
    return () => {
      live = false
    }
    // the policy as loaded is the starting point; later signing does not reset the form
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, makerNpub])

  const needsUsd = rules?.some((r) => r.refKind === 'usd_peg') ?? false
  useEffect(() => {
    if (!needsUsd) return
    backend
      .btcUsd()
      .then(setBtcUsd)
      .catch(() => setBtcUsd(null))
  }, [backend, needsUsd])

  const draft = useMemo(
    () => (rules ? buildPolicy(view.network, makerNpub, rules) : null),
    [rules, view.network, makerNpub]
  )
  const inForce = view.policy && !view.policy_error ? view.policy : null
  const unchanged = !!draft && !!inForce && samePolicy(draft, inForce.policy)
  const problems = (rules ?? []).flatMap((r) =>
    ruleErrors(r).map(
      (e) => `${r.ticker || short(r.asset_id, 8)}: ${tm(`policy.errors.${e}`)}`
    )
  )

  const update = (i: number, patch: Partial<RuleForm>) =>
    setRules((rs) => rs && rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  const sign = async () => {
    if (!draft) return
    setBusy(true)
    setError(null)
    try {
      onView(await backend.signPolicy(draft))
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <div className="flex flex-col gap-3 md:flex-row md:items-start">
          <ShieldCheck className="shrink-0 text-primary" size={28} />
          <div className="flex flex-col gap-1">
            <h3 className="text-subhead font-semibold text-content-primary">
              {tm('policy.title')}
            </h3>
            <p className="text-body text-content-secondary">
              {tm('policy.explain')}
            </p>
            <p className="text-caption text-content-tertiary">
              {tm('policy.explainKeys')}
            </p>
            <p className="text-caption text-content-tertiary">
              {tm('policy.salesState')}
            </p>
            <p className="text-caption text-status-warning">
              {tm('policy.beta')}
            </p>
          </div>
        </div>
      </Panel>

      {rules === null ? (
        <Panel>
          <EmptyState title={tm('common.loading')} />
        </Panel>
      ) : rules.length === 0 ? (
        <Panel>
          <EmptyState
            description={tm('policy.emptyHint')}
            title={tm('policy.empty')}
          />
        </Panel>
      ) : (
        rules.map((r, i) => {
          const name = r.ticker || short(r.asset_id, 8)
          const refSat =
            r.refKind === 'fixed'
              ? r.refValue
              : btcUsd
                ? (r.refValue / btcUsd) * 1e8
                : null
          return (
            <Panel key={r.asset_id}>
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <SectionTitle
                    hint={
                      <span className="font-mono">{short(r.asset_id, 14)}</span>
                    }
                  >
                    {name}
                  </SectionTitle>
                  <Button
                    className="ml-auto"
                    onClick={() =>
                      setRules((rs) => rs && rs.filter((_, j) => j !== i))
                    }
                    size="sm"
                    variant="ghost"
                  >
                    {tm('policy.removeMarket')}
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Toggle
                    checked={r.sell}
                    description={tm('policy.sellHint', { ticker: name })}
                    label={tm('policy.sell', { ticker: name })}
                    onChange={(sell) => update(i, { sell })}
                  />
                  <Toggle
                    checked={r.buy}
                    description={tm('policy.buyHint', { ticker: name })}
                    label={tm('policy.buy', { ticker: name })}
                    onChange={(buy) => update(i, { buy })}
                  />
                </div>
                {r.buy && (
                  <p className="rounded-xl bg-status-warning-subtle p-3 text-caption text-status-warning">
                    {tm('policy.buyTrust')}
                  </p>
                )}
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <label
                      className="text-caption text-content-secondary"
                      htmlFor={`policy-ref-${i}`}
                    >
                      {tm('policy.reference')}
                    </label>
                    <select
                      className="rounded-xl bg-surface-inset px-3 py-3 text-body text-content-primary outline-none"
                      id={`policy-ref-${i}`}
                      onChange={(e) =>
                        update(i, {
                          refKind: e.target.value as RuleForm['refKind'],
                          refValue: e.target.value === 'usd_peg' ? 1 : 0,
                        })
                      }
                      value={r.refKind}
                    >
                      <option value="fixed">{tm('policy.refFixed')}</option>
                      <option value="usd_peg">{tm('policy.refUsd')}</option>
                    </select>
                  </div>
                  <NumField
                    hint={
                      r.refKind === 'usd_peg'
                        ? refSat
                          ? tm('policy.usdNow', { sat: fmtPrice(refSat) })
                          : tm('policy.usdUnknown')
                        : undefined
                    }
                    id={`policy-ref-value-${i}`}
                    label={
                      r.refKind === 'fixed'
                        ? tm('policy.satPerUnit', { ticker: name })
                        : tm('policy.usdPerUnit', { ticker: name })
                    }
                    onChange={(refValue) => update(i, { refValue })}
                    suffix={r.refKind === 'fixed' ? 'sat' : 'USD'}
                    value={r.refValue}
                  />
                  <NumField
                    hint={
                      refSat
                        ? tm('policy.bandRange', {
                            buy: fmtPrice(refSat * (1 + r.bandPct / 100)),
                            sell: fmtPrice(refSat * (1 - r.bandPct / 100)),
                          })
                        : undefined
                    }
                    id={`policy-band-${i}`}
                    label={tm('policy.band')}
                    onChange={(bandPct) => update(i, { bandPct })}
                    suffix="%"
                    value={r.bandPct}
                  />
                  <NumField
                    id={`policy-max-swap-${i}`}
                    label={tm('policy.maxSwap')}
                    onChange={(maxSwap) => update(i, { maxSwap })}
                    suffix={name}
                    value={r.maxSwap}
                  />
                  <NumField
                    hint={tm('policy.maxSwapSatHint')}
                    id={`policy-max-swap-sat-${i}`}
                    label={tm('policy.maxSwapSat')}
                    onChange={(maxSwapSat) => update(i, { maxSwapSat })}
                    suffix="sat"
                    value={r.maxSwapSat}
                  />
                  <NumField
                    hint={tm('policy.maxDailyNetHint')}
                    id={`policy-max-day-${i}`}
                    label={tm('policy.maxDailyNet')}
                    onChange={(maxDailyNet) => update(i, { maxDailyNet })}
                    suffix={name}
                    value={r.maxDailyNet}
                  />
                </div>
              </div>
            </Panel>
          )
        })
      )}

      <Panel>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {view.policy_error ? (
              <Pill tone="danger">
                <ShieldAlert size={12} /> {view.policy_error}
              </Pill>
            ) : inForce ? (
              <Pill tone={unchanged ? 'success' : 'warning'}>
                {unchanged
                  ? tm('policy.inForce', { when: dateTime(inForce.signed_at) })
                  : tm('policy.changed')}
              </Pill>
            ) : (
              <Pill tone="warning">{tm('policy.unsigned')}</Pill>
            )}
            <span className="text-caption text-content-tertiary">
              {tm('policy.signerKey')}{' '}
              <span className="font-mono">{short(view.signer_npub, 10)}</span>
            </span>
          </div>
          {problems.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-xl bg-status-danger-subtle p-3 text-caption text-status-danger">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          {error && <p className="text-caption text-status-danger">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={
                busy || !rules?.length || problems.length > 0 || unchanged
              }
              icon={view.biometric ? <Fingerprint size={16} /> : undefined}
              isLoading={busy}
              onClick={() => void sign()}
            >
              {view.biometric ? tm('policy.signTouchId') : tm('policy.sign')}
            </Button>
            {inForce && (
              <Button onClick={onNext} variant="outline">
                {tm('policy.toLive')}
              </Button>
            )}
          </div>
        </div>
      </Panel>
    </div>
  )
}
