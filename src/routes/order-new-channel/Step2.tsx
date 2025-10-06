import { zodResolver } from '@hookform/resolvers/zod'
import React, { useCallback, useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { toast } from 'react-toastify'
import { twJoin } from 'tailwind-merge'
import * as z from 'zod'

import { useAppDispatch } from '../../app/store/hooks'
import defaultIcon from '../../assets/rgb-symbol-color.svg'
import { Select } from '../../components/Select'
import { AssetSelectWithModal } from '../../components/Trade/AssetSelectWithModal'
import { MIN_CHANNEL_CAPACITY, MAX_CHANNEL_CAPACITY } from '../../constants'
import {
  formatNumberWithCommas,
  parseNumberWithCommas,
} from '../../helpers/number'
import { useAssetIcon } from '../../helpers/utils'
import {
  orderChannelSliceActions,
  OrderChannelFormSchema,
  TChannelRequestForm,
} from '../../slices/channel/orderChannel.slice'
import { makerApi, ChannelFees } from '../../slices/makerApi/makerApi.slice'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'

import { FormError } from './FormError'
import 'react-toastify/dist/ReactToastify.css'

interface Props {
  onNext: (data: TChannelRequestForm) => void
  onBack: () => void
}

interface AssetInfo {
  name: string
  ticker: string
  asset_id: string
  precision: number
  min_initial_client_amount: number
  max_initial_client_amount: number
  min_initial_lsp_amount: number
  max_initial_lsp_amount: number
  min_channel_amount: number
  max_channel_amount: number
}

interface LspOptions {
  min_required_channel_confirmations: number
  min_funding_confirms_within_blocks: number
  min_onchain_payment_confirmations: number
  supports_zero_channel_reserve: boolean
  min_onchain_payment_size_sat: number
  max_channel_expiry_blocks: number
  min_initial_client_balance_sat: number
  max_initial_client_balance_sat: number
  min_initial_lsp_balance_sat: number
  max_initial_lsp_balance_sat: number
  min_channel_balance_sat: number
  max_channel_balance_sat: number
}

const FormFieldsSchema = z.object({
  assetAmount: z.string().optional().default(''),
  assetId: z.string().optional().default(''),
  capacitySat: z.string(),
  channelExpireBlocks: z.number(),
  clientBalanceSat: z.string(),
})

type FormFields = z.infer<typeof FormFieldsSchema>

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
}) => {
  const [displayValue, setDisplayValue] = useState(
    value ? formatNumberWithCommas(value) : ''
  )
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(value ? formatNumberWithCommas(value) : '')
    }
  }, [value, isFocused])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    if (max !== undefined && parsedValue > max) {
      formattedValue = max.toString()
    }

    setDisplayValue(formattedValue)
    onChange(formattedValue)
  }

  // Add a new function to handle blur event
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

    // Don't apply min constraints on blur - let the form submission handle it
    // Only apply max constraints to prevent errors
    let finalValue = value
    if (max !== undefined && parsedValue > max) {
      finalValue = max.toString()
      onChange(finalValue)
    }

    setDisplayValue(formatNumberWithCommas(finalValue))
  }

  return (
    <div className={className}>
      <div className="flex justify-between items-center mb-2">
        <label className="block text-sm font-medium text-gray-300">
          {label}
        </label>
        <span className="text-sm text-gray-400">
          {value ? formatSliderValue(parseFloat(value || '0'), precision) : ''}
        </span>
      </div>
      <div className="relative">
        <input
          className={`w-full px-4 py-3 bg-gray-700/50 border ${
            error ? 'border-red-500' : 'border-gray-600'
          } rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 text-white`}
          onBlur={handleBlur}
          onChange={handleChange}
          onFocus={() => {
            setIsFocused(true)
            setDisplayValue(parseNumberWithCommas(value))
          }}
          placeholder={placeholder}
          type="text"
          value={
            isFocused ? displayValue : formatNumberWithCommas(displayValue)
          }
        />
        {error && <p className="absolute text-sm text-red-500 mt-1">{error}</p>}
      </div>
      {showSlider && (
        <input
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer mt-4 accent-blue-500"
          max={max}
          min={min}
          onChange={onSliderChange}
          step={sliderStep}
          type="range"
          value={sliderValue}
        />
      )}
    </div>
  )
}

export const Step2: React.FC<Props> = ({ onNext, onBack }) => {
  const dispatch = useAppDispatch()
  const [assetMap, setAssetMap] = useState<Record<string, AssetInfo>>({})
  const [addAsset, setAddAsset] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [lspOptions, setLspOptions] = useState<LspOptions | null>(null)
  const [effectiveMinCapacity, setEffectiveMinCapacity] =
    useState<number>(MIN_CHANNEL_CAPACITY)
  const [effectiveMaxCapacity, setEffectiveMaxCapacity] =
    useState<number>(MAX_CHANNEL_CAPACITY)
  const [fees, setFees] = useState<ChannelFees | null>(null)
  const [isLoadingFees, setIsLoadingFees] = useState(false)

  const { handleSubmit, setValue, control, watch, formState } =
    useForm<FormFields>({
      defaultValues: {
        assetAmount: '',
        assetId: '',
        capacitySat: '100000', // Default to 100,000 sats
        channelExpireBlocks: 12960, // Default to 3 months (12960 blocks)
        clientBalanceSat: '20000', // Default to 20,000 sats inbound liquidity
      },
      resolver: zodResolver(FormFieldsSchema),
    })

  const [getInfoRequest] = makerApi.endpoints.get_info.useLazyQuery()
  const [estimateFeesRequest] = makerApi.endpoints.estimate_fees.useLazyQuery()
  const [nodeInfoRequest] = nodeApi.endpoints.nodeInfo.useLazyQuery()

  const assetId = watch('assetId')

  // Asset icon hook
  const selectedAssetInfo = assetId ? assetMap[assetId] : null
  const [assetIconSrc, setAssetIconSrc] = useAssetIcon(
    selectedAssetInfo?.ticker || '',
    defaultIcon
  )

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const infoResponse = await getInfoRequest()

        if (infoResponse.data) {
          if (infoResponse.data.options) {
            setLspOptions(infoResponse.data.options)

            const lspMinCapacity =
              infoResponse.data.options.min_channel_balance_sat || 0
            const lspMaxCapacity =
              infoResponse.data.options.max_channel_balance_sat ||
              Number.MAX_SAFE_INTEGER

            const newMinCapacity = Math.max(
              MIN_CHANNEL_CAPACITY,
              lspMinCapacity
            )
            setEffectiveMinCapacity(newMinCapacity)

            const newMaxCapacity = Math.min(
              MAX_CHANNEL_CAPACITY,
              lspMaxCapacity
            )
            setEffectiveMaxCapacity(newMaxCapacity)
          }

          if (infoResponse.data.assets) {
            const tmpMap: Record<string, AssetInfo> = {}
            if (Array.isArray(infoResponse.data.assets)) {
              infoResponse.data.assets.forEach((asset: AssetInfo) => {
                tmpMap[asset.asset_id] = asset
              })
            }
            setAssetMap(tmpMap)
          }
        }
      } catch (error) {
        toast.error('Error fetching data. Please try again later.', {
          autoClose: 5000,
          position: 'bottom-right',
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [getInfoRequest, setValue])

  const getAssetPrecision = useCallback(
    (assetId: string) => {
      const assetInfo = assetMap[assetId]
      return assetInfo ? assetInfo.precision : 8
    },
    [assetMap]
  )

  const parseAssetAmount = useCallback(
    (amount: string, assetId: string): number => {
      const precision = getAssetPrecision(assetId)
      const multiplier = Math.pow(10, precision)
      if (amount === '') {
        return 0
      }
      const cleanAmount = amount.replace(/[^\d.-]/g, '')
      return Math.round(parseFloat(cleanAmount) * multiplier)
    },
    [getAssetPrecision]
  )

  const onSubmit = useCallback(
    (data: FormFields) => {
      // Check if required fields are filled, but don't block on minimum values
      if (!data.capacitySat) {
        toast.error('Please enter a channel capacity.', {
          autoClose: 5000,
          position: 'bottom-right',
        })
        return
      }

      if (!data.clientBalanceSat) {
        toast.error('Please enter your channel liquidity.', {
          autoClose: 5000,
          position: 'bottom-right',
        })
        return
      }

      if (addAsset && !data.assetId) {
        toast.error('Please select an asset before proceeding.', {
          autoClose: 5000,
          position: 'bottom-right',
        })
        return
      }

      if (
        addAsset &&
        data.assetId &&
        (data.assetAmount === '' || data.assetAmount === '0')
      ) {
        toast.error('Please enter an amount before proceeding.', {
          autoClose: 5000,
          position: 'bottom-right',
        })
        return
      }

      // Apply min/max constraints before submission
      let capacitySat = data.capacitySat
      let clientBalanceSat = data.clientBalanceSat

      const parsedCapacitySat = parseInt(capacitySat.replace(/[^0-9]/g, ''), 10)

      // Always adjust to minimum instead of blocking submission
      if (
        isNaN(parsedCapacitySat) ||
        parsedCapacitySat < effectiveMinCapacity
      ) {
        capacitySat = effectiveMinCapacity.toString()
        setValue('capacitySat', capacitySat)
        toast.info(
          `Channel capacity adjusted to minimum: ${formatNumberWithCommas(capacitySat)} sats`,
          {
            autoClose: 3000,
            position: 'bottom-right',
          }
        )
      }

      const parsedClientBalanceSat = parseInt(
        clientBalanceSat.replace(/[^0-9]/g, ''),
        10
      )

      const minClientBalance = lspOptions?.min_initial_client_balance_sat || 0
      if (
        isNaN(parsedClientBalanceSat) ||
        parsedClientBalanceSat < minClientBalance
      ) {
        clientBalanceSat = minClientBalance.toString()
        setValue('clientBalanceSat', clientBalanceSat)
        toast.info(
          `Channel liquidity adjusted to minimum: ${formatNumberWithCommas(clientBalanceSat)} sats`,
          {
            autoClose: 3000,
            position: 'bottom-right',
          }
        )
      }

      let assetAmount = data.assetAmount || ''
      if (addAsset && data.assetId) {
        const assetInfo = assetMap[data.assetId]
        if (assetInfo) {
          const minAssetAmount =
            assetInfo.min_channel_amount / Math.pow(10, assetInfo.precision)
          const maxAssetAmount =
            assetInfo.max_channel_amount / Math.pow(10, assetInfo.precision)
          const parsedAmount = parseFloat(assetAmount || '0')

          // Validate minimum amount
          if (
            (parsedAmount !== 0 && isNaN(parsedAmount)) ||
            (parsedAmount > 0 && parsedAmount < minAssetAmount)
          ) {
            assetAmount = minAssetAmount.toString()
            setValue('assetAmount', assetAmount)
            toast.info(
              `Asset amount adjusted to minimum: ${formatNumberWithCommas(assetAmount)} ${assetInfo.ticker}`,
              {
                autoClose: 3000,
                position: 'bottom-right',
              }
            )
          }

          // Validate maximum amount and PREVENT submission if exceeded
          if (parsedAmount > maxAssetAmount) {
            toast.error(
              `Amount exceeds maximum limit of ${formatNumberWithCommas(maxAssetAmount.toString())} ${assetInfo.ticker}. Please enter a valid amount before proceeding.`,
              {
                autoClose: 5000,
                position: 'bottom-right',
              }
            )
            return // PREVENT form submission
          }
        }
      }

      const parsedAssetAmount =
        addAsset && data.assetId
          ? parseAssetAmount(assetAmount, data.assetId)
          : 0

      const submissionData: TChannelRequestForm = {
        assetAmount: parsedAssetAmount,
        assetId: data.assetId || '',
        capacitySat: parsedCapacitySat,
        channelExpireBlocks: data.channelExpireBlocks,
        clientBalanceSat: parsedClientBalanceSat,
      }

      try {
        // Validate the data using the schema
        OrderChannelFormSchema.parse(submissionData)

        // If validation passes, update Redux and proceed
        dispatch(orderChannelSliceActions.setChannelRequestForm(submissionData))
        onNext(submissionData)
      } catch (error) {
        if (error instanceof z.ZodError) {
          console.error('Validation error:', error.errors)

          // Instead of showing an error, adjust the values and try again
          const adjustedData = { ...submissionData }
          let madeAdjustments = false

          error.errors.forEach((err) => {
            const path = err.path.join('.')
            if (path === 'capacitySat' && err.message.includes('minimum')) {
              adjustedData.capacitySat = effectiveMinCapacity
              setValue('capacitySat', effectiveMinCapacity.toString())
              madeAdjustments = true
            } else if (
              path === 'capacitySat' &&
              err.message.includes('maximum')
            ) {
              adjustedData.capacitySat = MAX_CHANNEL_CAPACITY
              setValue('capacitySat', MAX_CHANNEL_CAPACITY.toString())
              madeAdjustments = true
            } else if (
              path === 'clientBalanceSat' &&
              err.message.includes('minimum')
            ) {
              const minValue = lspOptions?.min_initial_client_balance_sat || 0
              adjustedData.clientBalanceSat = minValue
              setValue('clientBalanceSat', minValue.toString())
              madeAdjustments = true
            } else if (
              path === 'assetAmount' &&
              addAsset &&
              data.assetId &&
              assetMap[data.assetId]
            ) {
              const assetInfo = assetMap[data.assetId]
              const minAssetAmount =
                assetInfo.min_channel_amount / Math.pow(10, assetInfo.precision)
              adjustedData.assetAmount =
                minAssetAmount * Math.pow(10, assetInfo.precision)
              setValue('assetAmount', minAssetAmount.toString())
              madeAdjustments = true
            }
          })

          if (madeAdjustments) {
            toast.info('Some values were adjusted to meet requirements.', {
              autoClose: 3000,
              position: 'bottom-right',
            })

            // Update Redux and proceed with adjusted data
            dispatch(
              orderChannelSliceActions.setChannelRequestForm(adjustedData)
            )
            onNext(adjustedData)
            return
          }

          toast.error(
            'There was an error with the form data. Please check your inputs.'
          )
        } else {
          toast.error('An unexpected error occurred. Please try again.')
        }
      }
    },
    [
      addAsset,
      onNext,
      parseAssetAmount,
      dispatch,
      setValue,
      effectiveMinCapacity,
      lspOptions,
      assetMap,
    ]
  )

  const getChannelExpiryOptions = useCallback(() => {
    const options = [
      { label: '1 month', value: '4320' },
      { label: '3 months', value: '12960' },
    ]

    const sixMonthsBlocks = 25920 // 6 * 24 * 30 * 6
    if (
      !lspOptions ||
      sixMonthsBlocks <= lspOptions.max_channel_expiry_blocks
    ) {
      options.push({ label: '6 months', value: sixMonthsBlocks.toString() })
    }

    return options
  }, [lspOptions])

  // Fetch fee estimates when channel parameters change
  useEffect(() => {
    const fetchFees = async () => {
      const capacitySat = watch('capacitySat')
      const clientBalanceSat = watch('clientBalanceSat')
      const channelExpireBlocks = watch('channelExpireBlocks')
      const assetId = watch('assetId')
      const assetAmount = watch('assetAmount')

      // Only fetch if we have valid basic parameters
      if (!capacitySat || !clientBalanceSat || isLoading) {
        return
      }

      const parsedCapacity = parseInt(capacitySat.replace(/[^0-9]/g, ''), 10)
      const parsedClientBalance = parseInt(
        clientBalanceSat.replace(/[^0-9]/g, ''),
        10
      )

      if (isNaN(parsedCapacity) || isNaN(parsedClientBalance)) {
        return
      }

      const lspBalance = parsedCapacity - parsedClientBalance

      try {
        setIsLoadingFees(true)

        // Get node info to get pubkey
        const nodeInfoResponse = await nodeInfoRequest()
        const clientPubKey = nodeInfoResponse.data?.pubkey

        if (!clientPubKey) {
          // Node not ready yet, skip fee estimation
          setIsLoadingFees(false)
          return
        }

        const request: any = {
          announce_channel: false,
          channel_expiry_blocks: channelExpireBlocks,
          client_balance_sat: parsedClientBalance,
          client_pubkey: clientPubKey,
          funding_confirms_within_blocks: 6,
          lsp_balance_sat: lspBalance,
          refund_onchain_address: '',
          required_channel_confirmations: 1,
        }

        // Add asset parameters if an asset is selected
        if (addAsset && assetId && assetAmount && assetMap[assetId]) {
          const parsedAssetAmount = parseAssetAmount(assetAmount, assetId)
          request.asset_id = assetId
          request.lsp_asset_amount = parsedAssetAmount
          request.client_asset_amount = 0
        }

        const response = await estimateFeesRequest(request)

        if (response.data) {
          setFees(response.data)
        }
      } catch (error) {
        console.error('Error fetching fees:', error)
        // Don't show error toast - fees are just estimates
      } finally {
        setIsLoadingFees(false)
      }
    }

    // Debounce the fee fetching to avoid too many requests
    const timeoutId = setTimeout(fetchFees, 500)

    return () => clearTimeout(timeoutId)
  }, [
    watch('capacitySat'),
    watch('clientBalanceSat'),
    watch('channelExpireBlocks'),
    watch('assetId'),
    watch('assetAmount'),
    addAsset,
    isLoading,
    estimateFeesRequest,
    nodeInfoRequest,
    parseAssetAmount,
    assetMap,
  ])

  return (
    <div className="w-full">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            Configure Your Channel
          </h2>
          <p className="text-gray-400 mt-2">Set up your channel parameters</p>
          <p className="text-gray-400 mt-1">
            Fees will be calculated in the next step based on all parameters
            including channel capacity, duration, and assets
          </p>
        </div>

        <div className="flex justify-between mb-4">
          <div className="flex items-center opacity-50">
            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white font-bold text-sm">
              1
            </div>
            <div className="ml-2">
              <p className="font-medium text-white text-sm">Connect LSP</p>
              <p className="text-xs text-gray-400">Completed</p>
            </div>
          </div>
          <div className="flex-1 mx-2 mt-5">
            <div className="h-1 bg-gray-700">
              <div className="h-1 bg-blue-500 w-1/2"></div>
            </div>
          </div>
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
              2
            </div>
            <div className="ml-2">
              <p className="font-medium text-white text-sm">Configure</p>
              <p className="text-xs text-gray-400">Current step</p>
            </div>
          </div>
          <div className="flex-1 mx-2 mt-5">
            <div className="h-1 bg-gray-700"></div>
          </div>
          <div className="flex items-center opacity-50">
            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white font-bold text-sm">
              3
            </div>
            <div className="ml-2">
              <p className="font-medium text-white text-sm">Payment</p>
              <p className="text-xs text-gray-400">Next step</p>
            </div>
          </div>
        </div>

        <form
          className="bg-gray-900 text-white p-4 rounded-lg shadow-lg"
          onSubmit={handleSubmit(onSubmit)}
        >
          <h3 className="text-2xl font-bold mb-4 text-center">
            Request an RGB Channel from LSP
          </h3>
          <h4 className="text-lg font-semibold mb-4 text-center text-gray-300">
            Select asset and amount for the requested channel
          </h4>

          {isLoading ? (
            <div className="text-center">Loading...</div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-800 p-4 rounded-lg">
                <label className="block text-sm font-medium mb-2">
                  Channel Capacity (sats)
                  <span className="ml-2 text-gray-400 hover:text-gray-300 cursor-help relative group">
                    ⓘ
                    <span
                      className="invisible group-hover:visible absolute left-0 
                      bg-gray-900 text-white text-sm rounded py-1 px-2 w-80
                      shadow-lg z-50 top-6 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      The total size of your Lightning channel in satoshis. Min:{' '}
                      {effectiveMinCapacity.toLocaleString()} sats Max:{' '}
                      {effectiveMaxCapacity.toLocaleString()} sats. This
                      determines the maximum amount you can send or receive
                      through this channel. You'll need to pay fees based on
                      this capacity.
                    </span>
                  </span>
                </label>
                <NumberInput
                  className="group transition-all duration-300 hover:translate-x-1"
                  error={formState.errors.capacitySat?.message}
                  label=""
                  max={effectiveMaxCapacity}
                  min={effectiveMinCapacity}
                  onChange={(value) => setValue('capacitySat', value)}
                  onSliderChange={(e) =>
                    setValue('capacitySat', e.target.value)
                  }
                  placeholder="Enter amount"
                  showSlider
                  sliderStep={1000}
                  sliderValue={
                    watch('capacitySat')
                      ? parseInt(
                          parseNumberWithCommas(watch('capacitySat')) || '0',
                          10
                        )
                      : effectiveMinCapacity
                  }
                  value={watch('capacitySat')}
                />
              </div>

              <div className="bg-gray-800 p-4 rounded-lg">
                <label className="block text-sm font-medium mb-2">
                  Your Channel Liquidity (sats)
                  <span className="ml-2 text-gray-400 hover:text-gray-300 cursor-help relative group">
                    ⓘ
                    <span
                      className="invisible group-hover:visible absolute left-0 
                      bg-gray-900 text-white text-sm rounded py-1 px-2 w-80
                      shadow-lg z-50 top-6 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      Also known as outbound liquidity - the amount of satoshis
                      you'll have available to send. The remaining capacity will
                      be on the LSP side for receiving payments. Min:{' '}
                      {lspOptions?.min_initial_client_balance_sat.toLocaleString() ||
                        0}{' '}
                      sats, Max:{' '}
                      {Math.min(
                        lspOptions?.max_initial_client_balance_sat ||
                          Number.MAX_SAFE_INTEGER,
                        effectiveMaxCapacity
                      ).toLocaleString()}{' '}
                      sats (or your chosen channel capacity). You'll need to pay
                      for this liquidity - fees will be shown in the next step.
                    </span>
                  </span>
                </label>
                <NumberInput
                  className="group transition-all duration-300 hover:translate-x-1"
                  error={formState.errors.clientBalanceSat?.message}
                  label=""
                  max={Math.min(
                    parseInt(
                      parseNumberWithCommas(watch('capacitySat')) || '0',
                      10
                    ),
                    lspOptions?.max_initial_client_balance_sat ||
                      Number.MAX_SAFE_INTEGER
                  )}
                  min={lspOptions?.min_initial_client_balance_sat || 0}
                  onChange={(value) => setValue('clientBalanceSat', value)}
                  onSliderChange={(e) =>
                    setValue('clientBalanceSat', e.target.value)
                  }
                  placeholder="Enter amount"
                  showSlider
                  sliderStep={1000}
                  sliderValue={
                    watch('clientBalanceSat')
                      ? parseInt(
                          parseNumberWithCommas(watch('clientBalanceSat')) ||
                            '0',
                          10
                        )
                      : lspOptions?.min_initial_client_balance_sat || 0
                  }
                  value={watch('clientBalanceSat')}
                />
              </div>

              <div className="bg-gray-800 p-4 rounded-lg">
                <label className="block text-sm font-medium mb-2">
                  Channel Lock Duration
                  <span className="ml-2 text-gray-400 hover:text-gray-300 cursor-help relative group">
                    ⓘ
                    <span
                      className="invisible group-hover:visible absolute left-0 
                      bg-gray-900 text-white text-sm rounded py-1 px-2 w-80
                      shadow-lg z-50 top-6 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      The minimum time the LSP guarantees to keep your channel
                      open. Longer durations provide more stability but may
                      affect fees. 1 month = 4,320 blocks, 3 months = 12,960
                      blocks, 6 months = 25,920 blocks. Default: 3 months. Max:{' '}
                      {lspOptions?.max_channel_expiry_blocks.toLocaleString() ||
                        0}{' '}
                      blocks.
                    </span>
                  </span>
                </label>
                <Controller
                  control={control}
                  name="channelExpireBlocks"
                  render={({ field }) => (
                    <Select
                      active={field.value.toString()}
                      onSelect={(value) => field.onChange(parseInt(value))}
                      options={getChannelExpiryOptions()}
                      theme="dark"
                    />
                  )}
                />
              </div>

              <div className="bg-gray-800 p-4 rounded-lg">
                <label className="flex items-center space-x-3 mb-4">
                  <input
                    checked={addAsset}
                    className="form-checkbox h-5 w-5 text-purple-500"
                    onChange={(e) => setAddAsset(e.target.checked)}
                    type="checkbox"
                  />
                  <span className="text-lg font-medium">Add Asset</span>
                  <span className="ml-2 text-gray-400 hover:text-gray-300 cursor-help relative group">
                    ⓘ
                    <span
                      className="invisible group-hover:visible absolute left-0 
                      bg-gray-900 text-white text-sm rounded py-1 px-2 w-96
                      shadow-lg z-50 top-6 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      Adding an RGB asset enables you to receive that asset
                      through this channel. The amount you specify will be held
                      by the LSP, determining how much you can receive.
                    </span>
                  </span>
                </label>

                {addAsset && (
                  <div className="space-y-4">
                    {Object.keys(assetMap).length === 0 ? (
                      <div className="bg-yellow-900/50 border border-yellow-700 rounded-lg p-4">
                        <div className="flex items-start">
                          <div className="flex-shrink-0">
                            <svg
                              className="h-5 w-5 text-yellow-400"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                clipRule="evenodd"
                                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                fillRule="evenodd"
                              />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-yellow-200">
                              No Assets Available
                            </h3>
                            <div className="mt-2 text-sm text-yellow-300">
                              <p>
                                There are currently no assets available to add
                                to your channel. Please try again later or
                                proceed without adding an asset.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Select Asset
                            <span className="ml-2 text-gray-400 hover:text-gray-300 cursor-help relative group">
                              ⓘ
                              <span
                                className="invisible group-hover:visible absolute left-0 
                                bg-gray-900 text-white text-sm rounded py-1 px-2 w-80
                                shadow-lg z-50 top-6 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                              >
                                Choose an RGB asset to add to your channel. The
                                selected amount will be on the LSP side,
                                allowing you to receive the asset. Additional
                                fees will apply based on the asset type and
                                amount.
                              </span>
                            </span>
                          </label>
                          <Controller
                            control={control}
                            name="assetId"
                            render={({ field }) => (
                              <AssetSelectWithModal
                                className="w-full"
                                fieldLabel="Choose an RGB asset for your LSP channel"
                                onChange={field.onChange}
                                options={Object.entries(assetMap).map(
                                  ([assetId, assetInfo]) => ({
                                    assetId: assetId,
                                    label: assetInfo.name,
                                    name: assetInfo.name,
                                    ticker: assetInfo.ticker,
                                    value: assetId,
                                  })
                                )}
                                placeholder="Select an RGB asset"
                                searchPlaceholder="Search by name, ticker or asset ID..."
                                title="Select RGB Asset"
                                value={field.value}
                              />
                            )}
                          />
                        </div>

                        {assetId && (
                          <div className="space-y-4">
                            {/* Enhanced Asset Amount Input */}
                            <div className="space-y-3">
                              <label className="text-sm font-medium text-slate-300">
                                Asset Amount
                              </label>

                              {assetMap[assetId] && (
                                <div className="space-y-4">
                                  {/* Enhanced Asset Preview Card */}
                                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                                    {/* Asset Header with Icon */}
                                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-700/50">
                                      <img
                                        alt={assetMap[assetId].ticker}
                                        className="w-10 h-10 rounded-full border-2 border-slate-600/50"
                                        onError={() =>
                                          setAssetIconSrc(defaultIcon)
                                        }
                                        src={assetIconSrc}
                                      />
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="text-lg font-semibold text-white">
                                            {assetMap[assetId].ticker}
                                          </span>
                                          <span className="text-sm text-slate-400">
                                            ({assetMap[assetId].name})
                                          </span>
                                        </div>
                                        <div className="text-xs text-slate-500">
                                          {assetMap[assetId].precision} decimal
                                          places
                                        </div>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {/* Maximum Amount */}
                                      <div className="space-y-1">
                                        <div className="text-xs text-slate-400">
                                          Maximum Amount
                                        </div>
                                        <div className="text-sm font-medium text-green-400">
                                          {(() => {
                                            const maxAmount =
                                              assetMap[assetId]
                                                .max_channel_amount /
                                              Math.pow(
                                                10,
                                                assetMap[assetId].precision
                                              )
                                            return formatNumberWithCommas(
                                              maxAmount.toString()
                                            )
                                          })()}{' '}
                                          {assetMap[assetId].ticker}
                                        </div>
                                      </div>

                                      {/* Asset ID */}
                                      <div className="space-y-1">
                                        <div className="text-xs text-slate-400">
                                          Asset ID
                                        </div>
                                        <div
                                          className="text-xs font-mono text-slate-300 break-all bg-slate-900/50 p-2 rounded border border-slate-700/30"
                                          title={assetMap[assetId].asset_id}
                                        >
                                          {assetMap[assetId].asset_id}
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Improved Amount Input */}
                                  <div className="space-y-2">
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
                                        // Validate max amount when user finishes typing
                                        const value = e.target.value
                                        if (value && assetMap[assetId]) {
                                          const assetInfo = assetMap[assetId]
                                          const maxAssetAmount =
                                            assetInfo.max_channel_amount /
                                            Math.pow(10, assetInfo.precision)
                                          const numValue = parseFloat(value)
                                          if (
                                            !isNaN(numValue) &&
                                            numValue > maxAssetAmount
                                          ) {
                                            setValue(
                                              'assetAmount',
                                              maxAssetAmount.toString()
                                            )
                                            toast.warn(
                                              `Amount exceeds maximum limit of ${formatNumberWithCommas(maxAssetAmount.toString())} ${assetInfo.ticker}. Value has been adjusted.`,
                                              {
                                                autoClose: 4000,
                                                position: 'bottom-right',
                                              }
                                            )
                                          }
                                        }
                                      }}
                                      onChange={(e) => {
                                        const value = e.target.value
                                        // Allow empty input
                                        if (value === '') {
                                          setValue('assetAmount', '')
                                          return
                                        }

                                        // Prevent alpha characters - only allow numbers, decimal point
                                        if (!/^[\d.]*$/.test(value)) {
                                          return // Reject input with letters or special chars
                                        }

                                        // Basic decimal validation
                                        const decimalRegex =
                                          assetMap[assetId].precision > 0
                                            ? new RegExp(
                                                `^\\d*\\.?\\d{0,${assetMap[assetId].precision}}$`
                                              )
                                            : /^\d*$/

                                        if (decimalRegex.test(value)) {
                                          // Check against maximum amount before setting value
                                          const assetInfo = assetMap[assetId]
                                          const maxAssetAmount =
                                            assetInfo.max_channel_amount /
                                            Math.pow(10, assetInfo.precision)
                                          const numValue = parseFloat(value)

                                          // Prevent typing amounts that exceed maximum
                                          if (
                                            !isNaN(numValue) &&
                                            numValue > maxAssetAmount
                                          ) {
                                            // Don't update the input if it would exceed max
                                            toast.warn(
                                              `Maximum amount is ${formatNumberWithCommas(maxAssetAmount.toString())} ${assetInfo.ticker}`,
                                              {
                                                autoClose: 2000,
                                                position: 'bottom-right',
                                              }
                                            )
                                            return
                                          }

                                          setValue('assetAmount', value)
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

                                        // Allow Ctrl/Cmd combinations
                                        if (e.ctrlKey || e.metaKey) {
                                          return
                                        }

                                        // Allow decimal point only if precision > 0 and not already present
                                        if (
                                          e.key === '.' &&
                                          assetMap[assetId].precision > 0 &&
                                          !watch('assetAmount').includes('.')
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
                                      placeholder={`0.${'0'.repeat(assetMap[assetId].precision)}`}
                                      type="text"
                                      value={watch('assetAmount')}
                                    />

                                    {/* Quick amount buttons */}
                                    <div className="flex gap-2">
                                      <button
                                        className={twJoin(
                                          'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200',
                                          'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 hover:text-white',
                                          'border border-slate-600/30 hover:border-slate-500/50'
                                        )}
                                        onClick={() =>
                                          setValue('assetAmount', '')
                                        }
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
                                          const assetInfo = assetMap[assetId]
                                          const maxAssetAmount =
                                            assetInfo.max_channel_amount /
                                            Math.pow(10, assetInfo.precision)
                                          const amount = (
                                            maxAssetAmount * 0.25
                                          ).toFixed(assetInfo.precision)
                                          setValue('assetAmount', amount)
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
                                          const assetInfo = assetMap[assetId]
                                          const maxAssetAmount =
                                            assetInfo.max_channel_amount /
                                            Math.pow(10, assetInfo.precision)
                                          const amount = (
                                            maxAssetAmount * 0.5
                                          ).toFixed(assetInfo.precision)
                                          setValue('assetAmount', amount)
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
                                          const assetInfo = assetMap[assetId]
                                          const maxAssetAmount =
                                            assetInfo.max_channel_amount /
                                            Math.pow(10, assetInfo.precision)
                                          const amount = maxAssetAmount.toFixed(
                                            assetInfo.precision
                                          )
                                          setValue('assetAmount', amount)
                                        }}
                                        type="button"
                                      >
                                        Max (
                                        {(() => {
                                          const assetInfo = assetMap[assetId]
                                          const maxAssetAmount =
                                            assetInfo.max_channel_amount /
                                            Math.pow(10, assetInfo.precision)
                                          return formatNumberWithCommas(
                                            maxAssetAmount.toString()
                                          )
                                        })()}
                                        )
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Fee Estimate Section */}
          {fees && (
            <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-700/50 rounded-lg p-6 mt-6">
              <div className="flex items-start mb-4">
                <div className="flex-shrink-0">
                  <svg
                    className="h-6 w-6 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-lg font-semibold text-blue-200 mb-4">
                    Estimated Fees
                    {isLoadingFees && (
                      <span className="ml-2 text-sm text-gray-400">
                        (calculating...)
                      </span>
                    )}
                  </h3>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-blue-700/30">
                      <span className="text-gray-300">Setup Fee</span>
                      <span className="font-medium text-white">
                        {formatNumberWithCommas(fees.setup_fee.toString())} sats
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-blue-700/30">
                      <span className="text-gray-300">Capacity Fee</span>
                      <span className="font-medium text-white">
                        {formatNumberWithCommas(fees.capacity_fee.toString())}{' '}
                        sats
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-blue-700/30">
                      <span className="text-gray-300">Duration Fee</span>
                      <span className="font-medium text-white">
                        {formatNumberWithCommas(fees.duration_fee.toString())}{' '}
                        sats
                      </span>
                    </div>
                    {fees.applied_discount && fees.discount_code && (
                      <div className="flex justify-between items-center py-2 border-b border-green-700/30 bg-green-900/20 -mx-3 px-3">
                        <span className="text-green-300 font-medium">
                          Discount ({fees.discount_code})
                        </span>
                        <span className="font-medium text-green-400">
                          -{Math.round(fees.applied_discount * 100)}%
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center py-3 bg-blue-800/30 -mx-3 px-3 rounded-lg mt-3">
                      <span className="text-blue-100 font-semibold text-lg">
                        Total Fee
                      </span>
                      <span className="font-bold text-blue-200 text-lg">
                        {formatNumberWithCommas(fees.total_fee.toString())} sats
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 text-xs text-gray-400">
                    <p>
                      This fee covers the cost of setting up and maintaining
                      your channel. The total amount you'll need to pay includes
                      this fee plus your desired channel liquidity.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between space-x-4 mt-6">
            <button
              className="px-6 py-3 rounded-lg text-lg font-bold bg-gray-600 hover:bg-gray-700 transition-colors"
              onClick={onBack}
              type="button"
            >
              Back
            </button>
            <button
              className={`px-6 py-3 rounded-lg text-lg font-bold ${
                isLoading
                  ? 'bg-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 transition-colors'
              }`}
              disabled={isLoading}
              type="submit"
            >
              Next Step
            </button>
          </div>

          {!formState.isSubmitSuccessful && formState.isSubmitted && (
            <FormError />
          )}
        </form>
      </div>
    </div>
  )
}
