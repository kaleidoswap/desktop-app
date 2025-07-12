import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { Controller, SubmitHandler, useForm } from 'react-hook-form'
import { toast } from 'react-toastify'
import { twJoin } from 'tailwind-merge'
import { z } from 'zod'

import { useAppSelector } from '../../app/store/hooks'
import defaultIcon from '../../assets/rgb-symbol-color.svg'
import { AssetSelectWithModal } from '../../components/Trade/AssetSelectWithModal'
import { Button } from '../../components/ui'
import { MAX_CHANNEL_CAPACITY, MIN_CHANNEL_CAPACITY } from '../../constants'
import {
  parseAssetAmountWithPrecision,
  formatAssetAmountWithPrecision,
} from '../../helpers/number'
import { useAssetIcon } from '../../helpers/utils'
import {
  NewChannelFormSchema,
  TNewChannelForm,
} from '../../slices/channel/channel.slice'
import { nodeApi, NiaAsset } from '../../slices/nodeApi/nodeApi.slice'

import { FormError } from './FormError'
import 'react-toastify/dist/ReactToastify.css'

interface Props {
  onBack: VoidFunction
  onNext: VoidFunction
  feeRates: Record<string, number>
  formData: TNewChannelForm
  onFormUpdate: (updates: Partial<TNewChannelForm>) => void
}

interface FormFields {
  capacitySat: string
  pubKeyAndAddress: string
  assetAmount: number
  assetAmountDisplay: string // For display purposes with precision
  assetId: string
  assetTicker: string
  fee: 'slow' | 'medium' | 'fast'
  public: boolean
}

const Step2Schema = NewChannelFormSchema.omit({
  capacitySat: true,
  pubKeyAndAddress: true,
}).extend({
  assetAmountDisplay: z.string().optional(),
  assetId: z.string().optional(),
  assetTicker: z.string().optional(), // Display amount with proper precision
  capacitySat: z.string(),
  pubKeyAndAddress: z.string(),
  public: z.boolean(),
})

export const Step2 = ({
  onBack,
  onNext,
  feeRates,
  formData,
  onFormUpdate,
}: Props) => {
  const [maxCapacity, setMaxCapacity] = useState<number>(MAX_CHANNEL_CAPACITY)
  const [addAsset, setAddAsset] = useState<boolean>(false)
  const [hasAvailableAssets, setHasAvailableAssets] = useState<boolean>(false)
  const [maxAssetAmountMap, setMaxAssetAmountMap] = useState<
    Record<string, number>
  >({})
  const [selectedAsset, setSelectedAsset] = useState<NiaAsset | null>(null)
  const [assetAmountInput, setAssetAmountInput] = useState('')

  const bitcoinUnit = useAppSelector((state) => state.settings.bitcoinUnit)

  // Asset icon hook
  const [assetIconSrc, setAssetIconSrc] = useAssetIcon(
    selectedAsset?.ticker || '',
    defaultIcon
  )

  // Initialize input when asset changes
  useEffect(() => {
    if (selectedAsset && formData.assetAmount > 0) {
      const displayAmount = formatAssetAmountWithPrecision(
        formData.assetAmount,
        selectedAsset.ticker,
        bitcoinUnit,
        [selectedAsset]
      )
      setAssetAmountInput(displayAmount)
    } else {
      setAssetAmountInput('')
    }
  }, [selectedAsset, formData.assetAmount, bitcoinUnit])

  const [takerAssets, takerAssetsResponse] =
    nodeApi.endpoints.listAssets.useLazyQuery()
  const [btcBalance] = nodeApi.endpoints.btcBalance.useLazyQuery()

  const { handleSubmit, setValue, control, watch, formState, clearErrors } =
    useForm<FormFields>({
      criteriaMode: 'all',
      defaultValues: {
        ...formData,
        assetAmount: formData.assetAmount || 0,
        assetAmountDisplay: '', // Will be set when asset is selected
        assetId: formData.assetId || '',
        assetTicker: formData.assetTicker || '',
        capacitySat: formData.capacitySat.toString(),
        fee: formData.fee || 'medium',
        pubKeyAndAddress: formData.pubKeyAndAddress,
        public: formData.public !== undefined ? formData.public : true,
      },
      mode: 'onChange',
      resolver: zodResolver(Step2Schema),
    })

  const capacitySat = watch('capacitySat')
  const selectedFee = watch('fee')
  const currentAssetAmount = watch('assetAmount')
  const currentAssetId = watch('assetId')
  const isPublic = watch('public')

  useEffect(() => {
    takerAssets()
  }, [takerAssets])

  useEffect(() => {
    const fetchBtcBalance = async () => {
      try {
        const balance = await btcBalance({ skip_sync: false })
        const totalSpendable =
          (balance.data?.vanilla.spendable || 0) +
          (balance.data?.colored.spendable || 0)
        const newMaxCapacity = Math.min(MAX_CHANNEL_CAPACITY, totalSpendable)
        setMaxCapacity(newMaxCapacity)
      } catch (error) {
        console.error('Error fetching BTC balance:', error)
      }
    }

    fetchBtcBalance()
  }, [btcBalance, setValue])

  useEffect(() => {
    if (
      takerAssetsResponse.isSuccess &&
      takerAssetsResponse.data?.nia.length > 0
    ) {
      const filteredAssets = takerAssetsResponse.data.nia.filter(
        (asset) => asset.balance.spendable > 0
      )

      setHasAvailableAssets(filteredAssets.length > 0)
      if (filteredAssets.length > 0) {
        const newMaxAssetAmountMap = filteredAssets.reduce(
          (acc: Record<string, number>, current: NiaAsset) => {
            acc[current.asset_id] = current.balance.spendable
            return acc
          },
          {}
        )
        setMaxAssetAmountMap(newMaxAssetAmountMap)

        // If we have a previously selected asset, find and set it
        if (formData.assetId) {
          const asset = filteredAssets.find(
            (a) => a.asset_id === formData.assetId
          )
          if (asset) {
            setSelectedAsset(asset)
            setAddAsset(true)
          }
        }
      } else {
        setAddAsset(false)
      }
    } else {
      setHasAvailableAssets(false)
      setAddAsset(false)
    }
  }, [takerAssetsResponse, formData.assetId])

  useEffect(() => {
    if (formState.isSubmitted) {
      clearErrors()
    }
  }, [capacitySat, currentAssetAmount, currentAssetId, clearErrors])

  const formatNumber = (num: number): string => {
    return num.toLocaleString('en-US')
  }

  const handleCapacityChange = (value: string) => {
    // Don't enforce minimum values during typing
    const sanitized = value.replace(/[^0-9.]/g, '')
    if (sanitized === '') {
      setValue('capacitySat', '')
      onFormUpdate({ capacitySat: 0 })
      return
    }

    const numValue = parseFloat(sanitized)
    if (isNaN(numValue)) return

    // Only enforce maximum constraint
    if (numValue > maxCapacity) {
      setValue('capacitySat', maxCapacity.toString())
      onFormUpdate({ capacitySat: maxCapacity })
      return
    }

    setValue('capacitySat', sanitized)
    onFormUpdate({ capacitySat: numValue })
  }

  const handleFeeChange = (fee: 'slow' | 'medium' | 'fast') => {
    setValue('fee', fee)
    onFormUpdate({ fee })
  }

  const handleAssetSelect = (assetId: string) => {
    const asset = takerAssetsResponse.data?.nia.find(
      (a) => a.asset_id === assetId
    )
    if (asset) {
      setSelectedAsset(asset)
      setValue('assetId', asset.asset_id)
      setValue('assetTicker', asset.ticker)
      onFormUpdate({
        assetAmount: 0,
        assetId: asset.asset_id,
        assetTicker: asset.ticker, // Reset amount when changing asset
      })
    }
  }

  const handleAddAssetToggle = (checked: boolean) => {
    setAddAsset(checked)
    if (!checked) {
      // Clear asset data when disabling
      setValue('assetId', '')
      setValue('assetTicker', '')
      setValue('assetAmount', 0)
      setSelectedAsset(null)
      onFormUpdate({
        assetAmount: 0,
        assetId: '',
        assetTicker: '',
      })
    }
  }

  const onSubmit: SubmitHandler<FormFields> = (data) => {
    // Check if capacity is empty or zero
    const parsedCapacity = parseFloat(data.capacitySat || '0')
    if (!parsedCapacity) {
      toast.error('Please enter a channel capacity.', {
        autoClose: 5000,
        position: 'bottom-right',
      })
      return
    }

    // Check if capacity is below minimum
    if (parsedCapacity < MIN_CHANNEL_CAPACITY) {
      toast.error(
        `Channel capacity must be at least ${formatNumber(MIN_CHANNEL_CAPACITY)} sats.`,
        {
          autoClose: 5000,
          position: 'bottom-right',
        }
      )
      return
    }

    // Check if "Add Asset" is checked but no asset is selected
    if (addAsset && !data.assetId) {
      toast.error('Please select an asset or uncheck the "Add Asset" option.', {
        autoClose: 5000,
        position: 'bottom-right',
      })
      return
    }

    // Check if asset is selected but no amount is provided
    if (addAsset && data.assetId && data.assetAmount <= 0) {
      toast.error(
        'Please enter an asset amount or remove the asset selection.',
        {
          autoClose: 5000,
          position: 'bottom-right',
        }
      )
      return
    }

    // Check if asset amount exceeds maximum available
    if (addAsset && data.assetId && selectedAsset) {
      const maxAmount = maxAssetAmountMap[selectedAsset.asset_id] || 0
      if (data.assetAmount > maxAmount) {
        const maxDisplayAmount = formatAssetAmountWithPrecision(
          maxAmount,
          selectedAsset.ticker,
          bitcoinUnit,
          [selectedAsset]
        )
        toast.error(
          `Asset amount exceeds maximum available: ${maxDisplayAmount} ${selectedAsset.ticker}`,
          {
            autoClose: 5000,
            position: 'bottom-right',
          }
        )
        return
      }
    }

    // All validations passed, proceed with form submission
    onFormUpdate({
      ...data,
      assetAmount: data.assetAmount || 0,
      capacitySat: parsedCapacity,
    })
    onNext()
  }

  const availableAssets =
    takerAssetsResponse.data?.nia.filter(
      (asset) => asset.balance.spendable > 0
    ) || []

  return (
    <form className="max-w-3xl mx-auto" onSubmit={handleSubmit(onSubmit)}>
      <div className="text-center mb-10">
        <h3 className="text-3xl font-bold text-white mb-4">
          Open a Channel - Step 2
        </h3>
        <h4 className="text-xl text-gray-400">
          Configure your channel capacity and assets
        </h4>
      </div>

      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-8">
        {/* PubKey display section */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Opening Channel with Node:
          </label>
          <div className="bg-gray-900/50 px-4 py-3 rounded-lg break-all font-mono text-sm text-white">
            {formData.pubKeyAndAddress}
          </div>
        </div>

        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Channel Capacity (satoshis)
            <span className="text-xs text-gray-500 ml-2">
              (The amount of BTC you want to allocate to this channel)
            </span>
          </label>
          <div className="flex items-center space-x-4">
            <input
              className="flex-grow rounded bg-blue-dark px-4 py-3 outline-none text-white"
              onChange={(e) => handleCapacityChange(e.target.value)}
              placeholder="Enter amount in sats"
              type="text"
              value={capacitySat ? formatNumber(parseFloat(capacitySat)) : ''}
            />
            <span className="text-sm text-gray-400">
              {formatNumber(maxCapacity)} max
            </span>
          </div>
          {capacitySat && parseFloat(capacitySat) > 0 && (
            <>
              <input
                className="w-full mt-2"
                max={maxCapacity}
                min={MIN_CHANNEL_CAPACITY}
                onChange={(e) => handleCapacityChange(e.target.value)}
                step={1000}
                type="range"
                value={parseFloat(capacitySat)}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Min: {formatNumber(MIN_CHANNEL_CAPACITY)}</span>
                <span>Max: {formatNumber(maxCapacity)}</span>
              </div>
            </>
          )}
          {formState.errors.capacitySat && (
            <p className="text-red-500 text-sm mt-1">
              {formState.errors.capacitySat.message}
            </p>
          )}
        </div>

        {/* Asset section */}
        <div className="border-t border-gray-700/50 my-8"></div>

        {hasAvailableAssets ? (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h5 className="text-lg font-semibold text-white">RGB Assets</h5>
                <p className="text-sm text-gray-400 mt-1">
                  Add RGB assets to your channel for asset transfers
                </p>
              </div>
              <button
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${
                    addAsset
                      ? 'bg-purple-600/20 border border-purple-500 text-white'
                      : 'bg-gray-900/50 border border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                  }`}
                onClick={() => handleAddAssetToggle(!addAsset)}
                type="button"
              >
                {addAsset ? 'Remove Asset' : 'Add Asset'}
              </button>
            </div>

            {addAsset && (
              <div className="space-y-6">
                <div className="bg-gray-900/50 p-6 rounded-lg">
                  <label className="block text-sm font-medium text-gray-400 mb-3">
                    Select Asset
                  </label>
                  <Controller
                    control={control}
                    name="assetId"
                    render={({ field }) => (
                      <>
                        <AssetSelectWithModal
                          className="w-full"
                          fieldLabel="Choose an RGB asset for your channel"
                          onChange={(value) => {
                            field.onChange(value)
                            handleAssetSelect(value)
                          }}
                          options={availableAssets.map((a: NiaAsset) => ({
                            assetId: a.asset_id,
                            label: a.name,
                            name: a.name,
                            ticker: a.ticker,
                            value: a.asset_id,
                          }))}
                          placeholder="Select an RGB asset"
                          searchPlaceholder="Search by name, ticker or asset ID..."
                          title="Select RGB Asset"
                          value={field.value}
                        />

                        {!field.value && addAsset && (
                          <p className="text-xs text-yellow-500 mt-2">
                            You must select an asset to proceed. If you don't
                            want to add an asset, uncheck the "Add Asset"
                            option.
                          </p>
                        )}
                      </>
                    )}
                  />
                </div>

                {selectedAsset && (
                  <div className="bg-gray-900/50 p-6 rounded-lg space-y-4">
                    {/* Enhanced Asset Amount Input */}
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-slate-300">
                        Asset Amount
                      </label>

                      {selectedAsset ? (
                        <div className="space-y-4">
                          {/* Asset Preview Card */}
                          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                            {/* Asset Header with Icon */}
                            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-700/50">
                              <img
                                alt={selectedAsset.ticker}
                                className="w-10 h-10 rounded-full border-2 border-slate-600/50"
                                onError={() => setAssetIconSrc(defaultIcon)}
                                src={assetIconSrc}
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg font-semibold text-white">
                                    {selectedAsset.ticker}
                                  </span>
                                  <span className="text-sm text-slate-400">
                                    ({selectedAsset.name})
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500">
                                  {selectedAsset.precision} decimal places
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Asset Info */}
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-400">
                                    Full Asset ID:
                                  </span>
                                </div>
                                <div
                                  className="text-xs font-mono text-slate-300 break-all bg-slate-900/50 p-2 rounded border border-slate-700/30"
                                  title={selectedAsset.asset_id}
                                >
                                  {selectedAsset.asset_id}
                                </div>
                              </div>

                              {/* Balance Info */}
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-400">
                                    Available:
                                  </span>
                                  <span className="text-sm font-medium text-green-400">
                                    {selectedAsset.balance
                                      ? formatAssetAmountWithPrecision(
                                          selectedAsset.balance.spendable,
                                          selectedAsset.ticker,
                                          bitcoinUnit,
                                          [selectedAsset]
                                        )
                                      : '0'}{' '}
                                    {selectedAsset.ticker}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-400">
                                    Max for Channels:
                                  </span>
                                  <span className="text-sm text-blue-400 font-medium">
                                    {formatAssetAmountWithPrecision(
                                      maxAssetAmountMap[
                                        selectedAsset.asset_id
                                      ] || 0,
                                      selectedAsset.ticker,
                                      bitcoinUnit,
                                      [selectedAsset]
                                    )}{' '}
                                    {selectedAsset.ticker}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Amount Input */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">
                              Amount ({selectedAsset.ticker})
                            </label>
                            <input
                              className={twJoin(
                                'w-full px-4 py-3 bg-slate-900/70 border rounded-xl',
                                'text-white text-lg font-medium placeholder:text-slate-500',
                                'border-slate-600/50 hover:border-slate-500/70',
                                'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none',
                                'transition-all duration-200'
                              )}
                              inputMode="decimal"
                              onBlur={(e) => {
                                // Only when user finishes typing, convert to proper format and validate
                                const value = e.target.value
                                if (value && selectedAsset) {
                                  const numValue = parseFloat(value)
                                  if (!isNaN(numValue) && numValue > 0) {
                                    // Convert to raw amount for API
                                    const rawAmount =
                                      parseAssetAmountWithPrecision(
                                        value,
                                        selectedAsset.ticker,
                                        bitcoinUnit,
                                        [selectedAsset]
                                      )

                                    // Validate against max available balance
                                    const maxAmount =
                                      maxAssetAmountMap[
                                        selectedAsset.asset_id
                                      ] || 0
                                    if (rawAmount > maxAmount) {
                                      // Set to max amount and show notification
                                      const maxDisplayAmount =
                                        formatAssetAmountWithPrecision(
                                          maxAmount,
                                          selectedAsset.ticker,
                                          bitcoinUnit,
                                          [selectedAsset]
                                        )

                                      setAssetAmountInput(maxDisplayAmount)
                                      setValue('assetAmount', maxAmount)
                                      onFormUpdate({ assetAmount: maxAmount })

                                      toast.warn(
                                        `Amount exceeds maximum available: ${maxDisplayAmount} ${selectedAsset.ticker}. Value has been adjusted.`,
                                        {
                                          autoClose: 4000,
                                          position: 'bottom-right',
                                        }
                                      )
                                      return
                                    }

                                    setValue('assetAmount', rawAmount)
                                    onFormUpdate({ assetAmount: rawAmount })
                                  } else {
                                    setValue('assetAmount', 0)
                                    onFormUpdate({ assetAmount: 0 })
                                  }
                                } else {
                                  setValue('assetAmount', 0)
                                  onFormUpdate({ assetAmount: 0 })
                                }
                              }}
                              onChange={(e) => {
                                const value = e.target.value
                                // Allow empty input
                                if (value === '') {
                                  setAssetAmountInput('')
                                  setValue('assetAmount', 0)
                                  onFormUpdate({ assetAmount: 0 })
                                  return
                                }

                                // Prevent alpha characters - only allow numbers, decimal point
                                if (!/^[\d.]*$/.test(value)) {
                                  return // Reject input with letters or special chars
                                }

                                // Basic decimal validation - allow typing naturally
                                const decimalRegex =
                                  selectedAsset.precision > 0
                                    ? new RegExp(
                                        `^\\d*\\.?\\d{0,${selectedAsset.precision}}$`
                                      )
                                    : /^\d*$/

                                if (decimalRegex.test(value)) {
                                  setAssetAmountInput(value)
                                }
                              }}
                              onKeyDown={(e) => {
                                // Prevent entering non-numeric characters via keyboard
                                const allowedKeys = [
                                  'Backspace',
                                  'Delete',
                                  'Tab',
                                  'Escape',
                                  'Enter',
                                  'ArrowLeft',
                                  'ArrowRight',
                                  'ArrowUp',
                                  'ArrowDown',
                                  'Home',
                                  'End',
                                ]

                                // Allow Ctrl/Cmd combinations (copy, paste, select all, etc.)
                                if (e.ctrlKey || e.metaKey) {
                                  return
                                }

                                // Allow decimal point only if precision > 0 and not already present
                                if (
                                  e.key === '.' &&
                                  selectedAsset.precision > 0 &&
                                  !assetAmountInput.includes('.')
                                ) {
                                  return
                                }

                                // Allow numbers
                                if (/^\d$/.test(e.key)) {
                                  return
                                }

                                // Allow special keys
                                if (allowedKeys.includes(e.key)) {
                                  return
                                }

                                // Prevent all other keys
                                e.preventDefault()
                              }}
                              placeholder={`0.${'0'.repeat(selectedAsset.precision)}`}
                              type="text"
                              value={assetAmountInput}
                            />

                            {/* Quick amount buttons */}
                            <div className="flex gap-2">
                              <button
                                className={twJoin(
                                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200',
                                  'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 hover:text-white',
                                  'border border-slate-600/30 hover:border-slate-500/50'
                                )}
                                onClick={() => {
                                  setAssetAmountInput('')
                                  setValue('assetAmount', 0)
                                  onFormUpdate({ assetAmount: 0 })
                                }}
                                type="button"
                              >
                                Clear
                              </button>
                              <button
                                className={twJoin(
                                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200',
                                  'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300',
                                  'border border-blue-500/30 hover:border-blue-500/50'
                                )}
                                onClick={() => {
                                  const maxAmount =
                                    maxAssetAmountMap[selectedAsset.asset_id] ||
                                    0
                                  const displayAmount =
                                    formatAssetAmountWithPrecision(
                                      maxAmount * 0.25,
                                      selectedAsset.ticker,
                                      bitcoinUnit,
                                      [selectedAsset]
                                    )
                                  setAssetAmountInput(displayAmount)
                                  setValue('assetAmount', maxAmount * 0.25)
                                  onFormUpdate({
                                    assetAmount: maxAmount * 0.25,
                                  })
                                }}
                                type="button"
                              >
                                25%
                              </button>
                              <button
                                className={twJoin(
                                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200',
                                  'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300',
                                  'border border-blue-500/30 hover:border-blue-500/50'
                                )}
                                onClick={() => {
                                  const maxAmount =
                                    maxAssetAmountMap[selectedAsset.asset_id] ||
                                    0
                                  const displayAmount =
                                    formatAssetAmountWithPrecision(
                                      maxAmount * 0.5,
                                      selectedAsset.ticker,
                                      bitcoinUnit,
                                      [selectedAsset]
                                    )
                                  setAssetAmountInput(displayAmount)
                                  setValue('assetAmount', maxAmount * 0.5)
                                  onFormUpdate({ assetAmount: maxAmount * 0.5 })
                                }}
                                type="button"
                              >
                                50%
                              </button>
                              <button
                                className={twJoin(
                                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200',
                                  'bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:text-green-300',
                                  'border border-green-500/30 hover:border-green-500/50'
                                )}
                                onClick={() => {
                                  const maxAmount =
                                    maxAssetAmountMap[selectedAsset.asset_id] ||
                                    0
                                  const displayAmount =
                                    formatAssetAmountWithPrecision(
                                      maxAmount,
                                      selectedAsset.ticker,
                                      bitcoinUnit,
                                      [selectedAsset]
                                    )
                                  setAssetAmountInput(displayAmount)
                                  setValue('assetAmount', maxAmount)
                                  onFormUpdate({ assetAmount: maxAmount })
                                }}
                                type="button"
                              >
                                Max
                              </button>
                            </div>

                            {formState.errors.assetAmount && (
                              <div className="text-sm text-red-400">
                                {formState.errors.assetAmount.message}
                              </div>
                            )}

                            {/* Validation feedback and helper text */}
                            <div className="space-y-1">
                              {assetAmountInput && selectedAsset && (
                                <div className="text-xs">
                                  {(() => {
                                    const inputValue =
                                      parseFloat(assetAmountInput) || 0
                                    const rawInputAmount =
                                      parseAssetAmountWithPrecision(
                                        assetAmountInput,
                                        selectedAsset.ticker,
                                        bitcoinUnit,
                                        [selectedAsset]
                                      )
                                    const maxAmount =
                                      maxAssetAmountMap[
                                        selectedAsset.asset_id
                                      ] || 0
                                    const maxDisplayAmount =
                                      formatAssetAmountWithPrecision(
                                        maxAmount,
                                        selectedAsset.ticker,
                                        bitcoinUnit,
                                        [selectedAsset]
                                      )

                                    if (inputValue <= 0) {
                                      return null
                                    } else if (rawInputAmount > maxAmount) {
                                      return (
                                        <span className="text-red-400 flex items-center gap-1">
                                          ⚠️ Exceeds maximum available (
                                          {maxDisplayAmount}{' '}
                                          {selectedAsset.ticker})
                                        </span>
                                      )
                                    } else if (
                                      rawInputAmount >
                                      maxAmount * 0.9
                                    ) {
                                      return (
                                        <span className="text-orange-400 flex items-center gap-1">
                                          ⚡ Near maximum limit (
                                          {maxDisplayAmount}{' '}
                                          {selectedAsset.ticker})
                                        </span>
                                      )
                                    } else {
                                      return (
                                        <span className="text-green-400 flex items-center gap-1">
                                          ✅ Valid amount
                                        </span>
                                      )
                                    }
                                  })()}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-900/50 border border-slate-600/50 rounded-xl p-6 text-center">
                          <div className="text-slate-400 text-sm">
                            Please select an asset first to enter an amount
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="mb-8 p-6 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <div className="flex items-center justify-center text-yellow-500">
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
              <p>
                You do not have any spendable on-chain RGB assets to open a
                channel with.
              </p>
            </div>
          </div>
        )}

        {/* Fee selection section */}
        <div className="border-t border-gray-700/50 my-8"></div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-4">
            Transaction Fee Rate
          </label>
          <div className="flex space-x-4">
            {['slow', 'medium', 'fast'].map((speed) => (
              <button
                className={`flex-1 py-3 px-4 rounded-lg text-center transition-all
                  ${
                    selectedFee === speed
                      ? 'bg-purple-600/20 border border-purple-500 text-white shadow-lg'
                      : 'bg-gray-900/50 border border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                  }`}
                key={speed}
                onClick={() =>
                  handleFeeChange(speed as 'slow' | 'medium' | 'fast')
                }
                type="button"
              >
                <div className="font-medium capitalize">{speed}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {`${feeRates[speed]} sat/vB`}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Channel Privacy section */}
        <div className="border-t border-gray-700/50 my-8"></div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-4">
            Channel Privacy
          </label>
          <div className="bg-gray-900/50 p-6 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="text-white font-medium mb-1">
                  {isPublic ? 'Public Channel' : 'Private Channel'}
                </h5>
                <p className="text-sm text-gray-400">
                  {isPublic
                    ? 'Visible on the Lightning Network and can be used for routing payments'
                    : 'Only known to the two parties and cannot be used for routing'}
                </p>
              </div>

              {/* Toggle Switch */}
              <button
                aria-checked={isPublic}
                aria-label="Toggle channel privacy"
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                  isPublic ? 'bg-purple-600' : 'bg-gray-600'
                }`}
                onClick={() => {
                  const newValue = !isPublic
                  setValue('public', newValue)
                  onFormUpdate({ public: newValue })
                }}
                role="switch"
                type="button"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isPublic ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
                <div className="text-sm text-blue-300">
                  <strong>Public channels</strong> are discoverable and can
                  route payments for the network.
                  <strong>Private channels</strong> provide direct connectivity
                  without network visibility.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between mt-8">
        <Button
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M15 19l-7-7 7-7"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          }
          onClick={onBack}
          size="lg"
          type="button"
          variant="secondary"
        >
          Back
        </Button>

        <Button
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M9 5l7 7-7 7"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          }
          iconPosition="right"
          size="lg"
          type="submit"
          variant="primary"
        >
          Next
        </Button>
      </div>

      {!formState.isSubmitSuccessful && formState.isSubmitted && (
        <FormError
          errors={Object.entries(formState.errors).reduce(
            (acc, [key, error]) => {
              if (error?.message) {
                acc[key] = [error.message]
              }
              return acc
            },
            {} as Record<string, string[]>
          )}
          message="Please check the form for errors"
        />
      )}
    </form>
  )
}
