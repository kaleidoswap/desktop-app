import { zodResolver } from '@hookform/resolvers/zod'
import React, { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'react-toastify'
import { twJoin } from 'tailwind-merge'
import * as z from 'zod'

import { useAppDispatch } from '../../app/store/hooks'
import {
  BitcoinChannelSection,
  AssetChannelSection,
  FeeBreakdownDisplay,
  ChannelDurationSelector,
} from '../../components/ChannelConfiguration'
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
import { AssetInfo, LspOptions } from '../../utils/channelOrderUtils'

import { FormError } from './FormError'
import 'react-toastify/dist/ReactToastify.css'

interface Props {
  onNext: (data: TChannelRequestForm) => void
  onBack: () => void
}

const FormFieldsSchema = z.object({
  assetId: z.string().optional().default(''),
  capacitySat: z.string(),
  channelExpireBlocks: z.number(),
  clientBalanceSat: z.string(),
  lspAssetAmount: z.string().optional().default(''),
})

type FormFields = z.infer<typeof FormFieldsSchema>

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
        assetId: '',
        capacitySat: '100000', // Default to 100,000 sats
        channelExpireBlocks: 12960, // Default to 3 months (12960 blocks)
        clientBalanceSat: '20000', // Default to 20,000 sats inbound liquidity
        lspAssetAmount: '',
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
      } catch (error: any) {
        // Check if it's a timeout error
        let errorMessage = 'Error fetching data. Please try again later.'
        if (
          error?.status === 'TIMEOUT_ERROR' ||
          (error?.error &&
            typeof error.error === 'string' &&
            error.error.includes('timeout'))
        ) {
          errorMessage =
            'Request timed out. The LSP server is not responding. Please check your connection and try again.'
        } else if (error?.status === 'FETCH_ERROR') {
          errorMessage =
            'Network error. Please check your connection to the LSP server.'
        }

        toast.error(errorMessage, {
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

      // Validate that selected asset is supported by LSP
      if (addAsset && data.assetId && !assetMap[data.assetId]) {
        toast.error(
          'The selected asset is not supported by this LSP. Please refresh and select a supported asset.',
          {
            autoClose: 5000,
            position: 'bottom-right',
          }
        )
        return
      }

      if (
        addAsset &&
        data.assetId &&
        (data.lspAssetAmount === '' || data.lspAssetAmount === '0')
      ) {
        toast.error('Please enter an asset amount before proceeding.', {
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

      // Validate and parse LSP asset amount
      let parsedLspAssetAmount = 0
      if (addAsset && data.assetId) {
        const assetInfo = assetMap[data.assetId]
        if (assetInfo) {
          const minAssetAmount =
            assetInfo.min_channel_amount / Math.pow(10, assetInfo.precision)
          const maxAssetAmount =
            assetInfo.max_channel_amount / Math.pow(10, assetInfo.precision)
          const parsedAmount = parseFloat(data.lspAssetAmount || '0')

          // Validate minimum amount
          if (
            (parsedAmount !== 0 && isNaN(parsedAmount)) ||
            (parsedAmount > 0 && parsedAmount < minAssetAmount)
          ) {
            const adjustedAmount = minAssetAmount.toString()
            setValue('lspAssetAmount', adjustedAmount)
            toast.info(
              `Asset amount adjusted to minimum: ${formatNumberWithCommas(adjustedAmount)} ${assetInfo.ticker}`,
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

        // Parse asset amount (all goes to LSP for receiving)
        parsedLspAssetAmount = parseAssetAmount(
          data.lspAssetAmount || '0',
          data.assetId
        )
      }

      const submissionData: TChannelRequestForm = {
        assetId: data.assetId || '',
        capacitySat: parsedCapacitySat,
        channelExpireBlocks: data.channelExpireBlocks,
        clientBalanceSat: parsedClientBalanceSat,
        lspAssetAmount: parsedLspAssetAmount,
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
              path === 'lspAssetAmount' &&
              addAsset &&
              data.assetId &&
              assetMap[data.assetId]
            ) {
              const assetInfo = assetMap[data.assetId]
              const minAssetAmount =
                assetInfo.min_channel_amount / Math.pow(10, assetInfo.precision)
              adjustedData.lspAssetAmount =
                minAssetAmount * Math.pow(10, assetInfo.precision)
              setValue('lspAssetAmount', minAssetAmount.toString())
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

  // Fetch fee estimates when channel parameters change
  useEffect(() => {
    const fetchFees = async () => {
      const capacitySat = watch('capacitySat')
      const clientBalanceSat = watch('clientBalanceSat')
      const channelExpireBlocks = watch('channelExpireBlocks')
      const assetId = watch('assetId')
      const lspAssetAmount = watch('lspAssetAmount')

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
        if (addAsset && assetId && lspAssetAmount && assetMap[assetId]) {
          const parsedAssetAmount = parseAssetAmount(lspAssetAmount, assetId)
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
    watch('lspAssetAmount'),
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
          <p className="text-gray-400 mt-2">
            Set up your channel parameters and capacity
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
          {isLoading ? (
            <div className="text-center">Loading...</div>
          ) : (
            <div className="space-y-4">
              {/* Bitcoin Channel Configuration */}
              <BitcoinChannelSection
                capacityPresets={[50000, 100000, 500000, 1000000]}
                clientBalance={
                  watch('clientBalanceSat')
                    ? parseInt(
                        parseNumberWithCommas(watch('clientBalanceSat')) || '0',
                        10
                      )
                    : 0
                }
                containerClassName="bg-gray-800 p-4 rounded-lg"
                maxCapacity={effectiveMaxCapacity}
                maxClientBalance={Math.min(
                  parseInt(
                    parseNumberWithCommas(watch('capacitySat')) || '0',
                    10
                  ),
                  lspOptions?.max_initial_client_balance_sat ||
                    Number.MAX_SAFE_INTEGER
                )}
                minCapacity={effectiveMinCapacity}
                minClientBalance={
                  lspOptions?.min_initial_client_balance_sat || 0
                }
                onCapacityChange={(capacity) => {
                  setValue('capacitySat', capacity.toString())
                  // Adjust client balance if it exceeds new capacity
                  const currentClientBalance = parseInt(
                    parseNumberWithCommas(watch('clientBalanceSat')) || '0',
                    10
                  )
                  if (currentClientBalance > capacity) {
                    setValue(
                      'clientBalanceSat',
                      Math.floor(capacity / 2).toString()
                    )
                  }
                }}
                onClientBalanceChange={(value) =>
                  setValue('clientBalanceSat', value.toString())
                }
                totalCapacity={
                  watch('capacitySat')
                    ? parseInt(
                        parseNumberWithCommas(watch('capacitySat')) || '0',
                        10
                      )
                    : 0
                }
              />

              <ChannelDurationSelector
                containerClassName="bg-gray-800 p-4 rounded-lg"
                control={control}
                maxExpiryBlocks={lspOptions?.max_channel_expiry_blocks}
                onChange={(value) => setValue('channelExpireBlocks', value)}
                theme="dark"
                value={watch('channelExpireBlocks')}
              />

              {/* Asset Configuration Section - Separate from Bitcoin */}
              <div className="bg-gray-800 p-4 rounded-lg">
                <label className="flex items-center space-x-3 mb-4">
                  <input
                    checked={addAsset}
                    className="form-checkbox h-5 w-5 text-purple-500"
                    onChange={(e) => {
                      const checked = e.target.checked
                      setAddAsset(checked)
                      // Clear asset values when unchecking
                      if (!checked) {
                        setValue('assetId', '')
                        setValue('lspAssetAmount', '')
                      }
                    }}
                    type="checkbox"
                  />
                  <span className="text-lg font-medium">
                    Add Asset to Channel
                  </span>
                </label>

                {addAsset && (
                  <AssetChannelSection
                    assetMap={assetMap}
                    containerClassName=""
                    control={control}
                    onAssetChange={(value) => setValue('assetId', value)}
                    onTotalAssetAmountChange={(value) =>
                      setValue('lspAssetAmount', value.toString())
                    }
                    selectLabel="Select Asset"
                    selectedAssetId={assetId}
                    totalAssetAmount={
                      watch('lspAssetAmount')
                        ? parseFloat(watch('lspAssetAmount'))
                        : 0
                    }
                  />
                )}
              </div>
            </div>
          )}

          {/* Fee Estimate Section */}
          {fees && (
            <FeeBreakdownDisplay
              containerClassName="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-700/50 rounded-lg p-6 mt-6"
              fees={fees}
              isLoading={isLoadingFees}
            />
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
