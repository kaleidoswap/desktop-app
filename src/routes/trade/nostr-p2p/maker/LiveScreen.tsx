import { Pause, Play, Power, Radio } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '../../../../components/ui'
import type { Order, Trade } from '../api'
import { ago, fmtPrice, fmtSats, fmtUnits, short, tickerOf } from '../format'
import { usePoll } from '../market/hooks'
import { cx, EmptyState, Panel, Pill, type Tone } from '../market/ui'

import {
  tenant,
  type JournalEntry,
  type MakerBackend,
  type MakerView,
} from './makerApi'
import { dateTime, errorText, SectionTitle, useMk } from './parts'

const LIVE = new Set(['open', 'matching'])
const FILLED = new Set(['broadcast', 'settled'])

/** Start of the current UTC day, in unix seconds: fills and usage count by UTC day. */
export const utcDayStart = (nowMs = Date.now()) =>
  Math.floor(nowMs / 86_400_000) * 86_400

export const openQuotes = (orders: Order[]) =>
  orders.filter((o) => LIVE.has(o.state ?? ''))

export const fillsToday = (trades: Trade[], nowMs = Date.now()) =>
  trades.filter(
    (t) =>
      t.role === 'maker' && FILLED.has(t.status) && t.ts >= utcDayStart(nowMs)
  )

const statusTone: Record<JournalEntry['status'], Tone> = {
  refused: 'danger',
  signed: 'success',
}

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex flex-col gap-0.5 rounded-xl bg-surface-inset p-3">
    <span className="text-caption text-content-tertiary">{label}</span>
    <span className="text-subhead font-semibold tabular-nums text-content-primary">
      {value}
    </span>
  </div>
)

/** Screen 4: is the maker quoting, is the signer there, what did they do today. */
export function LiveScreen({
  backend,
  view,
  onView,
}: {
  backend: MakerBackend
  view: MakerView
  onView: (v: MakerView) => void
}) {
  const tm = useMk()
  const api = useMemo(() => tenant(backend), [backend])
  const hosted = view.mode === 'hosted'
  const info = usePoll(api.info, 30_000)
  const bot = usePoll(api.bot, 10_000)
  const orders = usePoll(api.orders, 5_000)
  const trades = usePoll(api.trades, 10_000)
  const usage = usePoll(api.usage, 60_000)
  const balance = usePoll(api.balance, 30_000)
  const journal = usePoll(backend.journal, 3_000)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (f: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await f()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const quotes = openQuotes(orders.data ?? [])
  const fills = fillsToday(trades.data ?? [])
  const today = new Date(utcDayStart() * 1000).toISOString().slice(0, 10)
  const usageToday = usage.data?.days.find((d) => d.date === today)
  const recentUsage = (usage.data?.days ?? []).slice(-7).reverse()
  const tickerById = new Map<string, { ticker: string; precision: number }>()
  for (const a of balance.data?.assets ?? [])
    tickerById.set(a.asset_id, { precision: a.precision, ticker: a.ticker })
  for (const o of orders.data ?? [])
    if (!tickerById.has(o.asset_id))
      tickerById.set(o.asset_id, {
        precision: o.precision,
        ticker: tickerOf(o),
      })
  const reachable = !info.error && !!info.data
  const signer = view.signer
  const signerOnline = signer.running

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <SectionTitle>
                {hosted ? tm('live.hostedMaker') : tm('live.yourMaker')}
              </SectionTitle>
              <Pill className="ml-auto" tone={reachable ? 'success' : 'danger'}>
                <span
                  className={cx(
                    'h-1.5 w-1.5 rounded-full bg-current',
                    reachable && 'animate-pulse'
                  )}
                />
                {reachable ? tm('live.online') : tm('live.unreachable')}
              </Pill>
            </div>
            {info.error && (
              <p className="text-caption text-status-danger">{info.error}</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {bot.data && (
                <Pill tone={bot.data.paused ? 'warning' : 'success'}>
                  {bot.data.paused ? tm('common.paused') : tm('common.quoting')}
                </Pill>
              )}
              <span className="text-caption text-content-tertiary">
                {tm('live.markets', {
                  n: bot.data?.config.markets.length ?? 0,
                })}
              </span>
              {bot.data && (
                <Button
                  className="ml-auto"
                  disabled={busy}
                  icon={
                    bot.data.paused ? <Play size={14} /> : <Pause size={14} />
                  }
                  onClick={() =>
                    void run(async () => {
                      await (bot.data?.paused ? api.resume() : api.pause())
                      bot.refresh()
                      orders.refresh()
                    })
                  }
                  size="sm"
                  variant={bot.data.paused ? 'primary' : 'outline'}
                >
                  {bot.data.paused ? tm('live.resume') : tm('live.pause')}
                </Button>
              )}
            </div>
            {info.data && (
              <div className="flex flex-col gap-1 text-caption text-content-secondary">
                <span>
                  {tm('live.fund')}{' '}
                  <span className="break-all font-mono text-content-primary">
                    {info.data.address}
                  </span>
                </span>
                {balance.data && (
                  <span>
                    {tm('live.inventory')}{' '}
                    <span className="text-content-primary">
                      {fmtSats(
                        balance.data.btc_settled_sat ??
                          balance.data.btc_spendable_sat
                      )}{' '}
                      sat
                      {balance.data.assets.map(
                        (a) =>
                          ` · ${fmtUnits(a.spendable, a.precision)} ${a.ticker}`
                      )}
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>
        </Panel>

        {hosted ? (
          <Panel>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <SectionTitle>{tm('live.signer')}</SectionTitle>
                <Pill
                  className="ml-auto"
                  tone={signerOnline ? 'success' : 'danger'}
                >
                  <Radio size={12} />
                  {signerOnline
                    ? tm('live.signerOnline')
                    : tm('live.signerOff')}
                </Pill>
              </div>
              <p className="text-caption text-content-secondary">
                {signerOnline
                  ? tm('live.signerOnlineHint')
                  : tm('live.signerOffHint')}
              </p>
              <div className="grid grid-cols-3 gap-2">
                <Stat label={tm('live.signed')} value={signer.signed} />
                <Stat label={tm('live.refused')} value={signer.refused} />
                <Stat label={tm('live.relays')} value={signer.relays} />
              </div>
              {signer.started_at && (
                <span className="text-caption text-content-tertiary">
                  {tm('live.since', { when: ago(signer.started_at * 1000) })}
                </span>
              )}
              {signer.error && !signer.running && (
                <p className="text-caption text-status-danger">
                  {signer.error}
                </p>
              )}
              <div>
                <Button
                  disabled={busy || (!signer.running && !view.policy)}
                  icon={<Power size={14} />}
                  onClick={() =>
                    void run(async () =>
                      onView(
                        await (signer.running
                          ? backend.stopSigner()
                          : backend.startSigner())
                      )
                    )
                  }
                  size="sm"
                  variant={signer.running ? 'outline' : 'primary'}
                >
                  {signer.running
                    ? tm('live.stopSigner')
                    : tm('live.startSigner')}
                </Button>
              </div>
            </div>
          </Panel>
        ) : (
          <Panel>
            <div className="flex flex-col gap-2">
              <SectionTitle>{tm('live.selfSigning')}</SectionTitle>
              <p className="text-caption text-content-secondary">
                {tm('live.selfSigningHint')}
              </p>
            </div>
          </Panel>
        )}
      </div>
      {error && <p className="text-caption text-status-danger">{error}</p>}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label={tm('live.openQuotes')} value={quotes.length} />
        <Stat label={tm('live.fillsToday')} value={fills.length} />
        <Stat
          label={tm('live.volumeToday')}
          value={`${fmtSats(usageToday?.volume_sat ?? fills.reduce((s, t) => s + t.price_sat, 0))} sat`}
        />
        <Stat
          label={tm('live.offersToday')}
          value={usageToday?.offers_posted ?? '–'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <div className="flex flex-col gap-3">
            <SectionTitle>{tm('live.openQuotes')}</SectionTitle>
            {quotes.length === 0 ? (
              <EmptyState title={tm('live.noQuotes')} />
            ) : (
              <table className="w-full text-caption tabular-nums">
                <thead className="text-tiny uppercase text-content-tertiary">
                  <tr>
                    <th className="pb-1 text-left font-normal">
                      {tm('live.side')}
                    </th>
                    <th className="pb-1 text-right font-normal">
                      {tm('live.amount')}
                    </th>
                    <th className="pb-1 text-right font-normal">
                      {tm('live.price')}
                    </th>
                    <th className="pb-1 text-right font-normal">
                      {tm('live.total')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((o) => (
                    <tr key={o.order_id}>
                      <td
                        className={
                          o.side === 'sell'
                            ? 'text-status-danger'
                            : 'text-status-success'
                        }
                      >
                        {o.side === 'sell' ? tm('live.ask') : tm('live.bid')}
                      </td>
                      <td className="text-right text-content-primary">
                        {fmtUnits(o.amount, o.precision)} {tickerOf(o)}
                      </td>
                      <td className="text-right text-content-secondary">
                        {fmtPrice(o.unit_price)}
                      </td>
                      <td className="text-right text-content-secondary">
                        {fmtSats(o.price_sat)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Panel>

        <Panel>
          <div className="flex flex-col gap-3">
            <SectionTitle hint={hosted ? tm('live.requestsHint') : undefined}>
              {hosted ? tm('live.requests') : tm('live.fills')}
            </SectionTitle>
            {hosted ? (
              (journal.data?.entries.length ?? 0) === 0 ? (
                <EmptyState title={tm('live.noRequests')} />
              ) : (
                <ul className="flex flex-col divide-y divide-border-subtle">
                  {journal.data?.entries.slice(0, 12).map((e) => {
                    const asset = e.asset_id
                      ? tickerById.get(e.asset_id)
                      : undefined
                    return (
                      <li
                        className="flex flex-col gap-0.5 py-2"
                        key={`${e.swap_id}${e.at}`}
                      >
                        <div className="flex items-center gap-2 text-caption">
                          <Pill tone={statusTone[e.status]}>
                            {tm(`live.status.${e.status}`)}
                          </Pill>
                          <span className="text-content-primary">
                            {e.side
                              ? `${e.side === 'sell' ? tm('live.sell') : tm('live.buy')} ${
                                  asset
                                    ? `${fmtUnits(e.units, asset.precision)} ${asset.ticker}`
                                    : `${e.units} ${short(e.asset_id ?? '', 6)}`
                                } · ${fmtSats(e.sat)} sat`
                              : short(e.swap_id, 10)}
                          </span>
                          <span className="ml-auto text-content-tertiary">
                            {dateTime(e.at)}
                          </span>
                        </div>
                        {e.reason && (
                          <span className="text-caption text-content-tertiary">
                            {e.reason}
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )
            ) : fills.length === 0 ? (
              <EmptyState title={tm('live.noFills')} />
            ) : (
              <ul className="flex flex-col divide-y divide-border-subtle text-caption">
                {fills.map((t) => (
                  <li className="flex items-center gap-2 py-2" key={t.id}>
                    <span className="text-content-primary">
                      {t.side === 'sell' ? tm('live.sold') : tm('live.bought')}{' '}
                      {fmtUnits(t.amount, t.precision ?? 0)} {t.ticker ?? ''}
                    </span>
                    <span className="ml-auto text-content-tertiary">
                      {fmtSats(t.price_sat)} sat · {ago(t.ts * 1000)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>

      <Panel>
        <div className="flex flex-col gap-3">
          <SectionTitle hint={tm('live.usageHint')}>
            {tm('live.usage')}
          </SectionTitle>
          {usage.error ? (
            <p className="text-caption text-content-tertiary">
              {tm('live.usageMissing')}
            </p>
          ) : recentUsage.length === 0 ? (
            <EmptyState title={tm('live.noUsage')} />
          ) : (
            <table className="w-full text-caption tabular-nums">
              <thead className="text-tiny uppercase text-content-tertiary">
                <tr>
                  <th className="pb-1 text-left font-normal">
                    {tm('live.day')}
                  </th>
                  <th className="pb-1 text-right font-normal">
                    {tm('live.offersPosted')}
                  </th>
                  <th className="pb-1 text-right font-normal">
                    {tm('live.swapsSettled')}
                  </th>
                  <th className="pb-1 text-right font-normal">
                    {tm('live.volume')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentUsage.map((d) => (
                  <tr key={d.date}>
                    <td className="text-content-secondary">{d.date}</td>
                    <td className="text-right text-content-primary">
                      {d.offers_posted}
                    </td>
                    <td className="text-right text-content-primary">
                      {d.swaps_settled}
                    </td>
                    <td className="text-right text-content-primary">
                      {fmtSats(d.volume_sat)} sat
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
    </div>
  )
}
