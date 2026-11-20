import type { ReactNode } from 'react'

import { cx } from './ui'

interface Props {
  label: string
  value: string
  onChange?: (v: string) => void
  suffix?: ReactNode
  placeholder?: string
  readOnly?: boolean
  hint?: ReactNode
  invalid?: boolean
  id: string
}

/** A labelled numeric field with its unit at the end. */
export function Field({
  label,
  value,
  onChange,
  suffix,
  placeholder = '0',
  readOnly,
  hint,
  invalid,
  id,
}: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-caption text-content-secondary" htmlFor={id}>
        {label}
      </label>
      <div
        className={cx(
          'flex items-center gap-2 rounded-xl bg-surface-inset px-3 py-2.5 transition-shadow focus-within:ring-2 focus-within:ring-primary/40',
          invalid && 'ring-2 ring-status-danger/50',
          readOnly && 'opacity-80'
        )}
      >
        <input
          aria-invalid={invalid || undefined}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-subhead font-medium tabular-nums text-content-primary outline-none placeholder:text-content-tertiary"
          id={id}
          inputMode="decimal"
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          spellCheck={false}
          value={value}
        />
        {suffix && (
          <span className="shrink-0 text-caption text-content-tertiary">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-caption text-content-tertiary">{hint}</p>}
    </div>
  )
}
