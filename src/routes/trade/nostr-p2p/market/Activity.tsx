import { Trash2, Wallet } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'react-toastify'

import { marketApi, type Balance, type Order, type Trade } from '../api'
import { makerSettlement, tradeSettlement } from '../costs'
import {
  ago,
  fmtPrice,
  fmtSats,
  fmtTradeAmount,
  fmtUnits,
  short,
  tickerOf,
  timeLeft,
  tradePrecision,
  type PrecisionSource,
} from '../format'

import { CostBreakdown } from './CostBreakdown'
import { useTr } from './hooks'
import { SwapSteps } from './SwapSteps'
import { EmptyState, Panel, Pill, cx, type Tone } from './ui'

type Tab = 'orders' | 'trades' | 'balances'

interface Props {
  orders: Order[]
  trades: Trade[]
  balance: Balance | undefined
  /** Assets already on screen, for trades whose daemon did not send `precision`. */
  knownPrecision?: readonly PrecisionSource[]
  /** True until that list has been read once, so an empty state is not shown early. */
  ordersLoading?: boolean
  tradesLoading?: boolean
  onChanged: () => void
  onOpenFunds?: () => void
  initialTab?: Tab
}

export function Activity({
  orders,
  trades,
  balance,
  knownPrecision = [],
  ordersLoading = false,
  tradesLoading = false,
  onChanged,
  onOpenFunds,
  initialTab = 'orders',
}: Props) {
  const tr = useTr()
  const [tab, setTab] = useState<Tab>(initialTab)
  const live = orders.filter(
    (o) => o.state === 'open' || o.state === 'matching'
  )

  const cancel = async (id: string) => {
    try {
      await marketApi.cancel(id)
      toast.success(tr('activity.cancelled', 'Order cancelled'))
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  const tabs: [Tab, string, number?][] = [
    ['orders', tr('activity.orders', 'Open orders'), live.length],
    ['trades', tr('activity.trades', 'Trades'), trades.length],
    ['balances', tr('activity.balances', 'Balances')],
  ]

  const orderTone = (s: string | null): [Tone, string] =>
    s === 'matching'
      ? ['info', tr('activity.matching', 'Negotiating')]
      : s === 'open'
        ? ['success', tr('activity.open', 'Open')]
        : ['muted', s ?? '–']

  const tradeTone = (t: Trade): [Tone, string] =>
    t.status === 'settled'
      ? ['success', tr('activity.settled', 'Settled')]
      : t.status === 'broadcast'
        ? [
            'warning',
            t.required > 0
              ? tr('activity.confirming', 'Confirming {{have}}/{{need}}', {
                  have: t.confirmations,
                  need: t.required,
                })
              : tr('activity.confirmingPlain', 'Confirming'),
          ]
        : t.status === 'failed'
          ? ['danger', tr('activity.failed', 'Failed')]
          : ['info', tr('activity.inProgress', 'In progress')]

  const tradeAmount = (t: Trade) => {
    const precision = tradePrecision(t, knownPrecision)
    return {
      precision,
      text: `${fmtTradeAmount(t.amount, precision)} ${tickerOf(t)}`,
    }
  }

  return (
    <Panel
      className="flex flex-col gap-3"
      label={tr('activity.title', 'Your activity')}
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-subhead font-medium text-content-primary">
          {tr('activity.title', 'Your activity')}
        </h2>
        <span className="text-tiny text-content-tertiary">
          {tr('activity.local', 'On this wallet')}
        </span>
      </header>
      <div
        className="flex gap-1 self-start rounded-xl bg-surface-inset p-1"
        role="tablist"
      >
        {tabs.map(([id, label, n]) => (
          <button
            aria-selected={tab === id}
            className={cx(
              'rounded-lg px-3 py-1.5 text-caption font-medium transition-colors',
              tab === id
                ? 'bg-surface-raised text-content-primary'
                : 'text-content-tertiary hover:text-content-secondary'
            )}
            key={id}
            onClick={() => setTab(id)}
            role="tab"
            type="button"
          >
            {label}
            {n ? (
              <span className="ml-1.5 tabular-nums text-content-tertiary">
                {n}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {((tab === 'orders' && ordersLoading) ||
        (tab === 'trades' && tradesLoading)) && (
        <p className="px-2 py-6 text-center text-caption text-content-tertiary">
          {tr('activity.loading', 'Loading your activity…')}
        </p>
      )}

      {!ordersLoading &&
        tab === 'orders' &&
        (live.length === 0 ? (
          <EmptyState
            description={tr(
              'activity.noOrdersBody',
              'Place a limit order and it rests here until someone takes it.'
            )}
            title={tr('activity.noOrders', 'No open orders')}
          />
        ) : (
          <ul className="flex flex-col gap-1">
            {live.map((o) => {
              const [tone, label] = orderTone(o.state)
              return (
                <li
                  className="flex flex-col gap-2 rounded-xl bg-surface-inset px-3 py-2.5 text-caption"
                  key={o.order_id}
                >
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3">
                    <Pill tone={o.side === 'buy' ? 'success' : 'danger'}>
                      {o.side === 'buy'
                        ? tr('activity.buy', 'Buy')
                        : tr('activity.sell', 'Sell')}
                    </Pill>
                    <span className="truncate tabular-nums text-content-primary">
                      {fmtUnits(o.amount, o.precision)} {tickerOf(o)}{' '}
                      <span className="text-content-tertiary">
                        @ {fmtPrice(o.unit_price)}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Pill tone={tone}>{label}</Pill>
                      <span className="tabular-nums text-content-tertiary">
                        {timeLeft(o.expiry)}
                      </span>
                    </span>
                    {o.state === 'open' ? (
                      <button
                        aria-label={tr('activity.cancel', 'Cancel order')}
                        className="rounded-lg p-1.5 text-content-tertiary transition-colors hover:bg-status-danger-subtle hover:text-status-danger"
                        onClick={() => void cancel(o.order_id)}
                        title={tr('activity.cancel', 'Cancel order')}
                        type="button"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : (
                      <span className="w-7" />
                    )}
                  </div>
                  <CostBreakdown
                    asset={`${fmtUnits(o.amount, o.precision)} ${tickerOf(o)}`}
                    priceHint={`${fmtPrice(o.unit_price)} sats`}
                    settlement={makerSettlement(o)}
                  />
                </li>
              )
            })}
          </ul>
        ))}

      {!tradesLoading &&
        tab === 'trades' &&
        (trades.length === 0 ? (
          <EmptyState
            description={tr(
              'activity.noTradesBody',
              'Your swaps show up here as soon as they start.'
            )}
            title={tr('activity.noTrades', 'No trades yet')}
          />
        ) : (
          <ul className="flex flex-col gap-1">
            {trades.map((t) => {
              const [tone, label] = tradeTone(t)
              const amount = tradeAmount(t)
              const inFlight =
                t.status === 'negotiating' || t.status === 'broadcast'
              return (
                <li
                  className={cx(
                    'flex flex-col gap-2 rounded-xl bg-surface-inset px-3 py-2.5 text-caption',
                    inFlight && 'ring-1 ring-primary/30'
                  )}
                  key={`${t.id}-${t.role}`}
                >
                  <div className="flex items-center gap-3">
                    <Pill tone={t.side === 'buy' ? 'success' : 'danger'}>
                      {t.side === 'buy'
                        ? tr('activity.bought', 'Bought')
                        : tr('activity.sold', 'Sold')}
                    </Pill>
                    <span
                      className="min-w-0 flex-1 truncate font-medium tabular-nums text-content-primary"
                      title={
                        amount.precision === null
                          ? tr(
                              'activity.baseUnits',
                              'Amount in the asset’s smallest unit'
                            )
                          : undefined
                      }
                    >
                      {amount.text}{' '}
                      <span className="font-normal text-content-tertiary">
                        · {fmtSats(t.price_sat)} sats
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Pill tone={tone}>{label}</Pill>
                      <span
                        className="text-content-tertiary"
                        title={t.txid ?? undefined}
                      >
                        {t.txid ? short(t.txid, 4) : ago(t.ts)}
                      </span>
                    </span>
                  </div>
                  <SwapSteps trade={t} />
                  <CostBreakdown
                    asset={amount.text}
                    settlement={tradeSettlement(t)}
                  />
                </li>
              )
            })}
          </ul>
        ))}

      {tab === 'balances' && (
        <div className="flex flex-col gap-1">
          <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl bg-surface-inset px-3 py-2 text-caption">
            <span className="text-content-primary">Bitcoin</span>
            <span className="tabular-nums text-content-primary">
              {fmtSats(balance?.btc_spendable_sat ?? 0)} sats
            </span>
          </div>
          {(balance?.assets ?? []).map((a) => (
            <div
              className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl bg-surface-inset px-3 py-2 text-caption"
              key={a.asset_id}
            >
              <span className="text-content-primary">{a.ticker}</span>
              <span className="tabular-nums text-content-primary">
                {fmtUnits(a.spendable, a.precision)}
                {a.total !== a.spendable && (
                  <span className="ml-2 text-content-tertiary">
                    {tr('activity.inFlight', '{{n}} in flight', {
                      n: fmtUnits(a.total - a.spendable, a.precision),
                    })}
                  </span>
                )}
              </span>
            </div>
          ))}
          {onOpenFunds && (
            <button
              className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-surface-raised py-2 text-caption font-medium text-content-primary hover:bg-surface-high"
              onClick={onOpenFunds}
              type="button"
            >
              <Wallet size={14} />{' '}
              {tr('activity.moveFunds', 'Move funds from your node')}
            </button>
          )}
        </div>
      )}
    </Panel>
  )
}
