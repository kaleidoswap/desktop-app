import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'
import {
  WALLET_HISTORY_DEPOSITS_PATH,
  WALLET_HISTORY_WITHDRAWALS_PATH,
  WALLET_HISTORY_TRADES_PATH,
  WALLET_HISTORY_ASSETS_PATH,
  WALLET_HISTORY_CHANNEL_ORDERS_PATH,
} from '../../app/router/paths'
import { WalletNodeSources } from '../p2p-home/WalletNodeSources'
import { RouteTabs, type RouteTab } from '../../components/Layout/RouteTabs'

const tabs: RouteTab[] = [
  {
    icon: 'download',
    labelKey: 'history.deposits',
    to: WALLET_HISTORY_DEPOSITS_PATH,
  },
  {
    icon: 'upload',
    labelKey: 'history.paymentsWithdrawals',
    to: WALLET_HISTORY_WITHDRAWALS_PATH,
  },
  {
    icon: 'swap_horiz',
    labelKey: 'history.swaps',
    to: WALLET_HISTORY_TRADES_PATH,
  },
  {
    icon: 'layers',
    labelKey: 'history.assets',
    to: WALLET_HISTORY_ASSETS_PATH,
  },
  {
    icon: 'receipt_long',
    labelKey: 'history.channelOrders',
    to: WALLET_HISTORY_CHANNEL_ORDERS_PATH,
  },
]

export function Component() {
  const { t } = useTranslation()
  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      <WalletNodeSources section="activity" source="node" />
      <RouteTabs label={t('unified.activity')} tabs={tabs} />
      <Outlet />
    </div>
  )
}
