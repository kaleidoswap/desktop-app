import {
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  BarChart2,
  RefreshCw,
  AlertTriangle,
  Check,
} from 'lucide-react'
import React, { useState } from 'react'

interface ChannelMenuProps {
  onUpdate: () => void
  onRebalance?: () => void
  onCloseChannel: () => void
}

/**
 * A dropdown menu component for channel actions
 */
export const ChannelMenu: React.FC<ChannelMenuProps> = ({
  onUpdate,
  onRebalance,
  onCloseChannel,
}) => {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="relative">
      <button
        className="p-2 hover:bg-surface-high rounded-lg transition-colors text-content-secondary hover:text-white"
        onClick={() => setIsVisible(!isVisible)}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
          <circle cx="5" cy="12" r="1" />
        </svg>
      </button>

      {isVisible && (
        <div className="absolute right-0 mt-2 w-48 rounded-xl shadow-xl bg-surface-overlay border border-border-default overflow-hidden z-10 animate-scaleIn">
          <div className="py-1">
            <button
              className="flex w-full items-center px-4 py-2 text-sm text-content-secondary hover:bg-surface-high hover:text-white transition-colors"
              onClick={() => {
                onUpdate()
                setIsVisible(false)
              }}
            >
              <RefreshCw className="mr-2" size={14} />
              Update Channel Status
            </button>

            {onRebalance && (
              <button
                className="flex w-full items-center px-4 py-2 text-sm text-content-secondary hover:bg-surface-high hover:text-white transition-colors"
                onClick={() => {
                  onRebalance()
                  setIsVisible(false)
                }}
              >
                <BarChart2 className="mr-2" size={14} />
                Rebalance Channel
              </button>
            )}

            <div className="border-t border-border-default my-1"></div>

            <button
              className="flex w-full items-center px-4 py-2 text-sm text-red-400 hover:bg-red-600/20 hover:text-red-300 transition-colors"
              onClick={() => {
                onCloseChannel()
                setIsVisible(false)
              }}
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
              Close Channel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface ChannelTooltipProps {
  children: React.ReactNode
  tooltip: string
  position?: 'top' | 'bottom' | 'left' | 'right'
}

/**
 * A tooltip component for displaying channel information
 */
export const ChannelTooltip: React.FC<ChannelTooltipProps> = ({
  children,
  tooltip,
  position = 'top',
}) => {
  const [isVisible, setIsVisible] = useState(false)

  const getPositionClasses = () => {
    switch (position) {
      case 'top':
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2'
      case 'bottom':
        return 'top-full left-1/2 transform -translate-x-1/2 mt-2'
      case 'left':
        return 'right-full top-1/2 transform -translate-y-1/2 mr-2'
      case 'right':
        return 'left-full top-1/2 transform -translate-y-1/2 ml-2'
      default:
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2'
    }
  }

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}

      {isVisible && (
        <div
          className={`absolute ${getPositionClasses()} z-10 px-3 py-2 text-sm font-medium text-white bg-surface-base rounded-lg shadow-lg border border-border-default w-max max-w-xs animate-fadeIn`}
        >
          {tooltip}
          <div
            className={`absolute w-2 h-2 bg-surface-base transform rotate-45 ${
              position === 'top'
                ? 'top-full -translate-x-1/2 -mt-1 left-1/2 border-r border-b border-border-default'
                : position === 'bottom'
                  ? 'bottom-full -translate-x-1/2 -mb-1 left-1/2 border-l border-t border-border-default'
                  : position === 'left'
                    ? 'left-full -translate-y-1/2 -ml-1 top-1/2 border-t border-r border-border-default'
                    : 'right-full -translate-y-1/2 -mr-1 top-1/2 border-b border-l border-border-default'
            }`}
          ></div>
        </div>
      )}
    </div>
  )
}

interface ChannelStatusBadgeProps {
  status: 'active' | 'pending' | 'inactive' | 'closing'
  className?: string
}

/**
 * A status badge component for channels
 */
export const ChannelStatusBadge: React.FC<ChannelStatusBadgeProps> = ({
  status,
  className = '',
}) => {
  const getStatusStyles = () => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400 border border-green-500/30'
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
      case 'inactive':
        return 'bg-surface-high/20 text-content-secondary border border-border-default/30'
      case 'closing':
        return 'bg-red-500/20 text-red-400 border border-red-500/30'
      default:
        return 'bg-surface-high/20 text-content-secondary border border-border-default/30'
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'active':
        return <Check className="mr-1" size={12} />
      case 'pending':
        return <RefreshCw className="mr-1 animate-spin" size={12} />
      case 'inactive':
        return <AlertTriangle className="mr-1" size={12} />
      case 'closing':
        return (
          <svg
            className="w-3 h-3 mr-1"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        )
      default:
        return <AlertTriangle className="mr-1" size={12} />
    }
  }

  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full flex items-center ${getStatusStyles()} ${className}`}
    >
      {getStatusIcon()}
      <span className="status-badge">
        {status ? status.charAt(0).toUpperCase() + status.slice(1) : ''}
      </span>
    </span>
  )
}

interface ChannelActionButtonProps {
  children: React.ReactNode
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  isLoading?: boolean
}

/**
 * A styled button component for channel actions
 */
export const ChannelActionButton: React.FC<ChannelActionButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  className = '',
  isLoading = false,
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return 'bg-primary hover:bg-primary-emphasis text-primary-foreground'
      case 'secondary':
        return 'bg-surface-high hover:bg-surface-elevated text-content-primary'
      case 'danger':
        return 'bg-red-600/20 hover:bg-red-600 border border-red-600/30 text-red-400 hover:text-white'
      case 'success':
        return 'bg-green-600/20 hover:bg-green-600 border border-green-600/30 text-green-400 hover:text-white'
      default:
        return 'bg-primary hover:bg-primary-emphasis text-primary-foreground'
    }
  }

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'py-1 px-3 text-xs'
      case 'md':
        return 'py-2 px-4 text-sm'
      case 'lg':
        return 'py-2.5 px-5 text-base'
      default:
        return 'py-2 px-4 text-sm'
    }
  }

  return (
    <button
      className={`rounded-lg transition-all duration-200 font-medium flex items-center justify-center ${getVariantClasses()} ${getSizeClasses()} ${className} ${isLoading ? 'opacity-70 cursor-wait' : ''}`}
      disabled={isLoading}
      onClick={onClick}
    >
      {isLoading ? (
        <>
          <RefreshCw
            className="mr-2 animate-spin"
            size={size === 'sm' ? 12 : size === 'lg' ? 18 : 16}
          />
          Loading...
        </>
      ) : (
        children
      )}
    </button>
  )
}

/**
 * A component for displaying liquidity direction
 */
export const LiquidityDirection: React.FC<{
  direction: 'in' | 'out' | 'balanced'
  amount: string
  className?: string
}> = ({ direction, amount, className = '' }) => {
  return (
    <div className={`flex items-center ${className}`}>
      {direction === 'in' && (
        <ArrowDownRight className="text-green-400 mr-1.5" size={16} />
      )}
      {direction === 'out' && (
        <ArrowUpRight className="text-blue-400 mr-1.5" size={16} />
      )}
      {direction === 'balanced' && (
        <Zap className="text-yellow-400 mr-1.5" size={16} />
      )}

      <div>
        <span className="font-medium">{amount}</span>
        <span
          className={`ml-1 text-xs ${
            direction === 'in'
              ? 'text-green-400'
              : direction === 'out'
                ? 'text-blue-400'
                : 'text-yellow-400'
          }`}
        >
          {direction === 'in'
            ? 'Inbound'
            : direction === 'out'
              ? 'Outbound'
              : 'Balanced'}
        </span>
      </div>
    </div>
  )
}
