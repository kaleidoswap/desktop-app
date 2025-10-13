import {
  Zap,
  Send,
  ArrowDownCircle,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import React, { useCallback, useState } from 'react'

import bitcoinIcon from '../../assets/bitcoin-logo.svg'
import { formatNumberWithCommas } from '../../helpers/number'
import './animations.css'

interface BitcoinChannelSelectorProps {
  // Bitcoin capacity
  totalCapacity: number
  onCapacityChange: (value: number) => void
  minCapacity?: number
  maxCapacity?: number
  capacityPresets?: number[]

  // Bitcoin liquidity distribution
  clientBalance: number
  onClientBalanceChange: (value: number) => void
  minClientBalance?: number
  maxClientBalance?: number
}

export const BitcoinChannelSelector: React.FC<BitcoinChannelSelectorProps> = ({
  totalCapacity,
  onCapacityChange,
  capacityPresets = [50000, 100000, 500000, 1000000],
  clientBalance,
  onClientBalanceChange,
  minClientBalance = 0,
  maxClientBalance = Number.MAX_SAFE_INTEGER,
}) => {
  const [showFeeInfo, setShowFeeInfo] = useState(false)

  const lspBalance = totalCapacity - clientBalance
  const clientPercentage =
    totalCapacity > 0 ? (clientBalance / totalCapacity) * 100 : 0
  const lspPercentage = 100 - clientPercentage

  // Fee reserves
  const FEE_RESERVE = 1000 // sats reserved for fees

  // Format functions
  const formatCapacity = (sats: number): string => {
    if (sats >= 1000000) return `${(sats / 1000000).toFixed(1)}M`
    if (sats >= 1000) return `${(sats / 1000).toFixed(0)}k`
    return sats.toString()
  }

  const handleLiquiditySliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10)
      onClientBalanceChange(value)
    },
    [onClientBalanceChange]
  )

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-6 border border-gray-700/50 shadow-2xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <img alt="Bitcoin" className="w-6 h-6" src={bitcoinIcon} />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-yellow-400 to-orange-500">
              Bitcoin Channel
            </span>
          </h3>
        </div>
      </div>

      {/* Capacity Presets */}
      <div className="mb-6">
        <label className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          Channel Capacity
        </label>
        <div className="grid grid-cols-4 gap-2">
          {capacityPresets.map((preset) => {
            const isSelected = totalCapacity === preset

            return (
              <button
                className={`px-3 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
                  isSelected
                    ? 'bg-gradient-to-br from-orange-500 to-yellow-600 text-white shadow-lg shadow-orange-500/30 scale-105'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/70 hover:text-gray-200 border border-gray-700/50'
                }`}
                key={preset}
                onClick={() => {
                  const currentPercentage =
                    totalCapacity > 0 ? clientBalance / totalCapacity : 0.5
                  const newClientBalance = Math.round(
                    preset * currentPercentage
                  )
                  const constrainedBalance = Math.max(
                    minClientBalance,
                    Math.min(
                      Math.min(maxClientBalance, preset),
                      newClientBalance
                    )
                  )

                  onCapacityChange(preset)
                  onClientBalanceChange(constrainedBalance)
                }}
                type="button"
              >
                <div className="flex flex-col items-center gap-1">
                  <span>{formatCapacity(preset)}</span>
                  <span className="text-xs opacity-70">sats</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Liquidity Distribution */}
      <div className="space-y-5">
        <label className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <Send className="w-4 h-4 text-blue-400" />
          Liquidity Distribution
        </label>

        {/* Modern Horizontal Bar */}
        <div className="relative">
          {/* Background bar */}
          <div className="h-20 bg-gray-900/50 rounded-2xl overflow-hidden border-2 border-gray-700/50 shadow-inner relative">
            {/* Client Balance (Blue) */}
            <div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 via-blue-600 to-blue-500 transition-all duration-500 ease-out relative overflow-hidden"
              style={{ width: `${clientPercentage}%` }}
            >
              {/* Animated gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
              {/* Top shine */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent h-1/3" />
            </div>

            {/* LSP Balance (Purple) */}
            <div
              className="absolute right-0 top-0 h-full bg-gradient-to-r from-purple-500 via-purple-600 to-purple-500 transition-all duration-500 ease-out relative overflow-hidden"
              style={{ width: `${lspPercentage}%` }}
            >
              {/* Animated gradient overlay */}
              <div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
                style={{ animationDelay: '0.5s' }}
              />
              {/* Top shine */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent h-1/3" />
            </div>

            {/* Center divider */}
            {clientPercentage > 0 && clientPercentage < 100 && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white/60 shadow-lg shadow-white/50 transition-all duration-500 z-10"
                style={{ left: `${clientPercentage}%` }}
              />
            )}

            {/* Labels overlay */}
            <div className="absolute inset-0 flex items-center justify-between px-4 z-20">
              {/* Left: Spending Balance */}
              {clientPercentage > 15 && (
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-white/90" />
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-white/80">
                      Spending
                    </span>
                    <span className="text-sm font-bold text-white">
                      {formatCapacity(clientBalance)}
                    </span>
                  </div>
                </div>
              )}

              {/* Right: Receiving Capacity */}
              {lspPercentage > 15 && (
                <div className="flex items-center gap-2 ml-auto">
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-semibold text-white/80">
                      Receiving
                    </span>
                    <span className="text-sm font-bold text-white">
                      {formatCapacity(lspBalance)}
                    </span>
                  </div>
                  <ArrowDownCircle className="w-4 h-4 text-white/90" />
                </div>
              )}
            </div>
          </div>

          {/* Stats cards below bar */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {/* Total Capacity */}
            <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/50">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-xs text-gray-400 font-medium">Total</span>
              </div>
              <span className="text-base font-bold text-white">
                {formatNumberWithCommas(totalCapacity.toString())}
              </span>
              <span className="text-xs text-gray-500 ml-1">sats</span>
            </div>

            {/* Spending Balance */}
            <div className="bg-blue-900/20 rounded-xl p-3 border border-blue-700/30">
              <div className="flex items-center gap-2 mb-1">
                <Send className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs text-blue-300 font-medium">
                  Spending
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-bold text-blue-200">
                  {formatNumberWithCommas(clientBalance.toString())}
                </span>
                <span className="text-xs text-blue-400">
                  ({Math.round(clientPercentage)}%)
                </span>
              </div>
            </div>

            {/* Receiving Capacity */}
            <div className="bg-purple-900/20 rounded-xl p-3 border border-purple-700/30">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownCircle className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs text-purple-300 font-medium">
                  Receiving
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-bold text-purple-200">
                  {formatNumberWithCommas(lspBalance.toString())}
                </span>
                <span className="text-xs text-purple-400">
                  ({Math.round(lspPercentage)}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Slider Control */}
        <div className="space-y-3">
          <div className="relative px-1">
            <input
              className="w-full h-2 bg-gray-700/50 rounded-full appearance-none cursor-pointer
                       [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                       [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-blue-400 [&::-webkit-slider-thumb]:to-blue-600
                       [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-grab
                       [&::-webkit-slider-thumb]:active:cursor-grabbing [&::-webkit-slider-thumb]:shadow-xl [&::-webkit-slider-thumb]:shadow-blue-500/50
                       [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
                       [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125 [&::-webkit-slider-thumb]:active:scale-110
                       [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5
                       [&::-moz-range-thumb]:bg-gradient-to-br [&::-moz-range-thumb]:from-blue-400 [&::-moz-range-thumb]:to-blue-600
                       [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-grab
                       [&::-moz-range-thumb]:active:cursor-grabbing [&::-moz-range-thumb]:shadow-xl
                       [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:border-0
                       [&::-moz-range-thumb]:transition-transform [&::-moz-range-thumb]:hover:scale-125"
              max={Math.min(maxClientBalance, totalCapacity)}
              min={minClientBalance}
              onChange={handleLiquiditySliderChange}
              step={1000}
              type="range"
              value={clientBalance}
            />
          </div>

          <div className="flex justify-between text-xs text-gray-500 px-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50" />
              <span>0% Spending</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span>100% Spending</span>
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
            </span>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-900/10 border border-blue-700/30 rounded-xl p-3">
          <div className="flex gap-2">
            <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-200/80 space-y-1">
              <p>
                <strong className="text-blue-300">Spending Balance</strong>{' '}
                (blue): Your outbound liquidity - use this to send payments and
                buy assets.
              </p>
              <p>
                <strong className="text-purple-300">Receiving Capacity</strong>{' '}
                (purple): Inbound liquidity from the LSP - determines how much
                you can receive.
              </p>
            </div>
          </div>
        </div>

        {/* Fee Reserve Notice */}
        <div className="bg-yellow-900/10 border border-yellow-700/30 rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-3 hover:bg-yellow-900/20 transition-colors"
            onClick={() => setShowFeeInfo(!showFeeInfo)}
            type="button"
          >
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              <span className="text-xs font-semibold text-yellow-300">
                {formatNumberWithCommas(FEE_RESERVE.toString())} sats reserved
                for fees on each side
              </span>
            </div>
            {showFeeInfo ? (
              <ChevronUp className="w-4 h-4 text-yellow-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-yellow-400" />
            )}
          </button>

          {showFeeInfo && (
            <div className="px-3 pb-3 pt-1 text-xs text-yellow-200/80 space-y-2 border-t border-yellow-700/20">
              <p className="mt-2">
                <strong className="text-yellow-300">
                  Why are fees reserved?
                </strong>
              </p>
              <p>
                Each side of the channel (your spending balance and the LSP's
                receiving capacity) has{' '}
                <strong>
                  {formatNumberWithCommas(FEE_RESERVE.toString())} sats
                </strong>{' '}
                reserved to cover future on-chain transaction fees.
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>
                  <strong className="text-yellow-300">
                    Client side (
                    {formatNumberWithCommas(FEE_RESERVE.toString())} sats):
                  </strong>{' '}
                  Reserved from your spending balance to cover potential channel
                  closing fees
                </li>
                <li>
                  <strong className="text-yellow-300">
                    LSP side ({formatNumberWithCommas(FEE_RESERVE.toString())}{' '}
                    sats):
                  </strong>{' '}
                  Reserved from the LSP's receiving capacity for channel
                  management operations
                </li>
              </ul>
              <p className="text-yellow-300/90">
                These reserves ensure both parties can always afford to perform
                necessary on-chain operations like cooperative channel closes.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
