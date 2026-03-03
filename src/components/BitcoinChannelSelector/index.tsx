import {
  Zap,
  Send,
  ArrowDownCircle,
  Info,
  ChevronDown,
  ChevronUp,
  PencilLine,
  X,
  Check,
} from 'lucide-react'
import React, { useCallback, useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
  const [showFeeInfo, setShowFeeInfo] = useState(false)
  const [customInput, setCustomInput] = useState('')
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [modalDraft, setModalDraft] = useState('')
  const modalInputRef = useRef<HTMLInputElement>(null)

  // Focus input when modal opens
  useEffect(() => {
    if (showCustomModal) {
      setModalDraft(customInput)
      setTimeout(() => modalInputRef.current?.focus(), 50)
    }
  }, [showCustomModal])

  const applyCustomAmount = () => {
    const num = parseInt(modalDraft.replace(/[^0-9]/g, ''), 10)
    if (!isNaN(num) && num > 0) {
      setCustomInput(modalDraft)
      const currentPercentage =
        totalCapacity > 0 ? clientBalance / totalCapacity : 0.5
      const newClientBalance = Math.round(num * currentPercentage)
      const constrainedBalance = Math.max(
        minClientBalance,
        Math.min(Math.min(maxClientBalance, num), newClientBalance)
      )
      onCapacityChange(num)
      onClientBalanceChange(constrainedBalance)
    }
    setShowCustomModal(false)
  }

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
    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-6 border border-border-default/50 shadow-2xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <img alt="Bitcoin" className="w-6 h-6" src={bitcoinIcon} />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-yellow-400 to-orange-500">
              {t('channelConfiguration.bitcoinChannel.title')}
            </span>
          </h3>
        </div>
      </div>

      {/* Capacity Presets */}
      <div className="mb-6">
        <label className="text-sm font-semibold text-content-secondary mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          {t('channelConfiguration.bitcoinChannel.channelCapacity')}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {capacityPresets.map((preset) => {
            const isSelected = totalCapacity === preset && customInput === ''

            return (
              <button
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-gradient-to-r from-orange-500 to-yellow-600 text-white shadow-md shadow-orange-500/30'
                    : 'bg-surface-overlay/60 text-content-secondary hover:bg-surface-high/70 hover:text-content-primary border border-border-default/50'
                }`}
                key={preset}
                onClick={() => {
                  setCustomInput('')
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
                <span>{formatCapacity(preset)}</span>
                <span className={`text-xs ${isSelected ? 'opacity-80' : 'opacity-50'}`}>
                  {t('channelConfiguration.bitcoinChannel.sats')}
                </span>
              </button>
            )
          })}

          {/* Custom amount button */}
          <button
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 ${
              customInput !== ''
                ? 'bg-gradient-to-r from-orange-500 to-yellow-600 text-white shadow-md shadow-orange-500/30'
                : 'bg-surface-overlay/60 text-content-secondary hover:bg-surface-high/70 hover:text-content-primary border border-border-default/50 border-dashed'
            }`}
            onClick={() => setShowCustomModal(true)}
            type="button"
          >
            <PencilLine className="w-3.5 h-3.5" />
            {customInput !== ''
              ? <>{formatCapacity(parseInt(customInput, 10))} <span className="text-xs opacity-80">{t('channelConfiguration.bitcoinChannel.sats')}</span></>
              : 'Custom'
            }
          </button>
        </div>
      </div>

      {/* Custom amount modal */}
      {showCustomModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowCustomModal(false) }}
        >
          <div className="bg-surface-base border border-border-default/60 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 animate-scaleIn">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <PencilLine className="w-4 h-4 text-orange-400" />
                </div>
                <h3 className="text-base font-bold text-white">Custom Capacity</h3>
              </div>
              <button
                className="p-1.5 rounded-lg text-content-secondary hover:text-white hover:bg-surface-overlay transition-colors"
                onClick={() => setShowCustomModal(false)}
                type="button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-content-secondary mb-4">
              Enter a specific channel capacity in satoshis.
            </p>

            <div className="relative mb-2">
              <input
                className="w-full bg-surface-overlay/80 border border-border-default/50 focus:border-orange-500/60 rounded-xl px-4 py-3 text-white text-lg font-bold outline-none transition-colors pr-14 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                min={0}
                onChange={(e) => setModalDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') applyCustomAmount() }}
                placeholder="e.g. 250000"
                ref={modalInputRef}
                type="number"
                value={modalDraft}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-content-tertiary font-medium pointer-events-none">
                sats
              </span>
            </div>

            {modalDraft && parseInt(modalDraft, 10) > 0 && (
              <p className="text-xs text-orange-400/80 mb-4">
                ≈ {formatCapacity(parseInt(modalDraft, 10))} sats
              </p>
            )}

            <div className="flex gap-3 mt-5">
              <button
                className="flex-1 py-2.5 rounded-xl border border-border-default text-content-secondary hover:text-white hover:border-border-default text-sm font-semibold transition-all"
                onClick={() => setShowCustomModal(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-yellow-600 text-white text-sm font-bold shadow-md shadow-orange-500/20 hover:shadow-orange-500/40 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={!modalDraft || parseInt(modalDraft, 10) <= 0}
                onClick={applyCustomAmount}
                type="button"
              >
                <Check className="w-4 h-4" />
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Liquidity Distribution */}
      <div className="space-y-5">
        <div>
          <label className="text-sm font-semibold text-content-secondary flex items-center gap-2">
            <Send className="w-4 h-4 text-blue-400" />
            {t('channelConfiguration.bitcoinChannel.liquidityDistribution')}
          </label>
          <p className="mt-1 text-xs text-blue-300/70 flex items-center gap-1.5 pl-6">
            <Send className="w-3 h-3 text-blue-400/60 flex-shrink-0" />
            Your LN liquidity you are going to buy
          </p>
        </div>

        {/* Modern Horizontal Bar */}
        <div className="relative">
          {/* Background bar */}
          <div className="h-20 bg-surface-base/50 rounded-2xl overflow-hidden border-2 border-border-default/50 shadow-inner relative">
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
                      {t('channelConfiguration.bitcoinChannel.spending')}
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
                      {t('channelConfiguration.bitcoinChannel.receiving')}
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
            <div className="bg-surface-overlay/50 rounded-xl p-3 border border-border-default/50">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-xs text-content-secondary font-medium">
                  {t('channelConfiguration.bitcoinChannel.total')}
                </span>
              </div>
              <span className="text-base font-bold text-white">
                {formatNumberWithCommas(totalCapacity.toString())}
              </span>
              <span className="text-xs text-content-tertiary ml-1">
                {t('channelConfiguration.bitcoinChannel.sats')}
              </span>
            </div>

            {/* Spending Balance */}
            <div className="bg-blue-900/20 rounded-xl p-3 border border-blue-700/30">
              <div className="flex items-center gap-2 mb-1">
                <Send className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs text-blue-300 font-medium">
                  {t('channelConfiguration.bitcoinChannel.spending')}
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
                  {t('channelConfiguration.bitcoinChannel.receiving')}
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
              className="w-full h-2 bg-surface-high/50 rounded-full appearance-none cursor-pointer
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

          <div className="flex justify-between text-xs text-content-tertiary px-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50" />
              <span>
                {t('channelConfiguration.bitcoinChannel.zeroSpending')}
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span>
                {t('channelConfiguration.bitcoinChannel.fullSpending')}
              </span>
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
                <strong className="text-blue-300">
                  {t('channelConfiguration.bitcoinChannel.spendingBalance')}
                </strong>
                {t('channelConfiguration.bitcoinChannel.spendingBalanceInfo')}
              </p>
              <p>
                <strong className="text-purple-300">
                  {t('channelConfiguration.bitcoinChannel.receivingCapacity')}
                </strong>
                {t('channelConfiguration.bitcoinChannel.receivingCapacityInfo')}
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
                {t('channelConfiguration.bitcoinChannel.feeReserve', {
                  amount: formatNumberWithCommas(FEE_RESERVE.toString()),
                })}
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
                  {t('channelConfiguration.bitcoinChannel.feeReserveTitle')}
                </strong>
              </p>
              <p
                dangerouslySetInnerHTML={{
                  __html: t(
                    'channelConfiguration.bitcoinChannel.feeReserveExplanation',
                    {
                      amount: formatNumberWithCommas(FEE_RESERVE.toString()),
                    }
                  ),
                }}
              />
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li
                  dangerouslySetInnerHTML={{
                    __html: t(
                      'channelConfiguration.bitcoinChannel.clientFeeReserve',
                      {
                        amount: formatNumberWithCommas(FEE_RESERVE.toString()),
                      }
                    ),
                  }}
                />
                <li
                  dangerouslySetInnerHTML={{
                    __html: t(
                      'channelConfiguration.bitcoinChannel.lspFeeReserve',
                      {
                        amount: formatNumberWithCommas(FEE_RESERVE.toString()),
                      }
                    ),
                  }}
                />
              </ul>
              <p className="text-yellow-300/90">
                {t('channelConfiguration.bitcoinChannel.feeReserveConclusion')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
