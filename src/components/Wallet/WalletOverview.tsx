import {
  Button,
  Card,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'kaleido-ui'
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Coins,
  History,
  Plus,
  RefreshCw,
} from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export function WalletPage({
  children,
  description,
  action,
}: {
  children: ReactNode
  description?: string
  action?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="mx-auto flex w-full max-w-screen-xl flex-col gap-5">
      <PageHeader
        action={action}
        description={description}
        title={t('p2pShell.wallet')}
        variant="page"
      />
      {children}
    </div>
  )
}

export interface WalletAsset {
  id: string
  ticker: string
  description?: string
  icon?: ReactNode
  amounts: readonly [string | null, string | null]
  pending?: string
  loading?: boolean
  onDetails?: () => void
}

interface WalletOverviewProps {
  balanceLabel: string
  balance: string | null
  balanceLoading: boolean
  balanceDetails?: ReactNode
  assets: WalletAsset[]
  bitcoinRow?: WalletAsset
  columns: readonly [string, string]
  assetsState: 'loading' | 'ready' | 'unavailable'
  emptyMessage: string
  error?: string
  footer?: ReactNode
  onRefresh: () => void
  refreshing?: boolean
  onReceive: (id?: string) => void
  onSend: (id?: string) => void
  onAssetSend?: (id: string) => void
  onAssetHistory?: (id: string) => void
  onManageCoins: () => void
  onIssue: () => void
  marketAction: { label: string; onClick: () => void }
}

/** Present one wallet. The caller supplies its own unit, asset columns and actions. */
export function WalletOverview({
  balanceLabel,
  balance,
  balanceLoading,
  balanceDetails,
  assets,
  bitcoinRow,
  columns,
  assetsState,
  emptyMessage,
  error,
  footer,
  onRefresh,
  refreshing,
  onReceive,
  onSend,
  onAssetSend,
  onAssetHistory,
  onManageCoins,
  onIssue,
  marketAction,
}: WalletOverviewProps) {
  const { t } = useTranslation()
  const balanceId = useId()
  const assetsId = useId()
  const loading = t('common.loading')
  const unavailable = t('p2pMarket.market.cost.unavailable')
  const receive = t('p2pHome.receive')
  const send = t('p2pHome.send')
  const history = t('unified.activity')
  const renderRow = (asset: WalletAsset) => {
    const identity = (
      <>
        {asset.icon}
        <span className="min-w-0">
          <span className="block break-all font-semibold text-content-primary">
            {asset.ticker}
          </span>
          {asset.description && (
            <span className="block break-all text-xs text-content-tertiary">
              {asset.description}
            </span>
          )}
        </span>
      </>
    )
    return (
      <TableRow key={asset.id}>
        <TableCell className="max-w-52">
          {asset.onDetails ? (
            <button
              className="flex items-center gap-2 text-left hover:underline"
              onClick={asset.onDetails}
              type="button"
            >
              {identity}
            </button>
          ) : (
            <div className="flex items-center gap-2">{identity}</div>
          )}
        </TableCell>
        {asset.amounts.map((amount, i) => (
          <TableCell
            className="text-right font-medium tabular-nums"
            key={columns[i]}
          >
            {asset.loading ? (
              <span aria-label={loading}>…</span>
            ) : (
              (amount ?? <span aria-label={unavailable}>—</span>)
            )}
            {i === 1 && asset.pending && (
              <span className="block text-xs text-status-warning">
                {asset.pending}
              </span>
            )}
          </TableCell>
        ))}
        <TableCell>
          <div className="flex flex-wrap justify-end gap-0.5">
            <Button
              aria-label={receive + ' · ' + asset.ticker}
              onClick={() => onReceive(asset.id)}
              size="icon-sm"
              title={receive}
              type="button"
              variant="quiet"
            >
              <ArrowDownLeft aria-hidden size={16} />
            </Button>
            {onAssetSend && (
              <Button
                aria-label={send + ' · ' + asset.ticker}
                onClick={() => onAssetSend(asset.id)}
                size="icon-sm"
                title={send}
                type="button"
                variant="quiet"
              >
                <ArrowUpRight aria-hidden size={16} />
              </Button>
            )}
            {onAssetHistory && (
              <Button
                aria-label={history + ' · ' + asset.ticker}
                onClick={() => onAssetHistory(asset.id)}
                size="icon-sm"
                title={history}
                type="button"
                variant="quiet"
              >
                <History aria-hidden size={16} />
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
    )
  }
  const refreshingLabel = t(
    refreshing ? 'dashboard.refreshing' : 'dashboard.refresh'
  )
  return (
    <div className="flex min-w-0 flex-col gap-5">
      {error && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-status-warning/10 px-4 py-3 text-sm text-status-warning"
          role="alert"
        >
          {error}
          <Button
            disabled={refreshing}
            onClick={onRefresh}
            size="sm"
            type="button"
            variant="quiet"
          >
            {t('p2pMarket.retry')}
          </Button>
        </div>
      )}
      <Card
        aria-labelledby={balanceId}
        className="min-w-0 gap-4 p-4 sm:p-6"
        role="region"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              className="text-sm font-semibold text-content-secondary"
              id={balanceId}
            >
              {balanceLabel}
            </h2>
            <p
              aria-busy={balanceLoading}
              className="mt-1 text-3xl font-bold tabular-nums text-content-primary"
            >
              {balanceLoading ? (
                <span aria-label={loading}>…</span>
              ) : (
                (balance ?? <span aria-label={unavailable}>—</span>)
              )}
            </p>
          </div>
          <Button
            aria-label={refreshingLabel}
            disabled={refreshing}
            onClick={onRefresh}
            size="icon-sm"
            title={refreshingLabel}
            type="button"
            variant="quiet"
          >
            <RefreshCw
              aria-hidden
              className={refreshing ? 'animate-spin' : undefined}
              size={16}
            />
          </Button>
        </div>
        {balanceDetails}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onReceive()} type="button" variant="surface">
            <ArrowDownLeft aria-hidden size={16} />
            {receive}
          </Button>
          <Button onClick={() => onSend()} type="button" variant="surface">
            <ArrowUpRight aria-hidden size={16} />
            {send}
          </Button>
          <Button onClick={marketAction.onClick} type="button" variant="quiet">
            <ArrowLeftRight aria-hidden size={16} />
            {marketAction.label}
          </Button>
        </div>
      </Card>
      <Card
        aria-labelledby={assetsId}
        className="min-w-0 gap-3 p-4 sm:p-6"
        role="region"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-subhead font-bold" id={assetsId}>
            {t('dashboard.assets')}
          </h2>
          <div className="flex flex-wrap gap-1">
            <Button
              onClick={onManageCoins}
              size="sm"
              type="button"
              variant="quiet"
            >
              <Coins aria-hidden size={16} />
              {t('p2pWallet.manageCoins')}
            </Button>
            <Button onClick={onIssue} size="sm" type="button" variant="surface">
              <Plus aria-hidden size={16} />
              {t('p2pWallet.issue')}
            </Button>
          </div>
        </div>
        {(bitcoinRow || assets.length > 0) && (
          <Table className="max-sm:[&_td]:px-1 max-sm:[&_th]:px-1">
            <TableHeader>
              <TableRow>
                <TableHead>{t('dashboard.asset')}</TableHead>
                {columns.map((label) => (
                  <TableHead className="text-right" key={label}>
                    {label}
                  </TableHead>
                ))}
                <TableHead className="text-right">
                  <span className="sr-only">{t('p2pWallet.actions')}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bitcoinRow && renderRow(bitcoinRow)}
              {assets.map(renderRow)}
            </TableBody>
          </Table>
        )}
        {(assetsState !== 'ready' || assets.length === 0) && (
          <p className="text-sm text-content-tertiary" role="status">
            {assetsState === 'loading'
              ? loading
              : assetsState === 'unavailable'
                ? unavailable
                : emptyMessage}
          </p>
        )}
        {footer && (
          <div className="flex flex-wrap items-center gap-2 border-t border-divider/10 pt-3 text-xs text-content-tertiary">
            {footer}
          </div>
        )}
      </Card>
    </div>
  )
}
