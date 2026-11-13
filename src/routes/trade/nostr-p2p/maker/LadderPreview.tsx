import { fmtPrice, fmtSats } from '../format'
import { cx, Pill } from '../market/ui'

import { useMk } from './parts'
import { ladder, type LadderLevel, type StrategyForm } from './strategy'

/**
 * The quotes the strategy would put up around `reference`: asks above, bids below, each bar as
 * long as its size. Levels the daily cap leaves out are struck through; levels an issuer-set band
 * would have the signer refuse are flagged.
 */
export function LadderPreview({
  form,
  reference,
  holding,
}: {
  form: StrategyForm
  reference: number
  holding?: number
}) {
  const tm = useMk()
  if (!(reference > 0)) {
    return (
      <p className="py-8 text-center text-caption text-content-tertiary">
        {tm('strategy.previewNoPrice')}
      </p>
    )
  }
  const { center, levels } = ladder(form, reference, holding)
  const asks = levels.filter((l) => l.side === 'ask').reverse()
  const bids = levels.filter((l) => l.side === 'bid')
  const biggest = Math.max(1e-9, ...levels.map((l) => l.size))
  const ticker = form.ticker || tm('common.units')
  const shifted = Math.abs(center - reference) / reference > 1e-9

  const row = (l: LadderLevel) => (
    <li
      className={cx(
        'grid grid-cols-[5.5rem_1fr_6rem] items-center gap-2 text-caption tabular-nums',
        l.capped && 'opacity-40 line-through'
      )}
      key={`${l.side}${l.index}`}
    >
      <span
        className={
          l.side === 'ask' ? 'text-status-danger' : 'text-status-success'
        }
      >
        {fmtPrice(l.price)}
      </span>
      <span className="relative h-4">
        <span
          className={cx(
            'absolute inset-y-0 left-0 rounded',
            l.outsideBand
              ? 'bg-status-warning/60'
              : l.side === 'ask'
                ? 'bg-status-danger/30'
                : 'bg-status-success/30'
          )}
          style={{ width: `${Math.max(4, (l.size / biggest) * 100)}%` }}
        />
        <span className="relative pl-1.5 text-content-primary">
          {l.size.toLocaleString('en-US', {
            maximumFractionDigits: form.precision,
          })}{' '}
          {ticker}
        </span>
      </span>
      <span className="text-right text-content-tertiary">
        {fmtSats(l.totalSat)} sat
      </span>
    </li>
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[5.5rem_1fr_6rem] gap-2 text-tiny uppercase tracking-wide text-content-tertiary">
        <span>{tm('strategy.previewPrice')}</span>
        <span>{tm('strategy.previewSize')}</span>
        <span className="text-right">{tm('strategy.previewTotal')}</span>
      </div>
      <ol className="flex flex-col gap-1">{asks.map(row)}</ol>
      <div className="flex items-center gap-2 py-1">
        <span className="h-px flex-1 bg-primary/40" />
        <span className="text-caption font-medium tabular-nums text-primary">
          {tm('strategy.reference')} {fmtPrice(reference)} sat
        </span>
        {shifted && (
          <Pill tone="info">
            {tm('strategy.skewedTo', { price: fmtPrice(center) })}
          </Pill>
        )}
        <span className="h-px flex-1 bg-primary/40" />
      </div>
      <ol className="flex flex-col gap-1">{bids.map(row)}</ol>
      {levels.some((l) => l.outsideBand) && (
        <p className="text-caption text-status-warning">
          {tm('strategy.outsideBand')}
        </p>
      )}
      {levels.some((l) => l.capped) && (
        <p className="text-caption text-content-tertiary">
          {tm('strategy.cappedLevels')}
        </p>
      )}
    </div>
  )
}
