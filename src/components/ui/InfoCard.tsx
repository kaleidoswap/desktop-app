import { Copy } from 'lucide-react'
import React, { ReactNode } from 'react'
import { toast } from 'react-toastify'

interface InfoCardProps {
  icon: ReactNode
  label: string
  value: string | ReactNode
  copyable?: boolean
  copyText?: string
  copySuccessMessage?: string
  className?: string
}

/**
 * InfoCard component for displaying information with an icon
 */
export const InfoCard: React.FC<InfoCardProps> = ({
  icon,
  label,
  value,
  copyable = false,
  copyText,
  copySuccessMessage,
  className = '',
}) => {
  const handleCopy = () => {
    if (!copyText) return

    navigator.clipboard.writeText(copyText).catch((err) => {
      console.error('Failed to copy: ', err)
    })

    toast.success(copySuccessMessage || 'Copied to clipboard')
  }

  return (
    <div
      className={`bg-surface-overlay/80 backdrop-blur-sm rounded-xl border border-border-default/50 p-4 ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-500/10 rounded-lg">{icon}</div>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium text-content-secondary uppercase tracking-wider block">
            {label}
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-content-secondary font-medium truncate">
              {value}
            </span>
            {copyable && (
              <button
                className="shrink-0 p-1.5 hover:bg-surface-high/50 rounded-lg transition-colors"
                onClick={handleCopy}
                title={`Copy ${label}`}
              >
                <Copy className="w-4 h-4 text-content-secondary hover:text-white" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * A grid of info cards
 */
export const InfoCardGrid: React.FC<{
  children: ReactNode
  columns?: 1 | 2 | 3 | 4
  className?: string
}> = ({ children, columns = 3, className = '' }) => {
  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  }

  return (
    <div className={`w-full grid ${columnClasses[columns]} gap-4 ${className}`}>
      {children}
    </div>
  )
}
