import { Button, PageHeader } from 'kaleido-ui'
import {
  AlertTriangle,
  ArrowDownUp,
  ArrowLeft,
  BadgeCheck,
  ChevronDown,
  Info,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { openGuide } from '../../../p2p-home/P2pGuide'
import { NostrParticipants } from '../NostrParticipants'
import { NostrProfilesMenu } from '../NostrProfilesMenu'
import {
  availableSats,
  marketApi,
  type Info as MarketInfo,
  type Order,
  type Side,
} from '../api'
import { fmtPrice, fmtSats, fmtUnits, short } from '../format'
import {
  parseSwapInput,
  plainSwapAmount,
  type SwapAsset,
  pickableAssets,
  quoteSwapAmount,
  swapAssets,
  type SwapProblem,
} from '../swap'

import { AssetButton, AssetSelect } from './AssetSelect'
import { MakerList, type MakerShare } from './MakerList'
import { useTr, usePoll } from './hooks'
import { TakeSheet } from './TakeSheet'

type Editing = 'asset' | 'btc'

/**
 * The market as a swap: say what you pay or what you get, in either field, see the price the book
 * gives and who fills it, then review. Nothing is signed before the review.
 */
export function SwapView({ onShowOffers }: { onShowOffers?: () => void }) {
  const [session, setSession] = useState(0)
  return (
    <SwapSession
      key={session}
      onProfileSwitched={() => setSession((key) => key + 1)}
      onShowOffers={onShowOffers}
    />
  )
}

function SwapSession({
  onShowOffers,
  onProfileSwitched,
}: {
  onShowOffers?: () => void
  onProfileSwitched: () => void
}) {
  const { t } = useTranslation()
  const info = usePoll(marketApi.info, 30_000)
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <PageHeader
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {info.data && (
              <NostrProfilesMenu
                npub={info.data.npub}
                onSwitched={onProfileSwitched}
              />
            )}
            {onShowOffers && (
              <Button
                onClick={onShowOffers}
                size="sm"
                type="button"
                variant="surface"
              >
                <ArrowLeft aria-hidden size={16} />
                {t('p2pMarket.market.offers.available')}
              </Button>
            )}
          </div>
        }
        title={t('p2pTrade.simpleSwap', { defaultValue: 'Simple swap' })}
        variant="page"
      />
      {info.data ? (
        <SwapForm info={info.data} key={info.data.npub} />
      ) : (
        <p className="py-16 text-center text-content-secondary">
          {info.error ?? t('p2pMarket.market.swap.loading')}
        </p>
      )}
    </div>
  )
}

function SwapForm({ info }: { info: MarketInfo }) {
  const tr = useTr()
  const { i18n, t } = useTranslation()
  const locale = i18n?.resolvedLanguage
  const balance = usePoll(marketApi.balance, 4_000)
  const book = usePoll(marketApi.book, 2_500)
  const trades = usePoll(marketApi.trades, 2_000)

  const assets = useMemo(
    () => swapAssets(book.data ?? [], balance.data),
    [book.data, balance.data]
  )
  const [choosing, setChoosing] = useState<'pay' | 'receive' | null>(null)
  const [selectedAsset, setSelectedAsset] = useState<SwapAsset | null>(null)
  const asset =
    assets.find((a) => a.assetId === selectedAsset?.assetId) ??
    selectedAsset ??
    pickableAssets(assets, false)[0]
  const [side, setSide] = useState<Side>('buy')
  const [editing, setEditing] = useState<Editing>('asset')
  const [assetText, setAssetText] = useState('')
  const [btcText, setBtcText] = useState('')
  const [pct, setPct] = useState<number | undefined>()
  const [slippage, setSlippage] = useState(0.01)
  const [showMakers, setShowMakers] = useState(false)
  const [taking, setTaking] = useState<{
    orders: Order[]
    info: MarketInfo
  } | null>(null)

  const btcReady = availableSats(balance.data)
  const held = balance.data?.assets.find((a) => a.asset_id === asset?.assetId)
  const assetHeld = held?.spendable ?? 0

  const precision = editing === 'btc' ? 0 : (asset?.precision ?? 0)
  const typed = parseSwapInput(
    editing === 'btc' ? btcText : assetText,
    precision
  )
  const quote = useMemo(
    () =>
      asset
        ? quoteSwapAmount(
            book.data ?? [],
            asset,
            side,
            editing,
            typed ?? 0,
            balance.data,
            slippage
          )
        : null,
    [asset, book.data, side, editing, typed, balance.data, slippage]
  )

  const reset = () => {
    setAssetText('')
    setBtcText('')
    setPct(undefined)
  }
  const review = taking && (
    <TakeSheet
      book={(book.data ?? []).filter(
        (o) => o.asset_id === taking.orders[0]?.asset_id
      )}
      info={taking.info}
      key={taking.orders.map((o) => o.order_id).join(',')}
      onChanged={() => {
        balance.refresh()
        book.refresh()
        trades.refresh()
      }}
      onClose={() => {
        setTaking(null)
        balance.refresh()
        book.refresh()
      }}
      onSwitch={(o) => setTaking({ info: taking.info, orders: [{ ...o }] })}
      orders={taking.orders}
      trades={trades.data ?? []}
    />
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
      <>
        <div className="mx-auto max-w-md py-16 text-center text-content-secondary">
          {tr(
            'swap.empty',
            'No offers on your relays right now. Check back soon, or post one from the order book.'
          )}
        </div>
        {review}
      </>
    )
  }

  const est =
    !quote.problem || quote.problem === 'partial' ? quote.plan : quote.estimate
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
        ? plainSwapAmount(est.baseAmount, asset.precision)
        : ''

  const onPct = (p: number) => {
    setSelectedAsset(asset)
    setPct(p)
    if (side === 'buy') {
      setEditing('btc')
      setBtcText(String((BigInt(btcReady) * BigInt(p)) / 100n))
    } else {
      setEditing('asset')
      setAssetText(
        plainSwapAmount(
          Number((BigInt(assetHeld) * BigInt(p)) / 100n),
          asset.precision
        )
      )
    }
  }

  const problem: SwapProblem =
    quote.problem === 'partial' && side === 'buy' && editing === 'asset'
      ? 'target_unavailable'
      : quote.problem
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
    target_unavailable: tr(
      'swap.targetUnavailable',
      'Available offers cannot cover the amount you want to receive.'
    ),
    too_small: tr('swap.amountTooSmall', 'Amount too small'),
  }

  const message = (): { tone: 'info' | 'warn'; text: string } | null => {
    if (typed === null)
      return {
        text: tr(
          'swap.invalidAmount',
          'Enter an amount with up to {{precision}} decimal places.',
          { precision }
        ),
        tone: 'warn',
      }
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
          text:
            est.nextFit && editing === 'asset'
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
      case 'target_unavailable':
        return { text: button.target_unavailable, tone: 'warn' }
      default:
        return null
    }
  }
  const note = message()
  const receiveLabel = tr('swap.chooseReceive', 'Choose the asset to receive')
  const payLabel = tr('swap.choosePay', 'Choose the asset to pay with')
  const assetFilled = `${fmtUnits(est.baseAmount, asset.precision)} ${asset.ticker}`
  const bitcoinFilled = `${fmtSats(est.sats)} sats`
  const differs =
    priced && (editing === 'asset' ? est.baseAmount : est.sats) !== typed

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

  const payingBalance = side === 'buy' ? btcReady : assetHeld
  const amountField = (pays: boolean) => {
    const btc = (side === 'buy') === pays
    const field = btc ? 'btc' : 'asset'
    const label = pays
      ? tr('swap.youPay', 'You pay')
      : tr('swap.youGet', 'You get')
    const value = btc ? btcShown : assetShown
    const available = btc
      ? fmtSats(btcReady) + ' sats'
      : fmtUnits(assetHeld, asset.precision) + ' ' + asset.ticker
    return (
      <div className="min-w-0 rounded-xl bg-surface-inset p-3 sm:p-4">
        <div className="mb-2 flex min-w-0 items-baseline justify-between gap-2">
          <label
            className="shrink-0 text-caption font-medium text-content-secondary"
            htmlFor={'swap-' + field}
          >
            {label}
          </label>
          <span
            className="truncate text-right text-caption text-content-tertiary"
            title={available}
          >
            {pays ? tr('ticket.available', 'Available') : t('p2pHome.balance')}{' '}
            {available}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              aria-invalid={(editing === field && typed === null) || undefined}
              autoComplete="off"
              className={
                'min-w-0 w-full rounded-lg bg-transparent py-2 pl-1 text-2xl font-semibold tabular-nums text-content-primary outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ' +
                (btc ? 'pr-9' : 'pr-1')
              }
              id={'swap-' + field}
              inputMode={btc || !asset.precision ? 'numeric' : 'decimal'}
              maxLength={64}
              onChange={(e) => {
                setSelectedAsset(asset)
                setEditing(field)
                setPct(undefined)
                if (btc) setBtcText(e.target.value)
                else setAssetText(e.target.value)
              }}
              placeholder="0"
              spellCheck={false}
              value={value}
            />
            {btc && (
              <span className="pointer-events-none absolute inset-y-0 right-1 flex items-center text-caption text-content-tertiary">
                sats
              </span>
            )}
          </div>
          <AssetButton
            asset={btc ? undefined : asset}
            label={pays ? payLabel : receiveLabel}
            onClick={() => setChoosing(pays ? 'pay' : 'receive')}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <section
        aria-label={tr('swap.title', 'Swap')}
        className="flex flex-col gap-2 rounded-2xl border border-divider/10 bg-surface-elevated/40 p-4 sm:p-5"
      >
        {Number.isSafeInteger(payingBalance) && payingBalance > 0 && (
          <div
            aria-labelledby="swap-balance-share"
            className="flex flex-wrap items-center justify-end gap-1"
            role="group"
          >
            <span
              className="mr-auto text-caption text-content-secondary"
              id="swap-balance-share"
            >
              {tr('ticket.share', 'Share of available balance')}
            </span>
            {[25, 50, 75, 100].map((p) => (
              <Button
                aria-pressed={p === pct}
                key={p}
                onClick={() => onPct(p)}
                size="sm"
                type="button"
                variant={p === pct ? 'surface' : 'quiet'}
              >
                {p}%
              </Button>
            ))}
          </div>
        )}
        {amountField(true)}
        <div className="flex justify-center">
          <Button
            aria-label={tr('swap.flip', 'Switch direction')}
            onClick={() => {
              setSide(side === 'buy' ? 'sell' : 'buy')
              reset()
            }}
            size="sm"
            type="button"
            variant="surface"
          >
            <ArrowDownUp size={16} />
          </Button>
        </div>
        {amountField(false)}

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

        <label className="flex flex-wrap items-center justify-between gap-2 px-1 text-caption text-content-secondary">
          {tr('swap.slippage', 'Price tolerance')}
          <select
            className="rounded-lg bg-surface-inset px-2 py-1 text-content-primary"
            onChange={(e) => setSlippage(Number(e.target.value))}
            value={slippage}
          >
            {[0.005, 0.01, 0.02, 0.05].map((n) => (
              <option key={n} value={n}>
                {Intl.NumberFormat(locale, {
                  maximumFractionDigits: 1,
                  style: 'percent',
                }).format(n)}
              </option>
            ))}
          </select>
        </label>
        {differs && (
          <p className="rounded-xl bg-surface-inset px-3 py-2 text-caption text-content-secondary">
            {tr('swap.actualFill', 'Whole offers fill {{pay}} → {{receive}}.', {
              pay: side === 'buy' ? bitcoinFilled : assetFilled,
              receive: side === 'buy' ? assetFilled : bitcoinFilled,
            })}
          </p>
        )}
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
                assetId={asset.assetId}
                makers={[...byMaker.values()]}
                network={info.network}
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

        {priced && (
          <NostrParticipants
            makers={est.picks.map((o) => o.maker_npub ?? o.maker)}
            taker={info.npub}
          />
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

        <Button
          className="mt-1 w-full"
          disabled={!canReview}
          onClick={() =>
            setTaking({
              info: { ...info },
              orders: quote.plan.picks.map((o) => ({ ...o })),
            })
          }
          size="lg"
          type="button"
        >
          {problem === 'target_unavailable'
            ? tr('swap.review', 'Review swap')
            : button[problem ?? 'ok']}
        </Button>
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
      <AssetSelect
        assets={assets}
        balance={balance.data}
        isOpen={choosing !== null}
        onClose={() => setChoosing(null)}
        onSelect={(id) => {
          const nextSide =
            (choosing === 'pay') === (id === null) ? 'buy' : 'sell'
          if (side === nextSide && (id === null || id === asset.assetId)) return
          setSide(nextSide)
          if (id !== null)
            setSelectedAsset(assets.find((a) => a.assetId === id) ?? null)
          reset()
        }}
        selected={
          (choosing === 'pay') === (side === 'buy') ? null : asset.assetId
        }
        title={choosing === 'pay' ? payLabel : receiveLabel}
      />
      {review}
    </div>
  )
}
