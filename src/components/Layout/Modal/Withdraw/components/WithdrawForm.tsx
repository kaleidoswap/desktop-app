import {
  ArrowRight,
  Zap,
  Link as ChainIcon,
  ChevronDown,
  Copy,
  AlertTriangle,
} from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { Controller } from 'react-hook-form'

import { BTC_ASSET_ID } from '../../../../../constants'
import {
  getAssetPrecision,
  formatAssetAmountWithPrecision,
  getDisplayAsset,
  formatNumberWithCommas,
  parseNumberWithCommas,
} from '../../../../../helpers/number'
import { NiaAsset } from '../../../../../slices/nodeApi/nodeApi.slice'
import { WithdrawFormProps, AssetOption } from '../types'

import { BalanceDisplay } from './BalanceDisplay'
import { LightningInvoiceDetails } from './LightningInvoiceDetails'
import { PaymentStatus } from './PaymentStatus'
import { RGBInvoiceDetails } from './RGBInvoiceDetails'

const MSATS_PER_SAT = 1000
const RGB_HTLC_MIN_SAT = 3000

// NumberInput component similar to the one used in Step2.tsx
interface NumberInputProps {
  value: string
  onChange: (value: string) => void
  min?: number
  max?: number
  precision?: number
  label: string
  placeholder?: string
  className?: string
  error?: string
  showSlider?: boolean
  onSliderChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  sliderStep?: number
  sliderValue?: number
  displayUnit?: string
}

const formatSliderValue = (value: number, precision: number = 0): string => {
  if (isNaN(value) || value === 0) return ''
  const formattedValue = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: precision,
    minimumFractionDigits: precision,
  }).format(value)
  return formattedValue
}

const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  min = 0,
  max,
  precision = 0,
  label,
  placeholder,
  className = '',
  error,
  showSlider = false,
  onSliderChange,
  sliderStep,
  sliderValue,
  displayUnit,
}) => {
  const [displayValue, setDisplayValue] = useState(
    value ? formatNumberWithCommas(value) : ''
  )
  const [isFocused, setIsFocused] = useState(false)
  const [hasUserInteracted, setHasUserInteracted] = useState(false)

  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(value ? formatNumberWithCommas(value) : '')
    }
  }, [value, isFocused])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHasUserInteracted(true)
    const rawValue = parseNumberWithCommas(e.target.value)

    if (rawValue === '' || rawValue === '.') {
      setDisplayValue(rawValue)
      onChange(rawValue)
      return
    }

    const parsedValue = parseFloat(rawValue)
    if (isNaN(parsedValue)) return

    // Handle precision
    const [whole, decimal] = rawValue.split('.')
    let formattedValue = rawValue
    if (decimal && decimal.length > precision) {
      formattedValue = `${whole}.${decimal.slice(0, precision)}`
    }

    // Don't auto-limit to max when there's an error - let user type freely
    // This allows them to correct their input more easily
    if (max !== undefined && parsedValue > max && !error) {
      formattedValue = max.toString()
    }

    setDisplayValue(formattedValue)
    onChange(formattedValue)
  }

  const handleFocus = () => {
    setIsFocused(true)
    setHasUserInteracted(true)
    setDisplayValue(parseNumberWithCommas(value))
  }

  const handleBlur = () => {
    setIsFocused(false)

    if (!value) {
      setDisplayValue('')
      return
    }

    const parsedValue = parseFloat(value)
    if (isNaN(parsedValue)) {
      setDisplayValue(formatNumberWithCommas(value))
      return
    }

    // Only format the display value, don't auto-correct to min/max
    // Let form validation handle showing errors instead of forcing corrections
    setDisplayValue(formatNumberWithCommas(value))
  }

  return (
    <div className={className}>
      <div className="flex justify-between items-center mb-2">
        <label className="block text-xs font-medium text-slate-400">
          {label}
        </label>
        <span className="text-xs text-slate-400">
          {value ? formatSliderValue(parseFloat(value || '0'), precision) : ''}
          {displayUnit && ` ${displayUnit}`}
        </span>
      </div>
      <div className="relative">
        <input
          className={`w-full px-3 py-2 bg-slate-800/50 border ${
            error ? 'border-red-500' : 'border-slate-700'
          } rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 text-white text-sm`}
          onBlur={handleBlur}
          onChange={handleChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          type="text"
          value={
            isFocused ? displayValue : formatNumberWithCommas(displayValue)
          }
        />
        {error && hasUserInteracted && (
          <div className="absolute mt-1 p-2 bg-red-500/10 rounded-lg border border-red-500/20 flex items-start gap-2 max-w-full">
            <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-400 break-words">{error}</p>
          </div>
        )}
      </div>
      {showSlider && (
        <input
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer mt-4 accent-blue-500"
          max={max}
          min={min}
          onChange={(e) => {
            setHasUserInteracted(true)
            if (onSliderChange) onSliderChange(e)
          }}
          step={sliderStep}
          type="range"
          value={sliderValue}
        />
      )}
    </div>
  )
}

// WithdrawForm component for rendering the form
const WithdrawForm: React.FC<WithdrawFormProps> = ({
  form,
  addressType,
  validationError,
  clearValidationError,
  isDecodingInvoice,
  showAssetDropdown,
  decodedInvoice,
  decodedRgbInvoice,
  maxLightningCapacity,
  assetId,
  assetBalance,
  bitcoinUnit,
  availableAssets,
  feeRates,
  feeRate,
  customFee,
  paymentStatus,
  isPollingStatus,
  assets,
  handleInvoiceChange,
  handlePasteFromClipboard,
  setShowAssetDropdown,
  setValue,
  fetchBtcBalance,
  fetchAssetBalance,
  getMinAmount,
  getMinAmountMessage,
  getFeeIcon,
  setCustomFee,
  onSubmit,
}) => {
  const {
    control,
    formState: { errors, isSubmitting },
  } = form

  // Filter available assets based on address type
  const filteredAvailableAssets = availableAssets.filter((asset) => {
    if (addressType === 'rgb') {
      // If RGB withdrawal, only show RGB assets (exclude BTC)
      return asset.value !== BTC_ASSET_ID
    }
    // Otherwise, show all assets
    return true
  })

  // Calculate max withdraw amount based on HTLC limits for Lightning
  const calculateMaxWithdrawAmount = (assetId: string): number => {
    let maxRawAmount: number

    if (
      (addressType === 'lightning' || addressType === 'lightning-address') &&
      assetId === BTC_ASSET_ID
    ) {
      // For Lightning BTC withdrawals, use the HTLC limit
      const maxHtlcSat = maxLightningCapacity / MSATS_PER_SAT
      const maxWithdrawable = maxHtlcSat - RGB_HTLC_MIN_SAT
      maxRawAmount = Math.max(0, Math.min(maxWithdrawable, assetBalance))
    } else {
      // For on-chain or RGB withdrawals, use the full balance
      maxRawAmount = assetBalance
    }

    // Convert raw amount to display amount
    if (assetId === BTC_ASSET_ID) {
      // BTC: assetBalance is in satoshis, return in display units
      return bitcoinUnit === 'SAT' ? maxRawAmount : maxRawAmount / 100000000
    } else {
      // RGB assets: convert from raw units to display units using precision
      const assetInfo = assets.data?.nia.find(
        (a: NiaAsset) => a.asset_id === assetId
      )
      const precision = assetInfo?.precision || 8
      const displayAmount = maxRawAmount / Math.pow(10, precision)

      // Debug logging
      console.log('RGB Asset max calculation:', {
        assetId,
        displayAmount,
        maxRawAmount,
        precision,
        ticker: assetInfo?.ticker,
      })

      return displayAmount
    }
  }

  // Format amount helper
  const formatAmount = (amount: number, asset: string) => {
    return formatAssetAmountWithPrecision(
      amount,
      asset,
      bitcoinUnit,
      assets.data?.nia
    )
  }

  if (isDecodingInvoice) {
    return (
      <div className="flex justify-center items-center p-4">
        <div className="animate-spin mr-2 h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        <span className="text-blue-400 text-sm">Analyzing input...</span>
      </div>
    )
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      {/* Universal Address/Invoice Input */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-400">
          Address or Invoice
        </label>
        <div className="relative">
          <Controller
            control={control}
            name="address"
            render={({ field }) => (
              <input
                {...field}
                className={`w-full px-3 py-2 bg-slate-800/50 rounded-xl border
                          text-white placeholder:text-slate-600 text-sm
                          ${
                            errors.address ||
                            validationError ||
                            addressType === 'invalid'
                              ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                              : 'border-slate-700 focus:border-blue-500 focus:ring-blue-500'
                          }`}
                onChange={(e) => {
                  field.onChange(e)
                  handleInvoiceChange(e)
                  // Clear validation errors when user starts typing new address
                  if (validationError && e.target.value !== '') {
                    clearValidationError()
                  }
                }}
                placeholder="Paste Bitcoin address, Lightning invoice, Lightning address, or RGB invoice"
                type="text"
              />
            )}
            rules={{
              required: 'Address or invoice is required',
            }}
          />
          <button
            className="absolute right-2 top-1/2 transform -translate-y-1/2
                      text-slate-400 hover:text-blue-500 p-1"
            onClick={handlePasteFromClipboard}
            type="button"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
        {errors.address && (
          <p className="text-red-400 text-xs mt-1">{errors.address.message}</p>
        )}

        {/* Validation error message */}
        {validationError && (
          <div className="mt-1 p-2 bg-red-500/10 rounded-lg border border-red-500/20 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-400 text-xs">{validationError}</p>
            </div>
            <button
              className="text-red-400 hover:text-red-300 text-xs underline flex-shrink-0"
              onClick={() => {
                clearValidationError()
                // Only clear the amount field, keep the address
                form.setValue('amount', '')
                form.clearErrors('amount')
              }}
              type="button"
            >
              Clear
            </button>
          </div>
        )}

        {/* Display the detected address type */}
        {addressType !== 'unknown' &&
          addressType !== 'invalid' &&
          !errors.address &&
          !validationError && (
            <div className="flex items-center mt-1 gap-1">
              {addressType === 'lightning' && (
                <Zap className="w-3 h-3 text-blue-400" />
              )}
              {addressType === 'lightning-address' && (
                <Zap className="w-3 h-3 text-blue-400" />
              )}
              {addressType === 'bitcoin' && (
                <ChainIcon className="w-3 h-3 text-orange-400" />
              )}
              {addressType === 'rgb' && (
                <ChainIcon className="w-3 h-3 text-green-400" />
              )}
              <span className="text-xs text-slate-400">
                Detected:{' '}
                <span
                  className={`font-medium ${
                    addressType === 'lightning' ||
                    addressType === 'lightning-address'
                      ? 'text-blue-400'
                      : addressType === 'bitcoin'
                        ? 'text-orange-400'
                        : 'text-green-400'
                  }`}
                >
                  {addressType === 'lightning'
                    ? 'Lightning Invoice'
                    : addressType === 'lightning-address'
                      ? 'Lightning Address'
                      : addressType === 'bitcoin'
                        ? 'Bitcoin Address'
                        : 'RGB Invoice'}
                </span>
              </span>
            </div>
          )}
      </div>

      {/* Lightning channel capacity for lightning payments */}
      {(addressType === 'lightning' || addressType === 'lightning-address') &&
        !validationError && (
          <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">
                  Max Lightning Capacity:
                </span>
                <span className="text-white font-medium">
                  {(maxLightningCapacity / 1000).toLocaleString()} sat
                </span>
              </div>
              {assetId === BTC_ASSET_ID && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">
                    Max Withdrawable (after fees):
                  </span>
                  <span className="text-blue-400 font-medium">
                    {formatAmount(
                      calculateMaxWithdrawAmount(BTC_ASSET_ID),
                      'BTC'
                    )}{' '}
                    {getDisplayAsset('BTC', bitcoinUnit)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

      {/* Decoded Lightning Invoice Info */}
      {decodedInvoice && addressType === 'lightning' && (
        <LightningInvoiceDetails
          assets={assets}
          bitcoinUnit={bitcoinUnit}
          decodedInvoice={decodedInvoice}
          fetchAssetBalance={fetchAssetBalance}
          maxLightningCapacity={maxLightningCapacity}
        />
      )}

      {/* Payment Status for Lightning payments */}
      {isPollingStatus && paymentStatus && (
        <PaymentStatus
          isPollingStatus={isPollingStatus}
          paymentStatus={paymentStatus}
        />
      )}

      {/* Decoded RGB Invoice info */}
      {decodedRgbInvoice && addressType === 'rgb' && (
        <RGBInvoiceDetails
          assets={assets}
          bitcoinUnit={bitcoinUnit}
          decodedRgbInvoice={decodedRgbInvoice}
        />
      )}

      {/* Balance Display */}
      <BalanceDisplay
        addressType={addressType}
        assetBalance={assetBalance}
        assetId={assetId}
        assets={assets}
        bitcoinUnit={bitcoinUnit}
      />

      {/* Conditional rendering based on address type */}
      {(addressType === 'bitcoin' ||
        addressType === 'rgb' ||
        addressType === 'lightning-address') && (
        <>
          {/* Asset Selector - Only for rgb invoices without asset_id specified or lightning-address */}
          {((addressType === 'rgb' && !decodedRgbInvoice?.asset_id) ||
            addressType === 'lightning-address') && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">
                Asset
              </label>
              <div className="relative">
                <button
                  className="w-full p-3 bg-slate-800/50 rounded-xl border border-slate-700 
                          hover:border-blue-500/50 transition-all duration-200
                          flex items-center justify-between text-left text-sm"
                  onClick={() => setShowAssetDropdown(!showAssetDropdown)}
                  type="button"
                >
                  <span>
                    {filteredAvailableAssets.find(
                      (a: AssetOption) => a.value === assetId
                    )?.label || 'Select Asset'}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 transition-transform duration-200 
                    ${showAssetDropdown ? 'transform rotate-180' : ''}`}
                  />
                </button>
                {showAssetDropdown && (
                  <div
                    className="absolute z-10 mt-1 w-full bg-slate-800 rounded-xl border border-slate-700 
                              shadow-xl max-h-[200px] overflow-y-auto"
                  >
                    {filteredAvailableAssets.map((asset) => (
                      <button
                        className="w-full px-3 py-2 text-left hover:bg-blue-500/10 text-sm
                                text-white transition-colors duration-200"
                        key={asset.value}
                        onClick={() => {
                          setValue('asset_id', asset.value)
                          setShowAssetDropdown(false)
                          // Fetch balance for the selected asset
                          if (asset.value === BTC_ASSET_ID) {
                            fetchBtcBalance()
                          } else {
                            fetchAssetBalance(asset.value)
                          }
                        }}
                        type="button"
                      >
                        {asset.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {errors.asset_id && (
                <p className="text-red-400 text-xs mt-1">
                  {errors.asset_id.message}
                </p>
              )}
              {assetId && (
                <div className="mt-2 p-2 bg-slate-800/30 rounded-lg border border-slate-700/50">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">
                      Available Balance:
                    </span>
                    <span className="text-xs text-white font-medium">
                      {assetId === BTC_ASSET_ID
                        ? bitcoinUnit === 'SAT'
                          ? assetBalance.toLocaleString()
                          : (assetBalance / 100000000).toFixed(8)
                        : (() => {
                            const assetInfo = assets.data?.nia.find(
                              (a: NiaAsset) => a.asset_id === assetId
                            )
                            const precision = assetInfo?.precision || 8
                            const displayBalance =
                              assetBalance / Math.pow(10, precision)
                            return displayBalance.toLocaleString('en-US', {
                              maximumFractionDigits: precision,
                              minimumFractionDigits: 0,
                              useGrouping: true,
                            })
                          })()}{' '}
                      {
                        filteredAvailableAssets.find(
                          (a: AssetOption) => a.value === assetId
                        )?.label
                      }
                    </span>
                  </div>
                  {/* Add max withdrawable info */}
                  {(() => {
                    const currentAssetInfo = assets.data?.nia.find(
                      (a: NiaAsset) => a.asset_id === assetId
                    )
                    const ticker =
                      currentAssetInfo?.ticker ||
                      (assetId === BTC_ASSET_ID ? 'BTC' : 'Unknown')
                    const maxAmount = calculateMaxWithdrawAmount(assetId)
                    const precision = getAssetPrecision(
                      ticker,
                      bitcoinUnit,
                      assets.data?.nia
                    )

                    // Only show max if it's different from balance (e.g., Lightning limits)
                    const isLimited =
                      ['lightning', 'lightning-address'].includes(
                        addressType
                      ) &&
                      assetId === BTC_ASSET_ID &&
                      maxAmount <
                        (bitcoinUnit === 'SAT'
                          ? assetBalance
                          : assetBalance / 100000000)

                    if (isLimited) {
                      return (
                        <div className="flex justify-between items-center mt-1 pt-1 border-t border-slate-700/30">
                          <span className="text-xs text-blue-400">
                            Max Withdrawable:
                          </span>
                          <span className="text-xs text-blue-400 font-medium">
                            {precision === 0
                              ? maxAmount.toLocaleString()
                              : maxAmount.toLocaleString('en-US', {
                                  maximumFractionDigits: precision,
                                  minimumFractionDigits: 0,
                                  useGrouping: true,
                                })}{' '}
                            {
                              filteredAvailableAssets.find(
                                (a: AssetOption) => a.value === assetId
                              )?.label
                            }
                          </span>
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Amount Input - Only needed when not specified in invoice */}
          {(addressType === 'bitcoin' ||
            addressType === 'lightning-address' ||
            (addressType === 'rgb' && !decodedRgbInvoice?.amount)) && (
            <div className="space-y-1">
              <Controller
                control={control}
                name="amount"
                render={({ field }) => {
                  // Get asset info for precision
                  const currentAssetInfo = assets.data?.nia.find(
                    (a: NiaAsset) => a.asset_id === assetId
                  )
                  const ticker =
                    currentAssetInfo?.ticker ||
                    (assetId === BTC_ASSET_ID ? 'BTC' : 'Unknown')
                  const precision = getAssetPrecision(
                    ticker,
                    bitcoinUnit,
                    assets.data?.nia
                  )

                  const maxWithdrawable = calculateMaxWithdrawAmount(assetId)
                  const minAmount = getMinAmount()

                  // Format display unit
                  const displayUnit =
                    filteredAvailableAssets.find(
                      (a: AssetOption) => a.value === assetId
                    )?.label || 'SAT'

                  return (
                    <div className="relative">
                      <NumberInput
                        className="group transition-all duration-300 hover:translate-x-1"
                        displayUnit={displayUnit}
                        error={errors.amount?.message}
                        label="Amount"
                        max={maxWithdrawable}
                        min={minAmount}
                        onChange={(value) => {
                          field.onChange(value)
                          // Clear any existing validation errors when user starts typing
                          if (errors.amount) {
                            form.clearErrors('amount')
                          }
                          // Also clear general validation errors when user starts editing
                          if (validationError) {
                            clearValidationError()
                          }
                        }}
                        onSliderChange={(e) => {
                          field.onChange(e.target.value)
                          // Clear any existing validation errors when user uses slider
                          if (errors.amount) {
                            form.clearErrors('amount')
                          }
                        }}
                        placeholder={`Enter amount (max ${maxWithdrawable > 0 ? maxWithdrawable.toLocaleString() : 'N/A'})`}
                        precision={precision}
                        showSlider
                        sliderStep={
                          precision === 0 ? 1 : 1 / Math.pow(10, precision)
                        }
                        sliderValue={
                          field.value
                            ? parseFloat(
                                parseNumberWithCommas(field.value) || '0'
                              )
                            : minAmount
                        }
                        value={field.value || ''}
                      />

                      {/* Max button */}
                      <button
                        className="absolute right-2 top-8 px-2 py-1 text-blue-500 text-xs font-medium hover:text-blue-400 
                                   hover:bg-blue-500/10 rounded-md transition-all duration-200
                                   border border-blue-500/30 hover:border-blue-400/50 z-10"
                        onClick={() => {
                          // Format the max amount for display
                          let formattedMaxAmount
                          if (precision === 0) {
                            formattedMaxAmount =
                              Math.round(maxWithdrawable).toString()
                          } else {
                            formattedMaxAmount = maxWithdrawable.toString()
                          }
                          field.onChange(formattedMaxAmount)
                        }}
                        type="button"
                      >
                        Max
                      </button>
                    </div>
                  )
                }}
                rules={{
                  required: 'Amount is required',
                  validate: {
                    isNumber: (value) => {
                      if (value === '' || value === undefined) {
                        return 'Amount is required'
                      }

                      const cleanValue = String(value).replace(/,/g, '')
                      if (cleanValue === '' || isNaN(parseFloat(cleanValue))) {
                        return 'Please enter a valid number'
                      }

                      return true
                    },
                    maxValue: (value) => {
                      const currentAssetInfo = assets.data?.nia.find(
                        (a: NiaAsset) => a.asset_id === assetId
                      )
                      const ticker =
                        currentAssetInfo?.ticker ||
                        (assetId === BTC_ASSET_ID ? 'BTC' : 'Unknown')

                      const cleanValue = String(value).replace(/,/g, '')
                      const inputValue = parseFloat(cleanValue)

                      if (isNaN(inputValue)) {
                        return true // Let isNumber validation handle this
                      }

                      // Convert input to raw units for comparison with assetBalance
                      let inputRawUnits: number

                      if (assetId === BTC_ASSET_ID) {
                        if (bitcoinUnit === 'SAT') {
                          // Input is already in satoshis
                          inputRawUnits = inputValue
                        } else {
                          // Input is in BTC, convert to satoshis
                          inputRawUnits = inputValue * 100000000
                        }
                      } else {
                        // RGB assets: convert display amount to raw units
                        const assetInfo = assets.data?.nia.find(
                          (a: NiaAsset) => a.asset_id === assetId
                        )
                        const precision = assetInfo?.precision || 8
                        inputRawUnits = Math.round(
                          inputValue * Math.pow(10, precision)
                        )
                      }

                      if (
                        addressType === 'lightning-address' &&
                        assetId === BTC_ASSET_ID
                      ) {
                        // For lightning, compare against HTLC limits
                        const maxHtlcSat = maxLightningCapacity / MSATS_PER_SAT
                        const maxWithdrawableRaw = Math.max(
                          0,
                          Math.min(maxHtlcSat - RGB_HTLC_MIN_SAT, assetBalance)
                        )

                        if (inputRawUnits > maxWithdrawableRaw) {
                          const maxWithdrawableDisplay =
                            calculateMaxWithdrawAmount(assetId)
                          const precision = getAssetPrecision(
                            ticker,
                            bitcoinUnit,
                            assets.data?.nia
                          )
                          const formattedMax =
                            precision === 0
                              ? maxWithdrawableDisplay.toLocaleString()
                              : maxWithdrawableDisplay.toFixed(precision)
                          return `Maximum withdrawable: ${formattedMax} ${getDisplayAsset(ticker, bitcoinUnit)}. Click "Max" to use the maximum amount.`
                        }
                      } else {
                        // For on-chain, compare against balance
                        if (inputRawUnits > assetBalance) {
                          return 'Amount exceeds available balance. Click "Max" to use your full balance.'
                        }
                      }

                      return true
                    },
                    minValue: (value) => {
                      const cleanValue = String(value).replace(/,/g, '')
                      const inputValue = parseFloat(cleanValue)

                      if (isNaN(inputValue)) {
                        return true // Let isNumber validation handle this
                      }

                      const minDisplayAmount = getMinAmount()

                      return (
                        inputValue >= minDisplayAmount ||
                        `Minimum amount: ${getMinAmountMessage()}`
                      )
                    },
                  },
                }}
              />

              {/* Show HTLC limit warning for Lightning withdrawals */}
              {addressType === 'lightning-address' &&
                assetId === BTC_ASSET_ID &&
                maxLightningCapacity > 0 && (
                  <div className="mt-1 p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <p className="text-xs text-blue-400">
                      <span className="font-medium">Lightning Limit:</span> Max
                      withdrawable amount is limited by your channel capacity
                      and HTLC limits.
                    </p>
                  </div>
                )}
            </div>
          )}

          {/* Fee Selection for BTC or RGB on-chain */}
          {(assetId === BTC_ASSET_ID || addressType === 'rgb') &&
            (addressType === 'bitcoin' || addressType === 'rgb') && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">
                  Fee Rate
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {feeRates.map((fee) => (
                    <Controller
                      control={control}
                      key={fee.value}
                      name="fee_rate"
                      render={({ field }) => (
                        <button
                          className={`py-1.5 px-2 flex flex-col items-center justify-center gap-0.5
                                  rounded-lg transition-all duration-200 border text-xs
                                  ${
                                    field.value === fee.value
                                      ? 'bg-blue-500/10 border-blue-500 text-blue-500'
                                      : 'border-slate-700 hover:border-blue-500/50 text-slate-400'
                                  }`}
                          onClick={() => field.onChange(fee.value)}
                          type="button"
                        >
                          {getFeeIcon(fee.value)}
                          <span className="text-[10px]">{fee.label}</span>
                          <span className="text-[9px]">{fee.rate} sat/vB</span>
                        </button>
                      )}
                    />
                  ))}
                </div>
              </div>
            )}

          {/* Custom Fee Input */}
          {feeRate === 'custom' &&
            (assetId === BTC_ASSET_ID || addressType === 'rgb') &&
            (addressType === 'bitcoin' || addressType === 'rgb') && (
              <div className="space-y-1 animate-fadeIn">
                <label className="text-xs font-medium text-slate-400">
                  Custom Fee Rate (sat/vB)
                </label>
                <input
                  className="w-full px-3 py-2 bg-slate-800/50 rounded-xl border border-slate-700 
                        focus:border-blue-500 focus:ring-blue-500 text-white text-sm"
                  min={0.1}
                  onChange={(e) => setCustomFee(parseFloat(e.target.value))}
                  step={0.1}
                  type="number"
                  value={customFee}
                />
              </div>
            )}
        </>
      )}

      {/* Submit Button */}
      <button
        className="w-full py-2.5 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900
                 text-white rounded-xl font-medium transition-all duration-200 
                 flex items-center justify-center gap-2 mt-4 disabled:cursor-not-allowed"
        disabled={
          isSubmitting === true ||
          addressType === 'unknown' ||
          addressType === 'invalid' ||
          // Only disable for "Error" type validation messages, not for "Warning" type messages
          (validationError !== null && !validationError.startsWith('Warning'))
        }
        type="submit"
      >
        {isSubmitting ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <span>
              {addressType === 'lightning' ||
              addressType === 'lightning-address'
                ? 'Pay Invoice'
                : addressType === 'rgb'
                  ? 'Send RGB Asset'
                  : 'Withdraw'}
            </span>
            {addressType === 'lightning' ||
            addressType === 'lightning-address' ? (
              <Zap className="w-4 h-4" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
          </>
        )}
      </button>
    </form>
  )
}

export { WithdrawForm }
