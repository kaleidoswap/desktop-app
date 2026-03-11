import { invoke } from '@tauri-apps/api/core'
import { X, Info, Clock, Zap, Rocket, Settings } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ClipLoader } from 'react-spinners'
import { toast } from 'react-toastify'

import { useSettings } from '../../hooks/useSettings'
import { MIN_CHANNEL_CAPACITY, MAX_CHANNEL_CAPACITY } from '../../constants'
import { formatNumberWithCommas } from '../../helpers/number'
import { WalletConfirmationModal } from '../../routes/order-new-channel/components'
import {
  makerApi,
  ChannelFees,
  Lsps1CreateOrderResponse,
  QuoteResponse,
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
import {
  FeeBreakdownDisplay,
  ChannelDurationSelector,
} from '../ChannelConfiguration'

import { LiquidityBar } from '../../routes/trade/dca/components/LiquidityBar'
import { AssetSelectWithModal } from '../Trade/AssetSelectWithModal'
import bitcoinLogo from '../../assets/bitcoin-logo.svg'
import rgbIcon from '../../assets/rgb-symbol-color.svg'

import {
  QuoteDisplay,
  OrderSummary,
  PaymentSection,
  StatusScreen,
} from './components'

interface BuyChannelModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  preselectedAsset?: {
    assetId: string
    amount: number
  }
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

const getFeeIcon = (type: string) => {
  switch (type) {
    case 'slow':
      return <Clock className="w-4 h-4" />
    case 'fast':
      return <Rocket className="w-4 h-4" />
    case 'custom':
      return <Settings className="w-4 h-4" />
    default:
      return <Zap className="w-4 h-4" />
  }
}

export const BuyChannelModal: React.FC<BuyChannelModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedAsset,
}) => {
  const { t } = useTranslation()
  const { bitcoinUnit } = useSettings()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [orderPayload, setOrderPayload] = useState<any>(null)
  const [paymentStatus, setPaymentStatus] = useState<
    'success' | 'error' | 'expired' | null
  >(null)
  const [paymentReceived, setPaymentReceived] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess

  const [assetMap, setAssetMap] = useState<Record<string, AssetInfo>>({})
  const [lspOptions, setLspOptions] = useState<LspOptions | null>(null)
  const [effectiveMinCapacity, setEffectiveMinCapacity] =
    useState<number>(MIN_CHANNEL_CAPACITY)
  const [effectiveMaxCapacity, setEffectiveMaxCapacity] =
    useState<number>(MAX_CHANNEL_CAPACITY)
  const [fees, setFees] = useState<ChannelFees | null>(null)
  const [order, setOrder] = useState<Lsps1CreateOrderResponse | null>(null)
  const [paymentMethodTab, setPaymentMethodTab] = useState<
    'lightning' | 'onchain'
  >('lightning')
  const [quote, setQuote] = useState<QuoteResponse | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)

  // Wallet payment state
  const [useWalletFunds, setUseWalletFunds] = useState(true)
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
  const [getQuote] = makerApi.endpoints.getQuote.useLazyQuery()
  const [listPeers] = nodeApi.endpoints.listPeers.useLazyQuery()
  const [connectPeer] = nodeApi.endpoints.connectPeer.useMutation()

  const { handleSubmit, setValue, control, watch } = useForm<FormFields>({
    defaultValues: {
      assetId: preselectedAsset?.assetId || '',
      capacitySat: '100000',
      channelExpireBlocks: 12960,
      clientAssetAmount: preselectedAsset
        ? preselectedAsset.amount.toString()
        : '',
      clientBalanceSat: '20000',
      totalAssetAmount: '0',
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
      setChannelType('asset')
    } else if (!isOpen) {
      setChannelType(preselectedAsset ? 'asset' : 'btc')
      setShowCustomInput(false)
    }
  }, [preselectedAsset, isOpen, setValue])

  // Calculate available liquidity
  const channels =
    listChannelsResponse?.data?.channels?.filter((channel) => channel.ready) ||
    []
  const outboundLiquidity =
    channels.length > 0
      ? Math.max(
        ...channels.map(
          (channel) => (channel.next_outbound_htlc_limit_msat || 0) / 1000
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

  const assetId = watch('assetId')
  const capacitySat = watch('capacitySat')
  const clientBalanceSat = watch('clientBalanceSat')
  const channelExpireBlocks = watch('channelExpireBlocks')
  const clientAssetAmount = watch('clientAssetAmount')
  const totalAssetAmount = watch('totalAssetAmount')

  const CAPACITY_PRESETS = [50000, 100000, 500000, 1000000, 10000000]
  const currentCapacity = parseInt(capacitySat.replace(/[^0-9]/g, ''), 10) || 100000
  const isCustomCapacity = !CAPACITY_PRESETS.includes(currentCapacity)
  const btcOut = parseInt(clientBalanceSat.replace(/[^0-9]/g, ''), 10) || 0
  const btcIn = Math.max(0, currentCapacity - btcOut)
  const usdtOut = parseFloat(clientAssetAmount) || 0
  const usdtTotal = parseFloat(totalAssetAmount) || 0
  const usdtIn = Math.max(0, usdtTotal - usdtOut)

  // Asset-specific derived values
  const assetFactor = assetId && assetMap[assetId] ? Math.pow(10, assetMap[assetId].precision) : 1
  const assetMax = assetId && assetMap[assetId] ? assetMap[assetId].max_channel_amount / assetFactor : 0
  const assetPresetsCalc = assetMax > 0
    ? [0.25, 0.5, 0.75, 1.0].map(p => Math.round(assetMax * p * assetFactor) / assetFactor)
    : []
  const isCustomAssetTotal = assetPresetsCalc.length > 0 && usdtTotal > 0 &&
    !assetPresetsCalc.some(p => Math.abs(p - usdtTotal) < 0.001)

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
      } catch (error) {
        toast.error(t('buyChannel.lspFetchError'))
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [getInfoRequest, isOpen])

  // Fetch quote when user wants to buy assets
  useEffect(() => {
    const fetchQuote = async () => {
      // Only fetch quote if user is buying assets (client_asset_amount > 0)
      if (
        !assetId ||
        !clientAssetAmount ||
        parseFloat(clientAssetAmount) <= 0
      ) {
        setQuote(null)
        setQuoteError(null)
        return
      }

      // Don't fetch a new quote if we're currently submitting the order
      if (loading) {
        return
      }

      const precision = assetMap[assetId]?.precision || 0
      const parsedAssetAmount = Math.round(
        parseFloat(clientAssetAmount) * Math.pow(10, precision)
      )

      if (parsedAssetAmount <= 0) {
        setQuote(null)
        return
      }

      setQuoteLoading(true)
      setQuoteError(null)

      try {
        // Request quote from BTC to Asset
        const quoteRequest: any = {
          from_asset: {
            asset_id: 'BTC',
            layer: 'BTC_LN', // Default to LN
          },
          to_asset: {
            asset_id: assetId,
            layer: 'RGB_LN', // Default to RGB LN for now
            amount: parsedAssetAmount,
          },
        }

        const response = await getQuote(quoteRequest)

        if (response.error) {
          const errorMessage =
            typeof response.error === 'object' &&
              response.error &&
              'error' in response.error &&
              typeof (response.error as any).error === 'string'
              ? (response.error as any).error
              : 'Failed to get quote'
          setQuoteError(errorMessage)
          setQuote(null)
        } else if (response.data) {
          setQuote(response.data)
          setQuoteError(null)
        }
      } catch (error) {
        console.error('Error fetching quote:', error)
        setQuoteError('Failed to get quote. Please try again.')
        setQuote(null)
      } finally {
        setQuoteLoading(false)
      }
    }

    const timeoutId = setTimeout(fetchQuote, 500)

    return () => clearTimeout(timeoutId)
  }, [assetId, clientAssetAmount, loading, getQuote, assetMap])

  // Auto-refresh quote before it expires
  useEffect(() => {
    if (
      !quote ||
      !assetId ||
      !clientAssetAmount ||
      parseFloat(clientAssetAmount) <= 0
    ) {
      return
    }

    const now = Date.now()
    const expiresAt = quote.expires_at * 1000
    const timeUntilExpiry = expiresAt - now

    // Refresh 10 seconds before expiry or immediately if already expired
    const refreshTime = Math.max(0, timeUntilExpiry - 10000)

    const timeoutId = setTimeout(async () => {
      if (!assetMap[assetId]) return

      const precision = assetMap[assetId].precision
      const parsedAssetAmount = Math.round(
        parseFloat(clientAssetAmount) * Math.pow(10, precision)
      )

      if (parsedAssetAmount <= 0) return

      setQuoteLoading(true)
      try {
        const quoteRequest: any = {
          from_asset: {
            asset_id: 'BTC',
            layer: 'BTC_LN',
          },
          to_asset: {
            asset_id: assetId,
            layer: 'RGB_LN',
            amount: parsedAssetAmount,
          },
        }

        const response = await getQuote(quoteRequest)

        if (response.error) {
          const errorMessage =
            typeof response.error === 'object' &&
              response.error &&
              'error' in response.error &&
              typeof (response.error as any).error === 'string'
              ? (response.error as any).error
              : 'Failed to refresh quote'
          setQuoteError(errorMessage)
          setQuote(null)
        } else if (response.data) {
          setQuote(response.data)
          setQuoteError(null)
        }
      } catch (error) {
        console.error('Error refreshing quote:', error)
      } finally {
        setQuoteLoading(false)
      }
    }, refreshTime)

    return () => clearTimeout(timeoutId)
  }, [quote, assetId, clientAssetAmount, getQuote, assetMap])

  // Poll for order status when on payment step
  useEffect(() => {
    if (orderId && step === 2) {
      const intervalId = setInterval(async () => {
        const orderResponse = await getOrderRequest({ order_id: orderId })
        const orderData = orderResponse.data

        const bolt11State = orderData?.payment?.bolt11?.state
        const onchainState = orderData?.payment?.onchain?.state

        let actualPaymentState = null

        if (bolt11State && ['HOLD', 'PAID'].includes(bolt11State)) {
          actualPaymentState = bolt11State
        } else if (onchainState && ['HOLD', 'PAID'].includes(onchainState)) {
          actualPaymentState = onchainState
        } else {
          actualPaymentState = bolt11State || onchainState
        }

        const paymentJustReceived =
          actualPaymentState &&
          ['HOLD', 'PAID'].includes(actualPaymentState) &&
          !paymentReceived

        if (paymentJustReceived) {
          setPaymentReceived(true)
          setIsProcessingPayment(true)

          if (orderPayload) {
            try {
              await invoke('insert_channel_order', {
                createdAt: orderData?.created_at || new Date().toISOString(),
                orderId: orderId,
                payload: JSON.stringify(orderPayload),
                status: orderData?.order_state || 'paid',
              })
            } catch (error) {
              console.error('Error saving order to database:', error)
            }
          }
        }

        if (orderData?.order_state === 'COMPLETED') {
          clearInterval(intervalId)
          setIsProcessingPayment(false)
          setPaymentStatus('success')
          setStep(3)
          if (onSuccessRef.current) {
            setTimeout(onSuccessRef.current, 2000)
          }
        } else if (orderData?.order_state === 'FAILED') {
          const now = new Date().getTime()
          const bolt11ExpiresAt = orderData?.payment?.bolt11?.expires_at
            ? new Date(orderData.payment.bolt11.expires_at).getTime()
            : 0
          const onchainExpiresAt = orderData?.payment?.onchain?.expires_at
            ? new Date(orderData.payment.onchain.expires_at).getTime()
            : 0

          const noPaymentMadeStates = ['EXPECT_PAYMENT', 'TIMEOUT', 'EXPIRED']
          const bolt11NoPayment = bolt11State
            ? noPaymentMadeStates.includes(bolt11State)
            : true
          const onchainNoPayment = onchainState
            ? noPaymentMadeStates.includes(onchainState)
            : true

          const noPaymentMade = bolt11NoPayment && onchainNoPayment
          const isPastExpiry =
            (bolt11ExpiresAt > 0 && now > bolt11ExpiresAt) ||
            (onchainExpiresAt > 0 && now > onchainExpiresAt)

          clearInterval(intervalId)
          setIsProcessingPayment(false)
          setPaymentStatus(noPaymentMade || isPastExpiry ? 'expired' : 'error')
          setStep(3)
        }
      }, 5000)

      return () => clearInterval(intervalId)
    }
  }, [orderId, getOrderRequest, step, paymentReceived, orderPayload])

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
            if (quote && (quote.to_asset?.amount || (quote as any).to_amount)) {
              parsedClientAssetAmount =
                quote.to_asset?.amount || (quote as any).to_amount
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
              (peer) => peer.pubkey === lspPubkey
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
              'Failed to connect to LSP. Please check your connection and try again.'
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
            if (quote && (quote.to_asset?.amount || (quote as any).to_amount)) {
              parsedClientAssetAmount =
                quote.to_asset?.amount || (quote as any).to_amount
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
    ]
  )

  // Handle wallet payment
  const handleWalletPayment = async () => {
    setIsProcessingWalletPayment(true)
    try {
      if (paymentMethodTab === 'lightning' && order?.payment?.bolt11) {
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
        setPaymentReceived(true)
        setIsProcessingPayment(true)

        // Save order to database immediately after successful payment
        if (orderId && orderPayload) {
          try {
            await invoke('insert_channel_order', {
              createdAt: order.created_at || new Date().toISOString(),
              orderId: orderId,
              payload: JSON.stringify(orderPayload),
              status: 'paid',
            })
          } catch (dbError) {
            console.error('Error saving order to database:', dbError)
            // Don't throw here - payment was successful, just log the error
          }
        }
      } else if (paymentMethodTab === 'onchain' && order?.payment?.onchain) {
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
        setPaymentReceived(true)
        setIsProcessingPayment(true)

        // Save order to database immediately after successful payment
        if (orderId && orderPayload) {
          try {
            await invoke('insert_channel_order', {
              createdAt: order.created_at || new Date().toISOString(),
              orderId: orderId,
              payload: JSON.stringify(orderPayload),
              status: 'paid',
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

  const handleClose = useCallback(() => {
    setStep(1)
    setOrderId(null)
    setPaymentStatus(null)
    setPaymentReceived(false)
    setIsProcessingPayment(false)
    setQuote(null)
    setQuoteError(null)
    setQuoteLoading(false)
    onClose()
  }, [onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl border border-border-subtle/50 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {loading && (
          <div className="absolute inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50 rounded-2xl">
            <ClipLoader color={'#3b82f6'} loading={loading} size={50} />
          </div>
        )}

        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-gray-900 to-gray-950 border-b border-border-subtle/50 p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
              {step === 1
                ? channelType === 'asset'
                  ? 'Open Asset Lightning Channel'
                  : 'Open BTC Lightning Channel'
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
        <div className="p-6">
          {step === 2 && order ? (
            <div className="space-y-4">
              {paymentReceived && isProcessingPayment ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <ClipLoader color="#3b82f6" size={40} />
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-white mb-1">
                      Processing Payment
                    </h3>
                    <p className="text-content-secondary text-sm">
                      Payment received, setting up your channel…
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Channel summary */}
                  <OrderSummary
                    assetMap={assetMap}
                    fees={fees}
                    orderPayload={orderPayload}
                    quote={quote}
                  />

                  {/* Payment source selector */}
                  <div className="flex gap-1.5 p-1 bg-surface-overlay rounded-xl">
                    <button
                      type="button"
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                        useWalletFunds
                          ? 'bg-primary/20 text-primary border border-primary/50'
                          : 'text-content-secondary hover:text-content-primary'
                      }`}
                      onClick={() => setUseWalletFunds(true)}
                    >
                      💰 Use Wallet
                    </button>
                    <button
                      type="button"
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                        !useWalletFunds
                          ? 'bg-primary/20 text-primary border border-primary/50'
                          : 'text-content-secondary hover:text-content-primary'
                      }`}
                      onClick={() => setUseWalletFunds(false)}
                    >
                      📱 External Wallet
                    </button>
                  </div>

                  {useWalletFunds ? (
                    <div className="space-y-3">
                      {/* Network tabs */}
                      <div className="flex gap-1.5 p-1 bg-surface-overlay rounded-xl">
                        <button
                          type="button"
                          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                            paymentMethodTab === 'lightning'
                              ? 'bg-primary/20 text-primary border border-primary/50'
                              : 'text-content-secondary hover:text-content-primary'
                          }`}
                          onClick={() => setPaymentMethodTab('lightning')}
                        >
                          ⚡ Lightning
                        </button>
                        <button
                          type="button"
                          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                            paymentMethodTab === 'onchain'
                              ? 'bg-primary/20 text-primary border border-primary/50'
                              : 'text-content-secondary hover:text-content-primary'
                          }`}
                          onClick={() => setPaymentMethodTab('onchain')}
                        >
                          ⛓️ On-chain
                        </button>
                      </div>

                      {isLoadingData ? (
                        <div className="flex items-center justify-center gap-3 p-4">
                          <ClipLoader color="#3B82F6" size={20} />
                          <span className="text-content-secondary text-sm">
                            Loading balance…
                          </span>
                        </div>
                      ) : (
                        <>
                          {/* Balance vs amount */}
                          <div className="p-4 rounded-xl bg-surface-overlay/40 border border-border-subtle space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-content-tertiary">
                                {paymentMethodTab === 'lightning'
                                  ? 'Lightning balance'
                                  : 'On-chain balance'}
                              </span>
                              <span
                                className={`font-semibold ${
                                  (paymentMethodTab === 'lightning'
                                    ? outboundLiquidity
                                    : onChainBalance) >=
                                  (paymentMethodTab === 'lightning'
                                    ? order.payment?.bolt11?.order_total_sat || 0
                                    : order.payment?.onchain?.order_total_sat || 0)
                                    ? 'text-content-primary'
                                    : 'text-red-400'
                                }`}
                              >
                                {formatNumberWithCommas(
                                  paymentMethodTab === 'lightning'
                                    ? outboundLiquidity
                                    : onChainBalance
                                )}{' '}
                                sats
                              </span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-border-subtle">
                              <span className="text-content-secondary font-medium">
                                To pay
                              </span>
                              <span className="text-amber-300 font-bold">
                                {formatNumberWithCommas(
                                  paymentMethodTab === 'lightning'
                                    ? order.payment?.bolt11?.order_total_sat || 0
                                    : order.payment?.onchain?.order_total_sat || 0
                                )}{' '}
                                sats
                              </span>
                            </div>
                          </div>

                          {/* Insufficient warning */}
                          {((paymentMethodTab === 'lightning' &&
                            outboundLiquidity <
                              (order.payment?.bolt11?.order_total_sat || 0)) ||
                            (paymentMethodTab === 'onchain' &&
                              onChainBalance <
                                (order.payment?.onchain?.order_total_sat ||
                                  0))) && (
                            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-900/20 border border-red-700/40 text-xs">
                              <Info className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                              <span className="text-red-200/80">
                                Insufficient balance. Switch to External Wallet
                                or add funds first.
                              </span>
                            </div>
                          )}

                          {/* On-chain fee rate */}
                          {paymentMethodTab === 'onchain' && (
                            <div className="p-4 rounded-xl bg-surface-overlay/40 border border-border-subtle">
                              <p className="text-xs font-semibold text-content-secondary uppercase tracking-wider mb-3">
                                Transaction Fee Rate
                              </p>
                              <div className="grid grid-cols-4 gap-2">
                                {feeRates.map((rate) => (
                                  <button
                                    key={rate.value}
                                    type="button"
                                    className={`flex flex-col items-center gap-0.5 p-2.5 rounded-xl border transition-all ${
                                      selectedFee === rate.value
                                        ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                                        : 'border-border-default text-content-secondary hover:border-blue-500/50 hover:text-content-primary'
                                    }`}
                                    onClick={() => setSelectedFee(rate.value)}
                                  >
                                    {getFeeIcon(rate.value)}
                                    <span className="text-[11px] font-semibold mt-0.5">
                                      {rate.label}
                                    </span>
                                    {rate.value !== 'custom' && (
                                      <span className="text-[10px] opacity-60">
                                        {rate.rate} s/vB
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>
                              {selectedFee === 'custom' && (
                                <input
                                  type="number"
                                  step="0.1"
                                  value={customFee}
                                  onChange={(e) =>
                                    setCustomFee(parseFloat(e.target.value))
                                  }
                                  placeholder="Custom rate (sat/vB)"
                                  className="mt-3 w-full px-3 py-2 bg-surface-overlay/50 rounded-xl border border-border-default focus:border-blue-500 text-white text-sm"
                                />
                              )}
                            </div>
                          )}

                          {/* Pay button */}
                          <button
                            className="w-full px-6 py-3 bg-primary hover:bg-primary-emphasis text-primary-foreground rounded-xl font-bold text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={
                              (paymentMethodTab === 'lightning' &&
                                outboundLiquidity <
                                  (order.payment?.bolt11?.order_total_sat ||
                                    0)) ||
                              (paymentMethodTab === 'onchain' &&
                                onChainBalance <
                                  (order.payment?.onchain?.order_total_sat ||
                                    0))
                            }
                            onClick={() => setShowWalletConfirmation(true)}
                          >
                            {t('components.buyChannelModal.payWithWallet')}
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <PaymentSection
                      paymentData={order.payment}
                    />
                  )}
                </>
              )}
            </div>
          ) : step === 3 && paymentStatus ? (
            <StatusScreen
              onClose={handleClose}
              onRetry={() => {
                setStep(1)
                setOrderId(null)
                setPaymentStatus(null)
                setPaymentReceived(false)
                setIsProcessingPayment(false)
                setQuote(null)
                setQuoteError(null)
                setQuoteLoading(false)
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
                    type="button"
                    onClick={() => {
                      setChannelType('btc')
                      setValue('assetId', '')
                      setValue('clientAssetAmount', '')
                      setValue('totalAssetAmount', '0')
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                      channelType === 'btc'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'text-content-secondary hover:text-content-primary'
                    }`}
                  >
                    <img src={bitcoinLogo} alt="BTC" className="w-4 h-4" />
                    BTC Only
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setChannelType('asset')
                      const firstId =
                        preselectedAsset?.assetId || Object.keys(assetMap)[0]
                      setValue('assetId', firstId)
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                      channelType === 'asset'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'text-content-secondary hover:text-content-primary'
                    }`}
                  >
                    <img src={bitcoinLogo} alt="BTC" className="w-4 h-4" />
                    <span className="text-content-tertiary">+</span>
                    <img src={rgbIcon} alt="RGB" className="w-4 h-4" />
                    BTC + RGB Asset
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
                    fieldLabel={t('channelConfiguration.assetSection.chooseAsset')}
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
                    placeholder={t('channelConfiguration.assetSection.searchPlaceholder')}
                    searchPlaceholder={t('channelConfiguration.assetSection.searchPlaceholder')}
                    title={t('channelConfiguration.assetSection.selectAssetTitle')}
                    value={assetId}
                  />
                </div>
              )}

              {/* Channel Capacity */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
                  Channel Capacity
                </p>
                <div className="flex flex-wrap gap-2">
                  {CAPACITY_PRESETS.filter(
                    (p) =>
                      p >= effectiveMinCapacity && p <= effectiveMaxCapacity
                  ).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        currentCapacity === preset && !showCustomInput
                          ? 'bg-primary/20 text-primary border-primary/50'
                          : 'bg-surface-overlay text-content-secondary border-transparent hover:border-border-default hover:text-content-primary'
                      }`}
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
                    >
                      {preset >= 1_000_000
                        ? `${preset / 1_000_000}M`
                        : `${preset / 1000}K`}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                      showCustomInput || isCustomCapacity
                        ? 'bg-primary/20 text-primary border-primary/50'
                        : 'bg-surface-overlay text-content-secondary border-transparent hover:border-border-default hover:text-content-primary'
                    }`}
                    onClick={() => setShowCustomInput(true)}
                  >
                    Custom
                  </button>
                </div>
                {(showCustomInput || isCustomCapacity) && (
                  <input
                    type="number"
                    min={effectiveMinCapacity}
                    max={effectiveMaxCapacity}
                    value={currentCapacity}
                    onChange={(e) => setValue('capacitySat', e.target.value)}
                    className="w-full px-3 py-2 bg-surface-overlay/50 rounded-xl border border-border-default focus:border-primary text-white text-sm"
                    placeholder={`${effectiveMinCapacity} – ${effectiveMaxCapacity} sats`}
                  />
                )}
                <p className="text-[11px] text-content-tertiary">
                  Min: {formatNumberWithCommas(effectiveMinCapacity)} · Max:{' '}
                  {formatNumberWithCommas(effectiveMaxCapacity)} sats
                </p>
              </div>

              {/* BTC Liquidity */}
              <div className="space-y-3 p-4 rounded-xl bg-surface-overlay/30 border border-border-subtle">
                <p className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
                  BTC Liquidity
                </p>
                <LiquidityBar
                  outbound={btcOut}
                  inbound={btcIn}
                  outboundLabel={formatNumberWithCommas(btcOut) + ' sats'}
                  inboundLabel={formatNumberWithCommas(btcIn) + ' sats'}
                  outboundColor="bg-amber-400"
                  inboundColor="bg-blue-400/50"
                />
                <input
                  type="range"
                  min={lspOptions?.min_initial_client_balance_sat || 0}
                  max={Math.min(
                    currentCapacity,
                    lspOptions?.max_initial_client_balance_sat || currentCapacity
                  )}
                  value={btcOut}
                  onChange={(e) =>
                    setValue('clientBalanceSat', e.target.value)
                  }
                  className="w-full h-1.5 cursor-pointer accent-amber-400"
                />
                <div className="flex justify-between text-[11px] text-content-tertiary">
                  <span>Outbound (you send)</span>
                  <span>Inbound (you receive)</span>
                </div>
              </div>

              {/* Asset Liquidity */}
              {channelType === 'asset' && assetId && assetMap[assetId] && (
                <div className="rounded-xl border border-emerald-500/30 p-4 space-y-4 bg-emerald-950/10">
                  {/* Header */}
                  <div className="flex items-center gap-3">
                    <img src={rgbIcon} alt="RGB" className="w-6 h-6" />
                    <div>
                      <p className="font-semibold text-sm text-content-primary">
                        {assetMap[assetId].name} ({assetMap[assetId].ticker})
                      </p>
                      <p className="text-xs text-content-secondary">
                        Total: {usdtTotal.toFixed(assetMap[assetId].precision > 0 ? 2 : 0)}{' '}
                        {assetMap[assetId].ticker}
                      </p>
                    </div>
                  </div>

                  {/* Total capacity presets */}
                  <div>
                    <p className="text-[11px] font-semibold text-content-secondary uppercase tracking-wider mb-2">
                      Total Capacity
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {assetPresetsCalc.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            Math.abs(usdtTotal - preset) < 0.001 && !showCustomAssetCapacity
                              ? 'bg-emerald-400/20 text-emerald-400 border border-emerald-400/50'
                              : 'bg-surface-overlay text-content-secondary border border-border-subtle hover:border-emerald-400/30 hover:text-content-primary'
                          }`}
                          onClick={() => {
                            setShowCustomAssetCapacity(false)
                            setValue('totalAssetAmount', preset.toString())
                            if (usdtOut > preset) setValue('clientAssetAmount', preset.toString())
                          }}
                        >
                          {preset >= 1000
                            ? `${(preset / 1000).toFixed(1)}K`
                            : preset.toFixed(assetMap[assetId].precision > 0 ? 2 : 0)}{' '}
                          {assetMap[assetId].ticker}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          showCustomAssetCapacity || isCustomAssetTotal
                            ? 'bg-emerald-400/20 text-emerald-400 border border-emerald-400/50'
                            : 'bg-surface-overlay text-content-secondary border border-border-subtle hover:border-emerald-400/30 hover:text-content-primary'
                        }`}
                        onClick={() => setShowCustomAssetCapacity((v) => !v)}
                      >
                        Custom
                      </button>
                    </div>
                    {(showCustomAssetCapacity || isCustomAssetTotal) && (
                      <input
                        type="number"
                        value={totalAssetAmount}
                        onChange={(e) => {
                          setValue('totalAssetAmount', e.target.value)
                          const newTotal = parseFloat(e.target.value) || 0
                          if (usdtOut > newTotal) setValue('clientAssetAmount', e.target.value)
                        }}
                        min={0}
                        max={assetMax}
                        step={1 / assetFactor}
                        placeholder={`Custom (${assetMap[assetId].ticker})`}
                        className="mt-2 w-full px-3 py-2 bg-surface-overlay rounded-xl border border-border-default focus:border-emerald-400 text-white text-sm outline-none"
                      />
                    )}
                  </div>

                  {/* Asset liquidity bar */}
                  <LiquidityBar
                    outbound={usdtOut}
                    inbound={usdtIn}
                    outboundLabel={`${usdtOut.toFixed(2)} ${assetMap[assetId].ticker}`}
                    inboundLabel={`${usdtIn.toFixed(2)} ${assetMap[assetId].ticker}`}
                    outboundColor="bg-emerald-400"
                    inboundColor="bg-emerald-400/30"
                  />

                  {/* Buy amount slider */}
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-content-secondary">Buy amount (outbound)</span>
                      <span className="text-emerald-400 font-semibold">
                        {usdtOut.toFixed(2)} {assetMap[assetId].ticker}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={usdtTotal || assetMax}
                      step={1 / assetFactor}
                      value={usdtOut}
                      onChange={(e) => setValue('clientAssetAmount', e.target.value)}
                      className="w-full h-1.5 cursor-pointer accent-emerald-400"
                    />
                    <div className="flex justify-between text-[10px] text-content-tertiary mt-1">
                      <span>0 (all inbound)</span>
                      <span>
                        {(usdtTotal || assetMax).toFixed(2)} {assetMap[assetId].ticker} (all outbound)
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Quote Display */}
              {channelType === 'asset' &&
                assetId &&
                clientAssetAmount &&
                parseFloat(clientAssetAmount) > 0 && (
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
                            amount:
                              (quote.from_asset?.amount ||
                                (quote as any).from_amount ||
                                0) / 1000,
                            className: 'text-emerald-300 font-medium',
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
                  type="button"
                  className="flex-1 px-4 py-2.5 bg-surface-high hover:bg-surface-elevated text-white rounded-xl font-medium transition-colors text-sm"
                  onClick={handleClose}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    loading ||
                    (channelType === 'asset' &&
                      !!clientAssetAmount &&
                      parseFloat(clientAssetAmount) > 0 &&
                      (quoteLoading || (!quote && !quoteError)))
                  }
                  className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary-emphasis text-primary-foreground rounded-xl font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {quoteLoading &&
                  channelType === 'asset' &&
                  !!clientAssetAmount &&
                  parseFloat(clientAssetAmount) > 0
                    ? 'Loading Quote...'
                    : 'Continue →'}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>

      {/* Wallet Confirmation Modal */}
      <WalletConfirmationModal
        bitcoinUnit={bitcoinUnit}
        currentPayment={
          paymentMethodTab === 'lightning'
            ? order?.payment?.bolt11
            : order?.payment?.onchain
        }
        customFee={customFee}
        feeRates={feeRates}
        isOpen={showWalletConfirmation}
        isProcessing={isProcessingWalletPayment}
        onChainBalance={onChainBalance}
        onClose={() => setShowWalletConfirmation(false)}
        onConfirm={handleWalletPayment}
        outboundLiquidity={outboundLiquidity}
        paymentMethod={paymentMethodTab}
        selectedFee={selectedFee}
      />
    </div>
  )
}
