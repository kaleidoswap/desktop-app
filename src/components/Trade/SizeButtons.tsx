import React from 'react'

interface SizeButtonsProps {
  selectedSize?: number | undefined
  disabled: boolean
  onSizeClick: (size: number) => void
}

export const SizeButtons: React.FC<SizeButtonsProps> = ({
  selectedSize,
  disabled,
  onSizeClick,
}) => (
  <div className="flex space-x-1">
    {[25, 50, 75, 100].map((size) => (
      <button
        className={`py-1.5 px-2 rounded-md border text-xs font-medium transition-all duration-200 min-w-[36px]
          ${
            selectedSize === size
              ? 'border-blue-500 bg-blue-500/20 text-blue-400 shadow-md shadow-blue-500/25'
              : 'border-slate-600/50 text-slate-400 hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-300'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
        key={size}
        onClick={() => !disabled && onSizeClick(size)}
        type="button"
      >
        {size}%
      </button>
    ))}
  </div>
)
