import { Button } from 'kaleido-ui'
import { ArrowRight, X } from 'lucide-react'

import { useState } from 'react'

import { useTranslation } from 'react-i18next'

import { NostrAvatar, NostrParticipants } from '../NostrParticipants'
import type { Order } from '../api'
import { takerSettlement } from '../costs'
import { fmtSats, fmtUnits, short, tickerOf } from '../format'

import { useTr } from './hooks'
import { MakerList } from './MakerList'
import { SummaryRows } from './ui'

function MakerIdentity({ offer, network }: { offer: Order; network?: string }) {
  const tr = useTr()
  const [showProfile, setShowProfile] = useState(false)
  const { maker, maker_npub: npub, amount, away, precision } = offer
  return (
    <div className="rounded-xl bg-surface-inset px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <NostrAvatar npub={npub ?? maker} size={32} />
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
  taker,
  network,
  onReview,
  onClose,
}: {
  offer: Order
  taker?: string
  network?: string
  onReview: (order: Order) => void
  onClose: () => void
}) {
  const tr = useTr()
  const { t } = useTranslation()
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
        <Button
          aria-label={t('common.close', { defaultValue: 'Close' })}
          onClick={onClose}
          size="sm"
          type="button"
          variant="quiet"
        >
          <X aria-hidden size={16} />
        </Button>
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
      <NostrParticipants taker={taker} />
      <div className="[&_dd]:shrink-0 [&_dd]:whitespace-nowrap">
        <SummaryRows rows={rows} />
      </div>
      <Button onClick={() => onReview(offer)} type="button">
        {tr('offers.review', 'Review swap')}{' '}
        <ArrowRight aria-hidden size={16} />
      </Button>
    </div>
  )
}
