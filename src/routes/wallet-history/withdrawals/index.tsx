import Decimal from 'decimal.js'
import {
  Coins,
  LayoutGrid,
  Calendar,
  Link as Chain,
  Zap,
  RefreshCw,
  Loader,
  Search,
  Upload,
} from 'lucide-react'
import React, { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useAppSelector } from '../../../app/store/hooks'
import { Button, Badge, Card, Alert, Select } from '../../../components/ui'
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
      .filter((p: any) => !p.inbound && p.asset_id)
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
            <Upload className="relative z-10 w-10 h-10 text-[#15E99A]" />
          </div>
        </div>
        <div className="text-center space-y-4 max-w-lg">
          <p className="text-white font-bold text-xl bg-gradient-to-r from-white via-emerald-100 to-green-100 bg-clip-text text-transparent">
            {t('withdrawals.loading')}
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
        (tx: any) =>
          tx.transaction_type === 'User' &&
          new Decimal(tx.sent ?? 0).minus(tx.received ?? 0).gt(0)
      )
      .map((tx: any) => ({
        satAmount: new Decimal(tx.sent ?? 0).minus(tx.received ?? 0).toString(),
        timestamp: tx.confirmation_time?.timestamp,
        txId: tx.txid ?? '',
        type: 'on-chain' as const,
      })) || []

  const offChainWithdrawals: Withdrawal[] =
    (paymentsData?.payments || [])
      .filter((payment: any) => !payment.inbound)
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
      <div className="flex items-center gap-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-content-secondary" />
            </div>
            <input
              className="block w-full pl-9 pr-3 py-2 text-sm border border-border-default/50 rounded-lg bg-surface-overlay/30 text-white transition-all duration-200 placeholder-content-secondary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('withdrawals.searchPlaceholder')}
              type="text"
              value={searchTerm}
            />
          </div>

          <Select
            icon={<Coins className="h-4 w-4" />}
            onChange={(val) => setAssetFilter(val as any)}
            options={[
              { label: t('withdrawals.allAssets'), value: 'all' },
              ...uniqueAssets.map((asset) => ({ label: asset, value: asset })),
            ]}
            value={assetFilter}
          />

          <Select
            icon={<LayoutGrid className="h-4 w-4" />}
            onChange={(val) => setTypeFilter(val as any)}
            options={[
              { label: t('withdrawals.allTypes'), value: 'all' },
              { label: t('withdrawals.onChain'), value: 'on-chain' },
              { label: t('withdrawals.offChain'), value: 'off-chain' },
            ]}
            value={typeFilter}
          />

          <Select
            icon={<Calendar className="h-4 w-4" />}
            onChange={(val) => setStatusFilter(val as any)}
            options={[
              { label: t('withdrawals.allStatuses'), value: 'all' },
              { label: t('withdrawals.completed'), value: 'Completed' },
              { label: t('withdrawals.pending'), value: 'Pending' },
              { label: t('withdrawals.failed'), value: 'Failed' },
            ]}
            value={statusFilter}
          />
        </div>

        <div className="relative group/ref shrink-0">
          <button
            aria-label={t('withdrawals.refresh')}
            className="p-1.5 rounded-md bg-transparent hover:bg-white/5 border border-white/30 hover:border-white/50 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={isRefreshing}
            onClick={handleRefresh}
            type="button"
          >
            {isRefreshing ? (
              <Loader className="w-4 h-4 animate-spin" />
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
