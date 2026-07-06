import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Clock,
  Rocket,
  Settings,
  Zap,
} from 'lucide-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import { z } from 'zod'

import { useSettings } from '../../hooks/useSettings'
import defaultIcon from '../../assets/rgb-logo.svg'
import { FormError } from '../../components/FormError'
import { Button } from '../../components/ui'
import { MAX_CHANNEL_CAPACITY, MIN_CHANNEL_CAPACITY } from '../../constants'
import {
  parseAssetAmountWithPrecision,
  formatAssetAmountWithPrecision,
} from '../../helpers/number'
import { useAssetIcon } from '../../helpers/utils'
import {
  NewChannelFormSchema,
  TNewChannelForm,
} from '../../slices/channel/channel.slice'
import { nodeApi, NiaAsset } from '../../slices/nodeApi/nodeApi.slice'

import 'react-toastify/dist/ReactToastify.css'

interface Props {
  onBack: VoidFunction
  onNext: VoidFunction
  feeRates: Record<string, number>
  formData: TNewChannelForm
  onFormUpdate: (updates: Partial<TNewChannelForm>) => void
}

interface FormFields {
  capacitySat: string
  pubKeyAndAddress: string
  assetAmount: number
  assetAmountDisplay: string // For display purposes with precision
  assetId: string
  assetTicker: string
  fee: 'slow' | 'medium' | 'fast' | 'custom'
  public: boolean
}

const Step2Schema = NewChannelFormSchema.omit({
  capacitySat: true,
  pubKeyAndAddress: true,
}).extend({
  assetAmountDisplay: z.string().optional(),
  assetId: z.string().optional(),
  assetTicker: z.string().optional(), // Display amount with proper precision
  capacitySat: z.string(),
  pubKeyAndAddress: z.string(),
  public: z.boolean(),
})

export const Step2 = ({
  onBack,
  onNext,
  feeRates,
  formData,
  onFormUpdate,
}: Props) => {
  const { t } = useTranslation()
  const [maxCapacity, setMaxCapacity] = useState<number>(MAX_CHANNEL_CAPACITY)
  const [addAsset, setAddAsset] = useState<boolean>(false)
  const [maxAssetAmountMap, setMaxAssetAmountMap] = useState<
    Record<string, number>
  >({})
  const [selectedAsset, setSelectedAsset] = useState<NiaAsset | null>(null)
  const [assetAmountInput, setAssetAmountInput] = useState('')
  const [customFeeRate, setCustomFeeRate] = useState<number>(1)
  const [isAssetDropdownOpen, setIsAssetDropdownOpen] = useState(false)

  const { bitcoinUnit } = useSettings()

  // Asset icon hook
  const [assetIconSrc, setAssetIconSrc] = useAssetIcon(
    selectedAsset?.ticker || '',
    defaultIcon
  )

  // Initialize input when asset changes
  useEffect(() => {
    if (selectedAsset && formData.assetAmount > 0) {
      const displayAmount = formatAssetAmountWithPrecision(
        formData.assetAmount,
        selectedAsset.ticker,
        bitcoinUnit,
        [selectedAsset]
      )
      setAssetAmountInput(displayAmount)
    } else {
      setAssetAmountInput('')
    }
  }, [selectedAsset, formData.assetAmount, bitcoinUnit])

  const [takerAssets, takerAssetsResponse] =
    nodeApi.endpoints.listAssets.useLazyQuery()
  const [btcBalance] = nodeApi.endpoints.btcBalance.useLazyQuery()

  const { handleSubmit, setValue, watch, formState, clearErrors } =
    useForm<FormFields>({
      criteriaMode: 'all',
      defaultValues: {
        ...formData,
        assetAmount: formData.assetAmount || 0,
        assetAmountDisplay: '', // Will be set when asset is selected
        assetId: formData.assetId || '',
        assetTicker: formData.assetTicker || '',
        capacitySat: formData.capacitySat.toString(),
        fee: formData.fee || 'medium',
        pubKeyAndAddress: formData.pubKeyAndAddress,
        public: formData.public !== undefined ? formData.public : true,
      },
      mode: 'onChange',
      resolver: zodResolver(Step2Schema),
    })

  const capacitySat = watch('capacitySat')
  const selectedFee = watch('fee')
  const currentAssetAmount = watch('assetAmount')
  const currentAssetId = watch('assetId')
  const isPublic = watch('public')

  useEffect(() => {
    takerAssets()
  }, [takerAssets])

  useEffect(() => {
    const fetchBtcBalance = async () => {
      try {
        const balance = await btcBalance()
        const totalSpendable =
          (balance.data?.vanilla?.spendable || 0) +
          (balance.data?.colored?.spendable || 0)
        const newMaxCapacity = Math.min(MAX_CHANNEL_CAPACITY, totalSpendable)
        setMaxCapacity(newMaxCapacity)
      } catch (error) {
        console.error('Error fetching BTC balance:', error)
      }
    }

    fetchBtcBalance()
  }, [btcBalance, setValue])

  useEffect(() => {
    if (
      takerAssetsResponse.isSuccess &&
      (takerAssetsResponse.data?.nia?.length ?? 0) > 0
    ) {
      const filteredAssets =
        takerAssetsResponse.data?.nia?.filter(
          (asset: any) => (asset.balance?.spendable ?? 0) > 0
        ) || []

      if (filteredAssets.length > 0) {
        const newMaxAssetAmountMap = filteredAssets.reduce(
          (acc: Record<string, number>, current: NiaAsset) => {
            acc[current.asset_id] = current.balance.spendable
            return acc
          },
          {}
        )
        setMaxAssetAmountMap(newMaxAssetAmountMap)

        // If we have a previously selected asset, find and set it
        if (formData.assetId) {
          const asset = filteredAssets.find(
            (a: any) => a.asset_id === formData.assetId
          )
          if (asset) {
            setSelectedAsset(asset)
            setAddAsset(true)
          }
        }
      } else {
        setAddAsset(false)
      }
    } else {
      setAddAsset(false)
    }
  }, [takerAssetsResponse, formData.assetId])

  useEffect(() => {
    if (formState.isSubmitted) {
      clearErrors()
    }
  }, [capacitySat, currentAssetAmount, currentAssetId, clearErrors])

  const formatNumber = (num: number): string => {
    return num.toLocaleString('en-US')
  }

  const handleCapacityChange = (value: string) => {
    const sanitized = value.replace(/[^0-9.]/g, '')
    if (sanitized === '') {
      setValue('capacitySat', '', { shouldDirty: true })
      onFormUpdate({ capacitySat: 0 })
      return
    }

    const numValue = parseFloat(sanitized)
    if (isNaN(numValue)) return

    if (numValue > maxCapacity) {
      setValue('capacitySat', maxCapacity.toString(), { shouldDirty: true })
      onFormUpdate({ capacitySat: maxCapacity })
      return
    }

    setValue('capacitySat', sanitized, { shouldDirty: true })
    onFormUpdate({ capacitySat: numValue })
  }

  const handleFeeChange = (fee: 'slow' | 'medium' | 'fast' | 'custom') => {
    setValue('fee', fee)
    if (fee !== 'custom') onFormUpdate({ fee })
  }

  const handleAssetSelect = (assetId: string) => {
    const asset = takerAssetsResponse.data?.nia?.find(
      (a: any) => a.asset_id === assetId
    )
    if (asset) {
      setSelectedAsset(asset)
      setValue('assetId', asset?.asset_id || '')
      setValue('assetTicker', asset?.ticker || '')
      onFormUpdate({
        assetAmount: 0,
        assetId: asset?.asset_id || '',
        assetTicker: asset?.ticker || '', // Reset amount when changing asset
      })
    }
  }

  const handleAddAssetToggle = (checked: boolean) => {
    setAddAsset(checked)
    if (!checked) {
      // Clear asset data when disabling
      setValue('assetId', '')
      setValue('assetTicker', '')
      setValue('assetAmount', 0)
      setSelectedAsset(null)
      onFormUpdate({
        assetAmount: 0,
        assetId: '',
        assetTicker: '',
      })
    }
  }

  const onSubmit: SubmitHandler<FormFields> = (data) => {
    // Check if capacity is empty or zero
    const parsedCapacity = parseFloat(data.capacitySat || '0')
    if (!parsedCapacity) {
      toast.error('Please enter a channel capacity.', {
        autoClose: 5000,
        position: 'bottom-right',
      })
      return
    }

    // Check if capacity is below minimum
    if (parsedCapacity < MIN_CHANNEL_CAPACITY) {
      toast.error(
        `Channel capacity must be at least ${formatNumber(MIN_CHANNEL_CAPACITY)} sats.`,
        {
          autoClose: 5000,
          position: 'bottom-right',
        }
      )
      return
    }

    // Check if "Add Asset" is checked but no asset is selected
    if (addAsset && !data.assetId) {
      toast.error(t('components.createChannel.selectAssetError'), {
        autoClose: 5000,
        position: 'bottom-right',
      })
      return
    }

    // Check if asset is selected but no amount is provided
    if (addAsset && data.assetId && data.assetAmount <= 0) {
      toast.error(
        'Please enter an asset amount or remove the asset selection.',
        {
          autoClose: 5000,
          position: 'bottom-right',
        }
      )
      return
    }

    // Check if asset amount exceeds maximum available
    if (addAsset && data.assetId && selectedAsset) {
      const maxAmount = maxAssetAmountMap[selectedAsset.asset_id] || 0
      if (data.assetAmount > maxAmount) {
        const maxDisplayAmount = formatAssetAmountWithPrecision(
          maxAmount,
          selectedAsset.ticker,
          bitcoinUnit,
          [selectedAsset]
        )
        toast.error(
          `Asset amount exceeds maximum available: ${maxDisplayAmount} ${selectedAsset.ticker}`,
          {
            autoClose: 5000,
            position: 'bottom-right',
          }
        )
        return
      }
    }

    // All validations passed, proceed with form submission
    onFormUpdate({
      ...data,
      assetAmount: data.assetAmount || 0,
      capacitySat: parsedCapacity,
      fee: data.fee === 'custom' ? 'slow' : data.fee,
    })
    onNext()
  }

  const availableAssets =
    takerAssetsResponse.data?.nia?.filter(
      (asset: any) => (asset.balance?.spendable ?? 0) > 0
    ) || []

  return (
    <form className="max-w-3xl mx-auto" onSubmit={handleSubmit(onSubmit)}>
      <div className="text-center mt-4 mb-8">
        <h3 className="text-3xl font-bold text-white">
          {t('createChannel.step2.title')}
        </h3>
      </div>

      <div className="bg-surface-overlay/50 backdrop-blur-sm rounded-xl border border-border-default/50 p-8">
        {/* PubKey display section */}
        <div className="mb-12">
          <label className="block text-sm font-medium text-content-secondary mb-2">
            {t('createChannel.step2.openingWith')}
          </label>
          <div className="bg-surface-base/50 px-4 py-3 rounded-lg break-all font-mono text-sm text-white">
            {formData.pubKeyAndAddress}
          </div>
        </div>

        <div className="mb-12">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-content-secondary">
              {t('createChannel.step2.capacityLabel')}
            </label>
          </div>
          <div className="relative">
            <input
              className="w-full pl-4 pr-20 py-2 bg-surface-base/50 rounded-lg border border-border-default/30 text-white text-2xl font-semibold focus:border-primary/60 focus:ring-2 focus:ring-primary/15 placeholder:text-content-tertiary/50 h-14 hover:border-border-default/50 focus:outline-none"
              onChange={(e) => handleCapacityChange(e.target.value)}
              placeholder="0"
              type="text"
              value={capacitySat ? formatNumber(parseFloat(capacitySat)) : ''}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary/50 text-sm font-semibold pointer-events-none select-none tracking-wide border-l border-border-default/60 pl-3 h-6 flex items-center">
              SATS
            </span>
          </div>
          <div className="mt-1.5 text-xs text-content-tertiary">
            {formatNumber(maxCapacity)} {t('createChannel.step2.max')}
          </div>
          {capacitySat && parseFloat(capacitySat) > 0 && (
            <div className="mt-4 px-1">
              <div className="relative">
                {/* Filled track */}
                <div className="relative h-2 rounded-full bg-secondary/20 overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-200"
                    style={{
                      width: `${Math.max(0, Math.min(100, ((parseFloat(capacitySat) - MIN_CHANNEL_CAPACITY) / (maxCapacity - MIN_CHANNEL_CAPACITY)) * 100))}%`,
                    }}
                  />
                </div>
                <input
                  className="absolute inset-0 w-full opacity-0 cursor-pointer h-2"
                  max={maxCapacity}
                  min={MIN_CHANNEL_CAPACITY}
                  onChange={(e) => handleCapacityChange(e.target.value)}
                  step={1000}
                  type="range"
                  value={parseFloat(capacitySat)}
                />
                {/* Thumb */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-primary shadow-lg shadow-primary/30 pointer-events-none transition-all duration-200"
                  style={{
                    left: `calc(${Math.max(0, Math.min(100, ((parseFloat(capacitySat) - MIN_CHANNEL_CAPACITY) / (maxCapacity - MIN_CHANNEL_CAPACITY)) * 100))}% - 8px)`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-content-tertiary mt-3">
                <span>
                  {t('createChannel.step2.minLabel', {
                    amount: formatNumber(MIN_CHANNEL_CAPACITY),
                  })}
                </span>
                <span>
                  {t('createChannel.step2.maxLabel', {
                    amount: formatNumber(maxCapacity),
                  })}
                </span>
              </div>
            </div>
          )}
          {formState.errors.capacitySat && (
            <p className="text-red-500 text-sm mt-1">
              {formState.errors.capacitySat.message}
            </p>
          )}
        </div>

        {/* Asset section */}
        <div className="mb-12">
          <h5 className="text-lg font-semibold text-white mb-3">
            {t('createChannel.step2.rgbAssetsTitle')}
          </h5>

          <button
            className="w-full p-2.5 bg-surface-overlay/50 rounded-xl border border-border-default hover:border-primary/50 transition-all duration-200 flex items-center justify-between text-left"
            onClick={() => setIsAssetDropdownOpen(!isAssetDropdownOpen)}
            type="button"
          >
            <div className="flex items-center gap-2">
              {selectedAsset ? (
                <>
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <img
                      alt={selectedAsset.ticker}
                      className="w-4 h-4"
                      src={assetIconSrc}
                    />
                  </div>
                  <div>
                    <div className="font-medium text-white text-sm">
                      {selectedAsset.ticker}
                    </div>
                    <div className="text-xs text-content-secondary">
                      {selectedAsset.name}
                    </div>
                  </div>
                </>
              ) : (
                <span className="text-content-secondary text-sm">No Asset</span>
              )}
            </div>
            <ChevronDown
              className={`w-4 h-4 text-content-secondary transition-transform duration-200 ${isAssetDropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isAssetDropdownOpen && (
            <div className="rounded-xl border border-border-default bg-surface-overlay shadow-lg overflow-hidden mt-1">
              <div className="max-h-[220px] overflow-y-auto">
                <button
                  className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-white/5 text-content-secondary transition-colors duration-200 border-b border-border-default/50 text-sm"
                  onClick={() => {
                    handleAddAssetToggle(false)
                    setIsAssetDropdownOpen(false)
                  }}
                  type="button"
                >
                  No Asset
                </button>
                {availableAssets.map((asset: NiaAsset) => (
                  <button
                    className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-primary/10 transition-colors duration-200 text-sm"
                    key={asset.asset_id}
                    onClick={() => {
                      handleAssetSelect(asset.asset_id)
                      handleAddAssetToggle(true)
                      setIsAssetDropdownOpen(false)
                    }}
                    type="button"
                  >
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <img
                        alt={asset.ticker}
                        className="w-3.5 h-3.5"
                        src={defaultIcon}
                      />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-white">
                        {asset.ticker}
                      </div>
                      <div className="text-xs text-content-tertiary">
                        {asset.name}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedAsset && addAsset && (
            <div className="mt-6 space-y-4">
              {selectedAsset && (
                <div className="bg-surface-base/50 p-6 rounded-lg space-y-4">
                  <div className="space-y-3">
                    {selectedAsset ? (
                      <div className="space-y-4">
                        {/* Asset Preview Card */}
                        <div className="bg-surface-overlay/50 rounded-xl p-4 border border-border-default/50">
                          {/* Asset Header with Icon */}
                          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border-default/50">
                            <img
                              alt={selectedAsset.ticker}
                              className="w-10 h-10 rounded-full border-2 border-border-default/50"
                              onError={() => setAssetIconSrc(defaultIcon)}
                              src={assetIconSrc}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-semibold text-white">
                                  {selectedAsset.ticker}
                                </span>
                                <span className="text-sm text-content-secondary">
                                  ({selectedAsset.name})
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1 text-right shrink-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-content-secondary">
                                  Available:
                                </span>
                                <span className="text-sm font-medium text-white">
                                  {selectedAsset.balance
                                    ? formatAssetAmountWithPrecision(
                                        selectedAsset.balance.spendable,
                                        selectedAsset.ticker,
                                        bitcoinUnit,
                                        [selectedAsset]
                                      )
                                    : '0'}{' '}
                                  {selectedAsset.ticker}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-start gap-2">
                            <span className="text-xs text-content-secondary shrink-0">
                              Full Asset ID:
                            </span>
                            <span className="text-xs font-mono text-content-tertiary break-all">
                              {selectedAsset.asset_id}
                            </span>
                          </div>
                        </div>

                        {/* Amount Input */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-content-secondary">
                              Amount
                            </label>
                            <div className="flex items-center gap-1">
                              {[25, 50, 75, 100].map((pct) => (
                                <button
                                  className="px-2 py-0.5 rounded text-xs font-semibold border bg-surface-high/40 border-border-default/40 text-content-secondary hover:text-white hover:border-border-default/70 transition-colors"
                                  key={pct}
                                  onClick={() => {
                                    const maxAmount =
                                      maxAssetAmountMap[
                                        selectedAsset.asset_id
                                      ] || 0
                                    const portion = maxAmount * (pct / 100)
                                    const displayAmount =
                                      formatAssetAmountWithPrecision(
                                        portion,
                                        selectedAsset.ticker,
                                        bitcoinUnit,
                                        [selectedAsset]
                                      )
                                    setAssetAmountInput(displayAmount)
                                    setValue('assetAmount', portion)
                                    onFormUpdate({ assetAmount: portion })
                                  }}
                                  type="button"
                                >
                                  {pct === 100 ? 'MAX' : `${pct}%`}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="relative">
                            <input
                              className="w-full pl-4 pr-20 py-2 bg-surface-base/50 rounded-lg border border-border-default/30 text-white text-2xl font-semibold focus:border-primary/60 focus:ring-2 focus:ring-primary/15 placeholder:text-content-tertiary/50 h-14 hover:border-border-default/50 focus:outline-none"
                              inputMode="decimal"
                              onBlur={(e) => {
                                // Only when user finishes typing, convert to proper format and validate
                                const value = e.target.value
                                if (value && selectedAsset) {
                                  const numValue = parseFloat(value)
                                  if (!isNaN(numValue) && numValue > 0) {
                                    // Convert to raw amount for API
                                    const rawAmount =
                                      parseAssetAmountWithPrecision(
                                        value,
                                        selectedAsset.ticker,
                                        bitcoinUnit,
                                        [selectedAsset]
                                      )

                                    // Validate against max available balance
                                    const maxAmount =
                                      maxAssetAmountMap[
                                        selectedAsset.asset_id
                                      ] || 0
                                    if (rawAmount > maxAmount) {
                                      // Set to max amount and show notification
                                      const maxDisplayAmount =
                                        formatAssetAmountWithPrecision(
                                          maxAmount,
                                          selectedAsset.ticker,
                                          bitcoinUnit,
                                          [selectedAsset]
                                        )

                                      setAssetAmountInput(maxDisplayAmount)
                                      setValue('assetAmount', maxAmount)
                                      onFormUpdate({ assetAmount: maxAmount })

                                      toast.warn(
                                        `Amount exceeds maximum available: ${maxDisplayAmount} ${selectedAsset.ticker}. Value has been adjusted.`,
                                        {
                                          autoClose: 4000,
                                          position: 'bottom-right',
                                        }
                                      )
                                      return
                                    }

                                    setValue('assetAmount', rawAmount)
                                    onFormUpdate({ assetAmount: rawAmount })
                                  } else {
                                    setValue('assetAmount', 0)
                                    onFormUpdate({ assetAmount: 0 })
                                  }
                                } else {
                                  setValue('assetAmount', 0)
                                  onFormUpdate({ assetAmount: 0 })
                                }
                              }}
                              onChange={(e) => {
                                const value = e.target.value
                                // Allow empty input
                                if (value === '') {
                                  setAssetAmountInput('')
                                  setValue('assetAmount', 0)
                                  onFormUpdate({ assetAmount: 0 })
                                  return
                                }

                                // Prevent alpha characters - only allow numbers, decimal point
                                if (!/^[\d.]*$/.test(value)) {
                                  return // Reject input with letters or special chars
                                }

                                // Basic decimal validation - allow typing naturally
                                const decimalRegex =
                                  selectedAsset.precision > 0
                                    ? new RegExp(
                                        `^\\d*\\.?\\d{0,${selectedAsset.precision}}$`
                                      )
                                    : /^\d*$/

                                if (decimalRegex.test(value)) {
                                  setAssetAmountInput(value)
                                }
                              }}
                              onKeyDown={(e) => {
                                // Prevent entering non-numeric characters via keyboard
                                const allowedKeys = [
                                  'Backspace',
                                  'Delete',
                                  'Tab',
                                  'Escape',
                                  'Enter',
                                  'ArrowLeft',
                                  'ArrowRight',
                                  'ArrowUp',
                                  'ArrowDown',
                                  'Home',
                                  'End',
                                ]

                                // Allow Ctrl/Cmd combinations (copy, paste, select all, etc.)
                                if (e.ctrlKey || e.metaKey) {
                                  return
                                }

                                // Allow decimal point only if precision > 0 and not already present
                                if (
                                  e.key === '.' &&
                                  selectedAsset.precision > 0 &&
                                  !assetAmountInput.includes('.')
                                ) {
                                  return
                                }

                                // Allow numbers
                                if (/^\d$/.test(e.key)) {
                                  return
                                }

                                // Allow special keys
                                if (allowedKeys.includes(e.key)) {
                                  return
                                }

                                // Prevent all other keys
                                e.preventDefault()
                              }}
                              placeholder="0"
                              type="text"
                              value={assetAmountInput}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary/60 text-sm font-semibold pointer-events-none select-none tracking-wide">
                              {selectedAsset.ticker}
                            </span>
                          </div>
                          <div className="text-xs text-content-tertiary">
                            Min: 1 {selectedAsset.ticker}
                          </div>

                          {formState.errors.assetAmount && (
                            <div className="text-sm text-red-400">
                              {formState.errors.assetAmount.message}
                            </div>
                          )}

                          {/* Validation feedback and helper text */}
                          <div className="space-y-1">
                            {assetAmountInput && selectedAsset && (
                              <div className="text-xs">
                                {(() => {
                                  const inputValue =
                                    parseFloat(assetAmountInput) || 0
                                  const rawInputAmount =
                                    parseAssetAmountWithPrecision(
                                      assetAmountInput,
                                      selectedAsset.ticker,
                                      bitcoinUnit,
                                      [selectedAsset]
                                    )
                                  const maxAmount =
                                    maxAssetAmountMap[selectedAsset.asset_id] ||
                                    0
                                  const maxDisplayAmount =
                                    formatAssetAmountWithPrecision(
                                      maxAmount,
                                      selectedAsset.ticker,
                                      bitcoinUnit,
                                      [selectedAsset]
                                    )

                                  if (inputValue <= 0) {
                                    return null
                                  } else if (rawInputAmount > maxAmount) {
                                    return (
                                      <span className="text-red-400 flex items-center gap-1">
                                        ⚠️ Exceeds maximum available (
                                        {maxDisplayAmount}{' '}
                                        {selectedAsset.ticker})
                                      </span>
                                    )
                                  } else if (rawInputAmount > maxAmount * 0.9) {
                                    return (
                                      <span className="text-orange-400 flex items-center gap-1">
                                        ⚡ Near maximum limit (
                                        {maxDisplayAmount}{' '}
                                        {selectedAsset.ticker})
                                      </span>
                                    )
                                  } else {
                                    return null
                                  }
                                })()}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-surface-base/50 border border-border-default/50 rounded-xl p-6 text-center">
                        <div className="text-content-secondary text-sm">
                          Please select an asset first to enter an amount
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fee selection section */}
        <div className="mb-12">
          <label className="block text-sm font-medium text-content-secondary mb-3">
            Transaction Fee Rate
          </label>
          <div className="grid grid-cols-4 gap-2">
            {(
              [
                {
                  icon: <Clock className="w-4 h-4" />,
                  label: 'Slow',
                  rate: `${feeRates['slow']} sat/vB`,
                  value: 'slow',
                },
                {
                  icon: <Zap className="w-4 h-4" />,
                  label: 'Normal',
                  rate: `${feeRates['medium']} sat/vB`,
                  value: 'medium',
                },
                {
                  icon: <Rocket className="w-4 h-4" />,
                  label: 'Fast',
                  rate: `${feeRates['fast']} sat/vB`,
                  value: 'fast',
                },
                {
                  icon: <Settings className="w-4 h-4" />,
                  label: 'Custom',
                  rate:
                    selectedFee === 'custom'
                      ? `${customFeeRate} sat/vB`
                      : 'set rate',
                  value: 'custom',
                },
              ] as const
            ).map(({ value, label, icon, rate }) => (
              <button
                className={`py-1.5 px-2 flex flex-col items-center justify-center gap-0.5 rounded-lg transition-all duration-200 border text-xs ${
                  selectedFee === value
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'border-border-default hover:border-primary/50 text-content-secondary'
                }`}
                key={value}
                onClick={() => handleFeeChange(value)}
                type="button"
              >
                {icon}
                <span className="text-[10px]">{label}</span>
                <span className="text-[9px]">{rate}</span>
              </button>
            ))}
          </div>

          {selectedFee === 'custom' && (
            <div className="mt-2 space-y-1 animate-fade-in">
              <label className="text-xs font-medium text-content-secondary">
                Custom Fee Rate
              </label>
              <input
                className="w-full px-3 py-2 bg-surface-overlay/50 rounded-xl border border-border-default focus:border-primary/60 focus:ring-1 focus:ring-primary/30 focus:outline-none text-white text-sm"
                min={0.1}
                onChange={(e) =>
                  setCustomFeeRate(parseFloat(e.target.value) || 1)
                }
                step={0.1}
                type="number"
                value={customFeeRate}
              />
            </div>
          )}
        </div>

        {/* Channel Privacy */}
        <div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-content-secondary">
                {isPublic ? 'Public Channel' : 'Private Channel'}
              </div>
              {!isPublic && (
                <p className="text-sm text-content-tertiary mt-1">
                  Only known to the two parties and cannot be used for routing
                </p>
              )}
              <p className="text-xs text-content-tertiary mt-2">
                {t('components.createChannel.publicChannelsDesc')} route
                payments for the network.{' '}
                {t('components.createChannel.privateChannelsDesc')} without
                network visibility.
              </p>
            </div>

            <button
              aria-checked={isPublic}
              aria-label="Toggle channel privacy"
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ml-4 ${
                isPublic ? 'bg-primary' : 'bg-surface-elevated'
              }`}
              onClick={() => {
                const newValue = !isPublic
                setValue('public', newValue)
                onFormUpdate({ public: newValue })
              }}
              role="switch"
              type="button"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isPublic ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-between mt-8">
        <button
          className="px-3 py-2 text-content-secondary hover:text-white transition-colors flex items-center gap-1.5 hover:bg-surface-overlay/50 rounded-lg text-sm"
          onClick={onBack}
          type="button"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>

        <Button
          icon={<ArrowRight className="w-4 h-4" />}
          iconPosition="right"
          size="lg"
          type="submit"
          variant="primary"
        >
          Continue
        </Button>
      </div>

      {!formState.isSubmitSuccessful && formState.isSubmitted && (
        <FormError
          errors={Object.entries(formState.errors).reduce(
            (acc, [key, error]) => {
              if (error?.message) {
                acc[key] = [error.message]
              }
              return acc
            },
            {} as Record<string, string[]>
          )}
          message="Please check the form for errors"
        />
      )}
    </form>
  )
}
