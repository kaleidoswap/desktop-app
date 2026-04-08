import { openUrl } from '@tauri-apps/plugin-opener'
import {
  CircleCheckBig,
  CircleX,
  ArrowRight,
  ArrowLeft,
  Copy,
  Loader,
  Wallet,
  Zap,
  Link as ChainIcon,
  AlertTriangle,
} from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'

import { useSettings } from '../../../../hooks/useSettings'
import btcLogo from '../../../../assets/bitcoin-logo.svg'
import rgbLogo from '../../../../assets/rgb-symbol-color.svg'
import { CreateUTXOModal } from '../../../../components/CreateUTXOModal'
import { BTC_ASSET_ID } from '../../../../constants'
import {
  formatAssetAmountWithPrecision,
  parseAssetAmountWithPrecision,
  getAssetPrecision,
  getDisplayAsset,
} from '../../../../helpers/number'
import { useUtxoErrorHandler } from '../../../../hooks/useUtxoErrorHandler'
import {
  nodeApi,
  Network,
  Channel,
  AssignmentFungible,
} from '../../../../slices/nodeApi/nodeApi.slice'

interface Props {
  assetId?: string
  onBack: VoidFunction
  onNext: VoidFunction
}

const MSATS_PER_SAT = 1000
const RGB_HTLC_MIN_SAT = 3000

export const Step2 = ({ assetId, onBack, onNext }: Props) => {
  const [network, setNetwork] = useState<'on-chain' | 'lightning'>('on-chain')
  const [address, setAddress] = useState<string>()
  const [loading, setLoading] = useState<boolean>(false)
  const [amount, setAmount] = useState<string>('')
  const [noColorableUtxos, setNoColorableUtxos] = useState<boolean>(false)
  const [maxDepositAmount, setMaxDepositAmount] = useState<number>(0)
  const [usePrivacy, setUsePrivacy] = useState<boolean>(true)
  const prevAmountRef = useRef<string>('')

  const { showUtxoModal, setShowUtxoModal, utxoModalProps, handleApiError } =
    useUtxoErrorHandler()
  const { t } = useTranslation()

  const { bitcoinUnit } = useSettings()
  const [addressQuery] = nodeApi.useLazyAddressQuery()
  const [lnInvoice] = nodeApi.useLnInvoiceMutation()
  const [rgbInvoice] = nodeApi.useRgbInvoiceMutation()

  // Auto-generate BTC address when component mounts
  useEffect(() => {
    const generateBtcAddress = async () => {
      if (assetId === BTC_ASSET_ID && network === 'on-chain' && !address) {
        setLoading(true)
        try {
          const res = await addressQuery()
          setAddress(res.data?.address)
        } catch (error) {
          toast.error(t('depositModal.step2.toasts.generateAddressError'))
        } finally {
          setLoading(false)
        }
      }
    }
    generateBtcAddress()
  }, [assetId, network, address, addressQuery])

  const { data: invoiceStatus } = nodeApi.useInvoiceStatusQuery(
    { invoice: address as string },
    {
      pollingInterval: 1000,
      skip: !address?.startsWith('ln') || network !== 'lightning',
    }
  )

  // Fetch channels data to calculate HTLC limits
  const { data: channelsData } = nodeApi.useListChannelsQuery(undefined, {
    pollingInterval: 3000,
    refetchOnFocus: false,
    refetchOnMountOrArgChange: true,
  })

  const channels = useMemo(() => channelsData?.channels || [], [channelsData])

  // Calculate max deposit amount based on HTLC limits for BTC or asset_remote_amount for RGB assets
  const calculateMaxDepositAmount = useCallback(
    (asset: string): number => {
      if (asset === 'BTC') {
        if (channels.length === 0) {
          return 0
        }

        const channelHtlcLimits = channels.map(
          (c: Channel) => (c.next_outbound_htlc_limit_msat ?? 0) / MSATS_PER_SAT
        )

        if (
          channelHtlcLimits.length === 0 ||
          Math.max(...channelHtlcLimits) <= 0
        ) {
          return 0
        }

        const maxHtlcLimit = Math.max(...channelHtlcLimits)
        const maxDepositableAmount = maxHtlcLimit - RGB_HTLC_MIN_SAT
        return Math.max(0, maxDepositableAmount)
      } else {
        // For RGB assets, use the max asset_remote_amount across all channels for this asset
        const assetChannels = channels.filter(
          (c: Channel) => c.asset_id === asset && c.is_usable
        )

        if (assetChannels.length === 0) {
          return 0
        }

        const assetRemoteAmounts = assetChannels
          .map((c: Channel) => c.asset_remote_amount)
          .filter((v): v is number => v != null)

        return Math.max(...assetRemoteAmounts)
      }
    },
    [channels]
  )

  // Update max amounts when network or asset changes
  useEffect(() => {
    if (network === 'lightning' && assetId) {
      const maxAmount = calculateMaxDepositAmount(
        assetId === BTC_ASSET_ID ? 'BTC' : assetId
      )
      setMaxDepositAmount(maxAmount)
    } else {
      setMaxDepositAmount(0)
    }
  }, [network, assetId, calculateMaxDepositAmount])

  // Reset address when switching networks
  useEffect(() => {
    setAddress(undefined)
    setAmount('')
    setNoColorableUtxos(false)
    setUsePrivacy(true)
  }, [network])

  // Reset address when switching privacy mode
  useEffect(() => {
    if (network === 'on-chain' && assetId !== BTC_ASSET_ID) {
      setAddress(undefined)
    }
  }, [usePrivacy])

  const [assetTicker, setAssetTicker] = useState<string>('')
  const [assetName, setAssetName] = useState<string>('')
  const { data: assetList } = nodeApi.endpoints.listAssets.useQuery()

  useEffect(() => {
    if (assetList?.nia && assetId !== BTC_ASSET_ID && assetId) {
      const asset = assetList.nia.find((a: any) => a.asset_id === assetId)
      if (asset) {
        setAssetTicker(asset.ticker ?? '')
        setAssetName(asset.name ?? '')
      }
    } else if (assetId === BTC_ASSET_ID) {
      setAssetTicker('BTC')
      setAssetName('Bitcoin')
    }
  }, [assetList, assetId])

  const titleText = assetId
    ? assetTicker
      ? t('depositModal.step2.titleWithTicker', { ticker: assetTicker })
      : t('depositModal.step2.titleGeneric')
    : t('depositModal.step2.titleAny')

  const addressLabel =
    network === 'lightning'
      ? t('depositModal.step2.labels.lnInvoice')
      : assetId === BTC_ASSET_ID
        ? t('depositModal.step2.labels.btcAddress')
        : t('depositModal.step2.labels.rgbInvoice')

  // Reset address when amount changes (for both lightning and on-chain RGB invoices)
  useEffect(() => {
    // Only reset if address already exists and amount actually changed
    if (address && amount !== prevAmountRef.current) {
      if (network === 'lightning') {
        setAddress(undefined)
      } else if (
        network === 'on-chain' &&
        assetId &&
        assetId !== BTC_ASSET_ID
      ) {
        setAddress(undefined)
      }
    }
    // Update the ref to track the current amount
    prevAmountRef.current = amount
  }, [amount, address, network, assetId])

  const [recipientId, setRecipientId] = useState<string>()

  // Add network info query
  const { data: networkInfoData } = nodeApi.useNodeInfoQuery()
  const networkInfo = networkInfoData as any

  // Format amount helper
  const formatAmount = useCallback(
    (amount: number, asset: string) => {
      return formatAssetAmountWithPrecision(
        amount,
        asset,
        bitcoinUnit,
        assetList?.nia
      )
    },
    [bitcoinUnit, assetList?.nia]
  )

  // Parse amount helper
  const parseAmount = useCallback(
    (amount: string, asset: string) => {
      return parseAssetAmountWithPrecision(
        amount,
        asset,
        bitcoinUnit,
        assetList?.nia
      )
    },
    [bitcoinUnit, assetList?.nia]
  )

  // Enhanced amount input change handler with formatting
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value

    // Remove all non-digit and non-decimal characters except commas
    value = value.replace(/[^\d.,]/g, '')

    // Remove commas for processing
    const cleanValue = value.replace(/,/g, '')

    // Handle multiple decimal points - keep only the first one
    const parts = cleanValue.split('.')
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('')
    } else {
      value = cleanValue
    }

    // Get asset precision for validation
    const asset = assetId === BTC_ASSET_ID ? 'BTC' : assetTicker
    const precision = getAssetPrecision(asset, bitcoinUnit, assetList?.nia)

    // Limit decimal places based on asset precision
    const decimalParts = value.split('.')
    if (decimalParts.length === 2 && decimalParts[1].length > precision) {
      value = decimalParts[0] + '.' + decimalParts[1].substring(0, precision)
    }

    // Validate against max deposit amount for lightning
    if (network === 'lightning' && maxDepositAmount > 0) {
      const numValue = parseFloat(value)
      if (!isNaN(numValue) && numValue > 0) {
        // Convert to base units and check against max
        const baseUnits = parseAmount(value, asset)
        const maxBaseUnits = maxDepositAmount

        if (baseUnits > maxBaseUnits) {
          // Don't update if it exceeds the limit
          return
        }
      }
    }

    // Format with comma separators but only for the integer part
    const formattedValue =
      value.split('.').length === 2
        ? value.split('.')[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') +
          '.' +
          value.split('.')[1]
        : value.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

    setAmount(formattedValue)
  }

  // Handle setting max amount
  const handleSetMaxAmount = () => {
    if (maxDepositAmount > 0) {
      const asset = assetId === BTC_ASSET_ID ? 'BTC' : assetTicker
      const formattedMax = formatAmount(maxDepositAmount, asset)
      setAmount(formattedMax)
    }
  }

  const generateRgbInvoice = async (amountValue?: string) => {
    try {
      let assignment: AssignmentFungible | undefined = undefined

      // If amount is provided, convert it to internal format (without decimals)
      if (amountValue && amountValue.trim() !== '') {
        const cleanAmount = amountValue.replace(/,/g, '')
        const numericAmount = parseFloat(cleanAmount)

        if (!isNaN(numericAmount) && numericAmount > 0) {
          // Convert user-entered amount (with precision) to internal format (without decimals)
          const asset = assetId === BTC_ASSET_ID ? 'BTC' : assetTicker
          const rawAmount = parseAmount(cleanAmount, asset)
          assignment = {
            type: 'Fungible',
            value: rawAmount,
          }
        }
      }

      const requestBody: any = assetId
        ? { asset_id: assetId, witness: !usePrivacy }
        : { witness: !usePrivacy }

      if (assignment) {
        requestBody.assignment = assignment
      }

      const res = await rgbInvoice(requestBody)
      setNoColorableUtxos(false)

      // Check for errors in RTK Query response
      if ('error' in res && res.error) {
        const err = res.error as any
        const errorMessage =
          err.data && err.data.error ? err.data.error : 'Unknown error'

        // Check if this is a UTXO-related error
        const wasHandled = handleApiError(res.error, 'issuance', 0, () =>
          generateRgbInvoice(amountValue)
        )

        if (!wasHandled) {
          // Check specifically for no colorable UTXOs error to show our custom message
          if (errorMessage.includes('No uncolored UTXOs are available')) {
            setNoColorableUtxos(true)
          } else {
            toast.error(
              t('depositModal.step2.toasts.rgbInvoiceError', {
                error: errorMessage,
              })
            )
          }
        }
        return // Exit early on error
      }

      // Success case - set address and recipient ID
      if (res.data) {
        setAddress(res.data.invoice)
        setRecipientId(res.data.recipient_id)
      } else {
        console.error('RGB invoice response missing data:', res)
        toast.error(t('depositModal.step2.toasts.rgbInvoiceInvalid'))
      }
    } catch (error) {
      console.error('Error generating RGB invoice:', error)
      toast.error(t('depositModal.step2.toasts.rgbInvoiceUnknown'))
    }
  }

  const generateAddress = async () => {
    setLoading(true)
    try {
      if (network === 'lightning') {
        // Check if amount is provided and valid
        const hasAmount = amount && parseFloat(amount.replace(/,/g, '')) > 0

        let res
        if (hasAmount) {
          // Parse the amount properly, removing commas
          const cleanAmount = amount.replace(/,/g, '')
          const numericAmount = parseFloat(cleanAmount)

          res = await lnInvoice(
            assetId === BTC_ASSET_ID
              ? {
                  amt_msat:
                    bitcoinUnit === 'SAT'
                      ? numericAmount * 1000
                      : numericAmount * Math.pow(10, 8) * 1000,
                }
              : {
                  asset_amount: parseAmount(cleanAmount, assetTicker),
                  asset_id: assetId,
                }
          )
        } else {
          // Generate zero-amount invoice
          res = await lnInvoice(
            assetId === BTC_ASSET_ID
              ? {}
              : {
                  asset_id: assetId,
                }
          )
        }

        if ('error' in res) {
          toast.error(t('depositModal.step2.toasts.lnInvoiceError'))
        } else {
          setAddress(res.data?.invoice)
        }
      } else if (!assetId || assetId !== BTC_ASSET_ID) {
        await generateRgbInvoice(amount)
      } else {
        const res = await addressQuery()
        setAddress(res.data?.address)
      }
    } catch (error) {
      toast.error(t('depositModal.step2.toasts.generateAddressError'))
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address ?? '')
      toast.success(t('depositModal.step2.toasts.addressCopied'))
    } catch (error) {
      toast.error(t('depositModal.step2.toasts.addressCopyError'))
    }
  }

  const handleCopyRecipientId = async () => {
    try {
      await navigator.clipboard.writeText(recipientId ?? '')
      toast.success(t('depositModal.step2.toasts.recipientCopied'))
    } catch (error) {
      toast.error(t('depositModal.step2.toasts.recipientCopyError'))
    }
  }

  const NetworkOption = ({
    type,
    icon: Icon,
    label,
  }: {
    type: 'on-chain' | 'lightning'
    icon: any
    label: string
  }) => {
    const isDisabled = type === 'lightning' && !assetId

    return (
      <button
        className={`
          flex-1 py-3 px-4 flex flex-col items-center justify-center gap-1.5
          rounded-xl transition-all duration-200 border-2
          ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}
          ${
            network === type
              ? 'bg-primary/10 border-primary text-primary'
              : 'border-border-default hover:border-primary/50 text-content-secondary hover:text-primary/80'
          }
        `}
        disabled={isDisabled}
        onClick={() => !isDisabled && setNetwork(type)}
      >
        <Icon
          className={`w-5 h-5 ${network === type ? 'animate-pulse' : ''}`}
        />
        <span className="font-medium text-sm">{label}</span>
        {isDisabled && (
          <span className="text-xs text-content-tertiary">
            {t('depositModal.step2.network.requiresAsset')}
          </span>
        )}
      </button>
    )
  }

  const getStatusColor = () => {
    if (!invoiceStatus) return 'text-content-secondary'
    switch (invoiceStatus.status) {
      case 'Pending':
        return 'text-yellow-500'
      case 'Succeeded':
        return 'text-green-500'
      default:
        return 'text-red-500'
    }
  }

  // Add a useEffect to close modal on successful payment
  useEffect(() => {
    if (invoiceStatus?.status === 'Succeeded') {
      // Show success toast notification
      toast.success(t('depositModal.step2.toasts.lightningSuccess'), {
        autoClose: 5000,
        progressStyle: { background: '#3B82F6' },
      })
      onNext()
    } else if (
      invoiceStatus?.status === 'Failed' ||
      invoiceStatus?.status === 'Expired'
    ) {
      // Show failure toast notification
      toast.error(
        t('depositModal.step2.toasts.lightningFailed', {
          status: invoiceStatus?.status,
        }),
        {
          autoClose: 5000,
        }
      )
    }
  }, [invoiceStatus, onNext])

  return (
    <div className="bg-surface-base/50 backdrop-blur-sm rounded-2xl border border-border-subtle/50 p-4">
      <div className="flex flex-col items-center mb-2">
        {/* Display selected asset icon */}
        {assetId === BTC_ASSET_ID ? (
          <img alt="Bitcoin" className="w-8 h-8 mb-2" src={btcLogo} />
        ) : (
          <img alt="RGB Asset" className="w-8 h-8 mb-2" src={rgbLogo} />
        )}

        {/* Show the asset name and ticker prominently */}
        <h3 className="text-xl font-bold text-white mb-1">{titleText}</h3>

        {assetName && (
          <div className="text-content-secondary mb-1 text-xs">{assetName}</div>
        )}

        {assetId && assetId !== BTC_ASSET_ID && (
          <div className="text-xs text-content-tertiary bg-surface-overlay px-2 py-0.5 rounded-full">
            {assetId.slice(0, 8)}...{assetId.slice(-8)}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {/* Network Selection - Made more compact */}
        <div className="flex gap-2">
          <NetworkOption
            icon={ChainIcon}
            label={t('depositModal.step2.network.onchain')}
            type="on-chain"
          />
          <NetworkOption
            icon={Zap}
            label={t('depositModal.step2.network.lightning')}
            type="lightning"
          />
        </div>

        {/* RGB Privacy Mode Toggle - Only show for RGB assets on on-chain */}
        {network === 'on-chain' && assetId !== BTC_ASSET_ID && (
          <div className="p-3 bg-surface-overlay/50 rounded-xl border border-border-default animate-fadeIn">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-white">
                  {t('depositModal.step2.privacy.title')}
                </h4>
                <p className="text-xs text-content-secondary mt-0.5">
                  {usePrivacy
                    ? t('depositModal.step2.privacy.modePrivacy')
                    : t('depositModal.step2.privacy.modeWitness')}
                </p>
              </div>
              <button
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full
                  transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40
                  ${usePrivacy ? 'bg-primary' : 'bg-surface-elevated'}`}
                onClick={() => setUsePrivacy(!usePrivacy)}
                type="button"
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm
                    transition-transform duration-200
                    ${usePrivacy ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Show network info and faucet suggestion in a more compact format */}
        {networkInfo && (
          <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
            {(() => {
              const faucetKey =
                networkInfo.network === Network.Signet ||
                networkInfo.network === Network.SignetCustom
                  ? 'signet'
                  : networkInfo.network === Network.Regtest
                    ? 'regtest'
                    : 'testnet'
              const link =
                faucetKey === 'regtest'
                  ? 'https://t.me/rgb_lightning_bot'
                  : 'https://faucet.mutinynet.com/'

              return (
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/20 text-xs font-medium">
                      {networkInfo.network}
                    </span>
                    <span className="text-primary text-xs">
                      {t('depositModal.step2.networkInfo.using', {
                        network: networkInfo.network,
                      })}
                    </span>
                  </div>

                  <div className="text-xs text-primary mt-1">
                    <p className="mb-1.5">
                      {t(
                        `depositModal.step2.networkInfo.description.${faucetKey}`
                      )}
                    </p>
                    <button
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/20 
                          hover:bg-primary/30 text-primary rounded-lg transition-colors text-xs"
                      onClick={() => {
                        openUrl(link)
                      }}
                    >
                      <ArrowRight className="w-3 h-3" />
                      {t(`depositModal.step2.networkInfo.button.${faucetKey}`)}
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* No Colorable UTXOs Warning - Made more compact */}
        {noColorableUtxos && (
          <div className="p-2 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
            <div className="flex items-start">
              <AlertTriangle className="text-yellow-500 w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-yellow-400 font-medium text-xs mb-1">
                  {t('depositModal.step2.noColorable.title')}
                </h4>
                <p className="text-yellow-300/80 text-xs mb-1.5">
                  {t('depositModal.step2.noColorable.description')}
                </p>
                <button
                  className="px-2 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 
                          rounded-lg transition-colors text-xs flex items-center gap-1.5"
                  onClick={() => setShowUtxoModal(true)}
                >
                  <Wallet className="w-3 h-3" />
                  {t('depositModal.step2.noColorable.cta')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Amount Input for On-chain RGB Invoices */}
        {network === 'on-chain' && assetId && assetId !== BTC_ASSET_ID && (
          <div className="space-y-1 animate-fadeIn">
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-content-secondary">
                {t('depositModal.step2.amount.optionalLabel')}
              </label>
              {assetTicker && (
                <div className="text-xs text-content-secondary">
                  {t('depositModal.step2.amount.precision', {
                    value: getAssetPrecision(
                      assetTicker,
                      bitcoinUnit,
                      assetList?.nia
                    ),
                  })}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  className="w-full px-3 py-2 pr-16 bg-surface-overlay/50 rounded-xl border border-border-default 
                           focus:border-primary/60 focus:ring-1 focus:ring-primary/30 text-white
                           placeholder:text-content-tertiary transition-all duration-200 text-sm"
                  inputMode="decimal"
                  onChange={handleAmountChange}
                  placeholder={t('depositModal.step2.amount.example', {
                    ticker: assetTicker,
                  })}
                  type="text"
                  value={amount}
                />
              </div>
              <div className="px-3 py-2 bg-surface-overlay/50 rounded-xl border border-border-default text-content-secondary text-sm">
                {assetTicker}
              </div>
            </div>
          </div>
        )}

        {/* Amount Input for Lightning */}
        {network === 'lightning' && (
          <div className="space-y-1 animate-fadeIn">
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-content-secondary">
                {t('depositModal.step2.amount.optionalLabel')}
              </label>
              {maxDepositAmount > 0 && (
                <div className="text-xs text-content-secondary">
                  {t('depositModal.step2.amount.maxLabel', {
                    amount: formatAmount(
                      maxDepositAmount,
                      assetId === BTC_ASSET_ID ? 'BTC' : assetTicker
                    ),
                    asset: getDisplayAsset(
                      assetId === BTC_ASSET_ID ? 'BTC' : assetTicker,
                      bitcoinUnit
                    ),
                  })}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input
                  autoFocus
                  className="w-full px-3 py-2 pr-16 bg-surface-overlay/50 rounded-xl border border-border-default 
                           focus:border-primary/60 focus:ring-1 focus:ring-primary/30 text-white
                           placeholder:text-content-tertiary transition-all duration-200 text-sm"
                  inputMode="decimal"
                  onChange={handleAmountChange}
                  placeholder={t('depositModal.step2.amount.maxPlaceholder', {
                    amount:
                      maxDepositAmount > 0
                        ? formatAmount(
                            maxDepositAmount,
                            assetId === BTC_ASSET_ID ? 'BTC' : assetTicker
                          )
                        : t('depositModal.step2.amount.notAvailable'),
                  })}
                  type="text"
                  value={amount}
                />
                {maxDepositAmount > 0 && (
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 
                             bg-primary/20 hover:bg-primary/30 text-primary 
                             rounded-lg transition-colors text-xs font-medium"
                    onClick={handleSetMaxAmount}
                    type="button"
                  >
                    {t('depositModal.step2.amount.maxButton')}
                  </button>
                )}
              </div>
              <div className="px-3 py-2 bg-surface-overlay/50 rounded-xl border border-border-default text-content-secondary text-sm">
                {assetId === BTC_ASSET_ID
                  ? getDisplayAsset('BTC', bitcoinUnit)
                  : assetTicker}
              </div>
            </div>

            {/* Validation and info messages */}
            {amount &&
              parseFloat(amount.replace(/,/g, '')) > 0 &&
              maxDepositAmount > 0 && (
                <div className="mt-2">
                  {parseAmount(
                    amount,
                    assetId === BTC_ASSET_ID ? 'BTC' : assetTicker
                  ) > maxDepositAmount && (
                    <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                      <p className="text-xs text-red-400">
                        {t('depositModal.step2.amount.exceeds', {
                          amount: formatAmount(
                            maxDepositAmount,
                            assetId === BTC_ASSET_ID ? 'BTC' : assetTicker
                          ),
                          asset: getDisplayAsset(
                            assetId === BTC_ASSET_ID ? 'BTC' : assetTicker,
                            bitcoinUnit
                          ),
                        })}
                      </p>
                    </div>
                  )}
                </div>
              )}

            {assetId && assetId !== BTC_ASSET_ID && (
              <div className="mt-1 p-2 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-xs text-primary">
                  {t('depositModal.step2.amount.rgbNote')}
                </p>
              </div>
            )}

            {maxDepositAmount === 0 && (
              <div className="mt-1 p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                <p className="text-xs text-yellow-400">
                  {t('depositModal.step2.amount.noChannels')}
                </p>
              </div>
            )}

            {/* Info about zero-amount invoices */}
            <div className="mt-1 p-2 bg-primary/10 rounded-lg border border-primary/20">
              <p className="text-xs text-primary">
                {t('depositModal.step2.amount.zeroAmountInfo')}
              </p>
            </div>
          </div>
        )}

        {!address ? (
          <button
            className="w-full py-2.5 px-6 bg-gradient-to-r from-primary to-secondary hover:opacity-90 disabled:opacity-50
                     text-white rounded-xl font-semibold transition-all duration-200 shadow-md shadow-primary/20
                     flex items-center justify-center gap-2 disabled:cursor-not-allowed"
            disabled={
              loading ||
              (network === 'lightning' &&
                maxDepositAmount > 0 &&
                amount &&
                parseAmount(
                  amount,
                  assetId === BTC_ASSET_ID ? 'BTC' : assetTicker
                ) > maxDepositAmount) ||
              (network === 'lightning' && maxDepositAmount === 0)
            }
            onClick={generateAddress}
          >
            {loading ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>
                  {network === 'lightning'
                    ? t('depositModal.step2.actions.generateInvoice')
                    : t('depositModal.step2.actions.generateAddressCta')}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        ) : (
          <div className="space-y-4 animate-fadeIn">
            {/* Payment Status */}
            {invoiceStatus && (
              <div
                className={`flex items-center justify-center gap-2 ${getStatusColor()} text-sm py-2 bg-surface-overlay/50 rounded-lg`}
              >
                {invoiceStatus.status === 'Pending' ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>{t('depositModal.step2.status.pending')}</span>
                  </>
                ) : invoiceStatus.status === 'Succeeded' ? (
                  <>
                    <CircleCheckBig className="w-4 h-4" />
                    <span>{t('depositModal.step2.status.success')}</span>
                  </>
                ) : (
                  <>
                    <CircleX className="w-4 h-4" />
                    <span>
                      {t('depositModal.step2.status.failed', {
                        status: invoiceStatus.status,
                      })}
                    </span>
                  </>
                )}
              </div>
            )}

            {/* QR Code - Made more compact */}
            <div className="flex justify-center py-1">
              <div className="p-2 bg-white rounded-xl shadow-xl">
                <QRCodeCanvas
                  includeMargin={true}
                  level="H"
                  size={window.innerWidth < 500 ? 130 : 150}
                  value={address}
                />
              </div>
            </div>

            {/* Address Display - More compact */}
            <div
              className="p-3 bg-surface-overlay/50 rounded-xl border border-border-default 
                          flex items-center justify-between group hover:border-primary/50 
                          transition-all duration-200"
            >
              <div className="truncate flex-1 text-content-secondary font-mono text-xs flex items-center gap-2">
                <span
                  className={`
                  px-1.5 py-0.5 rounded-md text-xs font-medium
                  ${
                    assetId === BTC_ASSET_ID
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/20'
                      : 'bg-purple-500/20 text-purple-400 border border-purple-500/20'
                  }
                `}
                >
                  {addressLabel}
                </span>
                {address.length > 45 ? `${address.slice(0, 42)}...` : address}
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="p-1.5 hover:bg-primary/10 rounded-lg transition-colors
                           text-content-secondary hover:text-primary disabled:opacity-50 
                           disabled:cursor-not-allowed"
                  disabled={loading}
                  onClick={generateAddress}
                  title={t('depositModal.step2.actions.generateAddress')}
                >
                  <Loader
                    className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                  />
                </button>
                <button
                  className="p-1.5 hover:bg-primary/10 rounded-lg transition-colors
                           text-content-secondary hover:text-primary"
                  onClick={handleCopy}
                  title={t('depositModal.step2.actions.copy')}
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Recipient ID Display for Assets - More compact */}
            {assetId !== BTC_ASSET_ID &&
              recipientId &&
              network === 'on-chain' && (
                <div
                  className="p-3 bg-surface-overlay/50 rounded-xl border border-border-default 
                            flex items-center justify-between group hover:border-primary/50 
                            transition-all duration-200"
                >
                  <div className="truncate flex-1 text-content-secondary font-mono text-xs">
                    <span className="text-content-secondary mr-2">
                      Recipient ID:
                    </span>
                    {recipientId.length > 45
                      ? `${recipientId.slice(0, 42)}...`
                      : recipientId}
                  </div>
                  <button
                    className="ml-2 p-1.5 hover:bg-primary/10 rounded-lg transition-colors
                           text-content-secondary hover:text-primary"
                    onClick={handleCopyRecipientId}
                    title={t('depositModal.step2.actions.copy')}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              )}
          </div>
        )}

        {/* Navigation - More compact */}
        <div className="flex justify-between pt-3">
          <button
            className="px-3 py-2 text-content-secondary hover:text-white transition-colors 
                     flex items-center gap-1.5 hover:bg-surface-overlay/50 rounded-lg text-sm"
            onClick={onBack}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t('depositModal.common.back')}</span>
          </button>

          <button
            className="px-4 py-2 bg-primary hover:bg-primary-emphasis text-primary-foreground rounded-lg 
                     transition-colors flex items-center gap-1.5 text-sm"
            onClick={onNext}
          >
            <span>{t('depositModal.common.finish')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* UTXO Modal for handling UTXO-related errors */}
      <CreateUTXOModal
        error={utxoModalProps.error}
        isOpen={showUtxoModal}
        onClose={() => setShowUtxoModal(false)}
        onSuccess={() => setShowUtxoModal(false)}
        operationType="issuance"
        retryFunction={utxoModalProps.retryFunction}
      />
    </div>
  )
}
