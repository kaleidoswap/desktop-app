import { Search, ChevronDown, Plus } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()

  const assets = nodeApi.useListAssetsQuery()

  // Combine BTC with other assets
  const allAssets: Asset[] = [
    { asset_id: BTC_ASSET_ID, name: 'Bitcoin', ticker: 'BTC' },
    ...(assets.data?.nia || []).map((a: any) => ({
      asset_id: a.asset_id ?? '',
      icon: undefined,
      name: a.name,
      ticker: a.ticker ?? '',
    })),
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
    <div className="bg-surface-base/50 backdrop-blur-sm rounded-2xl border border-border-subtle/50 p-4">
      <div className="flex flex-col items-center mb-3">
        {selectedAsset?.asset_id === BTC_ASSET_ID ? (
          <img alt="Bitcoin" className="w-8 h-8 mb-2" src={btcLogo} />
        ) : (
          <img alt="RGB Asset" className="w-8 h-8 mb-2" src={rgbLogo} />
        )}
        <h3 className="text-xl font-bold text-white mb-1">
          {t('depositModal.step1.title')}
        </h3>
        <p className="text-content-secondary text-center max-w-md text-xs">
          {t('depositModal.step1.subtitle')}
        </p>
      </div>

      <div className="space-y-3 max-w-xl mx-auto">
        {/* Asset Selector trigger */}
        <button
          className="w-full p-2.5 bg-surface-overlay/50 rounded-xl border border-border-default
                   hover:border-primary/50 transition-all duration-200
                   flex items-center justify-between text-left"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <div className="flex items-center gap-2">
            {selectedAsset && !isNewAsset ? (
              <>
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                  {selectedAsset.asset_id === BTC_ASSET_ID ? (
                    <img alt="Bitcoin" className="w-4 h-4" src={btcLogo} />
                  ) : (
                    <img alt="RGB Asset" className="w-4 h-4" src={rgbLogo} />
                  )}
                </div>
                <div>
                  <div className="font-medium text-white text-sm">
                    {selectedAsset.ticker}
                  </div>
                  <div className="text-xs text-content-secondary">
                    {selectedAsset.name || 'Asset'}
                  </div>
                </div>
              </>
            ) : (
              <span className="text-content-secondary text-sm">
                {isNewAsset
                  ? t('depositModal.step1.newAssetLabel')
                  : t('depositModal.step1.selectorPlaceholder')}
              </span>
            )}
          </div>
          <ChevronDown
            className={`w-4 h-4 text-content-secondary transition-transform duration-200
            ${isDropdownOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Inline list panel — no absolute positioning to avoid overflow-hidden clipping */}
        {isDropdownOpen && (
          <div className="rounded-xl border border-border-default bg-surface-overlay shadow-lg overflow-hidden">
            <div className="p-2 border-b border-border-default">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-secondary" />
                <input
                  autoFocus
                  className="w-full pl-10 pr-4 py-1.5 bg-surface-base/50 rounded-lg border border-border-default
                           text-white placeholder:text-content-tertiary focus:border-primary/60
                           focus:ring-1 focus:ring-primary/30 text-sm"
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('depositModal.step1.searchPlaceholder')}
                  type="text"
                  value={searchQuery}
                />
              </div>
            </div>

            <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
              <button
                className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-primary/10
                         text-primary transition-colors duration-200 border-b border-border-default text-sm"
                onClick={handleAddNewAsset}
              >
                <Plus className="w-4 h-4" />
                <span>{t('depositModal.step1.addNewAsset')}</span>
              </button>

              {filteredAssets.length === 0 ? (
                <div className="p-3 text-center text-content-tertiary text-sm">
                  {t('depositModal.step1.noResults', { query: searchQuery })}
                </div>
              ) : (
                filteredAssets.map((asset) => (
                  <button
                    className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-primary/10
                             transition-colors duration-200 text-sm"
                    key={asset.asset_id}
                    onClick={() => handleAssetSelect(asset)}
                  >
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {asset.asset_id === BTC_ASSET_ID ? (
                        <img alt="Bitcoin" className="w-4 h-4" src={btcLogo} />
                      ) : (
                        <img
                          alt="RGB Asset"
                          className="w-4 h-4"
                          src={rgbLogo}
                        />
                      )}
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <div className="font-medium text-white flex items-center justify-between">
                        <span>{asset.ticker}</span>
                        {asset.asset_id === assetId && (
                          <span className="text-primary text-xs bg-primary/10 px-1.5 py-0.5 rounded-lg ml-2">
                            {t('depositModal.step1.selected')}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-content-secondary truncate">
                        {asset.name || t('depositModal.step1.genericAsset')}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* New Asset Input */}
        {isNewAsset && (
          <div className="space-y-2 animate-fadeIn">
            <div className="p-2 bg-primary/10 rounded-xl border border-primary/20">
              <p className="text-primary text-xs">
                {t('depositModal.step1.newAssetInfo')}
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-content-secondary">
                {t('depositModal.step1.assetIdLabel')}
              </label>
              <input
                className="w-full px-3 py-2 bg-surface-overlay/50 rounded-xl border border-border-default 
                         focus:border-primary/60 focus:ring-1 focus:ring-primary/30 text-white
                         placeholder:text-content-tertiary text-sm"
                onChange={(e) => setAssetId(e.target.value)}
                placeholder={t('depositModal.step1.assetIdPlaceholder')}
                type="text"
              />
            </div>
          </div>
        )}

        {/* Continue Button */}
        <button
          className="w-full py-2.5 px-4 bg-[#15E99A] hover:bg-[#12C97E] text-gray-900
                   rounded-xl font-semibold transition-all duration-200 shadow-md shadow-primary/20
                   flex items-center justify-center gap-2 text-sm"
          onClick={handleSubmit}
        >
          {t('depositModal.common.continue')}
        </button>
      </div>
    </div>
  )
}
