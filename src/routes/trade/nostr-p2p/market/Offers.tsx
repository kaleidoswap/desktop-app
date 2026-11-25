import { AlertTriangle, ArrowRight, ContactRound } from 'lucide-react'

import { useState } from 'react'

import type { Order, Side } from '../api'
import { takerSettlement } from '../costs'
import {
  fmtPrice,
  fmtSats,
  fmtUnits,
  short,
  tickerOf,
  timeLeft,
} from '../format'

import { useTr } from './hooks'
import { MakerList } from './MakerList'
import { EmptyState, Pill, SummaryRows, cx } from './ui'

interface OffersProps {
  loading: boolean
  offers: Order[]
  side: Side
  ticker: string
  selected?: Order
  onSelect: (order: Order) => void
  onSide: (side: Side) => void
}

export function Offers({
  loading,
  offers,
  side,
  ticker,
  selected,
  onSelect,
  onSide,
}: OffersProps) {
  const tr = useTr()
  return (
    <div className="min-w-0 pb-3">
      <div className="mx-4 my-4 inline-flex rounded-lg bg-surface-inset p-1">
        {(['buy', 'sell'] as const).map((s) => (
          <button
            aria-pressed={side === s}
            className={cx(
              'rounded-md px-5 py-1.5 text-sm font-semibold transition-colors',
              side === s
                ? 'bg-status-success-subtle text-status-success'
                : 'text-content-secondary hover:bg-surface-raised'
            )}
            key={s}
            onClick={() => onSide(s)}
            type="button"
          >
            {s === 'buy' ? tr('ticket.buy', 'Buy') : tr('ticket.sell', 'Sell')}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[1.1fr_1fr_.65fr] gap-3 border-y border-divider/15 px-5 py-2 text-caption text-content-secondary">
        <span>{tr('offers.pricePerUnit', 'Price / unit')}</span>
        <span>{tr('offers.quantity', 'Quantity')}</span>
        <span className="text-right">{tr('offers.expires', 'Expires in')}</span>
      </div>
      {loading ? (
        <EmptyState title={tr('book.loading', 'Loading the order book…')} />
      ) : !offers.length ? (
        <EmptyState
          title={
            side === 'buy'
              ? tr('book.noSellers', 'No sellers yet')
              : tr('book.noBuyers', 'No buyers yet')
          }
        />
      ) : (
        <ul className="max-h-[29rem] overflow-y-auto px-2 pt-1">
          {offers.map((o) => (
            <li key={o.order_id}>
              <button
                aria-pressed={selected?.order_id === o.order_id}
                className={cx(
                  'grid w-full grid-cols-[1.1fr_1fr_.65fr] items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-primary',
                  selected?.order_id === o.order_id
                    ? 'border-status-success/35 bg-status-success-subtle'
                    : 'border-transparent hover:bg-surface-raised'
                )}
                onClick={() => onSelect(o)}
                type="button"
              >
                <span className="min-w-0">
                  <strong className="text-content-primary">
                    {fmtPrice(o.unit_price)} sat
                  </strong>
                  <span
                    className="mt-0.5 flex items-center gap-1 font-mono text-tiny text-content-secondary"
                    title={o.maker_npub ?? o.maker}
                  >
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
                    {short(o.maker_npub ?? o.maker, 4)}
                  </span>
                </span>
                <span className="min-w-0 break-words text-content-primary">
                  {fmtUnits(o.amount, o.precision)}{' '}
                  <small className="text-content-secondary">{ticker}</small>
                  {o.impersonates && (
                    <AlertTriangle
                      aria-label={tr(
                        'book.imitation',
                        'Possible imitation of a verified asset'
                      )}
                      className="ml-1 inline h-3 w-3 text-status-danger"
                    />
                  )}
                </span>
                <span className="text-right text-content-secondary">
                  {timeLeft(o.expiry)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function MakerIdentity({ offer, network }: { offer: Order; network?: string }) {
  const tr = useTr()
  const [showProfile, setShowProfile] = useState(false)
  const { maker, maker_npub: npub, amount, away, precision } = offer
  return (
    <div className="rounded-xl bg-surface-inset px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <ContactRound
            aria-hidden
            className="shrink-0 text-primary"
            size={16}
          />
          <div className="min-w-0">
            <p className="text-caption font-medium text-content-secondary">
              {tr('offers.nostrMaker', 'Maker on Nostr')}
            </p>
            <span
              className="font-mono text-sm text-content-primary"
              title={npub ?? maker}
            >
              {short(npub ?? maker, 6)}
            </span>
          </div>
        </div>
        {npub && (
          <button
            aria-expanded={showProfile}
            className="rounded-lg border border-divider/25 px-2 py-1 text-caption font-medium text-content-primary hover:bg-surface-raised"
            onClick={() => setShowProfile(!showProfile)}
            type="button"
          >
            {showProfile
              ? tr('offers.hideProfile', 'Hide profile')
              : network === 'signetcustom'
                ? tr('reputation.open', 'Nostr profile and reputation')
                : tr('offers.nostrProfile', 'View Nostr profile')}
          </button>
        )}
      </div>
      {npub && showProfile && (
        <div className="mt-3 flex flex-col gap-2">
          <code className="select-all break-all text-caption text-content-secondary">
            {npub}
          </code>
          <MakerList
            assetId={offer.asset_id}
            makers={[{ amount, away, maker, npub }]}
            network={network}
            precision={precision}
            ticker={tickerOf(offer)}
          />
        </div>
      )}
    </div>
  )
}

export function OfferSummary({
  offer,
  network,
  onReview,
}: {
  offer?: Order
  network?: string
  onReview: (order: Order) => void
}) {
  const tr = useTr()
  if (!offer) {
    return (
      <EmptyState
        description={tr(
          'offers.chooseHint',
          'Choose an available offer to review its price and fees.'
        )}
        title={tr('offers.summary', 'Offer summary')}
      />
    )
  }

  const costs = takerSettlement(offer)
  const btc = (value: number | null) =>
    value === null
      ? tr('cost.unavailable', 'Unavailable')
      : `${fmtSats(value)} sat`
  const asset = `${fmtUnits(offer.amount, offer.precision)} ${tickerOf(offer)}`
  const buying = costs.side === 'buy'
  const rows = [
    {
      label: tr('cost.platform', 'Platform fee'),
      value: btc(costs.platformFeeSat),
    },
    {
      label: tr('cost.network', 'Network fee'),
      value: btc(costs.networkFeeSat),
    },
    ...(buying
      ? [
          {
            label: tr('offers.retained', 'Sats kept with the RGB asset'),
            value: btc(costs.retainedSat),
          },
        ]
      : []),
    {
      label: tr('offers.reserve', 'Bitcoin to reserve'),
      value: btc(costs.reserveSat),
    },
  ]

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-content-primary">
          {tr('offers.summary', 'Offer summary')}
        </h2>
        <Pill>{tr('offers.onchain', 'On-chain')}</Pill>
      </div>
      <dl className="grid grid-cols-2 gap-4 border-b border-divider/15 pb-4">
        <div>
          <dt className="mb-1 text-caption text-content-secondary">
            {tr('offers.pay', 'You pay')}
          </dt>
          <dd className="break-words text-lg font-bold tabular-nums text-content-primary">
            {buying ? btc(costs.priceSat) : asset}
          </dd>
        </div>
        <div>
          <dt className="mb-1 text-caption text-content-secondary">
            {tr('offers.receive', 'You receive')}
          </dt>
          <dd className="break-words text-lg font-bold tabular-nums text-status-success">
            {buying ? asset : btc(costs.receiveSat)}
          </dd>
        </div>
      </dl>
      <MakerIdentity
        key={offer.maker_npub ?? offer.maker}
        network={network}
        offer={offer}
      />
      <div className="[&_dd]:shrink-0 [&_dd]:whitespace-nowrap">
        <SummaryRows rows={rows} />
      </div>
      <button
        className="flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#8deaba] px-4 py-2 text-sm font-bold text-[#113d2b] hover:bg-[#79ddab]"
        onClick={() => onReview(offer)}
        type="button"
      >
        {tr('offers.review', 'Review swap')}{' '}
        <ArrowRight aria-hidden size={16} />
      </button>
    </div>
  )
}
