/** Small pieces shared by the maker screens, on the market's primitives and tokens. */

import { Check, Copy } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Field } from '../market/Field'
import { cx } from '../market/ui'

/** `tm('live.title')` looks up `p2pMaker.live.title`. */
export function useMk() {
  const { t } = useTranslation()
  return useCallback(
    (key: string, vars?: Record<string, string | number>) =>
      t(`p2pMaker.${key}`, vars),
    [t]
  )
}

export const errorText = (e: unknown) =>
  e instanceof Error ? e.message : String(e)

/** A numeric field that keeps what is being typed and hands back numbers. */
export function NumField({
  id,
  label,
  value,
  onChange,
  suffix,
  hint,
  invalid,
}: {
  id: string
  label: string
  value: number
  onChange: (v: number) => void
  suffix?: ReactNode
  hint?: ReactNode
  invalid?: boolean
}) {
  const [text, setText] = useState(() => String(value))
  // follow the value when it changes from outside (another market, a reload)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText((t) => (Number(t) === value ? t : String(value)))
  }, [value])
  return (
    <Field
      hint={hint}
      id={id}
      invalid={invalid}
      label={label}
      onChange={(v) => {
        const clean = v.replace(',', '.')
        setText(clean)
        const n = Number(clean)
        if (clean.trim() !== '' && Number.isFinite(n)) onChange(n)
      }}
      suffix={suffix}
      value={text}
    />
  )
}

export function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  mono,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-caption text-content-secondary" htmlFor={id}>
        {label}
      </label>
      <input
        autoComplete="off"
        className={cx(
          'rounded-xl bg-surface-inset px-3 py-2.5 text-body text-content-primary outline-none placeholder:text-content-tertiary focus:ring-2 focus:ring-primary/40',
          mono && 'font-mono text-caption'
        )}
        id={id}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        value={value}
      />
      {hint && <p className="text-caption text-content-tertiary">{hint}</p>}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: ReactNode
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        aria-checked={checked}
        className={cx(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-content-tertiary/40'
        )}
        onClick={() => onChange(!checked)}
        role="switch"
        type="button"
      >
        <span
          className={cx(
            'absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5'
          )}
        />
      </button>
      <span className="flex flex-col">
        <span className="text-body text-content-primary">{label}</span>
        {description && (
          <span className="text-caption text-content-tertiary">
            {description}
          </span>
        )}
      </span>
    </label>
  )
}

/** One of a few choices, shown as a card with a short explanation. */
export function ChoiceCard({
  selected,
  onSelect,
  title,
  badge,
  children,
  disabled,
}: {
  selected: boolean
  onSelect: () => void
  title: ReactNode
  badge?: ReactNode
  children?: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      aria-pressed={selected}
      className={cx(
        'flex flex-col gap-2 rounded-2xl p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        selected
          ? 'bg-primary/10 ring-2 ring-primary'
          : 'bg-surface-inset hover:bg-surface-raised'
      )}
      disabled={disabled}
      onClick={onSelect}
      type="button"
    >
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className={cx(
            'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
            selected ? 'border-primary bg-primary' : 'border-border-default'
          )}
        >
          {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
        </span>
        <span className="text-body font-medium text-content-primary">
          {title}
        </span>
        {badge}
      </span>
      {children && (
        <span className="pl-6 text-caption text-content-secondary">
          {children}
        </span>
      )}
    </button>
  )
}

/** A long code to hand over: shown whole, selectable, with a copy button. */
export function CopyBox({ value, label }: { value: string; label: string }) {
  const tm = useMk()
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-start gap-2 rounded-xl bg-surface-inset p-3">
      <code
        aria-label={label}
        className="min-w-0 flex-1 break-all font-mono text-tiny text-content-secondary"
      >
        {value}
      </code>
      <button
        aria-label={tm('common.copy')}
        className="shrink-0 rounded-lg p-1.5 text-content-tertiary transition-colors hover:bg-surface-raised hover:text-content-primary"
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          })
        }}
        type="button"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  )
}

export const SectionTitle = ({
  children,
  hint,
}: {
  children: ReactNode
  hint?: ReactNode
}) => (
  <div className="flex flex-col gap-0.5">
    <h3 className="text-subhead font-semibold text-content-primary">
      {children}
    </h3>
    {hint && <p className="text-caption text-content-secondary">{hint}</p>}
  </div>
)

export const pct = (bps: number) =>
  `${(bps / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`

export const dateTime = (secs: number) =>
  new Date(secs * 1000).toLocaleString(undefined, {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  })
