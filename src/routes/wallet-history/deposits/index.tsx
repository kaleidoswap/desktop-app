import Decimal from 'decimal.js'
import {
  Coins,
  LayoutGrid,
  Calendar,
  Link as Chain,
  Zap,
  RefreshCw,
  Loader as LoaderIcon,
  Search,
  Download,
} from 'lucide-react'
import React, { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useAppSelector } from '../../../app/store/hooks'
import { Button, Badge, Alert, Card, Select } from '../../../components/ui'
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
      <div className="flex flex-col justify-center items-center min-h-[60vh] gap-6">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/30 via-green-500/25 to-teal-600/30 rounded-full blur-2xl"></div>
          <div className="relative bg-gradient-to-br from-primary/20 to-primary/5 backdrop-blur-2xl rounded-2xl p-6 ring-1 ring-primary/20 shadow-lg shadow-primary/10">
            <Download className="relative z-10 w-10 h-10 text-[#15E99A]" />
          </div>
        </div>
        <div className="text-center space-y-4 max-w-lg">
          <p className="text-white font-bold text-xl bg-gradient-to-r from-white via-emerald-100 to-green-100 bg-clip-text text-transparent">
            {t('deposits.loading')}
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

  // Zero-amount BTC Lightning invoice (an unpaid receive invoice — e.g. the
  // one auto-created when the deposit screen opens). These are hidden from the
  // list by default and only shown via the "Pending invoices" filter.
  const isZeroAmountLnInvoice = (d: DepositWithTimestamp) =>
    d.type === 'off-chain' &&
    !d.rgbAssetId &&
    parseFloat(d.satAmount || '0') === 0

  const filteredDeposits = allDeposits.filter(
    (deposit: DepositWithTimestamp) => {
      if (statusFilter !== 'pending-invoice' && isZeroAmountLnInvoice(deposit))
        return false
      if (typeFilter !== 'all' && deposit.type !== typeFilter) return false
      if (assetFilter !== 'all' && assetLabel(deposit) !== assetFilter)
        return false
      if (statusFilter === 'pending-invoice') {
        // Unpaid, zero-amount Lightning invoices generated to receive BTC.
        const isPendingZeroInvoice =
          deposit.type === 'off-chain' &&
          (deposit.status ?? '').toLowerCase() === 'pending' &&
          !deposit.rgbAssetId &&
          parseFloat(deposit.satAmount || '0') === 0
        if (!isPendingZeroInvoice) return false
      } else if (statusFilter !== 'all') {
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
      <div className="flex items-center gap-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-content-secondary" />
            </div>
            <input
              className="block w-full pl-9 pr-3 py-2 text-sm border border-border-default/50 rounded-lg bg-surface-overlay/30 text-white transition-all duration-200 placeholder-content-secondary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('deposits.searchPlaceholder')}
              type="text"
              value={searchTerm}
            />
          </div>

          <Select
            icon={<Coins className="h-4 w-4" />}
            onChange={(val) => setAssetFilter(val as any)}
            options={[
              { label: t('deposits.allAssets'), value: 'all' },
              ...uniqueAssets.map((asset) => ({ label: asset, value: asset })),
            ]}
            value={assetFilter}
          />

          <Select
            icon={<LayoutGrid className="h-4 w-4" />}
            onChange={(val) => setTypeFilter(val as any)}
            options={[
              { label: t('deposits.allTypes'), value: 'all' },
              { label: t('deposits.onChain'), value: 'on-chain' },
              { label: t('deposits.offChain'), value: 'off-chain' },
            ]}
            value={typeFilter}
          />

          <Select
            icon={<Calendar className="h-4 w-4" />}
            onChange={(val) => setStatusFilter(val as any)}
            options={[
              { label: t('deposits.allStatuses'), value: 'all' },
              { label: t('deposits.completed'), value: 'Completed' },
              { label: t('deposits.pending'), value: 'Pending' },
              { label: t('deposits.failed'), value: 'Failed' },
              {
                label: t('deposits.pendingInvoices', 'Pending invoices'),
                value: 'pending-invoice',
              },
            ]}
            value={statusFilter}
          />
        </div>

        <div className="relative group/ref shrink-0">
          <button
            aria-label={t('deposits.refresh')}
            className="p-1.5 rounded-md bg-transparent hover:bg-white/5 border border-white/30 hover:border-white/50 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={isRefreshing}
            onClick={handleRefresh}
            type="button"
          >
            {isRefreshing ? (
              <LoaderIcon className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </button>
          <div className="absolute bottom-full mb-1.5 right-0 bg-surface-high text-content-primary text-[10px] rounded-md py-0.5 px-1.5 opacity-0 group-hover/ref:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-border-default/40 shadow-lg z-20">
            Refresh data
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
          columns={tableColumns}
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
        />
      )}
    </Card>
  )
}
