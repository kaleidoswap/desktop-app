import { Search, X, Copy, Check, ArrowRight } from 'lucide-react'
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
  name?: string
  isSelected?: boolean
  onCopyAssetId?: (assetId: string) => void
  onClick?: () => void
}

const AssetOption = React.memo(
  ({
    ticker,
    assetId,
    name,
    isSelected = false,
    onCopyAssetId,
    onClick,
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

    const handleCopyAssetId = (e: React.MouseEvent) => {
      e.stopPropagation()
      if (assetId && onCopyAssetId) {
        onCopyAssetId(assetId)
        setCopiedAssetId(assetId)
        setTimeout(() => setCopiedAssetId(null), 2000)
      }
    }

    return (
      <div
        className={twJoin(
          'flex items-center justify-between p-4 rounded-xl border transition-all duration-200 cursor-pointer group',
          'hover:bg-slate-700/40 hover:border-blue-500/50',
          isSelected
            ? 'bg-blue-500/20 border-blue-500/50 ring-1 ring-blue-500/30'
            : 'bg-slate-800/50 border-slate-700/50'
        )}
        onClick={onClick}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <img
            alt={displayTicker}
            className="w-10 h-10 rounded-full border-2 border-slate-600/50 flex-shrink-0"
            onError={() => setImgSrc(defaultIcon)}
            src={!iconTicker ? defaultIcon : imgSrc}
          />
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white text-lg truncate">
                {displayTicker}
              </span>
              {isSelected && (
                <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full border border-blue-500/30">
                  Selected
                </span>
              )}
            </div>
            {name && (
              <span className="text-slate-400 text-sm truncate">{name}</span>
            )}
            {assetId && assetId !== 'BTC' && assetId !== displayTicker && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-slate-500 text-xs font-mono truncate">
                  {assetId.length > 20
                    ? `${assetId.slice(0, 16)}...${assetId.slice(-4)}`
                    : assetId}
                </span>
                {onCopyAssetId && (
                  <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-600/50 rounded"
                    onClick={handleCopyAssetId}
                    title="Copy full asset ID"
                  >
                    {copiedAssetId === assetId ? (
                      <Check className="w-3 h-3 text-green-400" />
                    ) : (
                      <Copy className="w-3 h-3 text-slate-400" />
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <ArrowRight
          className={twJoin(
            'w-5 h-5 transition-all duration-200 flex-shrink-0',
            isSelected
              ? 'text-blue-400'
              : 'text-slate-500 group-hover:text-slate-300'
          )}
        />
      </div>
    )
  }
)
AssetOption.displayName = 'AssetOption'

interface AssetSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  options: AssetOptionData[]
  value: string
  onChange: (value: string) => void
  title?: string
  searchPlaceholder?: string
  fieldLabel?: string
}

export const AssetSelectionModal: React.FC<AssetSelectionModalProps> = ({
  isOpen,
  onClose,
  options,
  value,
  onChange,
  title = 'Select Asset',
  searchPlaceholder = 'Search by ticker, name or asset ID...',
  fieldLabel,
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  useOnClickOutside(modalRef, onClose)

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

  const selectedOption = options.find((option) => option.value === value)

  const handleSelect = (optionValue: string) => {
    onChange(optionValue)
    onClose()
  }

  const clearSearch = () => {
    setSearchTerm('')
    searchInputRef.current?.focus()
  }

  const handleCopyAssetId = (assetId: string) => {
    navigator.clipboard
      .writeText(assetId)
      .then(() => {
        console.log('Asset ID copied to clipboard:', assetId)
      })
      .catch((err) => {
        console.error('Failed to copy asset ID:', err)
      })
  }

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => {
        document.removeEventListener('keydown', handleEscape)
      }
    }
  }, [isOpen, onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = 'auto'
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[999999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ zIndex: 999999 }}
    >
      <div
        className={twJoin(
          'bg-slate-900/98 backdrop-blur-md border border-blue-500/50',
          'rounded-2xl shadow-2xl shadow-blue-500/20 overflow-hidden',
          'w-full max-w-2xl max-h-[80vh] flex flex-col',
          'animate-in fade-in-0 zoom-in-95 duration-300'
        )}
        ref={modalRef}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-700/50 bg-slate-800/50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">{title}</h2>
              {fieldLabel && (
                <p className="text-sm text-slate-400 mt-1">{fieldLabel}</p>
              )}
            </div>
            <button
              className="p-2 hover:bg-slate-700/50 rounded-full transition-colors text-slate-400 hover:text-white"
              onClick={onClose}
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search Input */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="w-full pl-10 pr-10 py-3 bg-slate-900/70 border border-slate-600/50 rounded-xl text-white text-sm placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              ref={searchInputRef}
              type="text"
              value={searchTerm}
            />
            {searchTerm && (
              <button
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-slate-700/50 rounded transition-colors"
                onClick={clearSearch}
              >
                <X className="w-3 h-3 text-slate-400" />
              </button>
            )}
          </div>

          {/* Search Results Count */}
          {searchTerm && (
            <div className="mt-2 text-xs text-slate-400">
              {filteredOptions.length} asset
              {filteredOptions.length !== 1 ? 's' : ''} found
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredOptions.length > 0 ? (
            <div className="space-y-3">
              {filteredOptions.map((option) => (
                <AssetOption
                  assetId={option.assetId}
                  isSelected={value === option.value}
                  key={option.value}
                  name={option.name}
                  onClick={() => handleSelect(option.value)}
                  onCopyAssetId={handleCopyAssetId}
                  ticker={option.ticker}
                />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400">
              <div className="space-y-3">
                <Search className="w-12 h-12 mx-auto text-slate-600" />
                <div>
                  <p className="text-lg font-medium text-slate-300">
                    No assets found
                  </p>
                  <p className="text-sm">
                    Try searching by ticker (e.g., "BTC"), name, or asset ID
                  </p>
                  {searchTerm && (
                    <button
                      className="mt-3 text-sm text-blue-400 hover:text-blue-300 underline"
                      onClick={clearSearch}
                    >
                      Clear search and show all assets
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700/50 bg-slate-800/30">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              💡 Tip: You can search by ticker or paste full asset ID
            </p>
            {selectedOption && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Selected:</span>
                <span className="font-medium text-blue-300">
                  {selectedOption.ticker}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
