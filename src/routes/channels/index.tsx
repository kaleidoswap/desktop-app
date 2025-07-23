import {
  RefreshCw,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  PlusCircle,
  AlertCircle,
  Layers,
  Bolt,
  Filter,
  SortAsc,
  ChevronDown,
  ShoppingCart,
  X,
} from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  CREATE_NEW_CHANNEL_PATH,
  ORDER_CHANNEL_PATH,
} from '../../app/router/paths'
import { ChannelCard } from '../../components/ChannelCard'
import { formatTimeAgo } from '../../helpers/datetime'
import { nodeApi, Channel } from '../../slices/nodeApi/nodeApi.slice'

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  className?: string
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  trend,
  trendValue,
  className = '',
}) => {
  const getTrendColor = () => {
    if (trend === 'up') return 'text-green-400'
    if (trend === 'down') return 'text-red-400'
    return 'text-gray-400'
  }

  return (
    <div
      className={`bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-700/50 p-5 ${className}`}
    >
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-medium text-gray-400">{title}</h2>
        <div className="p-2 rounded-lg bg-gray-700/70">{icon}</div>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {trend && trendValue && (
        <div className={`text-xs flex items-center mt-2 ${getTrendColor()}`}>
          {trend === 'up' && <ArrowUpRight className="h-3 w-3 mr-1" />}
          {trend === 'down' && <ArrowDownRight className="h-3 w-3 mr-1" />}
          {trendValue}
        </div>
      )}
    </div>
  )
}

interface Asset {
  precision: number
  ticker: string
}

// Define sorting options
type SortOption = {
  label: string
  value: string
  direction: 'asc' | 'desc'
}

// Define filter options
type FilterOption = {
  label: string
  value: string
}

export const Component: React.FC = () => {
  const [listChannels, listChannelsResponse] =
    nodeApi.endpoints.listChannels.useLazyQuery()
  const [listAssets, listAssetsResponse] =
    nodeApi.endpoints.listAssets.useLazyQuery()
  const navigate = useNavigate()
  const [assets, setAssets] = useState<Record<string, Asset>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'bitcoin' | 'rgb'>('all')

  // Sorting and filtering state
  const [sortBy, setSortBy] = useState<SortOption>({
    direction: 'desc',
    label: 'Capacity (High to Low)',
    value: 'capacity',
  })
  const [filterOptions, setFilterOptions] = useState<FilterOption[]>([])
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false)
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false)

  const refreshData = useCallback(() => {
    setIsLoading(true)
    Promise.all([listChannels(), listAssets()]).finally(() => {
      setIsLoading(false)
      setLastUpdated(new Date())
    })
  }, [listChannels, listAssets])

  useEffect(() => {
    refreshData()
  }, [refreshData])

  // Auto-refresh every 3 seconds
  useEffect(() => {
    const intervalId = setInterval(() => {
      refreshData()
    }, 3000)

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId)
  }, [refreshData])

  useEffect(() => {
    if (listAssetsResponse.data) {
      const assetsMap = listAssetsResponse.data.nia.reduce(
        (acc: Record<string, Asset>, asset: any) => {
          acc[asset.asset_id] = {
            precision: asset.precision,
            ticker: asset.ticker,
          }
          return acc
        },
        {}
      )
      setAssets(assetsMap)
    }
  }, [listAssetsResponse.data])

  const channels: Channel[] = listChannelsResponse?.data?.channels ?? []

  // Separate channels by type
  const bitcoinChannels = channels.filter((channel) => !channel.asset_id)
  const rgbChannels = channels.filter((channel) => channel.asset_id)

  // Get displayed channels based on active tab
  let displayedChannels =
    activeTab === 'all'
      ? channels
      : activeTab === 'bitcoin'
        ? bitcoinChannels
        : rgbChannels

  // Apply filters
  if (filterOptions.length > 0) {
    displayedChannels = displayedChannels.filter((channel) => {
      // Check if channel matches any of the filter criteria
      return filterOptions.every((filter) => {
        let total, localPercentage, remotePercentage
        let totalBal, localPct, remotePct

        switch (filter.value) {
          case 'public':
            return channel.public === true
          case 'private':
            return channel.public === false
          case 'balanced':
            total = channel.inbound_balance_msat + channel.outbound_balance_msat
            localPercentage =
              total === 0 ? 0 : (channel.outbound_balance_msat / total) * 100
            remotePercentage =
              total === 0 ? 0 : (channel.inbound_balance_msat / total) * 100
            return localPercentage >= 20 && remotePercentage >= 20
          case 'unbalanced':
            totalBal =
              channel.inbound_balance_msat + channel.outbound_balance_msat
            localPct =
              totalBal === 0
                ? 0
                : (channel.outbound_balance_msat / totalBal) * 100
            remotePct =
              totalBal === 0
                ? 0
                : (channel.inbound_balance_msat / totalBal) * 100
            return localPct < 20 || remotePct < 20
          case 'ready':
            return channel.ready === true
          case 'pending':
            return channel.ready === false
          default:
            return true
        }
      })
    })
  }

  // Apply sorting
  displayedChannels = [...displayedChannels].sort((a, b) => {
    const direction = sortBy.direction === 'asc' ? 1 : -1
    let totalA, totalB, balanceA, balanceB

    switch (sortBy.value) {
      case 'capacity':
        return (a.capacity_sat - b.capacity_sat) * direction
      case 'outbound':
        return (a.outbound_balance_msat - b.outbound_balance_msat) * direction
      case 'inbound':
        return (a.inbound_balance_msat - b.inbound_balance_msat) * direction
      case 'balance':
        totalA = a.inbound_balance_msat + a.outbound_balance_msat
        totalB = b.inbound_balance_msat + b.outbound_balance_msat
        balanceA =
          totalA === 0
            ? 0
            : Math.abs(50 - (a.outbound_balance_msat / totalA) * 100)
        balanceB =
          totalB === 0
            ? 0
            : Math.abs(50 - (b.outbound_balance_msat / totalB) * 100)
        return (balanceA - balanceB) * direction
      default:
        return 0
    }
  })

  // Calculate totals for all channels
  const totalBalance = channels.reduce(
    (sum, channel) => sum + Math.floor(channel.outbound_balance_msat / 1000),
    0
  )
  const totalInboundLiquidity = channels.reduce(
    (sum, channel) => sum + Math.floor(channel.inbound_balance_msat / 1000),
    0
  )
  const totalOutboundLiquidity = channels.reduce(
    (sum, channel) => sum + Math.floor(channel.outbound_balance_msat / 1000),
    0
  )

  // Toggle filter option
  const toggleFilter = (filter: FilterOption) => {
    if (filterOptions.some((f) => f.value === filter.value)) {
      setFilterOptions(filterOptions.filter((f) => f.value !== filter.value))
    } else {
      setFilterOptions([...filterOptions, filter])
    }
  }

  // Available filter options
  const availableFilters: FilterOption[] = [
    { label: 'Public', value: 'public' },
    { label: 'Private', value: 'private' },
    { label: 'Balanced', value: 'balanced' },
    { label: 'Unbalanced', value: 'unbalanced' },
    { label: 'Ready', value: 'ready' },
    { label: 'Pending', value: 'pending' },
  ]

  // Available sort options
  const sortOptions: SortOption[] = [
    { direction: 'desc', label: 'Capacity (High to Low)', value: 'capacity' },
    { direction: 'asc', label: 'Capacity (Low to High)', value: 'capacity' },
    { direction: 'desc', label: 'Outbound (High to Low)', value: 'outbound' },
    { direction: 'asc', label: 'Outbound (Low to High)', value: 'outbound' },
    { direction: 'desc', label: 'Inbound (High to Low)', value: 'inbound' },
    { direction: 'asc', label: 'Inbound (Low to High)', value: 'inbound' },
    { direction: 'asc', label: 'Most Balanced', value: 'balance' },
    { direction: 'desc', label: 'Least Balanced', value: 'balance' },
  ]

  // Clear all filters
  const clearFilters = () => {
    setFilterOptions([])
  }

  return (
    <div className="bg-gradient-to-b from-gray-900 to-gray-950 py-8 px-6 rounded-xl border border-gray-800/50 shadow-xl w-full text-white">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">Lightning Wallet Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">
            {lastUpdated
              ? `Last updated: ${formatTimeAgo(lastUpdated)}`
              : 'Loading data...'}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 transition text-white font-medium shadow-lg shadow-blue-700/20 flex items-center"
            onClick={() => navigate(CREATE_NEW_CHANNEL_PATH)}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Open Channel
          </button>
          <button
            className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 transition text-white font-medium shadow-lg shadow-blue-700/20 flex items-center"
            onClick={() => navigate(ORDER_CHANNEL_PATH)}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Buy Channel
          </button>
          <button
            className={`px-4 py-2.5 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 transition text-gray-200 font-medium flex items-center ${
              isLoading ? 'opacity-70 cursor-not-allowed' : ''
            }`}
            disabled={isLoading}
            onClick={refreshData}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
            />
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <StatCard
          icon={<Zap className="h-4 w-4 text-yellow-400" />}
          title="Total Balance"
          trend="neutral"
          value={`${totalBalance.toLocaleString()} sats`}
        />
        <StatCard
          icon={<ArrowDownRight className="h-4 w-4 text-green-400" />}
          title="Inbound Liquidity"
          trend="up"
          // trendValue="4.5% this week"
          value={`${totalInboundLiquidity.toLocaleString()} sats`}
        />
        <StatCard
          icon={<ArrowUpRight className="h-4 w-4 text-blue-400" />}
          title="Outbound Liquidity"
          trend="down"
          // trendValue="2.3% this week"
          value={`${totalOutboundLiquidity.toLocaleString()} sats`}
        />
      </div>

      <div className="bg-gradient-to-b from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700/50 shadow-lg py-6 px-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
          <h2 className="text-xl font-bold">Your Channels</h2>

          <div className="flex items-center space-x-2">
            {/* Channel type tabs */}
            <div className="bg-gray-900/80 rounded-lg p-1 flex shadow-inner">
              <button
                className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center transition-all ${
                  activeTab === 'all'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
                onClick={() => setActiveTab('all')}
              >
                <Zap className="h-3.5 w-3.5 mr-1.5" />
                All ({channels.length})
              </button>
              <button
                className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center transition-all ${
                  activeTab === 'bitcoin'
                    ? 'bg-yellow-500 text-gray-900 shadow-md'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
                onClick={() => setActiveTab('bitcoin')}
              >
                <Bolt className="h-3.5 w-3.5 mr-1.5" />
                Bitcoin ({bitcoinChannels.length})
              </button>
              <button
                className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center transition-all ${
                  activeTab === 'rgb'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
                onClick={() => setActiveTab('rgb')}
              >
                <Layers className="h-3.5 w-3.5 mr-1.5" />
                RGB ({rgbChannels.length})
              </button>
            </div>
          </div>
        </div>

        {/* Filter and Sort Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex flex-wrap gap-2 items-center">
            {/* Active filters */}
            {filterOptions.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center">
                {filterOptions.map((filter) => (
                  <div
                    className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded-md flex items-center"
                    key={filter.value}
                  >
                    {filter.label}
                    <button
                      className="ml-1.5 text-gray-400 hover:text-white"
                      onClick={() => toggleFilter(filter)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button
                  className="text-xs text-gray-400 hover:text-white underline"
                  onClick={clearFilters}
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {/* Filter dropdown */}
            <div className="relative">
              <button
                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 flex items-center"
                onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
              >
                <Filter className="mr-1.5" size={14} />
                Filter
                <ChevronDown className="ml-1.5" size={14} />
              </button>

              {isFilterMenuOpen && (
                <div className="absolute right-0 mt-1 bg-gray-800 rounded-lg shadow-lg p-2 z-10 w-48">
                  <div className="text-xs text-gray-400 mb-1 px-2">
                    Filter by:
                  </div>
                  {availableFilters.map((filter) => (
                    <div
                      className="flex items-center px-2 py-1.5 hover:bg-gray-700 rounded cursor-pointer"
                      key={filter.value}
                      onClick={() => toggleFilter(filter)}
                    >
                      <input
                        checked={filterOptions.some(
                          (f) => f.value === filter.value
                        )}
                        className="mr-2"
                        readOnly
                        type="checkbox"
                      />
                      <span className="text-sm">{filter.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sort dropdown */}
            <div className="relative">
              <button
                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 flex items-center"
                onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
              >
                <SortAsc className="mr-1.5" size={14} />
                {sortBy.label}
                <ChevronDown className="ml-1.5" size={14} />
              </button>

              {isSortMenuOpen && (
                <div className="absolute right-0 mt-1 bg-gray-800 rounded-lg shadow-lg p-2 z-10 w-56">
                  <div className="text-xs text-gray-400 mb-1 px-2">
                    Sort by:
                  </div>
                  {sortOptions.map((option) => (
                    <div
                      className={`flex items-center px-2 py-1.5 hover:bg-gray-700 rounded cursor-pointer ${
                        sortBy.value === option.value &&
                        sortBy.direction === option.direction
                          ? 'bg-gray-700/50'
                          : ''
                      }`}
                      key={`${option.value}-${option.direction}`}
                      onClick={() => {
                        setSortBy(option)
                        setIsSortMenuOpen(false)
                      }}
                    >
                      <span className="text-sm">{option.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {displayedChannels.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {displayedChannels.map((channel) => {
              const asset = assets[channel.asset_id]
              return (
                <ChannelCard
                  asset={asset}
                  channel={channel}
                  key={channel.channel_id}
                  onClose={refreshData}
                />
              )
            })}
          </div>
        ) : (
          <div className="bg-gradient-to-b from-gray-900/70 to-gray-950/70 border border-gray-800/60 rounded-lg p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-800/80 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <AlertCircle className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              No{' '}
              {activeTab !== 'all'
                ? activeTab === 'bitcoin'
                  ? 'Bitcoin'
                  : 'RGB'
                : ''}{' '}
              Channels Found
            </h3>
            <p className="text-gray-400 mb-6 max-w-md mx-auto">
              {filterOptions.length > 0
                ? 'No channels match your current filters. Try adjusting your filter criteria.'
                : activeTab === 'all'
                  ? "You don't have any open channels yet. Create a channel to start using Lightning Network."
                  : activeTab === 'bitcoin'
                    ? "You don't have any Bitcoin channels open. Create a Bitcoin channel to start using Lightning Network."
                    : "You don't have any RGB channels open. Create an RGB channel to start using RGB assets over Lightning."}
            </p>
            {filterOptions.length > 0 ? (
              <button
                className="px-5 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 transition text-white font-medium flex items-center mx-auto"
                onClick={clearFilters}
              >
                <X className="mr-2 h-4 w-4" />
                Clear Filters
              </button>
            ) : (
              <button
                className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 transition text-white font-medium shadow-lg shadow-blue-700/20 flex items-center mx-auto"
                onClick={() => navigate(CREATE_NEW_CHANNEL_PATH)}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Open{' '}
                {activeTab !== 'all'
                  ? activeTab === 'bitcoin'
                    ? 'Bitcoin'
                    : 'RGB'
                  : ''}{' '}
                Channel
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2 text-sm text-gray-400 mt-6 p-4 bg-blue-900/20 border border-blue-800/30 rounded-lg">
        <Info className="h-5 w-5 text-blue-400 flex-shrink-0" />
        <p>
          Channel liquidity changes as you send and receive payments. Keep your
          channels balanced for optimal performance and lower fees.
        </p>
      </div>
    </div>
  )
}
