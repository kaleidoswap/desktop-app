import {
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'kaleido-ui'
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
      <PageHeader title={title} variant="page" />
      <Tabs defaultValue="swaps">
        <TabsList
          aria-label={title}
          className="h-auto max-w-full flex-wrap justify-start"
        >
          {tabs.map(({ value, label }) => (
            <TabsTrigger key={value} value={value}>
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
