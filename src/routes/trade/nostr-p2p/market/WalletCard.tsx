import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Copy,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'

import { availableSats, type Balance, type Info } from '../api'
import { fmtSats, fmtUnits, short } from '../format'

import { useTr } from './hooks'
import { Panel, cx } from './ui'

export type FundsDirection = 'toTrading' | 'toNode'

/** What the user's node holds, when the app can read it. */
export interface NodeSummary {
  connected: boolean
  btc: number
}

interface Props {
  /** The node's own balance, shown next to the trading wallet so both are in one place. */
  node?: NodeSummary
  balance: Balance | undefined
  info: Info
  /** Opens the funds dialog on the given direction. */
  onOpenFunds?: (direction: FundsDirection) => void
  /** Opens the coins (UTXO) manager. */
  onManageCoins?: () => void
  /** Opens the dialog that issues a new asset. */
  onIssueAsset?: () => void
  /** Sync the wallet with the chain now. */
  onRefresh?: () => Promise<void>
  /** Look through the whole address chain for a deposit the quick sync did not find. */
  onRescan?: () => Promise<void>
}

/**
 * What the trading wallet holds and the way to put more in. The wallet is separate from the node:
 * only what is moved here can be traded, so this is the first thing a new user needs.
 */
export function WalletCard({
  balance,
  info,
  node,
  onIssueAsset,
  onManageCoins,
  onOpenFunds,
  onRefresh,
  onRescan,
}: Props) {
  const tr = useTr()
  const [showAddress, setShowAddress] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5_000)
    return () => clearInterval(id)
  }, [])
  const btc = availableSats(balance)
  const pending = balance?.btc_pending_sat ?? 0
  const syncedAgo =
    balance?.synced_at && balance.synced_at > 0
      ? Math.max(0, Math.floor(now / 1000) - balance.synced_at)
      : null

  const [rescanning, setRescanning] = useState(false)
  const rescan = async () => {
    if (!onRescan || rescanning) return
    setRescanning(true)
    try {
      await onRescan()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setRescanning(false)
    }
  }

  const refresh = async () => {
    if (!onRefresh || refreshing) return
    setRefreshing(true)
    try {
      await onRefresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setRefreshing(false)
    }
  }
  const assets = (balance?.assets ?? []).filter((a) => a.total > 0)
  const empty = btc === 0 && pending === 0 && assets.length === 0

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(info.address)
      toast.success(tr('wallet.copied', 'Address copied'))
    } catch {
      toast.error(tr('wallet.copyFailed', 'Could not copy the address'))
    }
  }

  return (
    <Panel
      className={cx('flex flex-col gap-3', empty && 'ring-1 ring-primary/40')}
      label={tr('wallet.title', 'Trading wallet')}
    >
      <header className="flex items-baseline justify-between">
        <h2 className="text-subhead font-medium text-content-primary">
          {tr('wallet.title', 'Trading wallet')}
        </h2>
        {onRefresh && (
          <button
            aria-label={tr('wallet.refresh', 'Update balance')}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-tiny text-content-tertiary transition-colors hover:bg-surface-raised hover:text-content-primary"
            disabled={refreshing}
            onClick={() => void refresh()}
            title={tr(
              'wallet.refreshHelp',
              'Check the chain for new deposits now. The wallet also updates by itself every 20 seconds.'
            )}
            type="button"
          >
            {refreshing ? (
              <Loader2 aria-hidden className="animate-spin" size={12} />
            ) : (
              <RefreshCw aria-hidden size={12} />
            )}
            {syncedAgo === null
              ? tr('wallet.syncing', 'syncing…')
              : syncedAgo < 10
                ? tr('wallet.justNow', 'just updated')
                : tr('wallet.updatedAgo', 'updated {{n}}s ago', {
                    n: syncedAgo,
                  })}
          </button>
        )}
      </header>

      {node && (
        <div className="flex items-baseline justify-between rounded-xl bg-surface-inset px-3 py-2">
          <span className="text-caption text-content-secondary">
            {tr('wallet.node', 'Your node')}
          </span>
          {node.connected ? (
            <span className="text-body font-medium tabular-nums text-content-primary">
              {fmtSats(node.btc)}{' '}
              <span className="text-caption font-normal text-content-tertiary">
                sats
              </span>
            </span>
          ) : (
            <span className="text-caption text-status-warning">
              {tr('wallet.nodeOff', 'not connected')}
            </span>
          )}
        </div>
      )}

      {empty ? (
        <p className="text-caption text-content-secondary">
          {tr(
            'wallet.empty',
            'Empty. Deposit bitcoin to start trading, and any RGB asset you want to sell.'
          )}
        </p>
      ) : (
        <dl className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <dt className="text-caption text-content-secondary">Bitcoin</dt>
            <dd className="text-subhead font-medium tabular-nums text-content-primary">
              {fmtSats(btc)}{' '}
              <span className="text-caption font-normal text-content-tertiary">
                sats
              </span>
            </dd>
          </div>
          {assets.map((a) => (
            <div
              className="flex items-baseline justify-between"
              key={a.asset_id}
            >
              <dt className="text-caption text-content-secondary">
                {a.ticker}
              </dt>
              <dd className="text-subhead font-medium tabular-nums text-content-primary">
                {fmtUnits(a.spendable, a.precision)}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {onOpenFunds && (
        <div className="grid grid-cols-2 gap-2">
          <button
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-caption font-bold text-text-on-accent transition-opacity hover:opacity-90"
            onClick={() => onOpenFunds('toTrading')}
            type="button"
          >
            <ArrowDownToLine aria-hidden size={14} />
            {tr('wallet.deposit', 'Deposit')}
          </button>
          <button
            className="flex items-center justify-center gap-2 rounded-xl bg-surface-raised px-3 py-2 text-caption font-medium text-content-primary transition-colors hover:bg-surface-high disabled:opacity-40"
            disabled={empty}
            onClick={() => onOpenFunds('toNode')}
            type="button"
          >
            <ArrowUpFromLine aria-hidden size={14} />
            {tr('wallet.withdraw', 'Withdraw')}
          </button>
        </div>
      )}

      {(onManageCoins || onIssueAsset) && (
        <div className="flex items-center gap-4 text-caption">
          {onManageCoins && (
            <button
              className="text-content-secondary transition-colors hover:text-content-primary"
              onClick={onManageCoins}
              type="button"
            >
              {tr('wallet.coins', 'Manage coins')}
            </button>
          )}
          {onIssueAsset && (
            <button
              className="text-content-secondary transition-colors hover:text-content-primary"
              onClick={onIssueAsset}
              type="button"
            >
              {tr('wallet.issue', 'Issue an asset')}
            </button>
          )}
        </div>
      )}

      {empty && onRescan && (
        <button
          className="self-start text-caption text-content-tertiary transition-colors hover:text-content-secondary disabled:opacity-50"
          disabled={rescanning}
          onClick={() => void rescan()}
          title={tr(
            'wallet.rescanHelp',
            'Restarts the wallet and looks through every address for a deposit the quick check missed. It takes a little longer.'
          )}
          type="button"
        >
          {rescanning
            ? tr('wallet.rescanning', 'Scanning for deposits…')
            : tr(
                'wallet.rescan',
                'Sent bitcoin but nothing shows? Scan for it'
              )}
        </button>
      )}

      <div className="text-caption">
        <button
          aria-expanded={showAddress}
          className="text-content-tertiary transition-colors hover:text-content-secondary"
          onClick={() => setShowAddress((v) => !v)}
          type="button"
        >
          {showAddress
            ? tr('wallet.hideAddress', 'Hide address')
            : tr(
                'wallet.showAddress',
                'Or receive bitcoin from outside the app'
              )}
        </button>
        {showAddress && (
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-surface-inset px-3 py-2">
            <code
              className="min-w-0 flex-1 truncate text-tiny text-content-secondary"
              title={info.address}
            >
              {short(info.address, 12)}
            </code>
            <button
              aria-label={tr('wallet.copy', 'Copy address')}
              className="shrink-0 text-content-secondary hover:text-content-primary"
              onClick={() => void copy()}
              type="button"
            >
              <Copy aria-hidden size={14} />
            </button>
          </div>
        )}
      </div>
    </Panel>
  )
}
