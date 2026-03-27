import { zodResolver } from '@hookform/resolvers/zod'
import React, { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import * as z from 'zod'

import { useAppDispatch } from '../../app/store/hooks'
import {
  FeeBreakdownDisplay,
  ChannelDurationSelector,
} from '../../components/ChannelConfiguration'
import { FormError } from '../../components/FormError'
import {
  AssetQuoteDisplay,
  LiquidityCard,
  LiquiditySlider,
} from '../../components/Liquidity'
import { AssetSelectWithModal } from '../../components/Trade/AssetSelectWithModal'
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

import bitcoinLogo from '../../assets/bitcoin-logo.svg'
import rgbIcon from '../../assets/rgb-symbol-color.svg'

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
  clientAssetAmount: z.string().optional().default('0'),
})

type FormFields = z.infer<typeof FormFieldsSchema>

const CAPACITY_PRESETS = [50000, 100000, 500000, 1000000, 10000000]

function formatPreset(sats: number): string {
  if (sats >= 1_000_000) return `${sats / 1_000_000}M`
  if (sats >= 1_000) return `${sats / 1_000}K`
  return sats.toString()
}

export const Step2: React.FC<Props> = ({ onNext, onBack }) => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const [assetMap, setAssetMap] = useState<Record<string, AssetInfo>>({})
  const [addAsset, setAddAsset] = useState(false)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showCustomAssetCapacity, setShowCustomAssetCapacity] = useState(false)
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
        capacitySat: '100000',
        channelExpireBlocks: 12960,
        clientBalanceSat: '20000',
        lspAssetAmount: '',
        clientAssetAmount: '0',
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
  const isCustomCapacity = !CAPACITY_PRESETS.includes(currentCapacity)
  const btcOut = parseInt(clientBalanceSat.replace(/[^0-9]/g, ''), 10) || 0
  const btcIn = Math.max(0, currentCapacity - btcOut)
  const lspAsset = parseFloat(lspAssetAmount) || 0
  const assetInfo = assetId ? assetMap[assetId] : null
  const filteredPresets = CAPACITY_PRESETS.filter(
    (p) => p >= effectiveMinCapacity && p <= effectiveMaxCapacity
  )

  const clientAsset = parseFloat(clientAssetAmount) || 0
  const assetFactor = assetInfo ? Math.pow(10, assetInfo.precision) : 1
  const assetMax = assetInfo ? assetInfo.max_channel_amount / assetFactor : 0
  const assetMin = assetInfo ? assetInfo.min_channel_amount / assetFactor : 0
  const clientAssetMin = assetInfo
    ? assetInfo.min_initial_client_amount / assetFactor
    : 0
  const clientAssetMax = assetInfo
    ? assetInfo.max_initial_client_amount / assetFactor
    : 0

  // Custom USDT presets matching the requirement: 100, 250, 500, 1000
  const assetPresetsCalc =
    assetInfo && assetInfo.ticker.toUpperCase() === 'USDT'
      ? [100, 250, 500, 1000].filter((p) => p >= assetMin && p <= assetMax)
      : []

  const isCustomAssetTotal =
    assetPresetsCalc.length > 0 &&
    lspAsset > 0 &&
    !assetPresetsCalc.some((p) => Math.abs(p - lspAsset) < 0.001)

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
        clientBalanceSat: parseInt(
          finalClientBalanceSat.replace(/[^0-9]/g, ''),
          10
        ),
        clientAssetAmount: parsedClientAssetAmount || undefined,
        lspAssetAmount: parsedLspAssetAmount,
        rfqId: rfqId || undefined,
      }

      try {
        OrderChannelFormSchema.parse(submissionData)
        dispatch(orderChannelSliceActions.setChannelRequestForm(submissionData))
        onNext(submissionData)
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
            onNext(adjustedData)
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

  const assetOptions = Object.entries(assetMap).map(([id, info]) => ({
    assetId: id,
    label: info.name,
    name: info.name,
    ticker: info.ticker,
    value: id,
  }))

  return (
    <div className="w-full">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            {t('orderChannel.step2.title')}
          </h2>
          <p className="text-content-secondary mt-2">
            {t('orderChannel.step2.subtitle')}
          </p>
        </div>

        <form className="w-full space-y-4" onSubmit={handleSubmit(onSubmit)}>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-content-secondary">
              {t('orderChannel.step2.loading')}
            </div>
          ) : (
            <>
              {/* Channel type toggle */}
              <div className="flex gap-1.5 p-1 bg-surface-overlay rounded-xl">
                <button
                  type="button"
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
                    !addAsset
                      ? 'bg-amber-400/20 text-amber-400 border border-amber-400/50'
                      : 'text-content-secondary hover:text-content-primary'
                  }`}
                  onClick={() => {
                    setAddAsset(false)
                    setValue('assetId', '')
                    setValue('lspAssetAmount', '')
                    setValue('clientAssetAmount', '0')
                  }}
                >
                  <img src={bitcoinLogo} alt="BTC" className="w-4 h-4" />
                  BTC Only
                </button>
                <button
                  type="button"
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
                    addAsset
                      ? 'bg-purple-400/20 text-purple-300 border border-purple-400/50'
                      : 'text-content-secondary hover:text-content-primary'
                  }`}
                  onClick={() => setAddAsset(true)}
                  disabled={Object.keys(assetMap).length === 0}
                >
                  <img src={bitcoinLogo} alt="BTC" className="w-4 h-4" />
                  BTC +
                  <img src={rgbIcon} alt="RGB" className="w-4 h-4" />
                  RGB Asset
                </button>
              </div>

              <LiquidityCard
                icon={
                  <img
                    alt="BTC"
                    className="h-5 w-5 rounded-full"
                    src={bitcoinLogo}
                  />
                }
                meta={
                  <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-right">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-100/70">
                      Channel capacity
                    </div>
                    <div className="mt-0.5 text-sm font-semibold text-amber-50">
                      {formatNumberWithCommas(currentCapacity)} sats
                    </div>
                  </div>
                }
                title="BTC Lightning Channel"
                tone="amber"
              >
                <div className="pt-2">
                  <p className="text-[11px] font-semibold text-content-primary/80 uppercase tracking-wider mb-2">
                    Channel capacity
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {filteredPresets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          currentCapacity === preset && !isCustomCapacity
                            ? 'bg-amber-400/20 text-amber-400 border border-amber-400/50'
                            : 'bg-surface-overlay text-content-secondary border border-border-subtle hover:border-amber-400/30 hover:text-content-primary'
                        }`}
                        onClick={() => {
                          setValue('capacitySat', preset.toString())
                          setShowCustomInput(false)
                          if (btcOut > preset) {
                            setValue(
                              'clientBalanceSat',
                              Math.floor(preset / 2).toString()
                            )
                          }
                        }}
                      >
                        {formatPreset(preset)} sats
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isCustomCapacity || showCustomInput
                          ? 'bg-amber-400/20 text-amber-400 border border-amber-400/50'
                          : 'bg-surface-overlay text-content-secondary border border-border-subtle hover:border-amber-400/30 hover:text-content-primary'
                      }`}
                      onClick={() => setShowCustomInput((v) => !v)}
                    >
                      Custom
                    </button>
                  </div>
                  {(isCustomCapacity || showCustomInput) && (
                    <input
                      type="number"
                      autoFocus
                      value={capacitySat}
                      onChange={(e) => {
                        setValue('capacitySat', e.target.value)
                        const newCap = parseInt(e.target.value, 10) || 0
                        if (btcOut > newCap) {
                          setValue(
                            'clientBalanceSat',
                            Math.floor(newCap / 2).toString()
                          )
                        }
                      }}
                      min={effectiveMinCapacity}
                      max={effectiveMaxCapacity}
                      placeholder="Custom capacity (sats)"
                      className="mt-3 w-full px-3 py-2 bg-background shadow-inner rounded-xl border border-border-default focus:border-amber-400 text-white text-sm outline-none animate-fadeInUp"
                    />
                  )}
                </div>

                <div className="pt-4">
                  {/* BTC Liquidity slider (bar + slider merged) */}
                  <LiquiditySlider
                    value={btcOut}
                    min={lspOptions?.min_initial_client_balance_sat || 0}
                    max={Math.min(
                      currentCapacity,
                      lspOptions?.max_initial_client_balance_sat ||
                        currentCapacity
                    )}
                    step={currentCapacity >= 1000000 ? 10000 : 1000}
                    outboundLabel={`${btcOut.toLocaleString('de-DE')} sats`}
                    inboundLabel={`${btcIn.toLocaleString('de-DE')} sats`}
                    outboundColor="bg-amber-400"
                    inboundColor="bg-blue-400/50"
                    thumbBorderClass="border-amber-400"
                    unit="sats"
                    inputTextClass="text-amber-400"
                    inputFocusClass="focus:border-amber-400"
                    inputHint="Type the exact BTC amount you want available to send once the channel is live."
                    onChange={(val) =>
                      setValue('clientBalanceSat', Math.round(val).toString())
                    }
                  />
                </div>
              </LiquidityCard>

              {/* RGB Asset section */}
              {addAsset && (
                <LiquidityCard
                  icon={<img alt="RGB" className="h-5 w-5" src={rgbIcon} />}
                  meta={
                    assetId && assetInfo ? (
                      <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-right">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-100/70">
                          Asset capacity
                        </div>
                        <div className="mt-0.5 text-sm font-semibold text-cyan-50">
                          {lspAsset.toFixed(assetInfo.precision > 0 ? 2 : 0)}{' '}
                          {assetInfo.ticker}
                        </div>
                      </div>
                    ) : null
                  }
                  title="RGB Asset Channel"
                  tone="cyan"
                >
                  {/* Asset selector */}
                  <div className="pt-2">
                    <p className="text-[11px] font-semibold text-content-primary/80 uppercase tracking-wider mb-2">
                      {t('orderChannel.step2.selectAsset')}
                    </p>
                    <AssetSelectWithModal
                      className="w-full"
                      fieldLabel={t(
                        'channelConfiguration.assetSection.chooseAsset'
                      )}
                      onChange={(value) => {
                        setValue('assetId', value)
                        setValue('lspAssetAmount', '')
                        setValue('clientAssetAmount', '0')
                      }}
                      options={assetOptions}
                      placeholder={t(
                        'channelConfiguration.assetSection.searchPlaceholder'
                      )}
                      searchPlaceholder={t(
                        'channelConfiguration.assetSection.searchPlaceholder'
                      )}
                      title={t(
                        'channelConfiguration.assetSection.selectAssetTitle'
                      )}
                      value={assetId}
                    />
                  </div>

                  {assetId && assetInfo && (
                    <>
                      {/* Capacity presets */}
                      <div className="pt-4">
                        <p className="text-[11px] font-semibold text-content-primary/80 uppercase tracking-wider mb-2">
                          Total Capacity
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {assetPresetsCalc.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                Math.abs(lspAsset - preset) < 0.001 &&
                                !showCustomAssetCapacity
                                  ? 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/50'
                                  : 'bg-surface-overlay text-content-secondary border border-border-subtle hover:border-cyan-400/30 hover:text-content-primary'
                              }`}
                              onClick={() => {
                                setShowCustomAssetCapacity(false)
                                setValue('lspAssetAmount', preset.toString())
                                if (clientAsset > preset)
                                  setValue(
                                    'clientAssetAmount',
                                    preset.toString()
                                  )
                              }}
                            >
                              {preset >= 1000
                                ? `${formatNumberWithCommas(preset.toString())}`
                                : preset.toFixed(
                                    assetInfo.precision > 0 ? 0 : 0
                                  )}{' '}
                              {assetInfo.ticker}
                            </button>
                          ))}
                          <button
                            type="button"
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              showCustomAssetCapacity || isCustomAssetTotal
                                ? 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/50'
                                : 'bg-surface-overlay text-content-secondary border border-border-subtle hover:border-cyan-400/30 hover:text-content-primary'
                            }`}
                            onClick={() =>
                              setShowCustomAssetCapacity((v) => !v)
                            }
                          >
                            Custom
                          </button>
                        </div>
                        {(showCustomAssetCapacity || isCustomAssetTotal) && (
                          <>
                            <input
                              type="number"
                              autoFocus
                              value={lspAssetAmount}
                              onChange={(e) => {
                                const raw = parseFloat(e.target.value)
                                if (!isNaN(raw) && raw > assetMax) {
                                  const capped = assetMax.toString()
                                  setValue('lspAssetAmount', capped)
                                  if (clientAsset > assetMax)
                                    setValue('clientAssetAmount', capped)
                                } else {
                                  setValue('lspAssetAmount', e.target.value)
                                  const newTotal = raw || 0
                                  if (clientAsset > newTotal)
                                    setValue(
                                      'clientAssetAmount',
                                      e.target.value
                                    )
                                }
                              }}
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value)
                                if (!isNaN(val) && val > 0) {
                                  const clamped = Math.min(
                                    assetMax,
                                    Math.max(assetMin, val)
                                  )
                                  if (clamped !== val) {
                                    setValue(
                                      'lspAssetAmount',
                                      clamped.toString()
                                    )
                                    if (clientAsset > clamped)
                                      setValue(
                                        'clientAssetAmount',
                                        clamped.toString()
                                      )
                                  }
                                }
                              }}
                              min={assetMin}
                              max={assetMax}
                              step="any"
                              placeholder={`Custom (${assetInfo.ticker})`}
                              className="mt-3 w-full px-3 py-2 bg-background shadow-inner rounded-xl border border-border-default focus:border-cyan-400 text-white text-sm outline-none animate-fadeInUp"
                            />
                            <p className="mt-1.5 text-[10px] text-content-tertiary">
                              Min: {assetMin} {assetInfo.ticker} · Max:{' '}
                              {assetMax} {assetInfo.ticker}
                            </p>
                          </>
                        )}
                      </div>

                      <div className="pt-4">
                        {/* Asset liquidity slider (bar + slider merged) */}
                        <LiquiditySlider
                          value={clientAsset}
                          min={0}
                          max={Math.min(
                            lspAsset || assetMax,
                            clientAssetMax || Infinity
                          )}
                          step={assetMax >= 1000 ? 10 : 1 / assetFactor}
                          outboundLabel={`${clientAsset.toFixed(assetInfo.precision > 0 ? 2 : 0)} ${assetInfo.ticker}`}
                          inboundLabel={`${Math.max(0, lspAsset - clientAsset).toFixed(assetInfo.precision > 0 ? 2 : 0)} ${assetInfo.ticker}`}
                          outboundColor="bg-cyan-400"
                          inboundColor="bg-sky-400/35"
                          thumbBorderClass="border-cyan-300"
                          unit={assetInfo.ticker}
                          inputTextClass="text-cyan-300"
                          inputFocusClass="focus:border-cyan-400"
                          inputLabel="Available to send now"
                          inputHint={`Type the exact ${assetInfo.ticker} amount you want available immediately after funding.`}
                          minLabel={
                            clientAssetMin > 0
                              ? `Min: ${clientAssetMin} ${assetInfo.ticker}`
                              : undefined
                          }
                          maxLabel={`Max: ${Math.min(lspAsset || assetMax, clientAssetMax || Infinity).toFixed(assetInfo.precision > 0 ? 2 : 0)} ${assetInfo.ticker}`}
                          onChange={(val) =>
                            setValue('clientAssetAmount', val.toString())
                          }
                        />
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
                    </>
                  )}
                </LiquidityCard>
              )}

              {/* Duration selector */}
              <ChannelDurationSelector
                containerClassName="bg-surface-overlay/30 border border-border-subtle p-4 rounded-xl"
                control={control}
                maxExpiryBlocks={lspOptions?.max_channel_expiry_blocks}
                onChange={(value) => setValue('channelExpireBlocks', value)}
                theme="dark"
                value={channelExpireBlocks}
              />

              {/* Fee breakdown */}
              {(fees || isLoadingFees) && (
                <FeeBreakdownDisplay
                  containerClassName="bg-surface-overlay/30 border border-border-subtle rounded-xl p-4"
                  additionalCosts={[
                    ...(quote &&
                    clientAssetAmount &&
                    parseFloat(clientAssetAmount) > 0
                      ? [
                          {
                            amount: getQuoteFromAmount(quote) / 1000,
                            className: 'text-cyan-300 font-medium',
                            label: t(
                              'components.buyChannelModal.assetPurchase'
                            ),
                          },
                        ]
                      : []),
                  ]}
                  fees={fees}
                  isLoading={isLoadingFees}
                />
              )}
            </>
          )}

          {/* Actions */}
          <div className="flex justify-between gap-3 mt-2">
            <button
              className="px-6 py-3 rounded-xl text-sm font-semibold bg-surface-elevated hover:bg-surface-high transition-colors"
              onClick={onBack}
              type="button"
            >
              {t('orderChannel.step2.backButton')}
            </button>
            <button
              className={`flex-1 px-6 py-3 rounded-xl text-sm font-bold transition-colors ${
                isLoading ||
                (addAsset &&
                  !!clientAssetAmount &&
                  parseFloat(clientAssetAmount) > 0 &&
                  (quoteLoading || (!quote && !quoteError)))
                  ? 'bg-content-tertiary text-content-primary/70 cursor-not-allowed'
                  : 'bg-primary text-[#12131C] hover:bg-primary-emphasis'
              }`}
              disabled={
                isLoading ||
                (addAsset &&
                  !!clientAssetAmount &&
                  parseFloat(clientAssetAmount) > 0 &&
                  (quoteLoading || (!quote && !quoteError)))
              }
              type="submit"
            >
              {quoteLoading &&
              addAsset &&
              !!clientAssetAmount &&
              parseFloat(clientAssetAmount) > 0
                ? 'Loading Quote...'
                : t('orderChannel.step2.nextButton')}
            </button>
          </div>

          {!formState.isSubmitSuccessful && formState.isSubmitted && (
            <FormError
              message={t('orderChannel.formErrors.formSubmissionError')}
              variant="inline"
            />
          )}
        </form>
      </div>
    </div>
  )
}
