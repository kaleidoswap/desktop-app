import React from 'react'

interface SizeButtonsProps {
  selectedSize: number
  disabled: boolean
  onSizeClick: (size: number) => void
}

export const SizeButtons: React.FC<SizeButtonsProps> = ({
  selectedSize,
  disabled,
  onSizeClick,
}) => (
  <div className="flex space-x-1.5">
    {[25, 50, 75, 100].map((size) => (
      <button
        className={`py-0.5 px-2 rounded-md border text-xs transition-all duration-200
          ${
            selectedSize === size
              ? 'border-blue-500 bg-blue-500/20 text-blue-400 font-medium shadow-sm'
              : 'border-slate-700 text-slate-400 hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-300'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        key={size}
        onClick={() => !disabled && onSizeClick(size)}
        type="button"
      >
        {size}%
      </button>
    ))}
  </div>
)
