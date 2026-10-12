import { ArrowRight } from 'lucide-react'

import { cx } from './ui'

interface Props {
  send: string
  receive: string
  /** Confirmations on the swap transaction, or null before it is broadcast. */
  confirmations: number | null
  required: number
  settled: boolean
  failed: boolean
}

/**
 * The idea of the product in one picture: what you send and what you receive meet in a single
 * Bitcoin transaction, so both happen or neither does. Once the transaction is out, one pip per
 * confirmation fills in.
 */
export function SwapGlyph({
  send,
  receive,
  confirmations,
  required,
  settled,
  failed,
}: Props) {
  const pips = Math.max(required, 1)
  const filled = settled ? pips : Math.min(confirmations ?? 0, pips)
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl bg-surface-inset p-4">
      <div className="min-w-0 text-left">
        <p className="text-tiny text-content-tertiary">You send</p>
        <p className="truncate text-subhead font-medium tabular-nums text-content-primary">
          {send}
        </p>
      </div>

      <div className="flex flex-col items-center gap-1.5 px-1">
        <div
          className={cx(
            'flex items-center gap-1.5 rounded-xl px-3 py-2 transition-colors',
            failed
              ? 'bg-status-danger-subtle text-status-danger'
              : settled
                ? 'bg-primary/20 text-primary'
                : confirmations !== null
                  ? 'bg-primary/10 text-primary'
                  : 'bg-surface-raised text-content-secondary'
          )}
        >
          <ArrowRight aria-hidden size={14} />
          <span className="text-caption font-medium">
            One Bitcoin transaction
          </span>
          <ArrowRight aria-hidden size={14} />
        </div>
        {confirmations !== null && required > 0 && (
          <div
            aria-label={`${filled} of ${pips} confirmations`}
            className="flex items-center gap-1"
          >
            {Array.from({ length: pips }, (_, i) => (
              <span
                className={cx(
                  'h-1.5 w-5 rounded-full transition-colors',
                  i < filled ? 'bg-primary' : 'bg-content-tertiary/30'
                )}
                key={i}
              />
            ))}
          </div>
        )}
      </div>

      <div className="min-w-0 text-right">
        <p className="text-tiny text-content-tertiary">You receive</p>
        <p className="truncate text-subhead font-medium tabular-nums text-status-success">
          {receive}
        </p>
      </div>
    </div>
  )
}
