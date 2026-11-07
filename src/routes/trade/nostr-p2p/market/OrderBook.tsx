import { AlertTriangle } from 'lucide-react'
import { useMemo } from 'react'

import type { Order } from '../api'
import { splitBook, withDepth } from '../book'
import { fmtPrice, fmtSats, fmtUnits } from '../format'

import { useTr } from './hooks'
import { EmptyState, cx } from './ui'

interface Props {
  orders: Order[]
  ticker: string
  onPick: (o: Order) => void
}

const ROWS = 9

export function OrderBook({ orders, ticker, onPick }: Props) {
  const tr = useTr()
  const { asks, bids } = useMemo(() => splitBook(orders), [orders])
  const askRows = useMemo(() => withDepth(asks).slice(0, ROWS), [asks])
  const bidRows = useMemo(() => withDepth(bids).slice(0, ROWS), [bids])
  const max = Math.max(1e-9, askRows.at(-1)?.cum ?? 0, bidRows.at(-1)?.cum ?? 0)

  // who is around, counted by maker rather than by order
  const makers = useMemo(() => {
    const m = new Map<string, boolean>()
    for (const o of orders) {
      if (o.mine) continue
      m.set(o.maker, (m.get(o.maker) ?? false) || !o.away)
    }
    return m
  }, [orders])
  const onlineMakers = [...makers.values()].filter(Boolean).length

  const bestAsk = asks[0]?.unit_price
  const bestBid = bids[0]?.unit_price
  const both = bestAsk !== undefined && bestBid !== undefined
  const mid = both ? (bestAsk + bestBid) / 2 : (bestAsk ?? bestBid)
  const spreadPct = both && mid ? ((bestAsk - bestBid) / mid) * 100 : undefined

  const row = (r: { order: Order; cum: number }, side: 'ask' | 'bid') => {
    const o = r.order
    return (
      <li key={o.order_id}>
        <button
          className={cx(
            'group relative grid w-full grid-cols-[1.2fr_1fr_1fr] items-center gap-2 rounded-lg px-2 py-1 text-left text-caption tabular-nums transition-colors',
            !o.mine && 'hover:bg-surface-raised',
            o.mine && 'cursor-default',
            o.away && 'opacity-60'
          )}
          disabled={o.mine}
          onClick={() => onPick(o)}
          title={
            o.mine
              ? tr('book.yours', 'Your order')
              : o.away
                ? tr(
                    'book.away',
                    'The maker has not been seen for a while and may be slow to answer'
                  )
                : side === 'ask'
                  ? tr('book.buyHere', 'Buy {{ticker}} at this price', {
                      ticker,
                    })
                  : tr('book.sellHere', 'Sell {{ticker}} at this price', {
                      ticker,
                    })
          }
          type="button"
        >
          <span
            aria-hidden
            className={cx(
              'pointer-events-none absolute inset-y-0 right-0 rounded-lg',
              side === 'ask'
                ? 'bg-status-danger-subtle'
                : 'bg-status-success-subtle'
            )}
            style={{ width: `${(r.cum / max) * 100}%` }}
          />
          <span
            className={cx(
              'relative flex items-center gap-1.5 font-medium',
              side === 'ask' ? 'text-status-danger' : 'text-status-success'
            )}
          >
            {!o.mine && (
              <span
                aria-label={
                  o.away
                    ? tr('book.makerAway', 'Maker away')
                    : tr('book.makerOnline', 'Maker online')
                }
                className={cx(
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  o.away ? 'bg-content-tertiary' : 'bg-status-success'
                )}
              />
            )}
            {fmtPrice(o.unit_price)}
            {o.mine && (
              <span className="rounded-full bg-primary/15 px-1.5 text-tiny text-primary">
                {tr('book.you', 'you')}
              </span>
            )}
            {!o.mine && o.impersonates && (
              <AlertTriangle
                aria-label={tr(
                  'book.imitation',
                  'Possible imitation of a verified asset'
                )}
                className="h-3 w-3 text-status-danger"
              />
            )}
          </span>
          <span className="relative text-right text-content-primary">
            {fmtUnits(o.amount, o.precision)}
          </span>
          <span className="relative text-right text-content-secondary">
            {fmtSats(o.price_sat)}
          </span>
        </button>
      </li>
    )
  }

  return (
    <section
      aria-label={tr('book.title', 'Order book')}
      className="flex h-full flex-col rounded-2xl bg-surface-card/70 p-3"
    >
      <header className="flex items-baseline justify-between px-2 pb-2">
        <h2 className="text-subhead font-medium text-content-primary">
          {tr('book.title', 'Order book')}
        </h2>
        <span
          className="text-caption text-content-tertiary"
          title={tr(
            'book.presenceHelp',
            'A maker is online when its offers were refreshed in the last few minutes. Away makers may answer slowly.'
          )}
        >
          {makers.size > 0
            ? tr('book.makersOnline', '{{on}} of {{all}} makers online', {
                all: makers.size,
                on: onlineMakers,
              })
            : tr('book.open', '{{n}} open', { n: asks.length + bids.length })}
        </span>
      </header>
      <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-2 px-2 pb-1 text-tiny text-content-tertiary">
        <span>{tr('book.price', 'Price (sats)')}</span>
        <span className="text-right">
          {tr('book.size', 'Size ({{ticker}})', { ticker })}
        </span>
        <span className="text-right">{tr('book.total', 'Total (sats)')}</span>
      </div>

      <ul className="flex flex-col justify-end">
        {askRows.length ? (
          [...askRows].reverse().map((r) => row(r, 'ask'))
        ) : (
          <li className="px-2 py-3 text-caption text-content-tertiary">
            {tr('book.noSellers', 'No sellers yet')}
          </li>
        )}
      </ul>

      <div className="my-1 flex items-baseline justify-between rounded-xl bg-surface-inset px-3 py-2">
        <strong className="text-subhead tabular-nums text-content-primary">
          {mid !== undefined ? fmtPrice(mid) : '–'}
        </strong>
        <span className="text-caption text-content-tertiary tabular-nums">
          {spreadPct !== undefined
            ? tr('book.spread', 'spread {{pct}}%', {
                pct: spreadPct.toFixed(spreadPct < 10 ? 2 : 1),
              })
            : tr('book.perUnit', 'sats per {{ticker}}', { ticker })}
        </span>
      </div>

      <ul className="flex flex-col">
        {bidRows.length ? (
          bidRows.map((r) => row(r, 'bid'))
        ) : (
          <li className="px-2 py-3 text-caption text-content-tertiary">
            {tr('book.noBuyers', 'No buyers yet')}
          </li>
        )}
      </ul>

      {!orders.length && (
        <EmptyState
          description={tr(
            'book.emptyBody',
            'Post the first order and it shows up here for everyone on the network.'
          )}
          title={tr('book.emptyTitle', 'Nobody is trading {{ticker}} yet', {
            ticker,
          })}
        />
      )}
      <footer className="mt-auto px-2 pt-2 text-tiny text-content-tertiary">
        {tr('book.foot', 'Orders fill whole. Click one to trade it.')}
      </footer>
    </section>
  )
}
