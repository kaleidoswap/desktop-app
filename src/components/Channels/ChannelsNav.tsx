import { Layers, PlusCircle, ShoppingCart, Tag } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import { twJoin } from 'tailwind-merge'

import {
  CHANNELS_PATH,
  CREATE_NEW_CHANNEL_PATH,
  ORDER_CHANNEL_PATH,
} from '../../app/router/paths'

const TABS: {
  to: string
  icon: React.ReactNode
  labelKey: string
  fallback: string
  end?: boolean
}[] = [
  {
    end: true,
    fallback: 'Manage Channels',
    icon: <Layers className="h-4 w-4" />,
    labelKey: 'channels.manageChannels',
    to: CHANNELS_PATH,
  },
  {
    fallback: 'Open Channel',
    icon: <PlusCircle className="h-4 w-4" />,
    labelKey: 'navigation.openChannel',
    to: CREATE_NEW_CHANNEL_PATH,
  },
  {
    fallback: 'Buy Channel',
    icon: <ShoppingCart className="h-4 w-4" />,
    labelKey: 'navigation.buyChannel',
    to: ORDER_CHANNEL_PATH,
  },
]

export const ChannelsNav: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div className="mb-6 w-full border-b border-border-default flex">
      {TABS.map((tab) => (
        <NavLink
          className={({ isActive }) =>
            twJoin(
              'flex-1 flex items-center gap-2 px-6 py-3 font-medium relative justify-center transition-colors duration-200',
              isActive
                ? 'text-primary'
                : 'text-content-secondary hover:text-white'
            )
          }
          end={tab.end}
          key={tab.to}
          to={tab.to}
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
      ))}

      {/* Sell Channels — disabled, coming soon */}
      <div className="flex-1 flex items-center gap-2 px-6 py-3 font-medium relative justify-center opacity-50 cursor-not-allowed text-content-secondary">
        <div className="p-1.5 rounded-md bg-transparent">
          <Tag className="h-4 w-4" />
        </div>
        <span>
          {t('liquidity.sellChannels', { defaultValue: 'Sell Channels' })}
        </span>
        <span className="text-[0.6rem] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-semibold">
          {t('labels.soon')}
        </span>
      </div>
    </div>
  )
}
