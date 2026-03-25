import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import { ArrowDown } from 'lucide-react'

import { useAppDispatch, useAppSelector } from '../../../../app/store/hooks'
import { createLimitOrder } from '../../../../slices/limitOrderSlice'
import { getAssetId } from '../../../../slices/makerApi/makerApi.slice'
import { nodeApi } from '../../../../slices/nodeApi/nodeApi.slice'
import { useSettings } from '../../../../hooks/useSettings'
import { SwapInputField } from '../../../../components/Trade/SwapInputField'
import { getDisplayAsset, formatAssetAmountWithPrecision } from '../../../../helpers/number'

interface Props {
  onCreated?: () => void
}

const EXPIRATION_OPTIONS: { label: string; value: number | null }[] = [
  { label: '1h', value: 1 * 3600 * 1000 },
  { label: '4h', value: 4 * 3600 * 1000 },
  { label: '24h', value: 24 * 3600 * 1000 },
  { label: '1w', value: 7 * 24 * 3600 * 1000 },
  { label: '30d', value: 30 * 24 * 3600 * 1000 },
  { label: 'Never', value: null },
]

export function CreateLimitOrderForm({ onCreated }: Props) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const { bitcoinUnit } = useSettings()

  const tradingPairs = useAppSelector((s) => s.pairs.values)
  const activePairs = useMemo(
    () => tradingPairs.filter((p) => p.is_active),
    [tradingPairs]
  )

  const allAssets = useMemo(() => {
    const map = new Map<string, { id: string; ticker: string; precision?: number; assetData: any }>()
    activePairs.forEach((p) => {
      const baseId = getAssetId(p.base)
      const quoteId = getAssetId(p.quote)
      map.set(baseId, { ...p.base, id: baseId, assetData: p.base })
      map.set(quoteId, { ...p.quote, id: quoteId, assetData: p.quote })
    })
    return Array.from(map.values())
  }, [activePairs])

  const [fromAsset, setFromAsset] = useState(activePairs[0] ? getAssetId(activePairs[0].base) : '')
  const [toAsset, setToAsset] = useState(activePairs[0] ? getAssetId(activePairs[0].quote) : '')

  // Reset to valid toAsset if fromAsset changes
  useEffect(() => {
    if (!fromAsset) return
    const validPairs = activePairs.filter(
      (p) => getAssetId(p.base) === fromAsset || getAssetId(p.quote) === fromAsset
    )
    const validToIds = new Set(
      validPairs.map((p) => (getAssetId(p.base) === fromAsset ? getAssetId(p.quote) : getAssetId(p.base)))
    )
    if (!validToIds.has(toAsset) && validToIds.size > 0) {
      setToAsset(Array.from(validToIds)[0])
    }
  }, [fromAsset, activePairs, toAsset])

  const [fromAmountStr, setFromAmountStr] = useState('')
  const [limitPriceStr, setLimitPriceStr] = useState('')
  const [expirationMs, setExpirationMs] = useState<number | null>(24 * 3600 * 1000)
  const [selectedSize, setSelectedSize] = useState<number | undefined>(undefined)

  const derivedPairInfo = useMemo(() => {
    if (!fromAsset || !toAsset) return { pair: null, side: null }
    const pair = activePairs.find(
      (p) =>
        (getAssetId(p.base) === fromAsset && getAssetId(p.quote) === toAsset) ||
        (getAssetId(p.quote) === fromAsset && getAssetId(p.base) === toAsset)
    )
    if (!pair) return { pair: null, side: null }
    const side = (getAssetId(pair.base) === fromAsset ? 'sell' : 'buy') as 'buy' | 'sell'
    return { pair, side }
  }, [activePairs, fromAsset, toAsset])

  const { pair: selectedPair, side } = derivedPairInfo

  const currentPrice = useMemo(() => {
    if (!selectedPair || !selectedPair.price) return undefined
    const rawPrice = parseFloat(selectedPair.price)
    const quotePrecision = selectedPair.quote.precision ?? 6
    return rawPrice / Math.pow(10, quotePrecision)
  }, [selectedPair])

  // Initialize limit price smoothly if empty and price is available
  useEffect(() => {
    if (currentPrice && !limitPriceStr) {
      setLimitPriceStr(currentPrice.toString())
    }
  }, [currentPrice, limitPriceStr])

  const limitPrice = parseFloat(limitPriceStr)
  const fromAmount = parseFloat(fromAmountStr)

  // Asset options formatting
  const fromAssetOptions = useMemo(
    () => allAssets.map((a) => ({ ticker: a.ticker, value: a.id, assetId: a.id })),
    [allAssets]
  )

  const toAssetOptions = useMemo(() => {
    if (!fromAsset) return fromAssetOptions
    const validPairs = activePairs.filter(
      (p) => getAssetId(p.base) === fromAsset || getAssetId(p.quote) === fromAsset
    )
    const validToIds = new Set(
      validPairs.map((p) => (getAssetId(p.base) === fromAsset ? getAssetId(p.quote) : getAssetId(p.base)))
    )
    return allAssets
      .filter((a) => validToIds.has(a.id))
      .map((a) => ({ ticker: a.ticker, value: a.id, assetId: a.id }))
  }, [activePairs, fromAsset, allAssets, fromAssetOptions])

  // Compute available balances
  const { data: channelsData } = nodeApi.endpoints.listChannels.useQuery(undefined, {
    pollingInterval: 30_000,
  })
  const { data: assetsData } = nodeApi.endpoints.listAssets.useQuery(undefined, {
    pollingInterval: 30_000,
  })

  // spendingAsset is always fromAsset
  const spendingAssetStr = fromAsset
  const spendingAssetData = allAssets.find((a) => a.id === spendingAssetStr)

  const spendingBalance = useMemo(() => {
    if (!spendingAssetData || !channelsData?.channels) return undefined
    const assetId = spendingAssetData.id
    const isBtc = spendingAssetData.ticker.toUpperCase() === 'BTC' || assetId.toUpperCase() === 'BTC'

    if (isBtc) {
      return channelsData.channels
        .filter((ch: any) => ch.ready)
        .reduce((sum: number, ch: any) => sum + (ch.local_balance_sat ?? 0), 0)
    }

    const precision = spendingAssetData.precision ?? 6
    const factor = Math.pow(10, precision)

    const nodeAsset = (assetsData?.nia ?? []).find((a: any) => a.ticker === spendingAssetData.ticker)
    const matchId = nodeAsset?.asset_id || assetId

    return channelsData.channels
      .filter((ch: any) => ch.asset_id === matchId && ch.ready)
      .reduce((sum: number, ch: any) => sum + (ch.asset_local_amount ?? 0) / factor, 0)
  }, [spendingAssetData, channelsData, assetsData])

  const insufficientBalance =
    spendingBalance !== undefined && fromAmount > 0 ? fromAmount > spendingBalance : false

  const handleSizeClick = (sizePct: number) => {
    setSelectedSize(sizePct)
    if (spendingBalance !== undefined && spendingBalance > 0) {
      const amt = (spendingBalance * sizePct) / 100
      // We can use formatAssetAmountWithPrecision to format it to appropriate decimals
      const rawAssets = assetsData?.nia?.map((a: any) => ({ ...a, asset_id: a.asset_id, is_active: true, precision: a.precision || 8, ticker: a.ticker || '', name: a.name || '' })) || []
      const precisionStr = formatAssetAmountWithPrecision(amt, spendingAssetData?.ticker || '', bitcoinUnit, rawAssets)
      setFromAmountStr(precisionStr)
    }
  }

  const estimatedReceive = useMemo(() => {
    if (!selectedPair || !limitPrice || !fromAmount) return undefined
    if (side === 'sell') {
      return fromAmount * limitPrice
    } else {
      return fromAmount / limitPrice
    }
  }, [selectedPair, side, limitPrice, fromAmount])

  const handleCreate = () => {
    if (!selectedPair || !side) {
      toast.error(t('limitOrders.errors.noPair', 'Please select a valid trading pair'))
      return
    }
    if (!limitPrice || limitPrice <= 0) {
      toast.error(t('limitOrders.errors.invalidPrice', 'Please enter a valid limit price'))
      return
    }
    if (!fromAmount || fromAmount <= 0) {
      toast.error(t('limitOrders.errors.invalidAmount', 'Please enter a valid amount'))
      return
    }

    const baseAmount = side === 'sell' ? fromAmount : fromAmount / limitPrice

    const baseAssetId = getAssetId(selectedPair.base)
    const quoteAssetId = getAssetId(selectedPair.quote)

    let amountRaw: number
    if (side === 'buy') {
      const quotePrecision = selectedPair.quote.precision ?? 6
      if (selectedPair.quote.ticker.toUpperCase() === 'BTC') {
        amountRaw = Math.round(fromAmount * 1000) // msats
      } else {
        amountRaw = Math.round(fromAmount * Math.pow(10, quotePrecision))
      }
    } else {
      const basePrecision = selectedPair.base.precision ?? 8
      if (selectedPair.base.ticker.toUpperCase() === 'BTC') {
        amountRaw = Math.round(fromAmount * 1000) // msats
      } else {
        amountRaw = Math.round(fromAmount * Math.pow(10, basePrecision))
      }
    }

    dispatch(
      createLimitOrder({
        amount: baseAmount,
        amountRaw,
        baseAssetId,
        baseAssetTicker: selectedPair.base.ticker,
        expiresAt: expirationMs ? Date.now() + expirationMs : undefined,
        limitPrice,
        pairId: selectedPair.id,
        quoteAssetId,
        quoteAssetTicker: selectedPair.quote.ticker,
        side,
      })
    )

    toast.success(t('limitOrders.notifications.created', 'Limit order created'))
    onCreated?.()
  }

  const rawAssetsLookup = assetsData?.nia?.map((a: any) => ({ ...a, asset_id: a.asset_id, is_active: true, precision: a.precision || 8, ticker: a.ticker || '', name: a.name || '' })) || []
  const formatAmt = (amt: number, ast: string) => formatAssetAmountWithPrecision(amt, ast, bitcoinUnit, rawAssetsLookup)
  const getDispAst = (ast: string) => getDisplayAsset(allAssets.find(a => a.id === ast)?.ticker || ast, bitcoinUnit)

  const spendingAssetTickerForFormat = spendingAssetData?.ticker || ''
  const receivingAssetTickerForFormat = allAssets.find(a => a.id === toAsset)?.ticker || ''

  return (
    <div className="space-y-5">
      <SwapInputField
        asset={fromAsset}
        assetOptions={fromAssetOptions}
        availableAmount={spendingBalance !== undefined ? formatAmt(spendingBalance, spendingAssetTickerForFormat) : undefined}
        disabled={false}
        formatAmount={(a) => formatAmt(a, spendingAssetTickerForFormat)}
        getDisplayAsset={(a) => getDispAst(a)}
        label={t('limitOrders.form.youPay', 'You Pay')}
        maxAmount={spendingBalance}
        onAmountChange={(e) => {
          setFromAmountStr(e.target.value)
          setSelectedSize(undefined)
        }}
        onAssetChange={(val) => {
          setFromAsset(val)
          setFromAmountStr('')
          setSelectedSize(undefined)
        }}
        onSizeClick={handleSizeClick}
        selectedSize={selectedSize}
        showSizeButtons={true}
        useEnhancedSelector={true}
        value={fromAmountStr}
      />

      <div className="flex justify-center -my-3 relative z-10 pointer-events-none">
        <div className="bg-surface-elevated border border-border-default/40 p-2 rounded-full shadow-sm text-content-tertiary">
          <ArrowDown className="w-4 h-4" />
        </div>
      </div>

      <SwapInputField
        asset={toAsset}
        assetOptions={toAssetOptions}
        disabled={false}
        formatAmount={(a) => formatAmt(a, receivingAssetTickerForFormat)}
        getDisplayAsset={(a) => getDispAst(a)}
        label={t('limitOrders.form.youReceive', 'You Receive (Est)')}
        onAssetChange={(val) => setToAsset(val)}
        readOnly={true}
        useEnhancedSelector={true}
        value={estimatedReceive !== undefined && estimatedReceive > 0 ? formatAmt(estimatedReceive, receivingAssetTickerForFormat) : ''}
      />

      {/* Target Limit Price */}
      <div className="bg-surface-overlay/70 rounded-xl border border-border-default/40 hover:border-border-default/60 transition-all duration-300">
        <div className="px-4 py-2 border-b border-border-default/20 flex items-center justify-between">
          <span className="text-xs font-semibold text-content-tertiary uppercase tracking-wider">
            {t('limitOrders.form.limitPrice', 'Limit Price')}
          </span>
          {selectedPair && currentPrice !== undefined && (
            <button 
              className="text-xs text-content-tertiary font-medium hover:text-primary transition-colors flex items-center gap-1 group"
              onClick={() => setLimitPriceStr(currentPrice.toString())}
              title="Click to use market price"
              type="button"
            >
              <span>{t('limitOrders.form.marketPrice', 'Market:')}</span>
              <span className="text-content-secondary group-hover:text-primary transition-colors">
                1 {selectedPair.base.ticker} = {currentPrice} {selectedPair.quote.ticker}
              </span>
            </button>
          )}
        </div>
        <div className="px-4 py-3 pb-5 flex flex-col gap-4 relative">
          <div className="flex items-center gap-3 relative">
            <input
              className="w-full bg-surface-base/50 rounded-lg border border-border-default/30 text-white text-2xl font-semibold focus:border-primary/60 focus:ring-2 focus:ring-primary/15 placeholder:text-content-tertiary/50 h-14 hover:border-border-default/50 focus:outline-none pl-4 pr-16 transition-all duration-300"
              inputMode="decimal"
              onChange={(e) => setLimitPriceStr(e.target.value.replace(/[^\d.]/g, ''))}
              placeholder="0.00"
              type="text"
              value={limitPriceStr}
            />
            {selectedPair && (
              <span className="absolute right-7 top-1/2 -translate-y-1/2 text-content-tertiary text-sm font-semibold pointer-events-none select-none tracking-wide">
                {selectedPair.quote.ticker}
              </span>
            )}
          </div>
          
          {/* Slider for quick offset relative to market price */}
          {currentPrice !== undefined && currentPrice > 0 && (
            <div className="px-2 w-full flex flex-col gap-1.5 pt-2">
              <input
                className="w-full h-1.5 bg-surface-base rounded-lg appearance-none cursor-pointer accent-primary"
                max={currentPrice * 2}
                min={currentPrice * 0.1}
                onChange={(e) => {
                  const val = parseFloat(e.target.value)
                  // Use same precision as current price (approximately) 
                  const decimals = (currentPrice.toString().split('.')[1] || '').length
                  setLimitPriceStr(val.toFixed(Math.max(decimals, 2)))
                }}
                step={currentPrice * 0.01} // 1% steps
                type="range"
                value={limitPrice || currentPrice}
              />
              <div className="flex justify-between text-[10px] text-content-tertiary font-medium px-1">
                <span>-90%</span>
                <span>{limitPrice && currentPrice ? (limitPrice >= currentPrice ? '+' : '') + (((limitPrice / currentPrice) - 1) * 100).toFixed(1) + '%' : '0%'}</span>
                <span>+100%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {insufficientBalance && (
        <p className="mt-1 text-xs text-status-danger px-1">
          {t('limitOrders.errors.insufficientBalance', 'Insufficient balance for this order.')}
        </p>
      )}

      {/* Expiration */}
      <div className="bg-surface-overlay/70 rounded-xl border border-border-default/40 p-4 space-y-3">
        <label className="block text-xs font-semibold text-content-tertiary uppercase tracking-wider">
          {t('limitOrders.form.expiration', 'Expiration')}
        </label>
        <div className="flex flex-wrap gap-2">
          {EXPIRATION_OPTIONS.map((opt) => (
            <button
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-95 ${
                expirationMs === opt.value
                  ? 'border-primary/50 bg-primary/20 text-primary shadow-sm'
                  : 'border-border-default/30 bg-surface-base/50 text-content-tertiary hover:text-content-primary hover:border-border-default/60'
              }`}
              key={opt.label}
              onClick={() => setExpirationMs(opt.value)}
              type="button"
            >
              {opt.label === 'Never' ? t('limitOrders.form.noExpiration', 'Never') : opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
      <button
        className={`mt-4 w-full rounded-xl py-4 text-sm font-bold transition-all duration-200 shadow-sm ${
          !selectedPair || !limitPrice || limitPrice <= 0 || !fromAmount || fromAmount <= 0 || insufficientBalance
            ? 'bg-surface-elevated text-content-tertiary cursor-not-allowed border border-border-default/30'
            : side === 'buy'
              ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30'
        }`}
        disabled={!selectedPair || !limitPrice || limitPrice <= 0 || !fromAmount || fromAmount <= 0 || insufficientBalance}
        onClick={handleCreate}
        type="button"
      >
        {t('limitOrders.form.submitOrder', 'Place Limit Order')}
      </button>
    </div>
  )
}

