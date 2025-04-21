import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { Controller, SubmitHandler, useForm } from 'react-hook-form'
import { toast } from 'react-toastify'
import { z } from 'zod'

import { Select } from '../../components/Select'
import { MAX_CHANNEL_CAPACITY, MIN_CHANNEL_CAPACITY } from '../../constants'
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
  assetId: string
  assetTicker: string
  fee: 'slow' | 'medium' | 'fast'
}

const Step2Schema = NewChannelFormSchema.omit({
  capacitySat: true,
  pubKeyAndAddress: true,
}).extend({
  assetId: z.string().optional(),
  assetTicker: z.string().optional(),
  capacitySat: z.string(),
  pubKeyAndAddress: z.string(),
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

  const [takerAssets, takerAssetsResponse] =
    nodeApi.endpoints.listAssets.useLazyQuery()
  const [btcBalance] = nodeApi.endpoints.btcBalance.useLazyQuery()

  const { handleSubmit, setValue, control, watch, formState, clearErrors } =
    useForm<FormFields>({
      criteriaMode: 'all',
      defaultValues: {
        ...formData,
        assetAmount: formData.assetAmount || 0,
        assetId: formData.assetId || '',
        assetTicker: formData.assetTicker || '',
        capacitySat: formData.capacitySat.toString(),
        fee: formData.fee || 'medium',
        pubKeyAndAddress: formData.pubKeyAndAddress,
      },
      mode: 'onChange',
      resolver: zodResolver(Step2Schema),
    })

  const capacitySat = watch('capacitySat')
  const selectedFee = watch('fee')
  const currentAssetAmount = watch('assetAmount')
  const currentAssetId = watch('assetId')

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

  const handleAssetAmountChange = (value: string) => {
    // Don't enforce minimum values during typing
    const sanitized = value.replace(/[^0-9.]/g, '')
    if (sanitized === '') {
      setValue('assetAmount', 0)
      onFormUpdate({ assetAmount: 0 })
      return
    }

    const numValue = parseFloat(sanitized)
    if (isNaN(numValue)) return

    // Only enforce maximum constraint
    const maxAmount = selectedAsset
      ? maxAssetAmountMap[selectedAsset.asset_id] || 0
      : 0
    if (numValue > maxAmount) {
      setValue('assetAmount', maxAmount)
      onFormUpdate({ assetAmount: maxAmount })

      // Show toast notification
      toast.info(
        `Asset amount limited to maximum: ${formatNumber(maxAmount)} ${selectedAsset?.ticker || ''}`,
        {
          autoClose: 3000,
          position: 'bottom-right',
        }
      )
      return
    }

    setValue('assetAmount', numValue)
    onFormUpdate({ assetAmount: numValue })
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
                        <Select
                          {...field}
                          active={field.value}
                          onSelect={(value) => {
                            field.onChange(value)
                            handleAssetSelect(value)
                          }}
                          options={availableAssets.map((a: NiaAsset) => ({
                            label: a.ticker,
                            value: a.asset_id,
                          }))}
                          theme="dark"
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

                  {selectedAsset && (
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div className="bg-gray-800/50 p-4 rounded-lg">
                        <div className="text-xs text-gray-400">
                          Available Balance
                        </div>
                        <div className="text-lg text-white font-medium mt-1">
                          {formatNumber(
                            maxAssetAmountMap[selectedAsset.asset_id] || 0
                          )}
                        </div>
                      </div>
                      <div className="bg-gray-800/50 p-4 rounded-lg">
                        <div className="text-xs text-gray-400">Asset Name</div>
                        <div className="text-lg text-white font-medium mt-1">
                          {selectedAsset.ticker}
                        </div>
                      </div>
                      <div className="col-span-2 bg-gray-800/50 p-4 rounded-lg">
                        <div className="text-xs text-gray-400">Asset ID</div>
                        <div className="text-sm text-white font-mono mt-1 break-all">
                          {selectedAsset.asset_id}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {selectedAsset && (
                  <div className="bg-gray-900/50 p-6 rounded-lg">
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-sm font-medium text-gray-400">
                        Asset Amount
                      </label>
                      <span className="text-xs text-gray-500">
                        Max:{' '}
                        {formatNumber(
                          maxAssetAmountMap[selectedAsset.asset_id] || 0
                        )}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <input
                        className="w-full rounded bg-blue-dark px-4 py-3 outline-none text-white"
                        onChange={(e) =>
                          handleAssetAmountChange(e.target.value)
                        }
                        placeholder="Enter asset amount"
                        type="text"
                        value={
                          currentAssetAmount
                            ? formatNumber(currentAssetAmount)
                            : ''
                        }
                      />
                      <input
                        className="w-full"
                        max={maxAssetAmountMap[selectedAsset.asset_id] || 0}
                        min={0}
                        onChange={(e) =>
                          handleAssetAmountChange(e.target.value)
                        }
                        type="range"
                        value={currentAssetAmount.toString()}
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>0</span>
                        <span>
                          {formatNumber(
                            maxAssetAmountMap[selectedAsset.asset_id] || 0
                          )}
                        </span>
                      </div>
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
      </div>

      <div className="flex justify-between mt-8">
        <button
          className="px-8 py-3 rounded-lg text-lg font-bold
            bg-gray-700 hover:bg-gray-600 text-gray-300
            transform transition-all duration-200
            focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50
            shadow-md hover:shadow-lg
            flex items-center"
          onClick={onBack}
          type="button"
        >
          <svg
            className="w-5 h-5 mr-2"
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
          Back
        </button>

        <button
          className="px-8 py-3 rounded-lg text-lg font-bold text-white
            bg-blue-600 hover:bg-blue-700
            transform transition-all duration-200
            focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
            shadow-lg hover:shadow-xl
            flex items-center"
          type="submit"
        >
          Next
          <svg
            className="w-5 h-5 ml-2"
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
        </button>
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
