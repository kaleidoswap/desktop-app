// Shared trade-mode navigation. Gives every trading page (Market Maker, Manual,
// Nostr P2P, DCA, Limit Orders) one consistent tab strip instead of each page
// inventing its own header.

import { ArrowLeftRight, Radio, Store, Target, TrendingUp } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'

import {
  TRADE_MARKET_MAKER_PATH,
  TRADE_MANUAL_PATH,
  TRADE_NOSTR_P2P_PATH,
  TRADE_DCA_PATH,
  TRADE_LIMIT_PATH,
} from '../../app/router/paths'

const TABS: {
  to: string
  icon: React.ReactNode
  labelKey: string
  fallback: string
}[] = [
  {
    fallback: 'Market Maker',
    icon: <Store className="h-4 w-4" />,
    labelKey: 'navigation.marketMaker',
    to: TRADE_MARKET_MAKER_PATH,
  },
  {
    fallback: 'Manual Swaps',
    icon: <ArrowLeftRight className="h-4 w-4" />,
    labelKey: 'navigation.manualSwaps',
    to: TRADE_MANUAL_PATH,
  },
  {
    fallback: 'Nostr P2P',
    icon: <Radio className="h-4 w-4" />,
    labelKey: 'navigation.nostrP2P',
    to: TRADE_NOSTR_P2P_PATH,
  },
  {
    fallback: 'DCA',
    icon: <TrendingUp className="h-4 w-4" />,
    labelKey: 'navigation.dca',
    to: TRADE_DCA_PATH,
  },
  {
    fallback: 'Limit Orders',
    icon: <Target className="h-4 w-4" />,
    labelKey: 'navigation.limitOrders',
    to: TRADE_LIMIT_PATH,
  },
]

export const TradeNav: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div className="mb-6 w-full flex justify-center px-1">
      <div className="inline-flex flex-wrap items-center gap-1.5 rounded-2xl border border-border-subtle bg-surface-raised/80 p-1.5 shadow-sm backdrop-blur-sm">
        {TABS.map((tab) => (
          <NavLink
            className={({ isActive }) =>
              `inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-status-success/15 text-status-success border border-status-success/30 shadow-sm'
                  : 'text-content-secondary hover:text-content-primary border border-transparent'
              }`
            }
            end
            key={tab.to}
            to={tab.to}
          >
            {tab.icon}
            {t(tab.labelKey, { defaultValue: tab.fallback })}
          </NavLink>
        ))}
      </div>
    </div>
  )
}
