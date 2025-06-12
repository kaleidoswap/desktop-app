import { Search, ChevronDown, X } from 'lucide-react'
import React, { useState, useRef, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { twJoin } from 'tailwind-merge'

import defaultIcon from '../../assets/rgb-symbol-color.svg'
import { useAssetIcon } from '../../helpers/utils'
import { useOnClickOutside } from '../../hooks/useOnClickOutside'

export interface AssetOptionData {
  value: string
  ticker: string
  label?: string
  assetId?: string
  name?: string
}

interface AssetOptionProps {
  ticker: string
  assetId?: string
  showAssetId?: boolean
  isSelected?: boolean
}

const AssetOption = React.memo(
  ({
    ticker,
    assetId,
    showAssetId = false,
    isSelected = false,
  }: AssetOptionProps) => {
    const displayTicker = ticker || 'None'
    const iconTicker =
      displayTicker === 'SAT'
        ? 'BTC'
        : displayTicker === 'None' || !displayTicker
          ? ''
          : displayTicker
    const [imgSrc, setImgSrc] = useAssetIcon(iconTicker, defaultIcon)

    // Shorten asset ID for display (first 8 chars + ...)
    const shortenedAssetId =
      assetId && assetId !== 'BTC' && assetId !== displayTicker
        ? assetId.length > 12
          ? `${assetId.slice(0, 8)}...`
          : assetId
        : null

    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center flex-1 min-w-0">
          <img
            alt={displayTicker}
            className="w-6 h-6 mr-3 flex-shrink-0 rounded-full"
            onError={() => setImgSrc(defaultIcon)}
            src={!iconTicker ? defaultIcon : imgSrc}
          />
          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-medium text-white truncate">
              {displayTicker}
            </span>
            {showAssetId && shortenedAssetId && !isSelected && (
              <span className="text-xs text-slate-400 truncate">
                {shortenedAssetId}
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }
)
AssetOption.displayName = 'AssetOption'

interface EnhancedAssetSelectProps {
  options: AssetOptionData[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  searchPlaceholder?: string
  className?: string
}

export const EnhancedAssetSelect: React.FC<EnhancedAssetSelectProps> = ({
  options,
  value,
  onChange,
  disabled = false,
  placeholder = 'Select asset',
  searchPlaceholder = 'Search assets...',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [dropdownPosition, setDropdownPosition] = useState({
    left: 0,
    top: 0,
    width: 0,
  })
  const menuRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useOnClickOutside(menuRef, () => {
    setIsOpen(false)
    setSearchTerm('')
  })

  const selectedOption = options.find((option) => option.value === value)

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options

    const term = searchTerm.toLowerCase()
    return options.filter(
      (option) =>
        option.ticker.toLowerCase().includes(term) ||
        (option.label && option.label.toLowerCase().includes(term)) ||
        (option.name && option.name.toLowerCase().includes(term)) ||
        (option.assetId && option.assetId.toLowerCase().includes(term))
    )
  }, [options, searchTerm])

  // Calculate dropdown position based on trigger element
  const updateDropdownPosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setDropdownPosition({
        // 8px gap
left: rect.left + window.scrollX, 
        top: rect.bottom + window.scrollY + 8,
        width: rect.width,
      })
    }
  }

  const handleToggle = () => {
    if (disabled) return

    const newIsOpen = !isOpen

    if (newIsOpen) {
      updateDropdownPosition()
    }

    setIsOpen(newIsOpen)

    // Focus search input when opening
    if (newIsOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
    } else {
      setSearchTerm('')
    }
  }

  // Update position on window resize
  useEffect(() => {
    if (isOpen) {
      const handleResize = () => updateDropdownPosition()
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }
  }, [isOpen])

  const handleSelect = (optionValue: string) => {
    onChange(optionValue)
    setIsOpen(false)
    setSearchTerm('')
  }

  const clearSearch = () => {
    setSearchTerm('')
    searchInputRef.current?.focus()
  }

  return (
    <>
      {/* Backdrop for better UX when dropdown is open */}
      {isOpen && !disabled && (
        <div
          className="fixed inset-0 z-[9998] bg-black/10"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div className={twJoin('relative', className)}>
        {/* Trigger Button */}
        <button
          className={twJoin(
            'flex items-center justify-between w-full px-4 py-3 rounded-xl border transition-all duration-200',
            'bg-slate-900/70 border-slate-600/50 hover:border-slate-500/70 backdrop-blur-sm',
            'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none',
            'min-w-[140px] h-[48px]',
            disabled
              ? 'opacity-50 cursor-not-allowed hover:border-slate-600/50'
              : 'cursor-pointer',
            isOpen && !disabled ? 'border-blue-500 ring-2 ring-blue-500/20' : ''
          )}
          disabled={disabled}
          onClick={handleToggle}
          ref={triggerRef}
          type="button"
        >
          <div className="flex items-center flex-1 min-w-0">
            {selectedOption ? (
              <AssetOption
                assetId={selectedOption.assetId}
                isSelected={true}
                ticker={selectedOption.ticker}
              />
            ) : (
              <span className="text-slate-400 ml-9">{placeholder}</span>
            )}
          </div>
          <ChevronDown
            className={twJoin(
              'w-5 h-5 text-slate-400 transition-transform duration-200 ml-2 flex-shrink-0',
              isOpen ? 'rotate-180' : ''
            )}
          />
        </button>

        {/* Dropdown Menu - rendered in Portal */}
        {isOpen &&
          !disabled &&
          createPortal(
            <div
              className="fixed z-[9999] bg-slate-800/95 backdrop-blur-sm border border-slate-600/50 rounded-xl shadow-xl overflow-hidden min-w-[280px] max-w-[400px] w-max"
              ref={menuRef}
              style={{
                left: `${dropdownPosition.left}px`,
                minWidth: `${Math.max(dropdownPosition.width, 280)}px`,
                top: `${dropdownPosition.top}px`,
              }}
            >
              {/* Search Input */}
              <div className="p-3 border-b border-slate-700/50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    className="w-full pl-10 pr-8 py-2 bg-slate-900/70 border border-slate-600/50 rounded-lg text-white text-sm placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none min-w-0"
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={searchPlaceholder}
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                  />
                  {searchTerm && (
                    <button
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-slate-700/50 rounded transition-colors"
                      onClick={clearSearch}
                    >
                      <X className="w-3 h-3 text-slate-400" />
                    </button>
                  )}
                </div>
              </div>

              {/* Options List */}
              <div className="max-h-64 overflow-y-auto">
                {filteredOptions.length > 0 ? (
                  <div className="py-1">
                    {filteredOptions.map((option) => (
                      <button
                        className={twJoin(
                          'w-full px-4 py-3 text-left hover:bg-slate-700/50 transition-colors duration-150',
                          'focus:bg-slate-700/50 focus:outline-none',
                          value === option.value
                            ? 'bg-blue-500/20 text-blue-300'
                            : ''
                        )}
                        key={option.value}
                        onClick={() => handleSelect(option.value)}
                      >
                        <AssetOption
                          assetId={option.assetId}
                          isSelected={false}
                          showAssetId={true}
                          ticker={option.ticker}
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-6 text-center text-slate-400">
                    <div className="space-y-1">
                      <p className="text-sm">No assets found</p>
                      <p className="text-xs">Try adjusting your search term</p>
                    </div>
                  </div>
                )}
              </div>
            </div>,
            document.body
          )}
      </div>
    </>
  )
}
