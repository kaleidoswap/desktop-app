import { useMemo, useState } from 'react'

import { availableSats, marketApi, type Order } from '../api'
import { splitBook } from '../book'
import { tickerOf } from '../format'

import { Activity } from './Activity'
import { DepthChart } from './DepthChart'
import { useTr, usePoll } from './hooks'
import { HowItWorks } from './HowItWorks'
import { OrderBook } from './OrderBook'
import { PairHeader, type MarketInfo } from './PairHeader'
import { TakeSheet } from './TakeSheet'
import { TradeTicket } from './TradeTicket'
import { EmptyState, Panel } from './ui'
import { WalletCard, type FundsDirection, type NodeSummary } from './WalletCard'

interface Props {
  /** Opens the dialog that moves funds between the node and the trading wallet. */
  onOpenFunds?: (direction?: FundsDirection) => void
  /** The user's node balance, when the app has a node to read it from. */
  node?: NodeSummary
}

/** The market: order book, depth, a ticket for market and limit orders, and the user's activity. */
export function Market({ onOpenFunds, node }: Props) {
  const tr = useTr()
  const info = usePoll(marketApi.info, 30_000)
  const balance = usePoll(marketApi.balance, 4_000)
  const book = usePoll(marketApi.book, 2_500)
  const mine = usePoll(marketApi.orders, 2_500)
  const trades = usePoll(marketApi.trades, 1_500)

  const [selected, setSelected] = useState<string | null>(null)
  const [taking, setTaking] = useState<Order[] | null>(null)

  // sync with the chain now, then read the result: for a deposit that has just been sent
  const syncWallet = async () => {
    await marketApi.refresh()
    balance.refresh()
  }

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
      // what a maker says about an asset (ticker, precision) never replaces what is already known:
      // the wallet's own entry is authoritative, and a later order cannot rewrite the first
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

  const deposit = onOpenFunds ? () => onOpenFunds('toTrading') : undefined
  const funded =
    availableSats(balance.data) > 0 ||
    (balance.data?.btc_pending_sat ?? 0) > 0 ||
    (balance.data?.assets ?? []).some((a) => a.total > 0)

  return (
    <div className="flex flex-col gap-3">
      <PairHeader
        bestAsk={asks[0]?.unit_price}
        bestBid={bids[0]?.unit_price}
        info={inf}
        last={
          lastTrade ? lastTrade.price_sat / (lastTrade.amount || 1) : undefined
        }
        markets={markets}
        onSelect={setSelected}
        open={marketOrders.length}
        registry={
          marketOrders.find((o) => o.registry?.ticker_differs)?.registry ??
          marketOrders[0]?.registry ??
          null
        }
        selected={current}
      />

      <HowItWorks
        active={(mine.data ?? []).length > 0 || (trades.data ?? []).length > 0}
        confirmations={inf.min_confirmations}
        funded={funded}
        onDeposit={deposit}
      />

      {(book.error || mine.error) && (
        <p className="rounded-xl bg-status-warning-subtle px-4 py-2 text-caption text-content-primary">
          {tr(
            'market.unstable',
            'The connection to the market daemon is unstable.'
          )}
        </p>
      )}

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="grid items-stretch gap-3 md:grid-cols-[18rem_minmax(0,1fr)]">
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
                    'A market appears when someone posts an order, or when your trading wallet holds an RGB asset.'
                  )}
                  title={tr('market.noMarkets', 'No markets yet')}
                />
              </Panel>
            )}
            <Panel
              className="flex flex-col gap-2"
              label={tr('market.depth', 'Market depth')}
            >
              <header className="flex items-baseline justify-between">
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
              <div className="min-h-40 flex-1">
                <DepthChart
                  orders={marketOrders}
                  ticker={market?.ticker ?? ''}
                />
              </div>
            </Panel>
          </div>
          <Activity
            balance={balance.data}
            onChanged={refreshAll}
            onOpenFunds={deposit}
            orders={mine.data ?? []}
            trades={trades.data ?? []}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <WalletCard
            balance={balance.data}
            info={inf}
            node={node}
            onOpenFunds={onOpenFunds}
            onRefresh={syncWallet}
          />
          {market ? (
            <TradeTicket
              asset={market}
              balance={balance.data}
              info={inf}
              key={market.asset_id}
              onOpenFunds={deposit}
              onPlaced={refreshAll}
              onReview={setTaking}
              orders={marketOrders}
            />
          ) : (
            <Panel>
              <EmptyState
                description={tr(
                  'market.nothingBody',
                  'Deposit bitcoin and an RGB asset into the trading wallet to open a market.'
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
