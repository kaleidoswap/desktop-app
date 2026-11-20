/**
 * Small presentation primitives for the market, built on the semantic tokens the app already gets
 * from kaleido-ui's CSS (surface-*, content-*, status-*). Layers are told apart by background, not
 * by borders.
 */

import { Check, Loader2, X } from 'lucide-react'
import type { ReactNode } from 'react'

export const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(' ')

export type Tone =
  'success' | 'danger' | 'warning' | 'info' | 'primary' | 'muted'

const toneClass: Record<Tone, string> = {
  danger: 'bg-status-danger-subtle text-status-danger',
  info: 'bg-status-info-subtle text-status-info',
  muted: 'bg-surface-raised text-content-secondary',
  primary: 'bg-primary/15 text-primary',
  success: 'bg-status-success-subtle text-status-success',
  warning: 'bg-status-warning-subtle text-status-warning',
}

export const Pill = ({
  tone = 'muted',
  children,
  className,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) => (
  <span
    className={cx(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-tiny font-medium',
      toneClass[tone],
      className
    )}
  >
    {children}
  </span>
)

export const Panel = ({
  children,
  className,
  label,
}: {
  children: ReactNode
  className?: string
  label?: string
}) => (
  <section
    aria-label={label}
    className={cx('rounded-2xl bg-surface-card/70 p-4', className)}
  >
    {children}
  </section>
)

export const EmptyState = ({
  title,
  description,
  action,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}) => (
  <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
    <p className="text-body font-medium text-content-primary">{title}</p>
    {description && (
      <p className="max-w-sm text-caption text-content-secondary">
        {description}
      </p>
    )}
    {action && <div className="pt-2">{action}</div>}
  </div>
)

export interface SliderMark {
  value: number
  label: string
}

/**
 * A range slider with a filled track, labelled marks to snap to, and a readout. `value` is a
 * position between `min` and `max`; for a few fixed choices pass `step={1}` and a mark per choice.
 */
export const Slider = ({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  marks,
  readout,
  onChange,
  disabled,
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  marks?: SliderMark[]
  readout?: ReactNode
  onChange: (v: number) => void
  disabled?: boolean
}) => {
  const span = Math.max(max - min, 1e-9)
  const pct = Math.min(100, Math.max(0, ((value - min) / span) * 100))
  return (
    <div className={cx('flex flex-col gap-1.5', disabled && 'opacity-50')}>
      <div className="flex items-baseline justify-between">
        <span className="text-caption text-content-secondary">{label}</span>
        {readout && (
          <span className="text-caption font-medium tabular-nums text-content-primary">
            {readout}
          </span>
        )}
      </div>
      <div className="relative flex h-5 items-center">
        <span
          aria-hidden
          className="absolute inset-x-0 h-1.5 rounded-full bg-surface-raised"
        />
        <span
          aria-hidden
          className="absolute left-0 h-1.5 rounded-full bg-primary"
          style={{ width: `${pct}%` }}
        />
        <input
          aria-label={label}
          aria-valuetext={typeof readout === 'string' ? readout : undefined}
          className="relative h-5 w-full cursor-pointer appearance-none bg-transparent outline-none disabled:cursor-not-allowed [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface-card [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow [&:focus-visible::-webkit-slider-thumb]:ring-2 [&:focus-visible::-webkit-slider-thumb]:ring-primary/50"
          disabled={disabled}
          max={max}
          min={min}
          onChange={(e) => onChange(Number(e.target.value))}
          step={step}
          type="range"
          value={value}
        />
      </div>
      {marks && (
        <div className="relative h-4">
          {marks.map((m) => (
            <button
              className={cx(
                'absolute -translate-x-1/2 text-tiny tabular-nums transition-colors hover:text-content-primary',
                Math.abs(m.value - value) < step / 2 + 1e-9
                  ? 'font-medium text-primary'
                  : 'text-content-tertiary'
              )}
              disabled={disabled}
              key={m.value}
              onClick={() => onChange(m.value)}
              style={{ left: `${((m.value - min) / span) * 100}%` }}
              type="button"
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export interface Row {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  emphasis?: boolean
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'muted'
}

const valueTone: Record<NonNullable<Row['tone']>, string> = {
  danger: 'text-status-danger',
  default: 'text-content-primary',
  muted: 'text-content-tertiary',
  success: 'text-status-success',
  warning: 'text-status-warning',
}

/** Label on the left, value on the right, a leader between them: what you pay, what lands. */
export const SummaryRows = ({ rows }: { rows: Row[] }) => (
  <dl className="flex flex-col gap-2">
    {rows.map((r, i) => (
      <div className="flex items-baseline gap-2" key={i}>
        <dt className="text-caption text-content-secondary">{r.label}</dt>
        <span
          aria-hidden
          className="min-w-4 flex-1 translate-y-[-0.2em] border-b border-dotted border-border-subtle"
        />
        <dd
          className={cx(
            'text-right tabular-nums',
            r.emphasis ? 'text-subhead font-medium' : 'text-body',
            valueTone[r.tone ?? 'default']
          )}
        >
          {r.value}
          {r.hint && (
            <span className="ml-2 text-caption text-content-tertiary">
              {r.hint}
            </span>
          )}
        </dd>
      </div>
    ))}
  </dl>
)

export type StepStatus = 'done' | 'active' | 'pending' | 'failed'

export interface Step {
  id: string
  label: string
  description?: ReactNode
  status: StepStatus
}

const dot: Record<StepStatus, string> = {
  active: 'bg-primary/20 text-primary',
  done: 'bg-primary text-text-on-accent',
  failed: 'bg-status-danger text-white',
  pending: 'bg-surface-raised text-content-tertiary',
}

/** A vertical progress list with a line of evidence next to each step. */
export const Steps = ({ steps }: { steps: Step[] }) => (
  <ol aria-live="polite" className="flex flex-col">
    {steps.map((s, i) => (
      <li className="flex gap-3" key={s.id}>
        <div className="flex flex-col items-center">
          <span
            className={cx(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
              dot[s.status]
            )}
          >
            {s.status === 'done' ? (
              <Check size={14} />
            ) : s.status === 'active' ? (
              <Loader2 className="animate-spin" size={14} />
            ) : s.status === 'failed' ? (
              <X size={14} />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
            )}
          </span>
          {i < steps.length - 1 && (
            <span
              aria-hidden
              className={cx(
                'my-1 w-px flex-1',
                s.status === 'done' ? 'bg-primary/50' : 'bg-surface-raised'
              )}
            />
          )}
        </div>
        <div className="pb-4">
          <p
            className={cx(
              'text-body',
              s.status === 'pending'
                ? 'text-content-tertiary'
                : 'text-content-primary',
              s.status === 'active' && 'font-medium'
            )}
          >
            {s.label}
          </p>
          {s.description && (
            <p className="text-caption text-content-secondary">
              {s.description}
            </p>
          )}
        </div>
      </li>
    ))}
  </ol>
)
