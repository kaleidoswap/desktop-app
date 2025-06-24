import React from 'react'

interface SizeButtonsProps {
  selectedSize?: number | undefined
  disabled: boolean
  onSizeClick: (size: number) => void
  compact?: boolean
}

export const SizeButtons: React.FC<SizeButtonsProps> = ({
  selectedSize,
  disabled,
  onSizeClick,
  compact = false,
}) => (
  <div className={`flex gap-2 ${compact ? 'gap-1' : 'gap-2'}`}>
    {[25, 50, 75, 100].map((size) => (
      <button
        className={`${
          compact ? 'py-1 px-2 text-xs' : 'py-2 px-3 text-sm'
        } rounded-lg font-medium transition-all duration-200 border flex-1 min-w-0
          ${
            selectedSize === size
              ? 'border-blue-500/60 bg-blue-600/20 text-blue-400 shadow-md shadow-blue-500/20'
              : 'border-slate-600/40 bg-slate-800/60 text-slate-400 hover:border-slate-500/60 hover:bg-slate-700/60 hover:text-slate-300'
          } ${
            disabled
              ? 'opacity-50 cursor-not-allowed'
              : 'cursor-pointer hover:scale-[1.02] active:scale-95'
          }`}
        disabled={disabled}
        key={size}
        onClick={() => !disabled && onSizeClick(size)}
        type="button"
      >
        {size}%
      </button>
    ))}
  </div>
)
