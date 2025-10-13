import React from 'react'

import { BitcoinChannelSelector } from '../BitcoinChannelSelector'

interface BitcoinChannelSectionProps {
  totalCapacity: number
  clientBalance: number
  onCapacityChange: (value: number) => void
  onClientBalanceChange: (value: number) => void
  minCapacity?: number
  maxCapacity?: number
  minClientBalance?: number
  maxClientBalance?: number
  capacityPresets?: number[]
  containerClassName?: string
}

export const BitcoinChannelSection: React.FC<BitcoinChannelSectionProps> = ({
  totalCapacity,
  clientBalance,
  onCapacityChange,
  onClientBalanceChange,
  minCapacity,
  maxCapacity,
  minClientBalance,
  maxClientBalance,
  capacityPresets = [50000, 100000, 500000, 1000000],
  containerClassName = 'bg-gray-800/50 p-4 rounded-xl border border-gray-700/50',
}) => {
  return (
    <div className={containerClassName}>
      <BitcoinChannelSelector
        capacityPresets={capacityPresets}
        clientBalance={clientBalance}
        maxCapacity={maxCapacity}
        maxClientBalance={maxClientBalance}
        minCapacity={minCapacity}
        minClientBalance={minClientBalance}
        onCapacityChange={onCapacityChange}
        onClientBalanceChange={onClientBalanceChange}
        totalCapacity={totalCapacity}
      />
    </div>
  )
}
