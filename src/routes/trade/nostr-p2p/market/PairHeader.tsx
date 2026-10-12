import { ShieldAlert, ShieldCheck, Wallet } from 'lucide-react'

import type { Info } from '../api'
import { fmtPrice, fmtSats, short } from '../format'

import { useTr } from './hooks'
import { Pill, cx } from './ui'

export interface MarketInfo {
  asset_id: string
  ticker: string
  precision: number
  orders: number
  verified: boolean
  impersonates: string | null
}

interface Props {
  markets: MarketInfo[]
  selected: string | null
  onSelect: (id: string) => void
  bestBid?: number
  bestAsk?: number
  last?: number
  open: number
  btc: number
  info: Info
  onOpenFunds?: () => void
}

const Stat = ({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: string
}) => (
  <div className="flex flex-col">
    <dt className="text-tiny text-content-tertiary">{label}</dt>
    <dd
      className={cx(
        'text-body font-medium tabular-nums',
        tone ?? 'text-content-primary'
      )}
    >
      {value}
    </dd>
  </div>
)

export function PairHeader({
  markets,
  selected,
  onSelect,
  bestBid,
  bestAsk,
  last,
  open,
  btc,
  info,
  onOpenFunds,
}: Props) {
  const tr = useTr()
  const market = markets.find((m) => m.asset_id === selected)
  const flag = market?.impersonates
    ? {
        icon: ShieldAlert,
        text: tr('header.imitation', 'Possible imitation of {{name}}', {
          name: market.impersonates,
        }),
        tone: 'danger' as const,
      }
    : market?.verified
      ? {
          icon: ShieldCheck,
          text: tr('header.verified', 'Verified asset'),
          tone: 'success' as const,
        }
      : market
        ? {
            icon: ShieldAlert,
            text: tr('header.unverified', 'Unverified asset'),
            tone: 'warning' as const,
          }
        : null

  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl bg-surface-card/70 px-4 py-3">
      <div className="flex items-center gap-3">
        <label className="sr-only" htmlFor="p2p-market">
          {tr('header.market', 'Market')}
        </label>
        <select
          className="rounded-xl bg-surface-inset px-3 py-2 text-subhead font-medium text-content-primary outline-none focus:ring-2 focus:ring-primary/40"
          disabled={!markets.length}
          id="p2p-market"
          onChange={(e) => onSelect(e.target.value)}
          value={selected ?? ''}
        >
          {markets.length === 0 && (
            <option>{tr('header.noMarkets', 'No markets yet')}</option>
          )}
          {markets.map((m) => (
            <option key={m.asset_id} value={m.asset_id}>
              {m.ticker} / BTC
            </option>
          ))}
        </select>
        {flag && (
          <span title={market?.asset_id}>
            <Pill tone={flag.tone}>
              <flag.icon aria-hidden size={12} /> {flag.text}
            </Pill>
          </span>
        )}
      </div>

      {market && (
        <dl className="flex flex-wrap gap-x-6 gap-y-2">
          <Stat
            label={tr('header.bestBuy', 'Best buy')}
            tone="text-status-success"
            value={bestBid !== undefined ? fmtPrice(bestBid) : '–'}
          />
          <Stat
            label={tr('header.bestSell', 'Best sell')}
            tone="text-status-danger"
            value={bestAsk !== undefined ? fmtPrice(bestAsk) : '–'}
          />
          <Stat
            label={tr('header.last', 'Last trade')}
            value={last !== undefined ? fmtPrice(last) : '–'}
          />
          <Stat
            label={tr('header.openOrders', 'Open orders')}
            value={String(open)}
          />
        </dl>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-3">
        <div
          className="flex items-baseline gap-1.5 rounded-xl bg-surface-inset px-3 py-2"
          title={tr(
            'header.spendable',
            'Spendable bitcoin in the trading wallet'
          )}
        >
          <span className="text-tiny text-content-tertiary">BTC</span>
          <strong className="text-body tabular-nums text-content-primary">
            {fmtSats(btc)}
          </strong>
          <span className="text-tiny text-content-tertiary">sats</span>
        </div>
        {onOpenFunds && (
          <button
            className="flex items-center gap-2 rounded-xl bg-surface-raised px-3 py-2 text-caption font-medium text-content-primary transition-colors hover:bg-surface-high"
            onClick={onOpenFunds}
            type="button"
          >
            <Wallet aria-hidden size={14} /> {tr('header.funds', 'Funds')}
          </button>
        )}
        <Pill tone={info.network === 'mainnet' ? 'success' : 'warning'}>
          {info.network}
        </Pill>
        <span className="text-tiny text-content-tertiary" title={info.npub}>
          {info.name} · {short(info.npub, 5)}
        </span>
      </div>
    </header>
  )
}
