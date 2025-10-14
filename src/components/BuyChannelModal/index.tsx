import { invoke } from '@tauri-apps/api/core'
import { X, Info, CheckCircle, XCircle, Clock, Copy } from 'lucide-react'
import QRCode from 'qrcode.react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { useForm } from 'react-hook-form'
import { ClipLoader } from 'react-spinners'
import { toast } from 'react-toastify'

import { useAppSelector } from '../../app/store/hooks'
import { MIN_CHANNEL_CAPACITY, MAX_CHANNEL_CAPACITY } from '../../constants'
import { formatNumberWithCommas } from '../../helpers/number'
import {
  WalletPaymentSection,
  WalletConfirmationModal,
} from '../../routes/order-new-channel/components'
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
  const outboundLiquidity = Math.max(
    ...(channels.map(
      (channel) => channel.next_outbound_htlc_limit_msat / 1000
    ) || [0])
  )
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
    if (step === 2 && !paymentStatus && paymentReceived) {
      toast.warning('Payment is being processed, please wait')
      return
    }
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
            <div className="space-y-6">
              {/* Confirmation Header */}
              <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-700/40 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <Info className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xl font-semibold text-blue-200 mb-2">
                      Confirm Asset Purchase
                    </h3>
                    <p className="text-blue-200/80 text-sm leading-relaxed">
                      You're about to purchase an asset in a Lightning channel
                      with predefined values. Review the details below and
                      proceed or customize the parameters.
                    </p>
                  </div>
                </div>
              </div>

              {/* Preselected Values Display */}
              <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl p-5 border border-gray-700/50">
                <h4 className="text-lg font-semibold text-white mb-4">
                  Selected Asset
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Asset</span>
                    <span className="text-white font-semibold text-lg">
                      {assetMap[preselectedAsset.assetId].ticker}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Amount to Purchase</span>
                    <span className="text-emerald-300 font-semibold text-lg">
                      {formatNumberWithCommas(
                        preselectedAsset.amount.toString()
                      )}{' '}
                      {assetMap[preselectedAsset.assetId].ticker}
                    </span>
                  </div>
                  <div className="pt-3 mt-3 border-t border-gray-700">
                    <div className="bg-blue-950/30 rounded-lg p-3">
                      <p className="text-xs text-blue-200/70 leading-relaxed">
                        <strong>Note:</strong> A Lightning channel will be
                        created to receive this asset. Default channel
                        parameters will be used, which you can customize if
                        needed.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quote Display on Confirmation */}
              {quoteLoading && (
                <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <ClipLoader color="#10b981" size={20} />
                    <span className="text-emerald-300 text-sm">
                      Fetching price quote...
                    </span>
                  </div>
                </div>
              )}

              {!quoteLoading && quote && assetMap[preselectedAsset.assetId] && (
                <div className="bg-gradient-to-br from-emerald-900/30 to-green-900/30 border border-emerald-700/50 rounded-xl p-4">
                  <h3 className="text-lg font-semibold text-emerald-200 mb-3 flex items-center gap-2">
                    <Info className="w-5 h-5" />
                    Current Price Quote
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">Asset Amount</span>
                      <span className="text-white font-medium">
                        {formatNumberWithCommas(
                          (
                            quote.to_amount /
                            Math.pow(
                              10,
                              assetMap[preselectedAsset.assetId].precision
                            )
                          ).toFixed(
                            assetMap[preselectedAsset.assetId].precision
                          )
                        )}{' '}
                        {assetMap[preselectedAsset.assetId].ticker}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">Asset Price</span>
                      <span className="text-white font-medium">
                        {formatNumberWithCommas(
                          (quote.from_amount / 1000).toString()
                        )}{' '}
                        sats
                      </span>
                    </div>
                    {quote.expires_at && (
                      <div className="flex justify-between text-xs pt-2 border-t border-emerald-700/30">
                        <span className="text-emerald-200/70">
                          Quote Expires
                        </span>
                        <span className="text-emerald-200/70">
                          {new Date(
                            quote.expires_at * 1000
                          ).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!quoteLoading && quoteError && (
                <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-red-300 mb-1">
                        Quote Error
                      </h4>
                      <p className="text-xs text-red-200/80">{quoteError}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Default Channel Parameters Info */}
              <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/30">
                <h4 className="text-sm font-semibold text-gray-300 mb-3">
                  Default Channel Parameters
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Channel Capacity</span>
                    <span className="text-gray-200">
                      {formatNumberWithCommas(capacitySat)} sats
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">
                      Your Outbound Liquidity
                    </span>
                    <span className="text-gray-200">
                      {formatNumberWithCommas(clientBalanceSat)} sats
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Channel Duration</span>
                    <span className="text-gray-200">
                      {channelExpireBlocks} blocks (~
                      {Math.round(channelExpireBlocks / 144)} days)
                    </span>
                  </div>
                </div>
              </div>

              {/* Estimated Costs */}
              {fees && quote && (
                <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl p-4 border border-gray-700/50">
                  <h4 className="text-sm font-semibold text-gray-300 mb-3">
                    Estimated Total Cost
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Asset Purchase</span>
                      <span className="text-emerald-300 font-medium">
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
                      <span className="text-gray-400">Channel Fees</span>
                      <span className="text-gray-200">
                        {formatNumberWithCommas(fees.total_fee)} sats
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 mt-2 border-t border-gray-700">
                      <span className="text-white font-semibold">
                        Total Payment
                      </span>
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
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors"
                  onClick={handleClose}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors"
                  onClick={() => setShowPreselectedConfirmation(false)}
                  type="button"
                >
                  Customize Parameters
                </button>
                <button
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={quoteLoading || !!quoteError || !quote}
                  onClick={handleSubmit(onSubmit)}
                  type="button"
                >
                  {quoteLoading ? 'Loading Quote...' : 'Proceed to Payment'}
                </button>
              </div>
            </div>
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

              {/* Quote Loading */}
              {quoteLoading &&
                assetId &&
                clientAssetAmount &&
                parseFloat(clientAssetAmount) > 0 && (
                  <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <ClipLoader color="#10b981" size={20} />
                      <span className="text-emerald-300 text-sm">
                        Fetching quote...
                      </span>
                    </div>
                  </div>
                )}

              {/* Quote Display */}
              {!quoteLoading &&
                quote &&
                assetId &&
                assetMap[assetId] &&
                clientAssetAmount &&
                parseFloat(clientAssetAmount) > 0 && (
                  <div className="bg-gradient-to-br from-emerald-900/30 to-green-900/30 border border-emerald-700/50 rounded-xl p-4">
                    <h3 className="text-lg font-semibold text-emerald-200 mb-3 flex items-center gap-2">
                      <Info className="w-5 h-5" />
                      Asset Price Quote
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300">Asset Amount</span>
                        <span className="text-white font-medium">
                          {formatNumberWithCommas(
                            (
                              quote.to_amount /
                              Math.pow(10, assetMap[assetId].precision)
                            ).toFixed(assetMap[assetId].precision)
                          )}{' '}
                          {assetMap[assetId].ticker}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-300">Asset Price</span>
                        <span className="text-white font-medium">
                          {formatNumberWithCommas(
                            (quote.from_amount / 1000).toString()
                          )}{' '}
                          sats
                        </span>
                      </div>
                      {quote.expires_at && (
                        <div className="flex justify-between text-xs pt-2 border-t border-emerald-700/30">
                          <span className="text-emerald-200/70">
                            Quote Expires
                          </span>
                          <span className="text-emerald-200/70">
                            {new Date(
                              quote.expires_at * 1000
                            ).toLocaleTimeString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              {!quoteLoading &&
                quoteError &&
                assetId &&
                clientAssetAmount &&
                parseFloat(clientAssetAmount) > 0 && (
                  <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-semibold text-red-300 mb-1">
                          Quote Error
                        </h4>
                        <p className="text-xs text-red-200/80">{quoteError}</p>
                      </div>
                    </div>
                  </div>
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

          {step === 2 && order && (
            <div className="space-y-6">
              {/* Detailed Order Summary */}
              <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl p-5 border border-gray-700/50">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-400" />
                  Order Details
                </h3>
                <div className="space-y-3">
                  {/* Channel Information */}
                  <div className="bg-gray-900/50 rounded-lg p-3 space-y-2">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      Channel Configuration
                    </h4>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">Total Capacity</span>
                      <span className="text-white font-medium">
                        {formatNumberWithCommas(
                          (orderPayload?.client_balance_sat || 0) +
                            (orderPayload?.lsp_balance_sat || 0)
                        )}{' '}
                        sats
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">
                        Your Inbound Liquidity
                      </span>
                      <span className="text-emerald-300 font-medium">
                        {formatNumberWithCommas(
                          orderPayload?.lsp_balance_sat || 0
                        )}{' '}
                        sats
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">
                        Your Outbound Liquidity
                      </span>
                      <span className="text-blue-300 font-medium">
                        {formatNumberWithCommas(
                          orderPayload?.client_balance_sat || 0
                        )}{' '}
                        sats
                      </span>
                    </div>
                  </div>

                  {/* Asset Information - if buying assets */}
                  {orderPayload?.asset_id &&
                    orderPayload?.client_asset_amount &&
                    assetMap[orderPayload.asset_id] && (
                      <div className="bg-gradient-to-br from-emerald-900/30 to-green-900/30 rounded-lg p-3 border border-emerald-700/30 space-y-2">
                        <h4 className="text-xs font-semibold text-emerald-300 uppercase tracking-wide mb-2">
                          Asset Purchase
                        </h4>
                        <div className="flex justify-between text-sm">
                          <span className="text-emerald-200">Asset</span>
                          <span className="text-white font-medium">
                            {assetMap[orderPayload.asset_id].ticker}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-emerald-200">Amount</span>
                          <span className="text-white font-semibold">
                            {formatNumberWithCommas(
                              (
                                orderPayload.client_asset_amount /
                                Math.pow(
                                  10,
                                  assetMap[orderPayload.asset_id].precision
                                )
                              ).toFixed(
                                assetMap[orderPayload.asset_id].precision
                              )
                            )}{' '}
                            {assetMap[orderPayload.asset_id].ticker}
                          </span>
                        </div>
                      </div>
                    )}

                  {/* Fee Breakdown */}
                  {fees && (
                    <div className="bg-gray-900/50 rounded-lg p-3 space-y-2">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                        Fees
                      </h4>
                      <div className="space-y-1.5 text-sm">
                        {fees.setup_fee > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-300">Channel Setup</span>
                            <span className="text-gray-200">
                              {formatNumberWithCommas(fees.setup_fee)} sats
                            </span>
                          </div>
                        )}
                        {fees.capacity_fee > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-300">Capacity Fee</span>
                            <span className="text-gray-200">
                              {formatNumberWithCommas(fees.capacity_fee)} sats
                            </span>
                          </div>
                        )}
                        {fees.duration_fee > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-300">Duration Fee</span>
                            <span className="text-gray-200">
                              {formatNumberWithCommas(fees.duration_fee)} sats
                            </span>
                          </div>
                        )}
                        {fees.applied_discount && fees.applied_discount > 0 && (
                          <div className="flex justify-between text-green-400">
                            <span>Discount Applied</span>
                            <span>
                              -{formatNumberWithCommas(fees.applied_discount)}{' '}
                              sats
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between pt-2 mt-2 border-t border-gray-700">
                          <span className="text-white font-semibold">
                            Total Fees
                          </span>
                          <span className="text-white font-semibold">
                            {formatNumberWithCommas(fees.total_fee)} sats
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {paymentReceived && isProcessingPayment ? (
                <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-6 text-center">
                  <div className="flex justify-center mb-4">
                    <ClipLoader color="#3b82f6" size={40} />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Processing Payment
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Your payment has been received and is being processed...
                  </p>
                </div>
              ) : (
                <>
                  {/* Payment Amount Display */}
                  <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-700/50 rounded-xl p-5">
                    <div className="text-center">
                      <p className="text-gray-300 text-sm mb-2">
                        Total Payment Amount
                      </p>
                      <p className="text-3xl font-bold text-white mb-1">
                        {formatNumberWithCommas(
                          paymentMethodTab === 'lightning'
                            ? order.payment?.bolt11?.order_total_sat || 0
                            : order.payment?.onchain?.order_total_sat || 0
                        )}{' '}
                        <span className="text-xl text-gray-300">sats</span>
                      </p>
                      {paymentMethodTab === 'lightning' &&
                        order.payment?.bolt11?.expires_at && (
                          <div className="flex items-center justify-center gap-2 mt-3 text-yellow-300 text-sm">
                            <Clock className="w-4 h-4" />
                            <span>
                              Invoice expires:{' '}
                              {new Date(
                                order.payment.bolt11.expires_at
                              ).toLocaleTimeString()}
                            </span>
                          </div>
                        )}
                      {paymentMethodTab === 'onchain' &&
                        order.payment?.onchain?.expires_at && (
                          <div className="flex items-center justify-center gap-2 mt-3 text-yellow-300 text-sm">
                            <Clock className="w-4 h-4" />
                            <span>
                              Payment window expires:{' '}
                              {new Date(
                                order.payment.onchain.expires_at
                              ).toLocaleTimeString()}
                            </span>
                          </div>
                        )}
                    </div>
                  </div>

                  {/* Payment Method Tabs */}
                  <div className="flex justify-center gap-4">
                    <button
                      className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                        paymentMethodTab === 'lightning'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                      onClick={() => setPaymentMethodTab('lightning')}
                    >
                      ⚡ Lightning
                    </button>
                    <button
                      className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                        paymentMethodTab === 'onchain'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                      onClick={() => setPaymentMethodTab('onchain')}
                    >
                      ⛓️ On-chain
                    </button>
                  </div>

                  {/* Payment Instructions */}
                  <div className="bg-gradient-to-r from-gray-800/30 to-gray-900/30 border border-gray-700/30 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-gray-300">
                        {paymentMethodTab === 'lightning' ? (
                          <p>
                            Pay with your wallet's Lightning balance or scan the
                            QR code with any Lightning wallet. Payment is
                            instant and will be confirmed immediately.
                          </p>
                        ) : (
                          <p>
                            Send Bitcoin to the address below. Payment requires{' '}
                            <strong>
                              {order.payment?.onchain
                                ?.min_onchain_payment_confirmations || 1}{' '}
                              confirmation(s)
                            </strong>
                            . You can pay from your wallet or any external
                            Bitcoin wallet.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Wallet Payment Section */}
                  <WalletPaymentSection
                    bitcoinUnit={bitcoinUnit}
                    currentPayment={
                      paymentMethodTab === 'lightning'
                        ? order.payment?.bolt11
                        : order.payment?.onchain
                    }
                    customFee={customFee}
                    isLoadingData={isLoadingData}
                    onChainBalance={onChainBalance}
                    onCustomFeeChange={setCustomFee}
                    onFeeChange={setSelectedFee}
                    onPayClick={() => setShowWalletConfirmation(true)}
                    onUseWalletFundsChange={setUseWalletFunds}
                    outboundLiquidity={outboundLiquidity}
                    paymentMethod={paymentMethodTab}
                    selectedFee={selectedFee}
                    useWalletFunds={useWalletFunds}
                  />

                  {/* External Wallet Payment - Always show for external wallet option */}
                  <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">
                        Pay with External Wallet
                      </h3>
                      <CopyToClipboard
                        onCopy={() => toast.success('Copied to clipboard!')}
                        text={
                          paymentMethodTab === 'lightning'
                            ? order.payment?.bolt11?.invoice || ''
                            : order.payment?.onchain?.address || ''
                        }
                      >
                        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
                          <Copy className="w-4 h-4" />
                          Copy{' '}
                          {paymentMethodTab === 'lightning'
                            ? 'Invoice'
                            : 'Address'}
                        </button>
                      </CopyToClipboard>
                    </div>

                    <div className="flex justify-center mb-4">
                      <div className="bg-white p-4 rounded-lg">
                        <QRCode
                          size={220}
                          value={
                            paymentMethodTab === 'lightning'
                              ? order.payment?.bolt11?.invoice || ''
                              : order.payment?.onchain?.address || ''
                          }
                        />
                      </div>
                    </div>

                    <div className="bg-gray-900/50 rounded-lg p-3 break-all font-mono text-xs text-gray-300 mb-3">
                      {paymentMethodTab === 'lightning'
                        ? order.payment?.bolt11?.invoice || ''
                        : order.payment?.onchain?.address || ''}
                    </div>

                    <div className="flex items-start gap-2 text-xs text-gray-400">
                      <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <p>
                        Scan this QR code with any{' '}
                        {paymentMethodTab === 'lightning'
                          ? 'Lightning'
                          : 'Bitcoin'}{' '}
                        wallet app, or copy and paste the{' '}
                        {paymentMethodTab === 'lightning'
                          ? 'invoice'
                          : 'address'}{' '}
                        to make the payment. The order will be processed
                        automatically once payment is received.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col items-center justify-center py-8 space-y-6">
              {paymentStatus === 'success' ? (
                <>
                  <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center animate-pulse">
                    <CheckCircle className="w-12 h-12 text-green-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">
                    Payment Successful!
                  </h3>
                  <div className="max-w-lg space-y-4">
                    <p className="text-gray-300 text-center leading-relaxed">
                      Your channel order has been created successfully and
                      payment received.
                    </p>

                    {/* Channel Confirmation Info */}
                    <div className="bg-blue-900/30 border border-blue-700/40 rounded-xl p-5 space-y-3">
                      <div className="flex items-start gap-3">
                        <Clock className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="space-y-2">
                          <h4 className="text-blue-200 font-semibold">
                            Channel Confirmation in Progress
                          </h4>
                          <p className="text-blue-200/80 text-sm leading-relaxed">
                            Your channel is being created on the Bitcoin
                            blockchain. This requires approximately
                            <strong> 6 on-chain confirmations</strong>, which
                            typically takes around <strong>1 hour</strong>.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* What Happens Next */}
                    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5 space-y-3">
                      <h4 className="text-white font-semibold flex items-center gap-2">
                        <Info className="w-5 h-5 text-gray-400" />
                        What Happens Next
                      </h4>
                      <ul className="space-y-2 text-sm text-gray-300">
                        <li className="flex items-start gap-2">
                          <span className="text-green-400 mt-0.5">•</span>
                          <span>
                            Your channel will appear in the channels list once
                            the first confirmation is received
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-400 mt-0.5">•</span>
                          <span>
                            The asset you purchased will be locked at today's
                            rate during confirmation
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-400 mt-0.5">•</span>
                          <span>
                            Once fully confirmed (~1 hour), you'll be able to
                            trade immediately
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-green-400 mt-0.5">•</span>
                          <span>
                            You can close this window and check back later
                          </span>
                        </li>
                      </ul>
                    </div>

                    {/* Order ID */}
                    {orderId && (
                      <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/30">
                        <p className="text-xs text-gray-400 text-center">
                          Order ID:{' '}
                          <span className="text-gray-300 font-mono">
                            {orderId}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors shadow-lg"
                    onClick={handleClose}
                  >
                    Got it, thanks!
                  </button>
                </>
              ) : paymentStatus === 'expired' ? (
                <>
                  <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center">
                    <Clock className="w-12 h-12 text-yellow-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">
                    Payment Expired
                  </h3>

                  <div className="max-w-lg space-y-4">
                    <p className="text-gray-300 text-center leading-relaxed">
                      The payment window for this order has expired.
                    </p>

                    {/* Expiration Information */}
                    <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-5 space-y-3">
                      <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div className="space-y-2">
                          <h4 className="text-yellow-200 font-semibold">
                            What Happened
                          </h4>
                          <p className="text-yellow-200/80 text-sm leading-relaxed">
                            Channel orders have a limited time window for
                            payment to ensure price stability. This order's
                            payment period has expired without receiving
                            payment.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Next Steps */}
                    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5 space-y-3">
                      <h4 className="text-white font-semibold flex items-center gap-2">
                        <Info className="w-5 h-5 text-gray-400" />
                        What You Can Do
                      </h4>
                      <ul className="space-y-2 text-sm text-gray-300">
                        <li className="flex items-start gap-2">
                          <span className="text-blue-400 mt-0.5">•</span>
                          <span>
                            No funds were deducted - it's safe to try again
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-400 mt-0.5">•</span>
                          <span>
                            Create a new order with the same or different
                            parameters
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-400 mt-0.5">•</span>
                          <span>
                            The new order will have fresh pricing and a new
                            payment window
                          </span>
                        </li>
                      </ul>
                    </div>

                    {/* Order ID if available */}
                    {orderId && (
                      <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/30">
                        <p className="text-xs text-gray-400 text-center">
                          Expired Order ID:{' '}
                          <span className="text-gray-300 font-mono">
                            {orderId}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      className="px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors"
                      onClick={handleClose}
                    >
                      Close
                    </button>
                    <button
                      className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
                      onClick={() => {
                        setStep(1)
                        setOrderId(null)
                        setPaymentStatus(null)
                        setPaymentReceived(false)
                        setIsProcessingPayment(false)
                        setQuote(null)
                        setQuoteError(null)
                        setQuoteLoading(false)
                      }}
                    >
                      Create New Order
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
                    <XCircle className="w-12 h-12 text-red-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">
                    Order Failed
                  </h3>

                  <div className="max-w-lg space-y-4">
                    <p className="text-gray-300 text-center leading-relaxed">
                      Unfortunately, there was an issue processing your channel
                      order.
                    </p>

                    {/* Error Information */}
                    <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-5 space-y-3">
                      <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="space-y-2">
                          <h4 className="text-red-200 font-semibold">
                            What This Means
                          </h4>
                          <p className="text-red-200/80 text-sm leading-relaxed">
                            The channel order could not be completed. This might
                            happen if there was an issue with the payment
                            processing or channel creation on the LSP side.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Next Steps */}
                    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5 space-y-3">
                      <h4 className="text-white font-semibold flex items-center gap-2">
                        <Info className="w-5 h-5 text-gray-400" />
                        What You Can Do
                      </h4>
                      <ul className="space-y-2 text-sm text-gray-300">
                        <li className="flex items-start gap-2">
                          <span className="text-blue-400 mt-0.5">•</span>
                          <span>
                            If payment was made, no funds were deducted from
                            your wallet
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-400 mt-0.5">•</span>
                          <span>
                            You can try creating a new order with different
                            parameters
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-400 mt-0.5">•</span>
                          <span>
                            Check your internet connection and wallet balance
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-400 mt-0.5">•</span>
                          <span>
                            If the problem persists, please contact support
                          </span>
                        </li>
                      </ul>
                    </div>

                    {/* Order ID if available */}
                    {orderId && (
                      <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/30">
                        <p className="text-xs text-gray-400 text-center">
                          Order ID:{' '}
                          <span className="text-gray-300 font-mono">
                            {orderId}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      className="px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors"
                      onClick={handleClose}
                    >
                      Close
                    </button>
                    <button
                      className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
                      onClick={() => {
                        setStep(1)
                        setOrderId(null)
                        setPaymentStatus(null)
                        setPaymentReceived(false)
                        setIsProcessingPayment(false)
                        setQuote(null)
                        setQuoteError(null)
                        setQuoteLoading(false)
                      }}
                    >
                      Try Again
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
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
