import { Info } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ClipLoader } from 'react-spinners'
import { toast } from 'react-toastify'

import { MIN_CHANNEL_CAPACITY, MAX_CHANNEL_CAPACITY } from '../../constants'
import { useChannelOrderPaymentMonitor } from '../../hooks/useChannelOrderPaymentMonitor'
import {
  makerApi,
  Lsps1CreateOrderResponse,
} from '../../slices/makerApi/makerApi.slice'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'
import {
  AssetInfo,
  buildChannelOrderPayload,
  validateChannelParams,
  formatRtkQueryError,
} from '../../utils/channelOrderUtils'

import { Step1 } from './Step1'
import { Step2 } from './Step2'
import { Step3 } from './Step3'
import { Step4 } from './Step4'
import 'react-toastify/dist/ReactToastify.css'

export const Component = () => {
  const { t } = useTranslation()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [loading, setLoading] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [orderPayload, setOrderPayload] = useState<any>(null)
  const [showBackConfirmation, setShowBackConfirmation] = useState(false)

  const [nodeInfoRequest] = nodeApi.endpoints.nodeInfo.useLazyQuery()
  const [addressRequest] = nodeApi.endpoints.address.useLazyQuery()
  const [createOrderRequest, createOrderResponse] =
    makerApi.endpoints.create_order.useLazyQuery()
  const [getOrderRequest] = makerApi.endpoints.get_order.useLazyQuery()
  const [getInfoRequest] = makerApi.endpoints.get_info.useLazyQuery()

  const toastId: string | number | null = null

  const {
    isProcessingPayment,
    paymentMethod,
    paymentReceived,
    paymentStatus,
    reset: resetPaymentMonitor,
    setPaymentStatus,
  } = useChannelOrderPaymentMonitor({
    accessToken,
    enabled: step === 3,
    getOrder: getOrderRequest,
    onTerminalState: () => setStep(4),
    orderId,
    orderPayload,
  })

  const onSubmitStep1 = useCallback(
    async (data: { connectionUrl: string; success: boolean }) => {
      if (data.success) {
        setStep(2)
      } else {
        setPaymentStatus('error')
        setStep(4)
      }
    },
    [setPaymentStatus]
  )

  const onSubmitStep2 = useCallback(
    async (data: any) => {
      setLoading(true)
      try {
        // Validate that we have basic prerequisites
        if (!data) {
          throw new Error('Form data is incomplete or missing')
        }

        console.log('Starting create order request with data:', data)

        // Get node info and refund address
        const nodeInfoResponse = await nodeInfoRequest()
        const addressResponse = await addressRequest()

        const clientPubKey = nodeInfoResponse.data?.pubkey
        const addressRefund = addressResponse.data?.address

        if (!clientPubKey) {
          throw new Error(
            'Could not get client pubkey from node. Please ensure your node is running and accessible.'
          )
        }
        if (!addressRefund) {
          throw new Error(
            'Could not get refund address from node. Please ensure your node is running and accessible.'
          )
        }

        console.log('Node info retrieved successfully:', {
          addressRefund,
          clientPubKey,
        })

        const {
          capacitySat,
          clientBalanceSat,
          assetId,
          lspAssetAmount,
          clientAssetAmount,
          rfqId,
          channelExpireBlocks,
        } = data

        // Get LSP info to validate against constraints
        console.log('Fetching LSP info...')
        const infoResponse = await getInfoRequest()

        if (infoResponse.error) {
          console.error('Failed to get LSP info:', infoResponse.error)
          throw new Error(
            'Could not connect to LSP server. Please check the LSP server URL and ensure it is accessible.'
          )
        }

        const lspOptions = infoResponse.data?.options
        let assets: AssetInfo[] = []

        console.log('LSP info retrieved successfully:', infoResponse.data)

        // Safely extract assets array
        if (
          infoResponse.data?.assets &&
          Array.isArray(infoResponse.data.assets)
        ) {
          assets = infoResponse.data.assets as AssetInfo[]
        }

        // Calculate effective min/max capacity
        const effectiveMinCapacity = lspOptions
          ? Math.max(MIN_CHANNEL_CAPACITY, lspOptions.min_channel_balance_sat)
          : MIN_CHANNEL_CAPACITY
        const effectiveMaxCapacity = lspOptions
          ? Math.min(MAX_CHANNEL_CAPACITY, lspOptions.max_channel_balance_sat)
          : MAX_CHANNEL_CAPACITY

        // Validate channel parameters using shared utility
        const validation = validateChannelParams(
          {
            addressRefund,
            assetId: assetId || undefined,
            capacitySat,
            channelExpireBlocks,
            clientBalanceSat,
            clientPubKey,
            lspAssetAmount:
              (lspAssetAmount || 0) + (clientAssetAmount || 0) || undefined,
            lspOptions,
          },
          assets,
          effectiveMinCapacity,
          effectiveMaxCapacity
        )

        if (!validation.isValid) {
          throw new Error(validation.error)
        }

        // Build payload using shared utility
        const payload = buildChannelOrderPayload({
          addressRefund,
          assetId: assetId || undefined,
          capacitySat,
          channelExpireBlocks,
          clientAssetAmount: clientAssetAmount || undefined,
          clientBalanceSat,
          clientPubKey,
          lspAssetAmount: lspAssetAmount || undefined,
          lspOptions,
          rfqId: rfqId || undefined,
        })

        // Log the payload for the request
        console.log('Payload for create order request:', payload)

        console.log('Sending create order request to LSP...')
        const channelResponse = await createOrderRequest(payload)
        console.log('Create order request completed, response received')

        if (channelResponse.error) {
          console.error('Create order error details:', {
            error: channelResponse.error,
            payload: payload,
            timestamp: new Date().toISOString(),
          })

          const errorMessage = formatRtkQueryError(channelResponse.error as any)
          throw new Error(errorMessage)
        } else {
          console.log('Request of channel created successfully!')
          console.log('Response:', channelResponse.data)
          const orderId: string = channelResponse.data?.order_id || ''
          if (!orderId) {
            throw new Error('Could not get order id from server response')
          }
          setOrderId(orderId)
          setAccessToken(channelResponse.data?.access_token || null)
          setOrderPayload(payload)
          setStep(3)
        }
      } catch (error) {
        console.error('Error creating channel order:', error)
        toast.error(
          error instanceof Error
            ? error.message
            : 'An error occurred while creating the channel order',
          {
            autoClose: 5000,
            position: 'bottom-right',
          }
        )
      } finally {
        setLoading(false)
      }
    },
    [createOrderRequest, nodeInfoRequest, addressRequest, getInfoRequest]
  )

  const onStepBack = useCallback(() => {
    if (step === 3) {
      setShowBackConfirmation(true)
    } else {
      setStep(
        (prevStep) => (prevStep > 1 ? prevStep - 1 : prevStep) as 1 | 2 | 3 | 4
      )
    }
  }, [step])

  const handleRestartFlow = useCallback(() => {
    // Reset all state
    setStep(2)
    setOrderId(null)
    setAccessToken(null)
    setOrderPayload(null)
    resetPaymentMonitor()
    if (toastId) {
      toast.dismiss(toastId)
    }
  }, [resetPaymentMonitor])

  const handleConfirmBack = useCallback(() => {
    setShowBackConfirmation(false)
    setOrderId(null)
    setAccessToken(null)
    setOrderPayload(null)
    resetPaymentMonitor()
    if (toastId) {
      toast.dismiss(toastId)
    }
    setStep(2)
  }, [resetPaymentMonitor])

  const BackConfirmationModal = () => (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => setShowBackConfirmation(false)}
      />
      <div className="bg-surface-overlay rounded-xl p-6 max-w-md w-full relative z-10">
        <h3 className="text-xl font-bold text-white mb-4">
          {t('orderChannel.backConfirmTitle')}
        </h3>
        <p className="text-content-secondary mb-6">
          {t('orderChannel.backConfirmMessage')}
        </p>
        <div className="flex gap-4">
          <button
            className="flex-1 px-4 py-2 bg-surface-high text-white rounded-lg hover:bg-surface-elevated transition-colors"
            onClick={() => setShowBackConfirmation(false)}
          >
            {t('orderChannel.backConfirmCancel')}
          </button>
          <button
            className="flex-1 px-4 py-2 bg-primary text-[#12131C] rounded-lg hover:bg-primary-emphasis transition-colors"
            onClick={handleConfirmBack}
          >
            {t('orderChannel.backConfirmGoBack')}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="bg-gradient-to-b from-gray-900 to-gray-950 py-4 px-4 rounded-xl border border-border-subtle/50 shadow-xl w-full text-white relative isolate min-h-fit">
      {loading && (
        <div className="absolute inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50">
          <ClipLoader color={'#123abc'} loading={loading} size={50} />
        </div>
      )}
      {showBackConfirmation && <BackConfirmationModal />}
      {step === 1 && <Step1 onNext={onSubmitStep1} />}

      {step === 2 && <Step2 onBack={onStepBack} onNext={onSubmitStep2} />}

      {step === 3 && (
        <Step3
          detectedPaymentMethod={paymentMethod}
          isProcessingPayment={isProcessingPayment}
          key={orderId ?? 'draft-order'}
          onBack={onStepBack}
          onRestart={handleRestartFlow}
          order={(createOrderResponse.data as Lsps1CreateOrderResponse) || null}
          orderPayload={orderPayload}
          paymentReceived={paymentReceived}
          paymentStatus={paymentStatus}
        />
      )}

      {step === 4 && (
        <Step4
          onRestart={handleRestartFlow}
          orderId={orderId ?? undefined}
          paymentStatus={paymentStatus || 'error'}
        />
      )}

      {/* Info Section */}
      <div className="flex items-center space-x-2 text-sm text-content-secondary mt-3 p-3 bg-blue-900/20 border border-blue-800/30 rounded-lg">
        <Info className="h-5 w-5 text-blue-400 flex-shrink-0" />
        <p>{t('orderChannel.infoMessage')}</p>
      </div>
    </div>
  )
}
