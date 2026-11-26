import { Check, ChevronDown, Search } from 'lucide-react'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

export interface PickerOption {
  value: string
  title: string
  subtitle?: string
  /** Small marks next to the title: a listed badge, a warning. */
  badge?: ReactNode
  /** Right-aligned detail: a balance, a count. */
  trailing?: ReactNode
  /** Leading mark: a coloured dot, an icon. */
  leading?: ReactNode
  /** Extra words the search matches (an asset id, a full name). */
  keywords?: string
}

interface Props {
  label: string
  value: string
  options: PickerOption[]
  onChange: (value: string) => void
  /** Offer a search box once the list is this long. */
  searchFrom?: number
  searchPlaceholder?: string
  emptyText?: string
  /** Shown under the list, such as an action that adds an entry. */
  footer?: (close: () => void) => ReactNode
  /** How the closed picker looks: `field` inside a form, `pill` in a toolbar or menu. */
  variant?: 'field' | 'pill' | 'market'
  className?: string
}

/**
 * A button that opens a list to choose from: what is chosen stays readable (title, detail, badges),
 * the list can carry more than a native select (balances, warnings, actions), and it works from the
 * keyboard (arrows, Enter, Escape, typing to search).
 */
export function Picker({
  label,
  value,
  options,
  onChange,
  searchFrom = 8,
  searchPlaceholder = 'Search',
  emptyText = 'Nothing matches',
  footer,
  variant = 'field',
  className = '',
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected = options.find((o) => o.value === value)
  const searchable = options.length >= searchFrom

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) =>
      `${o.title} ${o.subtitle ?? ''} ${o.keywords ?? ''}`
        .toLowerCase()
        .includes(q)
    )
  }, [options, query])

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const openList = () => {
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value)
      )
    )
    setOpen(true)
  }

  const choose = (v: string) => {
    onChange(v)
    close()
  }

  const onKey = (e: KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openList()
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(shown.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const o = shown[active]
      if (o) choose(o.value)
    }
  }

  const trigger =
    variant === 'market'
      ? 'min-h-9 max-w-full rounded-lg text-xl font-semibold tracking-tight text-foreground hover:bg-foreground/5 sm:text-2xl'
      : variant === 'pill'
        ? 'min-h-10 rounded-full border border-divider/30 bg-surface-elevated px-3 text-sm'
        : 'min-h-11 w-full rounded-xl border border-divider/30 bg-surface-elevated px-3 text-sm'

  return (
    <div className={`relative ${className}`} onKeyDown={onKey} ref={root}>
      <button
        aria-controls={open ? listId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
        className={`flex items-center gap-2 text-left ${variant === 'market' ? '' : 'text-content-primary'} transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${trigger}`}
        onClick={() => (open ? close() : openList())}
        type="button"
      >
        {variant !== 'market' && selected?.leading}
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="truncate font-medium">
            {selected?.title ?? label}
          </span>
          {selected?.badge}
        </span>
        <ChevronDown
          className={`h-4 w-4 flex-none ${variant === 'market' ? 'text-muted-foreground' : 'text-content-tertiary'} transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          className={`absolute z-50 mt-1.5 flex max-h-96 w-max min-w-full flex-col overflow-hidden rounded-xl border border-divider/20 bg-surface-elevated shadow-2xl shadow-black/40 ${variant === 'market' ? 'left-0 max-w-[min(22rem,65vw)]' : 'right-0 max-w-[22rem]'}`}
        >
          {searchable && (
            <div className="flex items-center gap-2 border-b border-divider/10 px-3 py-2">
              <Search className="h-4 w-4 text-content-tertiary" />
              <input
                aria-label={searchPlaceholder}
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-sm text-content-primary outline-none placeholder:text-content-tertiary"
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActive(0)
                }}
                placeholder={searchPlaceholder}
                value={query}
              />
            </div>
          )}
          <ul
            aria-label={label}
            className="flex flex-col overflow-y-auto p-1"
            id={listId}
            role="listbox"
          >
            {shown.map((o, i) => (
              <li
                aria-selected={o.value === value}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 ${
                  i === active ? 'bg-surface-overlay/60' : ''
                }`}
                key={o.value}
                onClick={() => choose(o.value)}
                onMouseEnter={() => setActive(i)}
                role="option"
              >
                {o.leading}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-content-primary">
                    <span className="truncate">{o.title}</span>
                    {o.badge}
                  </span>
                  {o.subtitle && (
                    <span className="truncate text-xs text-content-tertiary">
                      {o.subtitle}
                    </span>
                  )}
                </span>
                {o.trailing && (
                  <span className="text-right text-xs text-content-secondary">
                    {o.trailing}
                  </span>
                )}
                <Check
                  aria-hidden
                  className={`h-4 w-4 flex-none text-primary ${o.value === value ? '' : 'invisible'}`}
                />
              </li>
            ))}
            {shown.length === 0 && (
              <li className="px-3 py-3 text-sm text-content-tertiary">
                {emptyText}
              </li>
            )}
          </ul>
          {footer && (
            <div className="border-t border-divider/10 p-1">
              {footer(close)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
