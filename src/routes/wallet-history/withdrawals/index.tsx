import Decimal from 'decimal.js'
import { Link as Chain, Zap, RefreshCw, Loader, Search } from 'lucide-react'
import React, { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useAppSelector } from '../../../app/store/hooks'
import { Button, Badge, IconButton, Card, Alert } from '../../../components/ui'
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
      .filter((p) => !p.inbound && p.asset_id)
      .forEach((p) => {
        const info = resolveAssetInfo(p.asset_id, listAssetsData)
        if (info) assets.add(info.label)
      })
    return Array.from(assets).sort()
  }, [paymentsData, listAssetsData])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader className="w-12 h-12 animate-spin text-red-500" />
        <p className="text-content-secondary">{t('withdrawals.loading')}</p>
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

  const showTxWarning = isTxError && !isError
  const showPaymentsWarning = isPaymentsError && !isError

  type Withdrawal = {
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

  const onChainWithdrawals: Withdrawal[] =
    (transactionsData?.transactions || [])
      .filter(
        (tx) =>
          tx.transaction_type === 'User' &&
          new Decimal(tx.sent ?? 0).minus(tx.received ?? 0).gt(0)
      )
      .map((tx) => ({
        satAmount: new Decimal(tx.sent ?? 0).minus(tx.received ?? 0).toString(),
        timestamp: tx.confirmation_time?.timestamp,
        txId: tx.txid ?? '',
        type: 'on-chain' as const,
      })) || []

  const offChainWithdrawals: Withdrawal[] =
    (paymentsData?.payments || [])
      .filter((payment) => !payment.inbound)
      .map((payment) => {
        const assetInfo = resolveAssetInfo(payment.asset_id, listAssetsData)
        return {
          satAmount: ((payment.amt_msat ?? 0) / 1000).toString(),
          rgbAmount: assetInfo
            ? (payment.asset_amount ?? 0).toString()
            : undefined,
          rgbAssetLabel: assetInfo?.label,
          rgbAssetId: assetInfo?.fullId,
          rgbAssetPrecision: assetInfo?.precision,
          txId: payment.payment_hash ?? '',
          type: 'off-chain' as const,
          timestamp: payment.created_at,
          status: payment.status,
          payeePublicKey: payment.payee_pubkey,
        }
      }) || []

  const allWithdrawals: Withdrawal[] = [
    ...onChainWithdrawals,
    ...offChainWithdrawals,
  ].sort((a, b) => {
    if (a.timestamp && b.timestamp) return b.timestamp - a.timestamp
    if (a.timestamp) return -1
    if (b.timestamp) return 1
    return new Decimal(b.satAmount).comparedTo(new Decimal(a.satAmount))
  })

  const assetLabel = (w: Withdrawal) => w.rgbAssetLabel ?? 'BTC'

  const filteredWithdrawals = allWithdrawals.filter((withdrawal) => {
    if (typeFilter !== 'all' && withdrawal.type !== typeFilter) return false
    if (assetFilter !== 'all' && assetLabel(withdrawal) !== assetFilter)
      return false
    if (statusFilter !== 'all') {
      const wStatus = withdrawal.status ?? 'Completed'
      if (wStatus.toLowerCase() !== statusFilter.toLowerCase()) return false
    }
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      return (
        withdrawal.txId.toLowerCase().includes(searchLower) ||
        assetLabel(withdrawal).toLowerCase().includes(searchLower) ||
        withdrawal.type.toLowerCase().includes(searchLower) ||
        (withdrawal.rgbAssetId ?? '').toLowerCase().includes(searchLower) ||
        (withdrawal.payeePublicKey ?? '').toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  return (
    <Card className="bg-surface-overlay/50 border border-border-default/50">
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-content-secondary" />
          </div>
          <input
            className="block w-full pl-9 pr-3 py-2 border border-border-default rounded-lg bg-surface-overlay text-white placeholder-content-secondary focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('withdrawals.searchPlaceholder')}
            type="text"
            value={searchTerm}
          />
        </div>

        <div className="relative">
          <select
            className="appearance-none w-full pl-9 pr-8 py-2 border border-border-default rounded-lg bg-surface-overlay text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            onChange={(e) => setTypeFilter(e.target.value as any)}
            value={typeFilter}
          >
            <option value="all">{t('withdrawals.allTypes')}</option>
            <option value="on-chain">{t('withdrawals.onChain')}</option>
            <option value="off-chain">{t('withdrawals.offChain')}</option>
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
            className="appearance-none w-full pl-9 pr-8 py-2 border border-border-default rounded-lg bg-surface-overlay text-white focus:outline-none focus:ring-2 focus:ring-red-500"
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
            className="appearance-none w-full pl-3 pr-8 py-2 border border-border-default rounded-lg bg-surface-overlay text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            onChange={(e) => setStatusFilter(e.target.value)}
            value={statusFilter}
          >
            <option value="all">{t('withdrawals.allStatuses')}</option>
            <option value="Completed">{t('withdrawals.completed')}</option>
            <option value="Succeeded">{t('withdrawals.succeeded')}</option>
            <option value="Pending">{t('withdrawals.pending')}</option>
            <option value="Failed">{t('withdrawals.failed')}</option>
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
          title={t('withdrawals.onChainUnavailable')}
          variant="warning"
        >
          <p>{t('withdrawals.onChainUnavailableMessage')}</p>
        </Alert>
      )}
      {showPaymentsWarning && (
        <Alert
          className="mb-4"
          title={t('withdrawals.offChainUnavailable')}
          variant="warning"
        >
          <p>{t('withdrawals.offChainUnavailableMessage')}</p>
        </Alert>
      )}

      {filteredWithdrawals.length === 0 ? (
        <div className="text-center py-8 text-content-secondary bg-surface-overlay/30 rounded-lg border border-border-default">
          {searchTerm ||
          typeFilter !== 'all' ||
          assetFilter !== 'all' ||
          statusFilter !== 'all' ? (
            <>
              <p>{t('withdrawals.noWithdrawalsFiltered')}</p>
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
                <div className="flex flex-col gap-0.5">
                  {withdrawal.rgbAssetLabel ? (
                    <>
                      <span className="font-medium">
                        {withdrawal.rgbAssetLabel}
                      </span>
                      <span className="text-xs text-content-secondary">
                        {bitcoinUnit}
                      </span>
                      {withdrawal.rgbAssetId && (
                        <div className="flex items-center">
                          {renderCopyableField(
                            withdrawal.rgbAssetId,
                            true,
                            6,
                            t('withdrawals.assetId')
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
              header: t('withdrawals.asset'),
            },
            {
              accessor: (withdrawal: Withdrawal) => (
                <div className="flex flex-col gap-0.5">
                  {withdrawal.rgbAmount !== undefined &&
                  withdrawal.rgbAssetLabel ? (
                    <>
                      <span className="font-semibold text-white">
                        {formatAssetAmount(
                          withdrawal.rgbAmount,
                          false,
                          bitcoinUnit,
                          withdrawal.rgbAssetPrecision ?? 0
                        )}{' '}
                        <span className="text-content-secondary font-normal">
                          {withdrawal.rgbAssetLabel}
                        </span>
                      </span>
                      <span className="text-xs text-content-secondary">
                        {formatBitcoinAmount(withdrawal.satAmount, bitcoinUnit)}{' '}
                        {bitcoinUnit}
                      </span>
                    </>
                  ) : (
                    <span className="font-semibold text-white">
                      {formatBitcoinAmount(withdrawal.satAmount, bitcoinUnit)}
                    </span>
                  )}
                </div>
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
              accessor: (withdrawal: Withdrawal) => (
                <div className="flex flex-col gap-1">
                  {renderCopyableField(
                    withdrawal.txId,
                    true,
                    4,
                    t('withdrawals.transactionId')
                  )}
                  {withdrawal.payeePublicKey && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-content-tertiary">
                        {t('withdrawals.payee')}:
                      </span>
                      {renderCopyableField(
                        withdrawal.payeePublicKey,
                        true,
                        4,
                        t('withdrawals.payeePubkey')
                      )}
                    </div>
                  )}
                </div>
              ),
              className: 'col-span-1',
              header: t('withdrawals.transactionId'),
            },
            {
              accessor: (withdrawal: Withdrawal) => {
                if (withdrawal.type === 'on-chain') {
                  return renderStatusBadge(
                    t('withdrawals.completed'),
                    'success'
                  )
                }
                switch (withdrawal.status) {
                  case 'Succeeded':
                    return renderStatusBadge(
                      t('withdrawals.succeeded'),
                      'success'
                    )
                  case 'Pending':
                    return renderStatusBadge(
                      t('withdrawals.pending'),
                      'warning'
                    )
                  case 'Failed':
                    return renderStatusBadge(t('withdrawals.failed'), 'danger')
                  default:
                    return renderStatusBadge(
                      withdrawal.status ?? t('withdrawals.completed'),
                      'default'
                    )
                }
              },
              className: 'col-span-1',
              header: t('withdrawals.status'),
            },
          ]}
          data={filteredWithdrawals}
          emptyState={
            <div className="text-center py-8 text-content-secondary bg-surface-overlay/30 rounded-lg border border-border-default">
              {searchTerm ||
              typeFilter !== 'all' ||
              assetFilter !== 'all' ||
              statusFilter !== 'all' ? (
                <>
                  <p>{t('withdrawals.noWithdrawalsFiltered')}</p>
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
                    {t('withdrawals.clearFilters')}
                  </Button>
                </>
              ) : (
                <p>{t('withdrawals.noWithdrawals')}</p>
              )}
            </div>
          }
          gridClassName="grid-cols-6"
        />
      )}
    </Card>
  )
}
