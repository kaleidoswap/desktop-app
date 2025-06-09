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
import { useState, useEffect, useMemo, useCallback } from 'react'
import { toast } from 'react-toastify'

import { useAppSelector } from '../../../../app/store/hooks'
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

  const { showUtxoModal, setShowUtxoModal, utxoModalProps, handleApiError } =
    useUtxoErrorHandler()

  const bitcoinUnit = useAppSelector((state) => state.settings.bitcoinUnit)
  const [addressQuery] = nodeApi.endpoints.address.useLazyQuery()
  const [lnInvoice] = nodeApi.endpoints.lnInvoice.useLazyQuery()
  const [rgbInvoice] = nodeApi.endpoints.rgbInvoice.useLazyQuery()

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

  // Calculate max deposit amount based on HTLC limits (similar to market maker)
  const calculateMaxDepositAmount = useCallback(
    (asset: string): number => {
      if (asset === 'BTC') {
        if (channels.length === 0) {
          return 0
        }

        const channelHtlcLimits = channels.map(
          (c: Channel) => c.next_outbound_htlc_limit_msat / MSATS_PER_SAT
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
        // For RGB assets, we still need to consider the BTC HTLC limits
        // since RGB transfers require BTC for fees
        return calculateMaxDepositAmount('BTC')
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
  }, [network])

  const [assetTicker, setAssetTicker] = useState<string>('')
  const [assetName, setAssetName] = useState<string>('')
  const { data: assetList } = nodeApi.endpoints.listAssets.useQuery()

  useEffect(() => {
    if (assetList?.nia && assetId !== BTC_ASSET_ID && assetId) {
      const asset = assetList.nia.find((a) => a.asset_id === assetId)
      if (asset) {
        setAssetTicker(asset.ticker)
        setAssetName(asset.name)
      }
    } else if (assetId === BTC_ASSET_ID) {
      setAssetTicker('BTC')
      setAssetName('Bitcoin')
    }
  }, [assetList, assetId])

  useEffect(() => {
    if (network === 'lightning' && address) {
      setAddress(undefined)
    }
  }, [amount, network])

  const [recipientId, setRecipientId] = useState<string>()

  // Add network info query
  const { data: networkInfo } = nodeApi.endpoints.networkInfo.useQuery()

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

    // Format with comma separators but only for the integer part
    const formattedValue =
      value.split('.').length === 2
        ? value.split('.')[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') +
          '.' +
          value.split('.')[1]
        : value.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

    // Validate against max deposit amount for lightning
    if (network === 'lightning' && maxDepositAmount > 0) {
      const numValue = parseFloat(value)
      if (!isNaN(numValue) && numValue > 0) {
        // Convert to base units and check against max
        const baseUnits = parseAmount(value, asset)
        const maxBaseUnits = parseAmount(maxDepositAmount.toString(), asset)

        if (baseUnits > maxBaseUnits) {
          // Don't update if it exceeds the limit
          return
        }
      }
    }

    setAmount(formattedValue)
  }

  const generateRgbInvoice = async () => {
    try {
      const res = await rgbInvoice(assetId ? { asset_id: assetId } : {})
      setNoColorableUtxos(false)
      if ('error' in res && res.error) {
        const errorMessage =
          'data' in res.error ? res.error.data?.error : 'Unknown error'

        // Check if this is a UTXO-related error
        const wasHandled = handleApiError(
          res.error,
          'issuance',
          0,
          generateRgbInvoice
        )

        if (!wasHandled) {
          // Check specifically for no colorable UTXOs error to show our custom message
          if (errorMessage.includes('No uncolored UTXOs are available')) {
            setNoColorableUtxos(true)
          } else {
            toast.error('Failed to generate RGB invoice: ' + errorMessage)
          }
        }
      } else {
        setAddress(res.data?.invoice)
        setRecipientId(res.data?.recipient_id)
      }
    } catch (error) {
      toast.error('Failed to generate RGB invoice')
    }
  }

  const generateAddress = async () => {
    setLoading(true)
    try {
      if (network === 'lightning') {
        if (!amount || parseFloat(amount.replace(/,/g, '')) <= 0) {
          toast.error('Please enter a valid positive amount')
          setLoading(false)
          return
        }

        // Parse the amount properly, removing commas
        const cleanAmount = amount.replace(/,/g, '')
        const numericAmount = parseFloat(cleanAmount)

        const res = await lnInvoice(
          assetId === BTC_ASSET_ID
            ? {
                amt_msat:
                  bitcoinUnit === 'SAT'
                    ? numericAmount * 1000
                    : numericAmount * Math.pow(10, 8) * 1000,
              }
            : {
                asset_amount: numericAmount,
                asset_id: assetId,
              }
        )
        if ('error' in res) {
          toast.error('Failed to generate Lightning invoice')
        } else {
          setAddress(res.data?.invoice)
        }
      } else if (!assetId || assetId !== BTC_ASSET_ID) {
        await generateRgbInvoice()
      } else {
        const res = await addressQuery()
        setAddress(res.data?.address)
      }
    } catch (error) {
      toast.error('Failed to generate address')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address ?? '')
      toast.success('Address copied to clipboard')
    } catch (error) {
      toast.error('Failed to copy address')
    }
  }

  const handleCopyRecipientId = async () => {
    try {
      await navigator.clipboard.writeText(recipientId ?? '')
      toast.success('Recipient ID copied to clipboard')
    } catch (error) {
      toast.error('Failed to copy recipient ID')
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
          flex-1 py-4 px-6 flex flex-col items-center justify-center gap-2
          rounded-xl transition-all duration-200 border-2
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${
            network === type
              ? 'bg-blue-500/10 border-blue-500 text-blue-500'
              : 'border-slate-700 hover:border-blue-500/50 text-slate-400 hover:text-blue-500/80'
          }
        `}
        disabled={isDisabled}
        onClick={() => !isDisabled && setNetwork(type)}
      >
        <Icon
          className={`w-6 h-6 ${network === type ? 'animate-pulse' : ''}`}
        />
        <span className="font-medium">{label}</span>
        {isDisabled && (
          <span className="text-xs text-slate-500">Requires asset ID</span>
        )}
      </button>
    )
  }

  const getStatusColor = () => {
    if (!invoiceStatus) return 'text-slate-400'
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
      toast.success(`Lightning deposit received successfully!`, {
        autoClose: 5000,
        progressStyle: { background: '#3B82F6' },
      })
      onNext()
    } else if (
      invoiceStatus?.status === 'Failed' ||
      invoiceStatus?.status === 'Expired'
    ) {
      // Show failure toast notification
      toast.error(`Lightning deposit failed: ${invoiceStatus.status}`, {
        autoClose: 5000,
      })
    }
  }, [invoiceStatus, onNext])

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800/50 p-6">
      <div className="flex flex-col items-center mb-4">
        {/* Display selected asset icon */}
        {assetId === BTC_ASSET_ID ? (
          <img alt="Bitcoin" className="w-10 h-10 mb-3" src={btcLogo} />
        ) : (
          <img alt="RGB Asset" className="w-10 h-10 mb-3" src={rgbLogo} />
        )}

        {/* Show the asset name and ticker prominently */}
        <h3 className="text-2xl font-bold text-white mb-1">
          {assetId
            ? assetTicker
              ? `Deposit ${assetTicker}`
              : 'Deposit Asset'
            : 'Deposit Any RGB Asset'}
        </h3>

        {assetName && (
          <div className="text-slate-400 mb-1 text-sm">{assetName}</div>
        )}

        {assetId && assetId !== BTC_ASSET_ID && (
          <div className="text-xs text-slate-500 mt-1 bg-slate-800 px-2 py-0.5 rounded-full">
            {assetId.slice(0, 8)}...{assetId.slice(-8)}
          </div>
        )}

        <p className="text-slate-400 text-center max-w-md mt-2 text-xs">
          Choose your preferred deposit method and follow the steps below
        </p>
      </div>

      <div className="space-y-4">
        {/* Network Selection - Made more compact and sticky */}
        <div className="flex gap-3 mb-3 top-[60px] z-20 pb-2 pt-1 bg-slate-900/95 backdrop-blur-sm">
          <NetworkOption icon={ChainIcon} label="On-chain" type="on-chain" />
          <NetworkOption icon={Zap} label="Lightning" type="lightning" />
        </div>

        {/* Show network info and faucet suggestion in a more compact format */}
        {networkInfo && (
          <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-500/20 text-xs font-medium">
                  {networkInfo.network}
                </span>
                <span className="text-blue-400 text-xs">
                  Using {networkInfo.network} network
                </span>
              </div>

              <div className="text-xs text-blue-400 mt-1">
                <p className="mb-1.5">
                  Get test coins from the
                  {networkInfo.network === Network.Signet
                    ? ' Mutinynet faucet'
                    : networkInfo.network === Network.Regtest
                      ? ' RGB Tools bot'
                      : ' Testnet faucet'}{' '}
                  to try the application.
                </p>
                <button
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/20 
                          hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors text-xs"
                  onClick={() => {
                    const link =
                      networkInfo.network === Network.Regtest
                        ? 'https://t.me/rgb_lightning_bot'
                        : 'https://faucet.mutinynet.com/'
                    openUrl(link)
                  }}
                >
                  <ArrowRight className="w-3 h-3" />
                  {networkInfo.network === Network.Signet
                    ? 'Visit Mutinynet Faucet'
                    : networkInfo.network === Network.Regtest
                      ? 'Open RGB Tools Bot'
                      : 'Visit Testnet Faucet'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* No Colorable UTXOs Warning - Made more compact */}
        {noColorableUtxos && (
          <div className="p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
            <div className="flex items-start">
              <AlertTriangle className="text-yellow-500 w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-yellow-400 font-medium text-sm mb-1">
                  Colorable UTXOs Required
                </h4>
                <p className="text-yellow-300/80 text-xs mb-2">
                  To receive onchain RGB assets, you need colorable UTXOs.
                </p>
                <button
                  className="px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 
                          rounded-lg transition-colors text-xs flex items-center gap-2"
                  onClick={() => setShowUtxoModal(true)}
                >
                  <Wallet className="w-3.5 h-3.5" />
                  Create Colorable UTXOs
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Amount Input for Lightning */}
        {network === 'lightning' && (
          <div className="space-y-1 animate-fadeIn">
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-slate-400">
                Amount
              </label>
              {maxDepositAmount > 0 && (
                <div className="text-xs text-slate-400">
                  Max:{' '}
                  {formatAmount(
                    maxDepositAmount,
                    assetId === BTC_ASSET_ID ? 'BTC' : assetTicker
                  )}{' '}
                  {getDisplayAsset(
                    assetId === BTC_ASSET_ID ? 'BTC' : assetTicker,
                    bitcoinUnit
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                autoFocus
                className="flex-1 px-3 py-2 bg-slate-800/50 rounded-xl border border-slate-700 
                         focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white
                         placeholder:text-slate-600 transition-all duration-200 text-sm"
                inputMode="decimal"
                onChange={handleAmountChange}
                placeholder={`Enter amount (max ${maxDepositAmount > 0 ? formatAmount(maxDepositAmount, assetId === BTC_ASSET_ID ? 'BTC' : assetTicker) : 'N/A'})`}
                type="text"
                value={amount}
              />
              <div className="px-3 py-2 bg-slate-800/50 rounded-xl border border-slate-700 text-slate-400 text-sm">
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
                  ) >
                    parseAmount(
                      maxDepositAmount.toString(),
                      assetId === BTC_ASSET_ID ? 'BTC' : assetTicker
                    ) && (
                    <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                      <p className="text-xs text-red-400">
                        <span className="font-medium">Error:</span> Amount
                        exceeds maximum deposit limit of{' '}
                        {formatAmount(
                          maxDepositAmount,
                          assetId === BTC_ASSET_ID ? 'BTC' : assetTicker
                        )}{' '}
                        {getDisplayAsset(
                          assetId === BTC_ASSET_ID ? 'BTC' : assetTicker,
                          bitcoinUnit
                        )}
                        .
                      </p>
                    </div>
                  )}
                </div>
              )}

            {assetId && assetId !== BTC_ASSET_ID && (
              <div className="mt-1 p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <p className="text-xs text-blue-400">
                  <span className="font-medium">Note:</span> 3,000 sats required
                  for RGB asset transfers.
                </p>
              </div>
            )}

            {maxDepositAmount === 0 && (
              <div className="mt-1 p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                <p className="text-xs text-yellow-400">
                  <span className="font-medium">Warning:</span> No active
                  Lightning channels found. Lightning deposits are not
                  available.
                </p>
              </div>
            )}
          </div>
        )}

        {!address ? (
          <button
            className="w-full py-2.5 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900
                     text-white rounded-xl font-medium transition-all duration-200 
                     flex items-center justify-center gap-2 disabled:cursor-not-allowed"
            disabled={
              loading ||
              (network === 'lightning' &&
                (!amount || parseFloat(amount.replace(/,/g, '')) <= 0)) ||
              (network === 'lightning' &&
                maxDepositAmount > 0 &&
                amount &&
                parseAmount(
                  amount,
                  assetId === BTC_ASSET_ID ? 'BTC' : assetTicker
                ) >
                  parseAmount(
                    maxDepositAmount.toString(),
                    assetId === BTC_ASSET_ID ? 'BTC' : assetTicker
                  )) ||
              (network === 'lightning' && maxDepositAmount === 0)
            }
            onClick={generateAddress}
          >
            {loading ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>
                  Generate {network === 'lightning' ? 'Invoice' : 'Address'}
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
                className={`flex items-center justify-center gap-2 ${getStatusColor()} text-sm py-2 bg-slate-800/50 rounded-lg`}
              >
                {invoiceStatus.status === 'Pending' ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Waiting for payment...</span>
                  </>
                ) : invoiceStatus.status === 'Succeeded' ? (
                  <>
                    <CircleCheckBig className="w-4 h-4" />
                    <span>Payment received!</span>
                  </>
                ) : (
                  <>
                    <CircleX className="w-4 h-4" />
                    <span>{invoiceStatus.status}</span>
                  </>
                )}
              </div>
            )}

            {/* QR Code - Made more responsive */}
            <div className="flex justify-center py-2">
              <div className="p-3 bg-white rounded-xl shadow-xl">
                <QRCodeCanvas
                  includeMargin={true}
                  level="H"
                  size={window.innerWidth < 500 ? 140 : 160}
                  value={address}
                />
              </div>
            </div>

            {/* Address Display - More compact */}
            <div
              className="p-3 bg-slate-800/50 rounded-xl border border-slate-700 
                          flex items-center justify-between group hover:border-blue-500/50 
                          transition-all duration-200"
            >
              <div className="truncate flex-1 text-slate-300 font-mono text-xs flex items-center gap-2">
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
                  {assetId === BTC_ASSET_ID
                    ? network === 'lightning'
                      ? 'LN Invoice'
                      : 'BTC Address'
                    : network === 'lightning'
                      ? 'LN Invoice'
                      : 'RGB Invoice'}
                </span>
                {address.length > 45 ? `${address.slice(0, 42)}...` : address}
              </div>
              <button
                className="ml-2 p-1.5 hover:bg-blue-500/10 rounded-lg transition-colors
                         text-slate-400 hover:text-blue-500"
                onClick={handleCopy}
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>

            {/* Recipient ID Display for Assets - More compact */}
            {assetId !== BTC_ASSET_ID &&
              recipientId &&
              network === 'on-chain' && (
                <div
                  className="p-3 bg-slate-800/50 rounded-xl border border-slate-700 
                            flex items-center justify-between group hover:border-blue-500/50 
                            transition-all duration-200"
                >
                  <div className="truncate flex-1 text-slate-300 font-mono text-xs">
                    <span className="text-slate-400 mr-2">Recipient ID:</span>
                    {recipientId.length > 45
                      ? `${recipientId.slice(0, 42)}...`
                      : recipientId}
                  </div>
                  <button
                    className="ml-2 p-1.5 hover:bg-blue-500/10 rounded-lg transition-colors
                           text-slate-400 hover:text-blue-500"
                    onClick={handleCopyRecipientId}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              )}
          </div>
        )}

        {/* Navigation - Sticky to the bottom */}
        <div className="sticky bottom-0 pt-4 pb-1 flex justify-between bg-slate-900/95 backdrop-blur-sm z-10">
          <button
            className="px-3 py-2 text-slate-400 hover:text-white transition-colors 
                     flex items-center gap-1.5 hover:bg-slate-800/50 rounded-lg text-sm"
            onClick={onBack}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          <button
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg 
                     transition-colors flex items-center gap-1.5 text-sm"
            onClick={onNext}
          >
            <span>Finish</span>
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
