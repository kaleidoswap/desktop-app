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
const SATOSHIS_PER_BTC = 100_000_000

export const Step2 = ({ assetId, onBack, onNext }: Props) => {
  const isBtc = assetId === BTC_ASSET_ID

  // Network toggle only used for RGB assets
  const [network, setNetwork] = useState<'on-chain' | 'lightning'>('on-chain')

  // On-chain address (used for BTC on-chain and RGB on-chain)
  const [onchainAddress, setOnchainAddress] = useState<string>()
  // Lightning invoice (used for BTC lightning and RGB lightning)
  const [lnInvoiceStr, setLnInvoiceStr] = useState<string>()
  // Legacy "address" field for RGB flows (keeps existing behavior)
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

  // Build BIP21 URI for BTC (unified QR code)
  const bip21URI = useMemo(() => {
    if (!isBtc) return ''
    if (!onchainAddress && !lnInvoiceStr) return ''

    const cleanAmount = amount.replace(/,/g, '')
    const numericAmount = parseFloat(cleanAmount)
    const hasAmount = !isNaN(numericAmount) && numericAmount > 0

    // Convert to BTC for BIP21
    let amountBTC = 0
    if (hasAmount) {
      amountBTC =
        bitcoinUnit === 'SAT' ? numericAmount / SATOSHIS_PER_BTC : numericAmount
    }

    if (onchainAddress && lnInvoiceStr) {
      const params = new URLSearchParams()
      if (hasAmount) params.set('amount', amountBTC.toFixed(8))
      params.set('lightning', lnInvoiceStr)
      return `bitcoin:${onchainAddress}${params.toString() ? '?' + params.toString() : ''}`
    }
    if (onchainAddress) {
      if (hasAmount)
        return `bitcoin:${onchainAddress}?amount=${amountBTC.toFixed(8)}`
      return `bitcoin:${onchainAddress}`
    }
    if (lnInvoiceStr) {
      return `lightning:${lnInvoiceStr}`
    }
    return ''
  }, [isBtc, onchainAddress, lnInvoiceStr, amount, bitcoinUnit])

  // Auto-generate BTC address + LN invoice on mount
  useEffect(() => {
    if (!isBtc) return

    const generateBtcBoth = async () => {
      setLoading(true)
      try {
        // Generate both in parallel
        const [addrRes, invoiceRes] = await Promise.all([
          addressQuery(),
          lnInvoice({}), // zero-amount invoice
        ])

        if (addrRes.data?.address) {
          setOnchainAddress(addrRes.data.address)
        }
        if (
          invoiceRes &&
          !('error' in invoiceRes) &&
          invoiceRes.data?.invoice
        ) {
          setLnInvoiceStr(invoiceRes.data.invoice)
        }
      } catch (error) {
        toast.error(t('depositModal.step2.toasts.generateAddressError'))
      } finally {
        setLoading(false)
      }
    }

    if (!onchainAddress && !lnInvoiceStr) {
      generateBtcBoth()
    }
  }, [isBtc])

  // When BTC amount changes, regenerate LN invoice with new amount
  useEffect(() => {
    if (!isBtc) return
    if (amount === prevAmountRef.current) return
    prevAmountRef.current = amount

    const cleanAmount = amount.replace(/,/g, '')
    const numericAmount = parseFloat(cleanAmount)
    const hasAmount = !isNaN(numericAmount) && numericAmount > 0

    const regenerateInvoice = async () => {
      try {
        const res = await lnInvoice(
          hasAmount
            ? {
                amt_msat:
                  bitcoinUnit === 'SAT'
                    ? numericAmount * 1000
                    : numericAmount * SATOSHIS_PER_BTC * 1000,
              }
            : {}
        )
        if (res && !('error' in res) && res.data?.invoice) {
          setLnInvoiceStr(res.data.invoice)
        }
      } catch {
        // Keep old invoice if regeneration fails
      }
    }

    // Debounce amount changes
    const timer = setTimeout(regenerateInvoice, 500)
    return () => clearTimeout(timer)
  }, [isBtc, amount, bitcoinUnit, lnInvoice])

  // Poll invoice status for Lightning payments (BTC unified + RGB lightning)
  const activeInvoice = isBtc ? lnInvoiceStr : address
  const { data: invoiceStatus } = nodeApi.useInvoiceStatusQuery(
    { invoice: activeInvoice as string },
    {
      pollingInterval: 1000,
      skip:
        !activeInvoice?.startsWith('ln') || (!isBtc && network !== 'lightning'),
    }
  )

  // --- RGB-specific: auto-generate on-chain address for BTC (legacy path removed, handled above) ---
  useEffect(() => {
    const generateBtcAddress = async () => {
      if (
        !isBtc &&
        assetId === BTC_ASSET_ID &&
        network === 'on-chain' &&
        !address
      ) {
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
  }, [isBtc, assetId, network, address, addressQuery])

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
    if (isBtc) {
      // For BTC unified view, always calculate max (used for LN invoice amount validation)
      const maxAmount = calculateMaxDepositAmount('BTC')
      setMaxDepositAmount(maxAmount)
    } else if (network === 'lightning' && assetId) {
      const maxAmount = calculateMaxDepositAmount(assetId)
      setMaxDepositAmount(maxAmount)
    } else {
      setMaxDepositAmount(0)
    }
  }, [isBtc, network, assetId, calculateMaxDepositAmount])

  // Reset address when switching networks (RGB only)
  useEffect(() => {
    if (!isBtc) {
      setAddress(undefined)
      setAmount('')
      setNoColorableUtxos(false)
      setUsePrivacy(true)
    }
  }, [network, isBtc])

  // Reset address when switching privacy mode
  useEffect(() => {
    if (network === 'on-chain' && assetId !== BTC_ASSET_ID) {
      setAddress(undefined)
    }
  }, [usePrivacy])

  // Reset RGB address when amount changes
  useEffect(() => {
    if (isBtc) return
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
    if (!isBtc) {
      prevAmountRef.current = amount
    }
  }, [amount, address, network, assetId, isBtc])

  const [recipientId, setRecipientId] = useState<string>()

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

  const titleText = assetId
    ? assetTicker
      ? t('depositModal.step2.titleWithTicker', { ticker: assetTicker })
      : t('depositModal.step2.titleGeneric')
    : t('depositModal.step2.titleAny')

  // Enhanced amount input change handler with formatting
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value

    value = value.replace(/[^\d.,]/g, '')
    const cleanValue = value.replace(/,/g, '')

    const parts = cleanValue.split('.')
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('')
    } else {
      value = cleanValue
    }

    const asset = isBtc ? 'BTC' : assetTicker
    const precision = getAssetPrecision(asset, bitcoinUnit, assetList?.nia)

    const decimalParts = value.split('.')
    if (decimalParts.length === 2 && decimalParts[1].length > precision) {
      value = decimalParts[0] + '.' + decimalParts[1].substring(0, precision)
    }

    // For RGB lightning, validate against max deposit amount
    if (!isBtc && network === 'lightning' && maxDepositAmount > 0) {
      const numValue = parseFloat(value)
      if (!isNaN(numValue) && numValue > 0) {
        const baseUnits = parseAmount(value, asset)
        const maxBaseUnits = maxDepositAmount

        if (baseUnits > maxBaseUnits) {
          return
        }
      }
    }

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
      const asset = isBtc ? 'BTC' : assetTicker
      const formattedMax = formatAmount(maxDepositAmount, asset)
      setAmount(formattedMax)
    }
  }

  const generateRgbInvoice = async (amountValue?: string) => {
    try {
      let assignment: AssignmentFungible | undefined = undefined

      if (amountValue && amountValue.trim() !== '') {
        const cleanAmount = amountValue.replace(/,/g, '')
        const numericAmount = parseFloat(cleanAmount)

        if (!isNaN(numericAmount) && numericAmount > 0) {
          const asset = isBtc ? 'BTC' : assetTicker
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

      if ('error' in res && res.error) {
        const err = res.error as any
        const errorMessage =
          err.data && err.data.error ? err.data.error : 'Unknown error'

        const wasHandled = handleApiError(res.error, 'issuance', 0, () =>
          generateRgbInvoice(amountValue)
        )

        if (!wasHandled) {
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
        return
      }

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

  // Generate address for RGB flows only (BTC is auto-generated)
  const generateAddress = async () => {
    setLoading(true)
    try {
      if (network === 'lightning') {
        const hasAmount = amount && parseFloat(amount.replace(/,/g, '')) > 0

        let res
        if (hasAmount) {
          const cleanAmount = amount.replace(/,/g, '')
          const numericAmount = parseFloat(cleanAmount)

          res = await lnInvoice(
            assetId === BTC_ASSET_ID
              ? {
                  amt_msat:
                    bitcoinUnit === 'SAT'
                      ? numericAmount * 1000
                      : numericAmount * SATOSHIS_PER_BTC * 1000,
                }
              : {
                  asset_amount: parseAmount(cleanAmount, assetTicker),
                  asset_id: assetId,
                }
          )
        } else {
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

  // Regenerate both for BTC unified view
  const handleRegenerateBtc = async () => {
    setLoading(true)
    try {
      const cleanAmount = amount.replace(/,/g, '')
      const numericAmount = parseFloat(cleanAmount)
      const hasAmount = !isNaN(numericAmount) && numericAmount > 0

      const [addrRes, invoiceRes] = await Promise.all([
        addressQuery(),
        lnInvoice(
          hasAmount
            ? {
                amt_msat:
                  bitcoinUnit === 'SAT'
                    ? numericAmount * 1000
                    : numericAmount * SATOSHIS_PER_BTC * 1000,
              }
            : {}
        ),
      ])

      if (addrRes.data?.address) {
        setOnchainAddress(addrRes.data.address)
      }
      if (invoiceRes && !('error' in invoiceRes) && invoiceRes.data?.invoice) {
        setLnInvoiceStr(invoiceRes.data.invoice)
      }
    } catch {
      toast.error(t('depositModal.step2.toasts.generateAddressError'))
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
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

  // Close modal on successful payment
  useEffect(() => {
    if (invoiceStatus?.status === 'Succeeded') {
      toast.success(t('depositModal.step2.toasts.lightningSuccess'), {
        autoClose: 5000,
        progressStyle: { background: '#3B82F6' },
      })
      onNext()
    } else if (
      invoiceStatus?.status === 'Failed' ||
      invoiceStatus?.status === 'Expired'
    ) {
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

  // Determine if BTC unified view has data ready
  const btcReady = isBtc && (onchainAddress || lnInvoiceStr)

  const addressLabel =
    network === 'lightning'
      ? t('depositModal.step2.labels.lnInvoice')
      : assetId === BTC_ASSET_ID
        ? t('depositModal.step2.labels.btcAddress')
        : t('depositModal.step2.labels.rgbInvoice')

  return (
    <div className="bg-surface-base/50 backdrop-blur-sm rounded-2xl border border-border-subtle/50 p-4">
      <div className="flex flex-col items-center mb-2">
        {assetId === BTC_ASSET_ID ? (
          <img alt="Bitcoin" className="w-8 h-8 mb-2" src={btcLogo} />
        ) : (
          <img alt="RGB Asset" className="w-8 h-8 mb-2" src={rgbLogo} />
        )}

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
        {/* Network Selection - Only for RGB assets */}
        {!isBtc && (
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
        )}

        {/* RGB Privacy Mode Toggle */}
        {!isBtc && network === 'on-chain' && assetId !== BTC_ASSET_ID && (
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

        {/* Network info and faucet suggestion */}
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

        {/* No Colorable UTXOs Warning */}
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

        {/* === BTC Unified View: Amount + QR + Both addresses === */}
        {isBtc && (
          <>
            {/* BTC Amount Input (optional) */}
            <div className="space-y-1 animate-fadeIn">
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium text-content-secondary">
                  {t('depositModal.step2.amount.optionalLabel')}
                </label>
                {maxDepositAmount > 0 && (
                  <div className="text-xs text-content-secondary">
                    {t('depositModal.step2.amount.maxLabel', {
                      amount: formatAmount(maxDepositAmount, 'BTC'),
                      asset: getDisplayAsset('BTC', bitcoinUnit),
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
                    placeholder={t('depositModal.step2.amount.btcPlaceholder')}
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
                  {getDisplayAsset('BTC', bitcoinUnit)}
                </div>
              </div>
              <div className="mt-1 p-2 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-xs text-primary">
                  {t('depositModal.step2.amount.zeroAmountInfo')}
                </p>
              </div>
            </div>

            {/* BTC Unified QR + Addresses */}
            {loading && !btcReady ? (
              <div className="flex justify-center py-8">
                <Loader className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : btcReady ? (
              <div className="space-y-3 animate-fadeIn">
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

                {/* Unified BIP21 QR Code */}
                <div className="flex justify-center py-1">
                  <div className="p-2 bg-white rounded-xl shadow-xl">
                    <QRCodeCanvas
                      includeMargin={true}
                      level="H"
                      size={window.innerWidth < 500 ? 130 : 150}
                      value={bip21URI || onchainAddress || ''}
                    />
                  </div>
                </div>

                {/* BIP21 badge */}
                <div className="flex justify-center">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-overlay/50 border border-border-default text-xs text-content-secondary">
                    <ChainIcon className="w-3 h-3" />
                    <span>+</span>
                    <Zap className="w-3 h-3" />
                    <span>{t('depositModal.step2.bip21.badge')}</span>
                  </span>
                </div>

                {/* On-chain Address */}
                {onchainAddress && (
                  <div
                    className="p-3 bg-surface-overlay/50 rounded-xl border border-border-default
                                flex items-center justify-between group hover:border-primary/50
                                transition-all duration-200"
                  >
                    <div className="truncate flex-1 text-content-secondary font-mono text-xs flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded-md text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/20 flex-shrink-0">
                        {t('depositModal.step2.labels.btcAddress')}
                      </span>
                      <span className="truncate">
                        {onchainAddress.length > 40
                          ? `${onchainAddress.slice(0, 20)}...${onchainAddress.slice(-10)}`
                          : onchainAddress}
                      </span>
                    </div>
                    <button
                      className="ml-2 p-1.5 hover:bg-primary/10 rounded-lg transition-colors
                               text-content-secondary hover:text-primary flex-shrink-0"
                      onClick={() => handleCopy(onchainAddress)}
                      title={t('depositModal.step2.actions.copy')}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Lightning Invoice */}
                {lnInvoiceStr && (
                  <div
                    className="p-3 bg-surface-overlay/50 rounded-xl border border-border-default
                                flex items-center justify-between group hover:border-primary/50
                                transition-all duration-200"
                  >
                    <div className="truncate flex-1 text-content-secondary font-mono text-xs flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded-md text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 flex-shrink-0">
                        {t('depositModal.step2.labels.lnInvoice')}
                      </span>
                      <span className="truncate">
                        {lnInvoiceStr.length > 40
                          ? `${lnInvoiceStr.slice(0, 20)}...${lnInvoiceStr.slice(-10)}`
                          : lnInvoiceStr}
                      </span>
                    </div>
                    <button
                      className="ml-2 p-1.5 hover:bg-primary/10 rounded-lg transition-colors
                               text-content-secondary hover:text-primary flex-shrink-0"
                      onClick={() => handleCopy(lnInvoiceStr)}
                      title={t('depositModal.step2.actions.copy')}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Regenerate button */}
                <button
                  className="w-full py-2 px-4 bg-surface-overlay/50 hover:bg-surface-overlay rounded-xl
                           border border-border-default hover:border-primary/50 text-content-secondary
                           hover:text-primary transition-all duration-200 flex items-center justify-center gap-2 text-sm"
                  disabled={loading}
                  onClick={handleRegenerateBtc}
                >
                  <Loader
                    className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                  />
                  <span>{t('depositModal.step2.actions.regenerate')}</span>
                </button>
              </div>
            ) : null}
          </>
        )}

        {/* === RGB Asset Flows (existing behavior) === */}
        {!isBtc && (
          <>
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

            {/* Amount Input for Lightning (RGB) */}
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
                      placeholder={t(
                        'depositModal.step2.amount.maxPlaceholder',
                        {
                          amount:
                            maxDepositAmount > 0
                              ? formatAmount(
                                  maxDepositAmount,
                                  assetId === BTC_ASSET_ID ? 'BTC' : assetTicker
                                )
                              : t('depositModal.step2.amount.notAvailable'),
                        }
                      )}
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

                <div className="mt-1 p-2 bg-primary/10 rounded-lg border border-primary/20">
                  <p className="text-xs text-primary">
                    {t('depositModal.step2.amount.zeroAmountInfo')}
                  </p>
                </div>
              </div>
            )}

            {/* RGB Generate / Display */}
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

                {/* QR Code */}
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

                {/* Address Display */}
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
                    {address.length > 45
                      ? `${address.slice(0, 42)}...`
                      : address}
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
                      onClick={() => handleCopy(address)}
                      title={t('depositModal.step2.actions.copy')}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Recipient ID Display for Assets */}
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
          </>
        )}

        {/* Navigation */}
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
