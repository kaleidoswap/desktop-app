import { Search, ChevronDown, X, Copy, Check } from 'lucide-react'
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
  showFullAssetId?: boolean
  onCopyAssetId?: (assetId: string) => void
}

const AssetOption = React.memo(
  ({
    ticker,
    assetId,
    showAssetId = false,
    isSelected = false,
    showFullAssetId = false,
    onCopyAssetId,
  }: AssetOptionProps) => {
    const [copiedAssetId, setCopiedAssetId] = useState<string | null>(null)
    const displayTicker = ticker || 'None'
    const iconTicker =
      displayTicker === 'SAT'
        ? 'BTC'
        : displayTicker === 'None' || !displayTicker
          ? ''
          : displayTicker
    const [imgSrc, setImgSrc] = useAssetIcon(iconTicker, defaultIcon)

    // Show full asset ID or shortened version
    const displayAssetId = useMemo(() => {
      if (!assetId || assetId === 'BTC' || assetId === displayTicker)
        return null

      if (showFullAssetId || isSelected) {
        return assetId
      }

      return assetId.length > 12
        ? `${assetId.slice(0, 8)}...${assetId.slice(-4)}`
        : assetId
    }, [assetId, displayTicker, showFullAssetId, isSelected])

    const handleCopyAssetId = (e: React.MouseEvent) => {
      e.stopPropagation()
      if (assetId && onCopyAssetId) {
        onCopyAssetId(assetId)
        setCopiedAssetId(assetId)
        setTimeout(() => setCopiedAssetId(null), 2000)
      }
    }

    return (
      <div className="flex items-center justify-between w-full group">
        <div className="flex items-center flex-1 min-w-0 mr-2">
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
            {showAssetId && displayAssetId && (
              <div className="flex items-center gap-1">
                <span
                  className={`text-[10px] text-slate-500 ${showFullAssetId ? 'font-mono' : ''}`}
                  title={showFullAssetId ? undefined : assetId}
                >
                  {displayAssetId}
                </span>
                {assetId &&
                  assetId !== 'BTC' &&
                  assetId !== displayTicker &&
                  onCopyAssetId && (
                    <button
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-slate-600/50 rounded"
                      onClick={handleCopyAssetId}
                      title="Copy full asset ID"
                    >
                      {copiedAssetId === assetId ? (
                        <Check className="w-2.5 h-2.5 text-green-400" />
                      ) : (
                        <Copy className="w-2.5 h-2.5 text-slate-400" />
                      )}
                    </button>
                  )}
              </div>
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
  showFullAssetId?: boolean
  fieldLabel?: string
}

export const EnhancedAssetSelect: React.FC<EnhancedAssetSelectProps> = ({
  options,
  value,
  onChange,
  disabled = false,
  placeholder = 'Select asset',
  searchPlaceholder = 'Search by ticker or asset ID...',
  className = '',
  showFullAssetId = false,
  fieldLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [dropdownPosition, setDropdownPosition] = useState({
    left: 0,
    openUpward: false,
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

  // Enhanced filter with better search capabilities
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options

    const term = searchTerm.toLowerCase()
    return options.filter(
      (option) =>
        option.ticker.toLowerCase().includes(term) ||
        (option.label && option.label.toLowerCase().includes(term)) ||
        (option.name && option.name.toLowerCase().includes(term)) ||
        (option.assetId && option.assetId.toLowerCase().includes(term)) ||
        // Also search in the shortened version
        (option.assetId && option.assetId.toLowerCase().startsWith(term))
    )
  }, [options, searchTerm])

  // Smart positioning that considers viewport constraints
  const updateDropdownPosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const dropdownHeight = 320 // Approximate height of dropdown
      const spaceBelow = viewportHeight - rect.bottom
      const spaceAbove = rect.top

      // Determine if dropdown should open upward
      const shouldOpenUpward =
        spaceBelow < dropdownHeight && spaceAbove > spaceBelow

      setDropdownPosition({
        left: rect.left + window.scrollX,
        openUpward: shouldOpenUpward, 
        top: shouldOpenUpward
          ? rect.top + window.scrollY - dropdownHeight - 4 // Reduced gap for better connection
          : rect.bottom + window.scrollY + 4,
        // Reduced gap for better connection
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

  // Update position on window resize and scroll
  useEffect(() => {
    if (isOpen) {
      const handleResize = () => updateDropdownPosition()
      const handleScroll = () => updateDropdownPosition()

      window.addEventListener('resize', handleResize)
      window.addEventListener('scroll', handleScroll, true)

      return () => {
        window.removeEventListener('resize', handleResize)
        window.removeEventListener('scroll', handleScroll, true)
      }
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

  const handleCopyAssetId = (assetId: string) => {
    navigator.clipboard
      .writeText(assetId)
      .then(() => {
        // Toast or other feedback could be added here
        console.log('Asset ID copied to clipboard:', assetId)
      })
      .catch((err) => {
        console.error('Failed to copy asset ID:', err)
      })
  }

  return (
    <>
      {/* Backdrop for better UX when dropdown is open */}
      {isOpen && !disabled && (
        <div
          className="fixed inset-0 z-[9998] bg-black/20 backdrop-blur-[1px]"
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
            'min-w-[140px] h-[48px] relative',
            disabled
              ? 'opacity-50 cursor-not-allowed hover:border-slate-600/50'
              : 'cursor-pointer',
            isOpen && !disabled
              ? 'border-blue-500 ring-2 ring-blue-500/20 bg-slate-800/90'
              : ''
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
                onCopyAssetId={handleCopyAssetId}
                showAssetId={true}
                showFullAssetId={showFullAssetId}
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

        {/* Enhanced Dropdown Menu */}
        {isOpen &&
          !disabled &&
          createPortal(
            <div
              className={twJoin(
                'fixed z-[9999] bg-slate-800/98 backdrop-blur-md border border-blue-500/50',
                'rounded-xl shadow-2xl shadow-blue-500/20 overflow-hidden',
                'min-w-[360px] max-w-[500px] w-max',
                'animate-in fade-in-0 zoom-in-95 duration-200',
                dropdownPosition.openUpward
                  ? 'slide-in-from-bottom-2'
                  : 'slide-in-from-top-2'
              )}
              ref={menuRef}
              style={{
                left: `${dropdownPosition.left}px`,
                maxHeight: '400px',
                minWidth: `${Math.max(dropdownPosition.width, 320)}px`,
                top: `${dropdownPosition.top}px`,
              }}
            >
              {/* Connection Arrow */}
              <div
                className={twJoin(
                  'absolute w-0 h-0',
                  dropdownPosition.openUpward
                    ? 'bottom-[-6px] border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-blue-500/50'
                    : 'top-[-6px] border-l-[6px] border-r-[6px] border-b-[6px] border-l-transparent border-r-transparent border-b-blue-500/50'
                )}
                style={{
                  left: `${Math.min(Math.max(24, dropdownPosition.width / 2), 300)}px`,
                  transform: 'translateX(-50%)',
                }}
              />
              {/* Enhanced Search Input */}
              <div className="p-4 border-b border-slate-700/50 bg-slate-800/50">
                {fieldLabel && (
                  <div className="mb-3 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                    <span className="text-xs font-medium text-blue-300">
                      Selecting asset for: {fieldLabel}
                    </span>
                  </div>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    className="w-full pl-10 pr-8 py-2.5 bg-slate-900/70 border border-slate-600/50 rounded-lg text-white text-sm placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none min-w-0"
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
                {searchTerm && (
                  <div className="mt-2 text-xs text-slate-400">
                    {filteredOptions.length} asset
                    {filteredOptions.length !== 1 ? 's' : ''} found
                  </div>
                )}
              </div>

              {/* Options List with improved scrolling */}
              <div className="max-h-80 overflow-y-auto scrollbar-thin scrollbar-track-slate-800 scrollbar-thumb-slate-600">
                {filteredOptions.length > 0 ? (
                  <div className="py-2">
                    {filteredOptions.map((option) => (
                      <button
                        className={twJoin(
                          'w-full px-4 py-3 text-left transition-all duration-200',
                          'hover:bg-slate-700/60 focus:bg-slate-700/60 focus:outline-none',
                          'border-l-2 border-transparent group relative',
                          value === option.value
                            ? 'bg-blue-500/20 text-blue-300 border-l-blue-500 shadow-lg shadow-blue-500/10'
                            : 'hover:border-l-blue-400/50'
                        )}
                        key={option.value}
                        onClick={() => handleSelect(option.value)}
                      >
                        <AssetOption
                          assetId={option.assetId}
                          isSelected={false}
                          onCopyAssetId={handleCopyAssetId}
                          showAssetId={true}
                          showFullAssetId={showFullAssetId}
                          ticker={option.ticker}
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-8 text-center text-slate-400">
                    <div className="space-y-2">
                      <Search className="w-8 h-8 mx-auto text-slate-500" />
                      <p className="text-sm font-medium">No assets found</p>
                      <p className="text-xs">
                        Try searching by ticker (e.g., "BTC") or asset ID
                      </p>
                      {searchTerm && (
                        <button
                          className="text-xs text-blue-400 hover:text-blue-300 underline"
                          onClick={clearSearch}
                        >
                          Clear search
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer with helpful info */}
              {!searchTerm && (
                <div className="px-4 py-2 border-t border-slate-700/50 bg-slate-800/30">
                  <p className="text-xs text-slate-500 text-center">
                    💡 You can search by ticker or paste full asset ID
                  </p>
                </div>
              )}
            </div>,
            document.body
          )}
      </div>
    </>
  )
}
