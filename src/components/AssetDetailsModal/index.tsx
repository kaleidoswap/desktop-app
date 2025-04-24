import { Info } from 'lucide-react'
import React from 'react'

import defaultRgbIcon from '../../assets/rgb-symbol-color.svg'
import { useAssetIcon } from '../../helpers/utils'
import { NiaAsset } from '../../slices/nodeApi/nodeApi.slice'
import { Modal } from '../ui'

interface AssetDetailsModalProps {
  asset: NiaAsset
  isOpen: boolean
  onClose: () => void
}

export const AssetDetailsModal: React.FC<AssetDetailsModalProps> = ({
  asset,
  isOpen,
  onClose,
}) => {
  const [imgSrc, setImgSrc] = useAssetIcon(asset.ticker, defaultRgbIcon)

  const formatAmount = (amount: number) => {
    const formattedAmount = amount / Math.pow(10, asset.precision)
    return formattedAmount.toLocaleString(undefined, {
      maximumFractionDigits: asset.precision,
    })
  }

  // Check if future and settled balances are different
  const isDifferentBalances =
    asset.balance && asset.balance.future !== asset.balance.settled

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" title="Asset Details">
      <div className="p-6">
        <div className="flex items-center mb-6">
          <img
            alt={`${asset.ticker} icon`}
            className="h-12 w-12 mr-4"
            onError={() => setImgSrc(defaultRgbIcon)}
            src={imgSrc}
          />
          <div>
            <h2 className="text-2xl font-bold text-white">{asset.ticker}</h2>
            <p className="text-gray-400">{asset.name}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-dark/50 p-4 rounded-lg">
            <p className="text-gray-400 text-sm mb-1">Asset ID</p>
            <p className="text-white text-sm break-all font-mono">
              {asset.asset_id}
            </p>
          </div>

          <div className="bg-blue-dark/50 p-4 rounded-lg">
            <p className="text-gray-400 text-sm mb-1">Interface</p>
            <p className="text-white">{asset.asset_iface}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-dark/50 p-4 rounded-lg">
            <p className="text-gray-400 text-sm mb-1">Precision</p>
            <p className="text-white">{asset.precision}</p>
          </div>

          <div className="bg-blue-dark/50 p-4 rounded-lg">
            <p className="text-gray-400 text-sm mb-1">Total Supply</p>
            <p className="text-white">{formatAmount(asset.issued_supply)}</p>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-white mb-4">Balances</h3>
        <div className="grid grid-cols-1 gap-4 mb-6">
          <div className="bg-blue-dark/50 p-4 rounded-lg">
            <h4 className="text-white font-medium mb-2">On-chain Balances</h4>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-gray-400 text-sm mb-1 flex items-center">
                  Future
                  {isDifferentBalances && (
                    <div className="relative group ml-2">
                      <Info className="w-4 h-4 text-yellow-500" />
                      <div className="absolute bottom-full mb-2 left-0 bg-slate-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none w-60">
                        Future balance includes transactions that are confirmed
                        but not yet spendable.
                      </div>
                    </div>
                  )}
                </p>
                <p
                  className={`${isDifferentBalances ? 'text-yellow-500' : 'text-white'}`}
                >
                  {formatAmount(asset.balance?.future || 0)}
                </p>
              </div>

              <div>
                <p className="text-gray-400 text-sm mb-1">Settled</p>
                <p className="text-white">
                  {formatAmount(asset.balance?.settled || 0)}
                </p>
              </div>

              <div>
                <p className="text-gray-400 text-sm mb-1">Spendable</p>
                <p className="text-white">
                  {formatAmount(asset.balance?.spendable || 0)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-dark/50 p-4 rounded-lg">
            <h4 className="text-white font-medium mb-2">Off-chain Balances</h4>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-gray-400 text-sm mb-1">Outbound</p>
                <p className="text-white">
                  {formatAmount(asset.balance?.offchain_outbound || 0)}
                </p>
              </div>

              <div>
                <p className="text-gray-400 text-sm mb-1">Inbound</p>
                <p className="text-white">
                  {formatAmount(asset.balance?.offchain_inbound || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-blue-dark/50 p-4 rounded-lg mb-6">
          <h4 className="text-white font-medium mb-2">Balance Explanations</h4>
          <ul className="text-sm text-gray-300 space-y-2">
            <li>
              <span className="text-cyan font-medium">Future:</span> Total
              balance including pending transactions
            </li>
            <li>
              <span className="text-cyan font-medium">Settled:</span> Balance
              from confirmed transactions
            </li>
            <li>
              <span className="text-cyan font-medium">Spendable:</span> Balance
              available for on-chain spending
            </li>
            <li>
              <span className="text-cyan font-medium">Outbound:</span> Balance
              available for sending via Lightning Network
            </li>
            <li>
              <span className="text-cyan font-medium">Inbound:</span> Capacity
              to receive via Lightning Network
            </li>
          </ul>
        </div>

        <div className="mt-6 bg-blue-dark/30 p-4 rounded-lg border border-blue-500/20">
          <div className="flex items-start">
            <Info className="w-5 h-5 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-gray-300">
                This asset was issued on{' '}
                {new Date(asset.timestamp * 1000).toLocaleDateString()}. and
                added to your wallet on{' '}
                {new Date(asset.added_at * 1000).toLocaleDateString()}.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
