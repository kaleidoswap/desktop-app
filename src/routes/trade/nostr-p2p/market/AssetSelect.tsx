import { AlertTriangle, BadgeCheck, ChevronDown, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'

import { Modal } from '../../../../components/ui'
import type { Balance } from '../api'
import { fmtPrice, fmtUnits, short } from '../format'
import { searchAssets, type SwapAsset } from '../swap'

import { useTr } from './hooks'

/** A round mark for an asset without a logo: its ticker's first letters on a colour from its id. */
export function AssetMark({
  asset,
  size = 32,
}: {
  asset: Pick<SwapAsset, 'assetId' | 'ticker'>
  size?: number
}) {
  let h = 0
  for (const c of asset.assetId) h = (h * 31 + c.charCodeAt(0)) % 360
  return (
    <span
      aria-hidden
      className="flex flex-none items-center justify-center rounded-full font-bold text-white"
      style={{
        background: `linear-gradient(135deg, hsl(${h} 70% 45%), hsl(${(h + 60) % 360} 70% 35%))`,
        fontSize: size * 0.34,
        height: size,
        width: size,
      }}
    >
      {asset.ticker.slice(0, 3)}
    </span>
  )
}

const Mark = ({ asset }: { asset: SwapAsset }) =>
  asset.imitates ? (
    <AlertTriangle className="h-4 w-4 text-status-danger" />
  ) : asset.listed ? (
    <BadgeCheck className="h-4 w-4 text-status-success" />
  ) : null

interface ButtonProps {
  asset?: SwapAsset
  label: string
  onClick: () => void
}

/** The asset next to an amount: its mark, ticker and badge. Opens the picker. */
function BitcoinMark() {
  return (
    <span
      aria-hidden
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F7931A] font-semibold text-white"
    >
      ₿
    </span>
  )
}

export function AssetButton({ asset, label, onClick }: ButtonProps) {
  return (
    <button
      aria-haspopup="dialog"
      aria-label={label + ' · ' + (asset?.ticker ?? 'BTC')}
      className="flex min-h-11 w-[clamp(6rem,40%,10rem)] shrink-0 items-center gap-1.5 rounded-full border border-divider/30 bg-surface-elevated py-1 pl-1 pr-3 text-content-primary transition-colors hover:border-primary/50"
      onClick={onClick}
      type="button"
    >
      {asset ? <AssetMark asset={asset} size={30} /> : <BitcoinMark />}
      <span className="min-w-0 flex-1 truncate text-left font-semibold">
        {asset?.ticker ?? 'BTC'}
      </span>
      {asset && <Mark asset={asset} />}
      <ChevronDown className="h-4 w-4 shrink-0 text-content-tertiary" />
    </button>
  )
}

interface Props {
  isOpen: boolean
  onClose: () => void
  assets: SwapAsset[]
  balance: Balance | undefined
  selected: string | null
  onSelect: (assetId: string | null) => void
  title: string
}

/**
 * Choosing what to trade: search by ticker, name or id, listed assets first, what the wallet holds
 * next, unlisted ones only on request and with a warning, since anyone can issue any name.
 */
export function AssetSelect({
  isOpen,
  onClose,
  assets,
  balance,
  selected,
  title,
  onSelect,
}: Props) {
  const tr = useTr()
  const [query, setQuery] = useState('')
  const [showUnlisted, setShowUnlisted] = useState(false)
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery('')
    setActive(0)
    setTimeout(() => input.current?.focus(), 50)
  }, [isOpen])

  const held = (id: string) =>
    balance?.assets.find((b) => b.asset_id === id && b.total > 0)
  const anyListed = assets.some((a) => a.listed)
  const searching = query.trim().length > 0
  const results = useMemo(() => searchAssets(assets, query), [assets, query])

  // searching looks everywhere; browsing keeps unlisted assets folded
  const sections = useMemo(() => {
    const listed = results.filter((a) => a.listed)
    const mine = results.filter((a) => !a.listed && held(a.assetId))
    const other = results.filter((a) => !a.listed && !held(a.assetId))
    return { listed, mine, other }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, balance])
  const otherShown = searching || showUnlisted || !anyListed
  const showBitcoin =
    !searching ||
    ['bitcoin', 'btc', 'sats'].some((s) =>
      s.includes(query.trim().toLowerCase())
    )
  const flat = [
    ...(showBitcoin ? [null] : []),
    ...sections.listed,
    ...sections.mine,
    ...(otherShown ? sections.other : []),
  ]

  const pick = (id: string | null) => {
    onSelect(id)
    onClose()
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(flat.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const a = flat[active]
      if (a !== undefined) pick(a?.assetId ?? null)
    }
  }

  const row = (a: SwapAsset) => {
    const i = flat.indexOf(a)
    const h = held(a.assetId)
    return (
      <li key={a.assetId}>
        <button
          aria-current={a.assetId === selected}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
            i === active ? 'bg-surface-overlay/60' : ''
          } ${a.assetId === selected ? 'ring-1 ring-primary/40' : ''}`}
          onClick={() => pick(a.assetId)}
          onMouseEnter={() => setActive(i)}
          type="button"
        >
          <AssetMark asset={a} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-1.5 font-semibold text-content-primary">
              {a.ticker}
              <Mark asset={a} />
            </span>
            <span className="truncate text-xs text-content-tertiary">
              {a.name ?? ''} ·{' '}
              <span className="font-mono">{short(a.assetId, 6)}</span>
            </span>
            {a.imitates && (
              <span className="text-xs text-status-danger">
                {tr('swap.imitationShort', 'Copies the ticker of {{name}}', {
                  name: a.imitates,
                })}
              </span>
            )}
          </span>
          <span className="flex flex-col items-end text-xs">
            {h && (
              <span className="font-medium text-content-primary">
                {fmtUnits(h.total, h.precision)}
              </span>
            )}
            {a.bestAsk !== null ? (
              <span className="text-content-secondary">
                {tr('swap.from', 'from {{price}} sats', {
                  price: fmtPrice(a.bestAsk),
                })}
              </span>
            ) : a.bestBid !== null ? (
              <span className="text-content-secondary">
                {tr('swap.bidAt', 'bid {{price}} sats', {
                  price: fmtPrice(a.bestBid),
                })}
              </span>
            ) : null}
            {a.offers > 0 && (
              <span className="text-content-tertiary">
                {tr('swap.offers', '{{count}} offers', { count: a.offers })}
              </span>
            )}
          </span>
        </button>
      </li>
    )
  }

  const heading = (text: string) => (
    <li className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider text-content-tertiary">
      {text}
    </li>
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" title={title} viewport>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2 rounded-xl border border-divider/30 bg-surface-base px-3 focus-within:border-primary/60">
          <Search className="h-4 w-4 text-content-tertiary" />
          <input
            aria-label={tr('swap.search', 'Ticker, name or ID')}
            className="min-h-11 min-w-0 flex-1 bg-transparent text-sm text-content-primary outline-none placeholder:text-content-tertiary"
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKey}
            placeholder={tr(
              'swap.searchLong',
              'Search by ticker, name, or paste an asset ID'
            )}
            ref={input}
            spellCheck={false}
            value={query}
          />
          {query && (
            <button
              aria-label={tr('swap.clear', 'Clear')}
              className="text-content-tertiary hover:text-content-primary"
              onClick={() => setQuery('')}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <ul className="-mx-1 flex max-h-[26rem] flex-col overflow-y-auto">
          {showBitcoin && (
            <li>
              <button
                aria-current={selected === null}
                className={
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-content-primary ' +
                  (active === 0 ? 'bg-surface-overlay/60' : '')
                }
                onClick={() => pick(null)}
                onMouseEnter={() => setActive(0)}
                type="button"
              >
                <BitcoinMark />
                Bitcoin · BTC
              </button>
            </li>
          )}
          {sections.listed.length > 0 &&
            heading(tr('swap.sectionListed', 'Listed by KaleidoSwap'))}
          {sections.listed.map(row)}
          {sections.mine.length > 0 &&
            heading(tr('swap.sectionMine', 'In your wallet'))}
          {sections.mine.map(row)}
          {sections.other.length > 0 &&
            (otherShown ? (
              <>
                {heading(
                  anyListed
                    ? tr('swap.sectionUnlisted', 'Not listed')
                    : tr('swap.sectionAll', 'On the market')
                )}
                {anyListed && (
                  <li className="mx-3 mb-1 rounded-lg bg-status-warning/10 px-3 py-2 text-xs text-status-warning">
                    {tr(
                      'swap.unlisted',
                      'Not listed. Anyone can issue an asset with any name: check the asset ID.'
                    )}
                  </li>
                )}
                {sections.other.map(row)}
              </>
            ) : (
              <li>
                <button
                  className="mx-3 my-2 text-sm font-medium text-primary hover:underline"
                  onClick={() => setShowUnlisted(true)}
                  type="button"
                >
                  {tr(
                    'swap.showUnlistedCount',
                    'Show {{count}} unlisted assets',
                    {
                      count: sections.other.length,
                    }
                  )}
                </button>
              </li>
            ))}
          {flat.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-content-tertiary">
              {tr('swap.noMatch', 'No asset matches')}
            </li>
          )}
        </ul>
      </div>
    </Modal>
  )
}
