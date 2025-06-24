import React from 'react'

import { SizeButtons } from './SizeButtons'

interface QuickAmountSectionProps {
  selectedSize?: number | undefined
  disabled?: boolean
  onSizeClick: (size: number) => void
  availableAmount?: string
  label?: string
  compact?: boolean
  className?: string
}

export const QuickAmountSection: React.FC<QuickAmountSectionProps> = ({
  selectedSize,
  disabled = false,
  onSizeClick,
  availableAmount,
  label = 'Quick Amount',
  compact = false,
  className = '',
}) => (
  <div className={`${compact ? 'space-y-2' : 'space-y-3'} ${className}`}>
    <div className="flex items-center justify-between">
      <span
        className={`font-medium text-slate-300 ${compact ? 'text-xs' : 'text-sm'}`}
      >
        {label}
      </span>
      {availableAmount && (
        <span
          className={`text-slate-500 ${compact ? 'text-xs' : 'text-xs'} hidden sm:block`}
        >
          Available: {availableAmount}
        </span>
      )}
    </div>
    <SizeButtons
      compact={compact}
      disabled={disabled}
      onSizeClick={onSizeClick}
      selectedSize={selectedSize}
    />
  </div>
)
