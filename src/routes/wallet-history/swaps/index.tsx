import {
  ArrowDownUp,
  ArrowRight,
  RefreshCw,
  Loader,
  Search,
  Copy,
  Calendar,
} from 'lucide-react'
import React, { useState, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { toast } from 'react-toastify'

import { RootState } from '../../../app/store'
import { Button, IconButton, Badge, Card, Alert } from '../../../components/ui'
import { formatDate } from '../../../helpers/date'
import {
  nodeApi,
  SwapDetails,
  SwapStatus,
} from '../../../slices/nodeApi/nodeApi.slice'

const COL_CLASS_NAME = 'py-3 px-4'

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
      return sats.toLocaleString('en-US', { maximumFractionDigits: 0 })
    } else {
      const btc = sats / 100000000
      return btc.toLocaleString('en-US', {
        maximumFractionDigits: 8,
        minimumFractionDigits: 8,
      })
    }
  } else {
    // Format RGB asset amount
    const formattedAmount = amount / Math.pow(10, precision)
    return formattedAmount.toLocaleString('en-US', {
      maximumFractionDigits: precision,
    })
  }
}

const formatSwapDate = (timestamp: number | null): string => {
  if (!timestamp) return 'N/A'
  return formatDate(timestamp)
}

const truncateHash = (hash: string) => {
  return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`
}

const copyToClipboard = (text: string, message: string) => {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      toast.success(message)
    })
    .catch((err) => {
      console.error('Failed to copy:', err)
    })
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

const SwapRow: React.FC<{
  swap: SwapDetails
  assetInfo: Record<string, AssetInfo>
  bitcoinUnit: string
  onClick: () => void
  isExpanded: boolean
}> = ({ swap, assetInfo, bitcoinUnit, onClick, isExpanded }) => {
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
    <>
      <tr
        className={`border-b border-gray-700/50 hover:bg-gray-700/20 cursor-pointer ${isExpanded ? 'bg-gray-700/30' : ''}`}
        onClick={onClick}
      >
        <td className={COL_CLASS_NAME}>
          <Badge variant={swap.type === 'maker' ? 'info' : 'primary'}>
            {swap.type === 'maker' ? 'Maker' : 'Taker'}
          </Badge>
        </td>
        <td className={COL_CLASS_NAME}>
          <div className="flex items-center">
            <span className="text-red-500">{fromAmount}</span>
            <span className="mx-1 text-gray-400">{fromAssetTicker}</span>
            <ArrowRight className="w-3 h-3 mx-1 text-gray-400" />
            <span className="text-green-500">{toAmount}</span>
            <span className="ml-1 text-gray-400">{toAssetTicker}</span>
          </div>
        </td>
        <td className={COL_CLASS_NAME}>
          <Badge variant={getStatusBadgeVariant(swap.status)}>
            {swap.status}
          </Badge>
        </td>
        <td className={COL_CLASS_NAME}>
          {formatSwapDate(
            swap.completed_at || swap.initiated_at || swap.requested_at
          )}
        </td>
        <td className={COL_CLASS_NAME}>
          <div className="flex items-center">
            <span className="text-xs text-gray-400 truncate max-w-[120px]">
              {truncateHash(swap.payment_hash)}
            </span>
            <button
              className="ml-2 text-gray-400 hover:text-gray-200 transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                copyToClipboard(
                  swap.payment_hash,
                  'Payment hash copied to clipboard'
                )
              }}
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-gray-800/50">
          <td className="p-4" colSpan={5}>
            <div className="bg-gray-900/50 rounded-lg p-4 space-y-3">
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-1">
                  Swap Details
                </h4>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Payment Hash:</span>
                  <div className="flex items-center">
                    <span className="text-xs text-gray-300">
                      {swap.payment_hash}
                    </span>
                    <button
                      className="ml-2 text-gray-400 hover:text-gray-200 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        copyToClipboard(
                          swap.payment_hash,
                          'Payment hash copied to clipboard'
                        )
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">From:</span>
                <span className="text-xs text-red-500">
                  {fromAmount} {fromAssetTicker}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">To:</span>
                <span className="text-xs text-green-500">
                  {toAmount} {toAssetTicker}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Type:</span>
                <Badge
                  size="sm"
                  variant={swap.type === 'maker' ? 'info' : 'primary'}
                >
                  {swap.type === 'maker' ? 'Maker' : 'Taker'}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Status:</span>
                <Badge size="sm" variant={getStatusBadgeVariant(swap.status)}>
                  {swap.status}
                </Badge>
              </div>

              {swap.requested_at && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Requested:</span>
                  <span className="text-xs text-gray-300">
                    {formatSwapDate(swap.requested_at)}
                  </span>
                </div>
              )}

              {swap.initiated_at && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Initiated:</span>
                  <span className="text-xs text-gray-300">
                    {formatSwapDate(swap.initiated_at)}
                  </span>
                </div>
              )}

              {swap.completed_at && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Completed:</span>
                  <span className="text-xs text-gray-300">
                    {formatSwapDate(swap.completed_at)}
                  </span>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
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
        <div className="overflow-x-auto bg-slate-800/30 rounded-lg border border-slate-700">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-700">
                <th className={COL_CLASS_NAME}>Type</th>
                <th className={COL_CLASS_NAME}>Swap</th>
                <th className={COL_CLASS_NAME}>Status</th>
                <th className={COL_CLASS_NAME}>Date</th>
                <th className={COL_CLASS_NAME}>Payment Hash</th>
              </tr>
            </thead>
            <tbody>
              {filteredSwaps.map((swap) => (
                <SwapRow
                  assetInfo={assetInfo}
                  bitcoinUnit={bitcoinUnit}
                  isExpanded={expandedSwap === swap.payment_hash}
                  key={swap.payment_hash}
                  onClick={() =>
                    setExpandedSwap(
                      expandedSwap === swap.payment_hash
                        ? null
                        : swap.payment_hash
                    )
                  }
                  swap={swap}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
