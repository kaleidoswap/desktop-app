import { Filter } from 'lucide-react'
import React from 'react'

export type WalletFilterType = 'all' | 'rgb' | 'spark'

interface WalletTypeFilterProps {
  activeFilter: WalletFilterType
  onFilterChange: (filter: WalletFilterType) => void
  rgbCount: number
  sparkCount: number
}

export const WalletTypeFilter: React.FC<WalletTypeFilterProps> = ({
  activeFilter,
  onFilterChange,
  rgbCount,
  sparkCount,
}) => {
  const totalCount = rgbCount + sparkCount

  const filterOptions = [
    { count: totalCount, id: 'all' as const, label: 'All Assets' },
    { count: rgbCount, id: 'rgb' as const, label: 'RGB' },
    { count: sparkCount, id: 'spark' as const, label: 'Spark' },
  ]

  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="flex items-center gap-2 text-slate-400">
        <Filter className="w-4 h-4" />
        <span className="text-sm font-medium">Filter:</span>
      </div>

      <div className="flex gap-2 bg-slate-800/50 p-1 rounded-xl">
        {filterOptions.map((option) => (
          <button
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${
                activeFilter === option.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }
            `}
            key={option.id}
            onClick={() => onFilterChange(option.id)}
          >
            {option.label}
            <span
              className={`
                ml-2 px-2 py-0.5 rounded-full text-xs font-semibold
                ${
                  activeFilter === option.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-700 text-slate-400'
                }
              `}
            >
              {option.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
