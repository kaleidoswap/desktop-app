import { ArrowDownToLine, ArrowUpFromLine, Copy } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'react-toastify'

import type { Balance, Info } from '../api'
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
}

/**
 * What the trading wallet holds and the way to put more in. The wallet is separate from the node:
 * only what is moved here can be traded, so this is the first thing a new user needs.
 */
export function WalletCard({ balance, info, node, onOpenFunds }: Props) {
  const tr = useTr()
  const [showAddress, setShowAddress] = useState(false)
  const btc = balance?.btc_spendable_sat ?? 0
  const assets = (balance?.assets ?? []).filter((a) => a.total > 0)
  const empty = btc === 0 && assets.length === 0

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
        <span
          className="text-tiny text-content-tertiary"
          title={tr(
            'wallet.explain',
            'A separate wallet for the market. Only what you move here can be traded; your node keeps the rest.'
          )}
        >
          {tr('wallet.separate', 'separate from your node')}
        </span>
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
            'Empty. Move bitcoin (and any RGB asset you want to sell) here from your node to start trading.'
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
