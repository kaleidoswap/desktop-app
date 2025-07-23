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
        'flex items-center justify-between w-full px-4 py-3 rounded-xl border transition-all duration-200',
        'bg-slate-900/80 border-slate-600/50 hover:border-blue-500/60 backdrop-blur-sm',
        'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none',
        'min-w-[160px] h-[56px] relative group',
        'shadow-lg hover:shadow-xl hover:shadow-blue-500/10',
        disabled
          ? 'opacity-50 cursor-not-allowed hover:border-slate-600/50'
          : 'cursor-pointer hover:bg-slate-800/90 hover:scale-[1.02]',
        className
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-center flex-1 min-w-0">
        {selectedOption ? (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative">
              <img
                alt={displayTicker}
                className="w-8 h-8 rounded-full border-2 border-slate-600/50 flex-shrink-0 group-hover:border-blue-500/60 transition-colors"
                onError={() => setImgSrc(defaultIcon)}
                src={!iconTicker ? defaultIcon : imgSrc}
              />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>
            <div className="flex flex-col min-w-0 flex-1 text-left">
              <span className="font-semibold text-white truncate text-base group-hover:text-blue-100 transition-colors">
                {displayTicker}
              </span>
              {selectedOption.name && (
                <span className="text-slate-400 text-xs truncate group-hover:text-slate-300 transition-colors">
                  {selectedOption.name}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-700/50 border-2 border-dashed border-slate-600/50 flex items-center justify-center">
              <span className="text-slate-500 text-xs">?</span>
            </div>
            <span className="text-slate-400 font-medium">{placeholder}</span>
          </div>
        )}
      </div>
      <ChevronDown
        className={twJoin(
          'w-5 h-5 text-slate-400 ml-3 flex-shrink-0 transition-all duration-200',
          'group-hover:text-blue-400 group-hover:rotate-180'
        )}
      />
    </button>
  )
}
