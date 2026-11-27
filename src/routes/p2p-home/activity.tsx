import { Tabs, TabsContent, TabsList, TabsTrigger } from 'kaleido-ui'
import { useTranslation } from 'react-i18next'

import { Component as AssetsHistory } from '../wallet-history/assets'
import { Component as DepositsHistory } from '../wallet-history/deposits'
import { Component as WithdrawalsHistory } from '../wallet-history/withdrawals'
import { SwapsHistory } from './SwapsHistory'

export const Component = () => {
  const { t } = useTranslation()
  const title = t('unified.activity', { defaultValue: 'Activity' })
  const tabs = [
    {
      Panel: SwapsHistory,
      label: t('p2pSwaps.tab', { defaultValue: 'Swaps' }),
      value: 'swaps',
    },
    {
      Panel: DepositsHistory,
      label: t('p2pMarket.tabDeposits', { defaultValue: 'Deposits' }),
      value: 'deposits',
    },
    {
      Panel: WithdrawalsHistory,
      label: t('p2pMarket.tabWithdrawals', { defaultValue: 'Withdrawals' }),
      value: 'withdrawals',
    },
    {
      Panel: AssetsHistory,
      label: t('p2pWallet.assetTransfers', { defaultValue: 'Asset transfers' }),
      value: 'assets',
    },
  ]

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <Tabs defaultValue="swaps">
        <TabsList
          aria-label={title}
          className="h-auto w-full max-w-full flex-wrap justify-start gap-1 rounded-none border-b border-divider/30 bg-transparent p-0"
        >
          {tabs.map(({ value, label }) => (
            <TabsTrigger
              className="rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-content-secondary shadow-none hover:text-content-primary data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-brand data-[state=active]:shadow-none"
              key={value}
              value={value}
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map(({ value, Panel }) => (
          <TabsContent key={value} value={value}>
            <Panel />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  )
}
