import {
  ArrowUpRight,
  ArrowDownRight,
  X,
  Lock,
  Unlock,
  Info,
  Copy,
  CheckCheck,
} from 'lucide-react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'
import { useSettings } from '../../hooks/useSettings'
import defaultRgbIcon from '../../assets/rgb-symbol-color.svg'
import { formatBitcoinAmount } from '../../helpers/number'
import { useAssetIcon } from '../../helpers/utils'
import { CloseChannelModal } from '../CloseChannelModal'
import { LiquidityBar } from '../Liquidity'

interface InfoModalProps {
  isOpen: boolean
  onClose: () => void
  channel: any
  asset: any
  bitcoinUnit: string
}

const CopyableValue: React.FC<{ value: string }> = ({ value }) => {
  const { copied, copy } = useCopyToClipboard()

  const handleCopy = () => copy(value)

  return (
    <div className="flex items-start gap-2">
      <span className="font-mono text-white/90 break-all text-xs leading-relaxed flex-1">
        {value}
      </span>
      <button
        className="flex-shrink-0 text-content-tertiary hover:text-white transition-colors mt-0.5"
        onClick={handleCopy}
        title={copied ? 'Copied!' : 'Copy'}
        type="button"
      >
        {copied ? (
          <CheckCheck className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  )
}

const InfoModal: React.FC<InfoModalProps> = ({
  isOpen,
  onClose,
  channel,
  asset,
  bitcoinUnit,
}) => {
  const { t } = useTranslation()

  if (!isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const assetPrecision = asset?.precision ?? 8
  const formatAssetAmount = (amount: number) => {
    const factor = Math.pow(10, assetPrecision)
    return (amount / factor).toLocaleString(undefined, {
      maximumFractionDigits: assetPrecision,
      minimumFractionDigits: assetPrecision > 0 ? 1 : 0,
    })
  }

  // Group info rows into sections
  type InfoRow =
    | { label: string; value: string; mono?: boolean; copyable?: boolean }
    | { separator: string }

  const infoRows: InfoRow[] = [
    { label: 'Status', mono: false, value: channel.status },
    {
      label: 'Capacity',
      value: `${formatBitcoinAmount(channel.capacity_sat, bitcoinUnit)} ${bitcoinUnit}`,
    },
    {
      label: 'Local Balance',
      value: `${formatBitcoinAmount(channel.local_balance_sat, bitcoinUnit)} ${bitcoinUnit}`,
    },
    {
      label: 'Outbound Limit',
      value: `${formatBitcoinAmount(channel.next_outbound_htlc_limit_msat / 1000, bitcoinUnit)} ${bitcoinUnit}`,
    },
    {
      label: 'Min HTLC',
      value: `${formatBitcoinAmount(channel.next_outbound_htlc_minimum_msat / 1000, bitcoinUnit)} ${bitcoinUnit}`,
    },
    {
      label: 'Public',
      value: channel.public ? t('common.yes') : t('common.no'),
    },
    {
      label: 'Usable',
      value: channel.is_usable ? t('common.yes') : t('common.no'),
    },
    { separator: 'Identifiers' },
    {
      copyable: true,
      label: 'Channel ID',
      mono: true,
      value: channel.channel_id,
    },
    {
      copyable: true,
      label: 'Funding TX',
      mono: true,
      value: channel.funding_txid,
    },
    {
      label: 'Short Channel ID',
      value:
        channel.short_channel_id?.toString() || t('channelCard.infoModal.na'),
    },
    {
      copyable: true,
      label: 'Peer Pubkey',
      mono: true,
      value: channel.peer_pubkey,
    },
  ]

  if (channel.asset_id) {
    infoRows.push(
      { separator: 'RGB Asset' },
      {
        copyable: true,
        label: 'Asset ID',
        mono: true,
        value: channel.asset_id,
      },
      {
        label: 'Asset Local',
        value: `${formatAssetAmount(channel.asset_local_amount)} ${asset?.ticker ?? ''}`,
      },
      {
        label: 'Asset Remote',
        value: `${formatAssetAmount(channel.asset_remote_amount)} ${asset?.ticker ?? ''}`,
      }
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-surface-overlay rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-border-default/40 overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-border-default/30">
          <div>
            <h3 className="text-base font-semibold text-white">
              {t('channelCard.infoModal.title')}
            </h3>
            <p className="text-xs text-content-tertiary mt-0.5 font-mono">
              {channel.peer_alias || channel.peer_pubkey.slice(0, 16) + '…'}
            </p>
          </div>
          <button
            className="text-content-secondary hover:text-white p-1.5 rounded-lg hover:bg-surface-high/60 transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-1">
          {infoRows.map((row, index) => {
            if ('separator' in row) {
              return (
                <div
                  className="flex items-center gap-2 pt-4 pb-2 first:pt-0"
                  key={`sep-${index}`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-content-tertiary/70">
                    {row.separator}
                  </span>
                  <div className="flex-1 h-px bg-border-default/30" />
                </div>
              )
            }

            return (
              <div
                className="flex items-start justify-between gap-4 py-2.5 border-b border-border-default/20 last:border-0"
                key={index}
              >
                <span className="text-xs text-content-secondary flex-shrink-0 w-28 mt-0.5">
                  {row.label}
                </span>
                <div className="text-right min-w-0 flex-1">
                  {row.copyable ? (
                    <CopyableValue value={row.value} />
                  ) : (
                    <span
                      className={`text-xs font-medium text-white/90 ${row.mono ? 'font-mono' : ''}`}
                    >
                      {row.value}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border-default/30">
          <button
            className="w-full py-2 rounded-lg bg-surface-high hover:bg-surface-elevated text-sm text-white transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            type="button"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}

interface ChannelCardProps {
  channel: any
  onClose?: () => void
  asset: any
}

const AssetIcon: React.FC<{ ticker: string; className?: string }> = ({
  ticker,
  className = 'h-5 w-5',
}) => {
  const [imgSrc, setImgSrc] = useAssetIcon(ticker, defaultRgbIcon)

  return (
    <img
      alt={`${ticker} icon`}
      className={className}
      onError={() => setImgSrc(defaultRgbIcon)}
      src={imgSrc}
    />
  )
}

export const ChannelCard: React.FC<ChannelCardProps> = ({
  channel,
  onClose,
  asset,
}) => {
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false)
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false)
  const { bitcoinUnit } = useSettings()
  const { t } = useTranslation()

  const assetPrecision = asset?.precision ?? 8

  const formatAssetAmount = (amount: number) => {
    const factor = Math.pow(10, assetPrecision)
    return (amount / factor).toLocaleString(undefined, {
      maximumFractionDigits: assetPrecision,
      minimumFractionDigits: 0,
    })
  }

  const isRgbChannel = !!channel.asset_id
  const isReady = channel.ready
  const isPublic = channel.public
  const isUsable = channel.is_usable

  return (
    <div className="group bg-surface-base/80 hover:bg-surface-overlay/70 text-white rounded-xl shadow-md border border-border-default/30 hover:border-border-default/50 transition-all duration-200 relative overflow-hidden flex flex-col">
      {/* Status bar */}
      <div
        className={`absolute top-0 left-0 w-full h-[2px] ${
          isUsable
            ? 'bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent'
            : 'bg-gradient-to-r from-transparent via-red-500/50 to-transparent'
        }`}
      />

      {/* Card header */}
      <div className="flex items-start justify-between px-4 pt-5 pb-3 gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {/* Peer name */}
            <span className="font-semibold text-sm text-white truncate max-w-[150px]">
              {channel.peer_alias || channel.peer_pubkey.slice(0, 10) + '…'}
            </span>
          </div>
          {/* Badges row */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {/* Status badge */}
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                isReady
                  ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-800/30'
                  : 'bg-amber-900/30 text-amber-300 border border-amber-800/30'
              }`}
            >
              {isReady
                ? t('channelCard.status.open')
                : t('channelCard.status.pending')}
            </span>

            {/* Usable badge - only show "Offline" for confirmed channels whose peer went offline */}
            {isReady && !isUsable && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-900/30 text-red-300 border border-red-800/30">
                {t('channelCard.status.offline')}
              </span>
            )}

            {/* Public/Private */}
            <span className="flex items-center gap-0.5 text-[10px] text-content-tertiary">
              {isPublic ? (
                <Unlock className="h-2.5 w-2.5" />
              ) : (
                <Lock className="h-2.5 w-2.5" />
              )}
              <span>{isPublic ? 'Public' : 'Private'}</span>
            </span>

            {/* RGB badge */}
            {isRgbChannel && asset && (
              <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-purple-900/30 text-purple-300 border border-purple-800/30">
                <AssetIcon className="h-2.5 w-2.5" ticker={asset.ticker} />
                {asset.ticker}
              </span>
            )}
          </div>
        </div>

        {/* Capacity */}
        <div className="text-right flex-shrink-0">
          <div className="text-[10px] text-content-tertiary mb-0.5">
            {t('channelCard.labels.capacity')}
          </div>
          <div className="font-mono text-sm font-semibold text-white/90">
            {formatBitcoinAmount(channel.capacity_sat, bitcoinUnit)}
          </div>
          <div className="text-[10px] text-content-tertiary">{bitcoinUnit}</div>
        </div>
      </div>

      {/* Liquidity sections */}
      <div className="px-4 pb-3 flex flex-col gap-2 flex-1">
        {/* Bitcoin liquidity */}
        <div className="rounded-lg bg-surface-overlay/40 p-2.5">
          <div className="flex justify-between items-center mb-1.5">
            <div className="flex items-center gap-1 text-[10px] text-amber-400/90">
              <AssetIcon className="h-3 w-3" ticker="BTC" />
              <span className="font-medium">BTC</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="flex items-center gap-0.5 text-amber-300/80">
                <ArrowUpRight className="h-3 w-3" />
                <span className="font-mono">
                  {formatBitcoinAmount(
                    channel.outbound_balance_msat / 1000,
                    bitcoinUnit
                  )}
                </span>
              </span>
              <span className="text-content-tertiary/40">/</span>
              <span className="flex items-center gap-0.5 text-blue-300/80">
                <ArrowDownRight className="h-3 w-3" />
                <span className="font-mono">
                  {formatBitcoinAmount(
                    channel.inbound_balance_msat / 1000,
                    bitcoinUnit
                  )}
                </span>
              </span>
            </div>
          </div>
          <LiquidityBar
            inbound={channel.inbound_balance_msat / 1000}
            inboundColor="bg-blue-500"
            inboundLabel={formatBitcoinAmount(
              channel.inbound_balance_msat / 1000,
              bitcoinUnit
            )}
            outbound={channel.outbound_balance_msat / 1000}
            outboundColor="bg-yellow-500"
            outboundLabel={formatBitcoinAmount(
              channel.outbound_balance_msat / 1000,
              bitcoinUnit
            )}
            showSummary={false}
            trackClassName="h-2.5 border-0 bg-surface-overlay p-0"
          />
          <div className="flex justify-between text-[9px] text-content-tertiary/0 group-hover:text-content-tertiary/50 transition-colors mt-1">
            <span>{t('channelCard.labels.outbound')}</span>
            <span>{t('channelCard.labels.inbound')}</span>
          </div>
        </div>

        {/* RGB Asset liquidity */}
        {isRgbChannel && asset && (
          <div className="rounded-lg bg-surface-overlay/40 p-2.5">
            <div className="flex justify-between items-center mb-1.5">
              <div className="flex items-center gap-1 text-[10px] text-lime-300/90">
                <AssetIcon className="h-3 w-3" ticker={asset.ticker} />
                <span className="font-medium">{asset.ticker}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="flex items-center gap-0.5 text-lime-300/80">
                  <ArrowUpRight className="h-3 w-3" />
                  <span className="font-mono">
                    {formatAssetAmount(channel.asset_local_amount)}
                  </span>
                </span>
                <span className="text-content-tertiary/40">/</span>
                <span className="flex items-center gap-0.5 text-emerald-400/80">
                  <ArrowDownRight className="h-3 w-3" />
                  <span className="font-mono">
                    {formatAssetAmount(channel.asset_remote_amount)}
                  </span>
                </span>
              </div>
            </div>
            <LiquidityBar
              inbound={channel.asset_remote_amount}
              inboundColor="bg-emerald-700"
              inboundLabel={formatAssetAmount(channel.asset_remote_amount)}
              outbound={channel.asset_local_amount}
              outboundColor="bg-lime-300"
              outboundLabel={formatAssetAmount(channel.asset_local_amount)}
              showSummary={false}
              trackClassName="h-2.5 border-0 bg-surface-overlay p-0"
            />
            <div className="flex justify-between text-[9px] text-content-tertiary/0 group-hover:text-content-tertiary/50 transition-colors mt-1">
              <span>{t('channelCard.labels.outbound')}</span>
              <span>{t('channelCard.labels.inbound')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-t border-border-default/20">
        <button
          className="flex-1 min-w-0 py-1.5 rounded-lg bg-surface-overlay/60 hover:bg-surface-high/70 transition-colors text-xs text-content-secondary hover:text-content-primary border border-border-default/20 hover:border-border-default/40 flex items-center justify-center gap-1"
          onClick={(e) => {
            e.stopPropagation()
            setIsInfoModalOpen(true)
          }}
          type="button"
        >
          <Info className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{t('channelCard.buttons.details')}</span>
        </button>
        <button
          className="flex-shrink-0 py-1.5 px-2.5 rounded-lg bg-red-900/20 hover:bg-red-900/35 transition-colors text-xs text-red-300/80 hover:text-red-300 border border-red-900/20 hover:border-red-800/40 flex items-center justify-center gap-1"
          onClick={(e) => {
            e.stopPropagation()
            setIsCloseModalOpen(true)
          }}
          type="button"
        >
          <X className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{t('channelCard.buttons.close')}</span>
        </button>
      </div>

      <InfoModal
        asset={asset}
        bitcoinUnit={bitcoinUnit}
        channel={channel}
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
      />

      <CloseChannelModal
        channelId={channel.channel_id}
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        onSuccess={onClose}
        peerPubkey={channel.peer_pubkey}
      />
    </div>
  )
}
