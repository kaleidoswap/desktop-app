import Decimal from 'decimal.js'
import {
  Link as Chain,
  Zap,
  RefreshCw,
  Loader as LoaderIcon,
  Search,
} from 'lucide-react'
import React, { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useAppSelector } from '../../../app/store/hooks'
import { Button, Badge, Alert, IconButton, Card } from '../../../components/ui'
import {
  Table,
  renderCopyableField,
  renderDateField,
  renderStatusBadge,
} from '../../../components/ui/Table'
import {
  formatBitcoinAmount,
  formatAssetAmount,
  resolveAssetInfo,
} from '../../../helpers/walletHistoryUtils'
import { nodeApi } from '../../../slices/nodeApi/nodeApi.slice'

export type DepositType = {
  satAmount: string
  rgbAmount?: string
  rgbAssetLabel?: string
  rgbAssetId?: string
  rgbAssetPrecision?: number
  txId: string
  type: 'on-chain' | 'off-chain'
  timestamp?: number
  status?: string
  payeePublicKey?: string
}

export const Component: React.FC = () => {
  const { t } = useTranslation()
  const [typeFilter, setTypeFilter] = useState<
    'all' | 'on-chain' | 'off-chain'
  >('all')
  const [assetFilter, setAssetFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const bitcoinUnit = useAppSelector((state) => state.settings.bitcoinUnit)

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

  const isLoading = transactionsLoading && paymentsLoading
  const isTxError = transactionsError && !transactionsLoading
  const isPaymentsError = paymentsError && !paymentsLoading
  const isError = isTxError && isPaymentsError

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await Promise.all([refetchTransactions(), refetchPayments()])
    setIsRefreshing(false)
  }

  const uniqueAssets = useMemo(() => {
    const assets = new Set<string>(['BTC'])
    ;(paymentsData?.payments || [])
      .filter((p: any) => p.inbound && p.asset_id)
      .forEach((p: any) => {
        const info = resolveAssetInfo(p.asset_id, listAssetsData)
        if (info) assets.add(info.label)
      })
    return Array.from(assets).sort()
  }, [paymentsData, listAssetsData])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <LoaderIcon className="w-12 h-12 animate-spin text-primary" />
        <p className="text-content-secondary">{t('deposits.loading')}</p>
      </div>
    )
  }

  if (isError) {
    return (
      <Alert title={t('deposits.errorLoading')} variant="error">
        <p>{t('deposits.errorMessage')}</p>
        <div className="mt-4">
          <Button
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={handleRefresh}
            variant="outline"
          >
            {t('deposits.tryAgain')}
          </Button>
        </div>
      </Alert>
    )
  }

  const showTxWarning = isTxError && !isError
  const showPaymentsWarning = isPaymentsError && !isError

  type DepositWithTimestamp = {
    satAmount: string
    rgbAmount?: string
    rgbAssetLabel?: string
    rgbAssetId?: string
    rgbAssetPrecision?: number
    txId: string
    type: 'on-chain' | 'off-chain'
    timestamp?: number
    status?: string
    payeePublicKey?: string
  }

  const onChainDeposits: DepositWithTimestamp[] =
    (transactionsData?.transactions || [])
      .filter(
        (tx: any) =>
          tx.transaction_type === 'User' &&
          new Decimal(tx.received ?? 0).minus(tx.sent ?? 0).gt(0)
      )
      .map((tx: any) => ({
        satAmount: new Decimal(tx.received ?? 0).minus(tx.sent ?? 0).toString(),
        timestamp: tx.confirmation_time?.timestamp,
        txId: tx.txid ?? '',
        type: 'on-chain' as const,
      })) || []

  const offChainDeposits: DepositWithTimestamp[] =
    (paymentsData?.payments || [])
      .filter((payment: any) => payment.inbound)
      .map((payment: any) => {
        const assetInfo = resolveAssetInfo(payment.asset_id, listAssetsData)
        return {
          payeePublicKey: payment.payee_pubkey,
          rgbAmount: assetInfo
            ? (payment.asset_amount ?? 0).toString()
            : undefined,
          rgbAssetId: assetInfo?.fullId,
          rgbAssetLabel: assetInfo?.label,
          rgbAssetPrecision: assetInfo?.precision,
          satAmount: ((payment.amt_msat ?? 0) / 1000).toString(),
          status: payment.status,
          timestamp: payment.created_at,
          txId: payment.payment_hash ?? '',
          type: 'off-chain' as const,
        }
      }) || []

  const assetLabel = (d: DepositWithTimestamp) => d.rgbAssetLabel ?? 'BTC'

  const allDeposits = [...onChainDeposits, ...offChainDeposits].sort(
    (a: DepositWithTimestamp, b: DepositWithTimestamp) => {
      if (a.timestamp && b.timestamp) return b.timestamp - a.timestamp
      if (a.timestamp) return -1
      if (b.timestamp) return 1
      return new Decimal(b.satAmount).comparedTo(new Decimal(a.satAmount))
    }
  )

  const filteredDeposits = allDeposits.filter(
    (deposit: DepositWithTimestamp) => {
      if (typeFilter !== 'all' && deposit.type !== typeFilter) return false
      if (assetFilter !== 'all' && assetLabel(deposit) !== assetFilter)
        return false
      if (statusFilter !== 'all') {
        const depositStatus = deposit.status ?? 'Completed'
        if (depositStatus.toLowerCase() !== statusFilter.toLowerCase())
          return false
      }
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        return (
          deposit.txId.toLowerCase().includes(searchLower) ||
          assetLabel(deposit).toLowerCase().includes(searchLower) ||
          deposit.type.toLowerCase().includes(searchLower) ||
          (deposit.rgbAssetId ?? '').toLowerCase().includes(searchLower) ||
          (deposit.payeePublicKey ?? '').toLowerCase().includes(searchLower)
        )
      }
      return true
    }
  )

  const renderDepositStatus = (deposit: DepositWithTimestamp) => {
    if (deposit.type === 'on-chain') {
      return renderStatusBadge(t('deposits.completed'), 'success')
    }
    switch (deposit.status) {
      case 'Succeeded':
        return renderStatusBadge(t('deposits.succeeded'), 'success')
      case 'Pending':
        return renderStatusBadge(t('deposits.pending'), 'warning')
      case 'Failed':
        return renderStatusBadge(t('deposits.failed'), 'danger')
      default:
        return renderStatusBadge(
          deposit.status ?? t('deposits.completed'),
          'default'
        )
    }
  }

  const tableColumns = [
    {
      accessor: (deposit: DepositWithTimestamp) =>
        deposit.type === 'on-chain' ? (
          <Badge
            icon={<Chain className="w-3 h-3" />}
            size="sm"
            variant="primary"
          >
            {t('deposits.onChain')}
          </Badge>
        ) : (
          <Badge icon={<Zap className="w-3 h-3" />} size="sm" variant="info">
            {t('deposits.offChain')}
          </Badge>
        ),
      className: 'col-span-1',
      header: t('deposits.type'),
    },
    {
      accessor: (deposit: DepositWithTimestamp) => (
        <div className="flex flex-col gap-0.5">
          {deposit.rgbAssetLabel ? (
            <>
              <span className="font-medium">{deposit.rgbAssetLabel}</span>
              <span className="text-xs text-content-secondary">
                {bitcoinUnit}
              </span>
              {deposit.rgbAssetId && (
                <div className="flex items-center">
                  {renderCopyableField(
                    deposit.rgbAssetId,
                    true,
                    6,
                    t('deposits.assetId')
                  )}
                </div>
              )}
            </>
          ) : (
            <span className="font-medium">{bitcoinUnit}</span>
          )}
        </div>
      ),
      className: 'col-span-1',
      header: t('deposits.asset'),
    },
    {
      accessor: (deposit: DepositWithTimestamp) => (
        <div className="flex flex-col gap-0.5">
          {deposit.rgbAmount !== undefined && deposit.rgbAssetLabel ? (
            <>
              <span className="font-semibold text-white">
                {formatAssetAmount(
                  deposit.rgbAmount,
                  false,
                  bitcoinUnit,
                  deposit.rgbAssetPrecision ?? 0
                )}{' '}
                <span className="text-content-secondary font-normal">
                  {deposit.rgbAssetLabel}
                </span>
              </span>
              <span className="text-xs text-content-secondary">
                {formatBitcoinAmount(deposit.satAmount, bitcoinUnit)}{' '}
                {bitcoinUnit}
              </span>
            </>
          ) : (
            <span className="font-semibold text-white">
              {formatBitcoinAmount(deposit.satAmount, bitcoinUnit)}
            </span>
          )}
        </div>
      ),
      className: 'col-span-1',
      header: t('deposits.amount'),
    },
    {
      accessor: (deposit: DepositWithTimestamp) =>
        renderDateField(deposit.timestamp ? deposit.timestamp * 1000 : null),
      className: 'col-span-1',
      header: t('deposits.date'),
    },
    {
      accessor: (deposit: DepositWithTimestamp) => (
        <div className="flex flex-col gap-1">
          {renderCopyableField(
            deposit.txId,
            true,
            4,
            t('deposits.transactionId')
          )}
          {deposit.payeePublicKey && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-content-tertiary">
                {t('deposits.payee')}:
              </span>
              {renderCopyableField(
                deposit.payeePublicKey,
                true,
                4,
                t('deposits.payeePubkey')
              )}
            </div>
          )}
        </div>
      ),
      className: 'col-span-1',
      header: t('deposits.transactionId'),
    },
    {
      accessor: (deposit: DepositWithTimestamp) => renderDepositStatus(deposit),
      className: 'col-span-1',
      header: t('deposits.status'),
    },
  ]

  return (
    <Card className="bg-surface-overlay/50 border border-border-default/50">
      <div className="flex justify-between items-center flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-green-500/10">
            <Chain className="h-6 w-6 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-white">
            {t('deposits.title')}
          </h2>
        </div>

        <IconButton
          aria-label={t('deposits.refresh')}
          disabled={isRefreshing}
          icon={
            isRefreshing ? (
              <LoaderIcon className="w-5 h-5 animate-spin" />
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
            <Search className="h-4 w-4 text-content-secondary" />
          </div>
          <input
            className="block w-full pl-9 pr-3 py-2 border border-border-default rounded-lg bg-surface-overlay text-white placeholder-content-secondary focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('deposits.searchPlaceholder')}
            type="text"
            value={searchTerm}
          />
        </div>

        <div className="relative">
          <select
            className="appearance-none w-full pl-9 pr-8 py-2 border border-border-default rounded-lg bg-surface-overlay text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            onChange={(e) => setTypeFilter(e.target.value as any)}
            value={typeFilter}
          >
            <option value="all">{t('deposits.allTypes')}</option>
            <option value="on-chain">{t('deposits.onChain')}</option>
            <option value="off-chain">{t('deposits.offChain')}</option>
          </select>
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Chain className="h-4 w-4 text-content-secondary" />
          </div>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <svg
              className="h-4 w-4 text-content-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
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
            className="appearance-none w-full pl-9 pr-8 py-2 border border-border-default rounded-lg bg-surface-overlay text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            onChange={(e) => setAssetFilter(e.target.value)}
            value={assetFilter}
          >
            <option value="all">{t('deposits.allAssets')}</option>
            {uniqueAssets.map((asset) => (
              <option key={asset} value={asset}>
                {asset}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Zap className="h-4 w-4 text-content-secondary" />
          </div>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <svg
              className="h-4 w-4 text-content-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
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
            className="appearance-none w-full pl-3 pr-8 py-2 border border-border-default rounded-lg bg-surface-overlay text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            onChange={(e) => setStatusFilter(e.target.value)}
            value={statusFilter}
          >
            <option value="all">{t('deposits.allStatuses')}</option>
            <option value="Completed">{t('deposits.completed')}</option>
            <option value="Pending">{t('deposits.pending')}</option>
            <option value="Failed">{t('deposits.failed')}</option>
          </select>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <svg
              className="h-4 w-4 text-content-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
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

      {showTxWarning && (
        <Alert
          className="mb-4"
          title={t('deposits.onChainUnavailable')}
          variant="warning"
        >
          <p>{t('deposits.onChainUnavailableMessage')}</p>
        </Alert>
      )}
      {showPaymentsWarning && (
        <Alert
          className="mb-4"
          title={t('deposits.offChainUnavailable')}
          variant="warning"
        >
          <p>{t('deposits.offChainUnavailableMessage')}</p>
        </Alert>
      )}

      {filteredDeposits.length === 0 ? (
        <div className="text-center py-8 text-content-secondary bg-surface-overlay/30 rounded-lg border border-border-default">
          {searchTerm ||
          typeFilter !== 'all' ||
          assetFilter !== 'all' ||
          statusFilter !== 'all' ? (
            <>
              <p>{t('deposits.noDepositsFiltered')}</p>
              <Button
                className="mt-4"
                onClick={() => {
                  setSearchTerm('')
                  setTypeFilter('all')
                  setAssetFilter('all')
                  setStatusFilter('all')
                }}
                size="sm"
                variant="outline"
              >
                {t('deposits.clearFilters')}
              </Button>
            </>
          ) : (
            <p>{t('deposits.noDeposits')}</p>
          )}
        </div>
      ) : (
        <Table
          className=""
          columns={tableColumns}
          containerClassName=""
          data={filteredDeposits}
          emptyState={
            <div className="text-center py-8 text-content-secondary bg-surface-overlay/30 rounded-lg border border-border-default">
              {searchTerm ||
              typeFilter !== 'all' ||
              assetFilter !== 'all' ||
              statusFilter !== 'all' ? (
                <>
                  <p>{t('deposits.noDepositsFiltered')}</p>
                  <Button
                    className="mt-4"
                    onClick={() => {
                      setSearchTerm('')
                      setTypeFilter('all')
                      setAssetFilter('all')
                      setStatusFilter('all')
                    }}
                    size="sm"
                    variant="outline"
                  >
                    {t('deposits.clearFilters')}
                  </Button>
                </>
              ) : (
                <p>{t('deposits.noDeposits')}</p>
              )}
            </div>
          }
          gridClassName="grid-cols-6"
          minWidth=""
          rowClassName={(_row, _i) => ''}
        />
      )}
    </Card>
  )
}
