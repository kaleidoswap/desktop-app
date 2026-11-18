import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'

import { P2P_ACTIVITY_PATH, P2P_TRADE_PATH } from '../../app/router/paths'
import { useAppDispatch } from '../../app/store/hooks'
import { uiSliceActions } from '../../slices/ui/ui.slice'
import { marketApi, type Trade } from '../trade/nostr-p2p/api'
import {
  ago,
  fmtPrice,
  fmtSats,
  fmtTradeAmount,
  fmtUnits,
  networkLabel,
  tickerOf,
  tradePrecision,
  type PrecisionSource,
} from '../trade/nostr-p2p/format'
import { usePoll } from '../trade/nostr-p2p/market/hooks'
import { useP2pSession } from '../trade/nostr-p2p/session'

import {
  bitcoinSummary,
  heldAssets,
  makerCounts,
  marketSummary,
  recentTrades,
} from './summary'

const Card = ({
  title,
  aside,
  children,
}: {
  title: string
  aside?: ReactNode
  children: ReactNode
}) => (
  <section className="flex flex-col gap-1 rounded-2xl border border-divider/10 bg-surface-elevated/40 p-5">
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h2 className="text-lg font-medium tracking-tight text-content-primary">
        {title}
      </h2>
      {aside}
    </div>
    {children}
  </section>
)

const Row = ({
  left,
  sub,
  right,
  rightSub,
}: {
  left: ReactNode
  sub?: ReactNode
  right?: ReactNode
  rightSub?: ReactNode
}) => (
  <div className="flex items-center gap-3 border-b border-divider/10 py-2.5 last:border-b-0">
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate font-medium text-content-primary">{left}</span>
      {sub && <span className="text-xs text-content-tertiary">{sub}</span>}
    </span>
    {(right || rightSub) && (
      <span className="flex flex-col text-right">
        {right && (
          <span className="font-medium text-content-primary">{right}</span>
        )}
        {rightSub && (
          <span className="text-xs text-content-tertiary">{rightSub}</span>
        )}
      </span>
    )}
  </div>
)

const toneClass = {
  danger: 'bg-status-danger/10 text-status-danger',
  info: 'bg-primary/10 text-primary',
  success: 'bg-status-success/10 text-status-success',
  warning: 'bg-status-warning/10 text-status-warning',
} as const

/** The P2P app's first page: what the wallet holds, what the market offers, what happened. */
export const Component = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { config } = useP2pSession()
  const balance = usePoll(marketApi.balance, 5_000)
  const book = usePoll(marketApi.book, 10_000)
  const trades = usePoll(marketApi.trades, 5_000)
  const info = usePoll(marketApi.info, 60_000)

  const btc = bitcoinSummary(balance.data)
  const assets = heldAssets(balance.data)
  const pairs = marketSummary(book.data ?? []).slice(0, 4)
  const makers = makerCounts(book.data ?? [])
  const recent = recentTrades(trades.data)
  const known: PrecisionSource[] = (balance.data?.assets ?? []).map((a) => ({
    asset_id: a.asset_id,
    precision: a.precision,
  }))

  const tradeLine = (tr: Trade) => {
    const amount = fmtTradeAmount(tr.amount, tradePrecision(tr, known))
    const what = `${amount} ${tickerOf(tr)}`
    return tr.side === 'buy'
      ? t('p2pHome.bought', { defaultValue: 'Bought {{what}}', what })
      : t('p2pHome.sold', { defaultValue: 'Sold {{what}}', what })
  }
  const tradeTone = (tr: Trade): [keyof typeof toneClass, string] =>
    tr.status === 'settled'
      ? ['success', t('p2pHome.settled', { defaultValue: 'Settled' })]
      : tr.status === 'broadcast'
        ? [
            'warning',
            t('p2pHome.confirming', {
              defaultValue: '{{have}} of {{need}} confirmations',
              have: tr.confirmations,
              need: tr.required,
            }),
          ]
        : tr.status === 'failed'
          ? ['danger', t('p2pHome.failed', { defaultValue: 'Failed' })]
          : ['info', t('p2pHome.inProgress', { defaultValue: 'In progress' })]

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-content-primary">
          {t('p2pHome.title', { defaultValue: 'Home' })}
        </h1>
        {config && config.network !== 'bitcoin' && (
          <span className="rounded-full bg-status-warning/10 px-2.5 py-1 text-xs font-medium text-status-warning">
            {t('p2pHome.testNetwork', {
              defaultValue: '{{network}} test network',
              network: networkLabel(config.network),
            })}
          </span>
        )}
        <span className="flex-1" />
        {info.data && (
          <span className="flex items-center gap-2 rounded-full border border-divider/20 px-3 py-1.5 text-xs text-content-secondary">
            <span
              aria-hidden
              className="h-2 w-2 rounded-full bg-status-success"
            />
            {t('p2pHome.relays', {
              count: info.data.relays.length,
              defaultValue: 'Nostr · {{count}} relays',
            })}
          </span>
        )}
      </header>

      <section
        aria-label={t('p2pHome.balance', { defaultValue: 'Balance' })}
        className="flex flex-wrap items-end gap-6 rounded-2xl border border-divider/10 bg-surface-elevated/40 p-6"
      >
        <div className="flex min-w-[260px] flex-1 flex-col gap-1.5">
          <span className="text-xs tracking-wider text-content-tertiary">
            {t('p2pHome.ready', { defaultValue: 'READY TO TRADE' })}
          </span>
          <span className="text-4xl font-bold tracking-tight text-content-primary">
            {balance.data ? `${fmtSats(btc.ready)} sats` : '–'}
          </span>
          <span className="text-sm text-content-tertiary">
            {btc.pending > 0
              ? t('p2pHome.pending', {
                  defaultValue: '{{sats}} sats still confirming · ',
                  sats: fmtSats(btc.pending),
                })
              : ''}
            {t('p2pHome.coins', {
              count: btc.coins,
              defaultValue: '{{count}} coins free for swaps',
            })}
            {' · '}
            {t('p2pHome.assetsCount', {
              count: assets.length,
              defaultValue: '{{count}} assets',
            })}
          </span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            className="flex min-h-11 items-center gap-2 rounded-lg border border-divider/30 px-4 font-medium text-content-primary transition-colors hover:bg-surface-overlay/50"
            onClick={() =>
              dispatch(
                uiSliceActions.setModal({ assetId: undefined, type: 'deposit' })
              )
            }
            type="button"
          >
            <ArrowDownLeft className="h-4 w-4" />
            {t('p2pHome.receive', { defaultValue: 'Receive' })}
          </button>
          <button
            className="flex min-h-11 items-center gap-2 rounded-lg border border-divider/30 px-4 font-medium text-content-primary transition-colors hover:bg-surface-overlay/50"
            onClick={() =>
              dispatch(
                uiSliceActions.setModal({
                  assetId: undefined,
                  type: 'withdraw',
                })
              )
            }
            type="button"
          >
            <ArrowUpRight className="h-4 w-4" />
            {t('p2pHome.send', { defaultValue: 'Send' })}
          </button>
          <button
            className="flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 font-bold text-surface-base transition-opacity hover:opacity-90"
            onClick={() => navigate(P2P_TRADE_PATH)}
            type="button"
          >
            <ArrowLeftRight className="h-4 w-4" />
            {t('p2pHome.trade', { defaultValue: 'Trade' })}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title={t('p2pHome.assets', { defaultValue: 'Your assets' })}>
          <Row
            left="Bitcoin"
            right={`${fmtSats(btc.ready + btc.pending)} sats`}
            sub={t('p2pHome.btcSub', {
              count: btc.coins,
              defaultValue: '{{count}} coins free for swaps',
            })}
          />
          {assets.map((a) => (
            <Row
              key={a.asset_id}
              left={a.ticker || a.name}
              right={fmtUnits(a.total, a.precision)}
              rightSub={
                a.spendable < a.total
                  ? t('p2pHome.notSpendable', {
                      amount: fmtUnits(a.total - a.spendable, a.precision),
                      defaultValue: '{{amount}} not spendable yet',
                    })
                  : undefined
              }
              sub={a.name}
            />
          ))}
          {balance.data && assets.length === 0 && (
            <p className="py-2 text-sm text-content-tertiary">
              {t('p2pHome.noAssets', {
                defaultValue:
                  'No assets yet. Buy one on the market or receive one with an RGB invoice.',
              })}
            </p>
          )}
        </Card>

        <Card
          aside={
            book.data && (
              <span className="text-xs text-content-tertiary">
                {t('p2pHome.makersOnline', {
                  count: makers.online,
                  defaultValue: '{{count}} makers online',
                })}
              </span>
            )
          }
          title={t('p2pHome.market', { defaultValue: 'Market' })}
        >
          {pairs.map((p) => (
            <Link
              className="flex items-center gap-3 rounded-lg bg-surface-base/60 px-3 py-2.5 transition-colors hover:bg-surface-overlay/50"
              key={p.assetId}
              to={P2P_TRADE_PATH}
            >
              <span className="flex-1 font-medium text-content-primary">
                {p.ticker} / BTC
              </span>
              <span className="flex flex-col text-right text-xs">
                <span className="text-content-secondary">
                  {t('p2pHome.buyAt', { defaultValue: 'Buy at' })}{' '}
                  <strong className="text-status-success">
                    {p.buyAt === null ? '–' : fmtPrice(p.buyAt)}
                  </strong>
                </span>
                <span className="text-content-tertiary">
                  {t('p2pHome.sellAt', { defaultValue: 'Sell at' })}{' '}
                  {p.sellAt === null ? '–' : fmtPrice(p.sellAt)}
                </span>
              </span>
            </Link>
          ))}
          {book.data && pairs.length === 0 && (
            <p className="py-2 text-sm text-content-tertiary">
              {t('p2pHome.emptyBook', {
                defaultValue: 'No offers on your relays right now.',
              })}
            </p>
          )}
          <p className="mt-2 text-xs leading-relaxed text-content-tertiary">
            {t('p2pHome.marketNote', {
              defaultValue:
                'Prices in sats per unit. Offers come from independent makers over Nostr; every swap settles in one Bitcoin transaction you sign.',
            })}
          </p>
        </Card>

        <Card
          aside={
            <Link
              className="text-xs font-medium text-primary hover:underline"
              to={P2P_ACTIVITY_PATH}
            >
              {t('p2pHome.all', { defaultValue: 'All activity' })}
            </Link>
          }
          title={t('p2pHome.activity', { defaultValue: 'Activity' })}
        >
          {recent.map((tr) => {
            const [tone, label] = tradeTone(tr)
            return (
              <div
                className="flex items-center gap-3 border-b border-divider/10 py-2.5 last:border-b-0"
                key={tr.id}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-content-primary">
                    {tradeLine(tr)}
                  </span>
                  <span className="text-xs text-content-tertiary">
                    {fmtSats(tr.price_sat)} sats · {ago(tr.ts)}
                  </span>
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs ${toneClass[tone]}`}
                >
                  {label}
                </span>
              </div>
            )
          })}
          {trades.data && recent.length === 0 && (
            <p className="py-2 text-sm text-content-tertiary">
              {t('p2pHome.noTrades', {
                defaultValue: 'Your swaps show up here.',
              })}
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}
