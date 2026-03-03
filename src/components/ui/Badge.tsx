import React, { ReactNode } from 'react'

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
export type BadgeSize = 'sm' | 'md' | 'lg'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  size?: BadgeSize
  icon?: ReactNode
  className?: string
  dot?: boolean
}

/**
 * Badge component for status indicators and labels
 */
export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  icon,
  className = '',
  dot = false,
}) => {
  const variantStyles = {
    danger: 'bg-red/20 text-red',
    default: 'bg-surface-high text-content-secondary',
    info: 'bg-primary/20 text-primary',
    primary: 'bg-blue-500/20 text-blue-500',
    success: 'bg-green-500/20 text-green-500',
    warning: 'bg-amber-500/20 text-amber-500',
  }

  const sizeStyles = {
    lg: 'text-sm px-2.5 py-1',
    md: 'text-xs px-2 py-1',
    sm: 'text-xs px-1.5 py-0.5',
  }

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${getDotColor(variant)}`} />
      )}
      {icon}
      {children}
    </span>
  )
}

/**
 * Status badge with a dot indicator
 */
export const StatusBadge: React.FC<
  Omit<BadgeProps, 'dot'> & {
    status: 'online' | 'offline' | 'pending' | 'error'
  }
> = ({ status, children, ...props }) => {
  const statusMap: Record<string, { variant: BadgeVariant; label: string }> = {
    error: { label: 'Error', variant: 'danger' },
    offline: { label: 'Offline', variant: 'default' },
    online: { label: 'Online', variant: 'success' },
    pending: { label: 'Pending', variant: 'warning' },
  }

  const { variant, label } = statusMap[status]

  return (
    <Badge dot={true} variant={variant} {...props}>
      {children || label}
    </Badge>
  )
}

// Helper function to get dot color based on variant
const getDotColor = (variant: BadgeVariant): string => {
  switch (variant) {
    case 'primary':
      return 'bg-blue-500'
    case 'success':
      return 'bg-green-500'
    case 'warning':
      return 'bg-amber-500'
    case 'danger':
      return 'bg-red'
    case 'info':
      return 'bg-cyan'
    default:
      return 'bg-content-secondary'
  }
}
