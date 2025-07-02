import { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { invoke } from '@tauri-apps/api/core'
import { Info } from 'lucide-react'
import { useCallback, useState, useEffect } from 'react'
import { ClipLoader } from 'react-spinners'
import { toast } from 'react-toastify'

import { MIN_CHANNEL_CAPACITY, MAX_CHANNEL_CAPACITY } from '../../constants'
import {
  makerApi,
  Lsps1CreateOrderResponse,
} from '../../slices/makerApi/makerApi.slice'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'

import { Step1 } from './Step1'
import { Step2 } from './Step2'
import { Step3 } from './Step3'
import { Step4 } from './Step4'
import 'react-toastify/dist/ReactToastify.css'

// Define the asset interface
interface AssetInfo {
  name: string
  ticker: string
  asset_id: string
  precision: number
  min_initial_client_amount: number
  max_initial_client_amount: number
  min_initial_lsp_amount: number
  max_initial_lsp_amount: number
  min_channel_amount: number
  max_channel_amount: number
}

// Helper function to extract meaningful error messages
const extractErrorMessage = (error: any): string => {
  // Handle string errors
  if (typeof error === 'string') {
    return error
  }

  // Handle object errors with nested structures
  if (typeof error === 'object' && error !== null) {
    // Common error message fields
    const possibleFields = ['error', 'message', 'detail', 'description', 'msg']

    for (const field of possibleFields) {
      if (error[field] && typeof error[field] === 'string') {
        return error[field]
      }
    }

    // Check for nested error objects
    if (error.error && typeof error.error === 'object') {
      return extractErrorMessage(error.error)
    }

    // If it's an array, try to extract from the first element
    if (Array.isArray(error) && error.length > 0) {
      return extractErrorMessage(error[0])
    }

    // Last resort: stringify the object but limit length
    const stringified = JSON.stringify(error)
    return stringified.length > 200
      ? stringified.substring(0, 200) + '...'
      : stringified
  }

  return 'Unknown error format'
}

export const Component = () => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [loading, setLoading] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [orderPayload, setOrderPayload] = useState<any>(null)
  const [showBackConfirmation, setShowBackConfirmation] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<
    'success' | 'error' | 'expired' | null
  >(null)
  const [paymentReceived, setPaymentReceived] = useState(false)

  const [nodeInfoRequest] = nodeApi.endpoints.nodeInfo.useLazyQuery()
  const [addressRequest] = nodeApi.endpoints.address.useLazyQuery()
  const [createOrderRequest, createOrderResponse] =
    makerApi.endpoints.create_order.useLazyQuery()
  const [getOrderRequest, getOrderResponse] =
    makerApi.endpoints.get_order.useLazyQuery()
  const [getInfoRequest] = makerApi.endpoints.get_info.useLazyQuery()

  let toastId: string | number | null = null

  useEffect(() => {
    if (orderId && step === 3) {
      let timeoutId: ReturnType<typeof setTimeout> | null = null

      const intervalId = setInterval(async () => {
        const orderResponse = await getOrderRequest({ order_id: orderId })
        const orderData = orderResponse.data

        // Check if payment has been received (either in HOLD or PAID state)
        const paymentState =
          orderData?.payment?.bolt11?.state ||
          orderData?.payment?.onchain?.state
        const paymentJustReceived =
          (paymentState === 'HOLD' || paymentState === 'PAID') &&
          !paymentReceived

        if (paymentJustReceived) {
          setPaymentReceived(true)

          console.log('Payment just received! Saving order to database...')
          console.log('Order ID:', orderId)
          console.log('Order payload:', orderPayload)
          console.log('Order data:', orderData)

          // Save the order to the database when payment is received
          if (orderPayload) {
            try {
              await invoke('insert_channel_order', {
                createdAt: orderData?.created_at || new Date().toISOString(),
                orderId: orderId,
                payload: JSON.stringify(orderPayload),
                status: orderData?.order_state || 'paid',
              })
              console.log('Order saved to database successfully!')
            } catch (error) {
              console.error('Error saving order to database:', error)
            }
          } else {
            console.log('No order payload available to save')
          }

          // Start the 3-minute timeout only after payment is received
          timeoutId = setTimeout(
            () => {
              // When timeout occurs after payment is received, we treat it as an expired order
              setPaymentStatus('expired')
              toast.error(`Order confirmation timed out. Order ID: ${orderId}`)
              setStep(4)
            },
            3 * 60 * 1000
          ) // 3 minutes
        }

        if (orderData?.order_state === 'COMPLETED') {
          clearInterval(intervalId)
          if (timeoutId) clearTimeout(timeoutId)
          setPaymentStatus('success')
          setStep(4)
        } else if (orderData?.order_state === 'FAILED') {
          // Check if payment was actually made or not
          const now = new Date().getTime()
          const bolt11ExpiresAt = orderData?.payment?.bolt11?.expires_at
            ? new Date(orderData.payment.bolt11.expires_at).getTime()
            : 0
          const onchainExpiresAt = orderData?.payment?.onchain?.expires_at
            ? new Date(orderData.payment.onchain.expires_at).getTime()
            : 0

          // Get payment states
          const bolt11State = orderData?.payment?.bolt11?.state
          const onchainState = orderData?.payment?.onchain?.state

          // Check if no payment was actually made
          // Payment states that indicate no payment was made:
          // - EXPECT_PAYMENT: waiting for payment
          // - TIMEOUT: payment timed out before being made
          // - EXPIRED: payment expired
          const noPaymentMadeStates = ['EXPECT_PAYMENT', 'TIMEOUT', 'EXPIRED']
          const bolt11NoPayment = bolt11State
            ? noPaymentMadeStates.includes(bolt11State)
            : true
          const onchainNoPayment = onchainState
            ? noPaymentMadeStates.includes(onchainState)
            : true

          // If no payment was made on either method, show expired instead of error
          // This prevents showing refund messages when no payment was actually made
          const noPaymentMade = bolt11NoPayment && onchainNoPayment

          // Also check if we're past the expiry time as an additional indicator
          const isPastExpiry =
            (bolt11ExpiresAt > 0 && now > bolt11ExpiresAt) ||
            (onchainExpiresAt > 0 && now > onchainExpiresAt)

          clearInterval(intervalId)
          if (timeoutId) clearTimeout(timeoutId)

          // Show 'expired' if no payment was made or if past expiry time
          // Show 'error' only if payment was made but still failed (requires refund)
          setPaymentStatus(noPaymentMade || isPastExpiry ? 'expired' : 'error')
          setStep(4)
        }
      }, 5000)

      return () => {
        clearInterval(intervalId)
        if (timeoutId) clearTimeout(timeoutId)
      }
    }
  }, [orderId, getOrderRequest, step, paymentReceived, orderPayload])

  const onSubmitStep1 = useCallback(
    async (data: { connectionUrl: string; success: boolean }) => {
      if (data.success) {
        setStep(2)
      } else {
        setPaymentStatus('error')
        setStep(4)
      }
    },
    []
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
          assetAmount,
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

        // Validate channel capacity
        if (lspOptions) {
          // Calculate effective min/max capacity
          const effectiveMinCapacity = Math.max(
            MIN_CHANNEL_CAPACITY,
            lspOptions.min_channel_balance_sat
          )
          const effectiveMaxCapacity = Math.min(
            MAX_CHANNEL_CAPACITY,
            lspOptions.max_channel_balance_sat
          )

          if (capacitySat < effectiveMinCapacity) {
            throw new Error(
              `Channel capacity must be at least ${effectiveMinCapacity.toLocaleString()} sats`
            )
          }
          if (capacitySat > effectiveMaxCapacity) {
            throw new Error(
              `Channel capacity cannot exceed ${effectiveMaxCapacity.toLocaleString()} sats`
            )
          }
        }

        // Validate client balance
        if (lspOptions) {
          if (clientBalanceSat < lspOptions.min_initial_client_balance_sat) {
            throw new Error(
              `Your channel liquidity must be at least ${lspOptions.min_initial_client_balance_sat} sats`
            )
          }
          if (clientBalanceSat > lspOptions.max_initial_client_balance_sat) {
            throw new Error(
              `Your channel liquidity cannot exceed ${lspOptions.max_initial_client_balance_sat} sats`
            )
          }
        }

        if (clientBalanceSat > capacitySat) {
          throw new Error('Client balance cannot be greater than capacity')
        }

        // Validate channel expiry
        if (
          lspOptions &&
          channelExpireBlocks > lspOptions.max_channel_expiry_blocks
        ) {
          throw new Error(
            `Channel expiry cannot exceed ${lspOptions.max_channel_expiry_blocks} blocks`
          )
        }

        // Validate asset amount if an asset is selected
        if (assetId && assetAmount) {
          const selectedAsset = assets.find(
            (asset: AssetInfo) => asset.asset_id === assetId
          )
          if (selectedAsset) {
            if (assetAmount < selectedAsset.min_channel_amount) {
              throw new Error(
                `Asset amount must be at least ${selectedAsset.min_channel_amount / Math.pow(10, selectedAsset.precision)} ${selectedAsset.ticker}`
              )
            }
            if (assetAmount > selectedAsset.max_channel_amount) {
              throw new Error(
                `Asset amount cannot exceed ${selectedAsset.max_channel_amount / Math.pow(10, selectedAsset.precision)} ${selectedAsset.ticker}`
              )
            }
          }
        }

        const payload: any = {
          announce_channel: true,
          channel_expiry_blocks: channelExpireBlocks,
          client_balance_sat: clientBalanceSat,
          client_pubkey: clientPubKey,
          funding_confirms_within_blocks:
            lspOptions?.min_funding_confirms_within_blocks || 1,
          lsp_balance_sat: capacitySat - clientBalanceSat,
          refund_onchain_address: addressRefund,
          required_channel_confirmations:
            lspOptions?.min_required_channel_confirmations || 3,
        }

        if (assetId && assetAmount) {
          payload.asset_id = assetId
          payload.lsp_asset_amount = assetAmount
          payload.client_asset_amount = 0
        }

        // Log the payload for the request
        console.log('Payload for create order request:', payload)

        console.log('Sending create order request to LSP...')
        const channelResponse = await createOrderRequest(payload)
        console.log('Create order request completed, response received')

        if (channelResponse.error) {
          let errorMessage =
            'An error occurred while creating the channel order'

          console.error('Create order error details:', {
            error: channelResponse.error,
            payload: payload,
            timestamp: new Date().toISOString(),
          })

          // Handle different types of RTK Query errors
          if ('status' in channelResponse.error) {
            const fetchError = channelResponse.error as FetchBaseQueryError

            // Handle different status codes and error structures
            if (fetchError.status === 'FETCH_ERROR') {
              errorMessage =
                'Network error: Unable to connect to the LSP server. Please check your internet connection and LSP server status.'
            } else if (fetchError.status === 'TIMEOUT_ERROR') {
              errorMessage =
                'Request timeout: The LSP server took too long to respond. Please try again.'
            } else if (fetchError.status === 'PARSING_ERROR') {
              errorMessage =
                'Response parsing error: Invalid data received from the LSP server.'
            } else if (typeof fetchError.status === 'number') {
              // HTTP status errors with improved error extraction
              const extractedError = fetchError.data
                ? extractErrorMessage(fetchError.data)
                : null

              if (fetchError.status >= 400 && fetchError.status < 500) {
                // Client errors (4xx)
                const baseMessage = `Request error (${fetchError.status})`
                if (
                  extractedError &&
                  extractedError !== 'Unknown error format'
                ) {
                  errorMessage = `${baseMessage}: ${extractedError}`
                } else {
                  // Provide specific messages for common 4xx errors
                  switch (fetchError.status) {
                    case 400:
                      errorMessage = `${baseMessage}: Invalid request parameters. Please check your input and try again.`
                      break
                    case 401:
                      errorMessage = `${baseMessage}: Authentication required. Please check your LSP credentials.`
                      break
                    case 403:
                      errorMessage = `${baseMessage}: Access forbidden. You may not have permission to create orders.`
                      break
                    case 404:
                      errorMessage = `${baseMessage}: LSP endpoint not found. Please check the LSP server configuration.`
                      break
                    case 422:
                      errorMessage = `${baseMessage}: Invalid order data. Please verify your channel parameters.`
                      break
                    case 429:
                      errorMessage = `${baseMessage}: Too many requests. Please wait a moment and try again.`
                      break
                    default:
                      errorMessage = `${baseMessage}: Client request error. Please check your input.`
                  }
                }
              } else if (fetchError.status >= 500) {
                // Server errors (5xx)
                errorMessage = `Server error (${fetchError.status}): The LSP server is experiencing issues. Please try again later.`
                if (
                  extractedError &&
                  extractedError !== 'Unknown error format'
                ) {
                  errorMessage += ` Details: ${extractedError}`
                }
              } else {
                errorMessage = `HTTP error (${fetchError.status}): An unexpected error occurred`
                if (
                  extractedError &&
                  extractedError !== 'Unknown error format'
                ) {
                  errorMessage += `: ${extractedError}`
                }
              }
            } else {
              // Non-numeric status (FETCH_ERROR, etc.)
              errorMessage = `Network error: ${fetchError.status || 'Unknown network issue'}`
            }
          } else if ('message' in channelResponse.error) {
            // SerializedError with message
            const message = channelResponse.error.message
            errorMessage = message ? `Request failed: ${message}` : errorMessage
          } else {
            // Fallback for other error types
            const extractedError = extractErrorMessage(channelResponse.error)
            if (extractedError !== 'Unknown error format') {
              errorMessage = `Request failed: ${extractedError}`
            }
          }

          throw new Error(errorMessage)
        } else {
          console.log('Request of channel created successfully!')
          console.log('Response:', channelResponse.data)
          const orderId: string = channelResponse.data?.order_id || ''
          if (!orderId) {
            throw new Error('Could not get order id from server response')
          }
          setOrderId(orderId)
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
    [
      createOrderRequest,
      nodeInfoRequest,
      addressRequest,
      getInfoRequest,
      extractErrorMessage,
    ]
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

  const handleConfirmBack = useCallback(() => {
    setShowBackConfirmation(false)
    setOrderId(null)
    if (toastId) {
      toast.dismiss(toastId)
    }
    setStep(2)
  }, [])

  const BackConfirmationModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => setShowBackConfirmation(false)}
      />
      <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full relative z-10">
        <h3 className="text-xl font-bold text-white mb-4">
          Are you sure you want to go back?
        </h3>
        <p className="text-gray-300 mb-6">
          Going back will cancel your current order. You'll need to create a new
          order if you want to proceed later.
        </p>
        <div className="flex gap-4">
          <button
            className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            onClick={() => setShowBackConfirmation(false)}
          >
            Cancel
          </button>
          <button
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            onClick={handleConfirmBack}
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="bg-gradient-to-b from-gray-900 to-gray-950 py-4 px-4 rounded-xl border border-gray-800/50 shadow-xl w-full text-white relative min-h-fit">
      {loading && (
        <div className="absolute inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50">
          <ClipLoader color={'#123abc'} loading={loading} size={50} />
        </div>
      )}
      {showBackConfirmation && <BackConfirmationModal />}
      <div className={step !== 1 ? 'hidden' : ''}>
        <Step1 onNext={onSubmitStep1} />
      </div>

      <div className={step !== 2 ? 'hidden' : ''}>
        <Step2 onBack={onStepBack} onNext={onSubmitStep2} />
      </div>

      <div className={step !== 3 ? 'hidden' : ''}>
        <Step3
          loading={getOrderResponse.isLoading}
          onBack={onStepBack}
          order={(createOrderResponse.data as Lsps1CreateOrderResponse) || null}
          orderPayload={orderPayload}
          paymentReceived={paymentReceived}
          paymentStatus={paymentStatus}
        />
      </div>

      <div className={step !== 4 ? 'hidden' : ''}>
        <Step4
          orderId={orderId ?? undefined}
          paymentStatus={paymentStatus || 'error'}
        />
      </div>

      {/* Info Section */}
      <div className="flex items-center space-x-2 text-sm text-gray-400 mt-3 p-3 bg-blue-900/20 border border-blue-800/30 rounded-lg">
        <Info className="h-5 w-5 text-blue-400 flex-shrink-0" />
        <p>
          LSP channels provide instant liquidity without requiring you to manage
          on-chain transactions. The LSP handles channel opening and provides
          inbound liquidity for receiving payments.
        </p>
      </div>
    </div>
  )
}
