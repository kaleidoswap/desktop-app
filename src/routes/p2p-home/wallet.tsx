import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { networkLabel } from '../trade/nostr-p2p/format'
import { useP2pSession } from '../trade/nostr-p2p/session'
import { WalletSwitch } from '../trade/nostr-p2p/WalletSwitch'
import { Component as AssetsHistory } from '../wallet-history/assets'
import { Component as DepositsHistory } from '../wallet-history/deposits'
import { Component as WithdrawalsHistory } from '../wallet-history/withdrawals'

type Tab = 'assets' | 'deposits' | 'withdrawals'

/**
 * The trading wallet: which one is open, its assets and its history, on the app's own wallet
 * screens (while the P2P app is open they read the trading wallet).
 */
export const Component = () => {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('assets')
  const session = useP2pSession()
  const tabs: [Tab, string][] = [
    ['assets', t('p2pMarket.tabAssets', { defaultValue: 'Assets' })],
    ['deposits', t('p2pMarket.tabDeposits', { defaultValue: 'Deposits' })],
    [
      'withdrawals',
      t('p2pMarket.tabWithdrawals', { defaultValue: 'Withdrawals' }),
    ],
  ]
  return (
    <div className="flex flex-col gap-5">
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
        <div className="ml-auto">
          <WalletSwitch
            onCreate={session.addWallet}
            onSelect={session.chooseWallet}
            selectedId={session.walletId}
            wallets={session.wallets}
          />
        </div>
      </header>
      {tab === 'assets' && <AssetsHistory />}
      {tab === 'deposits' && <DepositsHistory />}
      {tab === 'withdrawals' && <WithdrawalsHistory />}
    </div>
  )
}
