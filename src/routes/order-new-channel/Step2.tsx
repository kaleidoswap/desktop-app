import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, ChevronDown } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import * as z from 'zod'

import { useAppDispatch } from '../../app/store/hooks'
import { Button } from '../../components/ui'
import { Spinner } from '../../components/Spinner'
import {
  FeeBreakdownDisplay,
  ChannelDurationSelector,
} from '../../components/ChannelConfiguration'
import { FormError } from '../../components/FormError'
import { AssetQuoteDisplay } from '../../components/Liquidity'
import { MIN_CHANNEL_CAPACITY, MAX_CHANNEL_CAPACITY } from '../../constants'
import {
  getQuoteFromAmount,
  getQuoteToAmount,
  useAssetChannelQuote,
} from '../../hooks/useAssetChannelQuote'
import { formatNumberWithCommas } from '../../helpers/number'
import {
  orderChannelSliceActions,
  OrderChannelFormSchema,
  TChannelRequestForm,
} from '../../slices/channel/orderChannel.slice'
import { makerApi, ChannelFees } from '../../slices/makerApi/makerApi.slice'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'
import { AssetInfo, LspOptions } from '../../utils/channelOrderUtils'

import rgbIcon from '../../assets/rgb-logo.svg'
import { useAssetIcon } from '../../helpers/utils'

import 'react-toastify/dist/ReactToastify.css'

interface Props {
  onNext: (data: TChannelRequestForm, asset?: AssetInfo | null) => void
  onBack: () => void
  preselectedAssetId?: string
}

const FormFieldsSchema = z.object({
  assetId: z.string().optional().default(''),
  capacitySat: z.string(),
  channelExpireBlocks: z.number(),
  clientAssetAmount: z.string().optional().default('0'),
  clientBalanceSat: z.string(),
  lspAssetAmount: z.string().optional().default(''),
})

type FormFields = z.infer<typeof FormFieldsSchema>

const AssetListIcon = ({ ticker }: { ticker: string }) => {
  const [icon] = useAssetIcon(ticker, rgbIcon)
  return <img alt={ticker} className="w-3.5 h-3.5" src={icon} />
}

export const Step2: React.FC<Props> = ({
  onNext,
  onBack,
  preselectedAssetId,
}) => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const [assetMap, setAssetMap] = useState<Record<string, AssetInfo>>({})
  const [addAsset, setAddAsset] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [lspOptions, setLspOptions] = useState<LspOptions | null>(null)
  const [selectedAsset, setSelectedAsset] = useState<AssetInfo | null>(null)
  const [isAssetDropdownOpen, setIsAssetDropdownOpen] = useState(false)
  const [selectedAssetIcon] = useAssetIcon(selectedAsset?.ticker ?? '', rgbIcon)
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
        capacitySat: '100000',
        channelExpireBlocks: 12960,
        clientAssetAmount: '0',
        clientBalanceSat: '20000',
        lspAssetAmount: '',
      },
      resolver: zodResolver(FormFieldsSchema),
    })

  const [getInfoRequest] = makerApi.endpoints.get_info.useLazyQuery()
  const [estimateFeesRequest] = makerApi.endpoints.estimate_fees.useLazyQuery()
  const [nodeInfoRequest] = nodeApi.endpoints.nodeInfo.useLazyQuery()
  const [addressRequest] = nodeApi.endpoints.address.useLazyQuery()

  const capacitySat = watch('capacitySat')
  const clientBalanceSat = watch('clientBalanceSat')
  const assetId = watch('assetId')
  const lspAssetAmount = watch('lspAssetAmount')
  const channelExpireBlocks = watch('channelExpireBlocks')
  const clientAssetAmount = watch('clientAssetAmount')

  const { quote, quoteError, quoteLoading } = useAssetChannelQuote({
    assetId,
    assetMap,
    clientAssetAmount,
    enabled: addAsset && !isLoading,
  })

  // Derived values
  const currentCapacity =
    parseInt(capacitySat.replace(/[^0-9]/g, ''), 10) || 100000
  const btcOut = parseInt(clientBalanceSat.replace(/[^0-9]/g, ''), 10) || 0
  const assetInfo = assetId ? assetMap[assetId] : null

  const assetFactor = assetInfo ? Math.pow(10, assetInfo.precision) : 1
  const assetMax = assetInfo ? assetInfo.max_channel_amount / assetFactor : 0
  const assetMin = assetInfo ? assetInfo.min_channel_amount / assetFactor : 0

  const assetPresetsCalc = assetInfo
    ? assetInfo.ticker.toUpperCase() === 'USDT'
      ? [100, 250, 500, 1000].filter((p) => p >= assetMin && p <= assetMax)
      : assetInfo.ticker.toUpperCase() === 'XAUT'
        ? [0.01, 0.1, 1].filter((p) => p >= assetMin && p <= assetMax)
        : []
    : []

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const infoResponse = await getInfoRequest()
        if (infoResponse.data) {
          const sanitizedOptions: LspOptions = {
            ...(infoResponse.data.options as any),
            min_onchain_payment_confirmations:
              infoResponse.data.options.min_onchain_payment_confirmations ??
              undefined,
            min_onchain_payment_size_sat:
              infoResponse.data.options.min_onchain_payment_size_sat || 0,
          }
          setLspOptions(sanitizedOptions)

          const lspMinCapacity =
            infoResponse.data.options.min_channel_balance_sat || 0
          const lspMaxCapacity =
            infoResponse.data.options.max_channel_balance_sat ||
            Number.MAX_SAFE_INTEGER

          setEffectiveMinCapacity(
            Math.max(MIN_CHANNEL_CAPACITY, lspMinCapacity)
          )
          setEffectiveMaxCapacity(
            Math.min(MAX_CHANNEL_CAPACITY, lspMaxCapacity)
          )

          if (
            infoResponse.data.assets &&
            Array.isArray(infoResponse.data.assets)
          ) {
            const tmpMap: Record<string, AssetInfo> = {}
            infoResponse.data.assets.forEach((asset: any) => {
              if (asset.asset_id) tmpMap[asset.asset_id] = asset as AssetInfo
            })
            setAssetMap(tmpMap)
          }
        }
      } catch (error: any) {
        let errorMessage = t('orderChannel.step2.fees.fetchFailed')
        if (
          error?.status === 'TIMEOUT_ERROR' ||
          (error?.error &&
            typeof error.error === 'string' &&
            error.error.includes('timeout'))
        ) {
          errorMessage = t('orderChannel.step1.timeout')
        } else if (error?.status === 'FETCH_ERROR') {
          errorMessage = t('orderChannel.step1.networkError')
        }
        toast.error(errorMessage, { autoClose: 5000, position: 'bottom-right' })
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [getInfoRequest])

  // Preselect and lock the asset when arriving from Market Maker
  useEffect(() => {
    if (!preselectedAssetId) return
    const asset = assetMap[preselectedAssetId]
    if (!asset) return
    setSelectedAsset(asset)
    setAddAsset(true)
    setValue('assetId', asset.asset_id)
  }, [preselectedAssetId, assetMap, setValue])

  const isAssetLocked = !!preselectedAssetId && !!assetMap[preselectedAssetId]

  const formatNumber = (n: number) => n.toLocaleString('en-US')

  const maxOutbound = Math.min(
    currentCapacity,
    lspOptions?.max_initial_client_balance_sat ?? currentCapacity
  )
  const minOutbound = lspOptions?.min_initial_client_balance_sat ?? 0

  const handleCapacityChange = (value: string) => {
    const sanitized = value.replace(/[^0-9]/g, '')
    if (sanitized === '') {
      setValue('capacitySat', '')
      return
    }
    const num = parseInt(sanitized, 10)
    if (isNaN(num)) return
    const clamped = Math.min(effectiveMaxCapacity, Math.max(0, num))
    setValue('capacitySat', clamped.toString())
    if (btcOut > clamped)
      setValue('clientBalanceSat', Math.floor(clamped / 2).toString())
  }

  const handleOutboundChange = (value: string) => {
    const sanitized = value.replace(/[^0-9]/g, '')
    if (sanitized === '') {
      setValue('clientBalanceSat', '0')
      return
    }
    const num = parseInt(sanitized, 10)
    if (isNaN(num)) return
    setValue(
      'clientBalanceSat',
      Math.min(maxOutbound, Math.max(minOutbound, num)).toString()
    )
  }

  const parseAssetAmount = useCallback(
    (amount: string, id: string): number => {
      const info = assetMap[id]
      const precision = info ? info.precision : 8
      const multiplier = Math.pow(10, precision)
      if (amount === '') return 0
      const cleanAmount = amount.replace(/[^\d.-]/g, '')
      return Math.round(parseFloat(cleanAmount) * multiplier)
    },
    [assetMap]
  )

  const onSubmit = useCallback(
    (data: FormFields) => {
      if (!data.capacitySat) {
        toast.error(t('orderChannel.step2.capacityRequired'), {
          autoClose: 5000,
          position: 'bottom-right',
        })
        return
      }
      if (!data.clientBalanceSat) {
        toast.error(t('orderChannel.step2.liquidityRequired'), {
          autoClose: 5000,
          position: 'bottom-right',
        })
        return
      }
      if (addAsset && !data.assetId) {
        toast.error(t('orderChannel.step2.assetRequired'), {
          autoClose: 5000,
          position: 'bottom-right',
        })
        return
      }
      if (addAsset && data.assetId && !assetMap[data.assetId]) {
        toast.error(t('orderChannel.step2.assetUnsupported'), {
          autoClose: 5000,
          position: 'bottom-right',
        })
        return
      }
      if (
        addAsset &&
        data.assetId &&
        parseFloat(data.lspAssetAmount || '0') <= 0 &&
        parseFloat(data.clientAssetAmount || '0') <= 0
      ) {
        toast.error(t('orderChannel.step2.assetAmountRequired'), {
          autoClose: 5000,
          position: 'bottom-right',
        })
        return
      }

      let finalCapacitySat = data.capacitySat
      let finalClientBalanceSat = data.clientBalanceSat

      const parsedCapacitySat = parseInt(
        finalCapacitySat.replace(/[^0-9]/g, ''),
        10
      )
      if (
        isNaN(parsedCapacitySat) ||
        parsedCapacitySat < effectiveMinCapacity
      ) {
        finalCapacitySat = effectiveMinCapacity.toString()
        setValue('capacitySat', finalCapacitySat)
        toast.info(
          t('orderChannel.step2.capacityAdjusted', {
            amount: formatNumberWithCommas(finalCapacitySat),
          }),
          { autoClose: 3000, position: 'bottom-right' }
        )
      }

      const parsedClientBalanceSat = parseInt(
        finalClientBalanceSat.replace(/[^0-9]/g, ''),
        10
      )
      const minClientBalance = lspOptions?.min_initial_client_balance_sat || 0
      if (
        isNaN(parsedClientBalanceSat) ||
        parsedClientBalanceSat < minClientBalance
      ) {
        finalClientBalanceSat = minClientBalance.toString()
        setValue('clientBalanceSat', finalClientBalanceSat)
        toast.info(
          t('orderChannel.step2.liquidityAdjusted', {
            amount: formatNumberWithCommas(finalClientBalanceSat),
          }),
          { autoClose: 3000, position: 'bottom-right' }
        )
      }

      let parsedLspAssetAmount = 0
      let parsedClientAssetAmount = 0
      let rfqId = ''
      if (addAsset && data.assetId) {
        const info = assetMap[data.assetId]
        if (info) {
          const minAssetAmount =
            info.min_channel_amount / Math.pow(10, info.precision)
          const maxAssetAmount =
            info.max_channel_amount / Math.pow(10, info.precision)
          const parsedAmount = parseFloat(data.lspAssetAmount || '0')

          if (
            (parsedAmount !== 0 && isNaN(parsedAmount)) ||
            (parsedAmount > 0 && parsedAmount < minAssetAmount)
          ) {
            setValue('lspAssetAmount', minAssetAmount.toString())
            toast.info(
              t('orderChannel.step2.assetAdjusted', {
                amount: formatNumberWithCommas(minAssetAmount.toString()),
                ticker: info.ticker,
              }),
              { autoClose: 3000, position: 'bottom-right' }
            )
          }
          if (parsedAmount > maxAssetAmount) {
            toast.error(
              t('orderChannel.step2.assetExceedsMax', {
                amount: formatNumberWithCommas(maxAssetAmount.toString()),
                ticker: info.ticker,
              }),
              { autoClose: 5000, position: 'bottom-right' }
            )
            return
          }
        }
        parsedClientAssetAmount =
          parseFloat(data.clientAssetAmount || '0') > 0 && quote
            ? getQuoteToAmount(quote)
            : parseAssetAmount(data.clientAssetAmount || '0', data.assetId)

        const parsedTotalAssetAmount = Math.max(
          parseAssetAmount(data.lspAssetAmount || '0', data.assetId),
          parsedClientAssetAmount
        )

        if (parsedClientAssetAmount > 0 && !quote) {
          toast.error('Please wait for the asset quote before continuing', {
            autoClose: 5000,
            position: 'bottom-right',
          })
          return
        }

        parsedLspAssetAmount = Math.max(
          0,
          parsedTotalAssetAmount - parsedClientAssetAmount
        )
        rfqId = quote?.rfq_id || ''
      }

      const submissionData: TChannelRequestForm = {
        assetId: data.assetId || '',
        capacitySat: parseInt(finalCapacitySat.replace(/[^0-9]/g, ''), 10),
        channelExpireBlocks: data.channelExpireBlocks,
        clientAssetAmount: parsedClientAssetAmount || undefined,
        clientBalanceSat: parseInt(
          finalClientBalanceSat.replace(/[^0-9]/g, ''),
          10
        ),
        lspAssetAmount: parsedLspAssetAmount,
        rfqId: rfqId || undefined,
      }

      try {
        OrderChannelFormSchema.parse(submissionData)
        dispatch(orderChannelSliceActions.setChannelRequestForm(submissionData))
        onNext(submissionData, selectedAsset)
      } catch (error) {
        if (error instanceof z.ZodError) {
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
              const info = assetMap[data.assetId]
              const minAssetAmount =
                info.min_channel_amount / Math.pow(10, info.precision)
              adjustedData.lspAssetAmount =
                minAssetAmount * Math.pow(10, info.precision)
              setValue('lspAssetAmount', minAssetAmount.toString())
              madeAdjustments = true
            }
          })

          if (madeAdjustments) {
            toast.info(t('orderChannel.step2.adjustmentsMade'), {
              autoClose: 3000,
              position: 'bottom-right',
            })
            dispatch(
              orderChannelSliceActions.setChannelRequestForm(adjustedData)
            )
            onNext(adjustedData, selectedAsset)
            return
          }
          toast.error(t('orderChannel.step2.formError'))
        } else {
          toast.error(t('orderChannel.step2.unexpectedError'))
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
      quote,
      t,
    ]
  )

  // Fetch fee estimates when channel parameters change
  useEffect(() => {
    const fetchFees = async () => {
      if (!capacitySat || !clientBalanceSat || isLoading) return

      const parsedCapacity = parseInt(capacitySat.replace(/[^0-9]/g, ''), 10)
      const parsedClientBalance = parseInt(
        clientBalanceSat.replace(/[^0-9]/g, ''),
        10
      )
      if (isNaN(parsedCapacity) || isNaN(parsedClientBalance)) return

      const lspBalance = parsedCapacity - parsedClientBalance

      try {
        setIsLoadingFees(true)
        const [nodeInfoResponse, addressResponse] = await Promise.all([
          nodeInfoRequest(),
          addressRequest(),
        ])
        const clientPubKey = nodeInfoResponse.data?.pubkey
        const refundAddress = addressResponse.data?.address
        if (!clientPubKey || !refundAddress) {
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
          refund_onchain_address: refundAddress,
          required_channel_confirmations: 1,
        }

        if (
          addAsset &&
          assetId &&
          assetMap[assetId] &&
          (parseFloat(lspAssetAmount || '0') > 0 ||
            parseFloat(clientAssetAmount || '0') > 0)
        ) {
          request.asset_id = assetId
          const parsedClient =
            parseFloat(clientAssetAmount || '0') > 0 && quote
              ? getQuoteToAmount(quote)
              : parseAssetAmount(clientAssetAmount || '0', assetId)
          const parsedTotal = Math.max(
            parseAssetAmount(lspAssetAmount || '0', assetId),
            parsedClient
          )

          if (parsedClient > 0 && !quote) {
            return
          }

          request.lsp_asset_amount = Math.max(0, parsedTotal - parsedClient)
          if (parsedClient > 0) {
            request.client_asset_amount = parsedClient
            request.rfq_id = quote?.rfq_id
          }
        }

        const response = await estimateFeesRequest(request)
        if (response.data) setFees(response.data)
      } catch (error) {
        console.error('Error fetching fees:', error)
      } finally {
        setIsLoadingFees(false)
      }
    }

    const timeoutId = setTimeout(fetchFees, 500)
    return () => clearTimeout(timeoutId)
  }, [
    capacitySat,
    clientBalanceSat,
    channelExpireBlocks,
    assetId,
    lspAssetAmount,
    clientAssetAmount,
    addAsset,
    isLoading,
    quote,
    estimateFeesRequest,
    nodeInfoRequest,
    addressRequest,
    parseAssetAmount,
    assetMap,
  ])

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mt-4 mb-8">
        <h3 className="text-3xl font-bold text-white">
          {t('orderChannel.step2.title')}
        </h3>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Spinner color="#15E99A" overlay={false} size={48} />
          </div>
        ) : (
          <div className="bg-surface-overlay/50 backdrop-blur-sm rounded-xl border border-border-default/50 p-8">
            {/* Channel Capacity */}
            <div className="mb-12">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-content-secondary">
                  {t('orderChannel.step2.channelCapacity')}
                </label>
              </div>
              <div className="relative">
                <input
                  className="w-full pl-4 pr-20 py-2 bg-surface-base/50 rounded-lg border border-border-default/30 text-white text-2xl font-semibold focus:border-primary/60 focus:ring-2 focus:ring-primary/15 placeholder:text-content-tertiary/50 h-14 hover:border-border-default/50 focus:outline-none"
                  onChange={(e) => handleCapacityChange(e.target.value)}
                  placeholder="0"
                  type="text"
                  value={
                    currentCapacity > 0 ? formatNumber(currentCapacity) : ''
                  }
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary/50 text-sm font-semibold pointer-events-none select-none tracking-wide">
                  SATS
                </span>
              </div>
              {currentCapacity > 0 && (
                <div className="mt-4 px-1">
                  <div className="relative">
                    <div className="relative h-2 rounded-full bg-secondary/20 overflow-hidden">
                      <div
                        className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-200"
                        style={{
                          width: `${Math.max(0, Math.min(100, ((currentCapacity - effectiveMinCapacity) / Math.max(1, effectiveMaxCapacity - effectiveMinCapacity)) * 100))}%`,
                        }}
                      />
                    </div>
                    <input
                      className="absolute inset-0 w-full opacity-0 cursor-pointer h-2"
                      max={effectiveMaxCapacity}
                      min={effectiveMinCapacity}
                      onChange={(e) => handleCapacityChange(e.target.value)}
                      step={1000}
                      type="range"
                      value={currentCapacity}
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-primary shadow-lg shadow-primary/30 pointer-events-none transition-all duration-200"
                      style={{
                        left: `calc(${Math.max(0, Math.min(100, ((currentCapacity - effectiveMinCapacity) / Math.max(1, effectiveMaxCapacity - effectiveMinCapacity)) * 100))}% - 8px)`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-content-tertiary mt-3">
                    <span>Min: {formatNumber(effectiveMinCapacity)} sats</span>
                    <span>Max: {formatNumber(effectiveMaxCapacity)} sats</span>
                  </div>
                </div>
              )}
            </div>

            {/* Outbound Balance */}
            <div className="mb-12">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-content-secondary">
                  Outbound Balance
                </label>
                {maxOutbound > 0 && (
                  <div className="flex items-center gap-1">
                    {[25, 50, 75, 100].map((pct) => (
                      <button
                        className="px-2 py-0.5 rounded text-xs font-semibold border bg-surface-high/40 border-border-default/40 text-content-secondary hover:text-white hover:border-border-default/70 transition-colors"
                        key={pct}
                        onClick={() => {
                          const amount = Math.floor(maxOutbound * (pct / 100))
                          setValue(
                            'clientBalanceSat',
                            Math.min(
                              Math.max(amount, minOutbound),
                              maxOutbound
                            ).toString()
                          )
                        }}
                        type="button"
                      >
                        {pct === 100 ? 'MAX' : `${pct}%`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <input
                  className="w-full pl-4 pr-20 py-2 bg-surface-base/50 rounded-lg border border-border-default/30 text-white text-2xl font-semibold focus:border-primary/60 focus:ring-2 focus:ring-primary/15 placeholder:text-content-tertiary/50 h-14 hover:border-border-default/50 focus:outline-none"
                  onChange={(e) => handleOutboundChange(e.target.value)}
                  placeholder="0"
                  type="text"
                  value={btcOut > 0 ? formatNumber(btcOut) : ''}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary/50 text-sm font-semibold pointer-events-none select-none tracking-wide">
                  SATS
                </span>
              </div>
              {currentCapacity > 0 && (
                <div className="mt-4 px-1">
                  <div className="relative">
                    <div className="relative h-2 rounded-full bg-secondary/20 overflow-hidden">
                      <div
                        className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-200"
                        style={{
                          width: `${maxOutbound > minOutbound ? Math.max(0, Math.min(100, ((btcOut - minOutbound) / (maxOutbound - minOutbound)) * 100)) : 0}%`,
                        }}
                      />
                    </div>
                    <input
                      className="absolute inset-0 w-full opacity-0 cursor-pointer h-2"
                      max={maxOutbound}
                      min={minOutbound}
                      onChange={(e) =>
                        setValue('clientBalanceSat', e.target.value)
                      }
                      step={currentCapacity >= 1000000 ? 10000 : 1000}
                      type="range"
                      value={btcOut}
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-primary shadow-lg shadow-primary/30 pointer-events-none transition-all duration-200"
                      style={{
                        left: `calc(${maxOutbound > minOutbound ? Math.max(0, Math.min(100, ((btcOut - minOutbound) / (maxOutbound - minOutbound)) * 100)) : 0}% - 8px)`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-content-tertiary mt-3">
                    <span>Min: {formatNumber(minOutbound)} sats</span>
                    <span>Max: {formatNumber(maxOutbound)} sats</span>
                  </div>
                </div>
              )}
            </div>

            {/* Add RGB Asset */}
            <div className="mb-12">
              <h5 className="text-lg font-semibold text-white mb-3">
                Add RGB Asset
              </h5>

              <button
                className={`w-full p-2.5 bg-surface-overlay/50 rounded-xl border border-border-default transition-all duration-200 flex items-center justify-between text-left ${
                  isAssetLocked
                    ? 'cursor-default opacity-90'
                    : 'hover:border-primary/50'
                }`}
                disabled={isAssetLocked}
                onClick={() =>
                  !isAssetLocked && setIsAssetDropdownOpen(!isAssetDropdownOpen)
                }
                type="button"
              >
                <div className="flex items-center gap-2">
                  {selectedAsset ? (
                    <>
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                        <img
                          alt={selectedAsset.ticker}
                          className="w-4 h-4"
                          src={selectedAssetIcon}
                        />
                      </div>
                      <div>
                        <div className="font-medium text-white text-sm">
                          {selectedAsset.ticker}
                        </div>
                        <div className="text-xs text-content-secondary">
                          {selectedAsset.name}
                        </div>
                      </div>
                    </>
                  ) : (
                    <span className="text-content-secondary text-sm">
                      No Asset
                    </span>
                  )}
                </div>
                {!isAssetLocked && (
                  <ChevronDown
                    className={`w-4 h-4 text-content-secondary transition-transform duration-200 ${isAssetDropdownOpen ? 'rotate-180' : ''}`}
                  />
                )}
              </button>

              {isAssetDropdownOpen && (
                <div className="rounded-xl border border-border-default bg-surface-overlay shadow-lg overflow-hidden mt-1">
                  <div className="max-h-[220px] overflow-y-auto">
                    <button
                      className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-white/5 text-content-secondary transition-colors duration-200 border-b border-border-default/50 text-sm"
                      onClick={() => {
                        setSelectedAsset(null)
                        setAddAsset(false)
                        setValue('assetId', '')
                        setValue('lspAssetAmount', '')
                        setValue('clientAssetAmount', '0')
                        setIsAssetDropdownOpen(false)
                      }}
                      type="button"
                    >
                      No Asset
                    </button>
                    {Object.values(assetMap).map((asset) => (
                      <button
                        className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-primary/10 transition-colors duration-200 text-sm"
                        key={asset.asset_id}
                        onClick={() => {
                          setSelectedAsset(asset)
                          setAddAsset(true)
                          setValue('assetId', asset.asset_id)
                          setValue('lspAssetAmount', '')
                          setValue('clientAssetAmount', '0')
                          setIsAssetDropdownOpen(false)
                        }}
                        type="button"
                      >
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <AssetListIcon ticker={asset.ticker} />
                        </div>
                        <div className="text-left">
                          <div className="font-medium text-white">
                            {asset.ticker}
                          </div>
                          <div className="text-xs text-content-tertiary">
                            {asset.name}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedAsset && addAsset && assetInfo && (
                <div className="mt-6">
                  <div className="bg-surface-base/50 p-6 rounded-lg space-y-4">
                    <div className="space-y-3">
                      <div className="bg-surface-overlay/50 rounded-xl p-4 border border-border-default/50">
                        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border-default/50">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border-2 border-border-default/50">
                            <img
                              alt={selectedAsset.ticker}
                              className="w-5 h-5"
                              src={selectedAssetIcon}
                            />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-semibold text-white">
                                {selectedAsset.ticker}
                              </span>
                              <span className="text-sm text-content-secondary">
                                ({selectedAsset.name})
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-content-tertiary font-mono truncate">
                          {selectedAsset.asset_id}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-content-secondary">
                            Amount
                          </label>
                          {assetPresetsCalc.length > 0 && (
                            <div className="flex items-center gap-1">
                              {assetPresetsCalc.map((preset) => (
                                <button
                                  className={`px-2 py-0.5 rounded text-xs font-semibold border transition-colors ${
                                    Math.abs(
                                      parseFloat(lspAssetAmount || '0') - preset
                                    ) < 0.001
                                      ? 'bg-primary/10 border-primary text-primary'
                                      : 'bg-surface-high/40 border-border-default/40 text-content-secondary hover:text-white hover:border-border-default/70'
                                  }`}
                                  key={preset}
                                  onClick={() =>
                                    setValue(
                                      'lspAssetAmount',
                                      preset.toString()
                                    )
                                  }
                                  type="button"
                                >
                                  {preset}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="relative">
                          <input
                            className="w-full pl-4 pr-20 py-2 bg-surface-base/50 rounded-lg border border-border-default/30 text-white text-2xl font-semibold focus:border-primary/60 focus:ring-2 focus:ring-primary/15 placeholder:text-content-tertiary/50 h-14 hover:border-border-default/50 focus:outline-none"
                            onChange={(e) => {
                              const val = e.target.value
                              if (val === '' || /^[\d.]*$/.test(val)) {
                                const re =
                                  assetInfo.precision > 0
                                    ? new RegExp(
                                        `^\\d*\\.?\\d{0,${assetInfo.precision}}$`
                                      )
                                    : /^\d*$/
                                if (re.test(val))
                                  setValue('lspAssetAmount', val)
                              }
                            }}
                            placeholder="0"
                            type="text"
                            value={lspAssetAmount}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary/60 text-sm font-semibold pointer-events-none select-none tracking-wide">
                            {selectedAsset.ticker}
                          </span>
                        </div>

                        {clientAssetAmount &&
                          parseFloat(clientAssetAmount) > 0 && (
                            <AssetQuoteDisplay
                              assetInfo={assetInfo}
                              quote={quote}
                              quoteError={quoteError}
                              quoteLoading={quoteLoading}
                            />
                          )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Channel Duration */}
            <div className="mb-12">
              <ChannelDurationSelector
                containerClassName="border-0 p-0"
                control={control}
                maxExpiryBlocks={lspOptions?.max_channel_expiry_blocks}
                onChange={(value) => setValue('channelExpireBlocks', value)}
                theme="dark"
                value={channelExpireBlocks}
              />
            </div>

            {/* Fee breakdown */}
            {(fees || isLoadingFees) && (
              <FeeBreakdownDisplay
                additionalCosts={[
                  ...(quote &&
                  clientAssetAmount &&
                  parseFloat(clientAssetAmount) > 0
                    ? [
                        {
                          amount: getQuoteFromAmount(quote) / 1000,
                          className: 'text-primary font-medium',
                          label: t('components.buyChannelModal.assetPurchase'),
                        },
                      ]
                    : []),
                ]}
                containerClassName="bg-surface-base/50 border border-border-default/30 rounded-xl p-4"
                fees={fees}
                isLoading={isLoadingFees}
              />
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between mt-8">
          <button
            className="px-3 py-2 text-content-secondary hover:text-white transition-colors flex items-center gap-1.5 hover:bg-surface-overlay/50 rounded-lg text-sm"
            onClick={onBack}
            type="button"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t('orderChannel.step2.backButton')}
          </button>
          <Button
            disabled={isLoading}
            icon={<ArrowRight className="w-4 h-4" />}
            iconPosition="right"
            size="lg"
            type="submit"
            variant="primary"
          >
            {t('orderChannel.step2.nextButton')}
          </Button>
        </div>

        {!formState.isSubmitSuccessful && formState.isSubmitted && (
          <FormError
            message={t('orderChannel.formErrors.formSubmissionError')}
            variant="inline"
          />
        )}
      </form>
    </div>
  )
}
