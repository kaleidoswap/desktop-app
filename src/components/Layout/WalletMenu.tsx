import { useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { twJoin } from 'tailwind-merge'

import { WALLET_DASHBOARD_PATH, SETTINGS_PATH } from '../../app/router/paths'
import { useOnClickOutside } from '../../hooks/useOnClickOutside'
import { ArrowDownIcon } from '../../icons/ArrowDown'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'

const ITEMS = [
  { label: 'Wallet Dashboard', to: WALLET_DASHBOARD_PATH },
  { label: 'Settings', to: SETTINGS_PATH },
]

export const WalletMenu = () => {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)
  const nodeInfo = nodeApi.endpoints.nodeInfo.useQueryState()

  useOnClickOutside(menuRef, () => setIsOpen(false))

  return (
    <div className="relative" ref={menuRef}>
      <div
        className="px-4 py-3 border border-purple rounded cursor-pointer flex items-center space-x-2"
        onClick={() => setIsOpen((state) => !state)}
      >
        <svg
          className={twJoin(
            'fill-current',
            nodeInfo.isSuccess ? 'text-green' : 'text-red'
          )}
          height="10"
          viewBox="0 0 10 10"
          width="10"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="5" cy="5" r="5" />
        </svg>

        <span>{nodeInfo.isSuccess ? 'Online' : 'Offline'}</span>

        <ArrowDownIcon />
      </div>

      <ul
        className={twJoin(
          'absolute top-full right-0 bg-section-lighter divide-y divide-divider rounded w-64 z-40',
          !isOpen ? 'hidden' : undefined
        )}
      >
        {ITEMS.map((item) => (
          <li
            className="first:rounded-t last:rounded-b hover:bg-divider"
            key={item.to}
          >
            <NavLink
              className="block px-4 py-3 cursor-pointer"
              onClick={() => setIsOpen(false)}
              to={item.to}
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}
