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
    const precision = asset.precision || 0
    const formattedAmount = amount / Math.pow(10, precision)
    return formattedAmount.toLocaleString('en-US', {
      maximumFractionDigits: precision,
    })
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-2 even:bg-surface-elevated rounded items-center">
        <div
          className="py-3 px-4 text-sm truncate cursor-pointer flex items-center hover:bg-surface-overlay/50 rounded-l"
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

        <div className="py-3 px-2 flex justify-center">
          <div className="flex items-center gap-0.5">
            {[
              { icon: <Download className="w-3.5 h-3.5" />, label: 'Deposit', color: 'text-primary hover:bg-primary/15', onClick: () => dispatch(uiSliceActions.setModal({ assetId: asset.asset_id, type: 'deposit' })) },
              { icon: <Upload className="w-3.5 h-3.5" />, label: 'Withdraw', color: 'text-status-danger hover:bg-status-danger/15', onClick: () => dispatch(uiSliceActions.setModal({ assetId: asset.asset_id, type: 'withdraw' })) },
              { icon: <History className="w-3.5 h-3.5" />, label: 'History', color: 'text-secondary hover:bg-secondary/15', onClick: () => navigate(`${WALLET_HISTORY_ASSETS_PATH}?assetId=${asset.asset_id}`) },
            ].map(({ icon, label, color, onClick }) => (
              <div key={label} className="relative group/btn">
                <button
                  className={`p-1.5 rounded-lg transition-colors duration-150 ${color}`}
                  onClick={onClick}
                  title={label}
                >
                  {icon}
                </button>
                <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-surface-high text-content-primary text-[10px] rounded-md py-0.5 px-1.5 opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-border-default/40 shadow-lg z-20">
                  {label}
                </div>
              </div>
            ))}
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
