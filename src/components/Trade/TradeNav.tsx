// Shared trade-mode navigation. Gives every trading page (Market Maker, Manual,
// Nostr P2P, DCA, Limit Orders) one consistent tab strip instead of each page
// inventing its own header.

import { ArrowLeftRight, Radio, Store, Target, TrendingUp } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import { twJoin } from 'tailwind-merge'

import {
  TRADE_MARKET_MAKER_PATH,
  TRADE_MANUAL_PATH,
  TRADE_NOSTR_P2P_PATH,
  TRADE_DCA_PATH,
  TRADE_LIMIT_PATH,
} from '../../app/router/paths'

const TABS: {
  to?: string
  icon: React.ReactNode
  labelKey: string
  fallback: string
  disabled?: boolean
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
  {
    disabled: true,
    fallback: 'Nostr P2P',
    icon: <Radio className="h-4 w-4" />,
    labelKey: 'navigation.nostrP2P',
  },
]

export const TradeNav: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div className="mb-6 w-full border-b border-border-default flex">
      {TABS.map((tab) =>
        tab.disabled ? (
          <div
            className="flex-1 flex items-center gap-2 px-6 py-3 font-medium relative justify-center opacity-50 cursor-not-allowed"
            key={tab.fallback}
          >
            <div className="p-1.5 rounded-md bg-transparent text-content-secondary">
              {tab.icon}
            </div>
            <span className="text-content-secondary">
              {t(tab.labelKey, { defaultValue: tab.fallback })}
            </span>
            <span className="text-[0.6rem] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-semibold">
              {t('labels.soon')}
            </span>
          </div>
        ) : (
          <NavLink
            className={({ isActive }) =>
              twJoin(
                'flex-1 flex items-center gap-2 px-6 py-3 font-medium relative justify-center transition-colors duration-200',
                isActive
                  ? 'text-primary'
                  : 'text-content-secondary hover:text-white'
              )
            }
            end
            key={tab.to}
            to={tab.to!}
          >
            {({ isActive }) => (
              <>
                <div
                  className={twJoin(
                    'p-1.5 rounded-md',
                    isActive ? 'bg-primary/10 text-primary' : 'bg-transparent'
                  )}
                >
                  {tab.icon}
                </div>
                <span>{t(tab.labelKey, { defaultValue: tab.fallback })}</span>
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </>
            )}
          </NavLink>
        )
      )}
    </div>
  )
}
