import {
  ArrowRight,
  Zap,
  Link as ChainIcon,
  ChevronDown,
  Copy,
  AlertTriangle,
} from 'lucide-react'
import React from 'react'
import { Controller } from 'react-hook-form'

import { BTC_ASSET_ID } from '../../../../../constants'
import {
  getAssetPrecision,
  formatBitcoinAmount,
  formatAssetAmountWithPrecision,
} from '../../../../../helpers/number'
import { NiaAsset } from '../../../../../slices/nodeApi/nodeApi.slice'
import { WithdrawFormProps, AssetOption } from '../types'

import { BalanceDisplay } from './BalanceDisplay'
import { LightningInvoiceDetails } from './LightningInvoiceDetails'
import { PaymentStatus } from './PaymentStatus'
import { RGBInvoiceDetails } from './RGBInvoiceDetails'

// WithdrawForm component for rendering the form
const WithdrawForm: React.FC<WithdrawFormProps> = ({
  form,
  addressType,
  validationError,
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
            <p className="text-red-400 text-xs">{validationError}</p>
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
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">
                Max Lightning Outbound Capacity:
              </span>
              <span className="text-white font-medium">
                {(maxLightningCapacity / 1000).toLocaleString()} sat
              </span>
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
        addressType === 'lightning-address') &&
        !validationError && (
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
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-slate-400">
                      Available Balance:
                    </span>
                    <span className="text-xs text-white font-medium">
                      {assetId === BTC_ASSET_ID
                        ? formatBitcoinAmount(assetBalance, bitcoinUnit)
                        : formatAssetAmountWithPrecision(
                            assetBalance,
                            assets.data?.nia.find(
                              (a: NiaAsset) => a.asset_id === assetId
                            )?.ticker || 'Unknown',
                            bitcoinUnit,
                            assets.data?.nia
                          )}{' '}
                      {
                        filteredAvailableAssets.find(
                          (a: AssetOption) => a.value === assetId
                        )?.label
                      }
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Amount Input - Only needed when not specified in invoice */}
            {(addressType === 'bitcoin' ||
              addressType === 'lightning-address' ||
              (addressType === 'rgb' && !decodedRgbInvoice?.amount)) && (
              <div className="space-y-1">
                <div className="flex justify-between">
                  <label className="text-xs font-medium text-slate-400">
                    Amount
                  </label>
                  <button
                    className="text-blue-500 text-xs hover:text-blue-400"
                    onClick={() => {
                      // Make sure the max value is not less than the minimum required amount
                      const minAmount = getMinAmount()
                      const maxAmount = Math.max(assetBalance, minAmount)
                      setValue('amount', maxAmount)
                    }}
                    type="button"
                  >
                    Max
                  </button>
                </div>
                <div className="flex items-center gap-2">
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
                        (assetId === BTC_ASSET_ID ? bitcoinUnit : 'Unknown')
                      const precision = getAssetPrecision(
                        ticker,
                        bitcoinUnit,
                        assets.data?.nia
                      )

                      return (
                        <input
                          className={`flex-1 px-3 py-2 bg-slate-800/50 rounded-xl border text-sm
                                  text-white placeholder:text-slate-600
                                  ${
                                    errors.amount
                                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                                      : 'border-slate-700 focus:border-blue-500 focus:ring-blue-500'
                                  }`}
                          inputMode="decimal"
                          onBlur={() => {
                            // Final validation and conversion on blur
                            let finalValue = field.value
                            const minAmt = getMinAmount()

                            // Try parsing the string value
                            let numValue = parseFloat(
                              String(finalValue).replace(/,/g, '')
                            )

                            if (isNaN(numValue) || numValue < minAmt) {
                              numValue = minAmt // Set to min if invalid or below min
                            } else if (numValue > assetBalance) {
                              numValue = assetBalance // Set to max if above max
                            }

                            // Update the field with the final numeric value
                            // Check if it actually changed to avoid unnecessary re-renders
                            if (field.value !== numValue) {
                              field.onChange(numValue)
                            }
                          }}
                          onChange={(e) => {
                            const rawValue = e.target.value

                            // Basic filter: allow digits and one decimal point
                            let filteredValue = rawValue.replace(/[^\d.]/g, '')
                            const parts = filteredValue.split('.')
                            if (parts.length > 2) {
                              filteredValue =
                                parts[0] + '.' + parts.slice(1).join('')
                            }

                            // Handle precision limit
                            if (parts[1] && parts[1].length > precision) {
                              filteredValue =
                                parts[0] + '.' + parts[1].slice(0, precision)
                            }

                            // Update the form state with the filtered string
                            field.onChange(filteredValue)
                          }}
                          placeholder={`Enter amount (${precision} decimals max)`}
                          type="text"
                          value={
                            field.value === undefined || field.value === null
                              ? ''
                              : String(field.value)
                          }
                        />
                      )
                    }}
                    rules={{
                      required: 'Amount is required',
                      validate: {
                        // Simplified validation - rely on onBlur to fix values,
                        // but still check if the current value is a valid number representation
                        isNumber: (value) =>
                          (value !== '' && // Must not be empty after filtering
                            !isNaN(
                              parseFloat(String(value).replace(/,/g, ''))
                            )) || // Must parse to a number
                          'Please enter a valid number',
                        maxValue: (value) => {
                          // First, check if we're dealing with BTC or another asset
                          if (assetId === BTC_ASSET_ID) {
                            // For Bitcoin, we need to parse the input value
                            const inputValue = parseFloat(
                              String(value).replace(/,/g, '')
                            )

                            // Simple direct comparison - assetBalance should already be in the right unit (satoshis)
                            return (
                              (!isNaN(inputValue) &&
                                inputValue <= assetBalance) ||
                              'Amount exceeds available balance'
                            )
                          } else {
                            // Simple direct comparison
                            const inputValue = parseFloat(
                              String(value).replace(/,/g, '')
                            )
                            return (
                              (!isNaN(inputValue) &&
                                inputValue <= assetBalance) ||
                              'Amount exceeds available balance'
                            )
                          }
                        },
                        minValue: (value) => {
                          const num = parseFloat(
                            String(value).replace(/,/g, '')
                          )
                          return (
                            (!isNaN(num) && num >= getMinAmount()) ||
                            getMinAmountMessage()
                          )
                        },
                      },
                    }}
                  />
                  <div className="px-3 py-2 bg-slate-800/50 rounded-xl border border-slate-700 text-slate-400 text-sm whitespace-nowrap">
                    {filteredAvailableAssets.find(
                      (a: AssetOption) => a.value === assetId
                    )?.label || 'SAT'}
                  </div>
                </div>
                {errors.amount && (
                  <p className="text-red-400 text-xs mt-1">
                    {errors.amount.message}
                  </p>
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
                            <span className="text-[9px]">
                              {fee.rate} sat/vB
                            </span>
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
