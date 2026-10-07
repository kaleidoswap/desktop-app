import { openUrl } from '@tauri-apps/plugin-opener'
import {
  ArrowLeft,
  Download,
  Droplet,
  Loader,
  RefreshCw,
  Wallet,
  X,
  Zap,
  Link as ChainIcon,
  AlertTriangle,
} from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'

import { useAppSelector } from '../../../../app/store/hooks'
import { useSettings } from '../../../../hooks/useSettings'
import btcLogo from '../../../../assets/bitcoin-logo.svg'
import lightningLogo from '../../../../assets/lightning-logo.svg'
import rgbLogo from '../../../../assets/rgb-logo.svg'
import { CreateUTXOModal } from '../../../../components/CreateUTXOModal'
import { BTC_ASSET_ID } from '../../../../constants'
import {
  formatAssetAmountWithPrecision,
  parseAssetAmountWithPrecision,
  getAssetPrecision,
  getDisplayAsset,
} from '../../../../helpers/number'
import { formatAssetAmount } from '../../../../helpers/walletHistoryUtils'
import { useUtxoErrorHandler } from '../../../../hooks/useUtxoErrorHandler'
import {
  nodeApi,
  Network,
  Channel,
  AssignmentFungible,
} from '../../../../slices/nodeApi/nodeApi.slice'
import { logger } from '../../../../utils/logger'

import { AddressField, ReceivedPanel, WaitingIndicator } from './ReceiveParts'
import {
  useOnchainDepositWatcher,
  useRgbReceiveWatcher,
} from './useReceiveWatchers'

interface Props {
  assetId?: string
  onBack: VoidFunction
  onClose: () => void
  onNext: VoidFunction
}

const MSATS_PER_SAT = 1000
const SATOSHIS_PER_BTC = 100_000_000

export const Step2 = ({ assetId, onBack, onClose, onNext }: Props) => {
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
  const transportEndpoint = useAppSelector(
    (state) => state.nodeSettings.data.proxy_endpoint
  )
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
        // The most a single Lightning payment can carry is the largest HTLC
        // limit across all channels. This bound is Lightning-only; on-chain
        // deposits are unlimited.
        if (channels.length === 0) {
          return 0
        }

        const htlcLimitsSats = channels.map(
          (c: Channel) => (c.next_outbound_htlc_limit_msat ?? 0) / MSATS_PER_SAT
        )

        return Math.max(0, Math.max(...htlcLimitsSats))
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
  const { data: assetList } = nodeApi.endpoints.listAssets.useQuery()

  useEffect(() => {
    if (assetList?.nia && assetId !== BTC_ASSET_ID && assetId) {
      const asset = assetList.nia.find((a: any) => a.asset_id === assetId)
      if (asset) {
        setAssetTicker(asset.ticker ?? '')
      }
    } else if (assetId === BTC_ASSET_ID) {
      setAssetTicker('BTC')
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

      if (transportEndpoint) {
        requestBody.transport_endpoints = [transportEndpoint]
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
        logger.error('RGB invoice response missing data:', res)
        toast.error(t('depositModal.step2.toasts.rgbInvoiceInvalid'))
      }
    } catch (error) {
      logger.error('Error generating RGB invoice:', error)
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

  // RGB: (re)generate the invoice whenever it was cleared by a network,
  // privacy or amount change. Debounced so typing an amount doesn't spam.
  useEffect(() => {
    if (isBtc || address || noColorableUtxos) return
    if (network === 'lightning' && !assetId) return
    const timer = setTimeout(generateAddress, 600)
    return () => clearTimeout(timer)
  }, [isBtc, address, network, amount, usePrivacy, noColorableUtxos])

  const btcUnitLabel = bitcoinUnit === 'SAT' ? 'SATS' : bitcoinUnit

  // --- Payment detection ---------------------------------------------------
  const [lnReceived, setLnReceived] = useState(false)
  const btcDeposit = useOnchainDepositWatcher(
    isBtc && !!onchainAddress && !lnReceived
  )
  const rgbDeposit = useRgbReceiveWatcher(
    assetId,
    recipientId,
    !isBtc && network === 'on-chain' && !!address
  )

  useEffect(() => {
    if (invoiceStatus?.status === 'Succeeded') {
      setLnReceived(true)
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
  }, [invoiceStatus])

  const displayTicker = isBtc ? btcUnitLabel : assetTicker
  const enteredAmount = parseFloat(amount.replace(/,/g, '')) > 0 ? amount : ''

  const received = lnReceived
    ? {
        amountLabel: enteredAmount
          ? `${enteredAmount} ${displayTicker}`
          : undefined,
        confirmed: true,
        txid: undefined,
      }
    : (() => {
        const detected = isBtc ? btcDeposit : rgbDeposit
        if (!detected) return undefined
        return {
          amountLabel:
            detected.amount != null
              ? `${formatAssetAmount(
                  detected.amount,
                  isBtc,
                  bitcoinUnit,
                  getAssetPrecision(assetTicker, bitcoinUnit, assetList?.nia)
                )} ${displayTicker}`
              : undefined,
          confirmed: detected.confirmed,
          txid: detected.txid,
        }
      })()

  const networkKey = String(networkInfo?.network ?? '').toLowerCase()
  const isMainnet = networkKey === Network.Mainnet
  const faucetKey =
    networkKey === Network.Signet || networkKey === Network.SignetCustom
      ? 'signet'
      : networkKey === Network.Regtest
        ? 'regtest'
        : 'testnet'
  const faucetLink =
    faucetKey === 'regtest'
      ? 'https://t.me/rgb_lightning_bot'
      : 'https://faucet.mutinynet.com/'

  const waitingLabel = isBtc
    ? t('depositModal.step2.status.waitingAny', 'Waiting for payment')
    : network === 'lightning'
      ? t('depositModal.step2.status.waitingLightning', 'Waiting for payment')
      : t('depositModal.step2.status.waitingOnchain', 'Waiting for transfer')

  const qrBlock = (value: string, badge?: ReactNode) => (
    <div className="flex flex-col items-center gap-3 py-1">
      <div className="p-3 bg-white rounded-2xl shadow-xl">
        <QRCodeCanvas
          includeMargin={false}
          level="M"
          size={196}
          value={value}
        />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <WaitingIndicator label={waitingLabel} />
        {badge}
      </div>
    </div>
  )

  const regenerateButton = (onClick: () => void, label: string) => (
    <button
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                 text-content-secondary hover:text-white hover:bg-surface-overlay/50
                 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      disabled={loading}
      onClick={onClick}
      type="button"
    >
      {loading ? (
        <Loader className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <RefreshCw className="w-3.5 h-3.5" />
      )}
      {label}
    </button>
  )

  const amountInput = (opts: {
    label: string
    placeholder: string
    unit: string
    showMax: boolean
    autoFocus?: boolean
  }) => (
    <div className="space-y-1.5 animate-fadeIn">
      <label className="block text-xs font-medium text-content-secondary">
        {opts.label}
      </label>
      <div className="flex items-center gap-2 px-3 bg-surface-overlay/50 rounded-xl border border-border-default focus-within:border-primary transition-colors">
        <input
          autoFocus={opts.autoFocus}
          className="flex-1 min-w-0 py-2.5 bg-transparent text-white text-sm tabular-nums
                     placeholder:text-content-tertiary focus:outline-none"
          inputMode="decimal"
          onChange={handleAmountChange}
          placeholder={opts.placeholder}
          type="text"
          value={amount}
        />
        <span className="text-xs font-medium text-content-secondary">
          {opts.unit}
        </span>
        {opts.showMax && (
          <button
            className="px-2 py-1 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg transition-colors text-xs font-medium"
            onClick={handleSetMaxAmount}
            type="button"
          >
            {t('depositModal.step2.amount.maxButton')}
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div>
      <div className="flex items-center gap-3 pb-4 border-b border-divider/10 mb-5">
        <Download className="w-6 h-6 text-primary" />
        <h3 className="text-xl font-bold text-white flex-1">{titleText}</h3>
        <button
          className="text-content-secondary hover:text-white p-1.5 rounded-lg hover:bg-surface-high/60 transition-colors"
          onClick={onClose}
          type="button"
        >
          <X size={18} />
        </button>
      </div>

      {received ? (
        <ReceivedPanel
          amountLabel={received.amountLabel}
          confirmed={received.confirmed}
          kind={isBtc ? 'btc' : 'rgb'}
          onDone={onNext}
          txid={received.txid}
        />
      ) : (
        <div className="space-y-4">
          {/* Network selection — RGB assets only */}
          {!isBtc && (
            <div className="grid grid-cols-2 gap-1 p-1 bg-surface-overlay/50 rounded-xl border border-border-default">
              {(['on-chain', 'lightning'] as const).map((type) => {
                const isDisabled = type === 'lightning' && !assetId
                const Icon = type === 'lightning' ? Zap : ChainIcon
                const label = t(
                  `depositModal.step2.network.${type === 'on-chain' ? 'onchain' : 'lightning'}`
                )
                return (
                  <button
                    className={`py-2 px-3 flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors
                      ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}
                      ${
                        network === type
                          ? 'bg-surface-high text-white shadow-sm'
                          : 'text-content-secondary hover:text-white'
                      }`}
                    disabled={isDisabled}
                    key={type}
                    onClick={() => setNetwork(type)}
                    title={
                      isDisabled
                        ? t('depositModal.step2.network.requiresAsset')
                        : undefined
                    }
                    type="button"
                  >
                    <Icon
                      className={`w-4 h-4 ${
                        network === type
                          ? type === 'lightning'
                            ? 'text-network-lightning'
                            : 'text-network-rgb'
                          : ''
                      }`}
                    />
                    {label}
                  </button>
                )
              })}
            </div>
          )}

          {/* RGB privacy mode toggle */}
          {!isBtc && network === 'on-chain' && assetId !== BTC_ASSET_ID && (
            <div className="flex items-center justify-between gap-3 p-3 bg-surface-overlay/50 rounded-xl border border-border-default animate-fadeIn">
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
          )}

          {/* No colorable UTXOs warning */}
          {noColorableUtxos && (
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
              <AlertTriangle className="text-yellow-500 w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-yellow-400 font-medium text-xs mb-1">
                  {t('depositModal.step2.noColorable.title')}
                </h4>
                <p className="text-yellow-300/80 text-xs mb-2">
                  {t('depositModal.step2.noColorable.description')}
                </p>
                <button
                  className="px-2 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400
                          rounded-lg transition-colors text-xs flex items-center gap-1.5"
                  onClick={() => setShowUtxoModal(true)}
                  type="button"
                >
                  <Wallet className="w-3 h-3" />
                  {t('depositModal.step2.noColorable.cta')}
                </button>
              </div>
            </div>
          )}

          {/* === BTC unified view: amount + one BIP21 QR + both payloads === */}
          {isBtc && (
            <>
              {amountInput({
                label: t('depositModal.step2.amount.optionalLabel'),
                placeholder: t('depositModal.step2.amount.btcPlaceholder'),
                showMax: maxDepositAmount > 0,
                unit: btcUnitLabel,
              })}
              {maxDepositAmount > 0 && (
                <p className="-mt-2 text-xs text-content-tertiary">
                  {t(
                    'depositModal.step2.amount.maxLightning',
                    'Max via Lightning'
                  )}
                  : {formatAmount(maxDepositAmount, 'BTC')} {btcUnitLabel}
                </p>
              )}

              {onchainAddress || lnInvoiceStr ? (
                <div className="space-y-3 animate-fadeIn">
                  {qrBlock(
                    bip21URI || onchainAddress || '',
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-overlay/50 border border-border-default text-xs text-content-secondary">
                      <ChainIcon className="w-3 h-3 text-network-bitcoin" />
                      <span>+</span>
                      <Zap className="w-3 h-3 text-network-lightning" />
                      <span>{t('depositModal.step2.bip21.badge')}</span>
                    </span>
                  )}

                  {onchainAddress && (
                    <AddressField
                      icon={btcLogo}
                      label={t('depositModal.step2.labels.btcAddress')}
                      value={onchainAddress}
                    />
                  )}
                  {lnInvoiceStr && (
                    <AddressField
                      icon={lightningLogo}
                      label={t('depositModal.step2.labels.lnInvoice')}
                      value={lnInvoiceStr}
                    />
                  )}
                </div>
              ) : (
                <div className="flex justify-center py-16">
                  <Loader className="w-6 h-6 animate-spin text-primary" />
                </div>
              )}
            </>
          )}

          {/* === RGB asset flows === */}
          {!isBtc && (
            <>
              {network === 'on-chain' &&
                assetId &&
                assetId !== BTC_ASSET_ID &&
                amountInput({
                  label: t('depositModal.step2.amount.optionalLabel'),
                  placeholder: t(
                    'depositModal.step2.amount.requiredLabel',
                    'Enter amount'
                  ),
                  showMax: false,
                  unit: assetTicker,
                })}

              {network === 'lightning' && (
                <>
                  {amountInput({
                    autoFocus: true,
                    label: t('depositModal.step2.amount.optionalLabel'),
                    placeholder: t(
                      'depositModal.step2.amount.requiredLabel',
                      'Enter amount'
                    ),
                    showMax: maxDepositAmount > 0,
                    unit: assetTicker,
                  })}
                  {maxDepositAmount > 0 && (
                    <p className="-mt-2 text-xs text-content-tertiary">
                      Max: {formatAmount(maxDepositAmount, assetTicker)}{' '}
                      {assetTicker}
                    </p>
                  )}
                  {maxDepositAmount > 0 &&
                    enteredAmount &&
                    parseAmount(enteredAmount, assetTicker) >
                      maxDepositAmount && (
                      <p className="p-2 text-xs text-red-400 bg-red-500/10 rounded-lg border border-red-500/20">
                        {t('depositModal.step2.amount.exceeds', {
                          amount: formatAmount(maxDepositAmount, assetTicker),
                          asset: getDisplayAsset(assetTicker, bitcoinUnit),
                        })}
                      </p>
                    )}
                  {maxDepositAmount === 0 ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/15 border border-yellow-500/40 rounded-lg">
                      <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                      <p className="text-xs text-yellow-300 font-medium">
                        {t('depositModal.step2.amount.noChannels')}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-content-tertiary">
                      {t('depositModal.step2.amount.rgbNote')}
                    </p>
                  )}
                </>
              )}

              {address ? (
                <div className="space-y-3 animate-fadeIn">
                  {qrBlock(address)}

                  <AddressField
                    icon={network === 'lightning' ? lightningLogo : rgbLogo}
                    label={
                      network === 'lightning'
                        ? t('depositModal.step2.labels.lnInvoice')
                        : t('depositModal.step2.labels.rgbInvoice')
                    }
                    value={address}
                  />

                  {recipientId && network === 'on-chain' && (
                    <AddressField
                      icon={rgbLogo}
                      label={t(
                        'depositModal.step2.labels.recipientId',
                        'Recipient ID'
                      )}
                      value={recipientId}
                    />
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-10">
                  {loading ? (
                    <Loader className="w-6 h-6 animate-spin text-primary" />
                  ) : (
                    <button
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/15 hover:bg-primary/25 text-primary text-sm font-semibold transition-colors"
                      onClick={generateAddress}
                      type="button"
                    >
                      <RefreshCw className="w-4 h-4" />
                      {network === 'lightning'
                        ? t('depositModal.step2.actions.generateInvoice')
                        : t('depositModal.step2.actions.generateAddressCta')}
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* Secondary actions: fresh address + test-coin faucet off mainnet */}
          {(onchainAddress || lnInvoiceStr || address || !isMainnet) && (
            <div className="flex flex-wrap items-center justify-center gap-1">
              {isBtc &&
                (onchainAddress || lnInvoiceStr) &&
                regenerateButton(
                  handleRegenerateBtc,
                  t('depositModal.step2.actions.regenerate')
                )}
              {!isBtc &&
                address &&
                regenerateButton(
                  generateAddress,
                  t('depositModal.step2.actions.generateAddress')
                )}
              {isBtc && networkInfo && !isMainnet && (
                <button
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                             text-content-secondary hover:text-white hover:bg-surface-overlay/50 transition-colors"
                  onClick={() => openUrl(faucetLink)}
                  title={t(
                    `depositModal.step2.networkInfo.description.${faucetKey}`
                  )}
                  type="button"
                >
                  <Droplet className="w-3.5 h-3.5" />
                  {t(`depositModal.step2.networkInfo.button.${faucetKey}`)}
                </button>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-2 border-t border-divider/10">
            <button
              className="mt-3 px-3 py-2 text-content-secondary hover:text-white transition-colors
                       flex items-center gap-1.5 hover:bg-surface-overlay/50 rounded-lg text-sm"
              onClick={onBack}
              type="button"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t('depositModal.common.back')}</span>
            </button>

            <button
              className="mt-3 px-4 py-2 bg-surface-overlay/50 hover:bg-surface-high text-white border border-border-default
                       rounded-lg transition-colors flex items-center gap-1.5 text-sm font-semibold"
              onClick={onNext}
              type="button"
            >
              {t('depositModal.common.done', 'Done')}
            </button>
          </div>
        </div>
      )}

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
