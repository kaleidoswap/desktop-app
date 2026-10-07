import { Search, Plus, ArrowRight, Check, Download, X } from 'lucide-react'
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

// Inline tiles before collapsing the rest behind "+". With the always-present
// "New asset" tile this fills two even rows of four.
const INLINE_LIMIT = 7

const TILE =
  'relative flex flex-col items-center justify-center gap-1.5 px-2 py-3 rounded-2xl border transition-all duration-200 w-[calc(25%-9px)] min-w-[88px]'

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
      className={`${TILE} ${
        selected
          ? 'border-primary bg-primary/10'
          : 'border-border-subtle bg-surface-overlay/50 hover:border-primary/40 hover:bg-surface-overlay'
      }`}
      onClick={onClick}
      title={asset.name || asset.ticker}
      type="button"
    >
      {selected && (
        <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
          <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />
        </span>
      )}
      <div className="w-11 h-11 rounded-full bg-surface-high/60 flex items-center justify-center overflow-hidden">
        <img
          alt={asset.ticker}
          className="w-8 h-8 object-contain"
          onError={() =>
            setIcon(asset.asset_id === BTC_ASSET_ID ? btcLogo : rgbLogo)
          }
          src={icon}
        />
      </div>
      <span className="text-sm font-semibold text-white truncate max-w-full">
        {asset.ticker}
      </span>
      {asset.name && (
        <span className="-mt-1 text-[11px] text-content-tertiary truncate max-w-full">
          {asset.name}
        </span>
      )}
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

      <div className="space-y-5">
        <p className="text-content-secondary text-sm text-center">
          {t(
            'depositModal.step1.subtitle',
            'Choose the asset you want to deposit into your wallet'
          )}
        </p>

        {/* Inline asset tiles — a few directly, the rest behind "+" */}
        <div className="flex flex-wrap justify-center gap-3">
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
              className={`${TILE} border-dashed ${
                isExpanded
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border-default text-content-secondary hover:border-primary/40 hover:text-primary'
              }`}
              onClick={() => setIsExpanded((v) => !v)}
              type="button"
            >
              <div className="w-11 h-11 rounded-full bg-surface-high/60 flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-sm font-semibold">
                {t('depositModal.step1.more', {
                  count: orderedAssets.length - inlineAssets.length,
                  defaultValue: 'More',
                })}
              </span>
            </button>
          )}

          {/* Always available: receive a brand-new RGB asset (generic invoice) */}
          <button
            className={`${TILE} border-dashed ${
              isNewAsset
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-primary/40 text-primary hover:bg-primary/10'
            }`}
            onClick={handleAddNewAsset}
            title={t('depositModal.step1.newAssetInfo')}
            type="button"
          >
            <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
              <img
                alt="RGB asset"
                className="w-8 h-8 object-contain"
                src={rgbLogo}
              />
            </div>
            <span className="text-sm font-semibold">
              {t('depositModal.step1.newAssetLabel')}
            </span>
          </button>
        </div>

        {/* Expanded picker — searchable grid of every asset */}
        {isExpanded && (
          <div className="rounded-2xl border border-border-default bg-surface-overlay/50 p-3 space-y-3 animate-fadeIn">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-secondary" />
              <input
                autoFocus
                className="w-full pl-10 pr-4 py-2 bg-surface-base/50 rounded-xl border border-border-default
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
              <div className="flex flex-wrap justify-center gap-3 max-h-64 overflow-y-auto custom-scrollbar">
                {filteredAssets.map((asset) => (
                  <AssetIconButton
                    asset={asset}
                    key={asset.asset_id}
                    onClick={() => handleAssetSelect(asset)}
                    selected={!isNewAsset && asset.asset_id === assetId}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* New asset: optional asset id */}
        {isNewAsset && (
          <div className="space-y-2 animate-fadeIn">
            <p className="p-3 text-primary text-xs bg-primary/10 rounded-xl border border-primary/20">
              {t('depositModal.step1.newAssetInfo')}
            </p>
            <label className="block text-xs font-medium text-content-secondary">
              {t('depositModal.step1.assetIdLabel')}
            </label>
            <input
              className="w-full px-3 py-2.5 bg-surface-overlay/50 rounded-xl border border-border-default
                       focus:border-primary/60 focus:outline-none text-white font-mono
                       placeholder:text-content-tertiary placeholder:font-sans text-sm"
              onChange={(e) => setAssetId(e.target.value)}
              placeholder={t('depositModal.step1.assetIdPlaceholder')}
              type="text"
            />
          </div>
        )}

        <button
          className="w-full py-3 px-4 bg-primary hover:bg-primary-emphasis text-primary-foreground
                   rounded-xl font-semibold transition-colors duration-200 shadow-md shadow-primary/20
                   flex items-center justify-center gap-2 text-sm"
          onClick={handleSubmit}
          type="button"
        >
          {selectedAsset && !isNewAsset
            ? t('depositModal.step1.continueWith', {
                defaultValue: 'Continue with {{ticker}}',
                ticker: selectedAsset.ticker,
              })
            : t('depositModal.common.continue')}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
