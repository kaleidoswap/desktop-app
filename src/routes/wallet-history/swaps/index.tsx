import {
  ArrowDownUp,
  ArrowRight,
  RefreshCw,
  Loader,
  Search,
  Calendar,
} from 'lucide-react'
import React, { useState, useMemo } from 'react'
import { useSelector } from 'react-redux'

import { RootState } from '../../../app/store'
import { Button, IconButton, Badge, Card, Alert } from '../../../components/ui'
import {
  Table,
  renderCopyableField,
  renderDateField,
  renderStatusBadge,
} from '../../../components/ui/Table'
import {
  nodeApi,
  SwapDetails,
  SwapStatus,
} from '../../../slices/nodeApi/nodeApi.slice'

interface AssetInfo {
  ticker: string
  precision: number
}

const formatAmount = (
  amount: number,
  precision: number,
  isBtc: boolean,
  bitcoinUnit: string
): string => {
  if (isBtc) {
    // Convert millisats to sats or BTC
    const sats = amount / 1000
    if (bitcoinUnit === 'SAT') {
      return sats.toLocaleString('en-US', {
        maximumFractionDigits: 0,
        useGrouping: true,
      })
    } else {
      const btc = sats / 100000000
      return btc.toLocaleString('en-US', {
        maximumFractionDigits: 8,
        minimumFractionDigits: 8,
        useGrouping: true,
      })
    }
  } else {
    // Format RGB asset amount
    const formattedAmount = amount / Math.pow(10, precision)
    return formattedAmount.toLocaleString('en-US', {
      maximumFractionDigits: precision,
      minimumFractionDigits: 0,
      useGrouping: true,
    })
  }
}

const getStatusBadgeVariant = (status: SwapStatus) => {
  switch (status) {
    case SwapStatus.Succeeded:
      return 'success'
    case SwapStatus.Failed:
    case SwapStatus.Expired:
      return 'danger'
    case SwapStatus.Pending:
    case SwapStatus.Waiting:
      return 'warning'
    default:
      return 'default'
  }
}

export const Component: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [assetFilter, setAssetFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [expandedSwap, setExpandedSwap] = useState<string | null>(null)

  const bitcoinUnit = useSelector(
    (state: RootState) => state.settings.bitcoinUnit
  )

  const {
    data: swapsData,
    isLoading: swapsLoading,
    isError: swapsError,
    refetch: refetchSwaps,
  } = nodeApi.endpoints.listSwaps.useQuery()

  const {
    data: assetsData,
    isLoading: assetsLoading,
    isError: assetsError,
  } = nodeApi.endpoints.listAssets.useQuery()

  const isLoading = swapsLoading || assetsLoading
  const isError = swapsError || assetsError

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refetchSwaps()
    setIsRefreshing(false)
  }

  // Create a map of asset info for easy lookup
  const assetInfo = useMemo(() => {
    const info: Record<string, AssetInfo> = {}
    if (assetsData?.nia) {
      assetsData.nia.forEach((asset) => {
        info[asset.asset_id] = {
          precision: asset.precision,
          ticker: asset.ticker,
        }
      })
    }
    return info
  }, [assetsData])

  // Get all swaps
  const allSwaps = useMemo(() => {
    if (!swapsData) return []

    const makerSwaps = swapsData.maker.map((swap) => ({
      ...swap,
      type: 'maker' as const,
    }))

    const takerSwaps = swapsData.taker.map((swap) => ({
      ...swap,
      type: 'taker' as const,
    }))

    return [...makerSwaps, ...takerSwaps].sort((a, b) => {
      const aTime = a.completed_at || a.initiated_at || a.requested_at || 0
      const bTime = b.completed_at || b.initiated_at || b.requested_at || 0
      return bTime - aTime
    })
  }, [swapsData])

  // Get unique assets from swaps
  const uniqueAssets = useMemo(() => {
    const assets = new Set<string>(['BTC'])

    allSwaps.forEach((swap) => {
      if (swap.from_asset) {
        const ticker = assetInfo[swap.from_asset]?.ticker
        if (ticker) assets.add(ticker)
      }
      if (swap.to_asset) {
        const ticker = assetInfo[swap.to_asset]?.ticker
        if (ticker) assets.add(ticker)
      }
    })

    return Array.from(assets).sort()
  }, [allSwaps, assetInfo])

  // Apply filters
  const filteredSwaps = useMemo(() => {
    return allSwaps.filter((swap) => {
      // Status filter
      if (statusFilter !== 'all' && swap.status !== statusFilter) {
        return false
      }

      // Type filter
      if (typeFilter !== 'all' && swap.type !== typeFilter) {
        return false
      }

      // Asset filter
      if (assetFilter !== 'all') {
        const fromAssetTicker = !swap.from_asset
          ? 'BTC'
          : assetInfo[swap.from_asset]?.ticker

        const toAssetTicker = !swap.to_asset
          ? 'BTC'
          : assetInfo[swap.to_asset]?.ticker

        if (fromAssetTicker !== assetFilter && toAssetTicker !== assetFilter) {
          return false
        }
      }

      // Search term
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        return (
          swap.payment_hash.toLowerCase().includes(searchLower) ||
          swap.status.toLowerCase().includes(searchLower) ||
          swap.type.toLowerCase().includes(searchLower)
        )
      }

      return true
    })
  }, [allSwaps, statusFilter, typeFilter, assetFilter, searchTerm, assetInfo])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader className="w-12 h-12 animate-spin text-blue-500" />
        <p className="text-slate-400">Loading swap history...</p>
      </div>
    )
  }

  if (isError) {
    return (
      <Alert title="Error Loading Data" variant="error">
        <p>There was an error loading your swap history. Please try again.</p>
        <div className="mt-4">
          <Button
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={handleRefresh}
            variant="outline"
          >
            Try Again
          </Button>
        </div>
      </Alert>
    )
  }

  return (
    <Card className="bg-gray-800/50 border border-gray-700/50">
      <div className="flex justify-between items-center flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-500/10">
            <ArrowDownUp className="h-6 w-6 text-blue-500" />
          </div>
          <h2 className="text-xl font-bold text-white">Swap History</h2>
        </div>

        <IconButton
          aria-label="Refresh"
          disabled={isRefreshing}
          icon={
            isRefreshing ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              <RefreshCw className="w-5 h-5" />
            )
          }
          onClick={handleRefresh}
          variant="outline"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            className="block w-full pl-9 pr-3 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search swaps..."
            type="text"
            value={searchTerm}
          />
        </div>

        <div className="relative">
          <select
            className="appearance-none w-full pl-9 pr-8 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => setTypeFilter(e.target.value)}
            value={typeFilter}
          >
            <option value="all">All Types</option>
            <option value="maker">Maker</option>
            <option value="taker">Taker</option>
          </select>
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <ArrowDownUp className="h-4 w-4 text-gray-400" />
          </div>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <svg
              className="h-4 w-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M19 9l-7 7-7-7"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>

        <div className="relative">
          <select
            className="appearance-none w-full pl-9 pr-8 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => setStatusFilter(e.target.value)}
            value={statusFilter}
          >
            <option value="all">All Statuses</option>
            {Object.values(SwapStatus).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Calendar className="h-4 w-4 text-gray-400" />
          </div>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <svg
              className="h-4 w-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M19 9l-7 7-7-7"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>

        <div className="relative">
          <select
            className="appearance-none w-full pl-9 pr-8 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => setAssetFilter(e.target.value)}
            value={assetFilter}
          >
            <option value="all">All Assets</option>
            {uniqueAssets.map((asset) => (
              <option key={asset} value={asset}>
                {asset}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <ArrowDownUp className="h-4 w-4 rotate-90 text-gray-400" />
          </div>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <svg
              className="h-4 w-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M19 9l-7 7-7-7"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>
      </div>

      {filteredSwaps.length === 0 ? (
        <div className="text-center py-8 text-slate-400 bg-slate-800/30 rounded-lg border border-slate-700">
          {searchTerm ||
          statusFilter !== 'all' ||
          typeFilter !== 'all' ||
          assetFilter !== 'all' ? (
            <>
              <p>No swaps found matching your filters.</p>
              <Button
                className="mt-4"
                onClick={() => {
                  setSearchTerm('')
                  setStatusFilter('all')
                  setTypeFilter('all')
                  setAssetFilter('all')
                }}
                size="sm"
                variant="outline"
              >
                Clear Filters
              </Button>
            </>
          ) : (
            <p>No swaps found.</p>
          )}
        </div>
      ) : (
        <Table
          columns={[
            {
              accessor: (swap: SwapDetails & { type: 'maker' | 'taker' }) => (
                <Badge
                  size="sm"
                  variant={swap.type === 'maker' ? 'info' : 'primary'}
                >
                  {swap.type === 'maker' ? 'Maker' : 'Taker'}
                </Badge>
              ),
              className: 'col-span-1',
              header: 'Type',
            },
            {
              accessor: (swap: SwapDetails & { type: 'maker' | 'taker' }) => {
                const fromAssetIsBtc = !swap.from_asset
                const toAssetIsBtc = !swap.to_asset

                const fromAssetTicker = fromAssetIsBtc
                  ? bitcoinUnit
                  : assetInfo[swap.from_asset || '']?.ticker || 'Unknown'

                const toAssetTicker = toAssetIsBtc
                  ? bitcoinUnit
                  : assetInfo[swap.to_asset || '']?.ticker || 'Unknown'

                const fromPrecision = fromAssetIsBtc
                  ? 8
                  : assetInfo[swap.from_asset || '']?.precision || 8

                const toPrecision = toAssetIsBtc
                  ? 8
                  : assetInfo[swap.to_asset || '']?.precision || 8

                const fromAmount = formatAmount(
                  swap.qty_from,
                  fromPrecision,
                  fromAssetIsBtc,
                  bitcoinUnit
                )

                const toAmount = formatAmount(
                  swap.qty_to,
                  toPrecision,
                  toAssetIsBtc,
                  bitcoinUnit
                )

                return (
                  <div className="flex items-center flex-wrap gap-1">
                    <span className="text-red-500 font-semibold text-sm">
                      {fromAmount}
                    </span>
                    <span className="text-gray-400 text-xs">
                      {fromAssetTicker}
                    </span>
                    <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <span className="text-green-500 font-semibold text-sm">
                      {toAmount}
                    </span>
                    <span className="text-gray-400 text-xs">
                      {toAssetTicker}
                    </span>
                  </div>
                )
              },
              className: 'col-span-1',
              header: 'Swap',
            },
            {
              accessor: (swap: SwapDetails & { type: 'maker' | 'taker' }) => {
                // Convert Unix timestamp from seconds to milliseconds
                const timestamp =
                  swap.completed_at || swap.initiated_at || swap.requested_at
                return renderDateField(timestamp ? timestamp * 1000 : null)
              },
              className: 'col-span-1',
              header: 'Date',
            },
            {
              accessor: (swap: SwapDetails & { type: 'maker' | 'taker' }) =>
                renderCopyableField(swap.payment_hash, true, 4, 'Payment hash'),
              className: 'col-span-1',
              header: 'Payment Hash',
            },
            {
              accessor: (swap: SwapDetails & { type: 'maker' | 'taker' }) =>
                renderStatusBadge(
                  swap.status,
                  getStatusBadgeVariant(swap.status)
                ),
              className: 'col-span-1',
              header: 'Status',
            },
          ]}
          data={filteredSwaps}
          emptyState={
            <div className="text-center py-8 text-slate-400 bg-slate-800/30 rounded-lg border border-slate-700">
              {searchTerm ||
              statusFilter !== 'all' ||
              typeFilter !== 'all' ||
              assetFilter !== 'all' ? (
                <>
                  <p>No swaps found matching your filters.</p>
                  <Button
                    className="mt-4"
                    onClick={() => {
                      setSearchTerm('')
                      setStatusFilter('all')
                      setTypeFilter('all')
                      setAssetFilter('all')
                    }}
                    size="sm"
                    variant="outline"
                  >
                    Clear Filters
                  </Button>
                </>
              ) : (
                <p>No swaps found.</p>
              )}
            </div>
          }
          gridClassName="grid-cols-5"
          onRowClick={(swap: SwapDetails & { type: 'maker' | 'taker' }) =>
            setExpandedSwap(
              expandedSwap === swap.payment_hash ? null : swap.payment_hash
            )
          }
          rowClassName={(swap: SwapDetails & { type: 'maker' | 'taker' }) =>
            `cursor-pointer ${expandedSwap === swap.payment_hash ? 'bg-gray-700/30' : ''}`
          }
        />
      )}
    </Card>
  )
}
