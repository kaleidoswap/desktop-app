import { useMemo, useState } from 'react'

import { marketApi, type Order } from '../api'
import { splitBook } from '../book'
import { tickerOf } from '../format'

import { Activity } from './Activity'
import { DepthChart } from './DepthChart'
import { useTr, usePoll } from './hooks'
import { OrderBook } from './OrderBook'
import { PairHeader, type MarketInfo } from './PairHeader'
import { TakeSheet } from './TakeSheet'
import { TradeTicket } from './TradeTicket'
import { EmptyState, Panel } from './ui'

interface Props {
  onOpenFunds?: () => void
}

/** The market: order book, depth, a ticket for market and limit orders, and the user's activity. */
export function Market({ onOpenFunds }: Props) {
  const tr = useTr()
  const info = usePoll(marketApi.info, 30_000)
  const balance = usePoll(marketApi.balance, 4_000)
  const book = usePoll(marketApi.book, 2_500)
  const mine = usePoll(marketApi.orders, 2_500)
  const trades = usePoll(marketApi.trades, 1_500)

  const [selected, setSelected] = useState<string | null>(null)
  const [taking, setTaking] = useState<Order[] | null>(null)

  const refreshAll = () => {
    book.refresh()
    mine.refresh()
    balance.refresh()
    trades.refresh()
  }

  const orders = useMemo(() => {
    const byId = new Map<string, Order>()
    for (const o of book.data ?? []) byId.set(o.order_id, o)
    return [...byId.values()]
  }, [book.data])

  const markets: MarketInfo[] = useMemo(() => {
    const m = new Map<string, MarketInfo>()
    for (const a of balance.data?.assets ?? []) {
      m.set(a.asset_id, {
        asset_id: a.asset_id,
        impersonates: null,
        orders: 0,
        precision: a.precision,
        ticker: a.ticker,
        verified: false,
      })
    }
    for (const o of orders) {
      const cur = m.get(o.asset_id) ?? {
        asset_id: o.asset_id,
        impersonates: null,
        orders: 0,
        precision: o.precision,
        ticker: tickerOf(o),
        verified: false,
      }
      cur.verified = cur.verified || o.verified
      cur.impersonates = cur.impersonates ?? o.impersonates
      if (o.ticker && cur.ticker !== o.ticker) {
        cur.ticker = o.ticker
        cur.precision = o.precision
      }
      cur.orders += 1
      m.set(o.asset_id, cur)
    }
    return [...m.values()].sort((a, b) => b.orders - a.orders)
  }, [orders, balance.data])

  // the market the user picked, or else the busiest one
  const current = markets.some((m) => m.asset_id === selected)
    ? selected
    : (markets[0]?.asset_id ?? null)

  if (info.error && !info.data) {
    return (
      <Panel>
        <EmptyState
          description={info.error}
          title={tr('market.unreachable', 'Can’t reach the market daemon')}
        />
      </Panel>
    )
  }
  if (!info.data) return null
  const inf = info.data

  const market = markets.find((m) => m.asset_id === current)
  const marketOrders = orders.filter((o) => o.asset_id === current)
  const { asks, bids } = splitBook(marketOrders.filter((o) => !o.mine))
  const lastTrade = (trades.data ?? []).find(
    (t) => t.asset_id === current && t.status !== 'failed'
  )

  return (
    <div className="flex flex-col gap-4">
      <PairHeader
        bestAsk={asks[0]?.unit_price}
        bestBid={bids[0]?.unit_price}
        btc={balance.data?.btc_spendable_sat ?? 0}
        info={inf}
        last={
          lastTrade ? lastTrade.price_sat / (lastTrade.amount || 1) : undefined
        }
        markets={markets}
        onOpenFunds={onOpenFunds}
        onSelect={setSelected}
        open={marketOrders.length}
        registry={
          marketOrders.find((o) => o.registry?.ticker_differs)?.registry ??
          marketOrders[0]?.registry ??
          null
        }
        selected={current}
      />

      {(book.error || mine.error) && (
        <p className="rounded-xl bg-status-warning-subtle px-4 py-2 text-caption text-content-primary">
          {tr(
            'market.unstable',
            'The connection to the market daemon is unstable.'
          )}
        </p>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[19rem_minmax(0,1fr)_22rem]">
        <div className="grid items-start gap-4 lg:grid-cols-[17rem_minmax(0,1fr)] xl:contents">
          <div>
            {market ? (
              <OrderBook
                onPick={(o) => !o.mine && setTaking([o])}
                orders={marketOrders}
                ticker={market.ticker}
              />
            ) : (
              <Panel>
                <EmptyState
                  description={tr(
                    'market.noMarketsBody',
                    'A market appears when someone posts an order, or when your wallet holds an RGB asset.'
                  )}
                  title={tr('market.noMarkets', 'No markets yet')}
                />
              </Panel>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <Panel label={tr('market.depth', 'Market depth')}>
              <header className="flex items-baseline justify-between pb-2">
                <h2 className="text-subhead font-medium text-content-primary">
                  {tr('market.depthTitle', '{{ticker}} depth', {
                    ticker: market?.ticker ?? '',
                  })}
                </h2>
                <span className="text-caption text-content-tertiary">
                  {tr('market.perUnit', 'sats per {{ticker}}', {
                    ticker: market?.ticker ?? tr('market.unit', 'unit'),
                  })}
                </span>
              </header>
              <DepthChart orders={marketOrders} ticker={market?.ticker ?? ''} />
            </Panel>
            <Activity
              balance={balance.data}
              onChanged={refreshAll}
              onOpenFunds={onOpenFunds}
              orders={mine.data ?? []}
              trades={trades.data ?? []}
            />
          </div>
        </div>

        <div>
          {market ? (
            <TradeTicket
              asset={market}
              balance={balance.data}
              info={inf}
              key={market.asset_id}
              onPlaced={refreshAll}
              onReview={setTaking}
              orders={marketOrders}
            />
          ) : (
            <Panel>
              <EmptyState
                description={tr(
                  'market.nothingBody',
                  'Move bitcoin and an RGB asset into the trading wallet to open a market.'
                )}
                title={tr('market.nothing', 'Nothing to trade yet')}
              />
            </Panel>
          )}
        </div>
      </div>

      {taking && (
        <TakeSheet
          info={inf}
          onChanged={refreshAll}
          onClose={() => {
            setTaking(null)
            refreshAll()
          }}
          orders={taking}
          trades={trades.data ?? []}
        />
      )}
    </div>
  )
}
