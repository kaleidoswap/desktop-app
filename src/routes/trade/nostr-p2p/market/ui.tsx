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
