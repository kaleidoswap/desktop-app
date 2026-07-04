import { ArrowDownUp, Coins, ArrowDown, ArrowUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { twJoin } from 'tailwind-merge'

import {
  WALLET_HISTORY_ASSETS_PATH,
  WALLET_HISTORY_CHANNEL_ORDERS_PATH,
  WALLET_HISTORY_DEPOSITS_PATH,
  WALLET_HISTORY_TRADES_PATH,
  WALLET_HISTORY_WITHDRAWALS_PATH,
} from '../../app/router/paths'

export const Component = () => {
  const { t } = useTranslation()
  const location = useLocation()

  const TABS = [
    {
      color: 'green',
      icon: <ArrowDown className="w-5 h-5" />,
      label: t('history.deposits'),
      path: WALLET_HISTORY_DEPOSITS_PATH,
    },
    {
      color: 'red',
      icon: <ArrowUp className="w-5 h-5" />,
      label: t('history.paymentsWithdrawals'),
      path: WALLET_HISTORY_WITHDRAWALS_PATH,
    },
    {
      color: 'blue',
      icon: <ArrowDownUp className="w-5 h-5" />,
      label: t('history.swaps'),
      path: WALLET_HISTORY_TRADES_PATH,
    },
    {
      color: 'purple',
      icon: <Coins className="w-5 h-5" />,
      label: t('history.assets'),
      path: WALLET_HISTORY_ASSETS_PATH,
    },
    {
      color: 'orange',
      icon: <ArrowDownUp className="w-5 h-5" />,
      label: t('history.channelOrders'),
      path: WALLET_HISTORY_CHANNEL_ORDERS_PATH,
    },
  ]

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="mb-6">
        <p className="text-content-secondary text-sm">
          {t('history.description')}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-surface-base/35 p-1 w-fit mb-6">
        {TABS.map((tab) => {
          const isActive = location.pathname.startsWith(tab.path)
          return (
            <Link
              className={twJoin(
                'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 focus:outline-none border',
                isActive
                  ? 'bg-primary/15 text-primary border-primary/30'
                  : 'text-content-secondary hover:text-white border-transparent'
              )}
              key={tab.path}
              to={tab.path}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>

      <Outlet />
    </div>
  )
}
