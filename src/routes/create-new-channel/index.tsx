import { AlertTriangle, RefreshCw, Wallet } from 'lucide-react'
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
      <div className="flex justify-center items-center h-full">
        <Spinner color="#8FD5EA" overlay={false} size={120} />
        <div className="ml-4 text-gray-400">Checking balance...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center">
        <FormError message={error} />
        <button
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="max-w-screen-lg w-full bg-blue-darkest/80 backdrop-blur-sm rounded-2xl border border-white/5 shadow-2xl px-8 py-12">
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
              <button
                className="px-5 py-3 rounded-lg border border-white/10 hover:bg-white/5 transition text-white font-medium flex items-center gap-2"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="h-5 w-5" />
                Refresh
              </button>
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}
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
