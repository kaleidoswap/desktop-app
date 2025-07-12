import {
  Zap,
  ChevronLeft,
  ArrowRight,
  ExternalLink,
  Wallet,
  Activity,
  TagIcon,
  Users,
  Eye,
  EyeOff,
} from 'lucide-react'
import { useMemo, useState, useEffect } from 'react'

import BitcoinLogo from '../../assets/bitcoin-logo.svg'
import {
  Button,
  Card,
  InfoCard,
  InfoCardGrid,
  Badge,
} from '../../components/ui'
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [assetPrecision, setAssetPrecision] = useState<number>(8) // Default to 8 decimals

  const [takerAssets] = nodeApi.endpoints.listAssets.useLazyQuery()

  // Fetch asset precision when we have an assetId
  useEffect(() => {
    if (formData.assetId) {
      takerAssets()
        .unwrap()
        .then((response) => {
          const asset = response.nia.find(
            (a) => a.asset_id === formData.assetId
          )
          if (asset) {
            setAssetPrecision(asset.precision)
          }
        })
        .catch((error) => {
          console.error('Error fetching asset information:', error)
          // Keep default precision of 8 if fetch fails
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
      <div className="text-center mb-6">
        <h3 className="text-3xl font-bold text-white mb-2">
          Open a Channel - Review
        </h3>
        <p className="text-gray-400">
          Confirm your channel details before proceeding
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-center">
          {error}
        </div>
      )}

      <Card className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Zap className="w-5 h-5 text-blue-500" />
          </div>
          <h3 className="text-xl font-bold text-white">Channel Details</h3>
          <Badge
            className="ml-auto"
            icon={
              isAssetChannel ? (
                <TagIcon className="w-3 h-3" />
              ) : (
                <img alt="Bitcoin" className="w-3.5 h-3.5" src={BitcoinLogo} />
              )
            }
            variant={isAssetChannel ? 'info' : 'primary'}
          >
            {isAssetChannel ? 'RGB Asset' : 'Bitcoin'}
          </Badge>
        </div>

        <InfoCardGrid className="mb-6" columns={1}>
          <InfoCard
            icon={<Wallet className="w-4 h-4 text-blue-500" />}
            label="Channel Capacity"
            value={
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <img alt="Bitcoin" className="w-4 h-4" src={BitcoinLogo} />
                  <span className="text-blue-400 font-bold">
                    {formatNumber(formData.capacitySat)} SAT
                  </span>
                </div>
                {isAssetChannel && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-cyan text-sm font-medium">
                      {formatAssetAmount} {formData.assetTicker}
                    </span>
                  </div>
                )}
              </div>
            }
          />
        </InfoCardGrid>

        <InfoCardGrid className="mb-6" columns={1}>
          <InfoCard
            icon={<Users className="w-4 h-4 text-blue-500" />}
            label="Connected Node"
            value={
              hasValidNodeInfo ? (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center">
                    <span className="text-xs text-slate-400 mr-2">
                      Node ID:
                    </span>
                    <span className="text-sm text-white font-mono truncate">
                      {formatPubKey(
                        connectionDetails.pubKey || formData.pubKeyAndAddress
                      )}
                    </span>
                    <button
                      className="ml-2 text-blue-400 hover:text-blue-300 p-1 hover:bg-slate-700/50 rounded transition-colors"
                      onClick={() =>
                        navigator.clipboard.writeText(
                          connectionDetails.pubKey || formData.pubKeyAndAddress
                        )
                      }
                      title="Copy full pubkey"
                      type="button"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {connectionDetails.host && connectionDetails.port ? (
                    <div className="flex items-center">
                      <span className="text-xs text-slate-400 mr-2">Host:</span>
                      <span className="text-sm text-white font-mono">
                        {connectionDetails.host}:{connectionDetails.port}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <span className="text-xs text-slate-400 mr-2">
                        Status:
                      </span>
                      <span className="text-sm text-green-400">
                        Already Connected
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-red-500 text-sm">
                  Please go back and enter valid node information
                </span>
              )
            }
          />
        </InfoCardGrid>

        <InfoCardGrid columns={1}>
          <InfoCard
            icon={<Activity className="w-4 h-4 text-blue-500" />}
            label="Transaction Fee Rate"
            value={
              <div className="flex items-center justify-between">
                <span className="text-white capitalize">{formData.fee}</span>
                <span className="text-slate-400 text-sm ml-2">
                  {feeRates[formData.fee]} sat/vB
                </span>
              </div>
            }
          />
        </InfoCardGrid>

        <InfoCardGrid columns={1}>
          <InfoCard
            icon={
              formData.public ? (
                <Eye className="w-4 h-4 text-blue-500" />
              ) : (
                <EyeOff className="w-4 h-4 text-blue-500" />
              )
            }
            label="Channel Privacy"
            value={
              <div className="flex items-center justify-between">
                <span className="text-white capitalize">
                  {formData.public ? 'Public' : 'Private'}
                </span>
                <span className="text-slate-400 text-sm ml-2">
                  {formData.public
                    ? 'Visible on Lightning Network'
                    : 'Only known to parties'}
                </span>
              </div>
            }
          />
        </InfoCardGrid>
      </Card>

      {isAssetChannel && (
        <Card className="mb-6">
          <div className="flex items-start gap-2">
            <div className="p-2 bg-cyan/10 rounded-lg shrink-0">
              <TagIcon className="w-4 h-4 text-cyan" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-white mb-1">
                RGB Asset Channel
              </h4>
              <p className="text-xs text-slate-400">
                This channel will include both Bitcoin liquidity and RGB asset
                allocation. The RGB asset ({formData.assetTicker}) will be
                allocated with {formatAssetAmount} units.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="flex justify-between mt-8">
        <Button
          icon={<ChevronLeft className="w-5 h-5" />}
          onClick={onBack}
          size="lg"
          variant="secondary"
        >
          Back
        </Button>

        <Button
          disabled={!hasValidNodeInfo || isSubmitting}
          icon={<ArrowRight className="w-5 h-5" />}
          iconPosition="right"
          isLoading={isSubmitting}
          onClick={handleOpenChannel}
          size="lg"
          variant="primary"
        >
          {isSubmitting ? 'Opening...' : 'Open Channel'}
        </Button>
      </div>
    </div>
  )
}
