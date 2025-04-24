import { Download, Upload, History } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { WALLET_HISTORY_ASSETS_PATH } from '../../app/router/paths'
import { useAppDispatch } from '../../app/store/hooks'
import defaultRgbIcon from '../../assets/rgb-symbol-color.svg'
import { useAssetIcon } from '../../helpers/utils'
import { NiaAsset } from '../../slices/nodeApi/nodeApi.slice'
import { uiSliceActions } from '../../slices/ui/ui.slice'
import { AssetDetailsModal } from '../AssetDetailsModal'
import { LoadingPlaceholder } from '../ui'

interface AssetRowProps {
  asset: NiaAsset
  onChainBalance: number
  offChainBalance: number
  isLoading?: boolean
}

interface AssetIconProps {
  ticker: string
  className?: string
}

const AssetIcon: React.FC<AssetIconProps> = ({
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

export const AssetRow: React.FC<AssetRowProps> = ({
  asset,
  onChainBalance,
  offChainBalance,
  isLoading,
}) => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [showDetailsModal, setShowDetailsModal] = useState(false)

  const formatAmount = (asset: NiaAsset, amount: number) => {
    const formattedAmount = amount / Math.pow(10, asset.precision)
    return formattedAmount.toLocaleString(undefined, {
      maximumFractionDigits: asset.precision,
    })
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-2 even:bg-blue-dark rounded items-center">
        <div
          className="py-3 px-4 text-sm truncate cursor-pointer flex items-center hover:bg-blue-darker/50 rounded-l"
          onClick={() => setShowDetailsModal(true)}
        >
          <AssetIcon ticker={asset.ticker} />
          <div>
            <div className="font-bold">{asset.ticker}</div>
            <div>{asset.name}</div>
          </div>
        </div>

        <div className="text-sm py-3 px-4">
          {isLoading ? (
            <LoadingPlaceholder />
          ) : (
            <div className="font-bold">
              {formatAmount(asset, offChainBalance)}
            </div>
          )}
        </div>

        <div className="text-sm py-3 px-4">
          {isLoading ? (
            <LoadingPlaceholder />
          ) : (
            <div className="font-bold">
              {formatAmount(asset, onChainBalance)}
            </div>
          )}
        </div>

        <div className="text-sm py-3 pl-4 pr-6 flex justify-center">
          <div className="flex items-center gap-3 relative">
            <div className="relative group">
              <button
                className="p-2 rounded-lg border border-cyan/30 hover:border-cyan/60 hover:bg-cyan/10 transition-all duration-200"
                onClick={() =>
                  dispatch(
                    uiSliceActions.setModal({
                      assetId: asset.asset_id,
                      type: 'deposit',
                    })
                  )
                }
              >
                <Download className="w-4 h-4 text-cyan" />
              </button>
              <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                Deposit
              </div>
            </div>

            <div className="relative group">
              <button
                className="p-2 rounded-lg border border-red/30 hover:border-red/60 hover:bg-red/10 transition-all duration-200"
                onClick={() =>
                  dispatch(
                    uiSliceActions.setModal({
                      assetId: asset.asset_id,
                      type: 'withdraw',
                    })
                  )
                }
              >
                <Upload className="w-4 h-4 text-red" />
              </button>
              <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                Withdraw
              </div>
            </div>

            <div className="relative group">
              <button
                className="p-2 rounded-lg border border-purple/30 hover:border-purple/60 hover:bg-purple/10 transition-all duration-200"
                onClick={() =>
                  navigate(
                    `${WALLET_HISTORY_ASSETS_PATH}?assetId=${asset.asset_id}`
                  )
                }
              >
                <History className="w-4 h-4 text-purple" />
              </button>
              <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                History
              </div>
            </div>
          </div>
        </div>
      </div>

      {showDetailsModal && (
        <AssetDetailsModal
          asset={asset}
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
        />
      )}
    </>
  )
}
