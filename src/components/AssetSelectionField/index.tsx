import { X, Trash2 } from 'lucide-react'
import React, { useState, useCallback, useRef, useEffect } from 'react'
import { twJoin } from 'tailwind-merge'

interface AssetSelectionFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  precision?: number
  maxBalance?: number
  placeholder?: string
  className?: string
  disabled?: boolean
  error?: string
}

export const AssetSelectionField: React.FC<AssetSelectionFieldProps> = ({
  label,
  value,
  onChange,
  precision = 0,
  maxBalance,
  placeholder = '0.00',
  className = '',
  disabled = false,
  error,
}) => {
  const [isFocused, setIsFocused] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Initialize input value from props
  useEffect(() => {
    if (value && !isFocused) {
      // Convert raw value back to display format when not focused
      const numValue = parseFloat(value) || 0
      setInputValue(numValue > 0 ? numValue.toString() : '')
    }
  }, [value, isFocused])

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value

      // Allow empty input
      if (newValue === '') {
        setInputValue('')
        return
      }

      // Validate decimal input based on precision
      const decimalRegex =
        precision > 0 ? new RegExp(`^\\d*\\.?\\d{0,${precision}}$`) : /^\d*$/

      if (decimalRegex.test(newValue)) {
        setInputValue(newValue)
      }
    },
    [precision]
  )

  const handleFocus = useCallback(() => {
    setIsFocused(true)
    // Convert value to display format when focusing
    if (value) {
      const numValue = parseFloat(value) || 0
      setInputValue(numValue > 0 ? numValue.toString() : '')
    }
  }, [value])

  const handleBlur = useCallback(() => {
    setIsFocused(false)
    // Only update the parent when we lose focus and have a valid value
    if (inputValue) {
      const numValue = parseFloat(inputValue) || 0
      onChange(numValue.toString())
    } else {
      onChange('')
    }
  }, [inputValue, onChange])

  const handleClear = useCallback(() => {
    setInputValue('')
    onChange('')
    inputRef.current?.focus()
  }, [onChange])

  const handleQuickAmount = useCallback(
    (percentage: number) => {
      if (maxBalance && maxBalance > 0) {
        const amount = maxBalance * percentage
        const formattedAmount =
          precision > 0 ? amount.toFixed(precision) : amount.toString()
        setInputValue(formattedAmount)
        onChange(formattedAmount)
        inputRef.current?.focus()
      }
    },
    [maxBalance, onChange, precision]
  )

  const handleMaxAmount = useCallback(() => {
    if (maxBalance && maxBalance > 0) {
      const formattedAmount =
        precision > 0 ? maxBalance.toFixed(precision) : maxBalance.toString()
      setInputValue(formattedAmount)
      onChange(formattedAmount)
      inputRef.current?.focus()
    }
  }, [maxBalance, onChange, precision])

  // Focus input when clicking on the container
  const handleContainerClick = useCallback(() => {
    if (!disabled) {
      inputRef.current?.focus()
    }
  }, [disabled])

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      // Clear on Escape
      if (event.key === 'Escape') {
        handleClear()
        event.preventDefault()
      }
      // Select all on Ctrl+A / Cmd+A
      else if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
        inputRef.current?.select()
        event.preventDefault()
      }
      // Handle Enter to confirm input
      else if (event.key === 'Enter') {
        inputRef.current?.blur()
        event.preventDefault()
      }
    },
    [handleClear]
  )

  // Use inputValue when focused, otherwise show formatted value
  const displayValue = isFocused
    ? inputValue
    : value
      ? (parseFloat(value) || 0).toString()
      : ''
  const hasValue = displayValue && displayValue !== '0'

  return (
    <div className={twJoin('w-full', className)}>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-slate-300">{label}</label>
        {maxBalance && maxBalance > 0 && (
          <span className="text-xs text-slate-500">
            Max: {maxBalance.toFixed(precision)}
          </span>
        )}
      </div>

      <div
        className={twJoin(
          'relative group cursor-text',
          'bg-slate-900/70 border rounded-xl transition-all duration-200',
          'backdrop-blur-sm min-h-[48px]',
          isFocused || hasValue
            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-slate-800/90'
            : 'border-slate-600/50 hover:border-slate-500/70',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
          error ? 'border-red-500/50 ring-2 ring-red-500/20' : ''
        )}
        onClick={handleContainerClick}
      >
        <input
          className={twJoin(
            'w-full px-4 py-3 bg-transparent text-white text-lg font-medium',
            'placeholder:text-slate-500 border-none outline-none',
            'pr-16' // Make room for clear button
          )}
          disabled={disabled}
          inputMode="decimal"
          onBlur={handleBlur}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          ref={inputRef}
          type="text"
          value={displayValue}
        />

        {/* Clear button */}
        {hasValue && !disabled && (
          <button
            className={twJoin(
              'absolute right-3 top-1/2 -translate-y-1/2',
              'p-1.5 rounded-lg transition-all duration-200',
              'text-slate-400 hover:text-slate-300',
              'hover:bg-slate-700/50 opacity-0 group-hover:opacity-100',
              isFocused ? 'opacity-100' : ''
            )}
            onClick={handleClear}
            title="Clear amount (ESC)"
            type="button"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Quick amount buttons */}
      {maxBalance && maxBalance > 0 && !disabled && (
        <div className="flex gap-2 mt-3">
          <button
            className={twJoin(
              'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200',
              'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 hover:text-white',
              'border border-slate-600/30 hover:border-slate-500/50'
            )}
            onClick={handleClear}
            type="button"
          >
            <Trash2 className="w-3 h-3 mr-1 inline" />
            Clear
          </button>
          <button
            className={twJoin(
              'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200',
              'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300',
              'border border-blue-500/30 hover:border-blue-500/50'
            )}
            onClick={() => handleQuickAmount(0.25)}
            type="button"
          >
            25%
          </button>
          <button
            className={twJoin(
              'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200',
              'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300',
              'border border-blue-500/30 hover:border-blue-500/50'
            )}
            onClick={() => handleQuickAmount(0.5)}
            type="button"
          >
            50%
          </button>
          <button
            className={twJoin(
              'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200',
              'bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:text-green-300',
              'border border-green-500/30 hover:border-green-500/50'
            )}
            onClick={handleMaxAmount}
            type="button"
          >
            Max
          </button>
        </div>
      )}

      {/* Error message */}
      {error && <div className="mt-2 text-sm text-red-400">{error}</div>}

      {/* Helper text for precision */}
      {isFocused && precision > 0 && (
        <div className="mt-2 text-xs text-slate-500">
          💡 You can enter up to {precision} decimal places. Press Enter to
          confirm or Escape to clear.
        </div>
      )}
    </div>
  )
}
