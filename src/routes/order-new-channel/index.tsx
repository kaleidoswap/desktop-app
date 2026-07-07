import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  getModalPortalTarget,
  getModalPositionClass,
} from '../../helpers/modalPortal'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  CheckCircle,
  Loader2,
} from 'lucide-react'
import { toast } from 'react-toastify'

import { RootState } from '../../app/store'
import { useAppDispatch, useAppSelector } from '../../app/store/hooks'
import kaleidoswapPictogram from '../../assets/logo.svg'
import { ChannelsNav } from '../../components/Channels/ChannelsNav'
import { Spinner } from '../../components/Spinner'
import { MIN_CHANNEL_CAPACITY, MAX_CHANNEL_CAPACITY } from '../../constants'
import { NETWORK_DEFAULTS } from '../../constants/networks'
import { useChannelOrderPaymentMonitor } from '../../hooks/useChannelOrderPaymentMonitor'
import {
  makerApi,
  Lsps1CreateOrderResponse,
} from '../../slices/makerApi/makerApi.slice'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'
import { nodeSettingsActions } from '../../slices/nodeSettings/nodeSettings.slice'
import {
  AssetInfo,
  buildChannelOrderPayload,
  getChannelOrderAccessToken,
  validateChannelParams,
  formatRtkQueryError,
} from '../../utils/channelOrderUtils'

import { Step1 } from './Step1'
import { Step2 } from './Step2'
import { Step3 } from './Step3'
import { Step4 } from './Step4'
import { Step5 } from './Step5'
import 'react-toastify/dist/ReactToastify.css'

export const Component = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const navState = (location.state ?? {}) as {
    preselectedAssetId?: string
    returnTo?: string
  }
  const preselectedAssetId = navState.preselectedAssetId
  const returnTo = navState.returnTo
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [loading, setLoading] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [orderPayload, setOrderPayload] = useState<any>(null)
  const [showBackConfirmation, setShowBackConfirmation] = useState(false)
  const [selectedAssetInfo, setSelectedAssetInfo] = useState<AssetInfo | null>(
    null
  )

  // Initial LSP confirm modal state
  const [showLspConfirm, setShowLspConfirm] = useState(true)
  const [lspConfirmUrl, setLspConfirmUrl] = useState('')
  const [isLoadingLspConfirm, setIsLoadingLspConfirm] = useState(true)
  const [isConnectingLsp, setIsConnectingLsp] = useState(false)

  const dispatch = useAppDispatch()
  const currentAccount = useAppSelector(
    (state: RootState) => state.nodeSettings.data
  )

  const [nodeInfoRequest] = nodeApi.endpoints.nodeInfo.useLazyQuery()
  const [addressRequest] = nodeApi.endpoints.address.useLazyQuery()
  const [getNetworkInfoRequest] = nodeApi.endpoints.networkInfo.useLazyQuery()
  const [connectPeerRequest] = nodeApi.endpoints.connectPeer.useMutation()
  const [listPeersRequest] = nodeApi.endpoints.listPeers.useLazyQuery()
  const [createOrderRequest, createOrderResponse] =
    makerApi.endpoints.create_order.useLazyQuery()
  const [getOrderRequest] = makerApi.endpoints.get_order.useLazyQuery()
  const [getInfoRequest] = makerApi.endpoints.get_info.useLazyQuery()

  useEffect(() => {
    const initDefaultLsp = async () => {
      try {
        const networkInfo = await getNetworkInfoRequest().unwrap()
        if (!networkInfo?.network)
          throw new Error(t('orderChannel.step1.networkInfoNotAvailable'))

        const network = Object.keys(NETWORK_DEFAULTS).find(
          (key) =>
            key.toLowerCase() === String(networkInfo.network).toLowerCase()
        )
        if (!network)
          throw new Error(
            t('orderChannel.step1.unsupportedNetwork', {
              network: networkInfo.network,
            })
          )

        const defaultLspUrl = NETWORK_DEFAULTS[network].default_lsp_url
        if (!defaultLspUrl)
          throw new Error(
            t('orderChannel.step1.noDefaultLspUrl', {
              network: networkInfo.network,
            })
          )

        dispatch(
          nodeSettingsActions.setNodeSettings({
            ...currentAccount,
            default_lsp_url: defaultLspUrl,
            default_maker_url: defaultLspUrl,
          })
        )
        await new Promise((resolve) => setTimeout(resolve, 100))

        const info = await getInfoRequest().unwrap()
        if (info.lsp_connection_url) {
          setLspConfirmUrl(info.lsp_connection_url)
        } else {
          throw new Error(t('orderChannel.step1.lspUrlMissing'))
        }
      } catch (err) {
        // Couldn't auto-select the default LSP — fall back to the manual flow
        // (hide the confirm modal) but surface the reason instead of failing silently.
        toast.error(
          err instanceof Error
            ? err.message
            : t('orderChannel.step1.kaleidoLspFailed')
        )
        setShowLspConfirm(false)
      } finally {
        setIsLoadingLspConfirm(false)
      }
    }
    initDefaultLsp()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleConfirmLsp = async () => {
    if (!lspConfirmUrl) return
    setIsConnectingLsp(true)
    try {
      const pubkey = lspConfirmUrl.split('@')[0]
      const peersResp = await listPeersRequest().unwrap()
      const isConnected = peersResp?.peers?.some(
        (p: any) => p.pubkey === pubkey
      )
      if (!isConnected) {
        const result = await connectPeerRequest({
          peer_pubkey_and_addr: lspConfirmUrl,
        })
        if ('error' in result)
          throw new Error(t('orderChannel.step1.failedToConnectPeer'))
      }
      setShowLspConfirm(false)
      setStep(2)
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : t('orderChannel.step1.failedToConnectPeer'),
        {
          autoClose: 4000,
          position: 'bottom-right',
        }
      )
    } finally {
      setIsConnectingLsp(false)
    }
  }

  const handleCancelLsp = () => {
    setShowLspConfirm(false)
  }

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
    enabled: step === 4,
    getOrder: getOrderRequest,
    onTerminalState: () => setStep(5),
    orderId,
    orderPayload,
  })

  const onSubmitStep1 = useCallback(
    async (data: { connectionUrl: string; success: boolean }) => {
      if (data.success) {
        setStep(2)
      } else {
        setPaymentStatus('error')
        setStep(5)
      }
    },
    [setPaymentStatus]
  )

  const onSubmitStep2 = useCallback(
    async (data: any, asset?: AssetInfo | null) => {
      setSelectedAssetInfo(asset ?? null)
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
          const orderAccessToken = getChannelOrderAccessToken(
            channelResponse.data
          )
          setOrderId(orderId)
          setAccessToken(orderAccessToken)
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
    if (step === 4) {
      setStep(3)
    } else if (step === 3) {
      setShowBackConfirmation(true)
    } else if (returnTo) {
      // Arrived from Market Maker — go back to the originating screen
      navigate(returnTo)
    } else {
      setStep(
        (prevStep) =>
          (prevStep > 1 ? prevStep - 1 : prevStep) as 1 | 2 | 3 | 4 | 5
      )
    }
  }, [step, returnTo, navigate])

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
    if (returnTo) {
      // Arrived from Market Maker — go back to the originating screen
      navigate(returnTo)
    } else {
      setStep(2)
    }
  }, [resetPaymentMonitor, returnTo, navigate])

  const BackConfirmationModal = () => (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => setShowBackConfirmation(false)}
      />
      <div className="w-full max-w-md rounded-3xl border border-border-subtle/50 bg-surface-base shadow-2xl shadow-black/20 relative z-10">
        <div className="px-8 py-8">
          {/* Title row */}
          <div className="flex items-center gap-3 pb-4 border-b border-divider/10 mb-4">
            <ArrowLeft className="w-6 h-6 text-emerald-400" />
            <h3 className="text-xl font-bold text-white">
              {t('orderChannel.backConfirmTitle')}
            </h3>
          </div>
          <p className="text-sm text-content-secondary mb-5">
            {t('orderChannel.backConfirmMessage')}
          </p>
          <div className="flex items-center justify-between">
            <button
              className="px-3 py-2 text-content-secondary hover:text-white transition-colors flex items-center gap-1.5 hover:bg-surface-overlay/50 rounded-lg text-sm"
              onClick={handleConfirmBack}
              type="button"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t('orderChannel.backConfirmGoBack')}
            </button>
            <button
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-sm font-semibold text-[#12131C] hover:bg-primary-emphasis transition-colors"
              onClick={() => setShowBackConfirmation(false)}
              type="button"
            >
              {t('orderChannel.backConfirmCancel')}
              <CheckCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="w-full min-h-full text-white">
      {showLspConfirm &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={`${getModalPositionClass()} inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 pointer-events-auto`}
            onClick={handleCancelLsp}
          >
            <div
              className="bg-surface-base p-6 sm:p-8 rounded-3xl border border-border-subtle/50 max-w-lg w-full shadow-2xl max-h-[calc(100vh-2rem)] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 pb-4 border-b border-divider/10 mb-4">
                <CheckCircle className="w-6 h-6 text-primary flex-shrink-0" />
                <h3 className="text-xl font-bold text-white">
                  {t('orderChannel.step1.alreadyConnected')}
                </h3>
              </div>

              {isLoadingLspConfirm ? (
                <div className="flex items-center justify-center h-20 mb-4">
                  <Spinner color="#15E99A" overlay={false} size={32} />
                </div>
              ) : (
                <div className="mb-9">
                  <div className="flex items-center gap-3 mb-4 pt-5">
                    <img
                      alt="KaleidoSwap"
                      className="w-8 h-8 flex-shrink-0"
                      src={kaleidoswapPictogram}
                    />
                    <span className="text-sm font-medium text-white">
                      KaleidoSwap LSP
                    </span>
                  </div>
                  <div className="p-4 bg-surface-base/50 rounded-xl border border-border-default/50">
                    <p className="text-sm text-content-secondary break-all font-mono">
                      {lspConfirmUrl}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <button
                  className="px-3 py-2 text-content-secondary hover:text-white transition-colors flex items-center gap-1.5 hover:bg-surface-overlay/50 rounded-lg text-sm"
                  onClick={handleCancelLsp}
                  type="button"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  Change
                </button>
                <button
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-sm font-semibold text-[#12131C] hover:bg-primary-emphasis transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={isLoadingLspConfirm || isConnectingLsp}
                  onClick={handleConfirmLsp}
                  type="button"
                >
                  {t('orderChannel.step1.continueButton')}
                  {isConnectingLsp ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>,
          getModalPortalTarget()
        )}

      <div className="mx-auto w-full max-w-screen-xl px-4 pt-2">
        <ChannelsNav />
      </div>
      <div className="py-4 px-4 w-full relative isolate min-h-fit animate-fade-in">
        {loading && (
          <div className="absolute inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50">
            <Spinner color="#15E99A" overlay={false} size={50} />
          </div>
        )}
        {showBackConfirmation && <BackConfirmationModal />}
        {step === 1 && <Step1 onNext={onSubmitStep1} />}

        {step === 2 && (
          <Step2
            onBack={onStepBack}
            onNext={onSubmitStep2}
            preselectedAssetId={preselectedAssetId}
          />
        )}

        {step === 3 && (
          <Step3
            assetInfo={selectedAssetInfo}
            key={orderId ?? 'draft-order'}
            onBack={onStepBack}
            onNext={() => setStep(4)}
            order={
              (createOrderResponse.data as Lsps1CreateOrderResponse) || null
            }
            orderPayload={orderPayload}
          />
        )}

        {step === 4 && (
          <Step4
            detectedPaymentMethod={paymentMethod}
            isProcessingPayment={isProcessingPayment}
            key={orderId ?? 'draft-order'}
            onBack={onStepBack}
            onRestart={handleRestartFlow}
            order={
              (createOrderResponse.data as Lsps1CreateOrderResponse) || null
            }
            orderPayload={orderPayload}
            paymentReceived={paymentReceived}
            paymentStatus={paymentStatus}
          />
        )}

        {step === 5 && (
          <Step5
            onRestart={handleRestartFlow}
            orderId={orderId ?? undefined}
            paymentStatus={paymentStatus || 'error'}
            returnTo={returnTo}
          />
        )}
      </div>
    </div>
  )
}
