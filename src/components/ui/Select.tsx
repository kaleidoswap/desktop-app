import { ChevronDown } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { twJoin } from 'tailwind-merge'

export interface SelectOption {
  label: string
  value: string
}

export interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  icon?: ReactNode
  className?: string
  disabled?: boolean
}

export const Select = ({
  value,
  onChange,
  options,
  icon,
  className,
  disabled,
}: SelectProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={twJoin('relative', className)} ref={ref}>
      <button
        className={twJoin(
          'flex items-center gap-2 w-full py-2 text-sm pl-3 pr-3',
          'border border-border-default/50 rounded-lg bg-surface-overlay/30',
          'text-white transition-all duration-200',
          'focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20',
          isOpen && 'border-primary/50 ring-1 ring-primary/20',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((o) => !o)}
        type="button"
      >
        {icon && (
          <span className="text-content-secondary flex-shrink-0">{icon}</span>
        )}
        <span className="flex-1 text-left truncate">{selectedLabel}</span>
        <ChevronDown
          className={twJoin(
            'h-4 w-4 text-content-secondary flex-shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-max rounded-lg border border-border-default/50 bg-blue-darker shadow-xl overflow-hidden">
          {options.map((option) => (
            <button
              className={twJoin(
                'w-full text-left px-3 py-2 text-sm transition-colors duration-150',
                option.value === value
                  ? 'text-primary bg-primary/10'
                  : 'text-white hover:bg-surface-high/60'
              )}
              key={option.value}
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
