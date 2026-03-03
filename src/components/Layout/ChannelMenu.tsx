import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { twJoin } from 'tailwind-merge'

import {
  CHANNELS_PATH,
  CREATE_NEW_CHANNEL_PATH,
  ORDER_CHANNEL_PATH,
} from '../../app/router/paths'
import { useAppDispatch } from '../../app/store/hooks'
import { useOnClickOutside } from '../../hooks/useOnClickOutside'
import { ArrowDownIcon } from '../../icons/ArrowDown'
import { uiSliceActions } from '../../slices/ui/ui.slice'

export const ChannelMenu = () => {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const items = [
    {
      label: 'Create New Channel',
      onClick: () => navigate(CREATE_NEW_CHANNEL_PATH),
    },
    {
      label: 'Buy a New Channel',
      onClick: () => navigate(ORDER_CHANNEL_PATH),
    },
    {
      label: 'Manage Your Channels',
      onClick: () => navigate(CHANNELS_PATH),
    },
    {
      label: 'Deposit',
      onClick: () =>
        dispatch(
          uiSliceActions.setModal({ assetId: undefined, type: 'deposit' })
        ),
    },
    {
      label: 'Withdraw',
      onClick: () =>
        dispatch(
          uiSliceActions.setModal({ assetId: undefined, type: 'withdraw' })
        ),
    },
  ]

  useOnClickOutside(menuRef, () => setIsOpen(false))

  return (
    <div className="relative" ref={menuRef}>
      <div
        className="px-4 py-3 cursor-pointer flex items-center space-x-2"
        onClick={() => setIsOpen((state) => !state)}
      >
        <span className="flex-1">Channels</span>

        <ArrowDownIcon />
      </div>

      <ul
        className={twJoin(
          'absolute top-full right-0 bg-surface-high divide-y divide-divider rounded w-64 z-40',
          !isOpen ? 'hidden' : undefined
        )}
      >
        {items.map((item) => (
          <li
            className="px-4 py-3 cursor-pointer first:rounded-t last:rounded-b hover:bg-divider capitalize"
            key={item.label}
            onClick={() => {
              setIsOpen(false)
              item.onClick()
            }}
          >
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
