import {
  ArrowDownUp,
  Coins,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useState } from 'react'
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

const getIndicatorColor = (color: string) => {
  switch (color) {
    case 'amber':
      return 'from-amber-500 to-yellow-500'
    case 'green':
      return 'from-green-500 to-emerald-500'
    case 'red':
      return 'from-red-500 to-rose-500'
    case 'blue':
      return 'from-blue-500 to-cyan-500'
    case 'purple':
      return 'from-purple-500 to-pink-500'
    default:
      return 'from-slate-500 to-slate-600'
  }
}

const getIconBgColor = (color: string) => {
  switch (color) {
    case 'amber':
      return 'bg-amber-500/10 text-amber-500'
    case 'green':
      return 'bg-green-500/10 text-green-500'
    case 'red':
      return 'bg-red-500/10 text-red-500'
    case 'blue':
      return 'bg-blue-500/10 text-blue-500'
    case 'purple':
      return 'bg-purple-500/10 text-purple-500'
    default:
      return 'bg-content-tertiary/10 text-content-tertiary'
  }
}

export const Component = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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

  const activeTabData = TABS.find((tab) =>
    location.pathname.startsWith(tab.path)
  )

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="mb-6">
        <p className="text-content-secondary text-sm">
          {t('history.description')}
        </p>
      </div>

      {/* Desktop Tabs */}
      <div className="hidden md:flex mb-6 border-b border-border-default">
        {TABS.map((tab) => {
          const isActive = location.pathname.startsWith(tab.path)
          return (
            <Link
              className={twJoin(
                'flex-1 flex items-center gap-2 px-6 py-3 font-medium relative justify-center',
                isActive
                  ? 'text-white'
                  : 'text-content-secondary hover:text-white'
              )}
              key={tab.path}
              to={tab.path}
            >
              <div
                className={twJoin(
                  'p-1.5 rounded-md',
                  isActive ? getIconBgColor(tab.color) : 'bg-transparent'
                )}
              >
                {tab.icon}
              </div>
              <span>{tab.label}</span>
              {isActive && (
                <div
                  className={twJoin(
                    'absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r',
                    getIndicatorColor(tab.color)
                  )}
                />
              )}
            </Link>
          )
        })}
      </div>

      {/* Mobile Dropdown */}
      <div className="md:hidden mb-6">
        <button
          className="flex items-center justify-between w-full px-4 py-3 bg-surface-overlay rounded-lg border border-border-default"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          <div className="flex items-center gap-2">
            <div
              className={twJoin(
                'p-1.5 rounded-md',
                getIconBgColor(activeTabData?.color || 'default')
              )}
            >
              {activeTabData?.icon}
            </div>
            <span className="font-medium">{activeTabData?.label}</span>
          </div>
          {isMobileMenuOpen ? (
            <ChevronUp className="w-5 h-5 text-content-secondary" />
          ) : (
            <ChevronDown className="w-5 h-5 text-content-secondary" />
          )}
        </button>

        {isMobileMenuOpen && (
          <div className="mt-2 bg-surface-overlay rounded-lg border border-border-default overflow-hidden">
            {TABS.map((tab) => {
              const isActive = location.pathname.startsWith(tab.path)
              return (
                <Link
                  className={twJoin(
                    'flex items-center gap-2 px-4 py-3 font-medium',
                    isActive
                      ? 'bg-surface-high text-white'
                      : 'text-content-secondary hover:bg-surface-high/50 hover:text-white'
                  )}
                  key={tab.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  to={tab.path}
                >
                  <div
                    className={twJoin(
                      'p-1.5 rounded-md',
                      isActive ? getIconBgColor(tab.color) : 'bg-transparent'
                    )}
                  >
                    {tab.icon}
                  </div>
                  <span>{tab.label}</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <Outlet />
    </div>
  )
}
