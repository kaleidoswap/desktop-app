import { Pause, Play, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '../../../../components/ui'
import type { Order } from '../api'
import { short, tickerOf } from '../format'
import { cx, EmptyState, Panel, Pill, Slider } from '../market/ui'

import { LadderPreview } from './LadderPreview'
import {
  tenant,
  type BotState,
  type MakerBackend,
  type MakerView,
} from './makerApi'
import {
  ChoiceCard,
  errorText,
  NumField,
  SectionTitle,
  TextField,
  Toggle,
  useMk,
} from './parts'
import {
  defaultForm,
  fromBotMarket,
  readPriceHints,
  savePriceHint,
  strategyErrors,
  toBotMarket,
  withMarket,
  withoutMarket,
  type PriceKind,
  type StrategyForm,
} from './strategy'

export interface Asset {
  asset_id: string
  ticker: string
  precision: number
}

/** The middle of the other makers' best quotes, in sats per whole unit. */
function bookMid(book: Order[], assetId: string): number {
  const of = book.filter((o) => o.asset_id === assetId && !o.mine)
  const asks = of.filter((o) => o.side === 'sell').map((o) => o.unit_price)
  const bids = of.filter((o) => o.side === 'buy').map((o) => o.unit_price)
  const ask = asks.length ? Math.min(...asks) : 0
  const bid = bids.length ? Math.max(...bids) : 0
  return ask && bid ? (ask + bid) / 2 : ask || bid
}

/** Screen 2: the markets the maker quotes, their reference price, ladder and risk limits. */
export function StrategyScreen({
  backend,
  view,
  onNext,
  seed,
}: {
  backend: MakerBackend
  view: MakerView
  onNext: () => void
  /** An asset just minted for launch: open it with an issuer-set price and asks only. */
  seed?: Asset | null
}) {
  const tm = useMk()
  const api = useMemo(() => tenant(backend), [backend])
  const [state, setState] = useState<BotState | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [book, setBook] = useState<Order[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [form, setForm] = useState<StrategyForm | null>(null)
  const [adding, setAdding] = useState(false)
  const [newAsset, setNewAsset] = useState<Asset>({
    asset_id: '',
    precision: 0,
    ticker: '',
  })
  const [previewAt, setPreviewAt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const s = await api.bot()
      setState(s)
      return s
    } catch (e) {
      setError(errorText(e))
      return null
    }
  }, [api])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().then((s) => {
      const first = s?.config.markets[0]?.asset_id
      if (first) setSelected((cur) => cur ?? first)
    })
    // what the maker holds and what the book trades: the assets worth offering
    api
      .balance()
      .then((b) =>
        setAssets((cur) =>
          merge(
            cur,
            b.assets.map((a) => ({ ...a }))
          )
        )
      )
      .catch(() => {})
    api
      .book()
      .then((orders) => {
        setBook(orders)
        setAssets((cur) =>
          merge(
            cur,
            orders.map((o) => ({
              asset_id: o.asset_id,
              precision: o.precision,
              ticker: tickerOf(o),
            }))
          )
        )
      })
      .catch(() => {})
  }, [api, load])

  const tickerFor = useCallback(
    (id: string) => assets.find((a) => a.asset_id === id)?.ticker ?? '',
    [assets]
  )

  // the form follows the selected market as the maker has it; a pause or resume does not reset
  // what is being edited, only a different market or a changed config does
  const savedMarket = JSON.stringify(
    state?.config.markets.find((x) => x.asset_id === selected) ?? null
  )
  const selectedTicker = selected ? tickerFor(selected) : ''
  useEffect(() => {
    const m = JSON.parse(savedMarket)
    if (!m || !selected) return
    const hint = readPriceHints()[selected]
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(
      fromBotMarket(m, {
        bandPct: hint?.bandPct,
        kind: hint?.kind,
        ticker: selectedTicker,
      })
    )
  }, [savedMarket, selected, selectedTicker])

  // the preview sits at the fixed price, or for a feed at the book's middle until the user moves it
  const formAsset = form?.asset_id
  const formKind = form?.priceKind
  const formPrice = form?.satPerUnit
  useEffect(() => {
    if (!formAsset) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviewAt(
      formKind === 'feed' ? bookMid(book, formAsset) : (formPrice ?? 0)
    )
  }, [formAsset, formKind, formPrice, book])

  const set = (patch: Partial<StrategyForm>) => {
    setForm((f) => (f ? { ...f, ...patch } : f))
    setSaved(false)
  }

  const apply = async () => {
    if (!form || !state) return
    setBusy(true)
    setError(null)
    try {
      const next = await api.putBot(withMarket(state.config, toBotMarket(form)))
      savePriceHint(form)
      setState(next)
      setSaved(true)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!form || !state) return
    setBusy(true)
    setError(null)
    try {
      const next = await api.putBot(withoutMarket(state.config, form.asset_id))
      setState(next)
      setSelected(next.config.markets[0]?.asset_id ?? null)
      setForm(null)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const togglePause = async () => {
    if (!state) return
    setBusy(true)
    try {
      setState(await (state.paused ? api.resume() : api.pause()))
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  // a launched token: its own market if the maker has one, else a new issuer-set, sell-only one
  const seedId = seed?.asset_id
  const loaded = !!state
  useEffect(() => {
    if (!seed || !loaded) return
    const known = state?.config.markets.some(
      (m) => m.asset_id === seed.asset_id
    )
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(seed.asset_id)
    if (!known) {
      setForm({ ...defaultForm(seed), bidSize: 0, priceKind: 'issuer' })
      setSaved(false)
    }
    // run once per seed, when the maker's config is in
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedId, loaded])

  const startNew = (a: Asset) => {
    if (!a.asset_id.startsWith('rgb:')) return
    setForm(defaultForm(a))
    setSelected(a.asset_id)
    setAdding(false)
    setSaved(false)
  }

  if (!state) {
    return (
      <Panel>
        <EmptyState
          description={error ?? undefined}
          title={error ? tm('strategy.unreachable') : tm('common.loading')}
        />
      </Panel>
    )
  }

  const errors = form ? strategyErrors(form) : []
  const configured = state.config.markets
  const isNew = !!form && !configured.some((m) => m.asset_id === form.asset_id)
  const ticker = form?.ticker || tm('common.units')

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <div className="flex flex-wrap items-center gap-2">
          <SectionTitle hint={tm('strategy.hint')}>
            {tm('strategy.title')}
          </SectionTitle>
          <div className="ml-auto flex items-center gap-2">
            <Pill tone={state.paused ? 'warning' : 'success'}>
              {state.paused ? tm('common.paused') : tm('common.quoting')}
            </Pill>
            <Button
              disabled={busy}
              icon={state.paused ? <Play size={14} /> : <Pause size={14} />}
              onClick={() => void togglePause()}
              size="sm"
              variant="outline"
            >
              {state.paused ? tm('common.resume') : tm('common.pause')}
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="tablist">
          {configured.map((m) => (
            <button
              aria-selected={selected === m.asset_id}
              className={cx(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                selected === m.asset_id
                  ? 'bg-surface-raised text-content-primary'
                  : 'bg-surface-inset text-content-tertiary hover:text-content-secondary'
              )}
              key={m.asset_id}
              onClick={() => {
                setSelected(m.asset_id)
                setSaved(false)
              }}
              role="tab"
              type="button"
            >
              {tickerFor(m.asset_id) || short(m.asset_id, 8)}
            </button>
          ))}
          {isNew && form && (
            <span className="rounded-lg bg-primary/15 px-3 py-1.5 text-sm font-medium text-primary">
              {form.ticker || short(form.asset_id, 8)} · {tm('strategy.new')}
            </span>
          )}
          <Button
            icon={<Plus size={14} />}
            onClick={() => setAdding((a) => !a)}
            size="sm"
            variant="ghost"
          >
            {tm('strategy.addMarket')}
          </Button>
        </div>
        {adding && (
          <div className="mt-3 flex flex-col gap-3 rounded-xl bg-surface-inset/50 p-3">
            {assets.filter(
              (a) => !configured.some((m) => m.asset_id === a.asset_id)
            ).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {assets
                  .filter(
                    (a) => !configured.some((m) => m.asset_id === a.asset_id)
                  )
                  .map((a) => (
                    <Button
                      key={a.asset_id}
                      onClick={() => startNew(a)}
                      size="sm"
                      variant="outline"
                    >
                      {a.ticker || short(a.asset_id, 8)}
                    </Button>
                  ))}
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
              <TextField
                id="maker-new-asset"
                label={tm('strategy.assetId')}
                mono
                onChange={(v) =>
                  setNewAsset((a) => ({ ...a, asset_id: v.trim() }))
                }
                placeholder="rgb:…"
                value={newAsset.asset_id}
              />
              <TextField
                id="maker-new-ticker"
                label={tm('strategy.ticker')}
                onChange={(v) => setNewAsset((a) => ({ ...a, ticker: v }))}
                value={newAsset.ticker}
              />
              <NumField
                id="maker-new-precision"
                label={tm('strategy.precision')}
                onChange={(v) =>
                  setNewAsset((a) => ({
                    ...a,
                    precision: Math.max(0, Math.min(18, Math.round(v))),
                  }))
                }
                value={newAsset.precision}
              />
              <Button
                disabled={!newAsset.asset_id.startsWith('rgb:')}
                onClick={() => startNew(newAsset)}
                size="sm"
              >
                {tm('strategy.add')}
              </Button>
            </div>
          </div>
        )}
      </Panel>

      {!form ? (
        <Panel>
          <EmptyState
            description={tm('strategy.emptyHint')}
            title={tm('strategy.empty')}
          />
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          <div className="flex flex-col gap-4">
            <Panel>
              <div className="flex flex-col gap-3">
                <SectionTitle hint={tm('strategy.priceHint')}>
                  {tm('strategy.price')}
                </SectionTitle>
                <div className="grid gap-2 md:grid-cols-3">
                  {(['feed', 'fixed', 'issuer'] as PriceKind[]).map((k) => (
                    <ChoiceCard
                      key={k}
                      onSelect={() => set({ priceKind: k })}
                      selected={form.priceKind === k}
                      title={tm(`strategy.kind.${k}`)}
                    >
                      {tm(`strategy.kind.${k}Hint`)}
                    </ChoiceCard>
                  ))}
                </div>
                {form.priceKind === 'feed' ? (
                  <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
                    <TextField
                      hint={tm('strategy.feedPathHint')}
                      id="maker-feed-path"
                      label={tm('strategy.feedPath')}
                      mono
                      onChange={(v) => set({ feedPath: v })}
                      value={form.feedPath}
                    />
                    <NumField
                      id="maker-feed-age"
                      label={tm('strategy.feedMaxAge')}
                      onChange={(v) => set({ feedMaxAgeSecs: Math.round(v) })}
                      suffix="s"
                      value={form.feedMaxAgeSecs}
                    />
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    <NumField
                      id="maker-fixed-price"
                      invalid={errors.includes('price')}
                      label={tm('strategy.satPerUnit', { ticker })}
                      onChange={(v) => set({ satPerUnit: v })}
                      suffix="sat"
                      value={form.satPerUnit}
                    />
                    {form.priceKind === 'issuer' && (
                      <NumField
                        hint={tm('strategy.bandHint')}
                        id="maker-band"
                        invalid={errors.includes('band')}
                        label={tm('strategy.band')}
                        onChange={(v) => set({ bandPct: v })}
                        suffix="%"
                        value={form.bandPct}
                      />
                    )}
                  </div>
                )}
              </div>
            </Panel>

            <Panel>
              <div className="flex flex-col gap-4">
                <SectionTitle hint={tm('strategy.ladderHint')}>
                  {tm('strategy.ladder')}
                </SectionTitle>
                <Slider
                  label={tm('strategy.distance')}
                  max={500}
                  min={10}
                  onChange={(v) => set({ distanceBps: v })}
                  readout={`${(form.distanceBps / 100).toFixed(2)}%`}
                  step={5}
                  value={form.distanceBps}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <Slider
                    label={tm('strategy.levels')}
                    max={10}
                    min={1}
                    onChange={(v) => set({ levels: v })}
                    readout={String(form.levels)}
                    value={form.levels}
                  />
                  <Slider
                    label={tm('strategy.step')}
                    max={300}
                    min={0}
                    onChange={(v) => set({ stepBps: v })}
                    readout={`${(form.stepBps / 100).toFixed(2)}%`}
                    step={5}
                    value={form.stepBps}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <NumField
                    id="maker-ask-size"
                    invalid={errors.includes('size')}
                    label={tm('strategy.askSize')}
                    onChange={(v) => set({ askSize: v })}
                    suffix={ticker}
                    value={form.askSize}
                  />
                  <NumField
                    id="maker-bid-size"
                    invalid={errors.includes('size')}
                    label={tm('strategy.bidSize')}
                    onChange={(v) => set({ bidSize: v })}
                    suffix={ticker}
                    value={form.bidSize}
                  />
                  <NumField
                    id="maker-growth"
                    invalid={errors.includes('growth')}
                    label={tm('strategy.growth')}
                    onChange={(v) => set({ growth: v })}
                    suffix="×"
                    value={form.growth}
                  />
                </div>
              </div>
            </Panel>

            <Panel>
              <div className="flex flex-col gap-4">
                <SectionTitle hint={tm('strategy.riskHint')}>
                  {tm('strategy.risk')}
                </SectionTitle>
                <Toggle
                  checked={form.skew.on}
                  description={tm('strategy.skewHint')}
                  label={tm('strategy.skew')}
                  onChange={(on) => set({ skew: { ...form.skew, on } })}
                />
                {form.skew.on && (
                  <div className="grid gap-3 pl-12 md:grid-cols-3">
                    <NumField
                      id="maker-skew-target"
                      label={tm('strategy.skewTarget')}
                      onChange={(v) =>
                        set({ skew: { ...form.skew, target: v } })
                      }
                      suffix={ticker}
                      value={form.skew.target}
                    />
                    <NumField
                      id="maker-skew-range"
                      invalid={errors.includes('skewRange')}
                      label={tm('strategy.skewRange')}
                      onChange={(v) =>
                        set({ skew: { ...form.skew, range: v } })
                      }
                      suffix={ticker}
                      value={form.skew.range}
                    />
                    <NumField
                      id="maker-skew-max"
                      invalid={errors.includes('skewMax')}
                      label={tm('strategy.skewMax')}
                      onChange={(v) =>
                        set({
                          skew: { ...form.skew, maxBps: Math.round(v * 100) },
                        })
                      }
                      suffix="%"
                      value={form.skew.maxBps / 100}
                    />
                  </div>
                )}
                <Toggle
                  checked={form.breaker.on}
                  description={tm('strategy.breakerHint')}
                  label={tm('strategy.breaker')}
                  onChange={(on) => set({ breaker: { ...form.breaker, on } })}
                />
                {form.breaker.on && (
                  <div className="grid gap-3 pl-12 md:grid-cols-2">
                    <NumField
                      id="maker-breaker-move"
                      invalid={errors.includes('breaker')}
                      label={tm('strategy.breakerMove')}
                      onChange={(v) =>
                        set({
                          breaker: {
                            ...form.breaker,
                            moveBps: Math.round(v * 100),
                          },
                        })
                      }
                      suffix="%"
                      value={form.breaker.moveBps / 100}
                    />
                    <NumField
                      id="maker-breaker-cooldown"
                      label={tm('strategy.breakerCooldown')}
                      onChange={(v) =>
                        set({
                          breaker: {
                            ...form.breaker,
                            cooldownSecs: Math.round(v),
                          },
                        })
                      }
                      suffix="s"
                      value={form.breaker.cooldownSecs}
                    />
                  </div>
                )}
                <Toggle
                  checked={form.dailyNet.on}
                  description={tm('strategy.dailyNetHint')}
                  label={tm('strategy.dailyNet')}
                  onChange={(on) => set({ dailyNet: { ...form.dailyNet, on } })}
                />
                {form.dailyNet.on && (
                  <div className="grid gap-3 pl-12 md:grid-cols-2">
                    <NumField
                      id="maker-daily-net"
                      invalid={errors.includes('dailyNet')}
                      label={tm('strategy.dailyNetUnits')}
                      onChange={(v) =>
                        set({ dailyNet: { on: true, units: v } })
                      }
                      suffix={ticker}
                      value={form.dailyNet.units}
                    />
                  </div>
                )}
              </div>
            </Panel>
          </div>

          <div className="flex flex-col gap-4">
            <Panel className="lg:sticky lg:top-4">
              <div className="flex flex-col gap-3">
                <SectionTitle hint={tm('strategy.previewHint')}>
                  {tm('strategy.preview')}
                </SectionTitle>
                {form.priceKind === 'feed' && (
                  <NumField
                    hint={tm('strategy.previewAtHint')}
                    id="maker-preview-at"
                    label={tm('strategy.previewAt', { ticker })}
                    onChange={setPreviewAt}
                    suffix="sat"
                    value={Math.round(previewAt * 1e4) / 1e4}
                  />
                )}
                <LadderPreview form={form} reference={previewAt} />
                {errors.length > 0 && (
                  <ul className="flex flex-col gap-1 rounded-xl bg-status-danger-subtle p-3 text-caption text-status-danger">
                    {errors.map((e) => (
                      <li key={e}>{tm(`strategy.errors.${e}`)}</li>
                    ))}
                  </ul>
                )}
                {error && (
                  <p className="text-caption text-status-danger">{error}</p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    disabled={busy || errors.length > 0}
                    isLoading={busy}
                    onClick={() => void apply()}
                  >
                    {view.mode === 'hosted'
                      ? tm('strategy.applyHosted')
                      : tm('strategy.apply')}
                  </Button>
                  {!isNew && (
                    <Button
                      disabled={busy}
                      icon={<Trash2 size={14} />}
                      onClick={() => void remove()}
                      size="sm"
                      variant="ghost"
                    >
                      {tm('strategy.remove')}
                    </Button>
                  )}
                  {saved && <Pill tone="success">{tm('strategy.saved')}</Pill>}
                </div>
                {saved && view.mode === 'hosted' && (
                  <Button onClick={onNext} size="sm" variant="outline">
                    {tm('strategy.toPolicy')}
                  </Button>
                )}
              </div>
            </Panel>
          </div>
        </div>
      )}
    </div>
  )
}

function merge(cur: Asset[], more: Asset[]): Asset[] {
  const byId = new Map(cur.map((a) => [a.asset_id, a]))
  for (const a of more) {
    const known = byId.get(a.asset_id)
    if (!known || (!known.ticker && a.ticker)) byId.set(a.asset_id, a)
  }
  return [...byId.values()]
}
