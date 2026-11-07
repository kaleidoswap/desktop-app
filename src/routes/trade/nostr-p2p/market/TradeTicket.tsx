import { useMemo, useState } from 'react'
import { toast } from 'react-toastify'

import {
  availableSats,
  marketApi,
  type Balance,
  type Info,
  type Order,
  type Side,
} from '../api'
import { planMarket, splitBook } from '../book'
import { fmtBtc, fmtPrice, fmtSats, fmtUnits, toBase } from '../format'

import { Field } from './Field'
import { useTr } from './hooks'
import { Pill, Slider, cx } from './ui'

interface Asset {
  asset_id: string
  ticker: string
  precision: number
}

interface Props {
  asset: Asset
  info: Info
  balance: Balance | undefined
  /** Every order in this market, the user's own included. */
  orders: Order[]
  onReview: (orders: Order[]) => void
  onPlaced: () => void
  /** Opens the dialog that moves funds between the node and the trading wallet. */
  onOpenFunds?: () => void
}

const TTLS = [
  { key: '1h', label: '1 hour', secs: 3600 },
  { key: '6h', label: '6 hours', secs: 6 * 3600 },
  { key: '24h', label: '24 hours', secs: 24 * 3600 },
]
const SLIPPAGE = [0.005, 0.01, 0.02, 0.05]

type Mode = 'market' | 'limit'

export function TradeTicket({
  asset,
  info,
  balance,
  orders,
  onReview,
  onPlaced,
  onOpenFunds,
}: Props) {
  const tr = useTr()
  const [side, setSide] = useState<Side>('buy')
  const [mode, setMode] = useState<Mode>('market')
  const [amount, setAmount] = useState('')
  const [price, setPrice] = useState('')
  const [slippage, setSlippage] = useState(0.01)
  const [ttl, setTtl] = useState(TTLS[0]!.secs)
  const [busy, setBusy] = useState(false)

  const have = balance?.assets.find((a) => a.asset_id === asset.asset_id)
  const btc = availableSats(balance)
  const amountBase = toBase(amount, asset.precision)
  const { asks, bids } = useMemo(
    () => splitBook(orders.filter((o) => !o.mine)),
    [orders]
  )
  const plan = useMemo(
    () =>
      planMarket(orders, side, amountBase, slippage, {
        coins: balance?.btc_coins,
      }),
    [orders, side, amountBase, slippage, balance?.btc_coins]
  )

  const wider = SLIPPAGE.find((x) => x > slippage)
  const unitPrice = Number(price) || 0
  const total = Math.round(unitPrice * (amountBase / 10 ** asset.precision))
  const platformFee = Math.max(
    Math.floor((total * info.fee_bps) / 10_000),
    info.min_fee_sat
  )
  const crossing =
    mode === 'limit' && unitPrice > 0
      ? side === 'buy'
        ? asks.find((o) => o.unit_price <= unitPrice)
        : bids.find((o) => o.unit_price >= unitPrice)
      : undefined

  const sideWord =
    side === 'buy' ? tr('ticket.buy', 'Buy') : tr('ticket.sell', 'Sell')
  const spendable = have?.spendable ?? 0

  let problem: string | null = null
  if (amountBase <= 0) problem = tr('ticket.enterAmount', 'Enter an amount.')
  else if (mode === 'limit' && total <= 0)
    problem = tr('ticket.enterPrice', 'Enter a price.')
  else if (mode === 'market' && plan.picks.length === 0) {
    const empty = (side === 'buy' ? asks : bids).length === 0
    problem = empty
      ? side === 'buy'
        ? tr(
            'ticket.noSellers',
            'Nobody is selling right now. Place a limit order to be first in line.'
          )
        : tr(
            'ticket.noBuyers',
            'Nobody is buying right now. Place a limit order to be first in line.'
          )
      : plan.nextFit
        ? tr(
            'ticket.smallestFits',
            'The best order is {{size}} {{ticker}}. Raise the amount to match it, or place a limit order.',
            {
              size: fmtUnits(plan.nextFit.amount, plan.nextFit.precision),
              ticker: asset.ticker,
            }
          )
        : tr(
            'ticket.outsideLimit',
            'Every order is further than your price limit. Allow more movement or place a limit order.'
          )
  } else if (
    side === 'sell' &&
    (mode === 'market' ? plan.baseAmount : amountBase) > spendable
  ) {
    problem = tr('ticket.haveAsset', 'You have {{n}} {{ticker}} available.', {
      n: fmtUnits(spendable, asset.precision),
      ticker: asset.ticker,
    })
  } else if (side === 'buy' && (mode === 'market' ? plan.sats : total) > btc) {
    problem = tr('ticket.haveSats', 'You have {{n}} sats available.', {
      n: fmtSats(btc),
    })
  }

  // the most the wallet can put into this order, in base units: what is held when selling, what
  // the bitcoin buys at the best price (or the typed one) when buying
  const refPrice = mode === 'limit' ? unitPrice : (asks[0]?.unit_price ?? 0)
  const maxBase =
    side === 'sell'
      ? spendable
      : refPrice > 0
        ? Math.floor((btc / refPrice) * 10 ** asset.precision)
        : 0
  const pctNow =
    maxBase > 0 ? Math.min(100, Math.round((amountBase / maxBase) * 100)) : 0

  const pct = (p: number) => {
    if (p <= 0 || maxBase <= 0) {
      setAmount('')
      return
    }
    const base = Math.floor((maxBase * p) / 100)
    setAmount(
      base > 0
        ? String(
            Number((base / 10 ** asset.precision).toFixed(asset.precision))
          )
        : ''
    )
  }

  const place = async () => {
    setBusy(true)
    try {
      await marketApi.placeOrder({
        amount: amountBase,
        asset_id: asset.asset_id,
        price_sat: total,
        side,
        ttl_secs: ttl,
      })
      toast.success(
        side === 'buy'
          ? tr('ticket.placedBuy', 'Buy order placed')
          : tr('ticket.placedSell', 'Sell order placed')
      )
      setAmount('')
      onPlaced()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const settleNote =
    info.min_confirmations > 0
      ? tr('ticket.settles', 'Settles after {{n}} confirmations', {
          n: info.min_confirmations,
        })
      : tr('ticket.settlesNow', 'Settles as soon as the transaction is seen')

  return (
    <section
      aria-label={tr('ticket.title', 'Trade')}
      className="flex flex-col gap-4 rounded-2xl bg-surface-card/70 p-4"
    >
      <div
        className="grid grid-cols-2 gap-1 rounded-xl bg-surface-inset p-1"
        role="tablist"
      >
        {(['buy', 'sell'] as const).map((s) => (
          <button
            aria-selected={side === s}
            className={cx(
              'rounded-lg px-3 py-2 text-body font-medium transition-colors',
              side === s
                ? s === 'buy'
                  ? 'bg-status-success text-text-on-accent'
                  : 'bg-status-danger text-white'
                : 'text-content-secondary hover:text-content-primary'
            )}
            key={s}
            onClick={() => setSide(s)}
            role="tab"
            type="button"
          >
            {s === 'buy'
              ? tr('ticket.buyTab', 'Buy {{ticker}}', { ticker: asset.ticker })
              : tr('ticket.sellTab', 'Sell {{ticker}}', {
                  ticker: asset.ticker,
                })}
          </button>
        ))}
      </div>

      <div className="flex gap-4 text-body" role="tablist">
        {(['market', 'limit'] as const).map((m) => (
          <button
            aria-selected={mode === m}
            className={cx(
              'border-b-2 pb-1 transition-colors',
              mode === m
                ? 'border-primary text-content-primary'
                : 'border-transparent text-content-tertiary hover:text-content-secondary'
            )}
            key={m}
            onClick={() => setMode(m)}
            role="tab"
            type="button"
          >
            {m === 'market'
              ? tr('ticket.market', 'Market')
              : tr('ticket.limit', 'Limit')}
          </button>
        ))}
      </div>

      <p className="-mt-1 text-caption text-content-tertiary">
        {mode === 'market'
          ? side === 'buy'
            ? tr(
                'ticket.marketHelpBuy',
                'Buy now from the cheapest open orders. You see the exact cost before anything is signed.'
              )
            : tr(
                'ticket.marketHelpSell',
                'Sell now to the highest open buy orders. You see exactly what you receive before anything is signed.'
              )
          : tr(
              'ticket.limitHelp',
              'Post an order at your own price. It waits in the book until someone takes it.'
            )}
      </p>

      <div className="flex items-center justify-between text-caption text-content-tertiary">
        <span>{tr('ticket.available', 'Available')}</span>
        <span className="flex items-center gap-2">
          <span className="tabular-nums text-content-secondary">
            {side === 'buy'
              ? `${fmtSats(btc)} sats`
              : `${fmtUnits(spendable, asset.precision)} ${asset.ticker}`}
          </span>
          {onOpenFunds && (side === 'buy' ? btc === 0 : spendable === 0) && (
            <button
              className="font-medium text-primary hover:underline"
              onClick={onOpenFunds}
              type="button"
            >
              {tr('ticket.deposit', 'Deposit')}
            </button>
          )}
        </span>
      </div>

      {mode === 'limit' && (
        <Field
          id="p2p-price"
          label={tr('ticket.price', 'Price')}
          onChange={setPrice}
          suffix={tr('ticket.perUnit', 'sats / {{ticker}}', {
            ticker: asset.ticker,
          })}
          value={price}
        />
      )}
      <Field
        id="p2p-amount"
        label={tr('ticket.amount', 'Amount')}
        onChange={setAmount}
        suffix={asset.ticker}
        value={amount}
      />
      <Slider
        disabled={maxBase <= 0}
        label={tr('ticket.share', 'Share of what you can use')}
        marks={[0, 25, 50, 75, 100].map((v) => ({
          label: `${v}%`,
          value: v,
        }))}
        onChange={pct}
        readout={maxBase > 0 ? `${pctNow}%` : undefined}
        value={pctNow}
      />

      {mode === 'market' ? (
        <>
          <Slider
            label={tr('ticket.limitPrice', 'Worst price you accept')}
            marks={SLIPPAGE.map((v, i) => ({
              label: `${(v * 100).toFixed(v < 0.01 ? 1 : 0)}%`,
              value: i,
            }))}
            max={SLIPPAGE.length - 1}
            onChange={(i) => setSlippage(SLIPPAGE[i] ?? 0.01)}
            readout={tr('ticket.slipReadout', 'up to {{pct}}% worse', {
              pct: (slippage * 100).toFixed(slippage < 0.01 ? 1 : 0),
            })}
            value={Math.max(0, SLIPPAGE.indexOf(slippage))}
          />
          <div className="flex flex-col gap-2 rounded-xl bg-surface-inset p-3 text-caption">
            <div className="flex justify-between">
              <span className="text-content-secondary">
                {side === 'buy'
                  ? tr('ticket.youGet', 'You get')
                  : tr('ticket.youGive', 'You give')}
              </span>
              <span className="tabular-nums text-content-primary">
                {plan.picks.length
                  ? `${fmtUnits(plan.baseAmount, asset.precision)} ${asset.ticker}`
                  : '–'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-content-secondary">
                {side === 'buy'
                  ? tr('ticket.youPay', 'You pay')
                  : tr('ticket.youReceive', 'You receive')}
              </span>
              <span className="tabular-nums text-content-primary">
                {plan.picks.length ? `${fmtSats(plan.sats)} sats` : '–'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-content-secondary">
                {tr('ticket.avgPrice', 'Average price')}
              </span>
              <span className="tabular-nums text-content-primary">
                {plan.picks.length ? fmtPrice(plan.avgPrice) : '–'}
              </span>
            </div>
            {plan.picks.length > 0 &&
              plan.shortBy > 0 &&
              plan.noCoinFor === 0 &&
              plan.tooManyFromMaker === 0 && (
                <p className="text-status-warning">
                  {tr(
                    'ticket.partial',
                    'Orders fill whole, so {{n}} of the {{ticker}} you asked for is not covered.',
                    {
                      n: fmtUnits(plan.shortBy, asset.precision),
                      ticker: asset.ticker,
                    }
                  )}
                </p>
              )}
            {amountBase > 0 && plan.beyondLimit > 0 && wider && (
              <button
                className="text-left text-primary hover:underline"
                onClick={() => setSlippage(wider)}
                type="button"
              >
                {tr(
                  'ticket.widen',
                  'Allow {{pct}}% to include {{n}} more order(s)',
                  { n: plan.beyondLimit, pct: (wider * 100).toFixed(0) }
                )}
              </button>
            )}
            {plan.noCoinFor > 0 && (
              <p className="text-status-warning">
                {tr(
                  'ticket.noCoin',
                  'Each swap spends a coin of its own and your wallet has {{n}} free. {{left}} more order(s) can follow once these settle.',
                  { left: plan.noCoinFor, n: balance?.btc_coins?.length ?? 0 }
                )}
              </p>
            )}
            {plan.noCoinFor > 0 && onOpenFunds && (
              <p className="text-content-tertiary">
                {tr(
                  'ticket.splitHint',
                  'To run more at once, move your bitcoin from the node in several parts.'
                )}{' '}
                <button
                  className="text-primary hover:underline"
                  onClick={onOpenFunds}
                  type="button"
                >
                  {tr('ticket.openFunds', 'Open Funds')}
                </button>
              </p>
            )}
            {plan.tooManyFromMaker > 0 && (
              <p className="text-content-tertiary">
                {tr(
                  'ticket.perMaker',
                  'A maker takes a few swaps from you at a time, so {{n}} more order(s) are left for next.',
                  { n: plan.tooManyFromMaker }
                )}
              </p>
            )}
            {plan.picks.length > 1 && (
              <p className="text-content-tertiary">
                {tr('ticket.orders', 'Takes {{n}} orders, each its own swap.', {
                  n: plan.picks.length,
                })}
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <Field
            hint={total > 0 ? `≈ ${fmtBtc(total)} BTC` : undefined}
            id="p2p-total"
            label={tr('ticket.total', 'Total')}
            placeholder="–"
            readOnly
            suffix="sats"
            value={total ? fmtSats(total) : ''}
          />
          <div className="flex flex-col gap-1.5">
            <label
              className="text-caption text-content-secondary"
              htmlFor="p2p-ttl"
            >
              {tr('ticket.keepOpen', 'Keep open for')}
            </label>
            <select
              className="rounded-xl bg-surface-inset px-3 py-2.5 text-body text-content-primary outline-none focus:ring-2 focus:ring-primary/40"
              id="p2p-ttl"
              onChange={(e) => setTtl(Number(e.target.value))}
              value={ttl}
            >
              {TTLS.map((t) => (
                <option key={t.key} value={t.secs}>
                  {tr(`ticket.ttl.${t.key}`, t.label)}
                </option>
              ))}
            </select>
          </div>
          {crossing && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-status-info-subtle p-3 text-caption text-content-primary">
              <span>
                {side === 'buy'
                  ? tr('ticket.sellerAt', 'A seller is already at {{p}}.', {
                      p: fmtPrice(crossing.unit_price),
                    })
                  : tr('ticket.buyerAt', 'A buyer is already at {{p}}.', {
                      p: fmtPrice(crossing.unit_price),
                    })}
              </span>
              <button
                className="shrink-0 rounded-lg bg-surface-raised px-3 py-1 font-medium text-content-primary hover:bg-surface-high"
                onClick={() => onReview([crossing])}
                type="button"
              >
                {tr('ticket.takeIt', 'Trade it now')}
              </button>
            </div>
          )}
        </>
      )}

      <div className="flex flex-col gap-2 text-caption">
        <div className="flex items-center justify-between">
          <span className="text-content-secondary">
            {tr('ticket.payWith', 'Pay with')}
          </span>
          <span className="flex gap-1.5">
            <Pill tone="primary">
              {tr('ticket.onchain', 'Bitcoin on-chain')}
            </Pill>
            <span title={tr('ticket.soonHint', 'Not available yet')}>
              <Pill className="opacity-60" tone="muted">
                {tr('ticket.lightning', 'Lightning · soon')}
              </Pill>
            </span>
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-content-secondary">
            {tr('ticket.fees', 'Fees')}
          </span>
          <span className="tabular-nums text-content-primary">
            {mode === 'limit'
              ? tr('ticket.makerFree', 'None for you as the maker')
              : plan.picks.length
                ? `${fmtSats(plan.fees)} sats`
                : '–'}
          </span>
        </div>
        {mode === 'limit' && total > 0 && (
          <p className="text-content-tertiary tabular-nums">
            {tr(
              'ticket.takerPays',
              'Whoever takes it pays {{platform}} sats to the platform and {{network}} sats to the network.',
              {
                network: fmtSats(info.network_fee_sat),
                platform: fmtSats(platformFee),
              }
            )}
          </p>
        )}
        <p className="text-content-tertiary">{settleNote}</p>
      </div>

      {problem && (
        <p className="rounded-xl bg-status-warning-subtle p-3 text-caption text-content-primary">
          {problem}
        </p>
      )}

      <button
        className={cx(
          'rounded-xl py-3 text-body font-bold transition-opacity disabled:cursor-not-allowed disabled:opacity-40',
          side === 'buy'
            ? 'bg-status-success text-text-on-accent'
            : 'bg-status-danger text-white'
        )}
        disabled={!!problem || busy}
        onClick={() =>
          mode === 'market' ? onReview(plan.picks) : void place()
        }
        type="button"
      >
        {busy
          ? tr('ticket.placing', 'Placing…')
          : mode === 'market'
            ? tr('ticket.review', 'Review {{side}}', {
                side: sideWord.toLowerCase(),
              })
            : tr('ticket.place', 'Place {{side}} order', {
                side: sideWord.toLowerCase(),
              })}
      </button>
      <p className="text-tiny text-content-tertiary">
        {mode === 'limit'
          ? tr(
              'ticket.limitNote',
              'Your order rests in the book until someone takes it in full. Your coins stay in your wallet until the swap is signed.'
            )
          : tr(
              'ticket.marketNote',
              'You see exactly what you pay before anything is signed.'
            )}
      </p>
    </section>
  )
}
