import React from 'react'

interface LoadingPlaceholderProps {
  width?: string
  height?: string
  className?: string
  rounded?: boolean
}

/**
 * A loading placeholder with animation
 */
export const LoadingPlaceholder: React.FC<LoadingPlaceholderProps> = ({
  width = 'w-20',
  height = 'h-6',
  className = '',
  rounded = true,
}) => (
  <div
    className={`${width} ${height} bg-surface-high/50 animate-pulse ${rounded ? 'rounded' : ''} ${className}`}
  ></div>
)

/**
 * A text loading placeholder
 */
export const TextLoadingPlaceholder: React.FC<
  LoadingPlaceholderProps & { lines?: number }
> = ({
  width = 'w-full',
  height = 'h-4',
  className = '',
  rounded = true,
  lines = 1,
}) => (
  <div className="space-y-2">
    {Array.from({ length: lines }).map((_, index) => (
      <LoadingPlaceholder
        className={className}
        height={height}
        key={index}
        rounded={rounded}
        width={index === lines - 1 && lines > 1 ? 'w-2/3' : width}
      />
    ))}
  </div>
)

/**
 * A card loading placeholder
 */
export const CardLoadingPlaceholder: React.FC<{ withHeader?: boolean }> = ({
  withHeader = true,
}) => (
  <div className="bg-surface-overlay/50 rounded-xl border border-border-default p-6 space-y-6">
    {withHeader && (
      <div className="flex justify-between items-center">
        <LoadingPlaceholder width="w-1/3" />
        <LoadingPlaceholder width="w-24" />
      </div>
    )}
    <div className="space-y-4">
      <TextLoadingPlaceholder lines={3} />
    </div>
  </div>
)
