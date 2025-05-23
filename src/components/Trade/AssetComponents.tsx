import React, { useState, useRef } from 'react'
import { twJoin } from 'tailwind-merge'

import defaultIcon from '../../assets/rgb-symbol-color.svg'
import { useAssetIcon } from '../../helpers/utils'
import { useOnClickOutside } from '../../hooks/useOnClickOutside'
import { ArrowDownIcon } from '../../icons/ArrowDown'

export interface AssetOptionProps {
  ticker?: string
}

export const AssetOption = React.memo(({ ticker }: AssetOptionProps) => {
  const displayTicker = ticker || 'None'
  const iconTicker =
    displayTicker === 'SAT'
      ? 'BTC'
      : displayTicker === 'None' || !displayTicker
        ? ''
        : displayTicker

  const [imgSrc, setImgSrc] = useAssetIcon(iconTicker, defaultIcon)

  return (
    <div className="flex items-center">
      <img
        alt={displayTicker}
        className="w-5 h-5 mr-2"
        onError={() => setImgSrc(defaultIcon)}
        src={!iconTicker ? defaultIcon : imgSrc}
      />
      {displayTicker}
    </div>
  )
})
AssetOption.displayName = 'AssetOption'

interface SelectProps {
  active?: string
  options: Array<{ value: string; label: string; ticker?: string }>
  onSelect: (value: string) => void
  theme: 'light' | 'dark'
  disabled?: boolean
}

const Select: React.FC<SelectProps> = (props) => {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  useOnClickOutside(menuRef, () => setIsOpen(false))

  const active = props.options.find((option) => option.value === props.active)

  return (
    <div className="relative" ref={menuRef}>
      <div
        className={twJoin(
          'flex items-center justify-between px-4 py-3 rounded cursor-pointer w-full',
          props.theme === 'dark' ? 'bg-blue-dark' : 'bg-section-lighter',
          props.disabled ? 'opacity-50 cursor-not-allowed' : ''
        )}
        onClick={() => !props.disabled && setIsOpen((state) => !state)}
      >
        <AssetOption ticker={active?.ticker} />
        <ArrowDownIcon />
      </div>

      {!props.disabled && (
        <ul
          className={twJoin(
            'absolute top-full left-0 right-0 bg-section-lighter divide-y divide-divider rounded z-50 mt-1 shadow-lg max-h-60 overflow-y-auto',
            !isOpen ? 'hidden' : 'block'
          )}
        >
          {props.options.map((option) => (
            <li
              className="px-4 py-3 cursor-pointer hover:bg-divider first:rounded-t last:rounded-b whitespace-nowrap"
              key={option.value}
              onClick={() => {
                props.onSelect(option.value)
                setIsOpen(false)
              }}
              title={option.ticker || option.value}
            >
              <AssetOption ticker={option.ticker} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

Select.defaultProps = {
  theme: 'dark',
}

export interface AssetSelectProps {
  options: Array<{ value: string; label: string; ticker?: string }>
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export const AssetSelect: React.FC<AssetSelectProps> = ({
  options,
  value,
  onChange,
  disabled = false,
}) => (
  <Select
    active={value}
    disabled={disabled}
    onSelect={onChange}
    options={options}
    theme="dark"
  />
)

export interface AssetComponentsProps {
  // Define any props needed for the component
  children?: React.ReactNode
}

export const AssetComponents: React.FC<AssetComponentsProps> = ({
  children,
}) => {
  return <>{children}</>
}
