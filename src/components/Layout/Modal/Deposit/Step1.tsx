import { Search, ChevronDown, Plus } from 'lucide-react'
import { useCallback, useState } from 'react'

import { useAppSelector } from '../../../../app/store/hooks'
import btcLogo from '../../../../assets/bitcoin-logo.svg'
import rgbLogo from '../../../../assets/rgb-symbol-color.svg'
import { BTC_ASSET_ID } from '../../../../constants'
import { nodeApi } from '../../../../slices/nodeApi/nodeApi.slice'
import { DepositModal, uiSliceSeletors } from '../../../../slices/ui/ui.slice'

interface Props {
  onNext: (assetId?: string) => void
}

interface Asset {
  asset_id: string
  ticker: string
  name?: string
  icon?: string
}

export const Step1 = ({ onNext }: Props) => {
  const modal = useAppSelector(uiSliceSeletors.modal) as DepositModal
  const [assetId, setAssetId] = useState<string>(modal.assetId ?? BTC_ASSET_ID)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isNewAsset, setIsNewAsset] = useState(false)

  const assets = nodeApi.useListAssetsQuery()

  // Combine BTC with other assets
  const allAssets: Asset[] = [
    { asset_id: BTC_ASSET_ID, name: 'Bitcoin', ticker: 'BTC' },
    ...(assets.data?.nia || []),
  ]

  const filteredAssets = allAssets.filter(
    (asset) =>
      asset.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.asset_id.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedAsset = allAssets.find((a) => a.asset_id === assetId)

  const handleAssetSelect = (asset: Asset | null) => {
    if (asset) {
      setAssetId(asset.asset_id)
      setIsNewAsset(false)
    }
    setIsDropdownOpen(false)
  }

  const handleAddNewAsset = () => {
    setIsNewAsset(true)
    setAssetId('')
    setIsDropdownOpen(false)
  }

  const handleSubmit = useCallback(() => {
    if (isNewAsset && !assetId) {
      onNext(undefined)
      return
    }
    onNext(assetId)
  }, [assetId, onNext, isNewAsset])

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800/50 p-6">
      <div className="flex flex-col items-center mb-6">
        {selectedAsset?.asset_id === BTC_ASSET_ID ? (
          <img alt="Bitcoin" className="w-10 h-10 mb-3" src={btcLogo} />
        ) : (
          <img alt="RGB Asset" className="w-10 h-10 mb-3" src={rgbLogo} />
        )}
        <h3 className="text-2xl font-bold text-white mb-2">Select Asset</h3>
        <p className="text-slate-400 text-center max-w-md text-sm">
          Choose the asset you want to deposit into your wallet
        </p>
      </div>

      <div className="space-y-4 max-w-xl mx-auto">
        {/* Asset Selector */}
        <div className="relative">
          <button
            className="w-full p-3 bg-slate-800/50 rounded-xl border border-slate-700 
                     hover:border-blue-500/50 transition-all duration-200
                     flex items-center justify-between text-left"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <div className="flex items-center gap-3">
              {selectedAsset && !isNewAsset ? (
                <>
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                    {selectedAsset.asset_id === BTC_ASSET_ID ? (
                      <img alt="Bitcoin" className="w-5 h-5" src={btcLogo} />
                    ) : (
                      <img alt="RGB Asset" className="w-5 h-5" src={rgbLogo} />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-white">
                      {selectedAsset.ticker}
                    </div>
                    <div className="text-xs text-slate-400">
                      {selectedAsset.name || 'Asset'}
                    </div>
                  </div>
                </>
              ) : (
                <span className="text-slate-400">
                  {isNewAsset ? 'New Asset' : 'Select an asset'}
                </span>
              )}
            </div>
            <ChevronDown
              className={`w-5 h-5 text-slate-400 transition-transform duration-200 
              ${isDropdownOpen ? 'transform rotate-180' : ''}`}
            />
          </button>

          {/* Dropdown */}
          {isDropdownOpen && (
            <div
              className="absolute mt-2 w-full bg-slate-800 rounded-xl border border-slate-700 
                          shadow-xl z-50 max-h-[250px] overflow-y-auto custom-scrollbar"
            >
              <div className="sticky top-0 p-2 border-b border-slate-700 bg-slate-800 z-10">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    autoFocus
                    className="w-full pl-10 pr-4 py-1.5 bg-slate-900/50 rounded-lg border border-slate-600 
                             text-white placeholder:text-slate-500 focus:border-blue-500 
                             focus:ring-1 focus:ring-blue-500 text-sm"
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search assets..."
                    type="text"
                    value={searchQuery}
                  />
                </div>
              </div>

              <div className="py-1">
                {/* Add New Asset Button - Now at the top */}
                <button
                  className="w-full px-3 py-2 flex items-center gap-2 hover:bg-blue-500/10 
                           text-blue-500 transition-colors duration-200 border-b border-slate-700 text-sm sticky top-[52px] z-10 bg-slate-800/95 backdrop-blur-sm"
                  onClick={handleAddNewAsset}
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Asset</span>
                </button>

                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                  {filteredAssets.length === 0 ? (
                    <div className="p-3 text-center text-slate-500 text-sm">
                      No assets found matching "{searchQuery}"
                    </div>
                  ) : (
                    filteredAssets.map((asset) => (
                      <button
                        className="w-full px-3 py-2 flex items-center gap-3 hover:bg-blue-500/10 
                                 transition-colors duration-200 text-sm"
                        key={asset.asset_id}
                        onClick={() => handleAssetSelect(asset)}
                      >
                        <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center">
                          {asset.asset_id === BTC_ASSET_ID ? (
                            <img
                              alt="Bitcoin"
                              className="w-4 h-4"
                              src={btcLogo}
                            />
                          ) : (
                            <img
                              alt="RGB Asset"
                              className="w-4 h-4"
                              src={rgbLogo}
                            />
                          )}
                        </div>
                        <div className="text-left flex-1">
                          <div className="font-medium text-white flex items-center justify-between">
                            <span>{asset.ticker}</span>
                            {asset.asset_id === assetId && (
                              <span className="text-blue-400 text-xs bg-blue-500/10 px-1.5 py-0.5 rounded-lg">
                                Selected
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 truncate">
                            {asset.name || 'Asset'}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* New Asset Input */}
        {isNewAsset && (
          <div className="space-y-3 animate-fadeIn">
            <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <p className="text-blue-400 text-xs">
                If you don't know the asset ID, you can proceed without entering
                it. The system will generate a deposit address that can receive
                any RGB asset.
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">
                Asset ID (optional)
              </label>
              <input
                className="w-full px-3 py-2 bg-slate-800/50 rounded-xl border border-slate-700 
                         focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white
                         placeholder:text-slate-600 text-sm"
                onChange={(e) => setAssetId(e.target.value)}
                placeholder="Enter asset ID (optional)"
                type="text"
              />
            </div>
          </div>
        )}

        {/* Continue Button */}
        <button
          className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white 
                   rounded-xl font-medium transition-colors flex items-center 
                   justify-center gap-2 sticky bottom-0"
          onClick={handleSubmit}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
