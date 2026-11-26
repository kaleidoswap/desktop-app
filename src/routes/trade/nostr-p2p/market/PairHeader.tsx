import { Button, cardSurface } from 'kaleido-ui'
import {
  ChevronDown,
  RadioTower,
  Settings2,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'

import { useState } from 'react'

import { AssetMark } from './AssetSelect'
import { Picker } from './Picker'
import type { Info, RegistryNote } from '../api'
import { ORIGINAL_WALLET_LABEL } from '../wallets'
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
  onManageRelays?: () => void
  bestBid?: number
  bestAsk?: number
  last?: number
  open: number
  info: Info
  /** What the registry lists for this market's asset, when the daemon reads one. */
  registry?: RegistryNote | null
  /** The trading wallet that is open, so two wallets on one computer are easy to tell apart. */
  walletLabel?: string
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
  onManageRelays,
  bestBid,
  bestAsk,
  last,
  open,
  info,
  registry,
  walletLabel,
}: Props) {
  const tr = useTr()
  const [showRelays, setShowRelays] = useState(false)
  const relayUrls = info.relays ?? []
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
    <header className={cx(cardSurface.primary, 'relative z-10')}>
      <div className="flex min-h-24 flex-wrap items-center gap-x-4 gap-y-2 rounded-t-2xl bg-gradient-card-hero px-5 py-4">
        {market && (
          <span
            aria-hidden
            className="relative flex shrink-0 items-center pr-5"
          >
            <span className="absolute -right-0.5 top-1/2 grid h-8 w-8 -translate-y-1/3 place-items-center rounded-full bg-card text-base font-bold text-warning-fg shadow-raised">
              ₿
            </span>
            <span className="relative z-[1]">
              <AssetMark
                asset={{ assetId: market.asset_id, ticker: market.ticker }}
                size={38}
              />
            </span>
          </span>
        )}
        <div className="relative min-w-0">
          <p className="mb-0.5 text-tiny font-semibold uppercase tracking-wide text-secondary-content">
            {tr('offers.nostrDiscovery', 'Offers via Nostr')}
          </p>
          <Picker
            emptyText={tr('header.noMarkets', 'No markets yet')}
            label={tr('header.market', 'Market')}
            onChange={onSelect}
            options={markets.map((m) => ({
              keywords: m.asset_id,
              leading: (
                <AssetMark
                  asset={{ assetId: m.asset_id, ticker: m.ticker }}
                  size={24}
                />
              ),
              title: `${m.ticker} / BTC`,
              value: m.asset_id,
            }))}
            searchFrom={6}
            searchPlaceholder={tr('header.search', 'Ticker or asset ID')}
            value={selected ?? ''}
            variant="market"
          />
        </div>
        <div className="relative ml-auto flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          {info.network === 'signetcustom' && (
            <div className="hidden text-right text-caption text-muted-foreground lg:block">
              {tr('offers.sharedWith', 'Market shared with')}
              <strong className="block text-body text-foreground">
                Mosaik
              </strong>
            </div>
          )}
          <Button
            aria-expanded={showRelays}
            onClick={() => setShowRelays(!showRelays)}
            size="sm"
            type="button"
            variant="surface"
          >
            <RadioTower aria-hidden size={15} />
            {tr('offers.nostrRelays', 'Nostr relays ({{n}})', {
              n: relayUrls.length,
            })}
            <ChevronDown aria-hidden size={13} />
          </Button>
        </div>
      </div>
      {showRelays && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-divider/20 px-5 py-4">
          <div className="min-w-0">
            <h2 className="mb-1.5 text-sm font-semibold text-content-primary">
              {tr('offers.configuredRelays', 'Configured relays')}
            </h2>
            <ul className="space-y-1 font-mono text-caption text-content-secondary">
              {relayUrls.map((url) => (
                <li className="break-all" key={url}>
                  {url}
                </li>
              ))}
            </ul>
          </div>
          {onManageRelays && (
            <Button
              onClick={onManageRelays}
              size="sm"
              type="button"
              variant="outline"
            >
              <Settings2 aria-hidden size={14} />
              {tr('offers.manageRelays', 'Manage relays')}
            </Button>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
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
            <p
              className="truncate font-mono text-tiny text-content-tertiary"
              title={market.asset_id}
            >
              {short(market.asset_id, 10)}
            </p>
          )}
        </div>

        {market && (
          <dl className="grid flex-1 grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-4">
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

        <div className="flex flex-wrap items-center gap-3 lg:ml-auto">
          <Pill tone={info.network === 'mainnet' ? 'success' : 'warning'}>
            {networkLabel(info.network)}
          </Pill>
          <span className="text-tiny text-content-tertiary" title={info.npub}>
            {walletLabel === ORIGINAL_WALLET_LABEL ||
            (!walletLabel && info.name.startsWith('wallet-'))
              ? tr('header.yourWallet', 'Your wallet')
              : (walletLabel ?? info.name)}{' '}
            · {short(info.npub, 6)}
          </span>
        </div>
      </div>
    </header>
  )
}
