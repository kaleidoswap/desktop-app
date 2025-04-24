import {
  Coins,
  Search,
  RefreshCw,
  ArrowLeft,
  Copy,
  ExternalLink,
  ArrowDownRight,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'

import { Button, Card, LoadingPlaceholder, Badge } from '../../../components/ui'
import { formatDate } from '../../../helpers/date'
import { nodeApi, Transfer } from '../../../slices/nodeApi/nodeApi.slice'

export const Component = () => {
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
    if (assetsResponse.data?.nia.length) {
      if (urlAssetId) {
        // Check if the URL asset ID exists in the assets list
        const assetExists = assetsResponse.data.nia.some(
          (asset) => asset.asset_id === urlAssetId
        )
        if (assetExists) {
          setSelectedAssetId(urlAssetId)
        } else if (!selectedAssetId) {
          setSelectedAssetId(assetsResponse.data.nia[0].asset_id)
        }
      } else if (!selectedAssetId) {
        setSelectedAssetId(assetsResponse.data.nia[0].asset_id)
      }
    }
  }, [assetsResponse.data, selectedAssetId, urlAssetId])

  useEffect(() => {
    const fetchTransfers = async () => {
      if (selectedAssetId) {
        setIsLoading(true)
        try {
          await getTransfers({ asset_id: selectedAssetId })
        } finally {
          setIsLoading(false)
        }
      }
    }

    fetchTransfers()
  }, [selectedAssetId, getTransfers])

  const refreshData = async () => {
    setIsRefreshing(true)
    try {
      await assets()
      if (selectedAssetId) {
        await getTransfers({ asset_id: selectedAssetId })
      }
    } finally {
      setIsRefreshing(false)
    }
  }

  const getStatusBadgeVariant = (status: Transfer['status']) => {
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

  const getKindLabel = (kind: Transfer['kind']) => {
    switch (kind) {
      case 'Send':
        return 'Sent'
      case 'ReceiveBlind':
      case 'ReceiveWitness':
        return 'Received'
      case 'Issuance':
        return 'Issuance'
      default:
        return kind
    }
  }

  const getKindColor = (kind: Transfer['kind']) => {
    switch (kind) {
      case 'Send':
        return 'text-red-500'
      case 'ReceiveBlind':
      case 'ReceiveWitness':
        return 'text-green-500'
      case 'Issuance':
        return 'text-blue-500'
      default:
        return 'text-slate-400'
    }
  }

  const getKindBadgeVariant = (kind: Transfer['kind']) => {
    switch (kind) {
      case 'Send':
        return 'danger'
      case 'ReceiveBlind':
      case 'ReceiveWitness':
        return 'success'
      case 'Issuance':
        return 'info'
      default:
        return 'default'
    }
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

  const filteredTransfers =
    transfersResponse.data?.transfers.filter((transfer) => {
      // Apply search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const matchesTxid = transfer.txid.toLowerCase().includes(searchLower)
        const matchesType = getKindLabel(transfer.kind)
          .toLowerCase()
          .includes(searchLower)
        const matchesStatus = transfer.status
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
    return assetsResponse.data?.nia.find(
      (asset) => asset.asset_id === selectedAssetId
    )
  }

  const formatAmount = (amount: number) => {
    const selectedAsset = getSelectedAsset()
    if (!selectedAsset) return amount.toString()

    const formattedAmount = amount / Math.pow(10, selectedAsset.precision)
    return formattedAmount.toLocaleString(undefined, {
      maximumFractionDigits: selectedAsset.precision,
    })
  }

  // Get unique statuses for filter dropdown
  const uniqueStatuses = Array.from(
    new Set(transfersResponse.data?.transfers.map((t) => t.status) || [])
  )

  return (
    <div className="space-y-6">
      {selectedAssetId && (
        <Card className="bg-gray-800/50 border border-gray-700/50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-purple-500/10">
                <Coins className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">
                  {getSelectedAsset()?.name} ({getSelectedAsset()?.ticker})
                </h3>
                <div className="flex items-center mt-1">
                  <p className="text-xs text-gray-400 truncate max-w-[200px] md:max-w-[300px]">
                    {selectedAssetId}
                  </p>
                  <button
                    className="ml-2 text-gray-400 hover:text-gray-200 transition-colors"
                    onClick={() =>
                      copyToClipboard(
                        selectedAssetId,
                        'Asset ID copied to clipboard'
                      )
                    }
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                disabled={isRefreshing}
                icon={
                  <RefreshCw
                    className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
                  />
                }
                onClick={refreshData}
                size="sm"
                variant="outline"
              >
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                className="block w-full pl-9 pr-3 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search transactions..."
                type="text"
                value={searchTerm}
              />
            </div>

            <div className="relative">
              <select
                className="appearance-none w-full pl-9 pr-8 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                onChange={(e) => setTypeFilter(e.target.value)}
                value={typeFilter}
              >
                <option value="all">All Types</option>
                <option value="sent">Sent</option>
                <option value="received">Received</option>
                <option value="issuance">Issuance</option>
              </select>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <ArrowDownRight className="h-4 w-4 text-gray-400" />
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
                className="appearance-none w-full pl-9 pr-8 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                onChange={(e) => setStatusFilter(e.target.value)}
                value={statusFilter}
              >
                <option value="all">All Statuses</option>
                {uniqueStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Coins className="h-4 w-4 text-gray-400" />
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

          <div className="mb-4 relative">
            <select
              className="appearance-none w-full pl-9 pr-8 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={isLoading || !assetsResponse.data?.nia.length}
              onChange={(e) => setSelectedAssetId(e.target.value)}
              value={selectedAssetId || ''}
            >
              {assetsResponse.data?.nia.map((asset) => (
                <option key={asset.asset_id} value={asset.asset_id}>
                  {asset.name} ({asset.ticker})
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Coins className="h-4 w-4 text-purple-500" />
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

          {isLoading ? (
            <div className="flex justify-center py-12">
              <LoadingPlaceholder />
            </div>
          ) : filteredTransfers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-700">
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Transaction ID</th>
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransfers.map((transfer) => (
                    <>
                      <tr
                        className={`border-b border-gray-700/50 hover:bg-gray-700/20 cursor-pointer ${showTxDetails === `${transfer.txid}-${transfer.idx}` ? 'bg-gray-700/30' : ''}`}
                        key={`${transfer.txid}-${transfer.idx}`}
                        onClick={() =>
                          setShowTxDetails(
                            showTxDetails === `${transfer.txid}-${transfer.idx}`
                              ? null
                              : `${transfer.txid}-${transfer.idx}`
                          )
                        }
                      >
                        <td className="py-3 px-4">
                          <Badge variant={getKindBadgeVariant(transfer.kind)}>
                            {getKindLabel(transfer.kind)}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <span className={getKindColor(transfer.kind)}>
                            {transfer.kind === 'Send' ? '-' : '+'}
                            {formatAmount(transfer.amount)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={getStatusBadgeVariant(transfer.status)}
                          >
                            {transfer.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-300">
                          {formatDate(transfer.created_at * 1000)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            <span className="text-xs text-gray-400 truncate max-w-[120px]">
                              {transfer.txid}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button className="text-gray-400 hover:text-gray-200">
                            {showTxDetails ===
                            `${transfer.txid}-${transfer.idx}` ? (
                              <ArrowLeft className="h-4 w-4" />
                            ) : (
                              <ExternalLink className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                      {showTxDetails === `${transfer.txid}-${transfer.idx}` && (
                        <tr className="bg-gray-800/50">
                          <td className="p-4" colSpan={6}>
                            <div className="bg-gray-900/50 rounded-lg p-4 space-y-3">
                              <div>
                                <h4 className="text-sm font-medium text-gray-300 mb-1">
                                  Transaction Details
                                </h4>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-400">
                                    Transaction ID:
                                  </span>
                                  <div className="flex items-center">
                                    <span className="text-xs text-gray-300">
                                      {transfer.txid}
                                    </span>
                                    <button
                                      className="ml-2 text-gray-400 hover:text-gray-200 transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        copyToClipboard(
                                          transfer.txid,
                                          'Transaction ID copied to clipboard'
                                        )
                                      }}
                                    >
                                      <Copy className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">
                                  Amount:
                                </span>
                                <span
                                  className={`text-xs ${getKindColor(transfer.kind)}`}
                                >
                                  {transfer.kind === 'Send' ? '-' : '+'}
                                  {formatAmount(transfer.amount)}{' '}
                                  {getSelectedAsset()?.ticker}
                                </span>
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">
                                  Type:
                                </span>
                                <Badge
                                  variant={getKindBadgeVariant(transfer.kind)}
                                >
                                  {getKindLabel(transfer.kind)}
                                </Badge>
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">
                                  Status:
                                </span>
                                <Badge
                                  variant={getStatusBadgeVariant(
                                    transfer.status
                                  )}
                                >
                                  {transfer.status}
                                </Badge>
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">
                                  Date:
                                </span>
                                <span className="text-xs text-gray-300">
                                  {formatDate(transfer.created_at * 1000)}
                                </span>
                              </div>

                              {transfer.recipient_id && (
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-400">
                                    Recipient ID:
                                  </span>
                                  <div className="flex items-center">
                                    <span className="text-xs text-gray-300 truncate max-w-[200px]">
                                      {transfer.recipient_id}
                                    </span>
                                    <button
                                      className="ml-2 text-gray-400 hover:text-gray-200 transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        copyToClipboard(
                                          transfer.recipient_id || '',
                                          'Recipient ID copied to clipboard'
                                        )
                                      }}
                                    >
                                      <Copy className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-gray-400">
                {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
                  ? 'No transfers found matching your search criteria'
                  : 'No transfers found for this asset'}
              </p>
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
                  Clear Filters
                </Button>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
