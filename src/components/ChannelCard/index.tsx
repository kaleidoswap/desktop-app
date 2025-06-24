import {
  ArrowUpRight,
  ArrowDownRight,
  X,
  Lock,
  Unlock,
  Info,
} from 'lucide-react'
import React, { useState } from 'react'

import { useAppSelector } from '../../app/store/hooks'
import defaultRgbIcon from '../../assets/rgb-symbol-color.svg'
import { formatBitcoinAmount } from '../../helpers/number'
import { useAssetIcon } from '../../helpers/utils'
import { CloseChannelModal } from '../CloseChannelModal'
import { LiquidityBar } from '../LiquidityBar'

interface InfoModalProps {
  isOpen: boolean
  onClose: () => void
  channel: any
  asset: any
  bitcoinUnit: string
}

const InfoModal: React.FC<InfoModalProps> = ({
  isOpen,
  onClose,
  channel,
  asset,
  bitcoinUnit,
}) => {
  if (!isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const infoRows = [
    { label: 'Channel ID', value: channel.channel_id },
    { label: 'Funding Transaction', value: channel.funding_txid },
    { label: 'Peer Public Key', value: channel.peer_pubkey },
    {
      label: 'Short Channel ID',
      value: channel.short_channel_id?.toString() || 'N/A',
    },
    { label: 'Status', value: channel.status },
    {
      label: 'Capacity',
      value: `${formatBitcoinAmount(channel.capacity_sat, bitcoinUnit)} ${bitcoinUnit}`,
    },
    {
      label: 'Local Balance',
      value: `${formatBitcoinAmount(channel.local_balance_sat, bitcoinUnit)} ${bitcoinUnit}`,
    },
    {
      label: 'Next HTLC Limit',
      value: `${formatBitcoinAmount(channel.next_outbound_htlc_limit_msat / 1000, bitcoinUnit)} ${bitcoinUnit}`,
    },
    {
      label: 'Next HTLC Minimum',
      value: `${formatBitcoinAmount(channel.next_outbound_htlc_minimum_msat / 1000, bitcoinUnit)} ${bitcoinUnit}`,
    },
    { label: 'Public Channel', value: channel.public ? 'Yes' : 'No' },
    { label: 'Usable', value: channel.is_usable ? 'Yes' : 'No' },
  ]

  if (channel.asset_id) {
    const assetPrecision = asset?.precision ?? 8
    const formatAssetAmount = (amount: number) => {
      const factor = Math.pow(10, assetPrecision)
      return (amount / factor).toLocaleString(undefined, {
        maximumFractionDigits: assetPrecision,
        minimumFractionDigits: assetPrecision > 0 ? 1 : 0,
      })
    }

    infoRows.push(
      { label: 'Asset ID', value: channel.asset_id },
      {
        label: 'Asset Local Amount',
        value: `${formatAssetAmount(channel.asset_local_amount)} ${asset?.ticker}`,
      },
      {
        label: 'Asset Remote Amount',
        value: `${formatAssetAmount(channel.asset_remote_amount)} ${asset?.ticker}`,
      }
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-xl border border-gray-700/50">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold">Channel Information</h3>
          <button
            className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-700/50"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            type="button"
          >
            <X size={20} />
          </button>
        </div>
        <div className="grid gap-4">
          {infoRows.map((row, index) => (
            <div
              className="border-b border-gray-700 pb-3 last:border-0"
              key={index}
            >
              <div className="text-sm text-gray-400">{row.label}</div>
              <div className="font-medium break-all">{row.value}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <button
            className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 active:bg-gray-500 transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            type="button"
          >
            Close
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
  className = 'h-6 w-6 mr-2',
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
  const bitcoinUnit = useAppSelector((state) => state.settings.bitcoinUnit)

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

  return (
    <div className="bg-slate-900/70 hover:bg-slate-800/80 text-white rounded-lg shadow-md p-4 border border-slate-700/30 transition-all duration-200 relative">
      {/* Status indicator */}
      <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-slate-600/40 to-transparent"></div>

      {/* Usability dot indicator */}
      <div className="absolute top-2 right-2 flex items-center">
        <div
          className={`w-2 h-2 rounded-full ${channel.is_usable ? 'bg-emerald-400' : 'bg-red-400'}`}
        />
      </div>

      {/* Unusable overlay */}
      {!channel.is_usable && (
        <div className="absolute inset-0 bg-red-900/10 rounded-lg pointer-events-none" />
      )}

      {/* Channel header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center">
          <span className="font-medium text-base truncate max-w-[120px] text-white">
            {channel.peer_alias || channel.peer_pubkey.slice(0, 8)}
          </span>
          <button
            className="ml-1 p-1 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-full transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              setIsInfoModalOpen(true)
            }}
            title="Channel Information"
            type="button"
          >
            <Info size={14} />
          </button>
        </div>
        <div className="flex items-center space-x-2">
          <span
            className={`text-xs px-1.5 py-0.5 rounded-md ${
              isReady
                ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-800/20'
                : 'bg-amber-900/30 text-amber-300 border border-amber-800/20'
            }`}
          >
            {isReady ? 'Open' : 'Pending'}
          </span>
          {isPublic ? (
            <Unlock className="text-slate-400" size={12} />
          ) : (
            <Lock className="text-slate-400" size={12} />
          )}
        </div>
      </div>

      {/* Capacity section */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-700/30">
        <div className="text-xs text-slate-400">Capacity</div>
        <div className="font-medium flex items-center text-sm">
          {formatBitcoinAmount(channel.capacity_sat, bitcoinUnit)}{' '}
          <span className="text-xs text-slate-400 ml-1">{bitcoinUnit}</span>
          {asset && (
            <div className="ml-2 flex items-center bg-slate-800/60 rounded-full px-1.5 py-0.5 text-xs">
              <AssetIcon className="h-3 w-3 mr-1" ticker={asset.ticker} />
              <span className="text-slate-300">{asset.ticker}</span>
            </div>
          )}
        </div>
      </div>

      {/* Bitcoin liquidity section */}
      <div className="mb-3 rounded-md bg-slate-800/50 p-3 hover:bg-slate-800/60 transition-all duration-200">
        <div className="flex justify-between items-center mb-2">
          <div className="text-xs text-slate-300 flex items-center">
            <AssetIcon className="h-3 w-3 mr-1 text-amber-400" ticker="BTC" />
            <span className="font-medium">Bitcoin Liquidity</span>
          </div>
          <div className="flex text-xs space-x-3 text-slate-300">
            <div className="flex items-center bg-slate-900/70 px-1.5 py-0.5 rounded">
              <ArrowUpRight className="mr-1 text-amber-400" size={10} />
              <span className="font-medium">
                {formatBitcoinAmount(
                  channel.outbound_balance_msat / 1000,
                  bitcoinUnit
                )}
              </span>
            </div>
            <div className="flex items-center bg-slate-900/70 px-1.5 py-0.5 rounded">
              <ArrowDownRight className="mr-1 text-blue-400" size={10} />
              <span className="font-medium">
                {formatBitcoinAmount(
                  channel.inbound_balance_msat / 1000,
                  bitcoinUnit
                )}
              </span>
            </div>
          </div>
        </div>
        <LiquidityBar
          localAmount={channel.outbound_balance_msat / 1000}
          remoteAmount={channel.inbound_balance_msat / 1000}
          type="bitcoin"
        />
      </div>

      {/* RGB Asset liquidity section - only show if it's an RGB channel */}
      {isRgbChannel && asset && (
        <div className="mb-3 rounded-md bg-slate-800/50 p-3 hover:bg-slate-800/60 transition-all duration-200">
          <div className="flex justify-between items-center mb-2">
            <div className="text-xs text-slate-300 flex items-center">
              <AssetIcon className="h-3 w-3 mr-1" ticker={asset.ticker} />
              <span className="font-medium">{asset.ticker} Liquidity</span>
            </div>
            <div className="flex text-xs space-x-3 text-slate-300">
              <div className="flex items-center bg-slate-900/70 px-1.5 py-0.5 rounded">
                <ArrowUpRight className="mr-1 text-indigo-400" size={10} />
                <span className="font-medium">
                  {formatAssetAmount(channel.asset_local_amount)}
                </span>
              </div>
              <div className="flex items-center bg-slate-900/70 px-1.5 py-0.5 rounded">
                <ArrowDownRight className="mr-1 text-fuchsia-400" size={10} />
                <span className="font-medium">
                  {formatAssetAmount(channel.asset_remote_amount)}
                </span>
              </div>
            </div>
          </div>
          <LiquidityBar
            localAmount={channel.asset_local_amount}
            remoteAmount={channel.asset_remote_amount}
            type="asset"
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex space-x-2 mt-3">
        <button
          className="flex-1 py-1.5 px-3 bg-slate-800/70 hover:bg-slate-700/80 transition-colors rounded-md text-xs text-slate-300 border border-slate-700/30"
          onClick={(e) => {
            e.stopPropagation()
            setIsInfoModalOpen(true)
          }}
          type="button"
        >
          <div className="flex items-center justify-center">
            <Info className="w-3 h-3 mr-1" />
            Details
          </div>
        </button>
        <button
          className="flex-1 py-1.5 px-3 bg-red-900/20 hover:bg-red-900/30 transition-colors rounded-md text-xs text-red-300 border border-red-900/20"
          onClick={(e) => {
            e.stopPropagation()
            setIsCloseModalOpen(true)
          }}
          type="button"
        >
          <div className="flex items-center justify-center">
            <X className="w-3 h-3 mr-1" />
            Close
          </div>
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
