import { invoke } from '@tauri-apps/api/core'
import { X, Info, Clock, Zap, Rocket, Settings } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { ClipLoader } from 'react-spinners'
import { toast } from 'react-toastify'

import { useAppSelector } from '../../app/store/hooks'
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
  BitcoinChannelSection,
  AssetChannelSection,
  FeeBreakdownDisplay,
  ChannelDurationSelector,
} from '../ChannelConfiguration'

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
  const bitcoinUnit = useAppSelector((state) => state.settings.bitcoinUnit)

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [orderPayload, setOrderPayload] = useState<any>(null)
  const [paymentStatus, setPaymentStatus] = useState<
    'success' | 'error' | 'expired' | null
  >(null)
  const [paymentReceived, setPaymentReceived] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [showPreselectedConfirmation, setShowPreselectedConfirmation] =
    useState(false)
  const hasShownConfirmation = useRef(false)

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
  const [sendPayment] = nodeApi.endpoints.sendPayment.useLazyQuery()
  const [sendBtc] = nodeApi.endpoints.sendBtc.useLazyQuery()
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

  // Update form when preselectedAsset changes - only show confirmation once
  useEffect(() => {
    if (preselectedAsset && isOpen && !hasShownConfirmation.current) {
      setValue('assetId', preselectedAsset.assetId)
      setValue('clientAssetAmount', preselectedAsset.amount.toString())
      setShowPreselectedConfirmation(true)
      hasShownConfirmation.current = true
    } else if (!isOpen) {
      // Reset when modal closes
      hasShownConfirmation.current = false
    }
  }, [preselectedAsset, isOpen, setValue])

  // Calculate available liquidity
  const channels =
    listChannelsResponse?.data?.channels.filter((channel) => channel.ready) ||
    []
  const outboundLiquidity =
    channels.length > 0
      ? Math.max(
          ...channels.map(
            (channel) => channel.next_outbound_htlc_limit_msat / 1000
          )
        )
      : 0
  const vanillaChainBalance = btcBalanceResponse.data?.vanilla.spendable || 0
  const coloredChainBalance = btcBalanceResponse.data?.colored.spendable || 0
  const onChainBalance = vanillaChainBalance + coloredChainBalance

  // Refresh wallet data
  const refreshData = useCallback(async () => {
    if (!btcBalanceResponse.data || !listChannelsResponse.data) {
      setIsLoadingData(true)
    }

    try {
      await Promise.all([btcBalance({ skip_sync: false }), listChannels()])
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
        toast.error('Error fetching LSP data. Please try again later.')
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
        const quoteRequest = {
          from_asset: 'BTC',
          to_amount: parsedAssetAmount,
          to_asset: assetId,
        }

        const response = await getQuote(quoteRequest)

        if (response.error) {
          const errorMessage =
            'error' in response.error &&
            typeof response.error.error === 'string'
              ? response.error.error
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
        const quoteRequest = {
          from_asset: 'BTC',
          to_amount: parsedAssetAmount,
          to_asset: assetId,
        }

        const response = await getQuote(quoteRequest)

        if (response.error) {
          const errorMessage =
            'error' in response.error &&
            typeof response.error.error === 'string'
              ? response.error.error
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
          if (onSuccess) {
            setTimeout(onSuccess, 2000)
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
  }, [orderId, getOrderRequest, step, paymentReceived, orderPayload, onSuccess])

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
        const nodeInfoResponse = await nodeInfoRequest()
        const clientPubKey = nodeInfoResponse.data?.pubkey

        if (!clientPubKey) {
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

        // Only include asset parameters if we have required data
        if (assetId && assetMap[assetId]) {
          const precision = assetMap[assetId].precision

          // For client asset amount (user buying), we MUST have a quote with rfq_id
          let parsedClientAssetAmount = 0
          if (clientAssetAmount) {
            // If we have a quote, use the exact amount from the quote to avoid precision mismatches
            if (quote && quote.to_amount) {
              parsedClientAssetAmount = quote.to_amount
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
            if (quote && quote.to_amount) {
              parsedClientAssetAmount = quote.to_amount
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
          throw new Error('Could not get order id from server response')
        }

        setOrderId(orderId)
        setOrderPayload(payload)
        setOrder(channelResponse.data as Lsps1CreateOrderResponse)
        setShowPreselectedConfirmation(false) // Hide confirmation to show payment step
        setStep(2)
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'An error occurred while creating the channel order'
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
          throw new Error('Lightning payment failed')
        }

        toast.success('Lightning payment initiated successfully!')
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
          fee_rate: feeRate,
        })

        if ('error' in result) {
          const error = result.error as NodeApiError
          throw new Error(error.data.error)
        }

        toast.success('On-chain payment sent successfully!')
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
      toast.error(
        'Payment failed: ' +
          (error instanceof Error ? error.message : 'Unknown error')
      )
      setPaymentStatus('error')
    } finally {
      setIsProcessingWalletPayment(false)
    }
  }

  const handleClose = useCallback(() => {
    // if (step === 2 && !paymentStatus && paymentReceived) {
    //   toast.warning('Payment is being processed, please wait')
    //   return
    // }
    setStep(1)
    setOrderId(null)
    setPaymentStatus(null)
    setPaymentReceived(false)
    setIsProcessingPayment(false)
    setQuote(null)
    setQuoteError(null)
    setQuoteLoading(false)
    setShowPreselectedConfirmation(false)
    hasShownConfirmation.current = false
    onClose()
  }, [step, paymentStatus, paymentReceived, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl border border-gray-800/50 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {loading && (
          <div className="absolute inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50 rounded-2xl">
            <ClipLoader color={'#3b82f6'} loading={loading} size={50} />
          </div>
        )}

        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-gray-900 to-gray-950 border-b border-gray-800/50 p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
              {showPreselectedConfirmation
                ? 'Confirm Asset Purchase'
                : step === 1
                  ? 'Buy Channel with Asset'
                  : step === 2
                    ? 'Complete Payment'
                    : 'Order Status'}
            </h2>
            <p className="text-gray-400 mt-1">
              {showPreselectedConfirmation
                ? 'Review and confirm or customize your purchase'
                : step === 1
                  ? 'Configure your channel and asset parameters'
                  : step === 2
                    ? 'Pay for your channel to complete the order'
                    : paymentStatus === 'success'
                      ? 'Channel order completed successfully!'
                      : 'Order status'}
            </p>
          </div>
          <button
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            onClick={handleClose}
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {showPreselectedConfirmation &&
          preselectedAsset &&
          assetMap[preselectedAsset.assetId] ? (
            <div className="space-y-5">
              {/* Quick Confirmation */}
              <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-700/40 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-lg font-semibold text-blue-200 mb-1">
                      Confirm Purchase
                    </h3>
                    <p className="text-blue-200/80 text-sm">
                      You'll purchase{' '}
                      <strong>
                        {formatNumberWithCommas(
                          preselectedAsset.amount.toString()
                        )}{' '}
                        {assetMap[preselectedAsset.assetId].ticker}
                      </strong>{' '}
                      in a Lightning channel. Review and proceed or customize.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quote Display */}
              <QuoteDisplay
                assetInfo={assetMap[preselectedAsset.assetId]}
                quote={quote}
                quoteError={quoteError}
                quoteLoading={quoteLoading}
              />

              {/* Quick Summary */}
              {fees && quote && (
                <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/30 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Asset Cost</span>
                    <span className="text-emerald-300">
                      {formatNumberWithCommas(
                        (quote.from_amount / 1000).toString()
                      )}{' '}
                      sats
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Your Liquidity</span>
                    <span className="text-gray-200">
                      {formatNumberWithCommas(clientBalanceSat)} sats
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Fees</span>
                    <span className="text-gray-200">
                      {formatNumberWithCommas(fees.total_fee)} sats
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 mt-2 border-t border-gray-700">
                    <span className="text-white font-semibold">Total</span>
                    <span className="text-white font-semibold">
                      {formatNumberWithCommas(
                        quote.from_amount / 1000 +
                          parseInt(
                            clientBalanceSat.replace(/[^0-9]/g, ''),
                            10
                          ) +
                          fees.total_fee
                      )}{' '}
                      sats
                    </span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                  onClick={handleClose}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                  onClick={() => setShowPreselectedConfirmation(false)}
                  type="button"
                >
                  Customize
                </button>
                <button
                  className="flex-1 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  disabled={quoteLoading || !!quoteError || !quote || loading}
                  onClick={() => handleSubmit(onSubmit)()}
                  type="button"
                >
                  {quoteLoading || loading
                    ? 'Loading...'
                    : 'Proceed to Payment'}
                </button>
              </div>
            </div>
          ) : step === 2 && order ? (
            <div className="space-y-5">
              {paymentReceived && isProcessingPayment ? (
                <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-6 text-center">
                  <div className="flex justify-center mb-4">
                    <ClipLoader color="#3b82f6" size={40} />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Processing Payment
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Payment received and being processed...
                  </p>
                </div>
              ) : (
                <>
                  {/* Order Summary */}
                  <OrderSummary
                    assetMap={assetMap}
                    fees={fees}
                    orderPayload={orderPayload}
                    quote={quote}
                  />

                  {/* Payment Method Selection */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">
                      Choose Payment Method
                    </h3>
                    <div className="flex gap-3">
                      <button
                        className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                          useWalletFunds
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                        }`}
                        onClick={() => setUseWalletFunds(true)}
                      >
                        💰 Use Wallet Funds
                      </button>
                      <button
                        className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                          !useWalletFunds
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                        }`}
                        onClick={() => setUseWalletFunds(false)}
                      >
                        📱 External Wallet
                      </button>
                    </div>
                  </div>

                  {/* Payment Details */}
                  {useWalletFunds ? (
                    <div className="space-y-4">
                      {/* Lightning/On-chain tabs */}
                      <div className="flex gap-2">
                        <button
                          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            paymentMethodTab === 'lightning'
                              ? 'bg-blue-600/20 text-blue-300 border border-blue-600/50'
                              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
                          }`}
                          onClick={() => setPaymentMethodTab('lightning')}
                        >
                          ⚡ Lightning
                        </button>
                        <button
                          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            paymentMethodTab === 'onchain'
                              ? 'bg-blue-600/20 text-blue-300 border border-blue-600/50'
                              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
                          }`}
                          onClick={() => setPaymentMethodTab('onchain')}
                        >
                          ⛓️ On-chain
                        </button>
                      </div>

                      {/* Balance Display */}
                      {isLoadingData ? (
                        <div className="flex items-center justify-center gap-3 p-6">
                          <ClipLoader color="#3B82F6" size={24} />
                          <span className="text-gray-400">
                            Loading balance...
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="bg-gray-900/50 rounded-xl p-4">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-gray-400 text-sm">
                                {paymentMethodTab === 'lightning'
                                  ? 'Max Sendable'
                                  : 'Available Balance'}
                              </span>
                              <span className="text-white font-semibold">
                                {formatNumberWithCommas(
                                  paymentMethodTab === 'lightning'
                                    ? outboundLiquidity
                                    : onChainBalance
                                )}{' '}
                                sats
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-400 text-sm">
                                Amount to Pay
                              </span>
                              <span className="text-emerald-300 font-semibold">
                                {formatNumberWithCommas(
                                  paymentMethodTab === 'lightning'
                                    ? order.payment?.bolt11?.order_total_sat ||
                                        0
                                    : order.payment?.onchain?.order_total_sat ||
                                        0
                                )}{' '}
                                sats
                              </span>
                            </div>
                          </div>

                          {/* Insufficient Balance Warning */}
                          {((paymentMethodTab === 'lightning' &&
                            outboundLiquidity <
                              (order.payment?.bolt11?.order_total_sat || 0)) ||
                            (paymentMethodTab === 'onchain' &&
                              onChainBalance <
                                (order.payment?.onchain?.order_total_sat ||
                                  0))) && (
                            <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-3">
                              <div className="flex items-start gap-2">
                                <Info className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                                <p className="text-yellow-200/80 text-sm">
                                  Insufficient balance. Please use external
                                  wallet or add funds to your wallet.
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Channel Fees Breakdown */}
                          {fees && (
                            <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/30">
                              <h4 className="text-sm font-semibold text-gray-300 mb-3">
                                Channel Fees
                              </h4>
                              <div className="space-y-2 text-sm">
                                {fees.setup_fee > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">
                                      Setup Fee
                                    </span>
                                    <span className="text-gray-200">
                                      {formatNumberWithCommas(fees.setup_fee)}{' '}
                                      sats
                                    </span>
                                  </div>
                                )}
                                {fees.capacity_fee > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">
                                      Capacity Fee
                                    </span>
                                    <span className="text-gray-200">
                                      {formatNumberWithCommas(
                                        fees.capacity_fee
                                      )}{' '}
                                      sats
                                    </span>
                                  </div>
                                )}
                                {fees.duration_fee > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">
                                      Duration Fee
                                    </span>
                                    <span className="text-gray-200">
                                      {formatNumberWithCommas(
                                        fees.duration_fee
                                      )}{' '}
                                      sats
                                    </span>
                                  </div>
                                )}
                                {fees.applied_discount &&
                                  fees.applied_discount > 0 && (
                                    <div className="flex justify-between text-green-400">
                                      <span>Discount</span>
                                      <span>
                                        -
                                        {formatNumberWithCommas(
                                          fees.applied_discount
                                        )}{' '}
                                        sats
                                      </span>
                                    </div>
                                  )}
                                <div className="flex justify-between pt-2 mt-2 border-t border-gray-700/50">
                                  <span className="text-gray-300 font-medium">
                                    Total Channel Fees
                                  </span>
                                  <span className="text-blue-300 font-semibold">
                                    {formatNumberWithCommas(fees.total_fee)}{' '}
                                    sats
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Fee Selector for On-chain */}
                          {paymentMethodTab === 'onchain' && (
                            <div className="bg-gray-900/50 rounded-xl p-4">
                              <h4 className="text-sm font-semibold text-gray-300 mb-3">
                                Transaction Fee
                              </h4>
                              <div className="grid grid-cols-2 gap-3">
                                {feeRates.map((rate) => (
                                  <button
                                    className={`p-3 rounded-xl border-2 transition-all duration-200 flex items-center justify-between text-sm ${
                                      selectedFee === rate.value
                                        ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                                        : 'border-gray-700 text-gray-400 hover:border-blue-500/50'
                                    }`}
                                    key={rate.value}
                                    onClick={() => setSelectedFee(rate.value)}
                                    type="button"
                                  >
                                    <div className="flex items-center gap-2">
                                      {getFeeIcon(rate.value)}
                                      <span>{rate.label}</span>
                                    </div>
                                    {rate.value !== 'custom' && (
                                      <span>{rate.rate} sat/vB</span>
                                    )}
                                  </button>
                                ))}
                              </div>
                              {selectedFee === 'custom' && (
                                <input
                                  className="mt-3 w-full px-4 py-3 bg-gray-800/50 rounded-xl border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white"
                                  onChange={(e) =>
                                    setCustomFee(parseFloat(e.target.value))
                                  }
                                  placeholder="Custom fee rate (sat/vB)"
                                  step="0.1"
                                  type="number"
                                  value={customFee}
                                />
                              )}
                            </div>
                          )}

                          {/* Pay Button */}
                          <button
                            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                            Pay with Wallet
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <PaymentSection
                      onTabChange={setPaymentMethodTab}
                      paymentData={order.payment}
                      paymentMethod={paymentMethodTab}
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
            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              {/* Info Banner */}
              <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-700/40 rounded-xl p-4">
                <div className="flex items-start gap-3 mb-3">
                  <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-blue-200 font-semibold mb-1">
                      Buy Asset in Lightning Channel
                    </h3>
                    <p className="text-blue-200/80 text-sm">
                      You'll purchase the asset at the current market rate and
                      receive it in a Lightning channel.
                    </p>
                  </div>
                </div>
                <div className="bg-blue-950/30 rounded-lg p-3 border border-blue-800/30">
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <p className="text-yellow-200/90 text-xs">
                      <strong>Confirmation Time:</strong> The channel requires
                      ~6 on-chain confirmations (approximately 1 hour). Your
                      asset will be locked at today's rate and ready to trade
                      once confirmed.
                    </p>
                  </div>
                </div>
              </div>

              {/* Channel Configuration */}
              <div className="space-y-4">
                {/* Bitcoin Channel Configuration */}
                <BitcoinChannelSection
                  capacityPresets={[50000, 100000, 500000, 1000000]}
                  clientBalance={
                    clientBalanceSat
                      ? parseInt(clientBalanceSat.replace(/[^0-9]/g, ''), 10) ||
                        0
                      : 0
                  }
                  maxCapacity={effectiveMaxCapacity}
                  maxClientBalance={
                    capacitySat
                      ? Math.min(
                          parseInt(capacitySat.replace(/[^0-9]/g, ''), 10) || 0,
                          lspOptions?.max_initial_client_balance_sat ||
                            Number.MAX_SAFE_INTEGER
                        )
                      : 0
                  }
                  minCapacity={effectiveMinCapacity}
                  minClientBalance={
                    lspOptions?.min_initial_client_balance_sat || 0
                  }
                  onCapacityChange={(capacity) => {
                    setValue('capacitySat', capacity.toString())
                    // Adjust client balance if it exceeds new capacity
                    const currentClientBalance = parseInt(
                      clientBalanceSat.replace(/[^0-9]/g, ''),
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
                    capacitySat
                      ? parseInt(capacitySat.replace(/[^0-9]/g, ''), 10) || 0
                      : 0
                  }
                />

                {/* Asset Selection - Separate Section */}
                {Object.keys(assetMap).length > 0 && (
                  <AssetChannelSection
                    assetMap={assetMap}
                    clientAssetAmount={
                      clientAssetAmount ? parseFloat(clientAssetAmount) : 0
                    }
                    control={control}
                    onAssetChange={(value) => setValue('assetId', value)}
                    onClientAssetAmountChange={(value) =>
                      setValue('clientAssetAmount', value.toString())
                    }
                    onTotalAssetAmountChange={(value) =>
                      setValue('totalAssetAmount', value.toString())
                    }
                    selectedAssetId={assetId}
                    totalAssetAmount={
                      totalAssetAmount ? parseFloat(totalAssetAmount) : 0
                    }
                  />
                )}
              </div>

              {/* Quote Display */}
              {assetId &&
                clientAssetAmount &&
                parseFloat(clientAssetAmount) > 0 && (
                  <QuoteDisplay
                    assetInfo={assetMap[assetId] || null}
                    quote={quote}
                    quoteError={quoteError}
                    quoteLoading={quoteLoading}
                  />
                )}

              {/* Channel Duration - After Asset Configuration */}
              {assetId && assetMap[assetId] && (
                <ChannelDurationSelector
                  control={control}
                  maxExpiryBlocks={lspOptions?.max_channel_expiry_blocks}
                  onChange={(value) => setValue('channelExpireBlocks', value)}
                  value={channelExpireBlocks}
                />
              )}

              {/* Fee Display */}
              {fees && (
                <FeeBreakdownDisplay
                  additionalCosts={[
                    ...(quote &&
                    clientAssetAmount &&
                    parseFloat(clientAssetAmount) > 0
                      ? [
                          {
                            amount: quote.from_amount / 1000,
                            className: 'text-emerald-300 font-medium',
                            label: 'Asset Purchase',
                          },
                          {
                            amount: parseInt(
                              clientBalanceSat.replace(/[^0-9]/g, '') || '0'
                            ),
                            label: 'Your Liquidity',
                          },
                        ]
                      : []),
                  ]}
                  fees={fees}
                  showGrandTotal={true}
                />
              )}

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors"
                  onClick={handleClose}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={
                    loading ||
                    !assetId ||
                    (!!clientAssetAmount &&
                      parseFloat(clientAssetAmount) > 0 &&
                      (quoteLoading || (!quote && !quoteError)))
                  }
                  type="submit"
                >
                  {quoteLoading &&
                  !!clientAssetAmount &&
                  parseFloat(clientAssetAmount) > 0
                    ? 'Loading Quote...'
                    : 'Continue to Payment'}
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
