import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Component as AssetsHistory } from '../wallet-history/assets'
import { Component as DepositsHistory } from '../wallet-history/deposits'
import { Component as WithdrawalsHistory } from '../wallet-history/withdrawals'

type Tab = 'assets' | 'deposits' | 'withdrawals'

/**
 * The trading wallet's assets and its history, on the app's own wallet screens: while the P2P app
 * is open they read the trading wallet.
 */
export const Component = () => {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('assets')
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
        <h1 className="text-2xl font-bold tracking-tight text-content-primary">
          {t('p2pShell.wallet', { defaultValue: 'Wallet' })}
        </h1>
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
      </header>
      {tab === 'assets' && <AssetsHistory />}
      {tab === 'deposits' && <DepositsHistory />}
      {tab === 'withdrawals' && <WithdrawalsHistory />}
    </div>
  )
}
