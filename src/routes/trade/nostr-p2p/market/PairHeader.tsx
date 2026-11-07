import { ShieldAlert, ShieldCheck } from 'lucide-react'

import type { Info, RegistryNote } from '../api'
import { fmtPrice, networkLabel, short } from '../format'

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
  info: Info
  /** What the registry lists for this market's asset, when the daemon reads one. */
  registry?: RegistryNote | null
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
  info,
  registry,
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

  // one extra signal from the registry, the one that matters most
  const registryFlag = !registry
    ? null
    : registry.ticker_differs
      ? {
          text: tr('header.regDiffers', 'Registry lists it as {{ticker}}', {
            ticker: registry.ticker_differs,
          }),
          tone: 'warning' as const,
        }
      : registry.same_ticker_listed > 0
        ? {
            text: tr('header.regSame', 'Same ticker elsewhere: {{n}}', {
              n: registry.same_ticker_listed,
            }),
            tone: 'warning' as const,
          }
        : registry.listed
          ? {
              text: tr('header.regListed', 'In the registry'),
              tone: 'muted' as const,
            }
          : {
              text: tr('header.regNot', 'Not in the registry'),
              tone: 'muted' as const,
            }

  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl bg-surface-card/70 px-4 py-2.5">
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
        {registryFlag && (
          <Pill tone={registryFlag.tone}>{registryFlag.text}</Pill>
        )}
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
        <Pill tone={info.network === 'mainnet' ? 'success' : 'warning'}>
          {networkLabel(info.network)}
        </Pill>
        <span
          className="text-tiny text-content-tertiary"
          title={`${info.name} · ${info.npub}`}
        >
          {info.name.startsWith('wallet-')
            ? tr('header.yourWallet', 'Your wallet')
            : info.name}{' '}
          · {short(info.npub, 5)}
        </span>
      </div>
    </header>
  )
}
