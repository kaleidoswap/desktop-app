import Decimal from 'decimal.js'
import { Link as Chain, Zap, RefreshCw, Loader, Search } from 'lucide-react'
import React, { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'

import { RootState } from '../../../app/store'
import { Button, Badge, IconButton, Card, Alert } from '../../../components/ui'
import {
  Table,
  renderCopyableField,
  renderDateField,
  renderStatusBadge,
} from '../../../components/ui/Table'
import { nodeApi } from '../../../slices/nodeApi/nodeApi.slice'

const formatBitcoinAmount = (
  amount: string | number,
  bitcoinUnit: string
): string => {
  const amountDecimal = new Decimal(amount)
  if (bitcoinUnit === 'SAT') {
    return amountDecimal.toNumber().toLocaleString('en-US', {
      maximumFractionDigits: 0,
      useGrouping: true,
    })
  } else {
    return amountDecimal.div(100000000).toNumber().toLocaleString('en-US', {
      maximumFractionDigits: 8,
      minimumFractionDigits: 8,
      useGrouping: true,
    })
  }
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
  return amountDecimal
    .div(Math.pow(10, precision))
    .toNumber()
    .toLocaleString('en-US', {
      maximumFractionDigits: precision,
      minimumFractionDigits: 0,
      useGrouping: true,
    })
}

export const Component: React.FC = () => {
  const { t } = useTranslation()
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
  } = nodeApi.endpoints.listTransactions.useQuery()
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
      ; (paymentsData?.payments || [])
        .filter((payment) => !payment.inbound)
        .forEach((payment) => {
          if (payment.asset_id) {
            const ticker = (listAssetsData?.nia || []).find(
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
        <p className="text-slate-400">{t('withdrawals.loading')}</p>
      </div>
    )
  }

  if (isError) {
    return (
      <Alert title={t('withdrawals.errorLoading')} variant="error">
        <p>{t('withdrawals.errorMessage')}</p>
        <div className="mt-4">
          <Button
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={handleRefresh}
            variant="outline"
          >
            {t('withdrawals.tryAgain')}
          </Button>
        </div>
      </Alert>
    )
  }

  const onChainWithdrawals: Withdrawal[] =
    (transactionsData?.transactions || [])
      .filter(
        (tx) =>
          tx.transaction_type === 'User' &&
          new Decimal(tx.sent ?? 0).minus(tx.received ?? 0).gt(0)
      )
      .map((tx) => ({
        amount: new Decimal(tx.sent ?? 0).minus(tx.received ?? 0).toString(),
        asset: 'BTC',
        timestamp: tx.confirmation_time?.timestamp,
        txId: tx.txid ?? '',
        type: 'on-chain' as const,
      })) || []

  const offChainWithdrawals: Withdrawal[] =
    (paymentsData?.payments || [])
      .filter((payment) => !payment.inbound)
      .map((payment) => ({
        amount: payment.asset_id
          ? (payment.asset_amount ?? 0).toString()
          : ((payment.amt_msat ?? 0) / 1000).toString(),
        asset:
          (listAssetsData?.nia || []).find((a) => a.asset_id === payment.asset_id)
            ?.ticker || 'BTC',
        txId: payment.payment_hash ?? '',
        type: 'off-chain' as const,
        timestamp: undefined, // Explicitly undefined to match Withdrawal type
      })) || []

  // Define a type that includes the optional timestamp property
  type Withdrawal = {
    amount: string
    asset: string
    txId: string
    type: 'on-chain' | 'off-chain'
    timestamp?: number
  }

  const allWithdrawals: Withdrawal[] = [...onChainWithdrawals, ...offChainWithdrawals].sort(
    (a, b) => {
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
          <h2 className="text-xl font-bold text-white">
            {t('withdrawals.title')}
          </h2>
        </div>

        <IconButton
          aria-label={t('withdrawals.refresh')}
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
            placeholder={t('withdrawals.searchPlaceholder')}
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
            <option value="all">{t('withdrawals.allTypes')}</option>
            <option value="on-chain">{t('withdrawals.onChain')}</option>
            <option value="off-chain">{t('withdrawals.offChain')}</option>
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
            <option value="all">{t('withdrawals.allAssets')}</option>
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
              <p>{t('withdrawals.noWithdrawalsFiltered')}</p>
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
                {t('withdrawals.clearFilters')}
              </Button>
            </>
          ) : (
            <p>{t('withdrawals.noWithdrawals')}</p>
          )}
        </div>
      ) : (
        <Table
          columns={[
            {
              accessor: (withdrawal: Withdrawal) =>
                withdrawal.type === 'on-chain' ? (
                  <Badge
                    icon={<Chain className="w-3 h-3" />}
                    size="sm"
                    variant="primary"
                  >
                    {t('withdrawals.onChain')}
                  </Badge>
                ) : (
                  <Badge
                    icon={<Zap className="w-3 h-3" />}
                    size="sm"
                    variant="info"
                  >
                    {t('withdrawals.offChain')}
                  </Badge>
                ),
              className: 'col-span-1',
              header: t('withdrawals.type'),
            },
            {
              accessor: (withdrawal: Withdrawal) => (
                <span className="font-medium">
                  {withdrawal.asset === 'BTC' ? bitcoinUnit : withdrawal.asset}
                </span>
              ),
              className: 'col-span-1',
              header: t('withdrawals.asset'),
            },
            {
              accessor: (withdrawal: Withdrawal) => (
                <span className="font-semibold text-white">
                  {formatAssetAmount(
                    withdrawal.amount,
                    withdrawal.asset,
                    bitcoinUnit,
                    listAssetsData?.nia
                  )}
                </span>
              ),
              className: 'col-span-1',
              header: t('withdrawals.amount'),
            },
            {
              accessor: (withdrawal: Withdrawal) =>
                renderDateField(
                  withdrawal.timestamp ? withdrawal.timestamp * 1000 : null
                ),
              className: 'col-span-1',
              header: t('withdrawals.date'),
            },
            {
              accessor: (withdrawal: Withdrawal) =>
                renderCopyableField(
                  withdrawal.txId,
                  true,
                  4,
                  t('withdrawals.transactionId')
                ),
              className: 'col-span-1',
              header: t('withdrawals.transactionId'),
            },
            {
              accessor: () =>
                renderStatusBadge(t('withdrawals.completed'), 'danger'),
              className: 'col-span-1',
              header: t('withdrawals.status'),
            },
          ]}
          data={filteredWithdrawals}
          emptyState={
            <div className="text-center py-8 text-slate-400 bg-slate-800/30 rounded-lg border border-slate-700">
              {searchTerm || typeFilter !== 'all' || assetFilter !== 'all' ? (
                <>
                  <p>{t('components.walletHistory.withdrawals.noWithdrawalsFiltered')}</p>
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
                    {t('withdrawals.clearFilters')}
                  </Button>
                </>
              ) : (
                <p>{t('components.walletHistory.withdrawals.noWithdrawals')}</p>
              )}
            </div>
          }
          gridClassName="grid-cols-6"
        />
      )}
    </Card>
  )
}
