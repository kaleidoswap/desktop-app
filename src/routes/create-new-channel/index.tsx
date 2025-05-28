import { AlertTriangle, Wallet, Info } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { CHANNELS_PATH } from '../../app/router/paths'
import { useAppDispatch } from '../../app/store/hooks'
import { CreateUTXOModal } from '../../components/CreateUTXOModal'
import { Spinner } from '../../components/Spinner'
import { MIN_CHANNEL_CAPACITY } from '../../constants'
import { useUtxoErrorHandler } from '../../hooks/useUtxoErrorHandler'
import { TNewChannelForm } from '../../slices/channel/channel.slice'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'
import { uiSliceActions } from '../../slices/ui/ui.slice'

import { FormError } from './FormError'
import { Step1 } from './Step1'
import { Step2 } from './Step2'
import { Step3 } from './Step3'
import { Step4 } from './Step4'

const DEFAULT_FEE_RATES = {
  fast: 3,
  medium: 2,
  slow: 1,
}

const initialFormState: TNewChannelForm = {
  assetAmount: 0,
  assetId: '',
  assetTicker: '',
  capacitySat: MIN_CHANNEL_CAPACITY,
  fee: 'medium',
  pubKeyAndAddress: '',
}

export const Component = () => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [feeRates, setFeeRates] = useState(DEFAULT_FEE_RATES)
  const [formError, setFormError] = useState<string | null>(null)
  const [formData, setFormData] = useState<TNewChannelForm>(initialFormState)

  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  const [openChannel] = nodeApi.endpoints.openChannel.useLazyQuery()
  const [getBtcBalance] = nodeApi.endpoints.btcBalance.useLazyQuery()
  const [estimateFee] = nodeApi.endpoints.estimateFee.useLazyQuery()
  const [getNetworkInfo] = nodeApi.endpoints.networkInfo.useLazyQuery()

  const [isLoading, setIsLoading] = useState(true)
  const [insufficientBalance, setInsufficientBalance] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [channelOpeningError, setChannelOpeningError] = useState<string | null>(
    null
  )

  const { showUtxoModal, setShowUtxoModal, utxoModalProps, handleApiError } =
    useUtxoErrorHandler()

  // Clear form errors when changing steps
  useEffect(() => {
    setFormError(null)
  }, [step])

  useEffect(() => {
    const fetchFees = async () => {
      try {
        // Get network info first
        const networkInfo = await getNetworkInfo().unwrap()
        const network = networkInfo?.network?.toLowerCase()

        // Use default fee rates for regtest
        if (network === 'regtest') {
          setFeeRates(DEFAULT_FEE_RATES)
          return
        }

        // For other networks, fetch fee rates
        const [slowFee, mediumFee, fastFee] = await Promise.all([
          estimateFee({ blocks: 6 }).unwrap(),
          estimateFee({ blocks: 3 }).unwrap(),
          estimateFee({ blocks: 1 }).unwrap(),
        ])
        setFeeRates({
          fast: fastFee.fee_rate,
          medium: mediumFee.fee_rate,
          slow: slowFee.fee_rate,
        })
      } catch (e) {
        setFormError('Failed to fetch fee rates. Please try again.')
      }
    }

    fetchFees()
  }, [estimateFee, getNetworkInfo])

  useEffect(() => {
    const checkInitialBalance = async () => {
      setIsLoading(true)
      try {
        const response = await getBtcBalance({ skip_sync: false })
        if (response.data) {
          const totalSpendable =
            response.data.vanilla.spendable + response.data.colored.spendable

          setInsufficientBalance(totalSpendable < MIN_CHANNEL_CAPACITY)
        } else {
          throw new Error('Failed to fetch balance')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch balance')
      } finally {
        setIsLoading(false)
      }
    }

    checkInitialBalance()
  }, [getBtcBalance])

  const validateForm = () => {
    if (!formData.pubKeyAndAddress) {
      setFormError('Peer connection information is required')
      return false
    }

    if (!formData.capacitySat || formData.capacitySat < MIN_CHANNEL_CAPACITY) {
      setFormError(
        `Channel capacity must be at least ${MIN_CHANNEL_CAPACITY} satoshis`
      )
      return false
    }

    if (!formData.fee) {
      setFormError('Please select a fee rate')
      return false
    }

    return true
  }

  const openChannelOperation = async () => {
    return await openChannel({
      asset_amount: formData.assetAmount,
      asset_id: formData.assetId,
      capacity_sat: formData.capacitySat,
      fee_rate_msat: feeRates[formData.fee],
      peer_pubkey_and_opt_addr: formData.pubKeyAndAddress,
    }).unwrap()
  }

  const onSubmit = useCallback(async () => {
    if (!validateForm()) {
      return
    }

    setChannelOpeningError(null)

    try {
      const openChannelResponse = await openChannelOperation()

      if (
        'error' in openChannelResponse &&
        typeof openChannelResponse.error === 'string'
      ) {
        throw new Error(openChannelResponse.error)
      }

      setStep(4)
    } catch (error: any) {
      console.error('Failed to open channel:', error)

      // Check if it's a UTXO-related error
      const wasHandled = handleApiError(
        error,
        'channel',
        formData.capacitySat,
        openChannelOperation
      )

      // Only proceed to error step if we didn't handle it with UTXO modal
      if (!wasHandled) {
        setChannelOpeningError(
          error?.data?.error ||
            (error instanceof Error ? error.message : 'Failed to open channel')
        )
        setStep(4)
      }
    }
  }, [openChannel, formData, feeRates, handleApiError, openChannelOperation])

  const handleFormUpdate = (updates: Partial<TNewChannelForm>) => {
    setFormData((prev) => ({
      ...prev,
      ...updates,
    }))
  }

  if (isLoading) {
    return (
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 py-8 px-6 rounded-xl border border-gray-800/50 shadow-xl w-full text-white">
        <div className="flex justify-center items-center h-64">
          <Spinner color="#8FD5EA" overlay={false} size={120} />
          <div className="ml-4 text-gray-400">Checking balance...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 py-8 px-6 rounded-xl border border-gray-800/50 shadow-xl w-full text-white">
        <div className="text-center">
          <FormError message={error} />
          <button
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 py-4 px-4 rounded-xl border border-gray-800/50 shadow-xl w-full text-white">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
          <div>
            <h1 className="text-xl font-bold">Open a New Channel</h1>
            <p className="text-gray-400 text-sm mt-1">
              Create a direct Lightning Network channel with another node
            </p>
          </div>
          <button
            className="px-4 py-2.5 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 transition text-gray-200 font-medium flex items-center"
            onClick={() => navigate(CHANNELS_PATH)}
          >
            ← Back to Channels
          </button>
        </div>

        {/* Step Progress Indicator */}
        {!insufficientBalance && (
          <div className="flex justify-between mb-4">
            <div className="flex items-center">
              <div
                className={`w-8 h-8 ${step >= 1 ? 'bg-blue-500' : 'bg-gray-700'} rounded-full flex items-center justify-center text-white font-bold text-sm`}
              >
                1
              </div>
              <div className="ml-2">
                <p className="font-medium text-white text-sm">
                  Peer Connection
                </p>
                <p className="text-xs text-gray-400">
                  {step === 1
                    ? 'Current step'
                    : step > 1
                      ? 'Completed'
                      : 'Pending'}
                </p>
              </div>
            </div>
            <div className="flex-1 mx-2 mt-5">
              <div className="h-1 bg-gray-700">
                <div
                  className={`h-1 bg-blue-500 transition-all duration-300 ${step > 1 ? 'w-full' : 'w-0'}`}
                ></div>
              </div>
            </div>
            <div className="flex items-center">
              <div
                className={`w-8 h-8 ${step >= 2 ? 'bg-blue-500' : 'bg-gray-700'} rounded-full flex items-center justify-center text-white font-bold text-sm`}
              >
                2
              </div>
              <div className="ml-2">
                <p className="font-medium text-white text-sm">
                  Channel Settings
                </p>
                <p className="text-xs text-gray-400">
                  {step === 2
                    ? 'Current step'
                    : step > 2
                      ? 'Completed'
                      : 'Pending'}
                </p>
              </div>
            </div>
            <div className="flex-1 mx-2 mt-5">
              <div className="h-1 bg-gray-700">
                <div
                  className={`h-1 bg-blue-500 transition-all duration-300 ${step > 2 ? 'w-full' : 'w-0'}`}
                ></div>
              </div>
            </div>
            <div className="flex items-center">
              <div
                className={`w-8 h-8 ${step >= 3 ? 'bg-blue-500' : 'bg-gray-700'} rounded-full flex items-center justify-center text-white font-bold text-sm`}
              >
                3
              </div>
              <div className="ml-2">
                <p className="font-medium text-white text-sm">
                  Review & Confirm
                </p>
                <p className="text-xs text-gray-400">
                  {step === 3
                    ? 'Current step'
                    : step > 3
                      ? 'Completed'
                      : 'Pending'}
                </p>
              </div>
            </div>
            <div className="flex-1 mx-2 mt-5">
              <div className="h-1 bg-gray-700">
                <div
                  className={`h-1 bg-blue-500 transition-all duration-300 ${step > 3 ? 'w-full' : 'w-0'}`}
                ></div>
              </div>
            </div>
            <div className="flex items-center">
              <div
                className={`w-8 h-8 ${step >= 4 ? 'bg-green-500' : 'bg-gray-700'} rounded-full flex items-center justify-center text-white font-bold text-sm`}
              >
                4
              </div>
              <div className="ml-2">
                <p className="font-medium text-white text-sm">Complete</p>
                <p className="text-xs text-gray-400">
                  {step === 4 ? 'Current step' : 'Pending'}
                </p>
              </div>
            </div>
          </div>
        )}

        {insufficientBalance ? (
          <div className="flex flex-col items-center justify-center p-10 animate-fadeIn">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">
              Insufficient Balance
            </h3>
            <p className="text-gray-300 mb-6 text-center max-w-md">
              You need at least{' '}
              <span className="font-medium text-white">
                {MIN_CHANNEL_CAPACITY} satoshis
              </span>{' '}
              to open a channel. Please fund your wallet first.
            </p>
            <div className="flex gap-4">
              <button
                className="px-5 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 transition text-white font-medium shadow-lg shadow-blue-700/20 flex items-center gap-2"
                onClick={() =>
                  dispatch(
                    uiSliceActions.setModal({
                      assetId: undefined,
                      type: 'deposit',
                    })
                  )
                }
              >
                <Wallet className="h-5 w-5" />
                Deposit
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-b from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700/50 shadow-lg py-4 px-4">
            {formError && <FormError message={formError} />}

            {step === 1 && (
              <Step1
                formData={formData}
                onFormUpdate={handleFormUpdate}
                onNext={() => setStep(2)}
              />
            )}

            {step === 2 && (
              <Step2
                feeRates={feeRates}
                formData={formData}
                onBack={() => setStep(1)}
                onFormUpdate={handleFormUpdate}
                onNext={() => setStep(3)}
              />
            )}

            {step === 3 && (
              <Step3
                error={formError || undefined}
                feeRates={feeRates}
                formData={formData}
                onBack={() => setStep(2)}
                onFormUpdate={handleFormUpdate}
                onNext={onSubmit}
              />
            )}

            {step === 4 && (
              <Step4
                error={channelOpeningError}
                onFinish={() => navigate(CHANNELS_PATH)}
                onRetry={() => setStep(3)}
              />
            )}
          </div>
        )}

        {/* Info Section */}
        <div className="flex items-center space-x-2 text-sm text-gray-400 mt-3 p-3 bg-blue-900/20 border border-blue-800/30 rounded-lg">
          <Info className="h-5 w-5 text-blue-400 flex-shrink-0" />
          <p>
            Opening a channel requires an on-chain transaction. Make sure you
            have sufficient Bitcoin balance to cover the channel capacity and
            transaction fees.
          </p>
        </div>
      </div>

      {/* UTXO Modal for handling UTXO-related errors */}
      <CreateUTXOModal
        channelCapacity={utxoModalProps.channelCapacity}
        error={utxoModalProps.error}
        isOpen={showUtxoModal}
        onClose={() => setShowUtxoModal(false)}
        onSuccess={() => setStep(4)}
        operationType={utxoModalProps.operationType}
        retryFunction={utxoModalProps.retryFunction}
      />
    </>
  )
}
