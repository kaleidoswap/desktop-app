import { PlusCircle, ShoppingCart, SlidersHorizontal } from 'lucide-react'
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
    icon: <SlidersHorizontal className="h-4 w-4" />,
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
    <div className="mb-4 w-full border-b border-border-default flex overflow-x-auto">
      {TABS.map((tab) => (
        <NavLink
          className={({ isActive }) =>
            twJoin(
              'shrink-0 flex items-center gap-2 px-3 py-2.5 text-sm whitespace-nowrap font-medium relative justify-center transition-colors duration-200',
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
                  'p-1 rounded-md',
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
    </div>
  )
}
