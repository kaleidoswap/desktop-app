import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Copy,
} from 'lucide-react'
import { useMemo, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import BitcoinLogo from '../../assets/bitcoin-logo.svg'
import RgbLogo from '../../assets/rgb-logo.svg'
import { Button, Card } from '../../components/ui'
import { TNewChannelForm } from '../../slices/channel/channel.slice'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'

interface Props {
  error?: string
  onBack: VoidFunction
  onNext: VoidFunction
  feeRates: Record<string, number>
  formData: TNewChannelForm
  onFormUpdate: (updates: Partial<TNewChannelForm>) => void
}

const formatNumber = (num: number) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const formatPubKey = (pubKey: string) => {
  if (!pubKey) return ''
  return `${pubKey.slice(0, 8)}...${pubKey.slice(-8)}`
}

export const Step3 = ({ error, onBack, onNext, feeRates, formData }: Props) => {
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [assetPrecision, setAssetPrecision] = useState<number>(8)

  const [takerAssets] = nodeApi.endpoints.listAssets.useLazyQuery()

  useEffect(() => {
    if (formData.assetId) {
      takerAssets()
        .unwrap()
        .then((response) => {
          const asset = response.nia?.find(
            (a: any) => a.asset_id === formData.assetId
          )
          if (asset) {
            setAssetPrecision(asset.precision ?? 8)
          }
        })
        .catch((error) => {
          console.error('Error fetching asset information:', error)
        })
    }
  }, [formData.assetId, takerAssets])

  // Parse the peer connection string using useMemo to persist the values
  const connectionDetails = useMemo(() => {
    const [pubKey = '', hostAddress = ''] = formData.pubKeyAndAddress?.split(
      '@'
    ) ?? ['', '']
    const [host = '', port = ''] = hostAddress?.split(':') ?? ['', '']

    return { host, port, pubKey }
  }, [formData.pubKeyAndAddress])

  // Validate if we have the required data
  const hasValidNodeInfo = useMemo(() => {
    // Check if we have a valid pubkey-only format (66 hex chars) or full address format
    const isPubkeyOnly =
      formData.pubKeyAndAddress?.length === 66 &&
      /^[0-9a-f]+$/i.test(formData.pubKeyAndAddress)
    const isFullAddress = !!(
      connectionDetails.pubKey &&
      connectionDetails.host &&
      connectionDetails.port &&
      formData.pubKeyAndAddress
    )

    return isPubkeyOnly || isFullAddress
  }, [connectionDetails, formData.pubKeyAndAddress])

  // Determine if this is an asset channel
  const isAssetChannel = useMemo(() => {
    return !!(
      formData.assetId &&
      formData.assetAmount > 0 &&
      formData.assetTicker
    )
  }, [formData.assetId, formData.assetAmount, formData.assetTicker])

  // Format asset amount with proper precision
  const formatAssetAmount = useMemo(() => {
    if (!isAssetChannel) return '0'

    // For precision 0, the amount is already in base units, no division needed
    if (assetPrecision === 0) {
      return formData.assetAmount.toLocaleString('en-US')
    }

    const divisor = Math.pow(10, assetPrecision)
    const displayAmount = formData.assetAmount / divisor

    // Use the asset's precision for formatting, but don't show unnecessary trailing zeros
    return displayAmount.toFixed(assetPrecision).replace(/\.?0+$/, '')
  }, [formData.assetAmount, assetPrecision, isAssetChannel])

  const handleOpenChannel = () => {
    setIsSubmitting(true)
    // Add a small delay to show the animation
    setTimeout(() => {
      onNext()
      setIsSubmitting(false)
    }, 800)
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mt-4 mb-8">
        <h3 className="text-3xl font-bold text-white">
          {t('createChannel.step3.channelDetails')}
        </h3>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-center">
          {error}
        </div>
      )}

      <Card className="mb-6 divide-y divide-border-default/40">
        {/* Capacity */}
        <div className="flex items-center justify-between py-4 first:pt-0">
          <span className="text-sm text-content-secondary">
            {t('createChannel.step3.channelCapacity')}
          </span>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              <img alt="Bitcoin" className="w-3.5 h-3.5" src={BitcoinLogo} />
              <span className="text-white font-semibold">
                {formatNumber(formData.capacitySat)}{' '}
                {t('createChannel.step3.sat')}
              </span>
            </div>
            {isAssetChannel && (
              <div className="flex items-center gap-1.5">
                <img alt="RGB" className="w-3.5 h-3.5" src={RgbLogo} />
                <span className="text-white font-semibold text-sm">
                  {formatAssetAmount} {formData.assetTicker}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Liquidity */}
        {(() => {
          const outPct = 100
          const inPct = 0
          return (
            <div className="py-4">
              <span className="text-sm text-content-secondary block mb-3">
                {t('createChannel.step3.initialLiquidity')}
              </span>
              {/* BTC row */}
              <div className="mb-2">
                <div className="grid grid-cols-3 items-center text-xs mb-1">
                  <span className="flex items-center gap-1 text-purple-400 font-medium">
                    <ArrowUpRight className="w-3 h-3" />
                    {formatNumber(formData.capacitySat)} sat
                  </span>
                  <span className="text-center text-content-tertiary text-[10px] font-semibold uppercase tracking-wider">
                    BTC
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400 font-medium justify-end">
                    0 sat
                    <ArrowDownRight className="w-3 h-3" />
                  </span>
                </div>
                <div className="relative h-1.5 bg-surface-high/60 rounded-full overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full bg-[#9365FF] rounded-l-full"
                    style={{ width: `${outPct}%` }}
                  />
                  <div
                    className="absolute right-0 top-0 h-full bg-emerald-500 rounded-r-full"
                    style={{ width: `${inPct}%` }}
                  />
                  <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-surface-high/80" />
                </div>
                <div className="grid grid-cols-3 text-[10px] text-content-tertiary mt-1">
                  <span className="text-purple-400/70">Outbound</span>
                  <span />
                  <span className="text-right text-emerald-400/70">
                    Inbound
                  </span>
                </div>
              </div>
              {/* RGB asset row */}
              {isAssetChannel && (
                <div className="mt-3">
                  <div className="grid grid-cols-3 items-center text-xs mb-1">
                    <span className="flex items-center gap-1 text-purple-400 font-medium">
                      <ArrowUpRight className="w-3 h-3" />
                      {formatAssetAmount} {formData.assetTicker}
                    </span>
                    <span className="text-center text-content-tertiary text-[10px] font-semibold uppercase tracking-wider">
                      {formData.assetTicker}
                    </span>
                    <span className="flex items-center gap-1 text-emerald-400 font-medium justify-end">
                      0 {formData.assetTicker}
                      <ArrowDownRight className="w-3 h-3" />
                    </span>
                  </div>
                  <div className="relative h-1.5 bg-surface-high/60 rounded-full overflow-hidden">
                    <div
                      className="absolute left-0 top-0 h-full bg-[#9365FF] rounded-l-full"
                      style={{ width: `${outPct}%` }}
                    />
                    <div
                      className="absolute right-0 top-0 h-full bg-emerald-500 rounded-r-full"
                      style={{ width: `${inPct}%` }}
                    />
                    <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-surface-high/80" />
                  </div>
                  <div className="grid grid-cols-3 text-[10px] mt-1">
                    <span className="text-purple-400/70">Outbound</span>
                    <span />
                    <span className="text-right text-emerald-400/70">
                      Inbound
                    </span>
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* Peer */}
        <div className="flex items-start justify-between py-4">
          <span className="text-sm text-content-secondary shrink-0 mr-4">
            {t('createChannel.step3.connectedNode')}
          </span>
          {hasValidNodeInfo ? (
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1">
                <span className="text-sm text-white font-mono">
                  {formatPubKey(
                    connectionDetails.pubKey || formData.pubKeyAndAddress
                  )}
                </span>
                <div className="relative group/copy">
                  <button
                    className="text-content-tertiary hover:text-white p-0.5 rounded transition-colors"
                    onClick={() =>
                      navigator.clipboard.writeText(
                        connectionDetails.pubKey || formData.pubKeyAndAddress
                      )
                    }
                    type="button"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <div className="absolute bottom-full mb-1.5 right-0 bg-surface-high text-content-primary text-[10px] rounded-md py-0.5 px-1.5 opacity-0 group-hover/copy:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-border-default/40 shadow-lg z-20">
                    {t('createChannel.step3.copyPubkey')}
                  </div>
                </div>
              </div>
              {connectionDetails.host && connectionDetails.port && (
                <span className="text-xs text-content-secondary font-mono">
                  {connectionDetails.host}:{connectionDetails.port}
                </span>
              )}
            </div>
          ) : (
            <span className="text-red-500 text-sm">
              {t('createChannel.step3.errorInvalidNode')}
            </span>
          )}
        </div>

        {/* Fee */}
        <div className="flex items-center justify-between py-4">
          <span className="text-sm text-content-secondary">
            {t('createChannel.step3.transactionFeeRate')}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-white capitalize">{formData.fee}</span>
            <span className="text-content-secondary text-sm">
              · {feeRates[formData.fee]} sat/vB
            </span>
          </div>
        </div>

        {/* Privacy */}
        <div className="flex items-center justify-between py-4 last:pb-0">
          <span className="text-sm text-content-secondary">
            {t('createChannel.step3.channelPrivacy')}
          </span>
          <span className="text-white capitalize">
            {formData.public
              ? t('createChannel.step3.public')
              : t('createChannel.step3.private')}
          </span>
        </div>
      </Card>

      <div className="flex justify-between mt-8">
        <button
          className="px-3 py-2 text-content-secondary hover:text-white transition-colors flex items-center gap-1.5 hover:bg-surface-overlay/50 rounded-lg text-sm"
          onClick={onBack}
          type="button"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t('createChannel.step3.back')}
        </button>

        <Button
          disabled={!hasValidNodeInfo || isSubmitting}
          icon={<ArrowRight className="w-5 h-5" />}
          iconPosition="right"
          isLoading={isSubmitting}
          onClick={handleOpenChannel}
          size="lg"
          variant="primary"
        >
          {isSubmitting
            ? t('createChannel.step3.opening')
            : t('createChannel.step3.openChannel')}
        </Button>
      </div>
    </div>
  )
}
