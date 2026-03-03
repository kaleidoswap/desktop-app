import { Info, Wallet, ArrowDownCircle, BatteryCharging, PencilLine, X, Check } from 'lucide-react'
import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import defaultRgbIcon from '../../assets/rgb-symbol-color.svg'
import { formatNumberWithCommas } from '../../helpers/number'
import { useAssetIcon } from '../../helpers/utils'
import './animations.css'

interface AssetChannelSelectorProps {
  assetInfo: {
    ticker: string
    name: string
    precision: number
    min_channel_amount: number
    max_channel_amount: number
    min_initial_lsp_amount?: number
    max_initial_lsp_amount?: number
  }
  // Total asset capacity in the channel
  totalAssetAmount: number
  onTotalAssetAmountChange: (value: number) => void
  // Client asset amount (what user buys/controls)
  clientAssetAmount?: number
  onClientAssetAmountChange?: (value: number) => void
  // Presets for capacity selection
  capacityPresets?: number[]
}

export const AssetChannelSelector: React.FC<AssetChannelSelectorProps> = ({
  assetInfo,
  totalAssetAmount = 0,
  onTotalAssetAmountChange,
  clientAssetAmount = 0,
  onClientAssetAmountChange,
  capacityPresets,
}) => {
  const { t } = useTranslation()
  const [customInput, setCustomInput] = useState('')
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [modalDraft, setModalDraft] = useState('')
  const modalInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showCustomModal) {
      setModalDraft(customInput)
      setTimeout(() => modalInputRef.current?.focus(), 50)
    }
  }, [showCustomModal])

  const applyCustomAmount = () => {
    const num = parseFloat(modalDraft.replace(/[^0-9.]/g, ''))
    if (!isNaN(num) && num > 0) {
      setCustomInput(modalDraft)
      const currentPercentage =
        totalAssetAmount > 0 ? clientAssetAmount / totalAssetAmount : 0.5
      const newClientAmount = num * currentPercentage
      const constrainedClientAmount = Math.max(0, Math.min(num, newClientAmount))
      onTotalAssetAmountChange(num)
      if (onClientAssetAmountChange) onClientAssetAmountChange(constrainedClientAmount)
    }
    setShowCustomModal(false)
  }

  const maxAssetAmount =
    assetInfo.max_channel_amount / Math.pow(10, assetInfo.precision)

  // Calculate liquidity distribution
  const lspAssetAmount = totalAssetAmount - clientAssetAmount
  const clientPercentage =
    totalAssetAmount > 0 ? (clientAssetAmount / totalAssetAmount) * 100 : 0
  const lspPercentage = 100 - clientPercentage

  // Asset icon hook
  const [assetIconSrc, setAssetIconSrc] = useAssetIcon(
    assetInfo.ticker,
    defaultRgbIcon
  )

  const formatAssetAmount = (amount: number): string => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(2)}M`
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}k`
    return amount.toFixed(Math.min(2, assetInfo.precision))
  }

  // Capacity presets - use provided or calculate percentage-based
  const presetAmounts = capacityPresets || [
    maxAssetAmount * 0.25,
    maxAssetAmount * 0.5,
    maxAssetAmount * 0.75,
    maxAssetAmount * 1.0,
  ]

  return (
    <div className="bg-gradient-to-br from-emerald-950/40 via-gray-900 to-green-950/40 rounded-2xl p-6 border border-emerald-700/50 shadow-2xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <img
              alt={assetInfo.ticker}
              className="w-6 h-6 rounded-full"
              onError={() => setAssetIconSrc(defaultRgbIcon)}
              src={assetIconSrc}
            />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-green-400 to-emerald-500">
              {t('channelConfiguration.assetChannel.title', {
                ticker: assetInfo.ticker,
              })}
            </span>
          </h3>
        </div>
      </div>

      {/* Capacity Presets */}
      <div className="mb-6">
        <label className="text-sm font-semibold text-content-secondary mb-3 flex items-center gap-2">
          <BatteryCharging className="w-4 h-4 text-emerald-400" />
          {t('channelConfiguration.assetChannel.totalCapacity')}
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {presetAmounts.map((preset, idx) => {
            const isSelected = Math.abs(totalAssetAmount - preset) < 0.01 && customInput === ''

            return (
              <button
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md shadow-emerald-500/30'
                    : 'bg-surface-overlay/60 text-content-secondary hover:bg-surface-high/70 hover:text-content-primary border border-border-default/50'
                }`}
                key={idx}
                onClick={() => {
                  setCustomInput('')
                  const currentPercentage =
                    totalAssetAmount > 0
                      ? clientAssetAmount / totalAssetAmount
                      : 0.5
                  const newClientAmount = preset * currentPercentage
                  const constrainedClientAmount = Math.max(
                    0,
                    Math.min(preset, newClientAmount)
                  )

                  onTotalAssetAmountChange(preset)
                  if (onClientAssetAmountChange) {
                    onClientAssetAmountChange(constrainedClientAmount)
                  }
                }}
                type="button"
              >
                <span>{formatAssetAmount(preset)}</span>
                <span className={`text-xs ${isSelected ? 'opacity-80' : 'opacity-50'}`}>
                  {assetInfo.ticker}
                </span>
              </button>
            )
          })}

          {/* Custom amount button */}
          <button
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 ${
              customInput !== ''
                ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md shadow-emerald-500/30'
                : 'bg-surface-overlay/60 text-content-secondary hover:bg-surface-high/70 hover:text-content-primary border border-border-default/50 border-dashed'
            }`}
            onClick={() => setShowCustomModal(true)}
            type="button"
          >
            <PencilLine className="w-3.5 h-3.5" />
            {customInput !== ''
              ? <>{formatAssetAmount(parseFloat(customInput))} <span className="text-xs opacity-80">{assetInfo.ticker}</span></>
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
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <PencilLine className="w-4 h-4 text-emerald-400" />
                </div>
                <h3 className="text-base font-bold text-white">Custom Amount</h3>
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
              Enter a specific asset amount for this channel.
            </p>

            <div className="relative mb-2">
              <input
                className="w-full bg-surface-overlay/80 border border-border-default/50 focus:border-emerald-500/60 rounded-xl px-4 py-3 text-white text-lg font-bold outline-none transition-colors pr-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                min={0}
                onChange={(e) => setModalDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') applyCustomAmount() }}
                placeholder="0"
                ref={modalInputRef}
                type="number"
                value={modalDraft}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-content-tertiary font-medium pointer-events-none">
                {assetInfo.ticker}
              </span>
            </div>

            {modalDraft && parseFloat(modalDraft) > 0 && (
              <p className="text-xs text-emerald-400/80 mb-4">
                ≈ {formatAssetAmount(parseFloat(modalDraft))} {assetInfo.ticker}
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
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-bold shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={!modalDraft || parseFloat(modalDraft) <= 0}
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

      {/* Liquidity Distribution - Only show if onClientAssetAmountChange is provided */}
      {onClientAssetAmountChange && totalAssetAmount > 0 && (
        <div className="space-y-5">
          <label className="text-sm font-semibold text-content-secondary flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-400" />
            {t('channelConfiguration.assetChannel.assetDistribution')}
          </label>

          {/* Modern Horizontal Battery Bar */}
          <div className="relative">
            {/* Background bar */}
            <div className="h-20 bg-surface-base/50 rounded-2xl overflow-hidden border-2 border-border-default/50 shadow-inner relative">
              {/* Client Asset Balance (Green) */}
              <div
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-500 via-green-400 to-lime-400 transition-all duration-500 ease-out relative overflow-hidden"
                style={{ width: `${clientPercentage}%` }}
              >
                {/* Animated gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                {/* Top shine */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent h-1/3" />
              </div>

              {/* LSP Asset Balance (Teal) */}
              <div
                className="absolute right-0 top-0 h-full bg-gradient-to-r from-teal-500 via-cyan-500 to-teal-500 transition-all duration-500 ease-out relative overflow-hidden"
                style={{ width: `${lspPercentage}%` }}
              >
                {/* Animated gradient overlay */}
                <div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
                  style={{ animationDelay: '0.5s' }}
                />
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
                {/* Left: Client Assets (Buying) */}
                {clientPercentage > 15 && (
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-white/90" />
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-white/80">
                        {t('channelConfiguration.assetChannel.yourAssets')}
                      </span>
                      <span className="text-sm font-bold text-white">
                        {formatAssetAmount(clientAssetAmount)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Right: LSP Assets (Receiving) */}
                {lspPercentage > 15 && (
                  <div className="flex items-center gap-2 ml-auto">
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-semibold text-white/80">
                        {t('channelConfiguration.assetChannel.lspReserve')}
                      </span>
                      <span className="text-sm font-bold text-white">
                        {formatAssetAmount(lspAssetAmount)}
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
                  <span className="text-xs text-content-secondary font-medium">
                    {t('channelConfiguration.assetChannel.total')}
                  </span>
                </div>
                <span className="text-base font-bold text-white">
                  {formatNumberWithCommas(formatAssetAmount(totalAssetAmount))}
                </span>
                <span className="text-xs text-content-tertiary ml-1">
                  {assetInfo.ticker}
                </span>
              </div>

              {/* Your Assets */}
              <div className="bg-emerald-900/20 rounded-xl p-3 border border-emerald-700/30">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs text-emerald-300 font-medium">
                    {t('channelConfiguration.assetChannel.yourAssets')}
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold text-emerald-200">
                    {formatNumberWithCommas(
                      formatAssetAmount(clientAssetAmount)
                    )}
                  </span>
                  <span className="text-xs text-emerald-400">
                    ({Math.round(clientPercentage)}%)
                  </span>
                </div>
              </div>

              {/* LSP Reserve */}
              <div className="bg-teal-900/20 rounded-xl p-3 border border-teal-700/30">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowDownCircle className="w-3.5 h-3.5 text-teal-400" />
                  <span className="text-xs text-teal-300 font-medium">
                    {t('channelConfiguration.assetChannel.lspReserve')}
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold text-teal-200">
                    {formatNumberWithCommas(formatAssetAmount(lspAssetAmount))}
                  </span>
                  <span className="text-xs text-teal-400">
                    ({Math.round(lspPercentage)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-emerald-900/10 border border-emerald-700/30 rounded-xl p-3">
            <div className="flex gap-2">
              <Info className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-200/80 space-y-1">
                <p>
                  <strong className="text-emerald-300">
                    {t('channelConfiguration.assetChannel.yourAssets')}
                  </strong>
                  {t('channelConfiguration.assetChannel.yourAssetsInfo')}
                </p>
                <p>
                  <strong className="text-teal-300">
                    {t('channelConfiguration.assetChannel.lspReserve')}
                  </strong>
                  {t('channelConfiguration.assetChannel.lspReserveInfo')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
