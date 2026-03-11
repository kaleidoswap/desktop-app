import React, { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ClipLoader } from 'react-spinners'
import { toast } from 'react-toastify'
import QRCode from 'qrcode.react'
import { CopyToClipboard } from 'react-copy-to-clipboard'

import 'react-toastify/dist/ReactToastify.css'
import { useSettings } from '../../hooks/useSettings'
import { formatBitcoinAmount } from '../../helpers/number'
import { Lsps1CreateOrderResponse } from '../../slices/makerApi/makerApi.slice'
import {
  nodeApi,
  NiaAsset,
  NodeApiError,
  SendPaymentResponse,
} from '../../slices/nodeApi/nodeApi.slice'

import {
  OrderSummary,
  WalletConfirmationModal,
  PaymentStatusDisplay,
  OrderProcessingDisplay,
  CountdownTimer,
  FeeSelector,
} from './components'

interface StepProps {
  onBack: () => void
  onRestart?: () => void
  loading: boolean
  order: Lsps1CreateOrderResponse | null
  paymentStatus: 'success' | 'error' | 'expired' | null
  orderPayload?: any
  paymentReceived?: boolean
  isProcessingPayment?: boolean
  detectedPaymentMethod?: 'lightning' | 'onchain' | null
}

const feeRates = [
  { label: 'Slow', rate: 1, value: 'slow' },
  { label: 'Normal', rate: 2, value: 'normal' },
  { label: 'Fast', rate: 3, value: 'fast' },
  { label: 'Custom', rate: 0, value: 'custom' },
]

export const Step3: React.FC<StepProps> = ({
  onBack,
  onRestart,
  loading,
  order,
  paymentStatus,
  orderPayload,
  paymentReceived = false,
  isProcessingPayment = false,
  detectedPaymentMethod = null,
}) => {
  const { t } = useTranslation()
  const [paymentMethod, setPaymentMethod] = useState<'lightning' | 'onchain'>(
    'lightning'
  )
  const { bitcoinUnit } = useSettings()

  type PaymentStateType =
    | 'waiting'
    | 'processing'
    | 'success'
    | 'error'
    | 'expired'
    | null
  const [localPaymentState, setLocalPaymentState] =
    useState<PaymentStateType>(null)
  const [isOrderExpired, setIsOrderExpired] = useState(false)

  const [btcBalance, btcBalanceResponse] =
    nodeApi.endpoints.btcBalance.useLazyQuery()
  const [listChannels, listChannelsResponse] =
    nodeApi.endpoints.listChannels.useLazyQuery()
  const [sendPayment] = nodeApi.endpoints.sendPayment.useMutation()
  const [sendBtc] = nodeApi.endpoints.sendBtc.useMutation()
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
      // Check both order and orderPayload for asset_id
      const assetId = order?.asset_id || orderPayload?.asset_id

      if (assetId) {
        const result = await getAssetInfo()
        if (result.data) {
          const asset = result.data?.nia?.find((a) => a.asset_id === assetId)
          if (asset) {
            setAssetInfo(asset)
          }
        }
      }
    }
    fetchAssetInfo()
  }, [order?.asset_id, orderPayload?.asset_id, getAssetInfo])

  // Calculate available liquidity
  const channels =
    listChannelsResponse?.data?.channels?.filter((channel) => channel.ready) ||
    []
  const outboundLiquidity = Math.max(
    ...(channels.map(
      (channel) => (channel.next_outbound_htlc_limit_msat || 0) / 1000
    ) || [0])
  )
  const vanillaChainBalance = btcBalanceResponse.data?.vanilla?.spendable || 0
  const coloredChainBalance = btcBalanceResponse.data?.colored?.spendable || 0
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

  // Handle external payment detection (QR code payments)
  useEffect(() => {
    if (paymentReceived && localPaymentState === 'waiting') {
      setLocalPaymentState('processing')
    }
  }, [paymentReceived, localPaymentState])

  // Callback for when countdown expires
  const handleCountdownExpiry = useCallback(() => {
    setIsOrderExpired(true)
    setLocalPaymentState('expired')
  }, [])

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
          throw new Error(t('orderChannel.step3.lightningPaymentFailed'))
        }

        toast.success(t('orderChannel.step3.lightningSuccess'))
        setLocalPaymentState('processing')
      } else if (paymentMethod === 'onchain' && order?.payment?.onchain) {
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

        toast.success(t('orderChannel.step3.onchainSuccess'))
        setLocalPaymentState('processing')
      }

      setShowWalletConfirmation(false)
    } catch (error) {
      toast.error(
        t('orderChannel.step3.paymentFailed', {
          error:
            error instanceof Error && error.message
              ? error.message
              : t('orderChannel.step3.unknownError'),
        })
      )
      setLocalPaymentState('error')
    } finally {
      setIsProcessingWalletPayment(false)
    }
  }

  const handleCopy = useCallback(() => {
    toast.success(t('orderChannel.paymentCopied'))
  }, [t])

  if (loading || !order) {
    return (
      <div className="w-full">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center items-center h-64">
            <div className="bg-surface-overlay/50 backdrop-blur-sm p-8 rounded-xl border border-border-default/50">
              <ClipLoader color={'#3B82F6'} loading={true} size={50} />
              <span className="ml-4 text-content-secondary">
                {t('orderChannel.step3.loadingOrder')}
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
              {t('orderChannel.step3.errorInvalidOrder')}
            </h3>
            <button
              className="px-6 py-3 bg-surface-elevated text-white rounded-lg hover:bg-surface-high transition-colors font-medium"
              onClick={onBack}
            >
              {t('orderChannel.step3.backButton')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const currentPayment =
    paymentMethod === 'lightning' ? order.payment.bolt11 : order.payment.onchain

  return (
    <div className="w-full">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            {t('orderChannel.step3.title')}
          </h2>
          <p className="text-content-secondary mt-2">
            {t('orderChannel.step3.subtitle')}
          </p>
        </div>

        {/* Step Progress Indicator */}
        <div className="flex justify-between mb-6">
          <div className="flex items-center opacity-50">
            <div className="w-8 h-8 bg-surface-high rounded-full flex items-center justify-center text-white font-bold text-sm">
              ✓
            </div>
            <div className="ml-2">
              <p className="font-medium text-white text-sm">
                {t('orderChannel.step1.connectLsp')}
              </p>
              <p className="text-xs text-content-secondary">
                {t('orderChannel.step1.completed')}
              </p>
            </div>
          </div>
          <div className="flex-1 mx-2 mt-5">
            <div className="h-1 bg-surface-high">
              <div className="h-1 bg-primary w-full"></div>
            </div>
          </div>
          <div className="flex items-center opacity-50">
            <div className="w-8 h-8 bg-surface-high rounded-full flex items-center justify-center text-white font-bold text-sm">
              ✓
            </div>
            <div className="ml-2">
              <p className="font-medium text-white text-sm">
                {t('orderChannel.step2.step2Label')}
              </p>
              <p className="text-xs text-content-secondary">
                {t('orderChannel.step1.completed')}
              </p>
            </div>
          </div>
          <div className="flex-1 mx-2 mt-5">
            <div className="h-1 bg-surface-high">
              <div className="h-1 bg-primary w-full"></div>
            </div>
          </div>
          <div className="flex items-center">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm">
              3
            </div>
            <div className="ml-2">
              <p className="font-medium text-white text-sm">
                {t('orderChannel.step3.step3Label')}
              </p>
              <p className="text-xs text-content-secondary">
                {t('orderChannel.step1.currentStep')}
              </p>
            </div>
          </div>
        </div>

        {/* Payment Processing State */}
        {(localPaymentState === 'processing' || isProcessingPayment) && (
          <OrderProcessingDisplay
            assetInfo={assetInfo}
            bitcoinUnit={bitcoinUnit}
            currentPayment={currentPayment}
            order={order}
            orderId={order?.order_id}
            orderPayload={orderPayload}
            paymentMethod={detectedPaymentMethod || paymentMethod}
          />
        )}

        {/* Payment Success State */}
        {(localPaymentState === 'success' || paymentStatus === 'success') && (
          <PaymentStatusDisplay
            assetInfo={assetInfo}
            bitcoinUnit={bitcoinUnit}
            currentPayment={currentPayment}
            onBack={onBack}
            onRestart={onRestart}
            order={order}
            orderPayload={orderPayload}
            paymentMethod={paymentMethod}
            status="success"
          />
        )}

        {/* Payment Error State */}
        {localPaymentState === 'error' && (
          <PaymentStatusDisplay
            assetInfo={assetInfo}
            bitcoinUnit={bitcoinUnit}
            currentPayment={currentPayment}
            onBack={onBack}
            onRestart={onRestart}
            order={order}
            orderPayload={orderPayload}
            paymentMethod={paymentMethod}
            status="error"
          />
        )}

        {/* Payment Expired State */}
        {localPaymentState === 'expired' && (
          <PaymentStatusDisplay
            assetInfo={assetInfo}
            bitcoinUnit={bitcoinUnit}
            currentPayment={currentPayment}
            onBack={onBack}
            onRestart={onRestart}
            order={order}
            orderPayload={orderPayload}
            paymentMethod={paymentMethod}
            status="expired"
          />
        )}

        {/* Main Payment Interface */}
        {localPaymentState !== 'processing' &&
          localPaymentState !== 'success' &&
          paymentStatus !== 'success' &&
          localPaymentState !== 'error' &&
          localPaymentState !== 'expired' &&
          !isProcessingPayment && (
            <div className="bg-surface-base text-white p-6 rounded-lg shadow-lg">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Order Summary */}
                <OrderSummary
                  assetInfo={assetInfo}
                  bitcoinUnit={bitcoinUnit}
                  currentPayment={currentPayment}
                  order={order}
                  orderPayload={orderPayload}
                />

                {/* Payment Interface */}
                <div className="bg-surface-overlay/50 backdrop-blur-sm rounded-2xl border border-border-default/50 p-5 space-y-4">
                  {/* Amount + expiry */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-surface-overlay/40 border border-border-subtle">
                    <div>
                      <p className="text-[11px] text-content-tertiary">Amount to pay</p>
                      <p className="text-xl font-bold text-amber-300">
                        {formatBitcoinAmount(currentPayment?.order_total_sat || 0, bitcoinUnit)} {bitcoinUnit}
                      </p>
                    </div>
                    {(order?.payment?.bolt11?.expires_at || order?.payment?.onchain?.expires_at) && (
                      <CountdownTimer
                        expiresAt={
                          order?.payment?.bolt11?.expires_at ||
                          order?.payment?.onchain?.expires_at ||
                          ''
                        }
                        onExpiry={handleCountdownExpiry}
                      />
                    )}
                  </div>

                  {/* BIP21 QR — build URI */}
                  {(() => {
                    const bolt11Invoice = order?.payment?.bolt11?.invoice
                    const onchainAddress = order?.payment?.onchain?.address
                    const amountSat = order?.payment?.bolt11?.order_total_sat || order?.payment?.onchain?.order_total_sat || 0
                    const amountBTC = amountSat / 100_000_000
                    let bip21URI = ''
                    if (bolt11Invoice && onchainAddress) {
                      bip21URI = `bitcoin:${onchainAddress}?amount=${amountBTC}&lightning=${bolt11Invoice}`
                    } else if (bolt11Invoice) {
                      bip21URI = `lightning:${bolt11Invoice}`
                    } else if (onchainAddress) {
                      bip21URI = `bitcoin:${onchainAddress}?amount=${amountBTC}`
                    }
                    return bip21URI ? (
                      <div className="flex justify-center p-4 rounded-xl bg-white/5 border border-border-subtle">
                        <div className="bg-white p-3 rounded-xl shadow-lg">
                          <QRCode size={160} value={bip21URI} />
                        </div>
                      </div>
                    ) : null
                  })()}

                  {/* Copy buttons side by side */}
                  <div className="grid grid-cols-2 gap-2">
                    {order?.payment?.bolt11?.invoice && (
                      <CopyToClipboard onCopy={handleCopy} text={order.payment.bolt11.invoice}>
                        <button className="py-2.5 rounded-xl text-xs font-semibold bg-surface-overlay border border-border-subtle hover:border-blue-400/50 hover:text-blue-300 transition-all flex items-center justify-center gap-1.5">
                          ⚡ {t('orderChannel.step3.copyInvoice')}
                        </button>
                      </CopyToClipboard>
                    )}
                    {order?.payment?.onchain?.address && (
                      <CopyToClipboard onCopy={handleCopy} text={order.payment.onchain.address}>
                        <button className="py-2.5 rounded-xl text-xs font-semibold bg-surface-overlay border border-border-subtle hover:border-amber-400/50 hover:text-amber-300 transition-all flex items-center justify-center gap-1.5">
                          ₿ {t('orderChannel.step3.copyAddress')}
                        </button>
                      </CopyToClipboard>
                    )}
                  </div>

                  <div className="h-px bg-border-subtle" />

                  {/* Wallet payment options — single view, no tabs */}
                  {isLoadingData ? (
                    <div className="flex items-center justify-center gap-2 py-4">
                      <ClipLoader color="#3B82F6" size={20} />
                      <span className="text-content-secondary text-sm">{t('orderChannel.step3.loadingBalance')}</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold text-content-secondary uppercase tracking-wider">
                        Pay from Wallet
                      </p>

                      {/* Lightning option */}
                      {order?.payment?.bolt11 && (
                        <div className={`rounded-xl p-3 border space-y-2 ${
                          outboundLiquidity >= (order.payment.bolt11.order_total_sat || 0)
                            ? 'border-blue-500/30 bg-blue-500/5'
                            : 'border-border-subtle bg-surface-overlay/20 opacity-60'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">⚡</span>
                              <span className="text-xs font-semibold text-content-secondary">Lightning</span>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-content-tertiary">Available</p>
                              <p className={`text-sm font-bold ${
                                outboundLiquidity >= (order.payment.bolt11.order_total_sat || 0)
                                  ? 'text-content-primary' : 'text-red-400'
                              }`}>
                                {formatBitcoinAmount(outboundLiquidity, bitcoinUnit)} {bitcoinUnit}
                              </p>
                            </div>
                          </div>
                          <button
                            disabled={outboundLiquidity < (order.payment.bolt11.order_total_sat || 0)}
                            onClick={() => { setPaymentMethod('lightning'); setShowWalletConfirmation(true) }}
                            className="w-full py-2 rounded-lg text-xs font-bold bg-primary hover:bg-primary-emphasis disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            Pay ⚡ {formatBitcoinAmount(order.payment.bolt11.order_total_sat || 0, bitcoinUnit)} {bitcoinUnit}
                          </button>
                        </div>
                      )}

                      {/* On-chain option */}
                      {order?.payment?.onchain && (
                        <div className={`rounded-xl p-3 border space-y-2 ${
                          onChainBalance >= (order.payment.onchain.order_total_sat || 0)
                            ? 'border-amber-500/30 bg-amber-500/5'
                            : 'border-border-subtle bg-surface-overlay/20 opacity-60'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">⛓️</span>
                              <span className="text-xs font-semibold text-content-secondary">On-chain</span>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-content-tertiary">Available</p>
                              <p className={`text-sm font-bold ${
                                onChainBalance >= (order.payment.onchain.order_total_sat || 0)
                                  ? 'text-content-primary' : 'text-red-400'
                              }`}>
                                {formatBitcoinAmount(onChainBalance, bitcoinUnit)} {bitcoinUnit}
                              </p>
                            </div>
                          </div>
                          <FeeSelector
                            customFee={customFee}
                            onCustomFeeChange={setCustomFee}
                            onFeeChange={setSelectedFee}
                            selectedFee={selectedFee}
                          />
                          <button
                            disabled={onChainBalance < (order.payment.onchain.order_total_sat || 0)}
                            onClick={() => { setPaymentMethod('onchain'); setShowWalletConfirmation(true) }}
                            className="w-full py-2 rounded-lg text-xs font-bold bg-amber-500/80 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-black"
                          >
                            Pay ⛓️ {formatBitcoinAmount(order.payment.onchain.order_total_sat || 0, bitcoinUnit)} {bitcoinUnit}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        {/* Footer */}
        {localPaymentState !== 'processing' &&
          localPaymentState !== 'success' &&
          paymentStatus !== 'success' &&
          !isProcessingPayment && (
            <div className="flex justify-center mt-6">
              <button
                className="px-6 py-3 bg-surface-elevated text-white rounded-lg hover:bg-surface-high transition-colors font-medium"
                onClick={onBack}
              >
                {t('orderChannel.step3.backButton')}
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
