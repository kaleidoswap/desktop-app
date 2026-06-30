import { AlertTriangle, Wallet } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { ChannelsNav } from '../../components/Channels/ChannelsNav'

import { CHANNELS_PATH } from '../../app/router/paths'
import { FormError } from '../../components/FormError'
import { useAppDispatch } from '../../app/store/hooks'
import { CreateUTXOModal } from '../../components/CreateUTXOModal'
import { Spinner } from '../../components/Spinner'
import { MIN_CHANNEL_CAPACITY } from '../../constants'
import { useUtxoErrorHandler } from '../../hooks/useUtxoErrorHandler'
import { TNewChannelForm } from '../../slices/channel/channel.slice'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'
import { uiSliceActions } from '../../slices/ui/ui.slice'

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
  public: true,
}

export const Component = () => {
  const { t } = useTranslation()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [feeRates, setFeeRates] = useState(DEFAULT_FEE_RATES)
  const [formError, setFormError] = useState<string | null>(null)
  const [formData, setFormData] = useState<TNewChannelForm>(initialFormState)

  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  const [openChannel] = nodeApi.endpoints.openChannel.useMutation()
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
          fast: Math.round(fastFee.fee_rate ?? DEFAULT_FEE_RATES.fast),
          medium: Math.round(mediumFee.fee_rate ?? DEFAULT_FEE_RATES.medium),
          slow: Math.round(slowFee.fee_rate ?? DEFAULT_FEE_RATES.slow),
        })
      } catch (e) {
        setFormError(t('createChannel.errorFetchFeeRates'))
      }
    }

    fetchFees()
  }, [estimateFee, getNetworkInfo, t])

  useEffect(() => {
    const checkInitialBalance = async () => {
      setIsLoading(true)
      try {
        const response = await getBtcBalance()
        if (response.data) {
          const totalSpendable =
            (response.data.vanilla?.spendable ?? 0) +
            (response.data.colored?.spendable ?? 0)

          setInsufficientBalance(totalSpendable < MIN_CHANNEL_CAPACITY)
        } else {
          throw new Error(t('createChannel.errorFetchBalance'))
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t('createChannel.errorFetchBalance')
        )
      } finally {
        setIsLoading(false)
      }
    }

    checkInitialBalance()
  }, [getBtcBalance, t])

  const validateForm = () => {
    if (!formData.pubKeyAndAddress) {
      setFormError(t('createChannel.errorPeerRequired'))
      return false
    }

    if (!formData.capacitySat || formData.capacitySat < MIN_CHANNEL_CAPACITY) {
      setFormError(
        t('createChannel.errorMinCapacity', { amount: MIN_CHANNEL_CAPACITY })
      )
      return false
    }

    if (!formData.fee) {
      setFormError(t('createChannel.errorFeeRequired'))
      return false
    }

    return true
  }

  const openChannelOperation = async () => {
    const payload: any = {
      capacity_sat: formData.capacitySat,
      peer_pubkey_and_opt_addr: formData.pubKeyAndAddress,
      public: formData.public,
    }

    if (formData.assetId && formData.assetAmount > 0) {
      payload.asset_amount = formData.assetAmount
      payload.asset_id = formData.assetId
    }

    return await openChannel(payload).unwrap()
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
      <div className="w-full min-h-full text-white">
        <div className="mx-auto w-full max-w-screen-xl px-4 pt-2">
          <ChannelsNav />
        </div>
        <div className="container mx-auto px-4 py-6 max-w-3xl animate-fade-in">
          <div className="flex flex-col justify-center items-center h-64 gap-4">
            <Spinner color="#15E99A" overlay={false} size={48} />
            <div className="text-content-secondary text-sm">
              {t('createChannel.checkingBalance')}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full min-h-full text-white">
        <div className="mx-auto w-full max-w-screen-xl px-4 pt-2">
          <ChannelsNav />
        </div>
        <div className="container mx-auto px-4 py-6 max-w-3xl animate-fade-in">
          <div className="text-center">
            <FormError message={error} />
            <button
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-emphasis transition-colors"
              onClick={() => window.location.reload()}
            >
              {t('createChannel.retry')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full min-h-full text-white">
      <div className="mx-auto w-full max-w-screen-xl px-4 pt-2">
        <ChannelsNav />
      </div>
      <div className="container mx-auto px-4 py-6 max-w-5xl animate-fade-in">
        {insufficientBalance ? (
          <div className="flex flex-col items-center justify-center p-10 animate-fadeIn">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">
              {t('createChannel.insufficientBalance')}
            </h3>
            <p className="text-content-secondary mb-6 text-center max-w-md">
              {t('createChannel.insufficientBalanceMessage', {
                amount: MIN_CHANNEL_CAPACITY,
              })}
            </p>
            <div className="flex gap-4">
              <button
                className="px-5 py-3 rounded-lg bg-primary hover:bg-primary-emphasis transition text-primary-foreground font-medium shadow-lg shadow-primary/20 flex items-center gap-2"
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
                {t('createChannel.deposit')}
              </button>
            </div>
          </div>
        ) : (
          <div>
            {step === 1 && (
              <Step1
                formData={formData}
                formError={formError}
                onBack={() => navigate(CHANNELS_PATH)}
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
                onGoBack={() => setStep(1)}
                onRetry={() => setStep(3)}
              />
            )}
          </div>
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
    </div>
  )
}
