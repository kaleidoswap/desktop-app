import { ChevronDown } from 'lucide-react'
import React from 'react'
import { twJoin } from 'tailwind-merge'

import defaultIcon from '../../assets/rgb-symbol-color.svg'
import { useAssetIcon } from '../../helpers/utils'

import { AssetOptionData } from './AssetSelectionModal'

interface AssetSelectTriggerProps {
  value: string
  options: AssetOptionData[]
  onClick: () => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export const AssetSelectTrigger: React.FC<AssetSelectTriggerProps> = ({
  value,
  options,
  onClick,
  placeholder = 'Select asset',
  disabled = false,
  className = '',
}) => {
  const selectedOption = options.find((option) => option.value === value)

  const displayTicker = selectedOption?.ticker || ''
  const iconTicker =
    displayTicker === 'SAT'
      ? 'BTC'
      : displayTicker === 'None' || !displayTicker
        ? ''
        : displayTicker
  const [imgSrc, setImgSrc] = useAssetIcon(iconTicker, defaultIcon)

  return (
    <button
      className={twJoin(
        'flex items-center justify-between w-full px-3 py-2.5 rounded-lg border transition-all duration-200',
        'bg-surface-base/50 border-border-default/30 hover:border-border-default/60',
        'focus:border-primary/50 focus:outline-none',
        'relative group',
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'cursor-pointer hover:bg-surface-base/70',
        className
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {selectedOption ? (
          <>
            <img
              alt={displayTicker}
              className="w-6 h-6 rounded-full flex-shrink-0"
              onError={() => setImgSrc(defaultIcon)}
              src={!iconTicker ? defaultIcon : imgSrc}
            />
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold text-white truncate leading-tight">
                {displayTicker}
              </div>
              {selectedOption.assetId &&
                selectedOption.assetId.startsWith('rgb:') && (
                  <div className="text-[10px] text-content-tertiary font-mono truncate leading-tight">
                    {selectedOption.assetId.slice(4, 15)}…
                  </div>
                )}
            </div>
          </>
        ) : (
          <span className="text-content-tertiary text-sm truncate">
            {placeholder}
          </span>
        )}
      </div>
      <ChevronDown className="w-4 h-4 text-content-tertiary ml-1.5 flex-shrink-0 group-hover:text-content-secondary transition-colors duration-200" />
    </button>
  )
}
