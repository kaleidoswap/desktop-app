import { Copy, RefreshCw, Wallet, Info } from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { useForm, SubmitHandler } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'

import { useAppSelector } from '../../app/store/hooks'
import {
  formatNumberInput,
  msatToSat,
  formatBitcoinAmount,
  parseBitcoinAmount,
  MSATS_PER_SAT,
  SATOSHIS_PER_BTC,
  getDisplayAsset,
} from '../../helpers/number'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'

import { AssetSelect } from './AssetComponents'

interface ManualSwapFormProps {
  assets: Array<{
    asset_id: string
    name: string
    ticker: string
    precision: number
  }>
  formatAmount: (amount: number, asset: string) => string
  getDisplayAsset: (asset: string) => string
  getAssetPrecision: (asset: string) => number
}

interface FormValues {
  fromAsset: string
  toAsset: string
  fromAmount: string
  toAmount: string
  timeoutSec: string
  takerPubkey: string
}

export const ManualSwapForm: React.FC<ManualSwapFormProps> = ({ assets }) => {
  const { t } = useTranslation()
  const [swapString, setSwapString] = useState<string>('')
  const [paymentSecret, setPaymentSecret] = useState<string>('')
  const [swapInitiated, setSwapInitiated] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [isInitiating, setIsInitiating] = useState(false)
  const [assetBalances, setAssetBalances] = useState<
    Record<string, { outbound: number; inbound?: number }>
  >({})
  const [isLoadingBalances, setIsLoadingBalances] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [maxOutboundHtlc, setMaxOutboundHtlc] = useState<number | null>(null)

  // Get bitcoin unit from app state
  const bitcoinUnit = useAppSelector((state) => state.settings.bitcoinUnit)

  const { register, handleSubmit, watch, setValue } = useForm<FormValues>({
    defaultValues: {
      fromAmount: '',
      fromAsset: '',
      takerPubkey: '',
      timeoutSec: '3600',
      toAmount: '',
      toAsset: '',
    },
  })

  const fromAsset = watch('fromAsset')
  const toAsset = watch('toAsset')
  const fromAmount = watch('fromAmount')
  const toAmount = watch('toAmount')
  const timeoutSec = watch('timeoutSec')
  const takerPubkey = watch('takerPubkey')

  const [makerInit] = nodeApi.useMakerInitMutation()
  const [makerExecute] = nodeApi.useMakerExecuteMutation()
  const [assetBalance] = nodeApi.endpoints.assetBalance.useLazyQuery()
  const [listChannels] = nodeApi.endpoints.listChannels.useLazyQuery()

  // Reset swap state when assets or amounts change
  useEffect(() => {
    if (swapInitiated) {
      setSwapInitiated(false)
      setSwapString('')
      setPaymentSecret('')
    }
  }, [fromAsset, toAsset, fromAmount, toAmount])

  // Clear form errors when changing assets
  useEffect(() => {
    if (fromAsset) {
      setValue('fromAmount', '')
    }
  }, [fromAsset, setValue])

  useEffect(() => {
    if (toAsset) {
      setValue('toAmount', '')
    }
  }, [toAsset, setValue])

  // Fetch asset balances and node info when assets change or on refresh
  const fetchAssetBalances = async () => {
    if (!fromAsset && !toAsset) return

    setIsLoadingBalances(true)
    setIsRefreshing(true)
    const newBalances: Record<string, { outbound: number; inbound?: number }> =
      { ...assetBalances }

    try {
      // Fetch node info to get max HTLC size for BTC
      if (fromAsset === 'BTC' || toAsset === 'BTC') {
        const channels = await listChannels()
        const maxHtlc = Math.max(
          ...(channels.data?.channels.map(
            (c) => c.next_outbound_htlc_limit_msat
          ) || [0])
        )
        setMaxOutboundHtlc(maxHtlc || 0)

        // For BTC, use maxOutboundHtlc as the balance
        if (maxHtlc) {
          newBalances['BTC'] = {
            // For BTC, inbound is the sum of inbound_balance_msat across all channels
            inbound:
              channels.data?.channels.reduce(
                (sum, c) => sum + (c.inbound_balance_msat || 0),
                0
              ) || 0,

            outbound: maxHtlc,
          }
        }
      }

      // Fetch from asset balance if needed (only for non-BTC assets)
      if (fromAsset && fromAsset !== 'BTC') {
        const balance = await assetBalance({ asset_id: fromAsset })
        if (balance.data) {
          newBalances[fromAsset] = {
            inbound: balance.data.offchain_inbound || 0,
            outbound: balance.data.offchain_outbound || 0,
          }
        }
      }

      // Fetch to asset balance if needed (only for non-BTC assets)
      if (toAsset && toAsset !== 'BTC') {
        const balance = await assetBalance({ asset_id: toAsset })
        if (balance.data) {
          newBalances[toAsset] = {
            inbound: balance.data.offchain_inbound || 0,
            outbound: balance.data.offchain_outbound || 0,
          }
        }
      }

      setAssetBalances(newBalances)
      toast.success(t('trade.manual.balancesUpdated'))
    } catch (error) {
      toast.error(t('trade.manual.balancesFailed'))
    } finally {
      setIsLoadingBalances(false)
      setIsRefreshing(false)
    }
  }

  // Initial fetch of balances when assets change
  useEffect(() => {
    fetchAssetBalances()
  }, [fromAsset, toAsset])

  // Prepare asset options using ticker for display
  const assetOptions = assets.map((asset) => {
    const ticker = asset.ticker || asset.name
    return {
      label: ticker,
      ticker: ticker,
      value: asset.asset_id,
    }
  })

  // Add BTC option
  assetOptions.unshift({
    label: 'BTC',
    ticker: 'BTC',
    value: 'BTC',
  })

  const handleFromAssetChange = (value: string) => {
    setValue('fromAsset', value)
    setValue('fromAmount', '')
  }

  const handleToAssetChange = (value: string) => {
    setValue('toAsset', value)
    setValue('toAmount', '')
  }

  const handleFromAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value

    // Get the correct precision for this asset
    const precision = getLocalAssetPrecision(fromAsset)

    try {
      // Use formatNumberInput for user-friendly input formatting
      const formattedValue = formatNumberInput(value, precision)

      // Apply thousands separators for better readability
      setValue('fromAmount', formattedValue)
    } catch (error) {
      setValue('fromAmount', '')
    }
  }

  const handleToAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value

    // Get the correct precision for this asset
    const precision = getLocalAssetPrecision(toAsset)

    try {
      // Use formatNumberInput for user-friendly input formatting
      const formattedValue = formatNumberInput(value, precision)

      // Apply thousands separators for better readability
      setValue('toAmount', formattedValue)
    } catch (error) {
      setValue('toAmount', '')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleMaxAmount = (asset: string, type: 'from' | 'to') => {
    if (!asset) return
    if (asset === 'BTC' && !maxOutboundHtlc) return
    if (
      asset !== 'BTC' &&
      (!assetBalances[asset] ||
        (type === 'from' && assetBalances[asset].outbound <= 0) ||
        (type === 'to' && (assetBalances[asset].inbound || 0) <= 0))
    )
      return

    // For BTC, always use maxOutboundHtlc as the max amount for 'from'
    // and inbound balance for 'to'
    if (asset === 'BTC') {
      if (type === 'from' && maxOutboundHtlc !== null) {
        // Convert from msat to sat first
        const satoshis = msatToSat(maxOutboundHtlc)

        // Format based on bitcoin unit
        const formattedAmount =
          bitcoinUnit === 'BTC'
            ? (satoshis / SATOSHIS_PER_BTC).toFixed(8)
            : satoshis.toString()

        setValue('fromAmount', formattedAmount)
      } else if (type === 'to' && assetBalances[asset]?.inbound) {
        // For 'to', use inbound balance
        const satoshis = msatToSat(assetBalances[asset].inbound || 0)

        // Format based on bitcoin unit
        const formattedAmount =
          bitcoinUnit === 'BTC'
            ? (satoshis / SATOSHIS_PER_BTC).toFixed(8)
            : satoshis.toString()

        setValue('toAmount', formattedAmount)
      }
    } else {
      // For other assets, get the precision and format accordingly
      const assetInfo = assets.find((a) => a.asset_id === asset)
      const precision = assetInfo ? assetInfo.precision : 8

      // Convert raw balance to display format
      const rawBalance =
        type === 'from'
          ? assetBalances[asset].outbound
          : assetBalances[asset].inbound || 0

      const displayBalance = (rawBalance / Math.pow(10, precision)).toFixed(
        precision
      )

      setValue(type === 'from' ? 'fromAmount' : 'toAmount', displayBalance)
    }
  }

  // Parse amount string to raw number for API using the utility function
  const parseAssetAmount = (amountStr: string, asset: string): number => {
    if (!amountStr || amountStr === '') return 0

    // For BTC, use parseBitcoinAmount
    if (asset === 'BTC') {
      return parseBitcoinAmount(amountStr, bitcoinUnit as 'BTC' | 'SAT')
    }

    // For other assets, find the asset precision and convert to raw units
    const assetInfo = assets.find((a) => a.asset_id === asset)
    const precision = assetInfo ? assetInfo.precision : 8

    // Clean the input and convert to raw units
    const cleanAmount = amountStr.replace(/[^\d.-]/g, '')
    return Math.round(parseFloat(cleanAmount) * Math.pow(10, precision))
  }

  // Check if amount exceeds balance
  const isAmountExceedingBalance = (amount: string, asset: string): boolean => {
    if (!asset || !amount || amount === '' || !assetBalances[asset])
      return false

    // Parse the input amount to raw units for comparison
    const parsedAmount = parseAssetAmount(amount, asset)

    // For BTC, compare with maxOutboundHtlc for outbound (from) transactions
    if (asset === 'BTC') {
      if (maxOutboundHtlc !== null) {
        // Convert maxOutboundHtlc from msat to sat for comparison
        const satoshis = msatToSat(maxOutboundHtlc)

        // If using BTC unit, parsedAmount is already in satoshis
        return parsedAmount > satoshis
      }
      return false
    } else {
      // For other assets, compare raw values directly with outbound balance
      return parsedAmount > assetBalances[asset].outbound
    }
  }

  const onInitSwap: SubmitHandler<FormValues> = async (data) => {
    try {
      setIsInitiating(true)

      // Parse amounts for API - this should convert from display format to raw numbers
      const fromAmountValue = parseAssetAmount(data.fromAmount, data.fromAsset)
      const toAmountValue = parseAssetAmount(data.toAmount, data.toAsset)

      // Prepare request object with required fields
      const requestPayload: {
        qty_from: number
        qty_to: number
        from_asset?: string
        to_asset?: string
        timeout_sec: number
      } = {
        qty_from: fromAmountValue,
        qty_to: toAmountValue,
        timeout_sec: parseInt(data.timeoutSec),
      }

      // Only include from_asset if it's not BTC
      if (data.fromAsset === 'BTC') {
        // If we're using BTC unit, we need to convert from satoshis to millisatoshis
        requestPayload.qty_from = fromAmountValue * MSATS_PER_SAT
        // from_asset field is omitted for BTC
      } else {
        requestPayload.from_asset = data.fromAsset
      }

      // Only include to_asset if it's not BTC
      if (data.toAsset === 'BTC') {
        // If we're using BTC unit, we need to convert from satoshis to millisatoshis
        requestPayload.qty_to = toAmountValue * MSATS_PER_SAT
        // to_asset field is omitted for BTC
      } else {
        requestPayload.to_asset = data.toAsset
      }

      const response = await makerInit(requestPayload).unwrap()

      setSwapString(response.swapstring)
      setPaymentSecret(response.payment_secret)
      setSwapInitiated(true)
      toast.success(t('trade.manual.swapInitiated'))
    } catch (error) {
      toast.error(t('trade.manual.swapInitiateFailed'))
    } finally {
      setIsInitiating(false)
    }
  }

  const onExecuteSwap = async () => {
    if (!swapString || !paymentSecret) {
      toast.error(t('trade.manual.noActiveSwap'))
      return
    }

    if (!takerPubkey) {
      toast.error(t('trade.manual.missingTakerPubkey'))
      return
    }

    setIsExecuting(true)
    try {
      await makerExecute({
        payment_secret: paymentSecret,
        swapstring: swapString,
        taker_pubkey: takerPubkey,
      }).unwrap()

      toast.success(t('trade.manual.swapExecuted'))
      // Reset form after successful execution
      setSwapInitiated(false)
      setSwapString('')
      setPaymentSecret('')
      setValue('takerPubkey', '')
    } catch (error) {
      toast.error(t('trade.manual.swapExecuteFailed'))
    } finally {
      setIsExecuting(false)
    }
  }

  // Format balance for display using the utility function
  const formatBalanceDisplay = (asset: string, balance: number | undefined) => {
    if (!asset || balance === undefined || balance === null) return '0'

    // For BTC, handle formatting
    if (asset === 'BTC') {
      // Convert from msat to sat
      const satoshis = msatToSat(balance)

      // Format based on bitcoin unit with thousands separators
      if (bitcoinUnit === 'BTC') {
        return new Intl.NumberFormat('en-US', {
          maximumFractionDigits: 8,
          minimumFractionDigits: 8,
          useGrouping: true,
        }).format(satoshis / SATOSHIS_PER_BTC)
      } else {
        return new Intl.NumberFormat('en-US', {
          maximumFractionDigits: 0,
          useGrouping: true,
        }).format(satoshis)
      }
    }

    // For other assets, convert raw balance to display format
    try {
      const assetInfo = assets.find((a) => a.asset_id === asset)
      const precision = assetInfo ? assetInfo.precision : 8

      // Convert raw balance to display format with proper precision and thousands separators
      return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: precision,
        minimumFractionDigits: precision,
        useGrouping: true,
      }).format(balance / Math.pow(10, precision))
    } catch (error) {
      return '0'
    }
  }

  // Get asset ticker for display
  const getAssetTicker = (assetId: string) => {
    if (!assetId) return ''

    if (assetId === 'BTC') {
      return bitcoinUnit === 'BTC' ? 'BTC' : 'SAT'
    }
    const asset = assets.find((a) => a.asset_id === assetId)
    return asset ? asset.ticker || asset.name : assetId
  }

  // Override getAssetPrecision to handle BTC/SAT units
  const getLocalAssetPrecision = (asset: string): number => {
    if (!asset) return 8

    // For BTC, use the bitcoinUnit setting to determine precision
    if (asset === 'BTC') {
      return bitcoinUnit === 'BTC' ? 8 : 0
    }

    // For other assets, find the asset in the list and use its precision
    const assetInfo = assets.find((a) => a.asset_id === asset)
    return assetInfo ? assetInfo.precision : 8
  }

  // Get the appropriate balance for display based on asset and direction
  const getBalanceForDisplay = (asset: string, isFromAsset: boolean) => {
    if (!asset || !assetBalances[asset]) return '0'

    if (isFromAsset) {
      // For "from" asset, show outbound balance (what you can send)
      return formatBalanceDisplay(asset, assetBalances[asset].outbound)
    } else {
      // For "to" asset, show inbound balance (what you can receive)
      return formatBalanceDisplay(asset, assetBalances[asset].inbound || 0)
    }
  }

  // Get the appropriate balance label based on direction
  const getBalanceLabel = (isFromAsset: boolean) => {
    return isFromAsset ? t('tradeManual.makerForm.balance.available') + ':' : t('tradeManual.makerForm.info.canReceiveUpTo') + ':'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 mb-4">
        <h2 className="text-xl font-semibold text-white">{t('tradeManual.makerForm.title')}</h2>
        <p className="text-sm text-slate-400">
          {t('tradeManual.makerForm.description')}
        </p>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4 mb-6 border border-slate-700/50 swap-card">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white step-indicator">
              1
            </div>
            <h3 className="text-md font-medium text-white">
              {t('tradeManual.makerForm.initiateTitle')}
            </h3>
          </div>
          <button
            className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
            disabled={isRefreshing}
            onClick={fetchAssetBalances}
            title="Refresh balances"
          >
            <RefreshCw
              className={`w-4 h-4 text-slate-400 ${isRefreshing ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
        <p className="text-sm text-slate-400 ml-8 mb-4">
          {t('tradeManual.makerForm.info.initiateDescription')}
        </p>

        <form className="space-y-6" onSubmit={handleSubmit(onInitSwap)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* From Asset Column */}
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-slate-300">
                    {t('tradeManual.makerForm.labels.fromAsset')}
                  </label>
                  {fromAsset && (
                    <div className="flex items-center gap-1 text-xs text-slate-400 asset-balance">
                      <Wallet className="w-3 h-3" />
                      <span>{getBalanceLabel(true)} </span>
                      <span className="font-medium text-slate-300">
                        {isLoadingBalances
                          ? 'Loading...'
                          : assetBalances[fromAsset] !== undefined
                            ? `${getBalanceForDisplay(fromAsset, true)} ${getAssetTicker(fromAsset)}`
                            : '0 ' + getAssetTicker(fromAsset)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="relative focus-within:z-20">
                  <AssetSelect
                    onChange={handleFromAssetChange}
                    options={assetOptions}
                    value={fromAsset}
                  />
                  {!fromAsset && (
                    <p className="mt-1 text-xs text-red-400">
                      {t('tradeManual.makerForm.placeholders.selectAsset')}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-300">
                  {t('tradeManual.makerForm.labels.amountToSend')}
                </label>
                <div className="relative h-[50px]">
                  <input
                    className="w-full h-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500 input-animate"
                    placeholder="0.00"
                    type="text"
                    {...register('fromAmount', { required: true })}
                    disabled={!fromAsset}
                    onChange={handleFromAmountChange}
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                    {fromAsset && (
                      <button
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        onClick={() => handleMaxAmount(fromAsset, 'from')}
                        type="button"
                      >
                        MAX
                      </button>
                    )}
                    <span className="text-slate-400">
                      {getAssetTicker(fromAsset)}
                    </span>
                  </div>
                </div>
                {!fromAmount && fromAsset && (
                  <p className="mt-1 text-xs text-red-400">
                    {t('tradeManual.makerForm.placeholders.enterAmount')}
                  </p>
                )}
                {fromAsset &&
                  assetBalances[fromAsset] &&
                  isAmountExceedingBalance(fromAmount, fromAsset) && (
                    <p className="mt-1 text-xs text-red-400">
                      {t('tradeManual.makerForm.errors.amountExceedsBalance')}
                    </p>
                  )}
                {fromAsset === 'BTC' && maxOutboundHtlc !== null && (
                  <p className="mt-1 text-xs text-slate-400">
                    Max HTLC size:{' '}
                    {formatBitcoinAmount(
                      msatToSat(maxOutboundHtlc),
                      bitcoinUnit
                    )}{' '}
                    {getDisplayAsset('BTC', bitcoinUnit)}
                  </p>
                )}
              </div>
            </div>

            {/* To Asset Column */}
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-slate-300">
                    {t('tradeManual.makerForm.labels.toAsset')}
                  </label>
                  {toAsset && (
                    <div className="flex items-center gap-1 text-xs text-slate-400 asset-balance">
                      <Wallet className="w-3 h-3" />
                      <span>{getBalanceLabel(false)} </span>
                      <span className="font-medium text-slate-300">
                        {isLoadingBalances
                          ? 'Loading...'
                          : assetBalances[toAsset] !== undefined
                            ? `${getBalanceForDisplay(toAsset, false)} ${getAssetTicker(toAsset)}`
                            : '0 ' + getAssetTicker(toAsset)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="relative focus-within:z-20">
                  <AssetSelect
                    disabled={fromAsset ? false : true}
                    onChange={handleToAssetChange}
                    options={assetOptions.filter(
                      (option) => option.value !== fromAsset
                    )}
                    value={toAsset}
                  />
                  {fromAsset && !toAsset && (
                    <p className="mt-1 text-xs text-red-400">
                      {t('tradeManual.makerForm.placeholders.selectAsset')}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-300">
                  {t('tradeManual.makerForm.labels.amountToReceive')}
                </label>
                <div className="relative h-[50px]">
                  <input
                    className="w-full h-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500 input-animate"
                    placeholder="0.00"
                    type="text"
                    {...register('toAmount', { required: true })}
                    disabled={!toAsset}
                    onChange={handleToAmountChange}
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                    {toAsset && (
                      <button
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        onClick={() => handleMaxAmount(toAsset, 'to')}
                        type="button"
                      >
                        MAX
                      </button>
                    )}
                    <span className="text-slate-400">
                      {getAssetTicker(toAsset)}
                    </span>
                  </div>
                </div>
                {!toAmount && toAsset && (
                  <p className="mt-1 text-xs text-red-400">
                    {t('tradeManual.makerForm.placeholders.enterAmount')}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-300">
              {t('tradeManual.makerForm.labels.timeout')}
            </label>
            <input
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500 input-animate"
              placeholder="3600"
              type="number"
              {...register('timeoutSec', {
                max: 86400,
                min: 10,
                required: true,
              })}
            />
            <div className="flex justify-between">
              <p className="text-xs text-slate-500">
                {t('tradeManual.makerForm.info.timeoutDescription')}
              </p>
              {timeoutSec && parseInt(timeoutSec) < 10 && (
                <p className="text-xs text-red-400">
                  {t('tradeManual.makerForm.info.minTimeout')}
                </p>
              )}
              {timeoutSec && parseInt(timeoutSec) > 86400 && (
                <p className="text-xs text-red-400">
                  {t('tradeManual.makerForm.info.maxTimeout')}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 p-3 bg-slate-800/30 rounded-xl border border-slate-700">
            <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <p>
              {t('tradeManual.makerForm.info.sufficientBalanceWarning')}
            </p>
          </div>

          <button
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-blue-600 button-animate"
            disabled={
              isInitiating ||
              !fromAsset ||
              !toAsset ||
              !fromAmount ||
              !toAmount ||
              (timeoutSec ? parseInt(timeoutSec) < 10 : true) ||
              (timeoutSec ? parseInt(timeoutSec) > 86400 : true) ||
              (fromAsset && fromAmount
                ? isAmountExceedingBalance(fromAmount, fromAsset)
                : false)
            }
            type="submit"
          >
            {isInitiating ? (
              <div className="flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{t('tradeManual.makerForm.buttons.initiating')}</span>
              </div>
            ) : (
              t('tradeManual.makerForm.buttons.initiateSwap')
            )}
          </button>
        </form>
      </div>

      {swapInitiated && (
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50 swap-card swap-initiated">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white step-indicator">
              2
            </div>
            <h3 className="text-md font-medium text-white">{t('tradeManual.makerForm.buttons.shareWithTaker')}</h3>
          </div>
          <p className="text-sm text-slate-400 ml-8 mb-4">
            {t('tradeManual.makerForm.info.swapInitiated')}
          </p>

          <div className="bg-slate-900 p-4 rounded-lg mb-4 relative swap-string-container">
            <pre className="text-xs text-slate-300 font-mono break-all whitespace-pre-wrap">
              {swapString}
            </pre>
            <button
              className="absolute top-2 right-2 p-1.5 bg-slate-700 rounded hover:bg-slate-600 transition-colors"
              onClick={() => copyToClipboard(swapString)}
              title="Copy swap string"
              type="button"
            >
              <Copy className="w-4 h-4 text-slate-300" />
            </button>
            {copied && (
              <div className="absolute top-2 right-10 bg-slate-700 text-white text-xs py-1 px-2 rounded copied-indicator">
                {t('tradeManual.makerForm.info.copiedToClipboard')}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white step-indicator">
              3
            </div>
            <h3 className="text-md font-medium text-white">{t('tradeManual.makerForm.buttons.executeSwap')}</h3>
          </div>
          <p className="text-sm text-slate-400 ml-8 mb-4">
            {t('tradeManual.makerForm.info.executeInfo')}
          </p>

          <div className="flex flex-col gap-1.5 mb-4">
            <label className="text-sm font-medium text-slate-300">
              {t('tradeManual.makerForm.labels.takerPubkey')}
            </label>
            <input
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500 input-animate"
              placeholder={t('tradeManual.makerForm.placeholders.takerPubkey')}
              type="text"
              {...register('takerPubkey', { required: true })}
            />
            {!takerPubkey && (
              <p className="mt-1 text-xs text-red-400">
                {t('tradeManual.makerForm.errors.enterTakerPubkey')}
              </p>
            )}
          </div>

          <button
            className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-emerald-600 button-animate"
            disabled={!paymentSecret || isExecuting || !takerPubkey}
            onClick={onExecuteSwap}
            type="button"
          >
            {isExecuting ? (
              <div className="flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{t('tradeManual.makerForm.buttons.executing')}</span>
              </div>
            ) : (
              t('tradeManual.makerForm.buttons.executeSwap')
            )}
          </button>
        </div>
      )}
    </div>
  )
}
