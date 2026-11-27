import type { Settlement } from '../costs'
import { fmtSats } from '../format'

import { useTr } from './hooks'
import { SummaryRows, type Row } from './ui'

interface Props {
  settlement: Settlement
  /** Asset amount already formatted, such as "100 DEMO". */
  asset?: string
  /** Unit price, such as "100 sats / DEMO". */
  priceHint?: string
  /** Figures taken from the current schedule, not from an accepted offer. */
  estimates?: { network?: boolean; platform?: boolean }
}

const sats = (n: number) => `${fmtSats(n)} sats`

/**
 * Price, the two fees, and the RGB output, then what is reserved and the gross
 * bitcoin received. Those last two stay separate: reserving a fee is not a
 * discount on the price.
 */
export function CostBreakdown({
  settlement: s,
  asset,
  priceHint,
  estimates,
}: Props) {
  const tr = useTr()
  const unavailable = tr('cost.unavailable', 'Unavailable')
  const money = (n: number | null) => (n === null ? unavailable : sats(n))
  const buying = s.side === 'buy'
  const estimate = tr('cost.estimateShort', 'Estimate')

  const rows: Row[] = [
    ...(!buying && asset
      ? [
          {
            label: tr('offers.pay', 'You pay'),
            value: asset,
          },
        ]
      : []),
    {
      hint: priceHint,
      label: tr('ticket.price', 'Price'),
      value: money(s.priceSat),
    },
    {
      hint:
        s.platformFromLegacy && s.platformFeeSat !== null
          ? tr('cost.recordedFee', 'From trade history')
          : estimates?.platform
            ? estimate
            : undefined,
      label: tr('cost.platform', 'Platform fee'),
      value: money(s.platformFeeSat),
    },
    {
      hint: estimates?.network ? estimate : undefined,
      label: tr('cost.network', 'Network fee'),
      value: money(s.networkFeeSat),
    },
    {
      label: s.youFundRgb
        ? tr('offers.retained', 'Sats kept with the RGB asset')
        : tr('cost.buyerOutput', 'Sat retained by the buyer with the asset'),
      value: money(s.rgbOutputSat),
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-surface-inset px-3 py-2.5">
          <dt className="text-caption text-content-secondary">
            {tr('offers.reserve', 'Bitcoin to reserve')}
          </dt>
          <dd className="text-lg font-semibold tabular-nums text-content-primary">
            {money(s.reserveSat)}
          </dd>
        </div>
        <div className="rounded-xl bg-surface-inset px-3 py-2.5">
          <dt className="text-caption text-content-secondary">
            {tr('offers.receive', 'You receive')}
          </dt>
          <dd className="break-words text-lg font-semibold tabular-nums text-content-primary">
            {buying ? (asset ?? unavailable) : money(s.receiveSat)}
          </dd>
        </div>
      </dl>
      <SummaryRows rows={rows} />
      {!s.youPayFees && (
        <p className="text-caption text-content-secondary">
          {tr(
            'cost.feesByTaker',
            'The trader who accepts the offer reserves both fees.'
          )}
        </p>
      )}
    </div>
  )
}
