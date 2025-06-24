import { Info } from 'lucide-react'
import React, { useState, useCallback, useEffect } from 'react'
import { ClipLoader } from 'react-spinners'
import { toast } from 'react-toastify'

import 'react-toastify/dist/ReactToastify.css'
import { useAppSelector } from '../../app/store/hooks'
import { Lsps1CreateOrderResponse } from '../../slices/makerApi/makerApi.slice'
import {
  nodeApi,
  NiaAsset,
  NodeApiError,
  SendPaymentResponse,
} from '../../slices/nodeApi/nodeApi.slice'

import {
  OrderSummary,
  PaymentMethodTabs,
  WalletConfirmationModal,
  QRCodePayment,
  PaymentStatusDisplay,
  WalletPaymentSection,
} from './components'

// PaymentWaiting component
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
  const initialSecondsRef = React.useRef(
    Math.max(0, Math.floor((expiryDate.getTime() - now.getTime()) / 1000))
  )
  const [countdown, setCountdown] = useState(initialSecondsRef.current)

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
  }, [])

  const formatCountdown = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="w-full space-y-6">
      {/* QR Code Section */}
      {order && (
        <QRCodePayment
          bitcoinUnit={bitcoinUnit}
          currentPayment={currentPayment}
          onCopy={handleCopy}
          order={order}
          paymentMethod={paymentMethod}
          paymentURI={paymentURI}
        />
      )}

      {/* Payment Status Section */}
      <div className="space-y-4">
        <div className="bg-gray-800/70 p-5 rounded-xl border border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <h4 className="text-sm text-gray-400">Payment Status</h4>
            <div className="flex items-center ml-auto">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
              <span className="text-blue-400 text-sm">Waiting for payment</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Time Remaining:</span>
              <span className="text-white font-mono bg-gray-700/70 px-3 py-1 rounded text-lg">
                {formatCountdown(countdown)}
              </span>
            </div>

            <div className="w-full bg-gray-700/50 rounded-full h-3">
              <div
                className="h-3 rounded-full transition-all duration-1000 ease-linear"
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
              Keep this window open. The QR code can be scanned to make payment.
              <br />
              This page will update automatically once payment is detected.
            </p>
          </div>
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

const feeRates = [
  { label: 'Slow', rate: 1, value: 'slow' },
  { label: 'Normal', rate: 2, value: 'normal' },
  { label: 'Fast', rate: 3, value: 'fast' },
  { label: 'Custom', rate: 0, value: 'custom' },
]

export const Step3: React.FC<StepProps> = ({
  onBack,
  loading,
  order,
  paymentStatus,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'lightning' | 'onchain'>(
    'lightning'
  )
  const [useWalletFunds, setUseWalletFunds] = useState(true)
  const bitcoinUnit = useAppSelector((state) => state.settings.bitcoinUnit)

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
  const [isLoadingData, setIsLoadingData] = useState(false)

  // Memoize the refresh function
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
    if (isProcessingWalletPayment) return

    refreshData()

    const interval = setInterval(() => {
      refreshData()
    }, 15000)

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
  const outboundLiquidity = Math.max(
    ...(channels.map(
      (channel) => channel.next_outbound_htlc_limit_msat / 1000
    ) || [0])
  )
  const vanillaChainBalance = btcBalanceResponse.data?.vanilla.spendable || 0
  const coloredChainBalance = btcBalanceResponse.data?.colored.spendable || 0
  const onChainBalance = vanillaChainBalance + coloredChainBalance

  // Check if the order is expired
  useEffect(() => {
    if (!order?.payment) return

    const expiresAt =
      order.payment.bolt11?.expires_at || order.payment.onchain?.expires_at
    if (!expiresAt) return

    const expiryDate = new Date(expiresAt)
    const now = new Date()

    if (now > expiryDate) {
      setIsOrderExpired(true)
      setLocalPaymentState('expired')
      return
    }

    const timeToExpiry = expiryDate.getTime() - now.getTime()
    const timerId = setTimeout(() => {
      setIsOrderExpired(true)
      setLocalPaymentState('expired')
    }, timeToExpiry)

    return () => clearTimeout(timerId)
  }, [order?.payment?.bolt11?.expires_at, order?.payment?.onchain?.expires_at])

  useEffect(() => {
    if (order && !isOrderExpired && !localPaymentState && !paymentStatus) {
      setLocalPaymentState('waiting')
    }
  }, [order, isOrderExpired, localPaymentState, paymentStatus])

  useEffect(() => {
    if (paymentStatus && paymentStatus !== localPaymentState) {
      setLocalPaymentState(paymentStatus)
    }
  }, [paymentStatus, localPaymentState])

  // Function to handle wallet payment
  const handleWalletPayment = async () => {
    setIsProcessingWalletPayment(true)
    try {
      if (paymentMethod === 'lightning' && order?.payment?.bolt11) {
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
      <div className="w-full">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center items-center h-64">
            <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-xl border border-gray-700/50">
              <ClipLoader color={'#3B82F6'} loading={true} size={50} />
              <span className="ml-4 text-gray-300">
                Loading order details...
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!order.payment || (!order.payment.bolt11 && !order.payment.onchain)) {
    return (
      <div className="w-full">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col items-center justify-center h-64 text-white">
            <h3 className="text-2xl font-semibold mb-4">
              Error: Invalid order data
            </h3>
            <button
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              onClick={onBack}
            >
              Back
            </button>
          </div>
        </div>
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

  return (
    <div className="w-full">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            Complete Payment
          </h2>
          <p className="text-gray-400 mt-2">
            Make your payment to open the channel
          </p>
        </div>

        {/* Step Progress Indicator */}
        <div className="flex justify-between mb-6">
          <div className="flex items-center opacity-50">
            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white font-bold text-sm">
              ✓
            </div>
            <div className="ml-2">
              <p className="font-medium text-white text-sm">Connect LSP</p>
              <p className="text-xs text-gray-400">Completed</p>
            </div>
          </div>
          <div className="flex-1 mx-2 mt-5">
            <div className="h-1 bg-gray-700">
              <div className="h-1 bg-blue-500 w-full"></div>
            </div>
          </div>
          <div className="flex items-center opacity-50">
            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white font-bold text-sm">
              ✓
            </div>
            <div className="ml-2">
              <p className="font-medium text-white text-sm">Configure</p>
              <p className="text-xs text-gray-400">Completed</p>
            </div>
          </div>
          <div className="flex-1 mx-2 mt-5">
            <div className="h-1 bg-gray-700">
              <div className="h-1 bg-blue-500 w-full"></div>
            </div>
          </div>
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
              3
            </div>
            <div className="ml-2">
              <p className="font-medium text-white text-sm">Payment</p>
              <p className="text-xs text-gray-400">Current step</p>
            </div>
          </div>
        </div>

        {/* Payment Success State */}
        {(localPaymentState === 'success' || paymentStatus === 'success') && (
          <PaymentStatusDisplay
            bitcoinUnit={bitcoinUnit}
            currentPayment={currentPayment}
            paymentMethod={paymentMethod}
            status="success"
          />
        )}

        {/* Payment Error State */}
        {localPaymentState === 'error' && (
          <PaymentStatusDisplay
            bitcoinUnit={bitcoinUnit}
            currentPayment={currentPayment}
            paymentMethod={paymentMethod}
            status="error"
          />
        )}

        {/* Payment Expired State */}
        {localPaymentState === 'expired' && (
          <PaymentStatusDisplay
            bitcoinUnit={bitcoinUnit}
            currentPayment={currentPayment}
            paymentMethod={paymentMethod}
            status="expired"
          />
        )}

        {/* Main Payment Interface */}
        {localPaymentState !== 'success' &&
          paymentStatus !== 'success' &&
          localPaymentState !== 'error' &&
          localPaymentState !== 'expired' && (
            <div className="bg-gray-900 text-white p-6 rounded-lg shadow-lg">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Order Summary */}
                <OrderSummary
                  assetInfo={assetInfo}
                  bitcoinUnit={bitcoinUnit}
                  currentPayment={currentPayment}
                  order={order}
                />

                {/* Payment Interface */}
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-6">
                  <PaymentMethodTabs
                    onMethodChange={setPaymentMethod}
                    paymentMethod={paymentMethod}
                  />

                  <WalletPaymentSection
                    bitcoinUnit={bitcoinUnit}
                    currentPayment={currentPayment}
                    customFee={customFee}
                    isLoadingData={isLoadingData}
                    onChainBalance={onChainBalance}
                    onCustomFeeChange={setCustomFee}
                    onFeeChange={setSelectedFee}
                    onPayClick={() => setShowWalletConfirmation(true)}
                    onUseWalletFundsChange={setUseWalletFunds}
                    outboundLiquidity={outboundLiquidity}
                    paymentMethod={paymentMethod}
                    selectedFee={selectedFee}
                    useWalletFunds={useWalletFunds}
                  />

                  {/* QR Code Payment */}
                  {!useWalletFunds && (
                    <div className="text-center">
                      {localPaymentState === 'waiting' ? (
                        <PaymentWaiting
                          bitcoinUnit={bitcoinUnit}
                          currentPayment={currentPayment}
                          expiresAt={
                            order?.payment?.bolt11?.expires_at ||
                            order?.payment?.onchain?.expires_at ||
                            ''
                          }
                          handleCopy={handleCopy}
                          order={order}
                          paymentMethod={paymentMethod}
                          paymentURI={paymentURI}
                        />
                      ) : (
                        order && (
                          <QRCodePayment
                            bitcoinUnit={bitcoinUnit}
                            currentPayment={currentPayment}
                            onCopy={handleCopy}
                            order={order}
                            paymentMethod={paymentMethod}
                            paymentURI={paymentURI}
                          />
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        {/* Footer */}
        {localPaymentState !== 'success' && paymentStatus !== 'success' && (
          <div className="flex justify-center mt-6">
            <button
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              onClick={onBack}
            >
              Back
            </button>
          </div>
        )}
      </div>

      {/* Wallet Confirmation Modal */}
      <WalletConfirmationModal
        bitcoinUnit={bitcoinUnit}
        currentPayment={currentPayment}
        customFee={customFee}
        feeRates={feeRates}
        isOpen={showWalletConfirmation}
        isProcessing={isProcessingWalletPayment}
        onChainBalance={onChainBalance}
        onClose={() => setShowWalletConfirmation(false)}
        onConfirm={handleWalletPayment}
        outboundLiquidity={outboundLiquidity}
        paymentMethod={paymentMethod}
        selectedFee={selectedFee}
      />
    </div>
  )
}
