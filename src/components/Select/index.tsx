import { useRef, useState } from 'react'
import { twJoin } from 'tailwind-merge'

import { useOnClickOutside } from '../../hooks/useOnClickOutside'
import { ArrowDownIcon } from '../../icons/ArrowDown'

interface Props {
  active?: string
  options: { value: string; label: string }[]
  onSelect: (value: string) => void
  theme?: 'light' | 'dark'
}

export const Select = ({
  active,
  options,
  onSelect,
  theme = 'dark',
}: Props) => {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  useOnClickOutside(menuRef, () => setIsOpen(false))

  const activeOption = options.find((option) => option.value === active)
  return (
    <div className="relative" ref={menuRef}>
      <div
        className={twJoin(
          'flex items-center justify-between px-4 py-3 rounded cursor-pointer w-32',
          theme === 'dark' ? 'bg-blue-dark' : 'bg-section-lighter'
        )}
        onClick={() => setIsOpen((state) => !state)}
      >
        <span>{activeOption?.label ?? 'None'}</span>

        <ArrowDownIcon />
      </div>

      <ul
        className={twJoin(
          'absolute top-full bg-section-lighter divide-y divide-divider rounded',
          !isOpen ? 'hidden' : undefined
        )}
      >
        {options.map((option) => (
          <li
            className="px-4 py-3 cursor-pointer hover:bg-divider first:rounded-t last:rounded-b"
            key={option.value}
            onClick={() => {
              onSelect(option.value)
              setIsOpen(false)
            }}
          >
            {option.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
