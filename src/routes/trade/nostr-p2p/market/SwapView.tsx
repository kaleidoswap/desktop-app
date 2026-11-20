import {
  AlertTriangle,
  ArrowDownUp,
  BadgeCheck,
  ChevronDown,
  Info,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { SwapInputField } from '../../../../components/Trade/SwapInputField'
import { openGuide } from '../../../p2p-home/P2pGuide'
import { marketApi, type Order, type Side } from '../api'
import { fmtPrice, fmtSats, fmtUnits, short, toBase } from '../format'
import {
  baseForSats,
  pickableAssets,
  quoteSwapBase,
  swapAssets,
  type SwapProblem,
} from '../swap'

import { AssetButton, AssetSelect } from './AssetSelect'
import { MakerList, type MakerShare } from './MakerList'
import { useTr, usePoll } from './hooks'
import { TakeSheet } from './TakeSheet'

type Editing = 'asset' | 'btc'

/** A base-unit amount as an input shows it: plain digits, no grouping. */
const plain = (base: number, precision: number) =>
  precision === 0 ? String(base) : String(base / 10 ** precision)

/** Keep only what an amount can be: digits and one decimal point. */
const cleanAmount = (s: string) => {
  const t = s.replace(',', '.').replace(/[^\d.]/g, '')
  const [i, ...rest] = t.split('.')
  return rest.length ? `${i}.${rest.join('')}` : i
}

/**
 * The market as a swap: say what you pay or what you get, in either field, see the price the book
 * gives and who fills it, then review. Nothing is signed before the review.
 */
export function SwapView() {
  const tr = useTr()
  const info = usePoll(marketApi.info, 30_000)
  const balance = usePoll(marketApi.balance, 4_000)
  const book = usePoll(marketApi.book, 2_500)
  const trades = usePoll(marketApi.trades, 2_000)

  const assets = useMemo(
    () => swapAssets(book.data ?? [], balance.data),
    [book.data, balance.data]
  )
  const [choosing, setChoosing] = useState(false)
  const [assetId, setAssetId] = useState<string | null>(null)
  const asset =
    assets.find((a) => a.assetId === assetId) ??
    pickableAssets(assets, false)[0]
  const [side, setSide] = useState<Side>('buy')
  const [editing, setEditing] = useState<Editing>('asset')
  const [assetText, setAssetText] = useState('')
  const [btcText, setBtcText] = useState('')
  const [pct, setPct] = useState<number | undefined>()
  const [showMakers, setShowMakers] = useState(false)
  const [taking, setTaking] = useState<Order[] | null>(null)

  const btcReady =
    balance.data?.btc_settled_sat ?? balance.data?.btc_spendable_sat ?? 0
  const held = balance.data?.assets.find((a) => a.asset_id === asset?.assetId)
  const assetHeld = held?.spendable ?? 0

  const wantBase = useMemo(() => {
    if (!asset) return 0
    return editing === 'asset'
      ? toBase(assetText, asset.precision)
      : baseForSats(book.data ?? [], asset, side, Number(btcText) || 0)
  }, [asset, editing, assetText, btcText, book.data, side])

  const quote = useMemo(
    () =>
      asset
        ? quoteSwapBase(book.data ?? [], asset, side, wantBase, balance.data)
        : null,
    [asset, book.data, side, wantBase, balance.data]
  )

  if (!book.data || !balance.data) {
    return (
      <p className="py-16 text-center text-content-secondary">
        {tr('swap.loading', 'Reading the order book…')}
      </p>
    )
  }
  if (!asset || !quote) {
    return (
      <div className="mx-auto max-w-md py-16 text-center text-content-secondary">
        {tr(
          'swap.empty',
          'No offers on your relays right now. Check back soon, or post one from the order book.'
        )}
      </div>
    )
  }

  const est = quote.estimate
  const priced = est.picks.length > 0
  const btcShown =
    editing === 'btc'
      ? btcText
      : priced
        ? String(side === 'buy' ? est.reserveSat : est.sats)
        : ''
  const assetShown =
    editing === 'asset'
      ? assetText
      : priced
        ? plain(est.baseAmount, asset.precision)
        : ''

  const reset = () => {
    setAssetText('')
    setBtcText('')
    setPct(undefined)
  }

  const onPct = (p: number) => {
    setPct(p)
    if (side === 'buy') {
      setEditing('btc')
      setBtcText(String(Math.floor((btcReady * p) / 100)))
    } else {
      setEditing('asset')
      setAssetText(plain(Math.floor((assetHeld * p) / 100), asset.precision))
    }
  }

  const problem: SwapProblem = quote.problem
  const canReview =
    quote.plan.picks.length > 0 && (problem === null || problem === 'partial')

  const button: Record<NonNullable<SwapProblem> | 'ok', string> = {
    no_amount: tr('swap.enterAmount', 'Enter an amount'),
    no_free_coin: tr('swap.prepareCoins', 'Prepare your coins first'),
    no_offers:
      side === 'buy'
        ? tr('swap.noSellersShort', 'Nobody is selling')
        : tr('swap.noBuyersShort', 'Nobody is buying'),
    not_enough_asset: tr('swap.notEnoughAsset', 'Not enough {{ticker}}', {
      ticker: asset.ticker,
    }),
    not_enough_btc: tr('swap.notEnoughBtc', 'Not enough bitcoin'),
    ok: tr('swap.review', 'Review swap'),
    partial: tr('swap.review', 'Review swap'),
    too_small: tr('swap.amountTooSmall', 'Amount too small'),
  }

  const message = (): { tone: 'info' | 'warn'; text: string } | null => {
    switch (problem) {
      case 'no_offers':
        return {
          text:
            side === 'buy'
              ? tr('swap.noSellers', 'Nobody is selling this asset right now.')
              : tr('swap.noBuyers', 'Nobody is buying this asset right now.'),
          tone: 'info',
        }
      case 'too_small':
        return {
          text: est.nextFit
            ? tr(
                'swap.tooSmall',
                'Offers fill whole: the smallest one that fits is {{amount}}.',
                {
                  amount: fmtUnits(est.nextFit.amount, est.nextFit.precision),
                }
              )
            : tr('swap.noFit', 'No offer fits this amount.'),
          tone: 'info',
        }
      case 'not_enough_btc':
        return {
          text: tr(
            'swap.needBtc',
            'Not enough bitcoin: this swap sets aside {{need}} sats, you have {{have}}.',
            { have: fmtSats(btcReady), need: fmtSats(est.reserveSat) }
          ),
          tone: 'warn',
        }
      case 'not_enough_asset':
        return {
          text: tr('swap.youHave', 'You have {{amount}} {{ticker}}', {
            amount: fmtUnits(assetHeld, asset.precision),
            ticker: asset.ticker,
          }),
          tone: 'warn',
        }
      case 'no_free_coin':
        return {
          text: tr(
            'swap.noCoin',
            'Each swap needs a free bitcoin coin big enough to pay for it. Deposit more, or split your coins.'
          ),
          tone: 'warn',
        }
      case 'partial':
        return {
          text: tr(
            'swap.partial',
            'Offers fill whole, so this swap gets {{amount}} of what you asked.',
            { amount: fmtUnits(est.baseAmount, asset.precision) }
          ),
          tone: 'info',
        }
      default:
        return null
    }
  }
  const note = message()

  const byMaker = new Map<string, MakerShare>()
  for (const o of est.picks) {
    const m = byMaker.get(o.maker) ?? {
      amount: 0,
      away: o.away,
      maker: o.maker,
      npub: o.maker_npub,
    }
    m.amount += o.amount
    m.away = m.away && o.away
    byMaker.set(o.maker, m)
  }

  const btcChip = (
    <span className="flex h-12 items-center gap-2 rounded-full border border-divider/30 bg-surface-elevated px-3 font-semibold text-content-primary">
      <span
        aria-hidden
        className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F7931A] text-xs font-bold text-white"
      >
        ₿
      </span>
      sats
    </span>
  )
  const assetChip = (
    <AssetButton asset={asset} onClick={() => setChoosing(true)} />
  )

  const btcField = (label: string, pays: boolean) => (
    <SwapInputField
      asset="BTC"
      assetOptions={[]}
      assetSlot={btcChip}
      availableAmount={pays ? `${fmtSats(btcReady)} sats` : undefined}
      disabled={false}
      formatAmount={(n) => fmtSats(n)}
      getDisplayAsset={() => 'sats'}
      label={label}
      onAmountChange={(e) => {
        setEditing('btc')
        setPct(undefined)
        setBtcText(cleanAmount(e.target.value).split('.')[0])
      }}
      onAssetChange={() => undefined}
      onSizeClick={pays ? onPct : undefined}
      selectedSize={pct}
      showSizeButtons={pays && btcReady > 0}
      value={btcShown}
    />
  )
  const assetField = (label: string, pays: boolean) => (
    <SwapInputField
      asset={asset.assetId}
      assetOptions={[]}
      assetSlot={assetChip}
      availableAmount={
        pays || assetHeld > 0
          ? `${fmtUnits(assetHeld, asset.precision)} ${asset.ticker}`
          : undefined
      }
      disabled={false}
      formatAmount={(n) => fmtUnits(n, asset.precision)}
      getDisplayAsset={() => asset.ticker}
      label={label}
      onAmountChange={(e) => {
        setEditing('asset')
        setPct(undefined)
        setAssetText(cleanAmount(e.target.value))
      }}
      onAssetChange={() => undefined}
      onSizeClick={pays ? onPct : undefined}
      selectedSize={pct}
      showSizeButtons={pays && assetHeld > 0}
      value={assetShown}
    />
  )

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <section
        aria-label={tr('swap.title', 'Swap')}
        className="flex flex-col gap-2 rounded-2xl border border-divider/10 bg-surface-elevated/40 p-4 sm:p-5"
      >
        {side === 'buy'
          ? btcField(tr('swap.youPay', 'You pay'), true)
          : assetField(tr('swap.youPay', 'You pay'), true)}

        <div className="relative z-10 -my-4 flex justify-center">
          <button
            aria-label={tr('swap.flip', 'Switch direction')}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-divider/30 bg-surface-base text-content-secondary shadow-lg transition-colors hover:text-primary"
            onClick={() => {
              setSide(side === 'buy' ? 'sell' : 'buy')
              setEditing('asset')
              reset()
            }}
            type="button"
          >
            <ArrowDownUp className="h-4 w-4" />
          </button>
        </div>

        {side === 'buy'
          ? assetField(tr('swap.youGet', 'You get'), false)
          : btcField(tr('swap.youGet', 'You get'), false)}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs">
          {asset.imitates ? (
            <span className="flex items-center gap-1 text-status-danger">
              <AlertTriangle className="h-3.5 w-3.5" />
              {tr(
                'swap.imitation',
                'Uses the ticker of the listed {{name}}: very likely an imitation.',
                { name: asset.imitates }
              )}
            </span>
          ) : asset.listed ? (
            <span className="flex items-center gap-1 text-status-success">
              <BadgeCheck className="h-3.5 w-3.5" />
              {tr('swap.listed', 'Listed by KaleidoSwap')}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-content-tertiary">
              <Info className="h-3.5 w-3.5" />
              {tr(
                'swap.unlisted',
                'Not listed. Anyone can issue an asset with any name: check the asset ID.'
              )}
            </span>
          )}
          <span className="ml-auto font-mono text-content-tertiary">
            {short(asset.assetId, 8)}
          </span>
        </div>

        {priced && (
          <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-surface-base/60 px-4 py-3 text-sm">
            <dt className="text-content-tertiary">
              {tr('swap.price', 'Price')}
            </dt>
            <dd className="text-right text-content-primary">
              {fmtPrice(est.avgPrice)}{' '}
              {tr('swap.perUnit', 'sats per {{ticker}}', {
                ticker: asset.ticker,
              })}
            </dd>
            <dt className="text-content-tertiary">
              {tr('swap.filledBy', 'Filled by')}
            </dt>
            <dd className="text-right">
              <button
                className="inline-flex items-center gap-1 text-content-primary hover:text-primary"
                onClick={() => setShowMakers(!showMakers)}
                type="button"
              >
                {tr('swap.makers', '{{count}} makers', {
                  count: quote.makers,
                })}
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${showMakers ? 'rotate-180' : ''}`}
                />
              </button>
            </dd>
            {showMakers && (
              <MakerList
                makers={[...byMaker.values()]}
                precision={asset.precision}
                ticker={asset.ticker}
              />
            )}
            <dt className="text-content-tertiary">{tr('swap.fees', 'Fees')}</dt>
            <dd className="text-right text-content-primary">
              {fmtSats(est.fees)} sats
            </dd>
            {side === 'buy' && (
              <>
                <dt className="font-medium text-content-primary">
                  {tr('swap.setAside', 'Set aside from your bitcoin')}
                </dt>
                <dd className="text-right font-semibold text-content-primary">
                  {fmtSats(est.reserveSat)} sats
                </dd>
              </>
            )}
          </dl>
        )}

        {note && (
          <p
            className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${
              note.tone === 'warn'
                ? 'bg-status-warning/10 text-status-warning'
                : 'bg-surface-base/60 text-content-secondary'
            }`}
          >
            <Info className="mt-0.5 h-4 w-4 flex-none" />
            {note.text}
          </p>
        )}

        <button
          className={`mt-1 min-h-12 rounded-xl text-base font-bold transition-colors ${
            canReview && info.data
              ? 'bg-primary text-surface-base hover:opacity-90'
              : 'cursor-not-allowed bg-surface-base text-content-tertiary'
          }`}
          disabled={!canReview || !info.data}
          onClick={() => setTaking(quote.plan.picks)}
          type="button"
        >
          {button[problem ?? 'ok']}
        </button>
        <p className="text-center text-xs text-content-tertiary">
          {tr(
            'swap.nothingSigned',
            'Nothing is signed until you confirm the exact amounts.'
          )}
        </p>
      </section>

      <button
        className="self-center text-sm font-medium text-primary hover:underline"
        onClick={() => openGuide('swap')}
        type="button"
      >
        {tr('swap.howItWorks', 'How does a P2P swap work?')}
      </button>
      <p className="px-2 text-center text-xs leading-relaxed text-content-tertiary">
        {tr(
          'swap.howItSettles',
          'Each maker settles with you in its own Bitcoin transaction, with both sides in it: you get the asset, or your bitcoin never leaves.'
        )}
      </p>

      <AssetSelect
        assets={assets}
        balance={balance.data}
        isOpen={choosing}
        onClose={() => setChoosing(false)}
        onSelect={(id) => {
          setAssetId(id)
          reset()
        }}
        selected={asset.assetId}
      />

      {taking && info.data && (
        <TakeSheet
          book={(book.data ?? []).filter((o) => o.asset_id === asset.assetId)}
          info={info.data}
          onChanged={() => {
            balance.refresh()
            book.refresh()
            trades.refresh()
          }}
          onClose={() => {
            setTaking(null)
            reset()
            balance.refresh()
            book.refresh()
          }}
          onSwitch={(o) => setTaking([o])}
          orders={taking}
          trades={trades.data ?? []}
        />
      )}
    </div>
  )
}
