import {
  Coins,
  Search,
  RefreshCw,
  Copy,
  LayoutGrid,
  Calendar,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'

import { IconButton, Card, Badge, Select, Button } from '../../../components/ui'
import {
  Table,
  renderCopyableField,
  renderDateField,
  renderStatusBadge,
} from '../../../components/ui/Table'
import { formatDate } from '../../../helpers/date'
import {
  nodeApi,
  Transfer,
  TransferKind,
} from '../../../slices/nodeApi/nodeApi.slice'
import { getAssignmentAmount } from '../../../utils/rgbUtils'

// Cap simultaneous listTransfers calls: the RGB node serializes these, so an
// unbounded Promise.all over every asset causes a thundering-herd on wallets
// with many assets (this runs on every "All Assets" page load / refresh).
const TRANSFER_FETCH_CONCURRENCY = 5

// Run an async task over items with bounded concurrency, preserving order.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      for (let i = next++; i < items.length; i = next++) {
        results[i] = await task(items[i])
      }
    }
  )
  await Promise.all(workers)
  return results
}

export const Component = () => {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const urlAssetId = searchParams.get('assetId')

  const [assets, assetsResponse] = nodeApi.endpoints.listAssets.useLazyQuery()
  const [getTransfers, transfersResponse] =
    nodeApi.endpoints.listTransfers.useLazyQuery()
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(
    urlAssetId
  )
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [showTxDetails, setShowTxDetails] = useState<string | null>(null)
  const [allTransfers, setAllTransfers] = useState<Transfer[]>([])

  useEffect(() => {
    const fetchAssets = async () => {
      setIsLoading(true)
      try {
        await assets()
      } finally {
        setIsLoading(false)
      }
    }

    fetchAssets()
  }, [assets])

  useEffect(() => {
    if (urlAssetId && (assetsResponse?.data?.nia || []).length) {
      const assetExists = (assetsResponse?.data?.nia || []).some(
        (asset: any) => asset.asset_id === urlAssetId
      )
      if (assetExists) {
        setSelectedAssetId(urlAssetId)
      }
    }
  }, [assetsResponse.data, urlAssetId])

  useEffect(() => {
    const fetchTransfers = async () => {
      setIsLoading(true)
      try {
        if (selectedAssetId) {
          setAllTransfers([])
          await getTransfers(selectedAssetId)
        } else {
          const rgbAssets = assetsResponse.data?.nia || []
          if (rgbAssets.length > 0) {
            const results = await mapWithConcurrency(
              rgbAssets,
              TRANSFER_FETCH_CONCURRENCY,
              (asset: any) => getTransfers(asset.asset_id)
            )
            const failed = results.filter((r: any) => r.error).length
            if (failed > 0) {
              toast.warn(
                t('history.someTransfersFailed', {
                  count: failed,
                  defaultValue:
                    'Could not load transfers for {{count}} of {{total}} assets',
                  total: rgbAssets.length,
                })
              )
            }
            setAllTransfers(
              results.flatMap((r: any) => r.data?.transfers || [])
            )
          } else {
            setAllTransfers([])
          }
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchTransfers()
  }, [selectedAssetId, getTransfers, assetsResponse.data])

  const refreshData = async () => {
    setIsRefreshing(true)
    try {
      const refreshedAssets = await assets()
      if (selectedAssetId) {
        await getTransfers(selectedAssetId)
      } else {
        const nia =
          (refreshedAssets as any)?.data?.nia || assetsResponse.data?.nia || []
        const results = await mapWithConcurrency(
          nia,
          TRANSFER_FETCH_CONCURRENCY,
          (asset: any) => getTransfers(asset.asset_id)
        )
        const failed = results.filter((r: any) => r.error).length
        if (failed > 0) {
          toast.warn(
            t('history.someTransfersFailed', {
              count: failed,
              defaultValue:
                'Could not load transfers for {{count}} of {{total}} assets',
              total: nia.length,
            })
          )
        }
        setAllTransfers(results.flatMap((r: any) => r.data?.transfers || []))
      }
    } finally {
      setIsRefreshing(false)
    }
  }

  const getStatusBadgeVariant = (status: Transfer['status'] | undefined) => {
    switch (status) {
      case 'Settled':
        return 'success'
      case 'Failed':
        return 'danger'
      case 'WaitingConfirmations':
      case 'WaitingCounterparty':
        return 'warning'
      default:
        return 'default'
    }
  }

  const getKindLabel = (kind: Transfer['kind'] | undefined) => {
    switch (kind) {
      case TransferKind.Send:
        return 'Sent'
      case TransferKind.ReceiveBlind:
      case TransferKind.ReceiveWitness:
        return 'Received'
      case TransferKind.Issuance:
        return 'Issuance'
      case TransferKind.Inflation:
        return 'Inflation'
      default:
        return kind || 'Unknown'
    }
  }

  const getKindColor = (kind: Transfer['kind'] | undefined) => {
    switch (kind) {
      case TransferKind.Send:
        return 'text-red-500'
      case TransferKind.ReceiveBlind:
      case TransferKind.ReceiveWitness:
        return 'text-green-500'
      case TransferKind.Issuance:
        return 'text-blue-500'
      case TransferKind.Inflation:
        return 'text-purple-500'
      default:
        return 'text-content-secondary'
    }
  }

  const getKindBadgeVariant = (kind: Transfer['kind'] | undefined) => {
    switch (kind) {
      case TransferKind.Send:
        return 'danger'
      case TransferKind.ReceiveBlind:
      case TransferKind.ReceiveWitness:
        return 'success'
      case TransferKind.Issuance:
        return 'info'
      case TransferKind.Inflation:
        return 'warning'
      default:
        return 'default'
    }
  }

  const copyToClipboard = (text: string, translationKey: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success(t(translationKey))
      })
      .catch((err) => {
        console.error('Failed to copy:', err)
      })
  }

  const activeTransfers = selectedAssetId
    ? transfersResponse.data?.transfers || []
    : allTransfers

  const filteredTransfers =
    activeTransfers.filter((transfer: Transfer) => {
      // Apply search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const matchesTxid = (transfer.txid || '')
          .toLowerCase()
          .includes(searchLower)
        const matchesType = (getKindLabel(transfer.kind) || '')
          .toLowerCase()
          .includes(searchLower)
        const matchesStatus = (transfer.status || '')
          .toLowerCase()
          .includes(searchLower)

        if (!(matchesTxid || matchesType || matchesStatus)) {
          return false
        }
      }

      // Apply status filter
      if (statusFilter !== 'all' && transfer.status !== statusFilter) {
        return false
      }

      // Apply type filter
      if (typeFilter !== 'all') {
        const kindLabel = getKindLabel(transfer.kind).toLowerCase()
        if (typeFilter === 'sent' && kindLabel !== 'sent') {
          return false
        }
        if (typeFilter === 'received' && kindLabel !== 'received') {
          return false
        }
        if (typeFilter === 'issuance' && kindLabel !== 'issuance') {
          return false
        }
      }

      return true
    }) || []

  const getSelectedAsset = () => {
    return (assetsResponse.data?.nia || []).find(
      (asset: any) => asset.asset_id === selectedAssetId
    )
  }

  const formatAmount = (amount: number) => {
    const selectedAsset = getSelectedAsset()
    if (!selectedAsset) return amount.toString()

    const formattedAmount = amount / Math.pow(10, selectedAsset.precision ?? 8)
    return formattedAmount.toLocaleString('en-US', {
      maximumFractionDigits: selectedAsset.precision,
      minimumFractionDigits: 0,
      useGrouping: true,
    })
  }

  // Get unique statuses for filter dropdown
  const uniqueStatuses = Array.from(
    new Set<string>(activeTransfers.map((t: any) => t.status))
  )

  const rgbAssets = assetsResponse.data?.nia || []

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
              placeholder={t('assets.searchPlaceholder')}
              type="text"
              value={searchTerm}
            />
          </div>

          <Select
            disabled={isLoading || !rgbAssets.length}
            icon={<Coins className="h-4 w-4" />}
            onChange={(val) => setSelectedAssetId(val || null)}
            options={[
              { label: t('assets.allAssets'), value: '' },
              ...rgbAssets.map((asset: any) => ({
                label: `${asset.name} (${asset.ticker})`,
                value: asset.asset_id,
              })),
            ]}
            value={selectedAssetId || ''}
          />

          <Select
            icon={<LayoutGrid className="h-4 w-4" />}
            onChange={(val) => setTypeFilter(val as any)}
            options={[
              { label: t('assets.allTypes'), value: 'all' },
              { label: t('assets.sent'), value: 'sent' },
              { label: t('assets.received'), value: 'received' },
              { label: t('assets.issuance'), value: 'issuance' },
            ]}
            value={typeFilter}
          />

          <Select
            icon={<Calendar className="h-4 w-4" />}
            onChange={(val) => setStatusFilter(val as any)}
            options={[
              { label: t('assets.allStatuses'), value: 'all' },
              ...uniqueStatuses.map((status) => ({
                label: status,
                value: status,
              })),
            ]}
            value={statusFilter}
          />
        </div>

        <div className="relative group/ref shrink-0">
          <button
            aria-label={t('assets.refresh')}
            className="p-1.5 rounded-md bg-transparent hover:bg-white/5 border border-white/30 hover:border-white/50 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={isRefreshing}
            onClick={refreshData}
            type="button"
          >
            {isRefreshing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </button>
          <div className="absolute bottom-full mb-1.5 right-0 bg-surface-high text-content-primary text-[10px] rounded-md py-0.5 px-1.5 opacity-0 group-hover/ref:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-border-default/40 shadow-lg z-20">
            Refresh data
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col justify-center items-center py-16 gap-6">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/30 via-green-500/25 to-teal-600/30 rounded-full blur-2xl"></div>
            <div className="relative bg-gradient-to-br from-primary/20 to-primary/5 backdrop-blur-2xl rounded-2xl p-6 ring-1 ring-primary/20 shadow-lg shadow-primary/10">
              <Coins className="relative z-10 w-10 h-10 text-[#15E99A]" />
            </div>
          </div>
          <div className="text-center space-y-4 max-w-lg">
            <p className="text-white font-bold text-xl bg-gradient-to-r from-white via-emerald-100 to-green-100 bg-clip-text text-transparent">
              {t('assets.loading')}
            </p>
            <div className="w-80 h-2 bg-slate-800/60 rounded-full overflow-hidden backdrop-blur-sm border border-slate-600/40 shadow-inner">
              <div className="splash-progress-fill h-full rounded-full shadow-lg"></div>
            </div>
          </div>
        </div>
      ) : filteredTransfers.length > 0 ? (
        <Table
          columns={[
            {
              accessor: (transfer: Transfer) => (
                <Badge size="sm" variant={getKindBadgeVariant(transfer.kind)}>
                  {getKindLabel(transfer.kind)}
                </Badge>
              ),
              className: 'col-span-1',
              header: t('assets.type'),
            },
            {
              accessor: (transfer: Transfer) => (
                <span
                  className={`text-sm font-semibold ${getKindColor(transfer.kind)}`}
                >
                  {transfer.kind === TransferKind.Send ? '-' : '+'}
                  {formatAmount(
                    transfer.requested_assignment
                      ? getAssignmentAmount(transfer.requested_assignment)
                      : 0
                  )}
                </span>
              ),
              className: 'col-span-1',
              header: t('assets.amount'),
            },
            {
              accessor: (transfer: Transfer) =>
                renderDateField((transfer.created_at || 0) * 1000),
              className: 'col-span-1',
              header: t('assets.date'),
            },
            {
              accessor: (transfer: Transfer) =>
                renderCopyableField(
                  transfer.txid || '',
                  true,
                  4,
                  t('assets.transactionId')
                ),
              className: 'col-span-1',
              header: t('assets.transactionId'),
            },
            {
              accessor: (transfer: Transfer) =>
                renderStatusBadge(
                  transfer.status || 'Unknown',
                  getStatusBadgeVariant(transfer.status)
                ),
              className: 'col-span-1',
              header: t('assets.status'),
            },
          ]}
          data={filteredTransfers}
          emptyState={
            <div className="text-center py-8 text-content-secondary bg-surface-overlay/30 rounded-lg border border-border-default">
              {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
                ? t('assets.noTransfersFiltered')
                : t('assets.noTransfers')}
              {(searchTerm ||
                statusFilter !== 'all' ||
                typeFilter !== 'all') && (
                <Button
                  className="mt-4"
                  onClick={() => {
                    setSearchTerm('')
                    setStatusFilter('all')
                    setTypeFilter('all')
                  }}
                  size="sm"
                  variant="outline"
                >
                  {t('assets.clearFilters')}
                </Button>
              )}
            </div>
          }
          gridClassName="grid-cols-5"
          onRowClick={(transfer: Transfer) =>
            setShowTxDetails(
              showTxDetails === `${transfer.txid}-${transfer.idx}`
                ? null
                : `${transfer.txid}-${transfer.idx}`
            )
          }
          rowClassName={(transfer: Transfer) =>
            `cursor-pointer ${showTxDetails === `${transfer.txid}-${transfer.idx}` ? 'bg-surface-high/30' : ''}`
          }
        />
      ) : (
        <div className="py-12 text-center">
          <p className="text-content-secondary">
            {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
              ? t('assets.noTransfersFiltered')
              : t('assets.noTransfers')}
          </p>
          {(searchTerm || statusFilter !== 'all' || typeFilter !== 'all') && (
            <Button
              className="mt-4"
              onClick={() => {
                setSearchTerm('')
                setStatusFilter('all')
                setTypeFilter('all')
              }}
              size="sm"
              variant="outline"
            >
              {t('assets.clearFilters')}
            </Button>
          )}
        </div>
      )}

      {/* Expanded transaction details */}
      {filteredTransfers.map(
        (transfer: any) =>
          showTxDetails === `${transfer.txid}-${transfer.idx}` && (
            <div
              className="mt-4 bg-surface-overlay/50 rounded-lg p-4"
              key={`${transfer.txid}-${transfer.idx}`}
            >
              <div className="bg-surface-base/50 rounded-lg p-4 space-y-3">
                <div>
                  <h4 className="text-sm font-medium text-content-secondary mb-1">
                    {t('assets.transactionDetails')}
                  </h4>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-content-secondary">
                      {t('assets.transactionIdLabel')}
                    </span>
                    <div className="flex items-center">
                      <span className="text-xs text-content-secondary">
                        {transfer.txid}
                      </span>
                      <button
                        className="ml-2 text-content-secondary hover:text-content-primary transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          copyToClipboard(
                            transfer.txid || '',
                            'assets.transactionIdCopied'
                          )
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-content-secondary">
                    {t('assets.amountLabel')}
                  </span>
                  <span className={`text-xs ${getKindColor(transfer.kind)}`}>
                    {transfer.kind === TransferKind.Send ? '-' : '+'}
                    {formatAmount(
                      transfer.requested_assignment
                        ? getAssignmentAmount(transfer.requested_assignment)
                        : 0
                    )}{' '}
                    {getSelectedAsset()?.ticker}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-content-secondary">
                    {t('assets.typeLabel')}
                  </span>
                  <Badge variant={getKindBadgeVariant(transfer.kind)}>
                    {getKindLabel(transfer.kind)}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-content-secondary">
                    {t('assets.statusLabel')}
                  </span>
                  <Badge variant={getStatusBadgeVariant(transfer.status)}>
                    {transfer.status}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-content-secondary">
                    {t('assets.dateLabel')}
                  </span>
                  <span className="text-xs text-content-secondary">
                    {formatDate((transfer.created_at || 0) * 1000)}
                  </span>
                </div>

                {transfer.recipient_id && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-content-secondary">
                      {t('assets.recipientIdLabel')}
                    </span>
                    <div className="flex items-center">
                      <span className="text-xs text-content-secondary truncate max-w-[200px]">
                        {transfer.recipient_id}
                      </span>
                      <button
                        className="ml-2 text-content-secondary hover:text-content-primary transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          copyToClipboard(
                            transfer.recipient_id || '',
                            'assets.recipientIdCopied'
                          )
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
      )}
    </Card>
  )
}
