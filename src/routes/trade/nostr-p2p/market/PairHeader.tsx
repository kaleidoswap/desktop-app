import { ShieldAlert, ShieldCheck } from 'lucide-react'

import type { RegistryNote } from '../api'
import { fmtPrice, short } from '../format'
import { AssetMark } from './AssetSelect'
import { useTr } from './hooks'
import { Picker } from './Picker'
import { Pill } from './ui'

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
  registry?: RegistryNote | null
}

export function PairHeader({ markets, selected, onSelect, registry }: Props) {
  const tr = useTr()
  const market = markets.find((item) => item.asset_id === selected)
  if (!market) return null

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
      <AssetMark
        asset={{ assetId: market.asset_id, ticker: market.ticker }}
        size={28}
      />
      <Picker
        className="min-w-0 max-w-full"
        label={tr('header.market', 'Market')}
        onChange={onSelect}
        options={markets.map((item) => ({
          keywords: item.asset_id,
          leading: (
            <AssetMark
              asset={{ assetId: item.asset_id, ticker: item.ticker }}
              size={24}
            />
          ),
          subtitle: short(item.asset_id, 8),
          title: `${item.ticker} / BTC`,
          value: item.asset_id,
        }))}
        searchFrom={6}
        searchPlaceholder={tr('header.search', 'Ticker or asset ID')}
        value={market.asset_id}
        variant="market"
      />
      <span title={market.asset_id}>
        {market.impersonates ? (
          <Pill tone="danger">
            <ShieldAlert aria-hidden size={13} />
            {tr('header.imitation', 'Possible imitation of {{name}}', {
              name: market.impersonates,
            })}
          </Pill>
        ) : market.verified ? (
          <Pill tone="success">
            <ShieldCheck aria-hidden size={13} />
            {tr('header.verified', 'Verified asset')}
          </Pill>
        ) : (
          <Pill tone="warning">
            <ShieldAlert aria-hidden size={13} />
            {tr('header.unverified', 'Unverified asset')}
          </Pill>
        )}
      </span>
      {registry?.ticker_differs ? (
        <Pill tone="warning">
          {tr('header.regDiffers', 'Registry lists it as {{ticker}}', {
            ticker: registry.ticker_differs,
          })}
        </Pill>
      ) : registry && registry.same_ticker_listed > 0 ? (
        <Pill tone="warning">
          {tr('header.regSame', 'Same ticker elsewhere: {{n}}', {
            n: registry.same_ticker_listed,
          })}
        </Pill>
      ) : null}
    </div>
  )
}

export function MarketStats({
  bestBid,
  bestAsk,
  last,
  open,
}: {
  bestBid?: number
  bestAsk?: number
  last?: number
  open: number
}) {
  const tr = useTr()
  const rows = [
    [
      tr('header.bestBuy', 'Best buy'),
      bestBid === undefined ? '–' : `${fmtPrice(bestBid)} sat`,
    ],
    [
      tr('header.bestSell', 'Best sell'),
      bestAsk === undefined ? '–' : `${fmtPrice(bestAsk)} sat`,
    ],
    [
      tr('header.lastOwn', 'Your last trade'),
      last === undefined ? '–' : `${fmtPrice(last)} sat`,
    ],
    [tr('header.openOrders', 'Open orders'), String(open)],
  ]
  return (
    <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:col-span-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-caption text-content-secondary">{label}</dt>
          <dd className="font-semibold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
