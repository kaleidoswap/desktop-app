import { X, Clock } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ClipLoader } from 'react-spinners'
import { toast } from 'react-toastify'

import { useChannelOrderPaymentMonitor } from '../../hooks/useChannelOrderPaymentMonitor'
import { useSettings } from '../../hooks/useSettings'
import {
  getQuoteFromAmount,
  getQuoteToAmount,
  useAssetChannelQuote,
} from '../../hooks/useAssetChannelQuote'
import { MIN_CHANNEL_CAPACITY, MAX_CHANNEL_CAPACITY } from '../../constants'
import { formatNumberWithCommas } from '../../helpers/number'
import {
  CountdownTimer,
  WalletConfirmationModal,
} from '../../routes/order-new-channel/components'
import {
  makerApi,
  ChannelFees,
  Lsps1CreateOrderResponse,
} from '../../slices/makerApi/makerApi.slice'
import {
  nodeApi,
  NodeApiError,
  SendPaymentResponse,
} from '../../slices/nodeApi/nodeApi.slice'
import {
  AssetInfo,
  LspOptions,
  buildChannelOrderPayload,
  validateChannelParams,
  formatRtkQueryError,
} from '../../utils/channelOrderUtils'
import { persistChannelOrder } from '../../utils/channelOrderPersistence'
import {
  FeeBreakdownDisplay,
  ChannelDurationSelector,
} from '../ChannelConfiguration'

import { LiquidityCard, LiquiditySlider } from '../Liquidity'
import { AssetSelectWithModal } from '../Trade/AssetSelectWithModal'
import bitcoinLogo from '../../assets/bitcoin-logo.svg'
import rgbIcon from '../../assets/rgb-symbol-color.svg'

import {
  QuoteDisplay,
  OrderSummary,
  PaymentSection,
  StatusScreen,
  WalletFundsCard,
  OrderIdCard,
} from './components'

interface BuyChannelModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  preselectedAsset?: {
    assetId: string
    amount: number
  }
  defaultCapacitySat?: string
  defaultClientBalanceSat?: string
  defaultTotalAssetAmount?: string
}

interface FormFields {
  capacitySat: string
  clientBalanceSat: string
  channelExpireBlocks: number
  assetId: string
  clientAssetAmount: string // Amount user wants to buy
  totalAssetAmount: string // Total LSP-side capacity for receiving
}

const feeRates = [
  { label: 'Slow', rate: 1, value: 'slow' },
  { label: 'Normal', rate: 2, value: 'normal' },
  { label: 'Fast', rate: 3, value: 'fast' },
  { label: 'Custom', rate: 0, value: 'custom' },
]

export const BuyChannelModal: React.FC<BuyChannelModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedAsset,
  defaultCapacitySat,
  defaultClientBalanceSat,
  defaultTotalAssetAmount,
}) => {
  const { t } = useTranslation()
  const { bitcoinUnit } = useSettings()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [orderPayload, setOrderPayload] = useState<any>(null)
  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  const modalShellRef = useRef<HTMLDivElement>(null)

  const [assetMap, setAssetMap] = useState<Record<string, AssetInfo>>({})
  const [lspOptions, setLspOptions] = useState<LspOptions | null>(null)
  const [effectiveMinCapacity, setEffectiveMinCapacity] =
    useState<number>(MIN_CHANNEL_CAPACITY)
  const [effectiveMaxCapacity, setEffectiveMaxCapacity] =
    useState<number>(MAX_CHANNEL_CAPACITY)
  const [fees, setFees] = useState<ChannelFees | null>(null)
  const [order, setOrder] = useState<Lsps1CreateOrderResponse | null>(null)

  // Wallet payment state
  const [selectedFee, setSelectedFee] = useState('normal')
  const [customFee, setCustomFee] = useState(1.0)
  const [showWalletConfirmation, setShowWalletConfirmation] = useState(false)
  const [isProcessingWalletPayment, setIsProcessingWalletPayment] =
    useState(false)
  const [isLoadingData, setIsLoadingData] = useState(false)

  const [channelType, setChannelType] = useState<'btc' | 'asset'>(
    preselectedAsset ? 'asset' : 'btc'
  )
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [showCustomAssetCapacity, setShowCustomAssetCapacity] = useState(false)

  const [nodeInfoRequest] = nodeApi.endpoints.nodeInfo.useLazyQuery()
  const [addressRequest] = nodeApi.endpoints.address.useLazyQuery()
  const [createOrderRequest] = makerApi.endpoints.create_order.useLazyQuery()
  const [getOrderRequest] = makerApi.endpoints.get_order.useLazyQuery()
  const [getInfoRequest] = makerApi.endpoints.get_info.useLazyQuery()
  const [estimateFeesRequest] = makerApi.endpoints.estimate_fees.useLazyQuery()
  const [btcBalance, btcBalanceResponse] =
    nodeApi.endpoints.btcBalance.useLazyQuery()
  const [listChannels, listChannelsResponse] =
    nodeApi.endpoints.listChannels.useLazyQuery()
  const [sendPayment] = nodeApi.endpoints.sendPayment.useMutation()
  const [sendBtc] = nodeApi.endpoints.sendBtc.useMutation()
  const [listPeers] = nodeApi.endpoints.listPeers.useLazyQuery()
  const [connectPeer] = nodeApi.endpoints.connectPeer.useMutation()

  const {
    isProcessingPayment,
    markPaymentReceived,
    paymentReceived,
    paymentStatus,
    reset: resetPaymentMonitor,
    setPaymentStatus,
  } = useChannelOrderPaymentMonitor({
    accessToken,
    enabled: step === 2,
    getOrder: getOrderRequest,
    onTerminalState: (status) => {
      setStep(3)
      if (status === 'success' && onSuccessRef.current) {
        setTimeout(onSuccessRef.current, 2000)
      }
    },
    orderId,
    orderPayload,
  })

  const { handleSubmit, setValue, control, watch } = useForm<FormFields>({
    defaultValues: {
      assetId: preselectedAsset?.assetId || '',
      capacitySat: defaultCapacitySat || '100000',
      channelExpireBlocks: 12960,
      clientAssetAmount: preselectedAsset
        ? preselectedAsset.amount.toString()
        : '',
      clientBalanceSat: defaultClientBalanceSat || '20000',
      totalAssetAmount: defaultTotalAssetAmount || '0',
    },
  })

  // Set channel type and asset when preselectedAsset provided
  useEffect(() => {
    if (preselectedAsset && isOpen) {
      setValue('assetId', preselectedAsset.assetId)
      setValue(
        'clientAssetAmount',
        preselectedAsset.amount > 0 ? preselectedAsset.amount.toString() : ''
      )
      if (defaultTotalAssetAmount) {
        setValue('totalAssetAmount', defaultTotalAssetAmount)
      }
      setChannelType('asset')
    } else if (!isOpen) {
      setChannelType(preselectedAsset ? 'asset' : 'btc')
      setShowCustomInput(false)
    }
  }, [defaultTotalAssetAmount, preselectedAsset, isOpen, setValue])

  // Calculate available liquidity
  const channels =
    listChannelsResponse?.data?.channels?.filter(
      (channel: any) => channel.ready
    ) || []
  const outboundLiquidity =
    channels.length > 0
      ? Math.max(
          ...channels.map(
            (channel: any) =>
              (channel.next_outbound_htlc_limit_msat || 0) / 1000
          )
        )
      : 0
  const vanillaChainBalance = btcBalanceResponse.data?.vanilla?.spendable || 0
  const coloredChainBalance = btcBalanceResponse.data?.colored?.spendable || 0
  const onChainBalance = vanillaChainBalance + coloredChainBalance

  // Refresh wallet data
  const refreshData = useCallback(async () => {
    if (!btcBalanceResponse.data || !listChannelsResponse.data) {
      setIsLoadingData(true)
    }

    try {
      await Promise.all([btcBalance(), listChannels()])
    } finally {
      setIsLoadingData(false)
    }
  }, [
    btcBalance,
    listChannels,
    btcBalanceResponse.data,
    listChannelsResponse.data,
  ])

  useEffect(() => {
    if (isProcessingWalletPayment || !isOpen || step !== 2) return

    refreshData()

    const interval = setInterval(() => {
      refreshData()
    }, 15000)

    return () => {
      clearInterval(interval)
    }
  }, [refreshData, isProcessingWalletPayment, isOpen, step])

  useEffect(() => {
    if (!showWalletConfirmation) return

    modalShellRef.current?.scrollTo({
      behavior: 'smooth',
      top: 0,
    })
  }, [showWalletConfirmation])

  const assetId = watch('assetId')
  const capacitySat = watch('capacitySat')
  const clientBalanceSat = watch('clientBalanceSat')
  const channelExpireBlocks = watch('channelExpireBlocks')
  const clientAssetAmount = watch('clientAssetAmount')
  const totalAssetAmount = watch('totalAssetAmount')
  const shouldFetchQuote =
    channelType === 'asset' &&
    !!assetId &&
    !!assetMap[assetId] &&
    !!clientAssetAmount &&
    parseFloat(clientAssetAmount) > 0

  const { quote, quoteError, quoteLoading, resetQuote } = useAssetChannelQuote({
    assetId,
    assetMap,
    clientAssetAmount,
    enabled: isOpen && !loading && shouldFetchQuote,
  })

  const CAPACITY_PRESETS = [50000, 100000, 500000, 1000000, 10000000]
  const currentCapacity =
    parseInt(capacitySat.replace(/[^0-9]/g, ''), 10) || 100000
  const isCustomCapacity = !CAPACITY_PRESETS.includes(currentCapacity)
  const btcOut = parseInt(clientBalanceSat.replace(/[^0-9]/g, ''), 10) || 0
  const btcIn = Math.max(0, currentCapacity - btcOut)
  const usdtOut = parseFloat(clientAssetAmount) || 0
  const usdtTotal = parseFloat(totalAssetAmount) || 0
  const usdtIn = Math.max(0, usdtTotal - usdtOut)

  // Asset-specific derived values
  const assetFactor =
    assetId && assetMap[assetId] ? Math.pow(10, assetMap[assetId].precision) : 1
  const assetMax =
    assetId && assetMap[assetId]
      ? assetMap[assetId].max_channel_amount / assetFactor
      : 0
  const assetPresetsCalc =
    assetMax > 0
      ? [0.25, 0.5, 0.75, 1.0].map(
          (p) => Math.round(assetMax * p * assetFactor) / assetFactor
        )
      : []
  const isCustomAssetTotal =
    assetPresetsCalc.length > 0 &&
    usdtTotal > 0 &&
    !assetPresetsCalc.some((p) => Math.abs(p - usdtTotal) < 0.001)

  useEffect(() => {
    if (!isOpen || loading || channelType !== 'asset' || !assetId) {
      return
    }

    const waitingForPreselectedAsset =
      !!preselectedAsset &&
      assetId === preselectedAsset.assetId &&
      Object.keys(assetMap).length === 0

    if (waitingForPreselectedAsset) {
      return
    }

    if (!assetMap[assetId]) {
      setChannelType('btc')
      setValue('assetId', '')
      setValue('clientAssetAmount', '')
      setValue('totalAssetAmount', '0')
      resetQuote()
    }
  }, [
    assetId,
    assetMap,
    channelType,
    isOpen,
    loading,
    preselectedAsset,
    resetQuote,
    setValue,
  ])

  // Set default total asset amount to max capacity when asset is selected
  useEffect(() => {
    if (assetId && assetMap[assetId] && totalAssetAmount === '0') {
      const maxCapacity =
        assetMap[assetId].max_channel_amount /
        Math.pow(10, assetMap[assetId].precision)
      setValue('totalAssetAmount', maxCapacity.toString())
    }
  }, [assetId, assetMap, totalAssetAmount, setValue])

  // Fetch LSP info on mount
  useEffect(() => {
    if (!isOpen) return

    const fetchData = async () => {
      setLoading(true)
      try {
        const infoResponse = await getInfoRequest()

        if (infoResponse.data) {
          if (infoResponse.data.options) {
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

            // Sanitize options to remove nulls where number is expected
            const sanitizedOptions: LspOptions = {
              ...(infoResponse.data.options as any),
              min_onchain_payment_confirmations:
                infoResponse.data.options.min_onchain_payment_confirmations ??
                undefined,
              min_onchain_payment_size_sat:
                infoResponse.data.options.min_onchain_payment_size_sat || 0,
            }
            setLspOptions(sanitizedOptions)
          }

          if (infoResponse.data.assets) {
            const tmpMap: Record<string, AssetInfo> = {}
            if (Array.isArray(infoResponse.data.assets)) {
              infoResponse.data.assets.forEach((asset: any) => {
                if (asset.asset_id) {
                  tmpMap[asset.asset_id] = asset as AssetInfo
                }
              })
            }
            setAssetMap(tmpMap)
          }
        }
      } catch (_error) {
        toast.error(t('buyChannel.lspFetchError'))
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [getInfoRequest, isOpen, t])

  // Fetch fee estimates
  useEffect(() => {
    const fetchFees = async () => {
      if (!capacitySat || !clientBalanceSat || loading) {
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
        const [nodeInfoResponse, addressResponse] = await Promise.all([
          nodeInfoRequest(),
          addressRequest(),
        ])
        const clientPubKey = nodeInfoResponse.data?.pubkey
        const refundAddress = addressResponse.data?.address

        if (!clientPubKey || !refundAddress) {
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

        // Only include asset parameters if we have required data
        if (assetId && assetMap[assetId]) {
          const precision = assetMap[assetId].precision

          // For client asset amount (user buying), we MUST have a quote with rfq_id
          let parsedClientAssetAmount = 0
          if (clientAssetAmount) {
            // If we have a quote, use the exact amount from the quote to avoid precision mismatches
            if (quote) {
              parsedClientAssetAmount = getQuoteToAmount(quote)
            } else {
              parsedClientAssetAmount = Math.round(
                parseFloat(clientAssetAmount) * Math.pow(10, precision)
              )
            }
          }
          const parsedTotalAssetAmount = totalAssetAmount
            ? Math.round(parseFloat(totalAssetAmount) * Math.pow(10, precision))
            : 0

          // Only include if we have a valid quote when buying assets
          if (parsedClientAssetAmount > 0 && !quote) {
            // Wait for quote to be fetched
            return
          }

          request.asset_id = assetId

          if (parsedClientAssetAmount > 0 && quote) {
            request.client_asset_amount = parsedClientAssetAmount
            request.rfq_id = quote.rfq_id
          }

          // Calculate LSP asset amount: total capacity - client amount
          const parsedLspAssetAmount =
            parsedTotalAssetAmount - parsedClientAssetAmount
          if (parsedLspAssetAmount > 0) {
            request.lsp_asset_amount = parsedLspAssetAmount
          }
        }

        const response = await estimateFeesRequest(request)

        if (response.data) {
          setFees(response.data)
        }
      } catch (error) {
        console.error('Error fetching fees:', error)
      }
    }

    const timeoutId = setTimeout(fetchFees, 500)

    return () => clearTimeout(timeoutId)
  }, [
    capacitySat,
    clientBalanceSat,
    channelExpireBlocks,
    assetId,
    clientAssetAmount,
    totalAssetAmount,
    quote,
    loading,
    estimateFeesRequest,
    nodeInfoRequest,
    addressRequest,
    assetMap,
  ])

  const onSubmit = useCallback(
    async (data: FormFields) => {
      setLoading(true)
      try {
        const nodeInfoResponse = await nodeInfoRequest()
        const addressResponse = await addressRequest()

        const clientPubKey = nodeInfoResponse.data?.pubkey
        const addressRefund = addressResponse.data?.address

        if (!clientPubKey || !addressRefund) {
          throw new Error('Could not get node information')
        }

        if (!lspOptions) {
          throw new Error('LSP options not loaded')
        }

        // Get LSP connection info and ensure we're connected to the LSP peer
        const lspInfoResponse = await getInfoRequest()
        const lspConnectionUrl = lspInfoResponse.data?.lsp_connection_url

        if (lspConnectionUrl) {
          try {
            // Extract pubkey from connection URL (format: pubkey@host:port)
            const lspPubkey = lspConnectionUrl.split('@')[0]

            // Check if we're already connected to this peer
            const peersResponse = await listPeers()
            const isConnected = peersResponse.data?.peers?.some(
              (peer: any) => peer.pubkey === lspPubkey
            )

            // Connect to LSP if not already connected
            if (!isConnected) {
              console.log('Connecting to LSP peer:', lspConnectionUrl)
              await connectPeer({
                peer_pubkey_and_addr: lspConnectionUrl,
              }).unwrap()
              console.log('Successfully connected to LSP peer')
            } else {
              console.log('Already connected to LSP peer')
            }
          } catch (peerError) {
            console.error('Error connecting to LSP peer:', peerError)
            throw new Error(
              'Failed to connect to LSP. Please check your connection and try again.',
              { cause: peerError }
            )
          }
        }

        const parsedCapacity = parseInt(
          data.capacitySat.replace(/[^0-9]/g, ''),
          10
        )
        const parsedClientBalance = parseInt(
          data.clientBalanceSat.replace(/[^0-9]/g, ''),
          10
        )

        // Validate that selected asset is supported by LSP
        if (data.assetId && !assetMap[data.assetId]) {
          throw new Error(
            'The selected asset is not supported by this LSP. Please refresh and select a supported asset.'
          )
        }

        let parsedClientAssetAmount = 0
        let parsedTotalAssetAmount = 0
        if (data.assetId && assetMap[data.assetId]) {
          const precision = assetMap[data.assetId].precision
          if (data.clientAssetAmount) {
            // If we have a quote, use the exact amount from the quote to avoid precision mismatches
            if (quote) {
              parsedClientAssetAmount = getQuoteToAmount(quote)
            } else {
              parsedClientAssetAmount = Math.round(
                parseFloat(data.clientAssetAmount) * Math.pow(10, precision)
              )
            }
          }
          if (data.totalAssetAmount) {
            parsedTotalAssetAmount = Math.round(
              parseFloat(data.totalAssetAmount) * Math.pow(10, precision)
            )
          }
        }

        // Validate that we have a quote if buying assets
        if (parsedClientAssetAmount > 0 && !quote) {
          throw new Error(
            'Please wait for the asset quote to load before creating the order'
          )
        }

        // Calculate LSP asset amount: total capacity - client amount
        const parsedLspAssetAmount =
          parsedTotalAssetAmount - parsedClientAssetAmount

        const validation = validateChannelParams(
          {
            addressRefund,
            assetId: data.assetId,
            capacitySat: parsedCapacity,
            channelExpireBlocks: data.channelExpireBlocks,
            clientBalanceSat: parsedClientBalance,
            clientPubKey,
            lspAssetAmount: parsedTotalAssetAmount,
            lspOptions,
          },
          Object.values(assetMap),
          effectiveMinCapacity,
          effectiveMaxCapacity
        )

        if (!validation.isValid) {
          throw new Error(validation.error)
        }

        const payload = buildChannelOrderPayload({
          addressRefund,
          assetId: data.assetId || undefined,
          capacitySat: parsedCapacity,
          channelExpireBlocks: data.channelExpireBlocks,
          clientAssetAmount: parsedClientAssetAmount || undefined,
          clientBalanceSat: parsedClientBalance,
          clientPubKey,
          lspAssetAmount:
            parsedLspAssetAmount > 0 ? parsedLspAssetAmount : undefined,
          lspOptions,
          rfqId: quote?.rfq_id,
        })

        const channelResponse = await createOrderRequest(payload)

        if (channelResponse.error) {
          const errorMessage = formatRtkQueryError(channelResponse.error as any)
          throw new Error(errorMessage)
        }

        const orderId = channelResponse.data?.order_id
        if (!orderId) {
          throw new Error(t('buyChannel.orderIdMissing'))
        }

        setOrderId(orderId)
        setAccessToken(channelResponse.data?.access_token || null)
        setOrderPayload(payload)
        setOrder(channelResponse.data as Lsps1CreateOrderResponse)
        setStep(2)
      } catch (error) {
        toast.error(
          error instanceof Error && error.message
            ? error.message
            : t('buyChannel.createOrderError')
        )
      } finally {
        setLoading(false)
      }
    },
    [
      nodeInfoRequest,
      addressRequest,
      createOrderRequest,
      lspOptions,
      assetMap,
      effectiveMinCapacity,
      effectiveMaxCapacity,
      quote,
      getInfoRequest,
      listPeers,
      connectPeer,
      t,
    ]
  )

  // Handle wallet payment
  const handleWalletPayment = async (method: 'lightning' | 'onchain') => {
    setIsProcessingWalletPayment(true)
    try {
      if (method === 'lightning' && order?.payment?.bolt11) {
        const result = await sendPayment({
          invoice: order.payment.bolt11.invoice,
        })

        if ('error' in result) {
          const error = result.error as NodeApiError
          throw new Error(error.data.error)
        }

        const response = result.data as SendPaymentResponse

        if (response.status === 'Failed') {
          throw new Error(t('buyChannel.lightningPaymentFailed'))
        }

        toast.success(t('buyChannel.lightningPaymentSuccess'))
        markPaymentReceived('lightning')

        // Save order to database immediately after successful payment
        if (orderId && orderPayload) {
          try {
            await persistChannelOrder({
              order,
              orderId,
              orderPayload,
            })
          } catch (dbError) {
            console.error('Error saving order to database:', dbError)
            // Don't throw here - payment was successful, just log the error
          }
        }
      } else if (method === 'onchain' && order?.payment?.onchain) {
        const feeRate =
          selectedFee === 'custom'
            ? customFee
            : feeRates.find((rate) => rate.value === selectedFee)?.rate || 1

        const result = await sendBtc({
          address: order.payment.onchain.address,
          amount: order.payment.onchain.order_total_sat,
          fee_rate: Math.round(feeRate),
        })

        if ('error' in result) {
          const error = result.error as NodeApiError
          throw new Error(error.data.error)
        }

        toast.success(t('buyChannel.onchainPaymentSuccess'))
        markPaymentReceived('onchain')

        // Save order to database immediately after successful payment
        if (orderId && orderPayload) {
          try {
            await persistChannelOrder({
              order,
              orderId,
              orderPayload,
            })
          } catch (dbError) {
            console.error('Error saving order to database:', dbError)
            // Don't throw here - payment was successful, just log the error
          }
        }
      }

      setShowWalletConfirmation(false)
    } catch (error) {
      const errorMessage =
        error instanceof Error && error.message
          ? error.message
          : t('buyChannel.unknownError')
      toast.error(t('buyChannel.paymentFailed', { error: errorMessage }))
      setPaymentStatus('error')
    } finally {
      setIsProcessingWalletPayment(false)
    }
  }

  const handlePaymentExpiry = useCallback(() => {
    setPaymentStatus('expired')
  }, [setPaymentStatus])

  const handleClose = useCallback(() => {
    setStep(1)
    setOrderId(null)
    setAccessToken(null)
    resetPaymentMonitor()
    resetQuote()
    onClose()
  }, [onClose, resetPaymentMonitor, resetQuote])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto px-4 py-8 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div
        className={`relative bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl border border-border-subtle/50 shadow-2xl w-full ${
          step === 2 ? 'max-w-6xl' : 'max-w-2xl'
        } max-h-full overflow-y-auto flex flex-col`}
        ref={modalShellRef}
      >
        {loading && (
          <div className="absolute inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50 rounded-2xl">
            <ClipLoader color={'#3b82f6'} loading={loading} size={50} />
          </div>
        )}

        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-gray-900 to-gray-950 border-b border-border-subtle/50 p-6 flex items-center justify-between z-10 shrink-0">
          <div>
            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
              {step === 1
                ? channelType === 'asset'
                  ? t('components.buyChannelModal.openAssetLightningChannel')
                  : t('components.buyChannelModal.openBtcLightningChannel')
                : step === 2
                  ? t('components.buyChannelModal.completePayment')
                  : t('components.buyChannelModal.orderStatus')}
            </h2>
            <p className="text-content-secondary mt-1">
              {step === 1
                ? t('components.buyChannelModal.configureChannel')
                : step === 2
                  ? t('components.buyChannelModal.payForChannel')
                  : paymentStatus === 'success'
                    ? t('components.buyChannelModal.orderCompleted')
                    : t('components.buyChannelModal.orderStatusSubtitle')}
            </p>
          </div>
          <button
            className="p-2 hover:bg-surface-overlay rounded-lg transition-colors"
            onClick={handleClose}
          >
            <X className="w-6 h-6 text-content-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto min-h-0">
          {step === 2 && order ? (
            <div className="space-y-4">
              {paymentReceived && isProcessingPayment ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <ClipLoader color="#3b82f6" size={40} />
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-white mb-1">
                      {t('components.buyChannelModal.processingPaymentTitle')}
                    </h3>
                    <p className="text-content-secondary text-sm">
                      {t(
                        'components.buyChannelModal.processingPaymentDescription'
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                    <div className="flex flex-col gap-4">
                      {orderId && (
                        <OrderIdCard
                          copyLabel={t('copyId', 'Copy ID')}
                          onCopy={() =>
                            toast.success(t('buyChannel.copySuccess'))
                          }
                          orderId={orderId}
                        />
                      )}
                      <OrderSummary
                        assetMap={assetMap}
                        fees={fees}
                        orderPayload={orderPayload}
                        quote={quote}
                      />
                    </div>

                    <div className="rounded-[24px] border border-border-subtle bg-surface-base/80 p-5 shadow-[0_18px_60px_rgba(2,6,23,0.35)] md:p-6">
                      <PaymentSection
                        amountDisplay={`${formatNumberWithCommas(
                          order.payment?.bolt11?.order_total_sat ||
                            order.payment?.onchain?.order_total_sat ||
                            0
                        )} sats`}
                        countdown={
                          order.payment?.bolt11?.expires_at ||
                          order.payment?.onchain?.expires_at ? (
                            <CountdownTimer
                              expiresAt={
                                order.payment?.bolt11?.expires_at ||
                                order.payment?.onchain?.expires_at
                              }
                              onExpiry={handlePaymentExpiry}
                            />
                          ) : undefined
                        }
                        onCopy={() =>
                          toast.success(t('buyChannel.copySuccess'))
                        }
                        paymentData={order.payment}
                        walletSection={
                          <WalletFundsCard
                            actionLabel={t(
                              'components.buyChannelModal.payWithWallet'
                            )}
                            balances={[
                              ...(order.payment?.bolt11
                                ? [
                                    {
                                      label: t('buyChannel.lightning'),
                                      value: `${formatNumberWithCommas(
                                        outboundLiquidity
                                      )} sats`,
                                    },
                                  ]
                                : []),
                              ...(order.payment?.onchain
                                ? [
                                    {
                                      label: t('buyChannel.onchain'),
                                      value: `${formatNumberWithCommas(
                                        onChainBalance
                                      )} sats`,
                                    },
                                  ]
                                : []),
                            ]}
                            description={t(
                              'components.buyChannelModal.walletDescription'
                            )}
                            isLoading={isLoadingData}
                            loadingLabel={t(
                              'components.buyChannelModal.loadingBalance'
                            )}
                            onAction={() => setShowWalletConfirmation(true)}
                            title={t(
                              'components.buyChannelModal.payWithWallet'
                            )}
                          />
                        }
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : step === 3 && paymentStatus ? (
            <StatusScreen
              onClose={handleClose}
              onRetry={() => {
                setStep(1)
                setOrderId(null)
                setAccessToken(null)
                resetPaymentMonitor()
                resetQuote()
              }}
              orderId={orderId}
              status={paymentStatus}
            />
          ) : step === 1 ? (
            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
              {/* Channel Type Toggle */}
              {Object.keys(assetMap).length > 0 && (
                <div className="flex gap-1.5 p-1 bg-surface-overlay rounded-xl">
                  <button
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                      channelType === 'btc'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'text-content-secondary hover:text-content-primary'
                    }`}
                    onClick={() => {
                      setChannelType('btc')
                      setValue('assetId', '')
                      setValue('clientAssetAmount', '')
                      setValue('totalAssetAmount', '0')
                    }}
                    type="button"
                  >
                    <img alt="BTC" className="w-4 h-4" src={bitcoinLogo} />
                    BTC Only
                  </button>
                  <button
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                      channelType === 'asset'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'text-content-secondary hover:text-content-primary'
                    }`}
                    onClick={() => {
                      setChannelType('asset')
                      const firstId =
                        preselectedAsset?.assetId || Object.keys(assetMap)[0]
                      setValue('assetId', firstId)
                    }}
                    type="button"
                  >
                    <img alt="BTC" className="w-4 h-4" src={bitcoinLogo} />
                    BTC +
                    <img alt="RGB" className="w-4 h-4" src={rgbIcon} />
                    RGB Asset
                  </button>
                </div>
              )}

              {/* Asset selector — shown when asset mode and multiple assets available */}
              {channelType === 'asset' && Object.keys(assetMap).length > 1 && (
                <div>
                  <p className="text-[11px] font-semibold text-content-secondary uppercase tracking-wider mb-2">
                    {t('channelConfiguration.assetSection.chooseAsset')}
                  </p>
                  <AssetSelectWithModal
                    className="w-full"
                    fieldLabel={t(
                      'channelConfiguration.assetSection.chooseAsset'
                    )}
                    onChange={(value) => {
                      setValue('assetId', value)
                      setValue('clientAssetAmount', '')
                      setValue('totalAssetAmount', '0')
                    }}
                    options={Object.entries(assetMap).map(([id, info]) => ({
                      assetId: id,
                      label: info.name,
                      name: info.name,
                      ticker: info.ticker,
                      value: id,
                    }))}
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
              )}

              {/* BTC Liquidity slider (bar + slider merged) */}
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
                title="BTC Liquidity"
                tone="amber"
              >
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-content-secondary">
                    Channel capacity
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {CAPACITY_PRESETS.filter(
                      (p) =>
                        p >= effectiveMinCapacity && p <= effectiveMaxCapacity
                    ).map((preset) => (
                      <button
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                          currentCapacity === preset && !showCustomInput
                            ? 'bg-primary/20 text-primary border-primary/50'
                            : 'bg-surface-overlay text-content-secondary border-transparent hover:border-border-default hover:text-content-primary'
                        }`}
                        key={preset}
                        onClick={() => {
                          setShowCustomInput(false)
                          setValue('capacitySat', preset.toString())
                          if (btcOut >= preset) {
                            setValue(
                              'clientBalanceSat',
                              Math.floor(preset * 0.2).toString()
                            )
                          }
                        }}
                        type="button"
                      >
                        {preset >= 1_000_000
                          ? `${preset / 1_000_000}M`
                          : `${preset / 1000}K`}
                      </button>
                    ))}
                    <button
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        showCustomInput || isCustomCapacity
                          ? 'bg-primary/20 text-primary border-primary/50'
                          : 'bg-surface-overlay text-content-secondary border-transparent hover:border-border-default hover:text-content-primary'
                      }`}
                      onClick={() => setShowCustomInput(true)}
                      type="button"
                    >
                      Custom
                    </button>
                  </div>
                  {(showCustomInput || isCustomCapacity) && (
                    <input
                      className="w-full px-3 py-2 bg-surface-overlay/50 rounded-xl border border-border-default focus:border-primary text-white text-sm"
                      max={effectiveMaxCapacity}
                      min={effectiveMinCapacity}
                      onChange={(e) => setValue('capacitySat', e.target.value)}
                      placeholder={`${effectiveMinCapacity} – ${effectiveMaxCapacity} sats`}
                      type="number"
                      value={currentCapacity}
                    />
                  )}
                  <p className="text-[11px] text-content-tertiary">
                    Min: {formatNumberWithCommas(effectiveMinCapacity)} · Max:{' '}
                    {formatNumberWithCommas(effectiveMaxCapacity)} sats
                  </p>
                </div>

                <LiquiditySlider
                  inboundColor="bg-blue-400/50"
                  inboundLabel={formatNumberWithCommas(btcIn) + ' sats'}
                  inputHint="Type the exact BTC amount you want available to send right away."
                  max={Math.min(
                    currentCapacity,
                    lspOptions?.max_initial_client_balance_sat ||
                      currentCapacity
                  )}
                  min={lspOptions?.min_initial_client_balance_sat || 0}
                  onChange={(val) =>
                    setValue('clientBalanceSat', Math.round(val).toString())
                  }
                  outboundColor="bg-amber-400"
                  outboundLabel={formatNumberWithCommas(btcOut) + ' sats'}
                  thumbBorderClass="border-amber-400"
                  value={btcOut}
                />
              </LiquidityCard>

              {/* Asset Liquidity */}
              {channelType === 'asset' && assetId && assetMap[assetId] && (
                <LiquidityCard
                  icon={<img alt="RGB" className="h-5 w-5" src={rgbIcon} />}
                  meta={
                    <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-right">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-100/70">
                        Asset capacity
                      </div>
                      <div className="mt-0.5 text-sm font-semibold text-cyan-50">
                        {usdtTotal.toFixed(2)} {assetMap[assetId].ticker}
                      </div>
                    </div>
                  }
                  title={`${assetMap[assetId].name} (${assetMap[assetId].ticker})`}
                  tone="cyan"
                >
                  {/* Total capacity presets */}
                  <div>
                    <p className="text-[11px] font-semibold text-content-secondary uppercase tracking-wider mb-2">
                      Total Capacity
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {assetPresetsCalc.map((preset) => (
                        <button
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            Math.abs(usdtTotal - preset) < 0.001 &&
                            !showCustomAssetCapacity
                              ? 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/50'
                              : 'bg-surface-overlay text-content-secondary border border-border-subtle hover:border-cyan-400/30 hover:text-content-primary'
                          }`}
                          key={preset}
                          onClick={() => {
                            setShowCustomAssetCapacity(false)
                            setValue('totalAssetAmount', preset.toString())
                            if (usdtOut > preset)
                              setValue('clientAssetAmount', preset.toString())
                          }}
                          type="button"
                        >
                          {preset >= 1000
                            ? `${(preset / 1000).toFixed(1)}K`
                            : preset.toFixed(
                                assetMap[assetId].precision > 0 ? 2 : 0
                              )}{' '}
                          {assetMap[assetId].ticker}
                        </button>
                      ))}
                      <button
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          showCustomAssetCapacity || isCustomAssetTotal
                            ? 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/50'
                            : 'bg-surface-overlay text-content-secondary border border-border-subtle hover:border-cyan-400/30 hover:text-content-primary'
                        }`}
                        onClick={() => setShowCustomAssetCapacity((v) => !v)}
                        type="button"
                      >
                        Custom
                      </button>
                    </div>
                    {(showCustomAssetCapacity || isCustomAssetTotal) && (
                      <input
                        className="mt-2 w-full px-3 py-2 bg-surface-overlay rounded-xl border border-border-default focus:border-cyan-400 text-white text-sm outline-none"
                        max={assetMax}
                        min={0}
                        onChange={(e) => {
                          setValue('totalAssetAmount', e.target.value)
                          const newTotal = parseFloat(e.target.value) || 0
                          if (usdtOut > newTotal)
                            setValue('clientAssetAmount', e.target.value)
                        }}
                        placeholder={`Custom (${assetMap[assetId].ticker})`}
                        step={1 / assetFactor}
                        type="number"
                        value={totalAssetAmount}
                      />
                    )}
                  </div>

                  {/* Asset liquidity slider (bar + slider merged) */}
                  <LiquiditySlider
                    inboundColor="bg-sky-400/35"
                    inboundLabel={`${usdtIn.toFixed(2)} ${assetMap[assetId].ticker}`}
                    inputFocusClass="focus:border-cyan-400"
                    inputHint={`Type the exact ${assetMap[assetId].ticker} amount you want available immediately.`}
                    inputLabel="Available to send now"
                    inputTextClass="text-cyan-300"
                    max={usdtTotal || assetMax}
                    min={0}
                    onChange={(val) =>
                      setValue('clientAssetAmount', val.toString())
                    }
                    outboundColor="bg-cyan-400"
                    outboundLabel={`${usdtOut.toFixed(2)} ${assetMap[assetId].ticker}`}
                    step={1 / assetFactor}
                    thumbBorderClass="border-cyan-300"
                    unit={assetMap[assetId].ticker}
                    value={usdtOut}
                  />
                </LiquidityCard>
              )}

              {/* Quote Display */}
              {shouldFetchQuote && (
                <QuoteDisplay
                  assetInfo={assetMap[assetId] || null}
                  quote={quote}
                  quoteError={quoteError}
                  quoteLoading={quoteLoading}
                />
              )}

              {/* Channel Duration */}
              {channelType === 'asset' && assetId && assetMap[assetId] && (
                <ChannelDurationSelector
                  control={control}
                  maxExpiryBlocks={lspOptions?.max_channel_expiry_blocks}
                  onChange={(value) => setValue('channelExpireBlocks', value)}
                  value={channelExpireBlocks}
                />
              )}

              {/* Confirmation notice */}
              <div className="flex items-start gap-2 p-3 rounded-xl bg-surface-overlay/30 border border-border-subtle">
                <Clock className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-yellow-200/80 text-xs">
                  Channel requires ~6 on-chain confirmations (~1 hour). Your
                  liquidity will be ready to trade once confirmed.
                </p>
              </div>

              {/* Fee Display */}
              {fees && (
                <FeeBreakdownDisplay
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
                          {
                            amount: parseInt(
                              clientBalanceSat.replace(/[^0-9]/g, '') || '0'
                            ),
                            label: t(
                              'components.buyChannelModal.yourLiquidity'
                            ),
                          },
                        ]
                      : []),
                  ]}
                  fees={fees}
                  showGrandTotal={true}
                />
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  className="flex-1 px-4 py-2.5 bg-surface-high hover:bg-surface-elevated text-white rounded-xl font-medium transition-colors text-sm"
                  onClick={handleClose}
                  type="button"
                >
                  {t('components.buyChannelModal.cancel')}
                </button>
                <button
                  className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary-emphasis text-[#12131C] rounded-xl font-medium transition-colors text-sm disabled:bg-content-tertiary disabled:text-content-primary/70 disabled:cursor-not-allowed"
                  disabled={
                    loading ||
                    (shouldFetchQuote &&
                      (quoteLoading || (!quote && !quoteError)))
                  }
                  type="submit"
                >
                  {quoteLoading && shouldFetchQuote
                    ? t('components.buyChannelModal.loadingQuote')
                    : t('components.buyChannelModal.continue')}
                </button>
              </div>
            </form>
          ) : null}

          <WalletConfirmationModal
            bitcoinUnit={bitcoinUnit}
            customFee={customFee}
            isOpen={showWalletConfirmation}
            isProcessing={isProcessingWalletPayment}
            lightningAmountSat={order?.payment?.bolt11?.order_total_sat || 0}
            onChainBalance={onChainBalance}
            onClose={() => setShowWalletConfirmation(false)}
            onCustomFeeChange={setCustomFee}
            onFeeChange={setSelectedFee}
            onPay={handleWalletPayment}
            onchainAmountSat={order?.payment?.onchain?.order_total_sat || 0}
            outboundLiquidity={outboundLiquidity}
            selectedFee={selectedFee}
          />
        </div>
      </div>
    </div>
  )
}
