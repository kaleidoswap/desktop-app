import { ArrowDownLeft, ArrowUpRight, Coins, Copy, Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { useAppDispatch } from '../../app/store/hooks'
import { IssueAssetModal } from '../../components/IssueAssetModal'
import { UTXOManagementModal } from '../../components/UTXOManagementModal'
import { useSettings } from '../../hooks/useSettings'
import { uiSliceActions } from '../../slices/ui/ui.slice'
import { marketApi } from '../trade/nostr-p2p/api'
import {
  fmtSats,
  fmtUnits,
  networkLabel,
  short,
} from '../trade/nostr-p2p/format'
import { usePoll } from '../trade/nostr-p2p/market/hooks'
import { useP2pSession } from '../trade/nostr-p2p/session'
import { WalletSwitch } from '../trade/nostr-p2p/WalletSwitch'
import { Component as AssetsHistory } from '../wallet-history/assets'
import { Component as DepositsHistory } from '../wallet-history/deposits'
import { Component as WithdrawalsHistory } from '../wallet-history/withdrawals'

import { bitcoinSummary } from './summary'

type Tab = 'assets' | 'deposits' | 'withdrawals'

const ActionButton = ({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
}) => (
  <button
    className="flex min-h-10 items-center gap-2 rounded-lg border border-divider/30 px-3.5 text-sm font-medium text-content-primary transition-colors hover:bg-surface-overlay/50"
    onClick={onClick}
    type="button"
  >
    {icon}
    {label}
  </button>
)

/**
 * The trading wallet: which one is open, what it holds, what can be done with it, and its history
 * on the app's own wallet screens (while the P2P app is open they read the trading wallet).
 */
export const Component = () => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const { bitcoinUnit } = useSettings()
  const session = useP2pSession()
  const balance = usePoll(marketApi.balance, 5_000)
  const info = usePoll(marketApi.info, 60_000)
  const [tab, setTab] = useState<Tab>('deposits')
  const [coins, setCoins] = useState(false)
  const [issue, setIssue] = useState(false)
  const [copied, setCopied] = useState(false)

  const btc = bitcoinSummary(balance.data)
  const coinSizes = balance.data?.btc_coins ?? []
  const assets = [...(balance.data?.assets ?? [])].sort(
    (a, b) => b.total - a.total
  )

  const tabs: [Tab, string][] = [
    ['deposits', t('p2pMarket.tabDeposits', { defaultValue: 'Deposits' })],
    [
      'withdrawals',
      t('p2pMarket.tabWithdrawals', { defaultValue: 'Withdrawals' }),
    ],
    [
      'assets',
      t('p2pWallet.assetTransfers', { defaultValue: 'Asset transfers' }),
    ],
  ]

  const copyNpub = async () => {
    if (!info.data) return
    try {
      await navigator.clipboard.writeText(info.data.npub)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // nothing copied; the key stays on screen
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-4">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight text-content-primary">
            {t('p2pShell.wallet', { defaultValue: 'Wallet' })}
          </h1>
          {session.config && (
            <span className="text-xs text-content-tertiary">
              {networkLabel(session.config.network)} ·{' '}
              {t('p2pShell.onchain', { defaultValue: 'on-chain RGB' })}
            </span>
          )}
        </div>
        <div className="ml-auto">
          <WalletSwitch
            onCreate={session.addWallet}
            onSelect={session.chooseWallet}
            selectedId={session.walletId}
            wallets={session.wallets}
          />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className="flex flex-col gap-4 rounded-2xl border border-divider/10 bg-surface-elevated/40 p-6">
          <div className="flex flex-col gap-1">
            <span className="text-xs tracking-wider text-content-tertiary">
              {t('p2pWallet.bitcoin', { defaultValue: 'BITCOIN' })}
            </span>
            <span className="text-3xl font-bold tracking-tight text-content-primary">
              {balance.data ? `${fmtSats(btc.ready)} sats` : '–'}
            </span>
            {btc.pending > 0 && (
              <span className="text-sm text-status-warning">
                {t('p2pWallet.pending', {
                  defaultValue: '+ {{sats}} sats still confirming',
                  sats: fmtSats(btc.pending),
                })}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm text-content-secondary">
              {t('p2pWallet.coins', {
                count: coinSizes.length,
                defaultValue: '{{count}} coins free for swaps',
              })}
            </span>
            {coinSizes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {coinSizes.map((c, i) => (
                  <span
                    className="rounded-md bg-surface-base px-2 py-1 font-mono text-xs text-content-secondary"
                    key={i}
                  >
                    {fmtSats(c)}
                  </span>
                ))}
              </div>
            )}
            <span className="text-xs leading-relaxed text-content-tertiary">
              {t('p2pWallet.coinsWhy', {
                defaultValue:
                  'Each swap spends a coin of its own, so more coins means more swaps at once.',
              })}
            </span>
          </div>

          <div className="mt-auto flex flex-wrap gap-2">
            <ActionButton
              icon={<ArrowDownLeft className="h-4 w-4" />}
              label={t('p2pHome.receive', { defaultValue: 'Receive' })}
              onClick={() =>
                dispatch(
                  uiSliceActions.setModal({
                    assetId: undefined,
                    type: 'deposit',
                  })
                )
              }
            />
            <ActionButton
              icon={<ArrowUpRight className="h-4 w-4" />}
              label={t('p2pHome.send', { defaultValue: 'Send' })}
              onClick={() =>
                dispatch(
                  uiSliceActions.setModal({
                    assetId: undefined,
                    type: 'withdraw',
                  })
                )
              }
            />
            <ActionButton
              icon={<Coins className="h-4 w-4" />}
              label={t('p2pWallet.manageCoins', {
                defaultValue: 'Manage coins',
              })}
              onClick={() => setCoins(true)}
            />
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-divider/10 bg-surface-elevated/40 p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-medium text-content-primary">
              {t('p2pWallet.assets', { defaultValue: 'Assets' })}
            </h2>
            <ActionButton
              icon={<Plus className="h-4 w-4" />}
              label={t('p2pWallet.issue', { defaultValue: 'Issue an asset' })}
              onClick={() => setIssue(true)}
            />
          </div>
          {assets.length === 0 ? (
            <p className="text-sm text-content-tertiary">
              {t('p2pHome.noAssets', {
                defaultValue:
                  'No assets yet. Buy one on the market or receive one with an RGB invoice.',
              })}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs tracking-wider text-content-tertiary">
                    <th className="pb-2 font-normal">
                      {t('p2pWallet.asset', { defaultValue: 'ASSET' })}
                    </th>
                    <th className="pb-2 text-right font-normal">
                      {t('p2pWallet.total', { defaultValue: 'TOTAL' })}
                    </th>
                    <th className="pb-2 text-right font-normal">
                      {t('p2pWallet.spendable', { defaultValue: 'SPENDABLE' })}
                    </th>
                    <th className="pb-2 text-right font-normal">
                      <span className="sr-only">
                        {t('p2pWallet.actions', { defaultValue: 'Actions' })}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => (
                    <tr className="border-t border-divider/10" key={a.asset_id}>
                      <td className="py-2.5">
                        <span className="flex flex-col">
                          <span className="font-medium text-content-primary">
                            {a.ticker || a.name}
                          </span>
                          <span className="font-mono text-xs text-content-tertiary">
                            {a.name} · {short(a.asset_id, 6)}
                          </span>
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-content-primary">
                        {fmtUnits(a.total, a.precision)}
                      </td>
                      <td
                        className={`py-2.5 text-right ${a.spendable < a.total ? 'text-status-warning' : 'text-content-primary'}`}
                      >
                        {fmtUnits(a.spendable, a.precision)}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          className="text-sm font-medium text-primary hover:underline"
                          onClick={() =>
                            dispatch(
                              uiSliceActions.setModal({
                                assetId: a.asset_id,
                                type: 'deposit',
                              })
                            )
                          }
                          type="button"
                        >
                          {t('p2pHome.receive', { defaultValue: 'Receive' })}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {info.data && (
            <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-divider/10 pt-3 text-xs text-content-tertiary">
              <span>
                {t('p2pWallet.identity', {
                  defaultValue: 'Nostr identity of this wallet',
                })}
              </span>
              <span className="font-mono text-content-secondary">
                {short(info.data.npub, 10)}
              </span>
              <button
                aria-label={t('p2pWallet.copyNpub', {
                  defaultValue: 'Copy the Nostr key',
                })}
                className="flex items-center gap-1 rounded p-1 hover:text-content-primary"
                onClick={() => void copyNpub()}
                type="button"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied && t('p2pWallet.copied', { defaultValue: 'Copied' })}
              </button>
            </div>
          )}
        </section>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-lg font-medium text-content-primary">
            {t('p2pWallet.history', { defaultValue: 'History' })}
          </h2>
          <div
            className="flex gap-1 rounded-xl bg-surface-inset p-1"
            role="tablist"
          >
            {tabs.map(([id, label]) => (
              <button
                aria-selected={tab === id}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === id
                    ? 'bg-surface-raised text-content-primary'
                    : 'text-content-tertiary hover:text-content-secondary'
                }`}
                key={id}
                onClick={() => setTab(id)}
                role="tab"
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {tab === 'assets' && <AssetsHistory />}
        {tab === 'deposits' && <DepositsHistory />}
        {tab === 'withdrawals' && <WithdrawalsHistory />}
      </section>

      {coins && (
        <UTXOManagementModal
          bitcoinUnit={bitcoinUnit}
          onClose={() => {
            setCoins(false)
            balance.refresh()
          }}
        />
      )}
      {issue && (
        <IssueAssetModal
          onClose={() => setIssue(false)}
          onSuccess={() => balance.refresh()}
        />
      )}
    </div>
  )
}
