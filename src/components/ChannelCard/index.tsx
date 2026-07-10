import {
  ArrowUpRight,
  ArrowDownRight,
  X,
  Globe,
  Lock,
  Info,
  Copy,
  CheckCheck,
  ZapOff,
} from 'lucide-react'
import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { useCopyToClipboard } from '../../hooks/useCopyToClipboard'
import { useSettings } from '../../hooks/useSettings'
import {
  getModalPortalTarget,
  getModalPositionClass,
} from '../../helpers/modalPortal'
import defaultRgbIcon from '../../assets/rgb-logo.svg'
import { formatBitcoinAmount } from '../../helpers/number'
import { useAssetIcon } from '../../helpers/utils'
import { CloseChannelModal } from '../CloseChannelModal'

interface InfoModalProps {
  isOpen: boolean
  onClose: () => void
  channel: any
  asset: any
  bitcoinUnit: string
}

const truncateMiddle = (str: string, start = 10, end = 10): string => {
  if (str.length <= start + end + 3) return str
  return `${str.slice(0, start)}…${str.slice(-end)}`
}

const CopyableValue: React.FC<{ value: string }> = ({ value }) => {
  const { copied, copy } = useCopyToClipboard()

  return (
    <div className="relative mt-1">
      <div className="bg-surface-base/50 px-3 py-2 pr-9 rounded-lg border border-border-default/30 font-mono text-xs text-white/90 break-all leading-relaxed">
        {truncateMiddle(value)}
      </div>
      <button
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-tertiary hover:text-white transition-colors"
        onClick={() => copy(value)}
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

export const InfoModal: React.FC<InfoModalProps> = ({
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
    { separator: 'LSP' },
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

  const pos = getModalPositionClass()

  return createPortal(
    <div
      className={`${pos} inset-0 bg-surface-base/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 pointer-events-auto`}
      onMouseDown={handleBackdropClick}
    >
      <div className="w-full max-w-lg bg-surface-base rounded-3xl border border-border-subtle/50 shadow-2xl shadow-black/20 overflow-hidden">
        <div className="max-h-[90vh] overflow-y-scroll px-8 py-8">
          {/* Header */}
          <div className="flex items-center gap-3 pb-4 border-b border-divider/10 mb-6">
            <Info className="w-6 h-6 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-white">
                {t('channelCard.infoModal.title')}
              </h3>
            </div>
            <button
              className="text-content-secondary hover:text-white p-1.5 rounded-lg hover:bg-surface-high/60 transition-colors flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                onClose()
              }}
              type="button"
            >
              <X size={18} />
            </button>
          </div>

          {/* Info rows */}
          <div className="space-y-0">
            {infoRows.map((row, index) => {
              if ('separator' in row) {
                return (
                  <div
                    className="flex items-center gap-2 pt-5 pb-2"
                    key={`sep-${index}`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest text-content-tertiary/70">
                      {row.separator}
                    </span>
                    <div className="flex-1 h-px bg-divider/20" />
                  </div>
                )
              }

              if (row.copyable) {
                return (
                  <div
                    className="py-2.5 border-b border-divider/10 last:border-0"
                    key={index}
                  >
                    <span className="text-xs text-content-secondary">
                      {row.label}
                    </span>
                    <CopyableValue value={row.value} />
                  </div>
                )
              }

              return (
                <div
                  className="flex items-start justify-between gap-4 py-2.5 border-b border-divider/10 last:border-0"
                  key={index}
                >
                  <span className="text-xs text-content-secondary flex-shrink-0 w-28 mt-0.5">
                    {row.label}
                  </span>
                  <span className="text-xs font-medium text-white/90 text-right">
                    {row.value}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Actions */}
          <div className="flex justify-end pt-6">
            <button
              className="flex items-center gap-1.5 px-4 py-2.5 text-content-secondary hover:text-content-primary transition-colors text-sm font-medium"
              onClick={(e) => {
                e.stopPropagation()
                onClose()
              }}
              type="button"
            >
              <X className="w-4 h-4" />
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    getModalPortalTarget()
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
    <div className="group group/ch bg-surface-base/35 hover:bg-surface-base/50 text-white rounded-xl border border-border-default/50 hover:border-border-default transition-colors duration-200 relative overflow-hidden flex flex-col">
      {/* Status bar */}
      <div
        className={`absolute top-0 left-0 w-full h-[2px] ${
          !isReady
            ? 'bg-gradient-to-r from-transparent via-amber-400/60 to-transparent'
            : isUsable
              ? 'bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent'
              : 'bg-gradient-to-r from-transparent via-red-500/50 to-transparent'
        }`}
      />

      {/* Card header */}
      <div className="flex items-start justify-between px-4 pt-5 pb-3 gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                isReady
                  ? isUsable
                    ? 'bg-emerald-400'
                    : 'bg-red-400'
                  : 'bg-amber-400 animate-pulse'
              }`}
            />
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
                <Globe className="h-2.5 w-2.5" />
              ) : (
                <Lock className="h-2.5 w-2.5" />
              )}
              <span>{isPublic ? 'Public' : 'Private'}</span>
            </span>

            {/* RGB badge */}
            {isRgbChannel && asset && (
              <span
                className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                  asset.ticker === 'USDT'
                    ? 'bg-[#26A17B]/10 text-[#26A17B] border border-[#26A17B]/30'
                    : 'bg-purple-900/30 text-purple-300 border border-purple-800/30'
                }`}
              >
                <AssetIcon className="h-2.5 w-2.5" ticker={asset.ticker} />
                {asset.ticker}
              </span>
            )}
          </div>
        </div>

        {/* Capacity */}
        <div className="text-right flex-shrink-0">
          <div className="text-[10px] text-content-tertiary mb-0.5">
            {`Capacity (${bitcoinUnit === 'SAT' ? 'SATS' : bitcoinUnit})`}
          </div>
          <div className="font-mono text-sm font-semibold text-white/90">
            {formatBitcoinAmount(channel.capacity_sat, bitcoinUnit)}
          </div>
        </div>
      </div>

      {/* Liquidity sections */}
      <div className="px-4 pb-3 flex flex-col gap-2 flex-1">
        {/* Bitcoin liquidity */}
        {(() => {
          const out = channel.outbound_balance_msat / 1000
          const inb = channel.inbound_balance_msat / 1000
          const total = out + inb
          const outPct = total > 0 ? (out / total) * 100 : 50
          const inPct = total > 0 ? (inb / total) * 100 : 50
          return (
            <div className="rounded-lg bg-surface-overlay/40 p-2.5">
              {/* Section header: asset + amounts */}
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 text-[11px] text-amber-400/90">
                  <AssetIcon className="h-3.5 w-3.5" ticker="BTC" />
                  <span className="font-semibold">BTC</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono">
                  <span className="flex items-center gap-0.5 text-[#9365FF]">
                    <ArrowUpRight className="h-3 w-3" />
                    {formatBitcoinAmount(out, bitcoinUnit)}
                  </span>
                  <span className="text-content-tertiary/40">/</span>
                  <span className="flex items-center gap-0.5 text-emerald-400">
                    <ArrowDownRight className="h-3 w-3" />
                    {formatBitcoinAmount(inb, bitcoinUnit)}
                  </span>
                </div>
              </div>
              <div className="relative h-2.5 bg-surface-overlay rounded-full overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full bg-[#9365FF] rounded-l-full"
                  style={{ width: `${outPct}%` }}
                />
                <div
                  className="absolute right-0 top-0 h-full bg-emerald-500 rounded-r-full"
                  style={{ width: `${inPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[8px] font-semibold uppercase tracking-wider mt-1">
                <span className="text-[#9365FF]/70">
                  {t('channelCard.labels.outbound')}
                </span>
                <span className="text-emerald-400/70">
                  {t('channelCard.labels.inbound')}
                </span>
              </div>
            </div>
          )
        })()}

        {/* RGB Asset liquidity */}
        {isRgbChannel &&
          asset &&
          (() => {
            const out = channel.asset_local_amount
            const inb = channel.asset_remote_amount
            const total = out + inb
            const outPct = total > 0 ? (out / total) * 100 : 50
            const inPct = total > 0 ? (inb / total) * 100 : 50
            return (
              <div className="rounded-lg bg-surface-overlay/40 p-2.5 border border-purple-800/20">
                {/* Section header: outbound | logo+ticker | inbound */}
                <div className="grid grid-cols-3 items-center mb-1.5">
                  <span className="flex items-center gap-0.5 text-[10px] font-mono text-[#9365FF]">
                    <ArrowUpRight className="h-3 w-3" />
                    {formatAssetAmount(out)}
                  </span>
                  <span
                    className="flex items-center justify-center gap-1 text-[11px] font-semibold"
                    style={asset.ticker === 'USDT' ? { color: '#26A17B' } : {}}
                  >
                    <AssetIcon className="h-3.5 w-3.5" ticker={asset.ticker} />
                    <span
                      className={
                        asset.ticker === 'USDT' ? '' : 'text-content-secondary'
                      }
                    >
                      {asset.ticker}
                    </span>
                  </span>
                  <span className="flex items-center justify-end gap-0.5 text-[10px] font-mono text-emerald-400">
                    {formatAssetAmount(inb)}
                    <ArrowDownRight className="h-3 w-3" />
                  </span>
                </div>
                <div className="relative h-2.5 bg-surface-overlay rounded-full overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full bg-[#9365FF] rounded-l-full"
                    style={{ width: `${outPct}%` }}
                  />
                  <div
                    className="absolute right-0 top-0 h-full bg-emerald-500 rounded-r-full"
                    style={{ width: `${inPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[8px] font-semibold uppercase tracking-wider mt-1">
                  <span className="text-[#9365FF]/70">
                    {t('channelCard.labels.outbound')}
                  </span>
                  <span className="text-emerald-400/70">
                    {t('channelCard.labels.inbound')}
                  </span>
                </div>
              </div>
            )
          })()}
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-t border-border-default/30">
        <button
          className="flex-1 min-w-0 py-1.5 rounded-lg bg-transparent hover:bg-surface-high/50 transition-colors text-xs text-white border border-white/30 hover:border-white/50 flex items-center justify-center gap-1.5"
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
          className="close-channel-btn flex-shrink-0 py-1.5 px-2.5 rounded-lg bg-red-900/20 hover:bg-red-900/35 transition-colors text-xs text-red-300/80 hover:text-red-300 border border-red-900/20 hover:border-red-800/40 flex items-center justify-center gap-1"
          onClick={(e) => {
            e.stopPropagation()
            setIsCloseModalOpen(true)
          }}
          type="button"
        >
          <ZapOff className="zap-icon h-3.5 w-3.5 flex-shrink-0" />
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
