import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ClipLoader } from 'react-spinners'
import { toast } from 'react-toastify'
import { ArrowLeft, Wallet } from 'lucide-react'

import 'react-toastify/dist/ReactToastify.css'
import { PaymentSection } from '../../components/BuyChannelModal/components'
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
  WalletConfirmationModal,
  PaymentStatusDisplay,
  OrderProcessingDisplay,
  CountdownTimer,
} from './components'

interface StepProps {
  onBack: () => void
  onRestart?: () => void
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

export const Step4: React.FC<StepProps> = ({
  onBack,
  onRestart,
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
  const [, setIsLoadingData] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

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
      const assetId = order?.asset_id || orderPayload?.asset_id
      if (assetId) {
        const result = await getAssetInfo()
        if (result.data) {
          const asset = result.data?.nia?.find(
            (a: any) => a.asset_id === assetId
          )
          if (asset) setAssetInfo(asset)
        }
      }
    }
    fetchAssetInfo()
  }, [order?.asset_id, orderPayload?.asset_id, getAssetInfo])

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

  useEffect(() => {
    if (paymentReceived && localPaymentState === 'waiting') {
      setLocalPaymentState('processing')
    }
  }, [paymentReceived, localPaymentState])

  const handleCountdownExpiry = useCallback(() => {
    setIsOrderExpired(true)
    setLocalPaymentState('expired')
  }, [])

  const handleWalletPayment = async (method: 'lightning' | 'onchain') => {
    setPaymentMethod(method)
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
          throw new Error(t('orderChannel.step3.lightningPaymentFailed'))
        }
        toast.success(t('orderChannel.step3.lightningSuccess'))
        setLocalPaymentState('processing')
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

  const hasLightningOption = !!order?.payment?.bolt11
  const hasOnchainOption = !!order?.payment?.onchain
  const normalizedPaymentMethod =
    paymentMethod === 'lightning' && !hasLightningOption
      ? 'onchain'
      : paymentMethod === 'onchain' && !hasOnchainOption
        ? 'lightning'
        : paymentMethod
  const currentPayment =
    normalizedPaymentMethod === 'lightning'
      ? order?.payment?.bolt11
      : order?.payment?.onchain
  const amountSat =
    order?.payment?.bolt11?.order_total_sat ||
    order?.payment?.onchain?.order_total_sat ||
    0
  const expiryValue =
    order?.payment?.bolt11?.expires_at || order?.payment?.onchain?.expires_at

  useEffect(() => {
    if (normalizedPaymentMethod !== paymentMethod) {
      setPaymentMethod(normalizedPaymentMethod)
    }
  }, [normalizedPaymentMethod, paymentMethod])

  useEffect(() => {
    setLocalPaymentState(null)
    setIsOrderExpired(false)
    setShowWalletConfirmation(false)
    setIsProcessingWalletPayment(false)
  }, [order?.order_id])

  useEffect(() => {
    if (!showWalletConfirmation) return
    contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [showWalletConfirmation])

  if (!order) {
    return (
      <div className="w-full">
        <div className="max-w-lg mx-auto">
          <div className="flex justify-center items-center h-64">
            <div className="bg-surface-overlay/50 backdrop-blur-sm p-8 rounded-xl border border-border-default/50">
              <ClipLoader color={'#15E99A'} loading={true} size={50} />
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
        <div className="max-w-lg mx-auto">
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

  return (
    <div className="w-full relative">
      <div className="max-w-lg mx-auto space-y-5 relative" ref={contentRef}>
        <div className="text-center mt-4 mb-8">
          <h3 className="text-3xl font-bold text-white">
            {t('orderChannel.step4.paymentTitle')}
          </h3>
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
            paymentMethod={detectedPaymentMethod || normalizedPaymentMethod}
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
            paymentMethod={normalizedPaymentMethod}
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
            paymentMethod={normalizedPaymentMethod}
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
            paymentMethod={normalizedPaymentMethod}
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
            <div>
              <div className="rounded-2xl border border-border-default/40 bg-surface-overlay/50 p-5">
                <PaymentSection
                  amountDisplay={`${formatBitcoinAmount(amountSat, bitcoinUnit)} ${bitcoinUnit === 'SAT' ? 'SATS' : bitcoinUnit}`}
                  countdown={
                    expiryValue ? (
                      <CountdownTimer
                        expiresAt={expiryValue}
                        onExpiry={handleCountdownExpiry}
                      />
                    ) : undefined
                  }
                  onCopy={handleCopy}
                  paymentData={order.payment}
                  text={{
                    amountLabel: t('orderChannel.step3.amountToPay'),
                    copyAddress: t('orderChannel.step3.copyAddress'),
                    copyInvoice: t('orderChannel.step3.copyInvoice'),
                    lightningAddressLabel: t('orderChannel.step3.lightning'),
                    lightningAddressTitle: 'Lightning invoice',
                    onchainAddressLabel: t('orderChannel.step3.onchain'),
                    onchainAddressTitle: 'On-chain address',
                    paymentDescription: '',
                    paymentEyebrow: '',
                    paymentTitle: '',
                    qrBadge: 'LN + On-chain',
                    qrDescription:
                      'Compatible wallets can choose the best route automatically.',
                    qrTitle: 'Unified payment QR',
                  }}
                  walletSection={
                    <button
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-[#12131C] transition-colors hover:bg-primary-emphasis"
                      onClick={() => setShowWalletConfirmation(true)}
                      type="button"
                    >
                      <Wallet className="h-4 w-4" />
                      {t('orderChannel.step3.payWithWallet')}
                    </button>
                  }
                />
              </div>
            </div>
          )}

        {/* Footer */}
        {localPaymentState !== 'processing' &&
          localPaymentState !== 'success' &&
          paymentStatus !== 'success' &&
          !isProcessingPayment && (
            <div className="flex justify-center mt-4">
              <button
                className="px-3 py-2 text-content-secondary hover:text-white transition-colors flex items-center gap-1.5 hover:bg-surface-overlay/50 rounded-lg text-sm"
                onClick={onBack}
                type="button"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {t('orderChannel.step3.backButton')}
              </button>
            </div>
          )}

        {/* Wallet Confirmation Modal */}
        <WalletConfirmationModal
          bitcoinUnit={bitcoinUnit}
          customFee={customFee}
          isOpen={showWalletConfirmation}
          isProcessing={isProcessingWalletPayment}
          lightningAmountSat={order.payment?.bolt11?.order_total_sat || 0}
          onChainBalance={onChainBalance}
          onClose={() => setShowWalletConfirmation(false)}
          onCustomFeeChange={setCustomFee}
          onFeeChange={setSelectedFee}
          onPay={handleWalletPayment}
          onchainAmountSat={order.payment?.onchain?.order_total_sat || 0}
          outboundLiquidity={outboundLiquidity}
          selectedFee={selectedFee}
        />
      </div>
    </div>
  )
}
