import { Copy, Minus } from 'lucide-react'
import { ReactNode } from 'react'
import { toast } from 'react-toastify'
import { twMerge } from 'tailwind-merge'

import { formatDate } from '../../../helpers/date'
import { Badge } from '../Badge'

export interface Column<T> {
  header: ReactNode
  accessor: keyof T | ((row: T) => ReactNode)
  className?: string
  headerClassName?: string
}

// Helper function to truncate long strings with ellipsis
export const truncateString = (str: string, maxLength: number = 8): string => {
  if (!str || str.length <= maxLength * 2) return str
  return `${str.slice(0, maxLength)}...${str.slice(-maxLength)}`
}

// Helper function to copy text to clipboard
export const copyToClipboard = (
  text: string,
  message: string = 'Copied to clipboard'
) => {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      toast.success(message)
    })
    .catch((err) => {
      console.error('Failed to copy:', err)
    })
}

// Helper function to render a copyable field
export const renderCopyableField = (
  value: string,
  truncate: boolean = true,
  maxLength: number = 8,
  copyMessage?: string
): ReactNode => {
  if (!value || !value.trim()) {
    return (
      <div className="flex items-center justify-center">
        <Minus className="w-4 h-4 text-slate-500" />
      </div>
    )
  }

  const displayValue = truncate ? truncateString(value, maxLength) : value
  const fullValue = value

  return (
    <div className="flex items-center min-w-0">
      <span
        className="truncate mr-2 font-mono text-xs text-slate-400"
        title={truncate ? fullValue : undefined}
      >
        {displayValue}
      </span>
      <button
        className="flex-shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
        onClick={(e) => {
          e.stopPropagation()
          copyToClipboard(fullValue, copyMessage)
        }}
        tabIndex={0}
        title={`Copy ${copyMessage || 'text'}`}
      >
        <Copy className="w-3 h-3" />
      </button>
    </div>
  )
}

// Helper function to render a date field consistently
export const renderDateField = (
  timestamp: number | string | null | undefined,
  use24h: boolean = true
): ReactNode => {
  if (!timestamp) {
    return (
      <div className="flex items-center justify-center">
        <Minus className="w-4 h-4 text-slate-500" />
      </div>
    )
  }

  const numericTimestamp =
    typeof timestamp === 'string' ? parseInt(timestamp) : timestamp
  return (
    <span className="text-slate-300">
      {formatDate(numericTimestamp, use24h)}
    </span>
  )
}

// Helper function to render a status badge
export const renderStatusBadge = (
  status: string,
  variant: 'success' | 'danger' | 'warning' | 'info' | 'default' = 'default'
): ReactNode => {
  return (
    <Badge size="sm" variant={variant}>
      {status}
    </Badge>
  )
}

// Helper function to render an amount field
export const renderAmountField = (
  amount: string | number,
  asset: string,
  bitcoinUnit: string
): ReactNode => {
  // This is a placeholder - the actual formatting logic should be passed from the parent
  return (
    <span className="font-semibold text-white">
      {amount} {asset === 'BTC' ? bitcoinUnit : asset}
    </span>
  )
}

// Helper function to render an empty field with consistent styling
export const renderEmptyField = (): ReactNode => {
  return (
    <div className="flex items-center justify-center">
      <Minus className="w-4 h-4 text-slate-500" />
    </div>
  )
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  className?: string
  containerClassName?: string
  rowClassName?: string | ((row: T, index: number) => string)
  minWidth?: string
  emptyState?: ReactNode
  gridClassName?: string
  onRowClick?: (row: T) => void
  showHeader?: boolean
  headerClassName?: string
  rowHover?: boolean
  striped?: boolean
}

export function Table<T>({
  columns,
  data,
  className,
  containerClassName,
  rowClassName,
  minWidth = '800px',
  emptyState,
  gridClassName,
  onRowClick,
  showHeader = true,
  headerClassName,
  rowHover = true,
  striped = false,
}: TableProps<T>) {
  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>
  }

  const gridClass = gridClassName || 'grid-cols-12'

  return (
    <div
      className={twMerge(
        'overflow-x-auto bg-slate-800/30 rounded-lg border border-slate-700',
        containerClassName
      )}
    >
      <div style={{ minWidth }}>
        {showHeader && (
          <div
            className={twMerge(
              `grid ${gridClass} font-medium text-slate-400 border-b border-slate-700 py-3 text-sm`,
              className,
              headerClassName
            )}
          >
            {columns.map((column, index) => (
              <div
                className={twMerge(
                  'px-4 whitespace-nowrap',
                  column.className,
                  column.headerClassName
                )}
                key={index}
              >
                {column.header}
              </div>
            ))}
          </div>
        )}

        {data.map((row, rowIndex) => (
          <div
            className={twMerge(
              `grid ${gridClass} border-b border-slate-700 items-center text-sm font-medium transition-colors`,
              rowHover && 'hover:bg-slate-800/30',
              striped && rowIndex % 2 === 1 && 'bg-slate-800/20',
              typeof rowClassName === 'function'
                ? rowClassName(row, rowIndex)
                : rowClassName,
              onRowClick ? 'cursor-pointer' : ''
            )}
            key={rowIndex}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {columns.map((column, colIndex) => (
              <div
                className={twMerge('py-3 px-4', column.className)}
                key={colIndex}
              >
                {typeof column.accessor === 'function'
                  ? column.accessor(row)
                  : (row[column.accessor] as ReactNode)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
