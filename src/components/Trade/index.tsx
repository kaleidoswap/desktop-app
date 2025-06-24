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
  theme?: 'light' | 'dark'
  disabled?: boolean
}

const Select: React.FC<SelectProps> = ({
  active,
  options,
  onSelect,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  useOnClickOutside(menuRef, () => setIsOpen(false))

  const activeOption = options.find((option) => option.value === active)

  return (
    <div className="relative" ref={menuRef}>
      <div
        className={twJoin(
          'flex items-center justify-between px-4 py-4 rounded-xl cursor-pointer min-w-[120px] w-auto border transition-all duration-200',
          'bg-slate-900/70 border-slate-600/50 hover:border-slate-500/70 backdrop-blur-sm',
          disabled
            ? 'opacity-50 cursor-not-allowed hover:border-slate-600/50'
            : ''
        )}
        onClick={() => !disabled && setIsOpen((state) => !state)}
      >
        <AssetOption ticker={activeOption?.ticker} />
        <ArrowDownIcon
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </div>

      {!disabled && (
        <ul
          className={twJoin(
            'absolute top-full left-0 z-50 min-w-full w-auto mt-2 bg-slate-800/95 backdrop-blur-sm border border-slate-600/50 divide-y divide-slate-700/50 rounded-xl shadow-xl overflow-hidden',
            !isOpen ? 'hidden' : 'block'
          )}
        >
          {options.map((option) => (
            <li
              className="px-4 py-3 cursor-pointer hover:bg-slate-700/50 transition-colors duration-150 whitespace-nowrap"
              key={option.value}
              onClick={() => {
                onSelect(option.value)
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
export { QuickAmountSection } from './QuickAmountSection'
export { SwapInputField } from './SwapInputField'
export { ExchangeRateSection } from './ExchangeRateSection'
export { SwapButton } from './SwapButton'
export { MakerSelector } from './MakerSelector'
export { AssetOption, AssetSelect, ExchangeRateDisplay }
export { EnhancedAssetSelect } from './EnhancedAssetSelect'
export { ManualSwapForm } from './ManualSwapForm'
export { NostrP2P } from './NostrP2P'
export { TradeForm } from './TradeForm'
export { FeeSection } from './FeeSection'
export { TakerSwapForm } from './TakerSwapForm'
export {
  TradablePairsDisplay,
  SupportedAssetsDisplay,
} from './TradablePairsDisplay'
