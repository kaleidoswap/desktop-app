import { Search, Plus, ArrowRight, Download, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAppSelector } from '../../../../app/store/hooks'
import btcLogo from '../../../../assets/bitcoin-logo.svg'
import rgbLogo from '../../../../assets/rgb-logo.svg'
import { BTC_ASSET_ID } from '../../../../constants'
import { useAssetIcon } from '../../../../helpers/utils'
import { nodeApi } from '../../../../slices/nodeApi/nodeApi.slice'
import { DepositModal, uiSliceSeletors } from '../../../../slices/ui/ui.slice'
import { getAllRgbAssets } from '../../../../utils/rgbUtils'

interface Props {
  onNext: (assetId?: string) => void
  onClose: () => void
}

interface Asset {
  asset_id: string
  ticker: string
  name?: string
  icon?: string
}

// How many asset icons to show inline before collapsing the rest behind "+".
const INLINE_LIMIT = 5

const AssetIconButton = ({
  asset,
  selected,
  onClick,
}: {
  asset: Asset
  selected: boolean
  onClick: () => void
}) => {
  const [icon, setIcon] = useAssetIcon(
    asset.ticker,
    asset.asset_id === BTC_ASSET_ID ? btcLogo : rgbLogo
  )

  return (
    <button
      className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all duration-200 shrink-0 w-[76px]
        ${
          selected
            ? 'border-primary bg-primary/10'
            : 'border-border-subtle bg-surface-overlay/50 hover:border-primary/40'
        }`}
      onClick={onClick}
      title={asset.name || asset.ticker}
      type="button"
    >
      <div className="w-10 h-10 rounded-full bg-surface-high/60 flex items-center justify-center overflow-hidden">
        <img
          alt={asset.ticker}
          className="w-7 h-7 object-contain"
          onError={() =>
            setIcon(asset.asset_id === BTC_ASSET_ID ? btcLogo : rgbLogo)
          }
          src={icon}
        />
      </div>
      <span className="text-xs font-medium text-white truncate max-w-[64px]">
        {asset.ticker}
      </span>
    </button>
  )
}

export const Step1 = ({ onNext, onClose }: Props) => {
  const modal = useAppSelector(uiSliceSeletors.modal) as DepositModal
  const [assetId, setAssetId] = useState<string>(modal.assetId ?? BTC_ASSET_ID)
  const [isExpanded, setIsExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isNewAsset, setIsNewAsset] = useState(false)
  const { t } = useTranslation()

  const assets = nodeApi.useListAssetsQuery()

  // Combine BTC with every RGB asset schema (NIA, CFA, UDA, IFA), not just NIA,
  // so received collectibles/unique/inflatable assets are selectable too.
  const allAssets: Asset[] = [
    { asset_id: BTC_ASSET_ID, name: 'Bitcoin', ticker: 'BTC' },
    ...getAllRgbAssets(assets.data).map((a) => ({
      asset_id: a.asset_id ?? '',
      icon: undefined,
      name: a.name,
      ticker: a.ticker ?? '',
    })),
  ]

  const selectedAsset = allAssets.find((a) => a.asset_id === assetId)

  // Keep BTC first, then surface the currently selected asset so it stays
  // visible in the inline row even when it would otherwise fall behind "+".
  const orderedAssets =
    selectedAsset && assetId !== BTC_ASSET_ID
      ? [
          allAssets[0],
          selectedAsset,
          ...allAssets.slice(1).filter((a) => a.asset_id !== assetId),
        ]
      : allAssets

  const hasMore = orderedAssets.length > INLINE_LIMIT
  const inlineAssets = hasMore
    ? orderedAssets.slice(0, INLINE_LIMIT - 1)
    : orderedAssets

  const filteredAssets = orderedAssets.filter(
    (asset) =>
      asset.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.asset_id.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleAssetSelect = (asset: Asset) => {
    setAssetId(asset.asset_id)
    setIsNewAsset(false)
    setIsExpanded(false)
  }

  const handleAddNewAsset = () => {
    setIsNewAsset(true)
    setAssetId('')
    setIsExpanded(false)
  }

  const handleSubmit = useCallback(() => {
    if (isNewAsset && !assetId) {
      onNext(undefined)
      return
    }
    onNext(assetId)
  }, [assetId, onNext, isNewAsset])

  return (
    <div>
      <div className="flex items-center gap-3 pb-4 border-b border-divider/10 mb-4">
        <Download className="w-6 h-6 text-primary" />
        <h3 className="text-xl font-bold text-white flex-1">
          {t('depositModal.title', 'Deposit')}
        </h3>
        <button
          className="text-content-secondary hover:text-white p-1.5 rounded-lg hover:bg-surface-high/60 transition-colors"
          onClick={onClose}
          type="button"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-3 max-w-xl mx-auto">
        <p className="text-content-secondary text-sm">
          {t('depositModal.step1.title')}
        </p>

        {/* Inline asset icons — show the few directly, collapse the rest behind "+" */}
        <div className="flex flex-wrap gap-2">
          {inlineAssets.map((asset) => (
            <AssetIconButton
              asset={asset}
              key={asset.asset_id}
              onClick={() => handleAssetSelect(asset)}
              selected={!isNewAsset && asset.asset_id === assetId}
            />
          ))}

          {hasMore && (
            <button
              className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border border-dashed transition-all duration-200 shrink-0 w-[76px]
                ${
                  isExpanded
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border-default text-content-secondary hover:border-primary/40 hover:text-primary'
                }`}
              onClick={() => setIsExpanded((v) => !v)}
              type="button"
            >
              <div className="w-10 h-10 rounded-full bg-surface-high/60 flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium">
                {t('depositModal.step1.more', {
                  count: orderedAssets.length - inlineAssets.length,
                  defaultValue: 'More',
                })}
              </span>
            </button>
          )}

          {/* Always available: receive a brand-new RGB asset (generic invoice) */}
          <button
            className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border border-dashed transition-all duration-200 shrink-0 w-[76px]
              ${
                isNewAsset
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-primary/40 text-primary hover:bg-primary/10'
              }`}
            onClick={handleAddNewAsset}
            title={t('depositModal.step1.newAssetInfo')}
            type="button"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
              <img
                alt="RGB asset"
                className="w-7 h-7 object-contain"
                src={rgbLogo}
              />
            </div>
            <span className="text-xs font-medium">
              {t('depositModal.step1.newAssetLabel')}
            </span>
          </button>
        </div>

        {/* Expanded slider — searchable, horizontally scrollable strip of all assets */}
        {isExpanded && (
          <div className="rounded-xl border border-border-default bg-surface-overlay p-3 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-secondary" />
              <input
                autoFocus
                className="w-full pl-10 pr-4 py-1.5 bg-surface-base/50 rounded-lg border border-border-default
                         text-white placeholder:text-content-tertiary focus:border-primary
                         focus:outline-none text-sm"
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('depositModal.step1.searchPlaceholder')}
                type="text"
                value={searchQuery}
              />
            </div>

            {filteredAssets.length === 0 ? (
              <div className="py-3 text-center text-content-tertiary text-sm">
                {t('depositModal.step1.noResults', { query: searchQuery })}
              </div>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar snap-x">
                {filteredAssets.map((asset) => (
                  <div className="snap-start" key={asset.asset_id}>
                    <AssetIconButton
                      asset={asset}
                      onClick={() => handleAssetSelect(asset)}
                      selected={!isNewAsset && asset.asset_id === assetId}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selected asset summary */}
        {selectedAsset && !isNewAsset && (
          <p className="text-xs text-content-secondary">
            {t('depositModal.step1.selected')}:{' '}
            <span className="text-white font-medium">
              {selectedAsset.ticker}
            </span>
            {selectedAsset.name ? ` · ${selectedAsset.name}` : ''}
          </p>
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
                   rounded-xl font-semibold transition-colors duration-200 shadow-md shadow-primary/20
                   flex items-center justify-center gap-2 text-sm"
          onClick={handleSubmit}
        >
          {t('depositModal.common.continue')}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
