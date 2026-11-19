import { ArrowDown } from 'lucide-react'
import { useMemo, useState } from 'react'

import { marketApi, type Order, type Side } from '../api'
import { fmtPrice, fmtSats, fmtUnits, short } from '../format'
import { quoteSwap, swapAssets, type SwapProblem } from '../swap'

import { useTr, usePoll } from './hooks'
import { TakeSheet } from './TakeSheet'

/**
 * The market as a swap: say what you pay and what you get, see the price the book gives and who
 * fills it, then review. Under it is the same order book the pro view shows.
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
  const [assetId, setAssetId] = useState<string | null>(null)
  const asset = assets.find((a) => a.assetId === assetId) ?? assets[0]
  const [side, setSide] = useState<Side>('buy')
  const [amount, setAmount] = useState('')
  const [taking, setTaking] = useState<Order[] | null>(null)

  const quote = useMemo(
    () =>
      asset
        ? quoteSwap(book.data ?? [], asset, side, amount, balance.data)
        : null,
    [asset, book.data, side, amount, balance.data]
  )

  const btcReady =
    balance.data?.btc_settled_sat ?? balance.data?.btc_spendable_sat ?? 0
  const assetHeld =
    balance.data?.assets.find((a) => a.asset_id === asset?.assetId)
      ?.spendable ?? 0

  const problemText = (p: SwapProblem): string | null => {
    switch (p) {
      case 'no_offers':
        return side === 'buy'
          ? tr('swap.noSellers', 'Nobody is selling this asset right now.')
          : tr('swap.noBuyers', 'Nobody is buying this asset right now.')
      case 'too_small':
        return quote?.plan.nextFit
          ? tr(
              'swap.tooSmall',
              'Offers fill whole: the smallest one that fits is {{amount}}.',
              {
                amount: fmtUnits(
                  quote.plan.nextFit.amount,
                  quote.plan.nextFit.precision
                ),
              }
            )
          : tr('swap.noFit', 'No offer fits this amount.')
      case 'no_free_coin':
        return tr(
          'swap.noCoin',
          'Each swap needs a free bitcoin coin big enough to pay for it. Deposit more, or split your coins.'
        )
      case 'not_enough_btc':
        return tr(
          'swap.needBtc',
          'Not enough bitcoin: this swap sets aside {{need}} sats, you have {{have}}.',
          {
            have: fmtSats(btcReady),
            need: fmtSats(quote?.plan.reserveSat ?? 0),
          }
        )
      case 'not_enough_asset':
        return tr('swap.needAsset', 'You do not have that much to sell.')
      case 'partial':
        return tr(
          'swap.partial',
          'Offers fill whole, so this swap gets {{amount}} of what you asked.',
          {
            amount: fmtUnits(
              quote?.plan.baseAmount ?? 0,
              asset?.precision ?? 0
            ),
          }
        )
      default:
        return null
    }
  }

  if (!book.data || !balance.data) {
    return (
      <p className="py-16 text-center text-content-secondary">
        {tr('swap.loading', 'Reading the order book…')}
      </p>
    )
  }
  if (!asset) {
    return (
      <p className="py-16 text-center text-content-secondary">
        {tr(
          'swap.empty',
          'No offers on your relays right now. Check back soon, or post one from the order book.'
        )}
      </p>
    )
  }

  const plan = quote?.plan
  const canReview =
    !!plan &&
    plan.picks.length > 0 &&
    (quote?.problem === null || quote?.problem === 'partial')
  const note = problemText(quote?.problem ?? null)
  const btcAmount = plan && plan.picks.length > 0 ? fmtSats(plan.sats) : '–'

  const assetField = (label: string) => (
    <div className="flex flex-col gap-2">
      <label className="text-sm text-content-tertiary" htmlFor="swap-amount">
        {label}
      </label>
      <div className="flex items-center gap-3 rounded-xl border border-divider/30 bg-surface-base px-4 py-3 focus-within:border-primary/60">
        <input
          className="min-w-0 flex-1 bg-transparent text-2xl font-bold text-content-primary outline-none placeholder:text-content-tertiary"
          id="swap-amount"
          inputMode="decimal"
          onChange={(e) => setAmount(e.target.value.replace(',', '.'))}
          placeholder="0"
          value={amount}
        />
        <select
          aria-label={tr('swap.asset', 'Asset')}
          className="min-h-11 rounded-full border border-divider/30 bg-surface-elevated px-3 text-sm font-medium text-content-primary outline-none"
          onChange={(e) => {
            setAssetId(e.target.value)
            setAmount('')
          }}
          value={asset.assetId}
        >
          {assets.map((a) => (
            <option key={a.assetId} value={a.assetId}>
              {a.ticker}
            </option>
          ))}
        </select>
      </div>
      {side === 'sell' && (
        <span className="text-xs text-content-tertiary">
          {tr('swap.youHave', 'You have {{amount}} {{ticker}}', {
            amount: fmtUnits(assetHeld, asset.precision),
            ticker: asset.ticker,
          })}
        </span>
      )}
    </div>
  )

  const btcField = (label: string) => (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-content-tertiary">{label}</span>
      <div className="flex items-center gap-3 rounded-xl border border-divider/20 bg-surface-base/60 px-4 py-3">
        <span className="flex-1 text-2xl font-bold text-content-primary">
          {btcAmount}
        </span>
        <span className="rounded-full border border-divider/30 px-3 py-2 text-sm font-medium text-content-secondary">
          sats
        </span>
      </div>
      {side === 'buy' && (
        <span className="text-xs text-content-tertiary">
          {tr('swap.btcReady', 'Ready to trade: {{sats}} sats', {
            sats: fmtSats(btcReady),
          })}
        </span>
      )}
    </div>
  )

  const byMaker = new Map<string, { amount: number; away: boolean }>()
  for (const o of plan?.picks ?? []) {
    const m = byMaker.get(o.maker) ?? { amount: 0, away: o.away }
    m.amount += o.amount
    m.away = m.away && o.away
    byMaker.set(o.maker, m)
  }

  return (
    <div className="flex flex-wrap items-start gap-6">
      <section
        aria-label={tr('swap.title', 'Swap')}
        className="flex w-full max-w-lg flex-col gap-3 rounded-2xl border border-divider/10 bg-surface-elevated/40 p-6"
      >
        {side === 'buy'
          ? btcField(tr('swap.youPay', 'You pay'))
          : assetField(tr('swap.youSell', 'You pay'))}
        <div className="-my-1 flex justify-center">
          <button
            aria-label={tr('swap.flip', 'Switch direction')}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-divider/30 bg-surface-base text-content-secondary transition-colors hover:text-content-primary"
            onClick={() => {
              setSide(side === 'buy' ? 'sell' : 'buy')
              setAmount('')
            }}
            type="button"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        </div>
        {side === 'buy'
          ? assetField(tr('swap.youGet', 'You get'))
          : btcField(tr('swap.youReceive', 'You get'))}

        {plan && plan.picks.length > 0 && (
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-content-tertiary">
              {tr('swap.price', 'Price')}
            </dt>
            <dd className="text-right text-content-primary">
              {fmtPrice(plan.avgPrice)}{' '}
              {tr('swap.perUnit', 'sats per {{ticker}}', {
                ticker: asset.ticker,
              })}
            </dd>
            <dt className="text-content-tertiary">
              {tr('swap.filledBy', 'Filled by')}
            </dt>
            <dd className="text-right text-content-primary">
              {tr('swap.makers', '{{count}} makers', {
                count: quote?.makers ?? 0,
              })}
            </dd>
            <dt className="text-content-tertiary">{tr('swap.fees', 'Fees')}</dt>
            <dd className="text-right text-content-primary">
              {fmtSats(plan.fees)} sats
            </dd>
            {side === 'buy' && (
              <>
                <dt className="font-medium text-content-primary">
                  {tr('swap.setAside', 'Set aside from your bitcoin')}
                </dt>
                <dd className="text-right font-bold text-content-primary">
                  {fmtSats(plan.reserveSat)} sats
                </dd>
              </>
            )}
          </dl>
        )}

        {note && amount && (
          <p
            className={`text-sm ${quote?.problem === 'partial' ? 'text-content-secondary' : 'text-status-warning'}`}
          >
            {note}
          </p>
        )}

        <button
          className="mt-2 min-h-12 rounded-lg bg-primary text-base font-bold text-surface-base transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canReview || !info.data}
          onClick={() => plan && setTaking(plan.picks)}
          type="button"
        >
          {tr('swap.review', 'Review swap')}
        </button>
        <p className="text-center text-xs text-content-tertiary">
          {tr(
            'swap.nothingSigned',
            'Nothing is signed until you confirm the exact amounts.'
          )}
        </p>
      </section>

      <section
        aria-label={tr('swap.whoFills', 'Who fills this swap')}
        className="flex min-w-[300px] flex-1 flex-col gap-3 rounded-2xl border border-divider/10 bg-surface-elevated/40 p-6"
      >
        <h2 className="text-lg font-medium text-content-primary">
          {tr('swap.whoFills', 'Who fills this swap')}
        </h2>
        {byMaker.size === 0 ? (
          <p className="text-sm leading-relaxed text-content-tertiary">
            {tr(
              'swap.whoFillsEmpty',
              'Type an amount: the best offers from independent makers show up here, best price first.'
            )}
          </p>
        ) : (
          [...byMaker.entries()].map(([maker, m]) => (
            <div
              className="flex items-center gap-3 rounded-xl border border-divider/10 bg-surface-base/60 px-4 py-3"
              key={maker}
            >
              <span
                aria-hidden
                className={`h-2.5 w-2.5 rounded-full ${m.away ? 'bg-content-tertiary' : 'bg-status-success'}`}
              />
              <span className="flex flex-1 flex-col">
                <span className="font-mono text-sm text-content-primary">
                  {short(maker, 6)}
                </span>
                <span className="text-xs text-content-tertiary">
                  {m.away
                    ? tr('swap.makerAway', 'Away: may take a moment to answer')
                    : tr('swap.makerOnline', 'Online now')}
                </span>
              </span>
              <span className="text-sm font-medium text-content-primary">
                {fmtUnits(m.amount, asset.precision)} {asset.ticker}
              </span>
            </div>
          ))
        )}
        <p className="mt-1 text-xs leading-relaxed text-content-tertiary">
          {tr(
            'swap.howItSettles',
            'Each maker settles with you in its own Bitcoin transaction, with both sides in it: you get the asset, or your bitcoin never leaves.'
          )}
        </p>
      </section>

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
            setAmount('')
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
