import {
  ArrowDownUp,
  Coins,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { twJoin } from 'tailwind-merge'

import {
  WALLET_HISTORY_ASSETS_PATH,
  WALLET_HISTORY_DEPOSITS_PATH,
  WALLET_HISTORY_PATH,
  WALLET_HISTORY_TRADES_PATH,
  WALLET_HISTORY_WITHDRAWALS_PATH,
} from '../../app/router/paths'

const TABS = [
  {
    color: 'green',
    icon: <ArrowDown className="w-5 h-5" />,
    label: 'Deposits',
    path: WALLET_HISTORY_DEPOSITS_PATH,
  },
  {
    color: 'red',
    icon: <ArrowUp className="w-5 h-5" />,
    label: 'Withdrawals',
    path: WALLET_HISTORY_WITHDRAWALS_PATH,
  },
  {
    color: 'blue',
    icon: <ArrowDownUp className="w-5 h-5" />,
    label: 'Swaps',
    path: WALLET_HISTORY_TRADES_PATH,
  },
  {
    color: 'purple',
    icon: <Coins className="w-5 h-5" />,
    label: 'Assets',
    path: WALLET_HISTORY_ASSETS_PATH,
  },
]

const getIndicatorColor = (color: string) => {
  switch (color) {
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
    case 'green':
      return 'bg-green-500/10 text-green-500'
    case 'red':
      return 'bg-red-500/10 text-red-500'
    case 'blue':
      return 'bg-blue-500/10 text-blue-500'
    case 'purple':
      return 'bg-purple-500/10 text-purple-500'
    default:
      return 'bg-slate-500/10 text-slate-500'
  }
}

export const Component = () => {
  const location = useLocation()
  const [activeTab, setActiveTab] = useState(TABS[0].path)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    // Find the tab that matches the current path
    const matchingTab = TABS.find((tab) => location.pathname === tab.path)
    if (matchingTab) {
      setActiveTab(matchingTab.path)
    } else if (location.pathname === WALLET_HISTORY_PATH) {
      // Default to deposits if we're at the base history path
      setActiveTab(TABS[0].path)
    }
  }, [location.pathname])

  const activeTabData = TABS.find((tab) => tab.path === activeTab)

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Wallet History</h1>
        <p className="text-slate-400">
          View your transaction history, including deposits, withdrawals, and
          swaps.
        </p>
      </div>

      {/* Desktop Tabs */}
      <div className="hidden md:flex mb-6 border-b border-gray-700">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.path
          return (
            <Link
              className={twJoin(
                'flex items-center gap-2 px-6 py-3 font-medium relative',
                isActive ? 'text-white' : 'text-slate-400 hover:text-white'
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
          className="flex items-center justify-between w-full px-4 py-3 bg-gray-800 rounded-lg border border-gray-700"
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
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>

        {isMobileMenuOpen && (
          <div className="mt-2 bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.path
              return (
                <Link
                  className={twJoin(
                    'flex items-center gap-2 px-4 py-3 font-medium',
                    isActive
                      ? 'bg-gray-700 text-white'
                      : 'text-slate-400 hover:bg-gray-700/50 hover:text-white'
                  )}
                  key={tab.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  to={tab.path}
                >
                  <div
                    className={twJoin(
                      'p-1.5 rounded-md',
                      getIconBgColor(tab.color)
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
