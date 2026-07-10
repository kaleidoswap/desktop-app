import {
  RefreshCw,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  Layers,
  Filter,
  PlusCircle,
  SortAsc,
  Wallet,
  X,
  Bitcoin,
} from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { CREATE_NEW_CHANNEL_PATH } from '../../app/router/paths'
import { ChannelCard } from '../../components/ChannelCard'
import { ChannelsNav } from '../../components/Channels/ChannelsNav'
import { Select } from '../../components/ui/Select'
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
        <div className="p-1.5 rounded-md bg-primary/10">{icon}</div>
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

export const Component: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [listChannels, listChannelsResponse] =
    nodeApi.endpoints.listChannels.useLazyQuery()
  const [listAssets, listAssetsResponse] =
    nodeApi.endpoints.listAssets.useLazyQuery()
  const [assets, setAssets] = useState<Record<string, Asset>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'bitcoin' | 'rgb'>('all')
  const isRefreshingRef = useRef(false)

  // Sorting and filtering state
  const [sortKey, setSortKey] = useState('capacity_desc')
  const [filterValue, setFilterValue] = useState('all')

  const refreshData = useCallback(
    async (silent = false) => {
      if (isRefreshingRef.current) return

      isRefreshingRef.current = true

      if (!silent) {
        setIsLoading(true)
      }

      try {
        await Promise.all([listChannels(), listAssets()])
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
  if (filterValue !== 'all') {
    displayedChannels = displayedChannels.filter((channel) => {
      let total, localPercentage, remotePercentage
      let totalBal, localPct, remotePct

      switch (filterValue) {
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
  }

  // Apply sorting
  const lastUnderscore = sortKey.lastIndexOf('_')
  const sortVal = sortKey.slice(0, lastUnderscore)
  const direction = sortKey.slice(lastUnderscore + 1) === 'asc' ? 1 : -1
  displayedChannels = [...displayedChannels].sort((a, b) => {
    let totalA, totalB, balanceA, balanceB

    switch (sortVal) {
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

  const filterSelectOptions = [
    { label: t('channels.allChannels'), value: 'all' },
    { label: t('channels.ready'), value: 'ready' },
    { label: t('channels.pending'), value: 'pending' },
    { label: t('channels.public'), value: 'public' },
    { label: t('channels.private'), value: 'private' },
    { label: t('channels.balanced'), value: 'balanced' },
    { label: t('channels.unbalanced'), value: 'unbalanced' },
  ]

  const sortSelectOptions = [
    { label: t('channels.capacityHighToLow'), value: 'capacity_desc' },
    { label: t('channels.capacityLowToHigh'), value: 'capacity_asc' },
    { label: t('channels.outboundHighToLow'), value: 'outbound_desc' },
    { label: t('channels.outboundLowToHigh'), value: 'outbound_asc' },
    { label: t('channels.inboundHighToLow'), value: 'inbound_desc' },
    { label: t('channels.inboundLowToHigh'), value: 'inbound_asc' },
    { label: t('channels.mostBalanced'), value: 'balance_asc' },
    { label: t('channels.leastBalanced'), value: 'balance_desc' },
  ]

  return (
    <div className="w-full min-h-full text-white">
      <div className="mx-auto w-full max-w-screen-xl px-4 pt-2">
        <ChannelsNav />
      </div>
      <div className="px-4 pb-6 pt-8 animate-fade-in">
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <StatCard
            icon={<Wallet className="h-4 w-4 text-primary" />}
            title={t('channels.totalBalance')}
            trend="neutral"
            value={`${totalBalance.toLocaleString()} sats`}
          />
          <StatCard
            icon={<ArrowDownRight className="h-4 w-4 text-primary" />}
            title={t('channels.inboundLiquidity')}
            trend="up"
            value={`${totalInboundLiquidity.toLocaleString()} sats`}
          />
          <StatCard
            icon={<ArrowUpRight className="h-4 w-4 text-primary" />}
            title={t('channels.outboundLiquidity')}
            trend="down"
            value={`${totalOutboundLiquidity.toLocaleString()} sats`}
          />
        </div>

        <div className="bg-surface-overlay/80 backdrop-blur-sm rounded-xl border border-border-default/50 shadow-lg py-6 px-6">
          {/* Controls row: title + tabs + filter + sort all on one level */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-bold">{t('channels.yourChannels')}</h2>

            <div className="flex items-center gap-2">
              {/* Channel type tabs */}
              <div className="flex gap-1 rounded-xl bg-surface-base/35 p-1">
                <button
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:outline-none ${
                    activeTab === 'all'
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'text-content-secondary hover:text-white border border-transparent'
                  }`}
                  onClick={() => setActiveTab('all')}
                >
                  <Zap className="h-3.5 w-3.5" />
                  {t('channels.all')}
                  <span
                    className={`text-xs ${activeTab === 'all' ? 'text-primary' : 'text-white/60'}`}
                  >
                    ({channels.length})
                  </span>
                </button>
                <button
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:outline-none ${
                    activeTab === 'bitcoin'
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'text-content-secondary hover:text-white border border-transparent'
                  }`}
                  onClick={() => setActiveTab('bitcoin')}
                >
                  <Bitcoin className="h-3.5 w-3.5" />
                  {t('channels.bitcoin')}
                  <span
                    className={`text-xs ${activeTab === 'bitcoin' ? 'text-primary' : 'text-white/60'}`}
                  >
                    ({bitcoinChannels.length})
                  </span>
                </button>
                <button
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:outline-none ${
                    activeTab === 'rgb'
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'text-content-secondary hover:text-white border border-transparent'
                  }`}
                  onClick={() => setActiveTab('rgb')}
                >
                  <Layers className="h-3.5 w-3.5" />
                  {t('channels.rgb')}
                  <span
                    className={`text-xs ${activeTab === 'rgb' ? 'text-primary' : 'text-white/60'}`}
                  >
                    ({rgbChannels.length})
                  </span>
                </button>
              </div>

              {/* Filter dropdown */}
              <Select
                icon={<Filter size={14} />}
                onChange={setFilterValue}
                options={filterSelectOptions}
                value={filterValue}
              />

              {/* Sort dropdown */}
              <Select
                icon={<SortAsc size={14} />}
                onChange={setSortKey}
                options={sortSelectOptions}
                value={sortKey}
              />

              {/* Refresh button — rightmost */}
              <button
                className="p-1.5 rounded-lg bg-transparent hover:bg-white/5 border border-white/30 hover:border-white/50 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={isLoading}
                onClick={() => void refreshData()}
                title={
                  isLoading ? t('channels.refreshing') : t('channels.refresh')
                }
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
          </div>

          {displayedChannels.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-[50px]">
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
                {filterValue !== 'all'
                  ? t('channels.noChannelsMatchFilters')
                  : activeTab === 'all'
                    ? t('channels.noChannelsYet')
                    : activeTab === 'bitcoin'
                      ? t('channels.noBitcoinChannels')
                      : t('channels.noRgbChannels')}
              </p>
              {filterValue !== 'all' ? (
                <button
                  className="px-5 py-2.5 rounded-lg bg-surface-high hover:bg-surface-elevated transition text-white font-medium flex items-center mx-auto"
                  onClick={() => setFilterValue('all')}
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
      </div>
    </div>
  )
}
