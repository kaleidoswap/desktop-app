import Decimal from 'decimal.js'
import {
  Link as Chain,
  Zap,
  RefreshCw,
  Loader,
  Search,
  Copy,
} from 'lucide-react'
import React, { useState, useMemo } from 'react'
import { useSelector } from 'react-redux'
import { toast } from 'react-toastify'
import { twJoin } from 'tailwind-merge'

import { RootState } from '../../../app/store'
import { Button, Badge, IconButton, Card, Alert } from '../../../components/ui'
import { formatDate } from '../../../helpers/date'
import { nodeApi } from '../../../slices/nodeApi/nodeApi.slice'

const COL_CLASS_NAME = 'py-3 px-4'

const formatBitcoinAmount = (
  amount: string | number,
  bitcoinUnit: string
): string => {
  const amountDecimal = new Decimal(amount)
  if (bitcoinUnit === 'SAT') {
    return amountDecimal.toFixed(0)
  } else {
    return amountDecimal.div(100000000).toFixed(8)
  }
}

interface WithdrawalProps {
  type: 'on-chain' | 'off-chain'
  asset: string
  amount: string | number
  txId: string
  bitcoinUnit: string
  assetsList?: any[]
  timestamp?: number
}

const formatAssetAmount = (
  amount: string | number,
  asset: string,
  bitcoinUnit: string,
  assetsList?: any[]
): string => {
  if (asset === 'BTC') {
    return formatBitcoinAmount(amount, bitcoinUnit)
  }

  // Find asset info to get precision
  const assetInfo = assetsList?.find((a) => a.ticker === asset)
  const precision = assetInfo?.precision ?? 8

  // Convert to decimal and format with proper precision
  const amountDecimal = new Decimal(amount)
  return amountDecimal.div(Math.pow(10, precision)).toFixed(precision)
}

const Withdrawal: React.FC<WithdrawalProps> = ({
  type,
  asset,
  amount,
  txId,
  bitcoinUnit,
  assetsList,
  timestamp,
}) => {
  const formattedAmount = formatAssetAmount(
    amount,
    asset,
    bitcoinUnit,
    assetsList
  )

  const displayAsset = asset === 'BTC' ? bitcoinUnit : asset

  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success('Transaction ID copied to clipboard')
      })
      .catch((err) => {
        console.error('Failed to copy:', err)
      })
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-12 border-b border-slate-700 items-center text-base font-medium p-4 sm:p-0 hover:bg-slate-800/30 transition-colors">
      <div
        className={twJoin(COL_CLASS_NAME, 'flex items-center sm:col-span-1')}
      >
        {type === 'on-chain' ? (
          <Badge
            icon={<Chain className="w-4 h-4" />}
            size="sm"
            variant="primary"
          >
            On-chain
          </Badge>
        ) : (
          <Badge icon={<Zap className="w-4 h-4" />} size="sm" variant="info">
            Off-chain
          </Badge>
        )}
      </div>
      <div className={twJoin(COL_CLASS_NAME, 'sm:col-span-1')}>
        {displayAsset}
      </div>
      <div className={twJoin(COL_CLASS_NAME, 'sm:col-span-2')}>
        {formattedAmount}
      </div>
      <div className={twJoin(COL_CLASS_NAME, 'sm:col-span-2')}>
        {timestamp ? formatDate(timestamp * 1000) : 'N/A'}
      </div>
      <div
        className={twJoin(
          COL_CLASS_NAME,
          'col-span-1 sm:col-span-5 truncate text-slate-400 flex items-center'
        )}
      >
        <span className="truncate">{txId}</span>
        <button
          className="ml-2 text-slate-500 hover:text-slate-300 transition-colors"
          onClick={() => copyToClipboard(txId)}
        >
          <Copy className="w-4 h-4" />
        </button>
      </div>
      <div className={twJoin(COL_CLASS_NAME, 'sm:col-span-1 text-right')}>
        <Badge variant="danger">Sent</Badge>
      </div>
    </div>
  )
}

export const Component: React.FC = () => {
  const [typeFilter, setTypeFilter] = useState<
    'all' | 'on-chain' | 'off-chain'
  >('all')
  const [assetFilter, setAssetFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const bitcoinUnit = useSelector(
    (state: RootState) => state.settings.bitcoinUnit
  )

  const { data: listAssetsData } = nodeApi.endpoints.listAssets.useQuery()
  const {
    data: transactionsData,
    isLoading: transactionsLoading,
    isError: transactionsError,
    refetch: refetchTransactions,
  } = nodeApi.endpoints.listTransactions.useQuery({ skip_sync: false })
  const {
    data: paymentsData,
    isLoading: paymentsLoading,
    isError: paymentsError,
    refetch: refetchPayments,
  } = nodeApi.endpoints.listPayments.useQuery()

  const isLoading = transactionsLoading || paymentsLoading
  const isError = transactionsError || paymentsError

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await Promise.all([refetchTransactions(), refetchPayments()])
    setIsRefreshing(false)
  }

  // Get unique assets from withdrawals
  const uniqueAssets = useMemo(() => {
    const assets = new Set<string>(['BTC'])

    // Add assets from off-chain withdrawals
    paymentsData?.payments
      .filter((payment) => !payment.inbound)
      .forEach((payment) => {
        if (payment.asset_id) {
          const ticker = listAssetsData?.nia.find(
            (a) => a.asset_id === payment.asset_id
          )?.ticker
          if (ticker) assets.add(ticker)
        }
      })

    return Array.from(assets).sort()
  }, [paymentsData, listAssetsData])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader className="w-12 h-12 animate-spin text-red-500" />
        <p className="text-slate-400">Loading withdrawal history...</p>
      </div>
    )
  }

  if (isError) {
    return (
      <Alert title="Error Loading Data" variant="error">
        <p>
          There was an error loading your withdrawal history. Please try again.
        </p>
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

  const onChainWithdrawals =
    transactionsData?.transactions
      .filter(
        (tx) =>
          tx.transaction_type === 'User' &&
          new Decimal(tx.sent).minus(tx.received).gt(0)
      )
      .map((tx) => ({
        amount: new Decimal(tx.sent).minus(tx.received).toString(),
        asset: 'BTC',
        timestamp: tx.confirmation_time?.timestamp,
        txId: tx.txid,
        type: 'on-chain' as const,
      })) || []

  const offChainWithdrawals =
    paymentsData?.payments
      .filter((payment) => !payment.inbound)
      .map((payment) => ({
        amount: payment.asset_id
          ? payment.asset_amount.toString()
          : (payment.amt_msat / 1000).toString(),
        asset:
          listAssetsData?.nia.find((a) => a.asset_id === payment.asset_id)
            ?.ticker || 'BTC',
        txId: payment.payment_hash,
        type: 'off-chain' as const,
        // Payments don't have timestamps in the API response, so we'll leave it undefined
      })) || []

  // Define a type that includes the optional timestamp property
  type Withdrawal = {
    amount: string
    asset: string
    txId: string
    type: 'on-chain' | 'off-chain'
    timestamp?: number
  }

  const allWithdrawals = [...onChainWithdrawals, ...offChainWithdrawals].sort(
    (a: Withdrawal, b: Withdrawal) => {
      // Sort by timestamp if available, otherwise by amount
      if (a.timestamp && b.timestamp) {
        return b.timestamp - a.timestamp
      } else if (a.timestamp) {
        return -1
      } else if (b.timestamp) {
        return 1
      }
      return new Decimal(b.amount).comparedTo(new Decimal(a.amount))
    }
  )

  // Apply filters
  const filteredWithdrawals = allWithdrawals.filter((withdrawal) => {
    // Type filter
    if (typeFilter !== 'all' && withdrawal.type !== typeFilter) {
      return false
    }

    // Asset filter
    if (assetFilter !== 'all' && withdrawal.asset !== assetFilter) {
      return false
    }

    // Search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      return (
        withdrawal.txId.toLowerCase().includes(searchLower) ||
        withdrawal.asset.toLowerCase().includes(searchLower) ||
        withdrawal.type.toLowerCase().includes(searchLower)
      )
    }

    return true
  })

  return (
    <Card className="bg-gray-800/50 border border-gray-700/50">
      <div className="flex justify-between items-center flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-red-500/10">
            <Chain className="h-6 w-6 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-white">Withdrawal History</h2>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            className="block w-full pl-9 pr-3 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search withdrawals..."
            type="text"
            value={searchTerm}
          />
        </div>

        <div className="relative">
          <select
            className="appearance-none w-full pl-9 pr-8 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            onChange={(e) => setTypeFilter(e.target.value as any)}
            value={typeFilter}
          >
            <option value="all">All Types</option>
            <option value="on-chain">On-chain</option>
            <option value="off-chain">Off-chain</option>
          </select>
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Chain className="h-4 w-4 text-gray-400" />
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
            className="appearance-none w-full pl-9 pr-8 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
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
            <Zap className="h-4 w-4 text-gray-400" />
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

      {filteredWithdrawals.length === 0 ? (
        <div className="text-center py-8 text-slate-400 bg-slate-800/30 rounded-lg border border-slate-700">
          {searchTerm || typeFilter !== 'all' || assetFilter !== 'all' ? (
            <>
              <p>No withdrawals found matching your filters.</p>
              <Button
                className="mt-4"
                onClick={() => {
                  setSearchTerm('')
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
            <p>No withdrawals found.</p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto bg-slate-800/30 rounded-lg border border-slate-700">
          <div className="min-w-max">
            <div className="grid grid-cols-1 sm:grid-cols-12 font-medium text-slate-400 border-b border-slate-700 py-2">
              <div className={twJoin(COL_CLASS_NAME, 'sm:col-span-1')}>
                Type
              </div>
              <div className={twJoin(COL_CLASS_NAME, 'sm:col-span-1')}>
                Asset
              </div>
              <div className={twJoin(COL_CLASS_NAME, 'sm:col-span-2')}>
                Amount
              </div>
              <div className={twJoin(COL_CLASS_NAME, 'sm:col-span-2')}>
                Date
              </div>
              <div className={twJoin(COL_CLASS_NAME, 'sm:col-span-5')}>
                Transaction ID
              </div>
              <div
                className={twJoin(COL_CLASS_NAME, 'sm:col-span-1 text-right')}
              >
                Status
              </div>
            </div>

            {filteredWithdrawals.map((withdrawal, index) => (
              <Withdrawal
                amount={withdrawal.amount}
                asset={withdrawal.asset}
                assetsList={listAssetsData?.nia}
                bitcoinUnit={bitcoinUnit}
                key={`${withdrawal.txId}-${index}`}
                timestamp={(withdrawal as Withdrawal).timestamp}
                txId={withdrawal.txId}
                type={withdrawal.type}
              />
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
