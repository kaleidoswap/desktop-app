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
  const feeWho = (yours: boolean) =>
    yours
      ? tr('cost.youReserveFee', 'You reserve this')
      : tr('cost.takerPaysFee', 'Reserved by whoever takes the order')
  const feeHint = (estimate: boolean | undefined, yours: boolean) =>
    [
      estimate ? tr('cost.estimate', 'Estimate, not an accepted offer') : null,
      feeWho(yours),
    ]
      .filter(Boolean)
      .join(' · ')

  const rows: Row[] = [
    ...(asset
      ? [
          {
            label:
              s.side === 'buy'
                ? tr('cost.receiveAsset', 'You receive')
                : tr('cost.giveAsset', 'You give'),
            value: asset,
          },
        ]
      : []),
    {
      hint: priceHint,
      label: tr('cost.price', 'Price'),
      value: money(s.priceSat),
    },
    {
      hint:
        s.platformFeeSat === null
          ? tr('cost.notReported', 'Not reported')
          : [
              s.platformFromLegacy
                ? tr('cost.legacyPlatform', 'Recorded platform fee')
                : null,
              feeHint(estimates?.platform, s.youPayFees),
            ]
              .filter(Boolean)
              .join(' · '),
      label: tr('cost.platform', 'Platform fee'),
      value: money(s.platformFeeSat),
    },
    {
      hint:
        s.networkFeeSat === null
          ? tr('cost.notReported', 'Not reported')
          : feeHint(estimates?.network, s.youPayFees),
      label: tr('cost.network', 'Network fee'),
      value: money(s.networkFeeSat),
    },
    {
      hint:
        s.rgbOutputSat === null
          ? tr('cost.notReported', 'Not reported')
          : s.youFundRgb
            ? tr(
                'cost.rgbYours',
                'Not a fee. Stays in your wallet with the asset.'
              )
            : tr(
                'cost.rgbBuyer',
                'Not a fee. The buyer keeps this with the asset.'
              ),
      label: tr('cost.rgb', 'RGB output'),
      value: money(s.rgbOutputSat),
    },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-surface-inset px-3 py-2.5">
          <p className="text-tiny text-content-tertiary">
            {tr('cost.reserved', 'Reserved')}
          </p>
          <p className="text-xl font-semibold tabular-nums text-content-primary">
            {s.reserveSat === null ? unavailable : sats(s.reserveSat)}
          </p>
          <p className="text-caption text-content-secondary">
            {s.reserveSat === null
              ? tr(
                  'cost.reserveMissing',
                  'A part of this was not reported, so it is not shown as zero.'
                )
              : s.retainedSat
                ? tr(
                    'cost.reserveKeeps',
                    'Set aside from your balance. {{n}} sats of it stay in your wallet with the asset.',
                    { n: fmtSats(s.retainedSat) }
                  )
                : tr(
                    'cost.reservePlain',
                    'Set aside from your balance. This is not the price you receive.'
                  )}
          </p>
        </div>
        <div className="rounded-xl bg-surface-inset px-3 py-2.5">
          <p className="text-tiny text-content-tertiary">
            {s.side === 'sell'
              ? tr('cost.gross', 'Price you receive')
              : tr('cost.btcBack', 'Bitcoin you are paid')}
          </p>
          <p className="text-xl font-semibold tabular-nums text-content-primary">
            {s.receiveSat === null ? unavailable : sats(s.receiveSat)}
          </p>
          <p className="text-caption text-content-secondary">
            {s.side === 'sell'
              ? tr(
                  'cost.grossHelp',
                  'The full price. Bitcoin you reserve is not subtracted from it.'
                )
              : tr(
                  'cost.buyerPaidAsset',
                  'You are paid in the asset, not in bitcoin.'
                )}
          </p>
        </div>
      </div>
      <SummaryRows rows={rows} />
    </div>
  )
}
