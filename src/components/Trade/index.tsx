import React, { useState, useRef } from 'react'
import { twJoin } from 'tailwind-merge'

import { useOnClickOutside } from '../../hooks/useOnClickOutside'
import { ArrowDownIcon } from '../../icons/ArrowDown'

import { AssetOption } from './AssetComponents'
import { ExchangeRateDisplay } from './ExchangeRateSection'

interface SelectProps {
  active?: string
  options: Array<{ value: string; ticker?: string }>
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
          'flex items-center justify-between px-4 py-3 rounded cursor-pointer min-w-[8rem] w-auto',
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
            'absolute top-full left-0 z-50 min-w-full w-auto bg-section-lighter divide-y divide-divider rounded shadow-lg overflow-visible',
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

interface AssetSelectProps {
  options: Array<{ value: string; ticker?: string }>
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

const AssetSelect: React.FC<AssetSelectProps> = ({
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

export { NoChannelsMessage } from './NoChannelsMessage'
export { Header } from './Header'
export { SizeButtons } from './SizeButtons'
export { SwapInputField } from './SwapInputField'
export { ExchangeRateSection } from './ExchangeRateSection'
export { SwapButton } from './SwapButton'
export { MakerSelector } from './MakerSelector'
export { AssetOption, AssetSelect, ExchangeRateDisplay }
export { ManualSwapForm } from './ManualSwapForm'
export { NostrP2P } from './NostrP2P'
export { TradeForm } from './TradeForm'
export { FeeSection } from './FeeSection'
export { TakerSwapForm } from './TakerSwapForm'
