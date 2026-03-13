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
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
    return 'text-content-secondary'
  }

  return (
    <div
      className={`bg-surface-overlay/80 backdrop-blur-sm rounded-xl shadow-lg border border-border-default/50 p-5 ${className}`}
    >
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-medium text-content-secondary">{title}</h2>
        <div className="p-2 rounded-lg bg-surface-high/70">{icon}</div>
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
  const { t } = useTranslation()
  const [listChannels, listChannelsResponse] =
    nodeApi.endpoints.listChannels.useLazyQuery()
  const [listAssets, listAssetsResponse] =
    nodeApi.endpoints.listAssets.useLazyQuery()
  const navigate = useNavigate()
  const [assets, setAssets] = useState<Record<string, Asset>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'bitcoin' | 'rgb'>('all')
  const isRefreshingRef = useRef(false)

  // Sorting and filtering state
  const [sortBy, setSortBy] = useState<SortOption>({
    direction: 'desc',
    label: t('channels.capacityHighToLow'),
    value: 'capacity',
  })
  const [filterOptions, setFilterOptions] = useState<FilterOption[]>([])
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false)
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false)

  const refreshData = useCallback(
    async (silent = false) => {
      if (isRefreshingRef.current) return

      isRefreshingRef.current = true

      if (!silent) {
        setIsLoading(true)
      }

      try {
        await Promise.all([listChannels(), listAssets()])
        setLastUpdated(new Date())
      } finally {
        isRefreshingRef.current = false
        if (!silent) {
          setIsLoading(false)
        }
      }
    },
    [listChannels, listAssets]
  )

  useEffect(() => {
    refreshData()
  }, [refreshData])

  // Keep channel data reasonably fresh without making the whole page feel busy.
  useEffect(() => {
    const intervalId = setInterval(() => {
      refreshData(true)
    }, 15000)

    return () => clearInterval(intervalId)
  }, [refreshData])

  useEffect(() => {
    if (listAssetsResponse.data) {
      if (listAssetsResponse.data?.nia) {
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
            total =
              (channel.inbound_balance_msat ?? 0) +
              (channel.outbound_balance_msat ?? 0)
            localPercentage =
              total === 0
                ? 0
                : ((channel.outbound_balance_msat ?? 0) / total) * 100
            remotePercentage =
              total === 0
                ? 0
                : ((channel.inbound_balance_msat ?? 0) / total) * 100
            return localPercentage >= 20 && remotePercentage >= 20
          case 'unbalanced':
            totalBal =
              (channel.inbound_balance_msat ?? 0) +
              (channel.outbound_balance_msat ?? 0)
            localPct =
              totalBal === 0
                ? 0
                : ((channel.outbound_balance_msat ?? 0) / totalBal) * 100
            remotePct =
              totalBal === 0
                ? 0
                : ((channel.inbound_balance_msat ?? 0) / totalBal) * 100
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
        return ((a.capacity_sat ?? 0) - (b.capacity_sat ?? 0)) * direction
      case 'outbound':
        return (
          ((a.outbound_balance_msat ?? 0) - (b.outbound_balance_msat ?? 0)) *
          direction
        )
      case 'inbound':
        return (
          ((a.inbound_balance_msat ?? 0) - (b.inbound_balance_msat ?? 0)) *
          direction
        )
      case 'balance':
        totalA = (a.inbound_balance_msat ?? 0) + (a.outbound_balance_msat ?? 0)
        totalB = (b.inbound_balance_msat ?? 0) + (b.outbound_balance_msat ?? 0)
        balanceA =
          totalA === 0
            ? 0
            : Math.abs(50 - ((a.outbound_balance_msat ?? 0) / totalA) * 100)
        balanceB =
          totalB === 0
            ? 0
            : Math.abs(50 - ((b.outbound_balance_msat ?? 0) / totalB) * 100)
        return (balanceA - balanceB) * direction
      default:
        return 0
    }
  })

  // Calculate totals for all channels
  const totalBalance = channels.reduce(
    (sum, channel) =>
      sum + Math.floor((channel.outbound_balance_msat ?? 0) / 1000),
    0
  )
  const totalInboundLiquidity = channels.reduce(
    (sum, channel) =>
      sum + Math.floor((channel.inbound_balance_msat ?? 0) / 1000),
    0
  )
  const totalOutboundLiquidity = channels.reduce(
    (sum, channel) =>
      sum + Math.floor((channel.outbound_balance_msat ?? 0) / 1000),
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
    { label: t('channels.public'), value: 'public' },
    { label: t('channels.private'), value: 'private' },
    { label: t('channels.balanced'), value: 'balanced' },
    { label: t('channels.unbalanced'), value: 'unbalanced' },
    { label: t('channels.ready'), value: 'ready' },
    { label: t('channels.pending'), value: 'pending' },
  ]

  // Available sort options
  const sortOptions: SortOption[] = [
    {
      direction: 'desc',
      label: t('channels.capacityHighToLow'),
      value: 'capacity',
    },
    {
      direction: 'asc',
      label: t('channels.capacityLowToHigh'),
      value: 'capacity',
    },
    {
      direction: 'desc',
      label: t('channels.outboundHighToLow'),
      value: 'outbound',
    },
    {
      direction: 'asc',
      label: t('channels.outboundLowToHigh'),
      value: 'outbound',
    },
    {
      direction: 'desc',
      label: t('channels.inboundHighToLow'),
      value: 'inbound',
    },
    {
      direction: 'asc',
      label: t('channels.inboundLowToHigh'),
      value: 'inbound',
    },
    { direction: 'asc', label: t('channels.mostBalanced'), value: 'balance' },
    { direction: 'desc', label: t('channels.leastBalanced'), value: 'balance' },
  ]

  // Clear all filters
  const clearFilters = () => {
    setFilterOptions([])
  }

  return (
    <div className="bg-gradient-to-b from-surface-base to-surface-base py-8 px-6 rounded-xl border border-border-subtle/50 shadow-xl w-full text-white">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">{t('channels.pageTitle')}</h1>
          <p className="text-content-secondary text-sm mt-1">
            {lastUpdated
              ? t('channels.lastUpdated', { time: formatTimeAgo(lastUpdated) })
              : t('channels.loadingData')}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            className="px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-emphasis transition text-primary-foreground font-medium shadow-lg shadow-primary/20 flex items-center"
            onClick={() => navigate(CREATE_NEW_CHANNEL_PATH)}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            {t('channels.openChannel')}
          </button>
          <button
            className="px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-emphasis transition text-primary-foreground font-medium shadow-lg shadow-primary/20 flex items-center"
            onClick={() => navigate(ORDER_CHANNEL_PATH)}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            {t('channels.buyChannel')}
          </button>
          <button
            className={`px-4 py-2.5 rounded-lg border border-border-default bg-surface-overlay hover:bg-surface-high transition text-content-primary font-medium flex items-center ${
              isLoading ? 'opacity-70 cursor-not-allowed' : ''
            }`}
            disabled={isLoading}
            onClick={() => {
              void refreshData()
            }}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
            />
            {isLoading ? t('channels.refreshing') : t('channels.refresh')}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <StatCard
          icon={<Zap className="h-4 w-4 text-yellow-400" />}
          title={t('channels.totalBalance')}
          trend="neutral"
          value={`${totalBalance.toLocaleString()} sats`}
        />
        <StatCard
          icon={<ArrowDownRight className="h-4 w-4 text-green-400" />}
          title={t('channels.inboundLiquidity')}
          trend="up"
          // trendValue="4.5% this week"
          value={`${totalInboundLiquidity.toLocaleString()} sats`}
        />
        <StatCard
          icon={<ArrowUpRight className="h-4 w-4 text-blue-400" />}
          title={t('channels.outboundLiquidity')}
          trend="down"
          // trendValue="2.3% this week"
          value={`${totalOutboundLiquidity.toLocaleString()} sats`}
        />
      </div>

      <div className="bg-gradient-to-b from-surface-overlay/50 to-surface-base/50 backdrop-blur-sm rounded-xl border border-border-default/50 shadow-lg py-6 px-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
          <h2 className="text-xl font-bold">{t('channels.yourChannels')}</h2>

          <div className="flex items-center space-x-2">
            {/* Channel type tabs */}
            <div className="bg-surface-base/80 rounded-lg p-1 flex shadow-inner">
              <button
                className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center transition-all ${
                  activeTab === 'all'
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-content-secondary hover:bg-surface-overlay'
                }`}
                onClick={() => setActiveTab('all')}
              >
                <Zap className="h-3.5 w-3.5 mr-1.5" />
                {t('channels.all')} ({channels.length})
              </button>
              <button
                className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center transition-all ${
                  activeTab === 'bitcoin'
                    ? 'bg-yellow-500 text-surface-base shadow-md'
                    : 'text-content-secondary hover:bg-surface-overlay'
                }`}
                onClick={() => setActiveTab('bitcoin')}
              >
                <Bolt className="h-3.5 w-3.5 mr-1.5" />
                {t('channels.bitcoin')} ({bitcoinChannels.length})
              </button>
              <button
                className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center transition-all ${
                  activeTab === 'rgb'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-content-secondary hover:bg-surface-overlay'
                }`}
                onClick={() => setActiveTab('rgb')}
              >
                <Layers className="h-3.5 w-3.5 mr-1.5" />
                {t('channels.rgb')} ({rgbChannels.length})
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
                    className="bg-surface-overlay text-content-secondary text-xs px-2 py-1 rounded-md flex items-center"
                    key={filter.value}
                  >
                    {filter.label}
                    <button
                      className="ml-1.5 text-content-secondary hover:text-white"
                      onClick={() => toggleFilter(filter)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button
                  className="text-xs text-content-secondary hover:text-white underline"
                  onClick={clearFilters}
                >
                  {t('channels.clearAll')}
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {/* Filter dropdown */}
            <div className="relative">
              <button
                className="px-3 py-1.5 rounded-lg bg-surface-overlay hover:bg-surface-high text-sm text-content-secondary flex items-center"
                onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
              >
                <Filter className="mr-1.5" size={14} />
                {t('channels.filter')}
                <ChevronDown className="ml-1.5" size={14} />
              </button>

              {isFilterMenuOpen && (
                <div className="absolute right-0 mt-1 bg-surface-overlay rounded-lg shadow-lg p-2 z-10 w-48">
                  <div className="text-xs text-content-secondary mb-1 px-2">
                    {t('channels.filterBy')}
                  </div>
                  {availableFilters.map((filter) => (
                    <div
                      className="flex items-center px-2 py-1.5 hover:bg-surface-high rounded cursor-pointer"
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
                className="px-3 py-1.5 rounded-lg bg-surface-overlay hover:bg-surface-high text-sm text-content-secondary flex items-center"
                onClick={() => setIsSortMenuOpen(!isSortMenuOpen)}
              >
                <SortAsc className="mr-1.5" size={14} />
                {sortBy.label}
                <ChevronDown className="ml-1.5" size={14} />
              </button>

              {isSortMenuOpen && (
                <div className="absolute right-0 mt-1 bg-surface-overlay rounded-lg shadow-lg p-2 z-10 w-56">
                  <div className="text-xs text-content-secondary mb-1 px-2">
                    {t('channels.sortBy')}
                  </div>
                  {sortOptions.map((option) => (
                    <div
                      className={`flex items-center px-2 py-1.5 hover:bg-surface-high rounded cursor-pointer ${
                        sortBy.value === option.value &&
                        sortBy.direction === option.direction
                          ? 'bg-surface-high/50'
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
              const asset = channel.asset_id
                ? assets[channel.asset_id]
                : undefined
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
          <div className="bg-gradient-to-b from-surface-base/70 to-surface-base/70 border border-border-subtle/60 rounded-lg p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-surface-overlay/80 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <AlertCircle className="h-8 w-8 text-content-secondary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">
              {t('channels.noChannelsFound', {
                type:
                  activeTab !== 'all'
                    ? activeTab === 'bitcoin'
                      ? t('channels.bitcoin')
                      : t('channels.rgb')
                    : '',
              })}
            </h3>
            <p className="text-content-secondary mb-6 max-w-md mx-auto">
              {filterOptions.length > 0
                ? t('channels.noChannelsMatchFilters')
                : activeTab === 'all'
                  ? t('channels.noChannelsYet')
                  : activeTab === 'bitcoin'
                    ? t('channels.noBitcoinChannels')
                    : t('channels.noRgbChannels')}
            </p>
            {filterOptions.length > 0 ? (
              <button
                className="px-5 py-2.5 rounded-lg bg-surface-high hover:bg-surface-elevated transition text-white font-medium flex items-center mx-auto"
                onClick={clearFilters}
              >
                <X className="mr-2 h-4 w-4" />
                {t('channels.clearFilters')}
              </button>
            ) : (
              <button
                className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-emphasis transition text-primary-foreground font-medium shadow-lg shadow-primary/20 flex items-center mx-auto"
                onClick={() => navigate(CREATE_NEW_CHANNEL_PATH)}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                {t('channels.openChannelType', {
                  type:
                    activeTab !== 'all'
                      ? activeTab === 'bitcoin'
                        ? t('channels.bitcoin')
                        : t('channels.rgb')
                      : '',
                })}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2 text-sm text-content-secondary mt-6 p-4 bg-blue-900/20 border border-blue-800/30 rounded-lg">
        <Info className="h-5 w-5 text-blue-400 flex-shrink-0" />
        <p>{t('channels.liquidityInfo')}</p>
      </div>
    </div>
  )
}
