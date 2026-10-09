import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Plus,
  Search,
  X,
} from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAppSelector } from '../../../../app/store/hooks'
import btcLogo from '../../../../assets/bitcoin-logo.svg'
import rgbLogo from '../../../../assets/rgb-logo.svg'
import { BTC_ASSET_ID } from '../../../../constants'
import { useAssetIcon } from '../../../../helpers/utils'
import { nodeApi } from '../../../../slices/nodeApi/nodeApi.slice'
import { DepositModal, uiSliceSeletors } from '../../../../slices/ui/ui.slice'
import { getAllRgbAssets } from '../../../../utils/rgbUtils'

import { isUsdt, orderOtherAssets, type PickerAsset } from './assetOrder'

interface Props {
  onNext: (assetId?: string) => void
  onClose: () => void
}

type Asset = PickerAsset

const RECENT_KEY = 'kaleido.deposit.recentAssets'
const RECENT_MAX = 6
// Search shows up once the slider holds more than this many assets.
const SEARCH_THRESHOLD = 6

const readRecent = (): string[] => {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.filter((x) => typeof x === 'string')
      : []
  } catch {
    return []
  }
}

const rememberRecent = (assetId: string) => {
  try {
    const next = [assetId, ...readRecent().filter((id) => id !== assetId)]
    localStorage.setItem(RECENT_KEY, JSON.stringify(next.slice(0, RECENT_MAX)))
  } catch {
    // Storage unavailable: recents are a convenience only.
  }
}

const AssetIcon = ({ asset, size }: { asset: Asset; size: string }) => {
  const fallback = asset.asset_id === BTC_ASSET_ID ? btcLogo : rgbLogo
  const [icon, setIcon] = useAssetIcon(asset.ticker, fallback)
  return (
    <img
      alt={asset.ticker}
      className={`${size} object-contain`}
      onError={() => setIcon(fallback)}
      src={icon}
    />
  )
}

const SelectedMark = () => (
  <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
    <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
  </span>
)

// Large tile for the pinned assets (BTC, USDT).
const FeaturedTile = ({
  asset,
  selected,
  onClick,
}: {
  asset: Asset
  selected: boolean
  onClick: () => void
}) => (
  <button
    className={`relative flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${
      selected
        ? 'border-primary bg-primary/10'
        : 'border-border-subtle bg-surface-overlay/50 hover:border-primary/40 hover:bg-surface-overlay'
    }`}
    onClick={onClick}
    type="button"
  >
    {selected && <SelectedMark />}
    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-high/60">
      <AssetIcon asset={asset} size="h-8 w-8" />
    </span>
    <span className="min-w-0">
      <span className="block text-base font-semibold text-white">
        {asset.ticker}
      </span>
      {asset.name && (
        <span className="block truncate text-xs text-content-tertiary">
          {asset.name}
        </span>
      )}
    </span>
  </button>
)

// Compact chip for the slider.
const AssetChip = ({
  asset,
  selected,
  recent,
  onClick,
}: {
  asset: Asset
  selected: boolean
  recent: boolean
  onClick: () => void
}) => (
  <button
    className={`relative flex w-[92px] flex-shrink-0 snap-start flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition-colors ${
      selected
        ? 'border-primary bg-primary/10'
        : 'border-border-subtle bg-surface-overlay/50 hover:border-primary/40 hover:bg-surface-overlay'
    }`}
    onClick={onClick}
    title={asset.name || asset.ticker}
    type="button"
  >
    {selected && <SelectedMark />}
    {recent && !selected && (
      <Clock className="absolute right-2 top-2 h-3 w-3 text-content-tertiary" />
    )}
    <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-surface-high/60">
      <AssetIcon asset={asset} size="h-6 w-6" />
    </span>
    <span className="max-w-full truncate text-xs font-semibold text-white">
      {asset.ticker}
    </span>
  </button>
)

export const Step1 = ({ onNext, onClose }: Props) => {
  const { t } = useTranslation()
  const modal = useAppSelector(uiSliceSeletors.modal) as DepositModal
  const [assetId, setAssetId] = useState<string>(modal.assetId ?? BTC_ASSET_ID)
  const [isNewAsset, setIsNewAsset] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [recent] = useState(readRecent)
  const sliderRef = useRef<HTMLDivElement>(null)

  const assets = nodeApi.useListAssetsQuery()

  // Every RGB schema (NIA, CFA, UDA, IFA), so collectibles are selectable too.
  const rgbAssets: Asset[] = useMemo(
    () =>
      getAllRgbAssets(assets.data).map((a) => {
        const balance = (a as { balance?: Record<string, number> }).balance
        return {
          asset_id: a.asset_id ?? '',
          hasBalance:
            !!balance &&
            ((balance.future ?? 0) > 0 || (balance.offchain_outbound ?? 0) > 0),
          name: a.name,
          ticker: a.ticker ?? '',
        }
      }),
    [assets.data]
  )

  const btc: Asset = {
    asset_id: BTC_ASSET_ID,
    hasBalance: true,
    name: 'Bitcoin',
    ticker: 'BTC',
  }
  const usdt = rgbAssets.find(isUsdt)

  // Slider: everything except the pinned tiles, recent first, then assets the
  // wallet holds, then alphabetical.
  const others = useMemo(
    () => orderOtherAssets(rgbAssets, recent, usdt?.asset_id),
    [rgbAssets, usdt?.asset_id, recent]
  )

  const q = searchQuery.trim().toLowerCase()
  const filteredOthers = q
    ? others.filter(
        (a) =>
          a.ticker.toLowerCase().includes(q) ||
          a.name?.toLowerCase().includes(q) ||
          a.asset_id.toLowerCase().includes(q)
      )
    : others

  const select = (id: string) => {
    setAssetId(id)
    setIsNewAsset(false)
  }

  const scrollSlider = (dir: 1 | -1) =>
    sliderRef.current?.scrollBy({ behavior: 'smooth', left: dir * 300 })

  const handleSubmit = useCallback(() => {
    if (isNewAsset && !assetId) {
      onNext(undefined)
      return
    }
    if (assetId) rememberRecent(assetId)
    onNext(assetId)
  }, [assetId, onNext, isNewAsset])

  const selectedTicker = [btc, ...rgbAssets].find(
    (a) => a.asset_id === assetId
  )?.ticker

  const newAssetChip = (
    <button
      className={`relative flex w-[92px] flex-shrink-0 snap-start flex-col items-center gap-1.5 rounded-xl border border-dashed px-2 py-3 transition-colors ${
        isNewAsset
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-primary/40 text-primary hover:bg-primary/10'
      }`}
      onClick={() => {
        setIsNewAsset(true)
        setAssetId('')
      }}
      title={t('depositModal.step1.newAssetInfo')}
      type="button"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
        <Plus className="h-4 w-4" />
      </span>
      <span className="max-w-full truncate text-xs font-semibold">
        {t('depositModal.step1.newAssetLabel')}
      </span>
    </button>
  )

  return (
    <div>
      <div className="mb-4 flex items-center gap-3 border-b border-divider/10 pb-4">
        <Download className="h-6 w-6 text-primary" />
        <h3 className="flex-1 text-xl font-bold text-white">
          {t('depositModal.title', 'Deposit')}
        </h3>
        <button
          className="rounded-lg p-1.5 text-content-secondary transition-colors hover:bg-surface-high/60 hover:text-white"
          onClick={onClose}
          type="button"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-5">
        <p className="text-center text-sm text-content-secondary">
          {t(
            'depositModal.step1.subtitle',
            'Choose the asset you want to deposit into your wallet'
          )}
        </p>

        {/* Pinned: Bitcoin + USDT (or "new asset" when the node has no USDT) */}
        <div className="grid grid-cols-2 gap-3">
          <FeaturedTile
            asset={btc}
            onClick={() => select(BTC_ASSET_ID)}
            selected={!isNewAsset && assetId === BTC_ASSET_ID}
          />
          {usdt ? (
            <FeaturedTile
              asset={usdt}
              onClick={() => select(usdt.asset_id)}
              selected={!isNewAsset && assetId === usdt.asset_id}
            />
          ) : (
            <button
              className={`flex items-center gap-3 rounded-2xl border border-dashed p-4 text-left transition-colors ${
                isNewAsset
                  ? 'border-primary bg-primary/10'
                  : 'border-primary/40 hover:bg-primary/10'
              }`}
              onClick={() => {
                setIsNewAsset(true)
                setAssetId('')
              }}
              type="button"
            >
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                <img alt="RGB" className="h-7 w-7" src={rgbLogo} />
              </span>
              <span>
                <span className="block text-base font-semibold text-primary">
                  {t('depositModal.step1.newAssetLabel')}
                </span>
                <span className="block text-xs text-content-tertiary">
                  {t('depositModal.step1.anyRgbAsset', 'Any RGB asset')}
                </span>
              </span>
            </button>
          )}
        </div>

        {/* Other assets: slider, recent first */}
        {(others.length > 0 || usdt) && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
                {t('depositModal.step1.otherAssets', 'Other assets')}
                {others.length > 0 && (
                  <span className="ml-1.5 text-content-tertiary/70">
                    {others.length}
                  </span>
                )}
              </span>
              {others.length > 3 && (
                <div className="flex gap-1">
                  <button
                    aria-label="Scroll left"
                    className="rounded-lg border border-border-default p-1 text-content-secondary hover:bg-surface-high hover:text-white"
                    onClick={() => scrollSlider(-1)}
                    type="button"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    aria-label="Scroll right"
                    className="rounded-lg border border-border-default p-1 text-content-secondary hover:bg-surface-high hover:text-white"
                    onClick={() => scrollSlider(1)}
                    type="button"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {others.length > SEARCH_THRESHOLD && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-secondary" />
                <input
                  className="w-full rounded-xl border border-border-default bg-surface-base/50 py-2 pl-10 pr-4 text-sm text-white placeholder:text-content-tertiary focus:border-primary focus:outline-none"
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('depositModal.step1.searchPlaceholder')}
                  type="text"
                  value={searchQuery}
                />
              </div>
            )}

            <div
              className="custom-scrollbar flex snap-x gap-2 overflow-x-auto pb-2"
              ref={sliderRef}
            >
              {filteredOthers.map((asset) => (
                <AssetChip
                  asset={asset}
                  key={asset.asset_id}
                  onClick={() => select(asset.asset_id)}
                  recent={recent.includes(asset.asset_id)}
                  selected={!isNewAsset && asset.asset_id === assetId}
                />
              ))}
              {q && filteredOthers.length === 0 && (
                <div className="py-4 text-sm text-content-tertiary">
                  {t('depositModal.step1.noResults', { query: searchQuery })}
                </div>
              )}
              {usdt && !q && newAssetChip}
            </div>
          </div>
        )}

        {isNewAsset && (
          <div className="animate-fadeIn space-y-2">
            <p className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-xs text-primary">
              {t('depositModal.step1.newAssetInfo')}
            </p>
            <label className="block text-xs font-medium text-content-secondary">
              {t('depositModal.step1.assetIdLabel')}
            </label>
            <input
              className="w-full rounded-xl border border-border-default bg-surface-overlay/50 px-3 py-2.5 font-mono text-sm text-white placeholder:font-sans placeholder:text-content-tertiary focus:border-primary/60 focus:outline-none"
              onChange={(e) => setAssetId(e.target.value)}
              placeholder={t('depositModal.step1.assetIdPlaceholder')}
              type="text"
            />
          </div>
        )}

        <button
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-colors duration-200 hover:bg-primary-emphasis"
          onClick={handleSubmit}
          type="button"
        >
          {selectedTicker && !isNewAsset
            ? t('depositModal.step1.continueWith', {
                defaultValue: 'Continue with {{ticker}}',
                ticker: selectedTicker,
              })
            : t('depositModal.common.continue')}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
