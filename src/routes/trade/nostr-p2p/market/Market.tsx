import { ArrowLeftRight, Plus, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { availableSats, marketApi, type Order, type Side } from '../api'
import { ordersAwaitingRelay, ordersOnScreen, splitBook } from '../book'
import { tickerOf, tradeUnitPrice, type PrecisionSource } from '../format'

import { Activity } from './Activity'
import { DepthChart } from './DepthChart'
import { useTr, usePoll } from './hooks'
import { HowItWorks } from './HowItWorks'
import { MosaikBridge } from './MosaikBridge'
import { Offers, OfferSummary } from './Offers'
import { OrderBook } from './OrderBook'
import { PairHeader, type MarketInfo } from './PairHeader'
import { TakeSheet } from './TakeSheet'
import { TradeTicket } from './TradeTicket'
import { cx, EmptyState, Panel } from './ui'
import { WalletCard, type FundsDirection, type NodeSummary } from './WalletCard'

interface Props {
  onSimpleSwap?: () => void
  onManageRelays?: () => void
  /** Opens the dialog that moves funds between the node and the trading wallet. */
  onOpenFunds?: (direction?: FundsDirection) => void
  /** The user's node balance, when the app has a node to read it from. */
  node?: NodeSummary
  /** Opens the coins (UTXO) manager. */
  onManageCoins?: () => void
  /** Opens the dialog that issues a new asset. */
  onIssueAsset?: () => void
  /** Restart the wallet with a full scan of its addresses. */
  onRescan?: () => Promise<void>
  /** The name of the trading wallet that is open, when the app has more than the original. */
  walletLabel?: string
}

/** The market: order book, depth, a ticket for market and limit orders, and the user's activity. */
export function Market({
  onSimpleSwap,
  onManageRelays,
  onIssueAsset,
  onManageCoins,
  onOpenFunds,
  node,
  onRescan,
  walletLabel,
}: Props) {
  const tr = useTr()
  const info = usePoll(marketApi.info, 30_000)
  const balance = usePoll(marketApi.balance, 4_000)
  const book = usePoll(marketApi.book, 2_500)
  const mine = usePoll(marketApi.orders, 2_500)
  const trades = usePoll(marketApi.trades, 1_500)

  const [selected, setSelected] = useState<string | null>(null)
  const [taking, setTaking] = useState<Order[] | null>(null)

  const [tab, setTab] = useState<'offers' | 'mine'>('offers')
  const [side, setSide] = useState<Side>('buy')
  const [offerId, setOfferId] = useState<string | null>(null)
  const [compose, setCompose] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const ticketPanel = useRef<HTMLElement>(null)

  const focusStackedTicket = () => {
    if (window.matchMedia?.('(min-width: 1024px)').matches !== false) return
    requestAnimationFrame(() => {
      ticketPanel.current?.focus({ preventScroll: true })
      ticketPanel.current?.scrollIntoView({ block: 'start' })
    })
  }

  const openComposer = () => {
    setCompose(true)
    focusStackedTicket()
  }

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

  const orders = useMemo(
    () => ordersOnScreen(book.data ?? [], mine.data ?? []),
    [book.data, mine.data]
  )
  const awaitingRelay = useMemo(
    () => new Set(ordersAwaitingRelay(book.data ?? [], mine.data ?? [])),
    [book.data, mine.data]
  )
  const knownPrecision = useMemo(() => {
    const byAsset = new Map<string, PrecisionSource>()
    for (const a of balance.data?.assets ?? []) {
      byAsset.set(a.asset_id, { asset_id: a.asset_id, precision: a.precision })
    }
    for (const o of orders) {
      if (!byAsset.has(o.asset_id)) {
        byAsset.set(o.asset_id, {
          asset_id: o.asset_id,
          precision: o.precision,
        })
      }
    }
    return [...byAsset.values()]
  }, [balance.data, orders])

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
  if (!info.data) {
    return (
      <Panel>
        <EmptyState
          description={tr(
            'market.loadingBody',
            'Connecting to your trading wallet.'
          )}
          title={tr('market.loading', 'Loading the market…')}
        />
      </Panel>
    )
  }
  const inf = info.data

  const market = markets.find((m) => m.asset_id === current)
  const marketOrders = orders.filter((o) => o.asset_id === current)
  const { asks, bids } = splitBook(marketOrders.filter((o) => !o.mine))
  const offers = side === 'buy' ? asks : bids
  const activeOffer = offerId
    ? offers.find((o) => o.order_id === offerId)
    : offers[0]
  const liveOrders = (mine.data ?? []).filter(
    (o) => o.state === 'open' || o.state === 'matching'
  )
  const chooseMarket = (id: string) => {
    setSelected(id)
    setOfferId(null)
    setCompose(false)
  }
  const lastTrade = (trades.data ?? []).find(
    (t) => t.asset_id === current && t.status !== 'failed'
  )

  const deposit = onOpenFunds ? () => onOpenFunds('toTrading') : undefined
  const funded =
    availableSats(balance.data) > 0 ||
    (balance.data?.btc_pending_sat ?? 0) > 0 ||
    (balance.data?.assets ?? []).some((a) => a.total > 0)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-content-primary sm:text-3xl">
          {tr('offers.marketTitle', 'P2P market')}
        </h1>
        <div className="flex flex-wrap gap-2">
          {onSimpleSwap && (
            <button
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-content-secondary hover:bg-surface-raised"
              onClick={onSimpleSwap}
              type="button"
            >
              <ArrowLeftRight aria-hidden size={15} />
              {tr('offers.simpleSwap', 'Simple swap')}
            </button>
          )}
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-divider/25 bg-surface-card px-3 py-2 text-sm font-semibold text-content-primary hover:bg-surface-raised disabled:opacity-50"
            disabled={!market}
            onClick={openComposer}
            type="button"
          >
            <Plus aria-hidden size={16} />
            {tr('offers.publish', 'Publish offer')}
          </button>
        </div>
      </header>
      <PairHeader
        bestAsk={asks[0]?.unit_price}
        bestBid={bids[0]?.unit_price}
        info={inf}
        last={lastTrade ? tradeUnitPrice(lastTrade, knownPrecision) : undefined}
        markets={markets}
        onManageRelays={onManageRelays}
        onSelect={chooseMarket}
        open={marketOrders.length}
        registry={
          marketOrders.find((o) => o.registry?.ticker_differs)?.registry ??
          marketOrders[0]?.registry ??
          null
        }
        selected={current}
        walletLabel={walletLabel}
      />

      {(book.error || mine.error) && (
        <p className="rounded-xl bg-status-warning-subtle px-4 py-2 text-caption text-content-primary">
          {tr(
            'market.unstable',
            'The connection to the market daemon is unstable.'
          )}
        </p>
      )}

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,1fr)]">
        <section className="min-w-0 rounded-2xl border border-divider/20 bg-surface-card">
          <div className="flex gap-5 border-b border-divider/20 px-5">
            {(['offers', 'mine'] as const).map((key) => (
              <button
                aria-pressed={tab === key}
                className={cx(
                  'border-b-2 py-3 text-sm font-semibold transition-colors',
                  tab === key
                    ? 'border-status-success text-content-primary'
                    : 'border-transparent text-content-secondary hover:text-content-primary'
                )}
                key={key}
                onClick={() => {
                  setTab(key)
                  setCompose(false)
                }}
                type="button"
              >
                {key === 'offers'
                  ? tr('offers.available', 'Offers')
                  : tr('offers.mine', 'My offers')}
                {key === 'mine' && liveOrders.length > 0 && (
                  <span className="ml-1.5 text-content-tertiary">
                    {liveOrders.length}
                  </span>
                )}
              </button>
            ))}
          </div>
          {tab === 'mine' ? (
            <Activity
              balance={balance.data}
              knownPrecision={knownPrecision}
              onChanged={refreshAll}
              onOpenFunds={deposit}
              orders={mine.data ?? []}
              ordersLoading={mine.data === undefined && !mine.error}
              trades={trades.data ?? []}
              tradesLoading={trades.data === undefined && !trades.error}
            />
          ) : market ? (
            <Offers
              loading={book.data === undefined && !book.error}
              offers={offers}
              onSelect={(o) => {
                setOfferId(o.order_id)
                setCompose(false)
                focusStackedTicket()
              }}
              onSide={(next) => {
                setSide(next)
                setOfferId(null)
                setCompose(false)
              }}
              selected={activeOffer}
              side={side}
              ticker={market.ticker}
            />
          ) : (
            <EmptyState
              description={tr(
                'market.noMarketsBody',
                'A market appears when someone posts an order, or when your trading wallet holds an RGB asset.'
              )}
              title={tr('market.noMarkets', 'No markets yet')}
            />
          )}
        </section>
        <section
          aria-label={tr('offers.summary', 'Offer summary')}
          className="min-w-0 scroll-mt-3 rounded-2xl border border-divider/20 bg-surface-card outline-none"
          ref={ticketPanel}
          tabIndex={-1}
        >
          {compose && market ? (
            <>
              <div className="flex items-center justify-between gap-4 px-5 pt-4">
                <h2 className="text-base font-semibold text-content-primary">
                  {tr('offers.new', 'New offer')}
                </h2>
                <button
                  aria-label={tr('offers.close', 'Close offer form')}
                  className="rounded-lg p-2 text-content-secondary hover:bg-surface-raised"
                  onClick={() => setCompose(false)}
                  type="button"
                >
                  <X aria-hidden size={16} />
                </button>
              </div>
              <TradeTicket
                asset={market}
                balance={balance.data}
                info={inf}
                initialMode="limit"
                initialSide={side}
                key={market.asset_id}
                limitOnly
                onOpenFunds={deposit}
                onPlaced={() => {
                  setCompose(false)
                  setTab('mine')
                  refreshAll()
                }}
                onReview={setTaking}
                orders={marketOrders}
              />
            </>
          ) : tab === 'offers' ? (
            <OfferSummary
              network={info.data?.network}
              offer={activeOffer}
              onReview={(o) => setTaking([o])}
            />
          ) : (
            <EmptyState
              action={
                market && (
                  <button
                    className="rounded-lg bg-[#8deaba] px-4 py-2 text-sm font-semibold text-[#113d2b] hover:bg-[#79ddab]"
                    onClick={openComposer}
                    type="button"
                  >
                    {tr('offers.publish', 'Publish offer')}
                  </button>
                )
              }
              description={tr(
                'offers.makeHint',
                'Choose your price and keep your desktop online to answer other traders.'
              )}
              title={tr('offers.yourPrice', 'Your price')}
            />
          )}
        </section>
      </div>
      <details
        className="rounded-xl border border-divider/15 bg-surface-card p-4 text-content-primary"
        onToggle={(e) => setAdvanced(e.currentTarget.open)}
      >
        <summary className="cursor-pointer text-sm font-medium">
          {tr('offers.advanced', 'Market depth and trading tools')}
        </summary>
        {advanced && (
          <div className="mt-3 grid items-start gap-3 lg:grid-cols-2">
            {market && (
              <OrderBook
                loading={book.data === undefined && !book.error}
                onPick={(o) => !o.mine && setTaking([o])}
                orders={marketOrders}
                pendingRelay={awaitingRelay}
                ticker={market.ticker}
              />
            )}
            <Panel label={tr('market.depth', 'Market depth')}>
              <h2 className="mb-2 text-sm font-medium">
                {tr('market.depthTitle', '{{ticker}} depth', {
                  ticker: market?.ticker ?? '',
                })}
              </h2>
              <DepthChart
                loading={book.data === undefined && !book.error}
                orders={marketOrders}
                ticker={market?.ticker ?? ''}
              />
            </Panel>
            <WalletCard
              balance={balance.data}
              info={inf}
              node={node}
              onIssueAsset={onIssueAsset}
              onManageCoins={onManageCoins}
              onOpenFunds={onOpenFunds}
              onRefresh={syncWallet}
              onRescan={onRescan}
            />
            {market && !compose && (
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
            )}
          </div>
        )}
      </details>
      <HowItWorks
        active={(mine.data ?? []).length > 0 || (trades.data ?? []).length > 0}
        confirmations={inf.min_confirmations}
        funded={funded}
        onDeposit={deposit}
      />

      {inf.network === 'signetcustom' && (
        <details className="rounded-xl border border-divider/15 bg-surface-card p-4 text-content-primary">
          <summary className="cursor-pointer text-sm font-medium">
            {tr('offers.webMarket', 'Mosaik web market')}
          </summary>
          <div className="mt-3">
            <MosaikBridge network={inf.network} />
          </div>
        </details>
      )}

      {taking && (
        <TakeSheet
          book={marketOrders}
          info={inf}
          onChanged={refreshAll}
          onClose={() => {
            setTaking(null)
            refreshAll()
          }}
          onSwitch={(o) => setTaking([o])}
          orders={taking}
          trades={trades.data ?? []}
        />
      )}
    </div>
  )
}
