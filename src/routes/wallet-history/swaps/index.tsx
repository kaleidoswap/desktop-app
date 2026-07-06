import {
  Coins,
  LayoutGrid,
  ArrowLeftRight,
  ArrowRight,
  RefreshCw,
  Loader,
  Search,
  Calendar,
} from 'lucide-react'
import React, { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'

import { RootState } from '../../../app/store'
import {
  Button,
  IconButton,
  Badge,
  Card,
  Alert,
  Select,
} from '../../../components/ui'
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
  const { t } = useTranslation()
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
      assetsData.nia.forEach((asset: any) => {
        if ((asset as any).asset_id) {
          info[(asset as any).asset_id] = {
            precision: asset.precision ?? 8,
            ticker: asset.ticker || 'UNKNOWN',
          }
        }
      })
    }
    return info
  }, [assetsData])

  // Get all swaps
  const allSwaps = useMemo(() => {
    if (!swapsData) return []

    const makerSwaps = (swapsData?.maker || []).map((swap: any) => ({
      ...swap,
      type: 'maker' as const,
    }))

    const takerSwaps = (swapsData?.taker || []).map((swap: any) => ({
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
          (swap.payment_hash || '').toLowerCase().includes(searchLower) ||
          (swap.status || '').toLowerCase().includes(searchLower) ||
          (swap.type || '').toLowerCase().includes(searchLower)
        )
      }

      return true
    })
  }, [allSwaps, statusFilter, typeFilter, assetFilter, searchTerm, assetInfo])

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[60vh] gap-6">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/30 via-green-500/25 to-teal-600/30 rounded-full blur-2xl"></div>
          <div className="relative bg-gradient-to-br from-primary/20 to-primary/5 backdrop-blur-2xl rounded-2xl p-6 ring-1 ring-primary/20 shadow-lg shadow-primary/10">
            <ArrowLeftRight className="relative z-10 w-10 h-10 text-[#15E99A]" />
          </div>
        </div>
        <div className="text-center space-y-4 max-w-lg">
          <p className="text-white font-bold text-xl bg-gradient-to-r from-white via-emerald-100 to-green-100 bg-clip-text text-transparent">
            {t('swaps.loading')}
          </p>
          <div className="w-80 h-2 bg-slate-800/60 rounded-full overflow-hidden backdrop-blur-sm border border-slate-600/40 shadow-inner">
            <div className="splash-progress-fill h-full rounded-full shadow-lg"></div>
          </div>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <Alert title={t('swaps.errorLoading')} variant="error">
        <p>{t('swaps.errorMessage')}</p>
        <div className="mt-4">
          <Button
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={handleRefresh}
            variant="outline"
          >
            {t('swaps.tryAgain')}
          </Button>
        </div>
      </Alert>
    )
  }

  return (
    <Card className="bg-surface-overlay/50 border border-border-default/50">
      <div className="flex items-center gap-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-content-secondary" />
            </div>
            <input
              className="block w-full pl-9 pr-3 py-2 text-sm border border-border-default/50 rounded-lg bg-surface-overlay/30 text-white transition-all duration-200 placeholder-content-secondary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('swaps.searchPlaceholder')}
              type="text"
              value={searchTerm}
            />
          </div>

          <Select
            icon={<Coins className="h-4 w-4" />}
            onChange={(val) => setAssetFilter(val as any)}
            options={[
              { label: t('swaps.allAssets'), value: 'all' },
              ...uniqueAssets.map((asset) => ({ label: asset, value: asset })),
            ]}
            value={assetFilter}
          />

          <Select
            icon={<LayoutGrid className="h-4 w-4" />}
            onChange={(val) => setTypeFilter(val as any)}
            options={[
              { label: t('swaps.allTypes'), value: 'all' },
              { label: t('swaps.maker'), value: 'maker' },
              { label: t('swaps.taker'), value: 'taker' },
            ]}
            value={typeFilter}
          />

          <Select
            icon={<Calendar className="h-4 w-4" />}
            onChange={(val) => setStatusFilter(val as any)}
            options={[
              { label: t('swaps.allStatuses'), value: 'all' },
              ...Object.values(SwapStatus).map((s) => ({ label: s, value: s })),
            ]}
            value={statusFilter}
          />
        </div>

        <div className="relative group/ref shrink-0">
          <IconButton
            aria-label={t('swaps.refresh')}
            className="border-white/30 hover:border-white/50"
            disabled={isRefreshing}
            icon={
              isRefreshing ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )
            }
            onClick={handleRefresh}
            variant="outline"
          />
          <div className="absolute bottom-full mb-1.5 right-0 bg-surface-high text-content-primary text-[10px] rounded-md py-0.5 px-1.5 opacity-0 group-hover/ref:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-border-default/40 shadow-lg z-20">
            Refresh data
          </div>
        </div>
      </div>

      {filteredSwaps.length === 0 ? (
        <div className="text-center py-8 text-content-secondary bg-surface-overlay/30 rounded-lg border border-border-default">
          {searchTerm ||
          statusFilter !== 'all' ||
          typeFilter !== 'all' ||
          assetFilter !== 'all' ? (
            <>
              <p>{t('swaps.noSwapsFiltered')}</p>
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
                {t('swaps.clearFilters')}
              </Button>
            </>
          ) : (
            <p>{t('swaps.noSwaps')}</p>
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
                  : (assetInfo[swap.from_asset || '']?.precision ?? 8)

                const toPrecision = toAssetIsBtc
                  ? 8
                  : (assetInfo[swap.to_asset || '']?.precision ?? 8)

                const fromAmount = formatAmount(
                  swap.qty_from ?? 0,
                  fromPrecision,
                  fromAssetIsBtc,
                  bitcoinUnit
                )

                const toAmount = formatAmount(
                  swap.qty_to ?? 0,
                  toPrecision,
                  toAssetIsBtc,
                  bitcoinUnit
                )

                return (
                  <div className="flex items-center flex-wrap gap-1">
                    <span className="text-red-500 font-semibold text-sm">
                      {fromAmount}
                    </span>
                    <span className="text-content-secondary text-xs">
                      {fromAssetTicker}
                    </span>
                    <ArrowRight className="w-3 h-3 text-content-secondary flex-shrink-0" />
                    <span className="text-green-500 font-semibold text-sm">
                      {toAmount}
                    </span>
                    <span className="text-content-secondary text-xs">
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
                renderCopyableField(
                  swap.payment_hash || '',
                  true,
                  4,
                  'Payment hash'
                ),
              className: 'col-span-1',
              header: 'Payment Hash',
            },
            {
              accessor: (swap: SwapDetails & { type: 'maker' | 'taker' }) =>
                renderStatusBadge(
                  swap.status || '',
                  getStatusBadgeVariant(
                    (swap.status || 'Pending') as SwapStatus
                  )
                ),
              className: 'col-span-1',
              header: 'Status',
            },
          ]}
          data={filteredSwaps}
          emptyState={
            <div className="text-center py-8 text-content-secondary bg-surface-overlay/30 rounded-lg border border-border-default">
              {searchTerm ||
              statusFilter !== 'all' ||
              typeFilter !== 'all' ||
              assetFilter !== 'all' ? (
                <>
                  <p>{t('components.walletHistory.swaps.noSwapsFiltered')}</p>
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
                <p>{t('components.walletHistory.swaps.noSwaps')}</p>
              )}
            </div>
          }
          gridClassName="grid-cols-5"
          onRowClick={(swap: SwapDetails & { type: 'maker' | 'taker' }) =>
            setExpandedSwap(
              expandedSwap === swap.payment_hash
                ? null
                : swap.payment_hash || null
            )
          }
          rowClassName={(swap: SwapDetails & { type: 'maker' | 'taker' }) =>
            `cursor-pointer ${expandedSwap === swap.payment_hash ? 'bg-surface-high/30' : ''}`
          }
        />
      )}
    </Card>
  )
}
