import {
  AlertTriangle,
  Clock,
  Rocket,
  Settings,
  Zap,
  Info,
  Link as ChainIcon,
} from 'lucide-react'
import QRCode from 'qrcode.react'
import React, { useState, useCallback, useEffect } from 'react'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { ClipLoader } from 'react-spinners'
import { toast } from 'react-toastify'

import 'react-toastify/dist/ReactToastify.css'
import { useAppSelector } from '../../app/store/hooks'
import { blocksToTime } from '../../helpers/datetime'
import { formatBitcoinAmount } from '../../helpers/number'
import { Lsps1CreateOrderResponse } from '../../slices/makerApi/makerApi.slice'
import {
  nodeApi,
  NiaAsset,
  NodeApiError,
  SendPaymentResponse,
} from '../../slices/nodeApi/nodeApi.slice'

// PaymentWaiting component - extracted from renderWaitingPayment to fix hooks issue
interface PaymentWaitingProps {
  paymentURI: string
  expiresAt: string
  currentPayment: any
  bitcoinUnit: string
  paymentMethod: 'lightning' | 'onchain'
  order: Lsps1CreateOrderResponse | null
  handleCopy: () => void
}

const PaymentWaiting: React.FC<PaymentWaitingProps> = ({
  paymentURI,
  expiresAt,
  currentPayment,
  bitcoinUnit,
  paymentMethod,
  order,
  handleCopy,
}) => {
  const expiryDate = new Date(expiresAt)
  const now = new Date()
  // Store initial secondsRemaining as a ref to avoid recalculation on re-renders
  const initialSecondsRef = React.useRef(
    Math.max(0, Math.floor((expiryDate.getTime() - now.getTime()) / 1000))
  )
  const [countdown, setCountdown] = useState(initialSecondsRef.current)

  // Use a more stable countdown implementation with useRef to prevent re-renders
  useEffect(() => {
    if (countdown <= 0) return

    const intervalId = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(intervalId)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(intervalId)
  }, []) // Empty dependency array to run only once on mount

  // Format countdown as MM:SS
  const formatCountdown = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  // Get the payment text to copy safely
  const getPaymentTextToCopy = (): string => {
    if (paymentMethod === 'lightning' && order?.payment?.bolt11?.invoice) {
      return order.payment.bolt11.invoice
    } else if (order?.payment?.onchain?.address) {
      return order.payment.onchain.address
    }
    return '' // Fallback to empty string if none available
  }

  return (
    <div className="w-full flex flex-col items-center justify-center p-4">
      <div className="flex flex-col md:flex-row items-center justify-around gap-8 w-full">
        {/* QR Code - NO overlay */}
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <QRCode size={240} value={paymentURI} />
        </div>

        <div className="flex flex-col space-y-4">
          <div className="bg-gray-800/70 p-5 rounded-xl border border-gray-700">
            <div className="flex items-center gap-3 mb-3">
              <h4 className="text-sm text-gray-400">Amount to Pay</h4>
              <div className="flex items-center ml-auto">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                <span className="text-blue-400 text-sm">
                  Waiting for payment
                </span>
              </div>
            </div>
            <p className="text-2xl font-bold text-white">
              {formatBitcoinAmount(
                currentPayment?.order_total_sat || 0,
                bitcoinUnit
              )}{' '}
              {bitcoinUnit}
            </p>

            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Time Remaining:</span>
                <span className="text-white font-mono bg-gray-700/70 px-3 py-1 rounded">
                  {formatCountdown(countdown)}
                </span>
              </div>

              <div className="w-full bg-gray-700/50 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-1000 ease-linear"
                  style={{
                    backgroundColor:
                      countdown < 60
                        ? '#EF4444'
                        : countdown < 180
                          ? '#F59E0B'
                          : '#3B82F6',
                    width: `${(countdown / initialSecondsRef.current) * 100}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-start">
              <div className="text-blue-400 mr-3 mt-0.5">
                <Info size={18} />
              </div>
              <p className="text-gray-400 text-sm">
                Keep this window open. The QR code can be scanned to make
                payment.
                <br />
                This page will update automatically once payment is detected.
              </p>
            </div>
          </div>

          <CopyToClipboard onCopy={handleCopy} text={getPaymentTextToCopy()}>
            <button
              className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 
                      transform transition-all duration-200 hover:scale-105 focus:outline-none 
                      focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            >
              Copy {paymentMethod === 'lightning' ? 'Invoice' : 'Address'}
            </button>
          </CopyToClipboard>
        </div>
      </div>
    </div>
  )
}

interface StepProps {
  onBack: () => void
  loading: boolean
  order: Lsps1CreateOrderResponse | null
  paymentStatus: 'success' | 'error' | 'expired' | null
}

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

const formatAssetAmount = (
  amount: number | undefined,
  precision: number
): string => {
  if (amount === undefined) return '0'
  return (amount / Math.pow(10, precision)).toFixed(precision)
}

export const Step3: React.FC<StepProps> = ({
  onBack,
  loading,
  order,
  paymentStatus,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'lightning' | 'onchain'>(
    'lightning'
  )
  const [useWalletFunds, setUseWalletFunds] = useState(false)
  const bitcoinUnit = useAppSelector((state) => state.settings.bitcoinUnit)
  // Define a proper type for payment state
  type PaymentStateType = 'waiting' | 'success' | 'error' | 'expired' | null
  const [localPaymentState, setLocalPaymentState] =
    useState<PaymentStateType>(null)
  const [isOrderExpired, setIsOrderExpired] = useState(false)

  const [btcBalance, btcBalanceResponse] =
    nodeApi.endpoints.btcBalance.useLazyQuery()
  const [listChannels, listChannelsResponse] =
    nodeApi.endpoints.listChannels.useLazyQuery()
  const [sendPayment] = nodeApi.endpoints.sendPayment.useLazyQuery()
  const [sendBtc] = nodeApi.endpoints.sendBtc.useLazyQuery()
  const [getAssetInfo] = nodeApi.endpoints.listAssets.useLazyQuery()
  const [assetInfo, setAssetInfo] = useState<NiaAsset | null>(null)
  const [selectedFee, setSelectedFee] = useState('normal')
  const [customFee, setCustomFee] = useState(1.0)
  const [showWalletConfirmation, setShowWalletConfirmation] = useState(false)
  const [isProcessingWalletPayment, setIsProcessingWalletPayment] =
    useState(false)

  const feeRates = [
    { label: 'Slow', rate: 1, value: 'slow' },
    { label: 'Normal', rate: 2, value: 'normal' },
    { label: 'Fast', rate: 3, value: 'fast' },
    { label: 'Custom', rate: customFee, value: 'custom' },
  ]

  const [isLoadingData, setIsLoadingData] = useState(false)

  const [decodeInvoice] = nodeApi.endpoints.decodeInvoice.useLazyQuery()

  // Memoize the refresh function
  const refreshData = useCallback(async () => {
    // Only set loading if we don't have data yet
    if (!btcBalanceResponse.data || !listChannelsResponse.data) {
      setIsLoadingData(true)
    }

    try {
      const [balanceResult, channelsResult] = await Promise.all([
        btcBalance({ skip_sync: false }),
        listChannels(),
      ])

      // Only update state if values have changed
      if (
        JSON.stringify(balanceResult.data) !==
          JSON.stringify(btcBalanceResponse.data) ||
        JSON.stringify(channelsResult.data) !==
          JSON.stringify(listChannelsResponse.data)
      ) {
        // Data has changed, allow re-render
        return
      }
    } finally {
      setIsLoadingData(false)
    }
  }, [
    btcBalance,
    listChannels,
    btcBalanceResponse.data,
    listChannelsResponse.data,
  ])

  // Optimize the refresh interval
  useEffect(() => {
    // Only start interval if we're not processing payment
    if (isProcessingWalletPayment) return

    // Initial fetch
    refreshData()

    // Use a simpler interval with less frequent refreshes to avoid too many re-renders
    const interval = setInterval(() => {
      refreshData()
    }, 15000) // Increased to 15 seconds to reduce refresh frequency

    return () => {
      clearInterval(interval)
    }
  }, [refreshData, isProcessingWalletPayment])

  useEffect(() => {
    const fetchAssetInfo = async () => {
      if (order?.asset_id) {
        const result = await getAssetInfo()
        if (result.data) {
          const asset = result.data.nia.find(
            (a) => a.asset_id === order.asset_id
          )
          if (asset) {
            setAssetInfo(asset)
          }
        }
      }
    }
    fetchAssetInfo()
  }, [order?.asset_id, getAssetInfo])

  // Calculate available liquidity
  const channels = listChannelsResponse?.data?.channels || []
  const outboundLiquidity = channels.reduce(
    (sum, channel) => sum + channel.outbound_balance_msat / 1000,
    0
  )
  const vanillaChainBalance = btcBalanceResponse.data?.vanilla.spendable || 0
  const coloredChainBalance = btcBalanceResponse.data?.colored.spendable || 0
  const onChainBalance = vanillaChainBalance + coloredChainBalance

  // Check if the order is expired - Stabilized implementation
  useEffect(() => {
    if (!order?.payment) return

    const expiresAt =
      order.payment.bolt11?.expires_at || order.payment.onchain?.expires_at
    if (!expiresAt) return

    const expiryDate = new Date(expiresAt)
    const now = new Date()

    // If already expired
    if (now > expiryDate) {
      setIsOrderExpired(true)
      setLocalPaymentState('expired')
      return
    }

    // Set up a single timeout for expiry
    const timeToExpiry = expiryDate.getTime() - now.getTime()
    const timerId = setTimeout(() => {
      setIsOrderExpired(true)
      setLocalPaymentState('expired')
    }, timeToExpiry)

    // Clear timeout on unmount
    return () => clearTimeout(timerId)
  }, [order?.payment?.bolt11?.expires_at, order?.payment?.onchain?.expires_at]) // More specific dependencies

  // If payment is started, update localPaymentState to waiting - only run once when initialized
  useEffect(() => {
    if (order && !isOrderExpired && !localPaymentState && !paymentStatus) {
      setLocalPaymentState('waiting')
    }
  }, [order, isOrderExpired, localPaymentState, paymentStatus])

  // Update localPaymentState based on paymentStatus from parent - Simplified
  useEffect(() => {
    if (paymentStatus && paymentStatus !== localPaymentState) {
      setLocalPaymentState(paymentStatus)
    }
  }, [paymentStatus])

  // Function to handle wallet payment
  const handleWalletPayment = async () => {
    setIsProcessingWalletPayment(true)
    try {
      if (paymentMethod === 'lightning' && order?.payment?.bolt11) {
        // First decode and validate the invoice
        const decodeResult = await decodeInvoice({
          invoice: order.payment.bolt11.invoice,
        })

        if ('error' in decodeResult || !decodeResult.data) {
          const error =
            'error' in decodeResult
              ? (decodeResult.error as NodeApiError)
              : { data: { error: 'Failed to decode invoice' } }
          throw new Error(error.data.error)
        }

        // Now we can safely use decodeResult.data
        if (
          decodeResult.data.amt_msat !==
          order.payment.bolt11.order_total_sat * 1000
        ) {
          throw new Error(
            'Invoice amount does not match order amount. Expected: ' +
              order.payment.bolt11.order_total_sat * 1000 +
              ' msat, got: ' +
              decodeResult.data.amt_msat +
              ' msat'
          )
        }

        // If validation passes, send the payment
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

        // Payment is either Pending or Succeeded
        toast.success(
          response.status === 'Pending'
            ? 'Lightning payment initiated successfully!'
            : 'Lightning payment completed successfully!'
        )
        setLocalPaymentState('success')
      } else if (paymentMethod === 'onchain' && order?.payment?.onchain) {
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
        setLocalPaymentState('success')
      }

      setShowWalletConfirmation(false)
    } catch (error) {
      toast.error(
        'Payment failed: ' +
          (error instanceof Error ? error.message : 'Unknown error')
      )
      setLocalPaymentState('error')
    } finally {
      setIsProcessingWalletPayment(false)
    }
  }

  const handleCopy = useCallback(() => {
    toast.success('Payment details copied to clipboard!')
  }, [])

  if (loading || !order) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-b from-gray-900 to-gray-800">
        <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-xl border border-gray-700/50">
          <ClipLoader color={'#3B82F6'} loading={true} size={50} />
          <span className="ml-4 text-gray-300">Loading order details...</span>
        </div>
      </div>
    )
  }

  if (!order.payment || (!order.payment.bolt11 && !order.payment.onchain)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-800 text-white">
        <h3 className="text-2xl font-semibold mb-4">
          Error: Invalid order data
        </h3>
        <button
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 focus:outline-none"
          onClick={onBack}
        >
          Back
        </button>
      </div>
    )
  }

  const totalAmount = order.payment.onchain
    ? order.payment.onchain.order_total_sat / 100000000
    : order.payment.bolt11
      ? order.payment.bolt11.order_total_sat / 100000000
      : 0

  const paymentURI =
    paymentMethod === 'lightning' && order.payment.bolt11
      ? `lightning:${order.payment.bolt11.invoice}`
      : order.payment.onchain
        ? `bitcoin:${order.payment.onchain.address}?amount=${totalAmount}`
        : ''

  const currentPayment =
    paymentMethod === 'lightning' ? order.payment.bolt11 : order.payment.onchain

  const totalCapacity = order.lsp_balance_sat + order.client_balance_sat

  // Render confirmation modal
  const renderWalletConfirmationModal = () => (
    <div className="fixed inset-0 z-50">
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() =>
          !isProcessingWalletPayment && setShowWalletConfirmation(false)
        }
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 max-w-md w-full">
          {isProcessingWalletPayment ? (
            <div className="flex flex-col items-center py-6">
              <div className="w-16 h-16 mb-4">
                <div
                  className="w-full h-full border-4 border-blue-500/30 border-t-blue-500 
                              rounded-full animate-spin"
                />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                Processing Payment
              </h3>
              <p className="text-slate-400 text-center">
                Please wait while we process your payment...
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-yellow-500" />
                <h3 className="text-xl font-bold text-white">
                  Confirm Payment
                </h3>
              </div>
              <div className="space-y-4">
                {/* Payment Details Section */}
                <div className="bg-slate-800/50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Payment Type:</span>
                    <span className="text-white font-medium flex items-center gap-2">
                      {paymentMethod === 'lightning' ? (
                        <>
                          <Zap className="w-4 h-4 text-yellow-500" />
                          Lightning
                        </>
                      ) : (
                        <>
                          <ChainIcon className="w-4 h-4 text-blue-500" />
                          On-chain
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Balance Section */}
                <div className="bg-slate-800/50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Available Balance:</span>
                    <span className="text-white font-medium">
                      {paymentMethod === 'lightning'
                        ? `${formatBitcoinAmount(outboundLiquidity, bitcoinUnit)}`
                        : `${formatBitcoinAmount(onChainBalance, bitcoinUnit)}`}{' '}
                      {bitcoinUnit}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Amount to Pay:</span>
                    <span className="text-white font-medium">
                      {formatBitcoinAmount(
                        currentPayment?.order_total_sat || 0,
                        bitcoinUnit
                      )}{' '}
                      {bitcoinUnit}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Remaining Balance:</span>
                    <span className="text-white font-medium">
                      {formatBitcoinAmount(
                        paymentMethod === 'lightning'
                          ? outboundLiquidity -
                              (currentPayment?.order_total_sat || 0)
                          : onChainBalance -
                              (currentPayment?.order_total_sat || 0),
                        bitcoinUnit
                      )}{' '}
                      {bitcoinUnit}
                    </span>
                  </div>
                </div>

                {/* Fee Section - Only for on-chain */}
                {paymentMethod === 'onchain' && (
                  <div className="bg-slate-800/50 rounded-xl p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Fee Rate:</span>
                      <span className="text-white font-medium">
                        {selectedFee === 'custom'
                          ? `${customFee} sat/vB`
                          : `${feeRates.find((rate) => rate.value === selectedFee)?.rate} sat/vB`}
                      </span>
                    </div>
                  </div>
                )}

                <div className="border-t border-slate-800 my-4" />
                <p className="text-yellow-500/80 text-sm">
                  Please verify all details before confirming. This action
                  cannot be undone.
                </p>
                <div className="flex gap-3 mt-6">
                  <button
                    className="flex-1 py-3 px-4 rounded-xl border border-slate-700
                             text-slate-300 hover:bg-slate-800 transition-colors"
                    onClick={() => setShowWalletConfirmation(false)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700
                             text-white rounded-xl font-medium transition-colors"
                    onClick={handleWalletPayment}
                    type="button"
                  >
                    Confirm Payment
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )

  // Update the wallet payment section in the render
  const renderWalletPaymentSection = () => {
    // Check if we have valid balance data
    const hasBalanceData =
      !isLoadingData &&
      typeof outboundLiquidity === 'number' &&
      typeof onChainBalance === 'number'

    if (!hasBalanceData) {
      return (
        <div className="bg-gray-900/50 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-center gap-3 p-4">
            <ClipLoader color="#3B82F6" size={24} />
            <span className="text-gray-400">Loading wallet balance...</span>
          </div>
        </div>
      )
    }

    const insufficientBalance =
      paymentMethod === 'lightning'
        ? outboundLiquidity < (currentPayment?.order_total_sat || 0)
        : onChainBalance < (currentPayment?.order_total_sat || 0)

    return (
      <div className="bg-gray-900/50 rounded-xl p-6 mb-6">
        {insufficientBalance ? (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
            <div>
              <h4 className="text-red-500 font-medium mb-1">
                Insufficient{' '}
                {paymentMethod === 'lightning' ? 'Lightning' : 'On-chain'}{' '}
                Balance
              </h4>
              <p className="text-gray-400 text-sm">
                {paymentMethod === 'lightning'
                  ? "Your lightning channels don't have enough outbound liquidity for this payment. You can either use an external lightning wallet or switch to on-chain payment."
                  : "Your wallet doesn't have enough on-chain balance for this payment. You can either use an external bitcoin wallet or switch to lightning payment if you have sufficient outbound capacity."}
              </p>
              <div className="mt-2 text-sm">
                <span className="text-gray-400">Required: </span>
                <span className="text-white font-medium">
                  {formatBitcoinAmount(
                    currentPayment?.order_total_sat || 0,
                    bitcoinUnit
                  )}{' '}
                  {bitcoinUnit}
                </span>
                <span className="text-gray-400 mx-2">|</span>
                <span className="text-gray-400">Available: </span>
                <span className="text-white font-medium">
                  {paymentMethod === 'lightning'
                    ? `${formatBitcoinAmount(outboundLiquidity, bitcoinUnit)}`
                    : `${formatBitcoinAmount(onChainBalance, bitcoinUnit)}`}{' '}
                  {bitcoinUnit}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <label className="flex items-center space-x-3">
                <input
                  checked={useWalletFunds}
                  className="form-checkbox h-5 w-5 text-blue-500 rounded border-gray-600 bg-gray-700"
                  onChange={(e) => setUseWalletFunds(e.target.checked)}
                  type="checkbox"
                />
                <span className="text-white font-medium">
                  Pay with Wallet Funds
                </span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Available:</span>
                {isLoadingData ? (
                  <div className="flex items-center gap-2">
                    <ClipLoader color="#3B82F6" size={16} />
                    <span className="text-gray-400">Loading...</span>
                  </div>
                ) : (
                  <span className="text-white font-medium">
                    {paymentMethod === 'lightning'
                      ? `${formatBitcoinAmount(outboundLiquidity, bitcoinUnit)}`
                      : `${formatBitcoinAmount(onChainBalance, bitcoinUnit)}`}{' '}
                    {bitcoinUnit}
                  </span>
                )}
              </div>
            </div>

            {useWalletFunds && (
              <div className="space-y-6">
                {paymentMethod === 'onchain' && (
                  <div>
                    <label className="text-sm font-medium text-slate-400 mb-2 block">
                      Transaction Fee
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      {feeRates.map((rate) => (
                        <button
                          className={`
                            p-4 rounded-xl border-2 transition-all duration-200
                            flex items-center justify-between
                            ${
                              selectedFee === rate.value
                                ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                                : 'border-slate-700 text-slate-400 hover:border-blue-500/50'
                            }
                          `}
                          key={rate.value}
                          onClick={() => setSelectedFee(rate.value)}
                          type="button"
                        >
                          <div className="flex items-center gap-2">
                            {getFeeIcon(rate.value)}
                            <span>{rate.label}</span>
                          </div>
                          <span className="text-sm">
                            {rate.value !== 'custom'
                              ? `${rate.rate} sat/vB`
                              : ''}
                          </span>
                        </button>
                      ))}
                    </div>

                    {selectedFee === 'custom' && (
                      <input
                        className="mt-4 w-full px-4 py-3 bg-slate-800/50 rounded-xl border border-slate-700 
                               focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white"
                        onChange={(e) =>
                          setCustomFee(parseFloat(e.target.value))
                        }
                        placeholder="Enter custom fee rate (sat/vB)"
                        step="0.1"
                        type="number"
                        value={customFee}
                      />
                    )}
                  </div>
                )}

                <button
                  className={`w-full px-6 py-3 rounded-lg transition-all duration-200 
                           flex items-center justify-center gap-2 ${
                             (paymentMethod === 'lightning' &&
                               outboundLiquidity >=
                                 (currentPayment?.order_total_sat || 0)) ||
                             (paymentMethod === 'onchain' &&
                               onChainBalance >=
                                 (currentPayment?.order_total_sat || 0))
                               ? 'bg-blue-500 hover:bg-blue-600 text-white'
                               : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                           }`}
                  disabled={
                    (paymentMethod === 'lightning' &&
                      outboundLiquidity <
                        (currentPayment?.order_total_sat || 0)) ||
                    (paymentMethod === 'onchain' &&
                      onChainBalance < (currentPayment?.order_total_sat || 0))
                  }
                  onClick={() => setShowWalletConfirmation(true)}
                >
                  <span className="flex items-center gap-2">
                    {paymentMethod === 'lightning' ? '⚡' : '₿'}
                    Pay{' '}
                    {formatBitcoinAmount(
                      currentPayment?.order_total_sat || 0,
                      bitcoinUnit
                    )}{' '}
                    {bitcoinUnit}
                    <span className="text-sm opacity-75">
                      {paymentMethod === 'lightning' ? 'off-chain' : 'on-chain'}
                    </span>
                  </span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // Render the waiting payment animation - now just returns the component
  const renderWaitingPayment = () => {
    const expiresAt =
      order?.payment?.bolt11?.expires_at ||
      order?.payment?.onchain?.expires_at ||
      ''

    return (
      <PaymentWaiting
        bitcoinUnit={bitcoinUnit}
        currentPayment={currentPayment}
        expiresAt={expiresAt}
        handleCopy={handleCopy}
        order={order}
        paymentMethod={paymentMethod}
        paymentURI={paymentURI}
      />
    )
  }

  // Render the expired payment message
  const renderExpiredPayment = () => (
    <div className="w-full flex flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center">
        <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-yellow-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">
          Payment Time Expired
        </h3>
        <p className="text-gray-400 text-center">
          The payment time has expired. Please go back and create a new order.
        </p>
      </div>
    </div>
  )

  const renderSuccessMessage = () => (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-6 mb-6">
      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M5 13l4 4L19 7"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">
          Payment {paymentMethod === 'lightning' ? 'Initiated' : 'Successful'}!
        </h3>
        <p className="text-gray-400 mb-4">
          {paymentMethod === 'lightning'
            ? 'Your lightning payment has been initiated. Please wait while we process the payment and set up the channel with the LSP.'
            : 'Your payment has been sent successfully. Please wait while we confirm the channel setup with the LSP.'}
        </p>
        <div className="w-full max-w-sm bg-gray-900/50 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400">Payment Amount:</span>
            <span className="text-white font-medium">
              {formatBitcoinAmount(
                currentPayment?.order_total_sat || 0,
                bitcoinUnit
              )}{' '}
              {bitcoinUnit}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Payment Method:</span>
            <span className="text-white font-medium flex items-center gap-2">
              {paymentMethod === 'lightning' ? (
                <>
                  <Zap className="w-4 h-4 text-yellow-500" />
                  Lightning
                </>
              ) : (
                <>
                  <ChainIcon className="w-4 h-4 text-blue-500" />
                  On-chain
                </>
              )}
            </span>
          </div>
        </div>

        <div className="w-full bg-green-500/10 rounded-xl p-5 border border-green-500/20">
          <div className="flex items-center justify-center mb-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-green-500/20"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-green-500 animate-spin"></div>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-green-400 mb-2">
            Channel Opening in Progress
          </h3>
          <p className="text-gray-400 text-sm">
            Your payment has been received. We are now setting up your channel
            with the Lightning Service Provider.
            <br />
            This process can take a few minutes to complete.
          </p>
          <div className="w-full bg-gray-700/50 rounded-full h-1.5 mt-4 overflow-hidden">
            <div className="bg-green-500 h-1.5 animate-pulse-width"></div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header with Flow Description */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            Complete Your Channel Order
          </h2>
          <p className="text-gray-400 mt-2">
            Choose your preferred payment method
          </p>
        </div>

        {/* Step Progress */}
        <div className="flex justify-between mb-8">
          <div className="flex items-center opacity-50">
            <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-white font-bold">
              1
            </div>
            <div className="ml-3">
              <p className="font-medium text-white">Connect LSP</p>
              <p className="text-sm text-gray-400">Completed</p>
            </div>
          </div>
          <div className="flex-1 mx-4 mt-5">
            <div className="h-1 bg-gray-700">
              <div className="h-1 bg-blue-500 w-full"></div>
            </div>
          </div>
          <div className="flex items-center opacity-50">
            <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-white font-bold">
              2
            </div>
            <div className="ml-3">
              <p className="font-medium text-white">Configure</p>
              <p className="text-sm text-gray-400">Completed</p>
            </div>
          </div>
          <div className="flex-1 mx-4 mt-5">
            <div className="h-1 bg-gray-700"></div>
          </div>
          <div className="flex items-center">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
              3
            </div>
            <div className="ml-3">
              <p className="font-medium text-white">Payment</p>
              <p className="text-sm text-gray-400">Current step</p>
            </div>
          </div>
        </div>

        {/* Order Summary Card */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-6 mb-6">
          <h3 className="text-xl font-semibold text-white mb-6 flex items-center justify-between">
            <div className="flex items-center">
              <span className="bg-blue-500 w-2 h-2 rounded-full mr-2"></span>
              Order Summary
            </div>
            {order.order_id && (
              <div className="text-sm text-gray-400 flex items-center gap-2">
                Order ID:
                <CopyToClipboard
                  onCopy={() => toast.success('Order ID copied to clipboard!')}
                  text={order.order_id}
                >
                  <button className="font-mono bg-gray-900/50 px-2 py-1 rounded hover:bg-gray-900/80 transition-colors cursor-pointer">
                    {order.order_id}
                  </button>
                </CopyToClipboard>
              </div>
            )}
          </h3>

          <div className="space-y-4">
            {/* Channel Capacity Breakdown */}
            <div className="bg-gray-900/50 rounded-lg p-4">
              <span className="text-sm text-gray-400">
                Channel Capacity Breakdown
              </span>
              <div className="mt-2 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Your Balance:</span>
                  <span className="text-white font-medium">
                    {formatBitcoinAmount(order.client_balance_sat, bitcoinUnit)}{' '}
                    {bitcoinUnit}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">LSP Balance:</span>
                  <span className="text-white font-medium">
                    {formatBitcoinAmount(order.lsp_balance_sat, bitcoinUnit)}{' '}
                    {bitcoinUnit}
                  </span>
                </div>
                <div className="h-px bg-gray-700 my-2"></div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 font-medium">
                    Total Capacity:
                  </span>
                  <span className="text-white font-semibold">
                    {formatBitcoinAmount(totalCapacity, bitcoinUnit)}{' '}
                    {bitcoinUnit}
                  </span>
                </div>
              </div>
            </div>

            {order?.asset_id && assetInfo && (
              <div className="bg-gray-900/50 rounded-lg p-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-400">
                    Asset Information
                  </span>
                  <span className="px-2 py-1 bg-blue-500/10 rounded-md text-blue-400 text-xs">
                    RGB Asset
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Asset Name:</span>
                    <span className="text-white font-medium">
                      {assetInfo.name} ({assetInfo.ticker})
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Your Balance:</span>
                    <span className="text-white font-medium">
                      {formatAssetAmount(
                        order.client_asset_amount,
                        assetInfo.precision
                      )}{' '}
                      {assetInfo.ticker}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">LSP Balance:</span>
                    <span className="text-white font-medium">
                      {formatAssetAmount(
                        order.lsp_asset_amount,
                        assetInfo.precision
                      )}{' '}
                      {assetInfo.ticker}
                    </span>
                  </div>
                  <div className="h-px bg-gray-700 my-2"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 font-medium">
                      Total Asset Amount:
                    </span>
                    <span className="text-white font-semibold">
                      {formatAssetAmount(
                        (order.lsp_asset_amount || 0) +
                          (order.client_asset_amount || 0),
                        assetInfo.precision
                      )}{' '}
                      {assetInfo.ticker}
                    </span>
                  </div>
                </div>
                {assetInfo.details && (
                  <div className="mt-3 p-3 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Info className="w-4 h-4" />
                      <span>Asset Details:</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-300">
                      {assetInfo.details}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Cost Breakdown */}
            <div className="bg-gray-900/50 rounded-lg p-4">
              <span className="text-sm text-gray-400">Cost Breakdown</span>
              <div className="mt-2 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Channel Amount:</span>
                  <span className="text-white font-medium">
                    {formatBitcoinAmount(
                      (currentPayment?.order_total_sat || 0) -
                        (currentPayment?.fee_total_sat || 0),
                      bitcoinUnit
                    )}{' '}
                    {bitcoinUnit}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Service Fee:</span>
                  <span className="text-white font-medium">
                    {formatBitcoinAmount(
                      currentPayment?.fee_total_sat || 0,
                      bitcoinUnit
                    )}{' '}
                    {bitcoinUnit}
                  </span>
                </div>
                <div className="h-px bg-gray-700 my-2"></div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 font-medium">Total Cost:</span>
                  <span className="text-white font-semibold">
                    {formatBitcoinAmount(
                      currentPayment?.order_total_sat || 0,
                      bitcoinUnit
                    )}{' '}
                    {bitcoinUnit}
                  </span>
                </div>
              </div>
            </div>

            {/* Channel Duration */}
            <div className="bg-gray-900/50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Channel Duration:</span>
                <span className="text-white font-medium">
                  {order.channel_expiry_blocks} blocks
                  <span className="text-gray-400 ml-2">
                    ({blocksToTime(order.channel_expiry_blocks)})
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-400">
              <span className="text-sm">Order expires at:</span>
              <span className="font-medium">
                {new Date(currentPayment?.expires_at || '').toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Section - Show appropriate message based on payment state */}
        {localPaymentState === 'success' || paymentStatus === 'success' ? (
          renderSuccessMessage()
        ) : (
          <>
            {/* Payment Method Selection */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-6 mb-6">
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center">
                <span className="bg-blue-500 w-2 h-2 rounded-full mr-2"></span>
                Payment Method
              </h3>

              <div className="flex justify-center mb-6">
                <div className="bg-gray-900/50 p-1 rounded-xl">
                  {['lightning', 'onchain'].map((method) => (
                    <button
                      className={`px-6 py-3 rounded-lg transition-all duration-200 ${
                        paymentMethod === method
                          ? 'bg-blue-500 text-white shadow-lg transform scale-105'
                          : 'text-gray-400 hover:text-white'
                      }`}
                      key={method}
                      onClick={() =>
                        setPaymentMethod(method as 'lightning' | 'onchain')
                      }
                    >
                      {method === 'lightning' ? '⚡ Lightning' : '₿ On-chain'}
                    </button>
                  ))}
                </div>
              </div>

              {renderWalletPaymentSection()}

              {!useWalletFunds && (
                <div className="flex flex-col md:flex-row items-center justify-around gap-8">
                  {(() => {
                    // Initial state - show QR and payment info
                    if (localPaymentState === null) {
                      return (
                        <>
                          <div className="bg-white p-6 rounded-xl shadow-lg transition-transform hover:scale-105">
                            <QRCode size={240} value={paymentURI} />
                          </div>

                          <div className="flex flex-col space-y-4">
                            <div className="bg-gray-900/50 p-4 rounded-lg">
                              <h4 className="text-sm text-gray-400 mb-1">
                                Amount to Pay
                              </h4>
                              <p className="text-2xl font-bold text-white">
                                {formatBitcoinAmount(
                                  currentPayment?.order_total_sat || 0,
                                  bitcoinUnit
                                )}{' '}
                                {bitcoinUnit}
                              </p>
                            </div>

                            <CopyToClipboard
                              onCopy={handleCopy}
                              text={
                                paymentMethod === 'lightning' &&
                                order?.payment?.bolt11?.invoice
                                  ? order.payment.bolt11.invoice
                                  : order?.payment?.onchain?.address || ''
                              }
                            >
                              <button
                                className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 
                                         transform transition-all duration-200 hover:scale-105 focus:outline-none 
                                         focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                              >
                                Copy{' '}
                                {paymentMethod === 'lightning'
                                  ? 'Invoice'
                                  : 'Address'}
                              </button>
                            </CopyToClipboard>
                          </div>
                        </>
                      )
                    }

                    // Waiting for payment
                    if (localPaymentState === 'waiting') {
                      return renderWaitingPayment()
                    }

                    // Payment received, channel setup in progress
                    if ((localPaymentState as PaymentStateType) === 'success') {
                      return (
                        <div className="w-full bg-green-500/10 rounded-xl p-8 border border-green-500/20">
                          <div className="flex flex-col items-center text-center">
                            <div className="relative w-16 h-16 mb-4">
                              <div className="absolute inset-0 rounded-full border-4 border-green-500/20"></div>
                              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-green-500 animate-spin"></div>
                            </div>
                            <h3 className="text-xl font-bold text-green-400 mb-2">
                              Channel Opening in Progress
                            </h3>
                            <p className="text-gray-300 mb-4">
                              Your payment has been processed. The LSP is now
                              setting up your channel.
                              <br />
                              This may take a few minutes.
                            </p>
                          </div>
                        </div>
                      )
                    }

                    // Payment expired
                    if (localPaymentState === 'expired') {
                      return renderExpiredPayment()
                    }

                    // Payment failed
                    if (
                      localPaymentState === 'error' ||
                      paymentStatus === 'error'
                    ) {
                      return (
                        <div className="w-full flex flex-col items-center justify-center p-8">
                          <div className="flex flex-col items-center">
                            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                              <svg
                                className="w-8 h-8 text-red-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  d="M6 18L18 6M6 6l12 12"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                />
                              </svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">
                              Payment Failed
                            </h3>
                            <p className="text-gray-400 text-center">
                              The payment could not be completed. Please try
                              again.
                            </p>
                          </div>
                        </div>
                      )
                    }

                    return null
                  })()}
                </div>
              )}
            </div>
          </>
        )}

        {/* Back Button - Hide when payment is successful */}
        {localPaymentState !== 'success' && paymentStatus !== 'success' && (
          <div className="flex justify-center">
            <button
              className="px-8 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 
                       transition-all duration-200 focus:outline-none focus:ring-2 
                       focus:ring-gray-500 focus:ring-opacity-50"
              onClick={onBack}
            >
              ← Back
            </button>
          </div>
        )}
      </div>
      {showWalletConfirmation && renderWalletConfirmationModal()}
    </div>
  )
}
