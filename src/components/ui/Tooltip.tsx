import { Info } from 'lucide-react'
import React, { ReactNode, useState } from 'react'

interface TooltipProps {
  children: ReactNode
  content: ReactNode
  title?: string
  icon?: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  width?: string
  className?: string
}

/**
 * A tooltip component that shows on hover
 */
export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  title,
  icon = <Info className="w-5 h-5 text-blue-500" />,
  position = 'top',
  width = 'max-w-xs',
  className = '',
}) => {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children}

      {showTooltip && (
        <div
          className={`absolute z-50 ${width} ${getPositionClasses(position)} ${className}`}
        >
          <div
            className="bg-surface-base/95 backdrop-blur-sm rounded-lg
                     border border-border-default/50 shadow-lg
                     flex flex-col p-4 z-10"
          >
            {title && (
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">{icon}</div>
                <h4 className="text-base font-medium text-white">{title}</h4>
              </div>
            )}

            <div className="text-sm text-content-secondary">{content}</div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * A tooltip with an overlay effect (covers the entire element)
 */
export const OverlayTooltip: React.FC<TooltipProps> = ({
  children,
  content,
  title,
  icon = <Info className="w-5 h-5 text-blue-500" />,
  className = '',
}) => {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children}

      {showTooltip && (
        <div
          className={`absolute inset-0 bg-surface-base/95 backdrop-blur-sm rounded-lg
                     flex flex-col justify-between p-4 cursor-help z-10
                     transition-opacity duration-200 ${className}`}
        >
          {/* Header section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-blue-500/20 rounded-lg">{icon}</div>
              <h4 className="text-base font-medium text-white bg-surface-base/80 px-2 py-0.5 rounded-md">
                {title}
              </h4>
            </div>

            {/* Description with background for better readability */}
            <div className="bg-surface-base/80 p-3 rounded-lg">
              <div className="text-sm leading-relaxed text-content-secondary">
                {content}
              </div>
            </div>
          </div>

          {/* Footer with background */}
          <div className="text-xs text-blue-400 mt-3 bg-surface-base/80 px-2 py-0.5 rounded-md self-start">
            Hover away to close
          </div>
        </div>
      )}
    </div>
  )
}

// Helper function to get position classes
const getPositionClasses = (position: 'top' | 'bottom' | 'left' | 'right') => {
  switch (position) {
    case 'top':
      return 'bottom-full left-1/2 -translate-x-1/2 mb-2'
    case 'bottom':
      return 'top-full left-1/2 -translate-x-1/2 mt-2'
    case 'left':
      return 'right-full top-1/2 -translate-y-1/2 mr-2'
    case 'right':
      return 'left-full top-1/2 -translate-y-1/2 ml-2'
    default:
      return 'bottom-full left-1/2 -translate-x-1/2 mb-2'
  }
}
