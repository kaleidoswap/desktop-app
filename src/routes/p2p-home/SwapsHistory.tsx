import { NostrParticipants } from '../trade/nostr-p2p/NostrParticipants'
import { openUrl } from '@tauri-apps/plugin-opener'
import { ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { getTxExplorerUrl } from '../../helpers/explorer'
import { marketApi, type Trade } from '../trade/nostr-p2p/api'
import {
  fmtSats,
  fmtTradeAmount,
  tickerOf,
  tradePrecision,
  type PrecisionSource,
} from '../trade/nostr-p2p/format'
import { usePoll } from '../trade/nostr-p2p/market/hooks'
import { useP2pSession } from '../trade/nostr-p2p/session'

const toneClass = {
  danger: 'bg-status-danger/10 text-status-danger',
  info: 'bg-primary/10 text-primary',
  success: 'bg-status-success/10 text-status-success',
  warning: 'bg-status-warning/10 text-status-warning',
} as const

/** Every swap of the trading wallet, newest first: what moved, at what price, and where it stands. */
export function SwapsHistory() {
  const { t } = useTranslation()
  const { config } = useP2pSession()
  const trades = usePoll(marketApi.trades, 5_000)
  const balance = usePoll(marketApi.balance, 30_000)
  const known: PrecisionSource[] = (balance.data?.assets ?? []).map((a) => ({
    asset_id: a.asset_id,
    precision: a.precision,
  }))
  const rows = [...(trades.data ?? [])].sort((a, b) => b.ts - a.ts)

  const status = (tr: Trade): [keyof typeof toneClass, string] =>
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

  if (!trades.data) {
    return (
      <p className="py-8 text-center text-sm text-content-tertiary">
        {t('p2pMarket.loading', { defaultValue: 'Loading…' })}
      </p>
    )
  }
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-content-tertiary">
        {t('p2pHome.noTrades', { defaultValue: 'Your swaps show up here.' })}
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-divider/10 bg-surface-elevated/40">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs tracking-wider text-content-tertiary">
            <th className="px-4 py-3 font-normal">
              {t('p2pSwaps.when', { defaultValue: 'WHEN' })}
            </th>
            <th className="px-4 py-3 font-normal">
              {t('p2pSwaps.swap', { defaultValue: 'SWAP' })}
            </th>
            <th className="px-4 py-3 text-right font-normal">
              {t('p2pSwaps.bitcoin', { defaultValue: 'BITCOIN' })}
            </th>
            <th className="px-4 py-3 text-right font-normal">
              {t('p2pSwaps.fees', { defaultValue: 'FEES' })}
            </th>
            <th className="px-4 py-3 font-normal">
              {t('p2pSwaps.status', { defaultValue: 'STATUS' })}
            </th>
            <th className="px-4 py-3">
              <span className="sr-only">
                {t('p2pSwaps.transaction', { defaultValue: 'Transaction' })}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((tr) => {
            const [tone, label] = status(tr)
            const amount = fmtTradeAmount(tr.amount, tradePrecision(tr, known))
            const what = `${amount} ${tickerOf(tr)}`
            const fees =
              (tr.platform_fee_sat ?? tr.fee_sat) + (tr.network_fee_sat ?? 0)
            const url = config ? getTxExplorerUrl(config.key, tr.txid) : null
            return (
              <tr className="border-t border-divider/10" key={tr.id}>
                <td className="whitespace-nowrap px-4 py-3 text-content-secondary">
                  {new Date(tr.ts * 1000).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span className="flex flex-col">
                    <span className="font-medium text-content-primary">
                      {tr.side === 'buy'
                        ? t('p2pHome.bought', {
                            defaultValue: 'Bought {{what}}',
                            what,
                          })
                        : t('p2pHome.sold', {
                            defaultValue: 'Sold {{what}}',
                            what,
                          })}
                    </span>
                    <span className="text-xs text-content-tertiary">
                      {tr.role === 'maker'
                        ? t('p2pSwaps.asMaker', {
                            defaultValue: 'Your offer was taken',
                          })
                        : t('p2pSwaps.asTaker', {
                            defaultValue: 'You took an offer',
                          })}
                    </span>
                    <NostrParticipants
                      makers={[tr.maker_npub]}
                      taker={tr.taker_npub}
                    />
                    {tr.error && (
                      <span className="text-xs text-status-danger">
                        {tr.error}
                      </span>
                    )}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-content-primary">
                  {tr.side === 'buy' ? '−' : '+'}
                  {fmtSats(tr.price_sat)} sats
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-content-secondary">
                  {fmtSats(fees)} sats
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs ${toneClass[tone]}`}
                  >
                    {label}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {url && (
                    <button
                      aria-label={t('common.viewInExplorer', {
                        defaultValue: 'View in explorer',
                      })}
                      className="text-content-tertiary transition-colors hover:text-primary"
                      onClick={() => void openUrl(url)}
                      type="button"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
