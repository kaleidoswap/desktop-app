import { ArrowLeft, Clock, Rocket, Settings, Zap } from 'lucide-react'
import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'

import { useAppDispatch, useAppSelector } from '../../../../app/store/hooks'
import { useSettings } from '../../../../hooks/useSettings'
import { BTC_ASSET_ID } from '../../../../constants'
import {
  parseAssetAmountWithPrecision,
  formatAssetAmountWithPrecision,
  getAssetPrecision,
  msatToSat,
  BTCtoSatoshi,
} from '../../../../helpers/number'
import {
  nodeApi,
  NodeApiError as ApiError,
} from '../../../../slices/nodeApi/nodeApi.slice'
import {
  DecodeLNInvoiceResponse as DecodeInvoiceResponse,
  DecodeRgbInvoiceResponse,
} from 'kaleidoswap-sdk'
import { uiSliceActions } from '../../../../slices/ui/ui.slice'

import { WithdrawForm, ConfirmationModal } from './components'
import {
  AddressType,
  FeeEstimations,
  FeeRateOption,
  Fields,
  PaymentStatus,
  HTLCStatus,
  ValidationMessage,
} from './types'
import { getAssignmentAmount } from '../../../../utils/rgbUtils'

const isLightningAddress = (input: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return emailRegex.test(input)
}

// Helper function to create fungible assignment from amount
const createFungibleAssignment = (amount: number): any => {
  return {
    type: 'Fungible',
    value: amount,
  }
}

export const WithdrawModalContent: React.FC = () => {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const { bitcoinUnit } = useSettings()
  const transportEndpoint = useAppSelector(
    (state) => state.nodeSettings.data.proxy_endpoint
  )
  const [assetBalance, setAssetBalance] = useState(0)
  const [showAssetDropdown, setShowAssetDropdown] = useState(false)
  const [customFee, setCustomFee] = useState(1.0)
  const [feeEstimations, setFeeEstimations] = useState<FeeEstimations>({
    fast: 3,
    normal: 2,
    slow: 1,
  })
  const [decodedInvoice, setDecodedInvoice] =
    useState<DecodeInvoiceResponse | null>(null)
  const [decodedRgbInvoice, setDecodedRgbInvoice] =
    useState<DecodeRgbInvoiceResponse | null>(null)
  const [isDecodingInvoice, setIsDecodingInvoice] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [pendingData, setPendingData] = useState<Fields | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)
  const [addressType, setAddressType] = useState<AddressType>('unknown')
  const [validationMessage, setValidationMessage] =
    useState<ValidationMessage | null>(null)
  const [maxLightningCapacity, setMaxLightningCapacity] = useState(0)
  const [maxAssetCapacities, setMaxAssetCapacities] = useState<
    Record<string, number>
  >({})
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(null)
  const [paymentHash, setPaymentHash] = useState<string | null>(null)
  const [isPollingStatus, setIsPollingStatus] = useState(false)

  const [sendBtc] = nodeApi.useSendBtcMutation()
  const [sendRgb] = nodeApi.useSendRgbMutation()
  const [sendPayment] = nodeApi.useSendPaymentMutation()
  const [listPayments] = nodeApi.useLazyListPaymentsQuery()
  const [estimateFee] = nodeApi.useLazyEstimateFeeQuery()
  const [decodeInvoice] = nodeApi.useLazyDecodeInvoiceQuery()
  const [decodeRgbInvoice] = nodeApi.useLazyDecodeRgbInvoiceQuery()

  const assets = nodeApi.endpoints.listAssets.useQuery()
  const channelsQuery = nodeApi.endpoints.listChannels.useQuery(undefined, {
    pollingInterval: 3000,
  })

  const form = useForm<Fields>({
    defaultValues: {
      address: '',
      amount: 0,
      asset_id: BTC_ASSET_ID,
      donation: false,
      fee_rate: 'normal',
      network: 'on-chain',
      witness_amount_sat: 1200, // Default witness amount (min: 512)
    },
  })

  const { watch, setValue } = form
  const network = watch('network')
  const assetId = watch('asset_id')
  const feeRate = watch('fee_rate')

  // Use useMemo to prevent recreating the array on every render
  const availableAssets = useMemo(
    () => [
      { label: bitcoinUnit, value: BTC_ASSET_ID },
      ...((assets.data?.nia || []).map((asset: any) => ({
        label: asset.ticker,
        value: asset.asset_id,
      })) ?? []),
    ],
    [bitcoinUnit, assets.data?.nia]
  )

  const feeRates: FeeRateOption[] = [
    {
      label: t('withdrawModal.form.fees.options.slow'),
      rate: feeEstimations.slow,
      value: 'slow',
    },
    {
      label: t('withdrawModal.form.fees.options.normal'),
      rate: feeEstimations.normal,
      value: 'normal',
    },
    {
      label: t('withdrawModal.form.fees.options.fast'),
      rate: feeEstimations.fast,
      value: 'fast',
    },
    {
      label: t('withdrawModal.form.fees.options.custom'),
      rate: customFee,
      value: 'custom',
    },
  ]

  // Memoized balance fetching functions
  const fetchBtcBalance = useCallback(async () => {
    try {
      const balance = await dispatch(
        nodeApi.endpoints.btcBalance.initiate()
      ).unwrap()

      const spendableBalance = balance?.vanilla?.spendable || 0
      if (bitcoinUnit === 'SAT') {
        setAssetBalance(spendableBalance)
      } else {
        setAssetBalance(spendableBalance / 100000000)
      }

      // Check if BTC balance is zero
      if (spendableBalance === 0) {
        setValidationMessage({
          message: t('withdrawModal.main.errors.zeroBalance', { asset: 'BTC' }),
          type: 'error',
        })
      }
    } catch (error) {
      console.error('Error fetching BTC balance:', error)
      setAssetBalance(0)
      setValidationMessage({
        message: t('withdrawModal.main.errors.fetchBalance', { asset: 'BTC' }),
        type: 'error',
      })
    }
  }, [dispatch, bitcoinUnit, t])

  const fetchAssetBalance = useCallback(
    async (assetId: string) => {
      if (assetId === BTC_ASSET_ID) {
        return fetchBtcBalance()
      }

      try {
        const balance = await dispatch(
          nodeApi.endpoints.assetBalance.initiate({ asset_id: assetId })
        ).unwrap()
        setAssetBalance(balance.spendable || 0)

        // Check if balance is zero
        if (balance?.spendable === 0) {
          const assetInfo = (assets.data?.nia || []).find(
            (a: any) => a.asset_id === assetId
          )
          const ticker =
            assetInfo?.ticker || t('withdrawModal.main.labels.assetFallback')
          setValidationMessage({
            message: t('withdrawModal.main.errors.zeroBalance', {
              asset: ticker,
            }),
            type: 'error',
          })
        }
      } catch (error) {
        console.error(`Error fetching asset balance for ${assetId}:`, error)
        setAssetBalance(0)
        // Check if asset exists in the list
        const assetExists = (assets.data?.nia || []).some(
          (asset: any) => asset.asset_id === assetId
        )
        if (!assetExists) {
          setValidationMessage({
            message: t('withdrawModal.main.errors.assetMissing'),
            type: 'error',
          })
        } else {
          setValidationMessage({
            message: t('withdrawModal.main.errors.fetchAssetBalance'),
            type: 'error',
          })
        }
      }
    },
    [dispatch, fetchBtcBalance, assets.data?.nia, t]
  )

  // Calculate max lightning outbound capacity for BTC and assets
  useEffect(() => {
    if (channelsQuery.data?.channels) {
      const readyChannels = channelsQuery.data.channels.filter(
        (channel) => channel.ready && channel.is_usable
      )

      if (readyChannels.length > 0) {
        // Max BTC HTLC capacity across all ready channels
        const maxOutboundCapacity = Math.max(
          ...readyChannels.map(
            (channel) => channel.next_outbound_htlc_limit_msat || 0
          )
        )
        setMaxLightningCapacity(maxOutboundCapacity)

        // Max local_asset_amount per asset across all ready channels
        const assetCapacities: Record<string, number> = {}
        readyChannels.forEach((channel) => {
          if (channel.asset_id && (channel.asset_local_amount || 0) > 0) {
            if (
              !assetCapacities[channel.asset_id] ||
              (channel.asset_local_amount || 0) >
                assetCapacities[channel.asset_id]
            ) {
              assetCapacities[channel.asset_id] =
                channel.asset_local_amount || 0
            }
          }
        })
        setMaxAssetCapacities(assetCapacities)
      } else {
        setMaxLightningCapacity(0)
        setMaxAssetCapacities({})
      }
    }
  }, [channelsQuery.data])

  // Create a separate, more targeted effect just for polling
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const POLLING_INTERVAL_MS = 3000 // Poll every 3 seconds
    const POLLING_TIMEOUT_MS = 60000 // 60 seconds timeout

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      intervalId = null
      timeoutId = null
    }

    const pollPaymentStatus = async () => {
      // Skip polling if payment hash is missing
      if (!paymentHash) {
        stopPolling()
        return
      }

      try {
        // Use listPayments to check payment status
        const paymentsResponse = await listPayments().unwrap()

        // Find the payment with the matching hash from the decoded invoice
        const payment = (paymentsResponse?.payments || []).find(
          (p) => p.payment_hash === paymentHash
        )

        if (payment) {
          // Use the status directly from the payment response
          const currentStatus = payment.status as HTLCStatus
          setPaymentStatus(currentStatus)

          if (currentStatus !== HTLCStatus.Pending) {
            console.log(`Payment status changed to: ${currentStatus}`)
            setIsPollingStatus(false) // This will clean up in the next render
            setIsConfirming(false)

            if (currentStatus === HTLCStatus.Succeeded) {
              console.log(`Payment status changed to: ${currentStatus}`)

              // Show success toast and close modal immediately
              toast.success(t('withdrawModal.main.toasts.lightningSuccess'), {
                autoClose: 5000,
                progressStyle: { background: '#3B82F6' },
              })

              // Close the modal immediately
              setIsPollingStatus(false)
              setIsConfirming(false)
              setShowConfirmation(false)
              setPendingData(null)
              dispatch(uiSliceActions.setModal({ type: 'none' }))

              return // Exit early to prevent further status changes
            } else {
              // Failed
              setValidationMessage({
                message: t('withdrawModal.main.errors.paymentFailedGeneric'),
                type: 'error',
              })
            }
          }
        }
      } catch (error) {
        console.error('Error polling payment status:', error)
      }
    }

    // Only start polling if we have the necessary conditions
    if (isPollingStatus && paymentHash) {
      // Initial check immediately
      pollPaymentStatus()

      // Set up polling interval
      intervalId = setInterval(pollPaymentStatus, POLLING_INTERVAL_MS)

      // Set up timeout
      timeoutId = setTimeout(() => {
        console.log('Payment polling timed out after 60 seconds')
        setIsPollingStatus(false) // This will clean up in the next render
        setIsConfirming(false)
        setPaymentStatus(HTLCStatus.Failed)
        setValidationMessage({
          message: t('withdrawModal.main.errors.paymentPendingTimeout'),
          type: 'error',
        })
        // Go back to the form instead of closing the modal
        setShowConfirmation(false)
      }, POLLING_TIMEOUT_MS)

      // Cleanup function when effect is cleaned up
      return () => {
        stopPolling()
      }
    }

    // No need for cleanup if we didn't start polling
    return undefined
  }, [paymentHash, isPollingStatus, dispatch, listPayments])

  // Reset and clean up polling state on unmount
  useEffect(() => {
    return () => {
      // Reset all payment statuses and polling state on unmount
      setPaymentHash(null)
      setIsPollingStatus(false)
      setPaymentStatus(null)
      setValidationMessage(null)
    }
  }, [])

  // Function to detect address type and update form accordingly
  const detectAddressType = useCallback(
    async (input: string) => {
      if (!input) {
        setAddressType('unknown')
        setDecodedInvoice(null)
        setDecodedRgbInvoice(null)
        setValidationMessage(null)
        setPaymentHash(null) // Clear payment hash when input is cleared
        return
      }

      setIsDecodingInvoice(true)
      setAddressType('unknown')
      setDecodedInvoice(null)
      setDecodedRgbInvoice(null)
      setValidationMessage(null)
      setPaymentHash(null) // Clear payment hash before decoding

      try {
        if (input.startsWith('ln')) {
          // Lightning invoice
          console.log('Decoding Lightning invoice:', input)
          const decoded = await decodeInvoice({ invoice: input }).unwrap()
          console.log('Decoded Lightning invoice:', decoded)

          setDecodedInvoice(decoded)
          setPaymentHash(decoded.payment_hash || null) // Store payment hash
          setAddressType('lightning')
          setValue('network', 'lightning')

          // Validate invoice amount against balance and capacity
          if (decoded.asset_id && decoded.asset_amount) {
            // Invoice specifies an RGB asset
            setValue('asset_id', decoded.asset_id) // Set asset_id for potential display/validation

            // Get max local asset amount for this asset from channels
            const maxAssetAmount = maxAssetCapacities[decoded.asset_id] || 0

            // Check asset amount against channel capacity
            if (decoded.asset_amount > maxAssetAmount) {
              setValidationMessage({
                message: t('withdrawModal.main.errors.invoiceAssetCapacity', {
                  asset: decoded.asset_id.substring(0, 8),
                  capacity: maxAssetAmount.toLocaleString(),
                  requested: decoded.asset_amount.toLocaleString(),
                }),
                type: 'error',
              })
            }

            // Also validate BTC amount if present (for the 3000 sat RGB fee)
            const amtMsat = decoded.amt_msat || 0
            if (amtMsat > 0) {
              if (amtMsat > maxLightningCapacity) {
                const invoiceAmountSats = amtMsat / 1000
                const maxCapacitySats = maxLightningCapacity / 1000
                setValidationMessage({
                  message: t('withdrawModal.main.errors.invoiceBtcCapacity', {
                    capacity: maxCapacitySats.toLocaleString(),
                    requested: invoiceAmountSats.toLocaleString(),
                  }),
                  type: 'error',
                })
              }
            }
          }
          // If this is a regular BTC invoice with an amount
          else if ((decoded.amt_msat || 0) > 0) {
            // Get the amount in satoshis for display and validation
            const invoiceAmountSats = (decoded.amt_msat || 0) / 1000
            const maxCapacitySats = maxLightningCapacity / 1000

            // Check if we have enough balance for this payment (assuming BTC)
            await fetchBtcBalance()
            const amountInUnit =
              bitcoinUnit === 'SAT'
                ? invoiceAmountSats
                : invoiceAmountSats / 100000000

            if (amountInUnit > assetBalance) {
              setValidationMessage({
                message: t('withdrawModal.main.errors.invoiceExceedsBalance', {
                  amount: invoiceAmountSats.toLocaleString(),
                  balance: assetBalance.toLocaleString(),
                  unit: bitcoinUnit,
                }),
                type: 'error',
              })
            }
            // Check channel capacity after balance check - upgraded to Error from Warning
            else if ((decoded.amt_msat || 0) > maxLightningCapacity) {
              setValidationMessage({
                message: t('withdrawModal.main.errors.invoiceExceedsCapacity', {
                  amount: invoiceAmountSats.toLocaleString(),
                  capacity: maxCapacitySats.toLocaleString(),
                }),
                type: 'error',
              })
            }
          }
          // Zero-amount invoice
          else {
            // Fetch BTC balance for validation when user enters amount
            await fetchBtcBalance()

            // Show info message that user needs to enter amount
            setValidationMessage({
              message: t('withdrawModal.main.info.zeroAmountInvoice'),
              type: 'info',
            })
          }
        } else if (input.startsWith('rgb')) {
          // RGB invoice
          console.log('Decoding RGB invoice:', input)
          try {
            const decodedRgb = await decodeRgbInvoice({
              invoice: input,
            }).unwrap()
            console.log('Decoded RGB invoice:', decodedRgb)

            setDecodedRgbInvoice(decodedRgb)
            setAddressType('rgb')
            setValue('network', 'on-chain')

            // If this is a witness recipient, set default witness_amount_sat if not already set
            if (decodedRgb.recipient_type === 'Witness') {
              const currentWitnessAmount = form.getValues('witness_amount_sat')
              if (!currentWitnessAmount || currentWitnessAmount < 512) {
                setValue('witness_amount_sat', 1200)
              }
            }

            if (decodedRgb.asset_id) {
              setValue('asset_id', decodedRgb.asset_id)
              const assetExists = (assets.data?.nia || []).some(
                (asset: any) => asset.asset_id === decodedRgb.asset_id
              )
              if (!assetExists && decodedRgb.asset_id !== BTC_ASSET_ID) {
                setValidationMessage({
                  message: t('withdrawModal.main.errors.rgbAssetMissing', {
                    asset: decodedRgb.asset_id.substring(0, 8),
                  }),
                  type: 'error',
                })
              } else {
                // Fetch balance and then validate amount if present
                await fetchAssetBalance(decodedRgb.asset_id)
                const assetInfo = (assets.data?.nia || []).find(
                  (a: any) => a.asset_id === decodedRgb.asset_id
                )
                const rgbBalance = assetInfo?.balance?.spendable || 0

                // Check if balance is zero
                if (rgbBalance === 0) {
                  const ticker =
                    assetInfo?.ticker ||
                    t('withdrawModal.main.labels.assetFallback')
                  setValidationMessage({
                    message: t('withdrawModal.main.errors.zeroBalance', {
                      asset: ticker,
                    }),
                    type: 'error',
                  })
                  return
                }

                const assignmentAmount = decodedRgb.assignment
                  ? getAssignmentAmount(decodedRgb.assignment)
                  : undefined
                if (assignmentAmount) {
                  const ticker =
                    assetInfo?.ticker ||
                    t('withdrawModal.main.labels.unknownAsset')

                  // Format the amount as a string for the form field
                  const formattedAmountStr = formatAssetAmountWithPrecision(
                    assignmentAmount,
                    ticker,
                    bitcoinUnit,
                    assets.data?.nia
                  )
                  const formattedBalanceStr = formatAssetAmountWithPrecision(
                    rgbBalance,
                    ticker,
                    bitcoinUnit,
                    assets.data?.nia
                  )

                  if (assignmentAmount > rgbBalance) {
                    setValue('amount', formattedBalanceStr)
                    setValidationMessage({
                      message: t(
                        'withdrawModal.main.warnings.invoiceAdjusted',
                        {
                          asset: ticker,
                          balance: formattedBalanceStr,
                          requested: formattedAmountStr,
                        }
                      ),
                      type: 'warning',
                    })
                  } else {
                    setValue('amount', formattedAmountStr)
                  }
                }
              }
            } else {
              const firstRgbAsset = availableAssets.find(
                (asset) => asset.value !== BTC_ASSET_ID
              )
              if (firstRgbAsset) {
                setValue('asset_id', firstRgbAsset.value)
                await fetchAssetBalance(firstRgbAsset.value)
              } else {
                setValidationMessage({
                  message: t('withdrawModal.main.warnings.noRgbAssets'),
                  type: 'warning',
                })
              }
            }
          } catch (error) {
            console.error('Failed to decode RGB invoice:', error)
            setValidationMessage({
              message: t('withdrawModal.main.errors.decodeRgbFailed'),
              type: 'error',
            })
            setAddressType('invalid')
          }
        } else if (input.startsWith('bc') || input.startsWith('tb')) {
          // Bitcoin address
          setAddressType('bitcoin')
          setValue('network', 'on-chain')
          setValue('asset_id', BTC_ASSET_ID) // Force BTC asset for Bitcoin addresses

          // Immediately fetch Bitcoin balance
          await fetchBtcBalance()
        } else if (isLightningAddress(input)) {
          // Lightning address (email format)
          setAddressType('lightning-address')
          setValue('network', 'lightning')
          setValue('asset_id', BTC_ASSET_ID) // Default to BTC for lightning address
          // For Lightning addresses, we'll fetch BTC balance by default
          await fetchBtcBalance()
        } else if (input) {
          // Invalid input
          setAddressType('invalid')
          setValidationMessage({
            message: t('withdrawModal.main.errors.invalidFormat'),
            type: 'error',
          })
        }
      } catch (error) {
        console.error('Failed to decode input', error)
        setAddressType('invalid')
        setValidationMessage({
          message: t('withdrawModal.main.errors.decodeInputFailed'),
          type: 'error',
        })
      } finally {
        setIsDecodingInvoice(false)
      }
    },
    [
      decodeInvoice,
      decodeRgbInvoice,
      setValue,
      assets.data?.nia,
      fetchAssetBalance,
      fetchBtcBalance,
      maxLightningCapacity,
      maxAssetCapacities,
      availableAssets,
      bitcoinUnit,
      assetBalance,
      t,
    ]
  ) // Added bitcoinUnit, assetBalance, and maxAssetCapacities dependencies

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      setValue('address', text)
      await detectAddressType(text)
    } catch (error) {
      console.error('Failed to read clipboard', error)
    }
  }, [setValue, detectAddressType])

  const handleInvoiceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value
      detectAddressType(input)
    },
    [detectAddressType]
  )

  // Function to get the minimum amount for a given address type
  const getMinAmount = useCallback(() => {
    // Always consider fee and dust limit for on-chain btc transactions
    if (addressType === 'bitcoin' && assetId === BTC_ASSET_ID) {
      return 546 // Dust limit in sats
    }

    // For lightning payments, need to use a limit based on invoice or capacity
    if (addressType === 'lightning') {
      if (decodedInvoice?.amt_msat) {
        // If invoice has an amount, use that as the min
        return msatToSat(decodedInvoice.amt_msat)
      }
      // Return a reasonable min for lightning (1 sat)
      return 1
    }

    // For other assets or address types, use 1 as minimum
    return 1
  }, [addressType, assetId, decodedInvoice, maxLightningCapacity]) // Add missing dependency

  const getMinAmountMessage = useCallback(() => {
    if (assetId === BTC_ASSET_ID) {
      return bitcoinUnit === 'SAT'
        ? t('withdrawModal.form.amount.minBitcoinSat')
        : t('withdrawModal.form.amount.minBitcoinBtc')
    }

    const assetInfo = (assets.data?.nia || []).find(
      (a: any) => a.asset_id === assetId
    )
    const ticker =
      assetInfo?.ticker || t('withdrawModal.main.labels.unknownAsset')
    const precision = getAssetPrecision(ticker, bitcoinUnit, assets.data?.nia)
    const minAmount = 1 / Math.pow(10, precision)
    return t('withdrawModal.form.amount.minAssetAmount', {
      amount: minAmount,
      ticker,
    })
  }, [assetId, assets.data?.nia, bitcoinUnit, t])

  const getFeeIcon = useCallback((type: string) => {
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
  }, [])

  const onSubmit = useCallback(
    async (data: Fields) => {
      if (validationMessage?.type === 'error') {
        toast.error(validationMessage.message, {
          autoClose: 5000,
        })
        return
      }

      if (data.asset_id !== BTC_ASSET_ID) {
        const assetExists = (assets.data?.nia || []).some(
          (asset: any) => asset.asset_id === data.asset_id
        )
        if (!assetExists) {
          toast.error(t('withdrawModal.main.errors.assetMissing'), {
            autoClose: 5000,
          })
          return
        }
      }

      if (assetBalance === 0) {
        const assetInfo =
          data.asset_id === BTC_ASSET_ID
            ? null
            : (assets.data?.nia || []).find(
                (a: any) => a.asset_id === data.asset_id
              )
        const ticker =
          assetInfo?.ticker ||
          (data.asset_id === BTC_ASSET_ID
            ? 'BTC'
            : t('withdrawModal.main.labels.assetFallback'))
        toast.error(
          t('withdrawModal.main.errors.zeroBalance', { asset: ticker }),
          {
            autoClose: 5000,
          }
        )
        return
      }

      if (data.network === 'on-chain' && data.asset_id !== BTC_ASSET_ID) {
        const enteredAmount = Number(data.amount)
        if (enteredAmount > assetBalance) {
          toast.error(
            t('withdrawModal.main.errors.onchainExceedsBalance', {
              amount: enteredAmount,
              balance: assetBalance,
            }),
            {
              autoClose: 5000,
            }
          )
          return
        }
      }

      // For Lightning payments, verify capacity one more time before proceeding to confirmation
      if (data.network === 'lightning' && decodedInvoice) {
        // Only check capacity for BTC invoices with an amount
        const amtMsat = decodedInvoice?.amt_msat || 0
        if (amtMsat > 0 && !decodedInvoice.asset_id) {
          const invoiceAmountSats = amtMsat / 1000
          const maxCapacitySats = maxLightningCapacity / 1000

          // Final capacity check
          if (amtMsat > maxLightningCapacity) {
            toast.error(
              t('withdrawModal.main.errors.capacityToast', {
                amount: invoiceAmountSats.toLocaleString(),
                capacity: maxCapacitySats.toLocaleString(),
              }),
              {
                autoClose: 5000,
              }
            )
            return
          }
        }
      }

      const formattedData = { ...data }

      if (formattedData.network === 'lightning' && decodedInvoice) {
        // Set the decoded invoice in the formatted data
        formattedData.decodedInvoice = decodedInvoice

        if (decodedInvoice.asset_id && decodedInvoice.asset_amount) {
          // RGB Lightning Invoice with asset
          formattedData.asset_id = decodedInvoice.asset_id
          formattedData.amount = decodedInvoice.asset_amount
        } else if ((decodedInvoice?.amt_msat || 0) > 0) {
          // Standard BTC Lightning invoice - convert using helpers
          const amountSats = msatToSat(decodedInvoice.amt_msat || 0)
          formattedData.asset_id = BTC_ASSET_ID // Ensure asset_id is set to BTC

          // Convert to the appropriate unit based on user's setting
          if (bitcoinUnit === 'SAT') {
            formattedData.amount = amountSats
          } else {
            // Convert satoshis to BTC
            formattedData.amount = amountSats / 100000000
          }
        } else {
          // Zero-amount invoice - use user-entered amount from form
          formattedData.asset_id = BTC_ASSET_ID
          // formattedData.amount is already set from form input
          // Validate that amount was provided
          const amountValue = Number(formattedData.amount)
          if (!formattedData.amount || amountValue <= 0) {
            toast.error(t('withdrawModal.main.errors.zeroAmountRequired'), {
              autoClose: 5000,
            })
            return
          }
        }
      }

      setPendingData({
        ...formattedData,
        decodedInvoice:
          formattedData.network === 'lightning' ? decodedInvoice : null,
      } as Fields)

      setShowConfirmation(true)
    },
    [
      validationMessage,
      assetBalance,
      BTC_ASSET_ID,
      decodedInvoice,
      bitcoinUnit,
      maxLightningCapacity,
      assets.data?.nia,
      t,
    ]
  )

  const handleConfirmedSubmit = useCallback(async () => {
    if (!pendingData) return

    // Final check for Lightning payments before sending
    if (pendingData.network === 'lightning' && pendingData.decodedInvoice) {
      // Check channel capacity for BTC invoices
      const pendingAmtMsat = pendingData.decodedInvoice.amt_msat || 0
      if (pendingAmtMsat > 0 && !pendingData.decodedInvoice.asset_id) {
        const invoiceAmountSats = pendingAmtMsat / 1000
        const maxCapacitySats = maxLightningCapacity / 1000

        if (pendingAmtMsat > maxLightningCapacity) {
          setValidationMessage({
            message: t('withdrawModal.main.errors.lightningCapacityNeeded', {
              amount: invoiceAmountSats.toLocaleString(),
              capacity: maxCapacitySats.toLocaleString(),
            }),
            type: 'error',
          })
          return
        }
      }
    }

    setIsConfirming(true)
    setValidationMessage(null)
    setPaymentStatus(null)

    try {
      if (pendingData.network === 'lightning') {
        if (!pendingData.address.startsWith('ln')) {
          throw new Error(
            t('withdrawModal.main.errors.invalidLightningInvoice')
          )
        }

        console.log('Processing Lightning payment...')

        try {
          // Check if this is a zero-amount invoice and prepare amount parameter
          let paymentParams: any = {
            invoice: pendingData.address,
          }

          // If zero-amount invoice, add the amount from user input
          if (
            pendingData.decodedInvoice &&
            (!pendingData.decodedInvoice.amt_msat ||
              pendingData.decodedInvoice.amt_msat === 0)
          ) {
            // Convert user-entered amount to msat
            const userAmount = Number(pendingData.amount)
            if (bitcoinUnit === 'SAT') {
              paymentParams.amt_msat = userAmount * 1000
            } else {
              // BTC to msat
              paymentParams.amt_msat = userAmount * 100000000 * 1000
            }
          }

          const res = await sendPayment(paymentParams).unwrap()

          // Ensure payment hash is set for tracking
          if (
            pendingData.decodedInvoice &&
            pendingData.decodedInvoice.payment_hash
          ) {
            setPaymentHash(pendingData.decodedInvoice.payment_hash)
          }

          // Use the status directly from the response
          setPaymentStatus((res.status as PaymentStatus) || null)

          if (res.status === HTLCStatus.Pending) {
            console.log('Payment initiated - polling for status updates')
            // Important: Set isPollingStatus in a separate statement to ensure React batches state updates correctly
            setIsPollingStatus(true)
          } else if (res.status === HTLCStatus.Succeeded) {
            console.log('Payment succeeded immediately')

            // Show success toast and close modal immediately
            toast.success(t('withdrawModal.main.toasts.lightningSuccess'), {
              autoClose: 5000,
              progressStyle: { background: '#3B82F6' },
            })

            // Close the modal immediately
            setIsPollingStatus(false)
            setIsConfirming(false)
            setShowConfirmation(false)
            setPendingData(null)
            dispatch(uiSliceActions.setModal({ type: 'none' }))
          } else {
            console.log('Payment failed immediately:', res.status)
            const failureMsg = t(
              'withdrawModal.main.errors.lightningImmediateFailure',
              { status: res.status }
            )

            // Reset all states and go back to form to allow editing
            setIsPollingStatus(false)
            setIsConfirming(false)
            setPaymentStatus(null)
            setShowConfirmation(false) // Go back to form
            setValidationMessage({
              message: failureMsg,
              type: 'error',
            })
          }
        } catch (error: any) {
          console.error('Lightning payment error:', error)

          // Extract detailed error information for Lightning payments
          let errorMessage = t('withdrawModal.main.errors.unknownPayment')

          if (error?.data?.error) {
            errorMessage = error.data.error
          } else if (error?.data?.message) {
            errorMessage = error.data.message
          } else if (error?.message) {
            errorMessage = error.message
          } else if (typeof error === 'string') {
            errorMessage = error
          }

          const fullErrorMessage = t(
            'withdrawModal.main.errors.lightningFailedDetailed',
            { error: errorMessage }
          )

          // Also show in toast for immediate visibility
          toast.error(fullErrorMessage, {
            autoClose: 8000,
          })

          // Reset all states and go back to form to allow editing
          setIsConfirming(false)
          setIsPollingStatus(false)
          setPaymentStatus(null) // Clear payment status to prevent overlay
          setShowConfirmation(false) // Go back to form
          setValidationMessage({
            message: fullErrorMessage,
            type: 'error',
          })
        }
      } else if (pendingData.network === 'on-chain') {
        if (pendingData.asset_id === BTC_ASSET_ID) {
          // Use conversion helpers for BTC amount
          const amountInSats =
            bitcoinUnit === 'SAT'
              ? Math.round(Number(pendingData.amount))
              : BTCtoSatoshi(Number(pendingData.amount))

          await sendBtc({
            address: pendingData.address ?? '',
            amount: amountInSats,
            fee_rate:
              pendingData.fee_rate !== 'custom'
                ? feeEstimations[
                    pendingData.fee_rate as keyof typeof feeEstimations
                  ]
                : customFee,
          }).unwrap()

          // if ('error' in res) check removed as unwrap throws
          toast.success(t('withdrawModal.main.toasts.btcSuccess'), {
            progressStyle: { background: '#3B82F6' },
          })
        } else {
          const assetInfo = (assets.data?.nia || []).find(
            (a: any) => a.asset_id === pendingData.asset_id
          )
          const ticker =
            assetInfo?.ticker || t('withdrawModal.main.labels.unknownAsset')
          const rawAmount = parseAssetAmountWithPrecision(
            (pendingData.amount || 0).toString(),
            ticker,
            bitcoinUnit,
            assets.data?.nia
          )

          console.log(
            `Sending RGB asset ${ticker} with amount ${pendingData.amount} (raw: ${rawAmount})`
          )

          let res: any

          if (pendingData.address.startsWith('rgb') && decodedRgbInvoice) {
            if (!decodedRgbInvoice.recipient_id) {
              throw new Error(
                t('withdrawModal.main.errors.rgbMissingRecipient')
              )
            }
            if (
              !decodedRgbInvoice.transport_endpoints ||
              decodedRgbInvoice.transport_endpoints.length === 0
            ) {
              throw new Error(
                t('withdrawModal.main.errors.rgbMissingTransport')
              )
            }

            // For RGB asset transfers, always use a Fungible assignment
            // If the invoice has a specific amount in its assignment, use that, otherwise use the raw amount
            let assignmentAmount = rawAmount
            if (
              decodedRgbInvoice.assignment?.type === 'Fungible' &&
              decodedRgbInvoice.assignment.value
            ) {
              assignmentAmount = decodedRgbInvoice.assignment.value
            }

            const assignment = createFungibleAssignment(assignmentAmount)

            // Check if recipient is witness type and provide witness_data
            let witnessData:
              | { amount_sat: number; blinding?: number }
              | undefined = undefined
            if (decodedRgbInvoice.recipient_type === 'Witness') {
              // For witness recipients, we need to provide witness_data
              // The amount_sat is the Bitcoin amount (in sats) to send to the recipient
              // This amount will be used for the witness UTXO
              const witnessAmountSat = pendingData.witness_amount_sat || 1200
              if (!witnessAmountSat || witnessAmountSat < 512) {
                throw new Error(
                  t('withdrawModal.main.errors.witnessAmountTooLow')
                )
              }
              witnessData = {
                amount_sat: witnessAmountSat,
              }
            }

            const targetAssetId =
              decodedRgbInvoice.asset_id || pendingData.asset_id
            res = await sendRgb({
              donation: pendingData.donation || false,
              fee_rate:
                pendingData.fee_rate !== 'custom'
                  ? feeEstimations[
                      pendingData.fee_rate as keyof typeof feeEstimations
                    ]
                  : customFee,
              recipient_map: {
                [targetAssetId]: [
                  {
                    recipient_id: decodedRgbInvoice.recipient_id,
                    assignment,
                    transport_endpoints: decodedRgbInvoice.transport_endpoints,
                    ...(witnessData ? { witness_data: witnessData } : {}),
                  },
                ],
              },
              min_confirmations: 1,
            }).unwrap()
          } else {
            if (!transportEndpoint) {
              throw new Error(
                t('withdrawModal.main.errors.proxyEndpointMissing')
              )
            }
            res = await sendRgb({
              donation: pendingData.donation || false,
              fee_rate:
                pendingData.fee_rate !== 'custom'
                  ? feeEstimations[
                      pendingData.fee_rate as keyof typeof feeEstimations
                    ]
                  : customFee,
              recipient_map: {
                [pendingData.asset_id]: [
                  {
                    recipient_id: pendingData.address,
                    assignment: createFungibleAssignment(rawAmount),
                    transport_endpoints: [transportEndpoint],
                  },
                ],
              },
              min_confirmations: 1,
            }).unwrap()
          }

          if ('error' in res) {
            throw new Error(
              (res.error as ApiError)?.data?.error ||
                t('withdrawModal.main.errors.rgbPaymentFailed')
            )
          }
          toast.success(t('withdrawModal.main.toasts.rgbSuccess'), {
            progressStyle: { background: '#3B82F6' },
          })
        }

        // Only close modal on successful withdrawal
        setShowConfirmation(false)
        setPendingData(null)
        setIsConfirming(false)

        setTimeout(() => {
          dispatch(uiSliceActions.setModal({ type: 'none' }))
        }, 1500)
      }
    } catch (error: any) {
      console.error('Withdrawal error:', error)

      // Extract more detailed error information
      let errorMessage = t('withdrawModal.main.errors.withdrawalFailedDefault')

      if (error?.data?.error) {
        // API error with detailed message
        errorMessage = error.data.error
      } else if (error?.data?.message) {
        // Alternative API error format
        errorMessage = error.data.message
      } else if (error?.message) {
        // Standard error message
        errorMessage = error.message
      } else if (typeof error === 'string') {
        // String error
        errorMessage = error
      }

      // Show detailed error in toast
      toast.error(
        t('withdrawModal.main.errors.withdrawalFailedToast', {
          error: errorMessage,
        }),
        {
          autoClose: 8000, // Longer time for reading detailed errors
        }
      )

      // Reset all confirmation states to allow user to go back and edit
      setIsConfirming(false)
      setIsPollingStatus(false)
      setPaymentStatus(null) // Clear payment status to prevent overlay from showing

      // Go back to the form to allow user to edit the amount
      setShowConfirmation(false)

      // Always set validation error to show in the form
      setValidationMessage({
        message: t('withdrawModal.main.errors.withdrawalFailedDetails', {
          error: errorMessage,
        }),
        type: 'error',
      })
    }
  }, [
    pendingData,
    bitcoinUnit,
    sendPayment,
    sendBtc,
    feeEstimations,
    customFee,
    assets.data?.nia,
    decodedRgbInvoice,
    sendRgb,
    transportEndpoint,
    dispatch,
    t,
  ])

  // Effect to fetch fee estimations when necessary
  useEffect(() => {
    const fetchFees = async () => {
      if (network !== 'on-chain' || assetId !== BTC_ASSET_ID) return

      try {
        const [slow, normal, fast] = await Promise.all([
          estimateFee({ blocks: 6 }).unwrap(),
          estimateFee({ blocks: 3 }).unwrap(),
          estimateFee({ blocks: 1 }).unwrap(),
        ])
        setFeeEstimations({
          fast: fast?.fee_rate || 0,
          normal: normal?.fee_rate || 0,
          slow: slow?.fee_rate || 0,
        })
      } catch (error) {
        console.error('Failed to fetch fee estimates:', error)
      }
    }

    fetchFees()
  }, [network, assetId, estimateFee])

  // Effect to fetch initial balance for the selected asset
  useEffect(() => {
    fetchAssetBalance(assetId)
  }, [assetId, fetchAssetBalance])

  // Define a wrapper function for setValue to fix type mismatch issue
  const setValueWrapper = (name: string, value: any) => {
    // We know that name is a valid key of Fields
    setValue(name as keyof Fields, value)
  }

  // Function to clear validation errors - helps users fix errors more easily
  const clearValidationError = useCallback(() => {
    setValidationMessage(null)
  }, [])

  return (
    <>
      <div className="max-w-2xl mx-auto p-4 max-h-[85vh] flex flex-col">
        <div className="mb-4">
          <h3 className="text-2xl font-bold text-white text-center mb-2">
            {showConfirmation
              ? t('withdrawModal.main.title.confirm')
              : t('withdrawModal.main.title.form')}
          </h3>
          <p className="text-content-secondary text-center text-sm mb-4">
            {showConfirmation
              ? t('withdrawModal.main.subtitle.confirm')
              : t('withdrawModal.main.subtitle.form')}
          </p>
        </div>

        <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar">
          <div className="bg-surface-base/50 backdrop-blur-sm rounded-2xl border border-border-subtle/50 p-6">
            {showConfirmation ? (
              <ConfirmationModal
                assets={assets}
                availableAssets={availableAssets}
                bitcoinUnit={bitcoinUnit}
                customFee={customFee}
                feeRates={feeRates}
                isConfirming={isConfirming}
                isPollingStatus={isPollingStatus}
                onCancel={() => {
                  setShowConfirmation(false)
                  // If polling was active when cancelled from confirmation screen, stop it.
                  if (isPollingStatus) {
                    setIsPollingStatus(false)
                    setPaymentStatus(null) // Reset status
                    setValidationMessage(null) // Clear any polling error
                    setIsConfirming(false) // Stop loading indicator
                  }
                }}
                onConfirm={handleConfirmedSubmit}
                paymentHash={paymentHash}
                paymentStatus={paymentStatus}
                pendingData={pendingData}
                validationMessage={validationMessage}
              />
            ) : (
              <WithdrawForm
                addressType={addressType}
                assetBalance={assetBalance}
                assetId={assetId}
                assets={assets}
                availableAssets={availableAssets}
                bitcoinUnit={bitcoinUnit}
                clearValidationError={clearValidationError}
                customFee={customFee}
                decodedInvoice={decodedInvoice}
                decodedRgbInvoice={decodedRgbInvoice}
                feeRate={feeRate}
                feeRates={feeRates}
                fetchAssetBalance={fetchAssetBalance}
                fetchBtcBalance={fetchBtcBalance}
                form={form}
                getFeeIcon={getFeeIcon}
                getMinAmount={getMinAmount}
                getMinAmountMessage={getMinAmountMessage}
                handleInvoiceChange={handleInvoiceChange}
                handlePasteFromClipboard={handlePasteFromClipboard}
                isDecodingInvoice={isDecodingInvoice}
                isPollingStatus={isPollingStatus}
                maxAssetCapacities={maxAssetCapacities}
                maxLightningCapacity={maxLightningCapacity}
                onSubmit={onSubmit}
                paymentStatus={paymentStatus}
                setCustomFee={setCustomFee}
                setShowAssetDropdown={setShowAssetDropdown}
                setValue={setValueWrapper}
                showAssetDropdown={showAssetDropdown}
                validationMessage={validationMessage}
              />
            )}
          </div>
        </div>

        {!showConfirmation && (
          <div className="flex justify-between pt-4">
            <button
              className="px-3 py-2 text-content-secondary hover:text-white transition-colors 
                       flex items-center gap-1.5 hover:bg-surface-overlay/50 rounded-lg text-sm"
              onClick={() => {
                // Reset all states
                setShowConfirmation(false)
                setIsConfirming(false)
                setIsPollingStatus(false)
                setPaymentStatus(null)
                setValidationMessage(null)

                // Close the modal
                dispatch(uiSliceActions.setModal({ type: 'none' }))
              }}
              type="button"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t('withdrawModal.main.buttons.cancel')}</span>
            </button>
          </div>
        )}
      </div>
    </>
  )
}
