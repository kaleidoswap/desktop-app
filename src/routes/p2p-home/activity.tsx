import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Component as AssetsHistory } from '../wallet-history/assets'
import { Component as DepositsHistory } from '../wallet-history/deposits'
import { Component as WithdrawalsHistory } from '../wallet-history/withdrawals'
import { SwapsHistory } from './SwapsHistory'

type Tab = 'swaps' | 'assets' | 'deposits' | 'withdrawals'

export const Component = () => {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('swaps')
  const tabs: [Tab, string][] = [
    ['swaps', t('p2pSwaps.tab', { defaultValue: 'Swaps' })],
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

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-content-primary">
          {t('unified.activity', { defaultValue: 'Activity' })}
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
      </div>
      {tab === 'swaps' && <SwapsHistory />}
      {tab === 'assets' && <AssetsHistory />}
      {tab === 'deposits' && <DepositsHistory />}
      {tab === 'withdrawals' && <WithdrawalsHistory />}
    </section>
  )
}
