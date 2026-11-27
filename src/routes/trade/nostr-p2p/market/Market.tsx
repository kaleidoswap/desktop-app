import { Button, PageHeader, cardSurface } from 'kaleido-ui'
import { ArrowLeftRight, Plus, RadioTower, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { useTranslation } from 'react-i18next'

import { availableSats, marketApi, type Info, type Order } from '../api'
import { NostrProfilesMenu } from '../NostrProfilesMenu'
import { ORIGINAL_WALLET_LABEL } from '../wallets'
import { ordersAwaitingRelay, ordersOnScreen, splitBook } from '../book'
import {
  networkLabel,
  tickerOf,
  tradeUnitPrice,
  type PrecisionSource,
} from '../format'

import { Activity } from './Activity'
import { DepthChart } from './DepthChart'
import { useTr, usePoll } from './hooks'
import { HowItWorks } from './HowItWorks'
import { MosaikBridge } from './MosaikBridge'
import { OfferSummary } from './Offers'
import { OrderBook } from './OrderBook'
import { MarketStats, PairHeader, type MarketInfo } from './PairHeader'
import { TakeSheet } from './TakeSheet'
import { TradeTicket } from './TradeTicket'
import { cx, EmptyState, Panel, Pill } from './ui'
import { WalletCard, type FundsDirection, type NodeSummary } from './WalletCard'

interface Props {
  showNetwork?: boolean
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
export function Market(props: Props) {
  const [session, setSession] = useState(0)
  // A new signer owns separate offers and swaps. Drop every previous poll and open ticket.
  return (
    <MarketSession
      key={session}
      {...props}
      onProfileSwitched={() => setSession((current) => current + 1)}
    />
  )
}

type SessionProps = Props & { onProfileSwitched: () => void }

function MarketSession(props: SessionProps) {
  const tr = useTr()
  const info = usePoll(marketApi.info, 30_000)
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

  return <SignedMarket key={info.data.npub} {...props} inf={info.data} />
}

function SignedMarket({
  inf,
  onProfileSwitched,
  showNetwork = true,
  onSimpleSwap,
  onManageRelays,
  onIssueAsset,
  onManageCoins,
  onOpenFunds,
  node,
  onRescan,
  walletLabel,
}: SessionProps & { inf: Info }) {
  const tr = useTr()
  const { t } = useTranslation()
  const balance = usePoll(marketApi.balance, 4_000)
  const book = usePoll(marketApi.book, 2_500)
  const mine = usePoll(marketApi.orders, 2_500)
  const trades = usePoll(marketApi.trades, 1_500)

  const [selected, setSelected] = useState<string | null>(null)
  const [taking, setTaking] = useState<Order[] | null>(null)

  const [offerId, setOfferId] = useState<string | null>(null)
  const [compose, setCompose] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const ticketPanel = useRef<HTMLElement>(null)

  const panelTrigger = useRef<HTMLButtonElement | null>(null)

  const focusTicket = (trigger: HTMLButtonElement) => {
    panelTrigger.current = trigger
    requestAnimationFrame(() => {
      ticketPanel.current?.focus({ preventScroll: true })
      if (window.matchMedia?.('(min-width: 1024px)').matches === false) {
        ticketPanel.current?.scrollIntoView({ block: 'start' })
      }
    })
  }

  const closeTicket = () => {
    setCompose(false)
    setOfferId(null)
    panelTrigger.current?.focus()
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

  const market = markets.find((m) => m.asset_id === current)
  const marketOrders = orders.filter((o) => o.asset_id === current)
  const { asks, bids } = splitBook(marketOrders)
  const activeOffer = marketOrders.find(
    (o) => !o.mine && o.order_id === offerId
  )
  const chooseMarket = (id: string) => {
    setSelected(id)
    setOfferId(null)
    setCompose(false)
  }
  const lastTrade = (trades.data ?? []).find(
    (t) => t.asset_id === current && t.status === 'settled'
  )

  const deposit = onOpenFunds ? () => onOpenFunds('toTrading') : undefined
  const funded =
    availableSats(balance.data) > 0 ||
    (balance.data?.btc_pending_sat ?? 0) > 0 ||
    (balance.data?.assets ?? []).some((a) => a.total > 0)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        action={
          <div className="flex flex-wrap items-center gap-2">
            {onSimpleSwap && (
              <Button onClick={onSimpleSwap} size="sm" type="button">
                <ArrowLeftRight aria-hidden size={15} />
                {tr('offers.simpleSwap', 'Simple swap')}
              </Button>
            )}
            {market && (
              <Button
                onClick={(event) => {
                  setOfferId(null)
                  setCompose(true)
                  focusTicket(event.currentTarget)
                }}
                size="sm"
                type="button"
                variant="surface"
              >
                <Plus aria-hidden size={16} />
                {tr('offers.publish', 'Publish offer')}
              </Button>
            )}
            {showNetwork && (
              <Pill tone={inf.network === 'mainnet' ? 'success' : 'warning'}>
                {networkLabel(inf.network)}
              </Pill>
            )}
            {walletLabel && walletLabel !== ORIGINAL_WALLET_LABEL && (
              <span className="self-center text-caption text-content-secondary">
                {walletLabel}
              </span>
            )}
            <NostrProfilesMenu npub={inf.npub} onSwitched={onProfileSwitched} />
            {onManageRelays && (
              <Button
                aria-haspopup="dialog"
                onClick={onManageRelays}
                size="sm"
                type="button"
                variant="surface"
              >
                <RadioTower aria-hidden size={15} />
                {tr('offers.nostrRelays', 'Relays ({{n}})', {
                  n: inf.relays?.length ?? 0,
                })}
              </Button>
            )}
          </div>
        }
        className="[&_[data-slot=page-header-actions]]:max-w-full"
        title={t('unified.market', { defaultValue: 'Nostr P2P market' })}
        variant="page"
      />
      {(book.error || mine.error) && (
        <p className="rounded-xl bg-status-warning-subtle px-4 py-2 text-caption text-content-primary">
          {tr(
            'market.unstable',
            'The connection to the market daemon is unstable.'
          )}
        </p>
      )}

      {market && (
        <section
          className={cx(
            cardSurface.secondary,
            'flex flex-wrap items-center justify-between gap-x-8 gap-y-4 p-4'
          )}
        >
          <PairHeader
            markets={markets}
            onSelect={chooseMarket}
            registry={
              marketOrders.find((o) => o.registry?.ticker_differs)?.registry ??
              marketOrders[0]?.registry
            }
            selected={current}
          />
          <MarketStats
            bestAsk={asks[0]?.unit_price}
            bestBid={bids[0]?.unit_price}
            last={
              lastTrade ? tradeUnitPrice(lastTrade, knownPrecision) : undefined
            }
            open={marketOrders.length}
          />
        </section>
      )}
      <div
        className={cx(
          'grid min-w-0 items-start gap-4',
          market && 'lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]'
        )}
      >
        <section className={cx(cardSurface.secondary, 'min-w-0')}>
          {book.data === undefined && book.error ? (
            <div className="flex justify-center p-5">
              <Button onClick={refreshAll} type="button" variant="outline">
                {t('p2pMarket.retry', { defaultValue: 'Try again' })}
              </Button>
            </div>
          ) : market ? (
            <OrderBook
              loading={book.data === undefined && !book.error}
              onPick={(order, trigger) => {
                setOfferId(order.order_id)
                setCompose(false)
                focusTicket(trigger)
              }}
              orders={marketOrders}
              pendingRelay={awaitingRelay}
              selectedId={activeOffer?.order_id}
              ticker={market.ticker}
            />
          ) : book.data === undefined ||
            (balance.data === undefined && !balance.error) ? (
            <EmptyState title={tr('book.loading', 'Loading the order book…')} />
          ) : (
            <EmptyState
              action={
                deposit && (
                  <Button onClick={deposit} type="button">
                    {tr('guide.s1Cta', 'Deposit now')}
                  </Button>
                )
              }
              description={tr(
                'market.noMarketsBody',
                'Deposit an RGB asset to publish the first offer.'
              )}
              title={tr('market.noMarkets', 'No offers on your relays yet')}
            />
          )}
        </section>
        {(compose && market) || activeOffer ? (
          <section
            aria-label={
              compose
                ? tr('offers.new', 'New offer')
                : tr('offers.summary', 'Offer summary')
            }
            className={cx(
              cardSurface.secondary,
              'min-w-0 scroll-mt-3 outline-none'
            )}
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
                    onClick={closeTicket}
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
                  key={market.asset_id}
                  limitOnly
                  onOpenFunds={deposit}
                  onPlaced={() => {
                    setCompose(false)
                    refreshAll()
                  }}
                  onReview={setTaking}
                  orders={marketOrders}
                />
              </>
            ) : (
              activeOffer && (
                <OfferSummary
                  network={inf.network}
                  offer={activeOffer}
                  onClose={closeTicket}
                  onReview={(o) => setTaking([o])}
                  taker={inf.npub}
                />
              )
            )}
          </section>
        ) : market ? (
          <Panel label={tr('market.depth', 'Market depth')}>
            <h2 className="mb-2 text-sm font-medium">
              {tr('market.depthTitle', '{{ticker}} depth', {
                ticker: market.ticker,
              })}
            </h2>
            <DepthChart
              loading={book.data === undefined && !book.error}
              orders={marketOrders}
              ticker={market.ticker}
            />
          </Panel>
        ) : null}
      </div>
      <Activity
        balance={balance.data}
        expectedNpub={inf.nostr_profiles ? inf.npub : undefined}
        knownPrecision={knownPrecision}
        onChanged={refreshAll}
        onOpenFunds={deposit}
        orders={mine.data ?? []}
        ordersLoading={mine.data === undefined && !mine.error}
        trades={trades.data ?? []}
        tradesLoading={trades.data === undefined && !trades.error}
      />
      <details
        className="rounded-xl border border-divider/15 bg-surface-card p-4 text-content-primary"
        onToggle={(e) => setAdvanced(e.currentTarget.open)}
      >
        <summary className="cursor-pointer text-sm font-medium">
          {tr('offers.moreTools', 'More tools')}
        </summary>
        {advanced && (
          <div className="mt-3 grid items-start gap-3 lg:grid-cols-2">
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
            <div className="lg:col-span-2">
              <HowItWorks
                active={
                  (mine.data ?? []).length > 0 || (trades.data ?? []).length > 0
                }
                confirmations={inf.min_confirmations}
                funded={funded}
                onDeposit={deposit}
              />
            </div>
            {inf.network === 'signetcustom' && (
              <MosaikBridge network={inf.network} />
            )}
          </div>
        )}
      </details>
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
