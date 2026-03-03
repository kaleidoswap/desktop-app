import { TrendingUp, Clock, RefreshCw } from 'lucide-react'
import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { calculateAndFormatRate } from '../../helpers/number'
import {
  mapAssetIdToTicker,
  isAssetId,
} from '../../routes/trade/market-maker/assetUtils'
import { TradingPair } from '../../slices/makerApi/makerApi.slice'
import { NiaAsset } from '../../slices/nodeApi/nodeApi.slice'

import { AssetOption } from './AssetComponents'

// Helper function to format time difference
const formatTimeDifference = (
  timestamp: number,
  t: (key: string, params?: any) => string
): string => {
  const now = Date.now()
  const diffInSeconds = Math.floor((now - timestamp) / 1000)

  if (diffInSeconds < 5) return t('trade.exchangeRate.justNow')
  if (diffInSeconds < 60)
    return t('trade.exchangeRate.secondsAgo', { seconds: diffInSeconds })
  if (diffInSeconds < 120) return t('trade.exchangeRate.oneMinuteAgo')
  if (diffInSeconds < 3600)
    return t('trade.exchangeRate.minutesAgo', {
      minutes: Math.floor(diffInSeconds / 60),
    })
  if (diffInSeconds < 7200) return t('trade.exchangeRate.oneHourAgo')
  return t('trade.exchangeRate.hoursAgo', {
    hours: Math.floor(diffInSeconds / 3600),
  })
}

// Constants for price freshness
const PRICE_FRESH_THRESHOLD = 30000 // 30 seconds

interface ExchangeRateDisplayProps {
  fromAsset: string
  toAsset: string
  price: number | null
  selectedPair: TradingPair | null
  bitcoinUnit: string
  formatAmount: (amount: number, asset: string) => string
  getAssetPrecision: (asset: string) => number
  priceUpdated: boolean
  assets?: NiaAsset[]
  lastQuoteTimestamp?: number | null
  isPriceFresh?: boolean
  onRefresh?: () => void
}

export const ExchangeRateDisplay: React.FC<ExchangeRateDisplayProps> = ({
  fromAsset,
  toAsset,
  price,
  selectedPair,
  bitcoinUnit,
  getAssetPrecision,
  priceUpdated,
  assets = [],
  lastQuoteTimestamp,
  isPriceFresh = true,
  onRefresh,
}) => {
  const { t } = useTranslation()
  // Get display tickers for assets (especially important for RGB assets)
  const fromDisplayTicker =
    isAssetId(fromAsset) && assets.length > 0
      ? mapAssetIdToTicker(fromAsset, assets)
      : fromAsset

  const toDisplayTicker =
    isAssetId(toAsset) && assets.length > 0
      ? mapAssetIdToTicker(toAsset, assets)
      : toAsset

  // Get display asset names (e.g., BTC -> SAT if bitcoin unit is SAT)
  const fromDisplayAsset =
    fromDisplayTicker === 'BTC' ? bitcoinUnit : fromDisplayTicker
  const toDisplayAsset =
    toDisplayTicker === 'BTC' ? bitcoinUnit : toDisplayTicker

  const formattedRate = calculateAndFormatRate(
    fromAsset,
    toAsset,
    price,
    selectedPair
      ? {
          ...selectedPair,
          base_asset: selectedPair.base_asset || '',
          quote_asset: selectedPair.quote_asset || '',
        }
      : null,
    bitcoinUnit,
    getAssetPrecision
  )

  return (
    <div className="flex items-center gap-2 py-1.5">
      {/* Left: timestamp + live status */}
      <div className="flex-1 flex items-center gap-2">
        <div className="flex items-center gap-1 text-xs text-content-tertiary">
          <Clock className="w-3 h-3" />
          <span>
            {lastQuoteTimestamp
              ? formatTimeDifference(lastQuoteTimestamp, t)
              : t('trade.exchangeRate.never')}
          </span>
        </div>
        <div
          className={`flex items-center gap-1 text-xs font-semibold ${
            isPriceFresh ? 'text-green-400' : 'text-amber-400'
          }`}
        >
          <div
            className={`w-2 h-2 rounded-full ${
              isPriceFresh ? 'bg-green-400' : 'bg-amber-400 animate-pulse'
            }`}
          ></div>
          <span>
            {isPriceFresh
              ? t('trade.exchangeRate.live')
              : t('trade.exchangeRate.stale')}
          </span>
        </div>
      </div>

      {/* Center: rate */}
      <div className="flex items-center gap-1.5 text-base shrink-0">
        <div className="flex items-center gap-1">
          <span className="text-white font-semibold">1</span>
          <AssetOption ticker={fromDisplayAsset} />
        </div>
        <TrendingUp className="w-3 h-3 text-green-500 shrink-0" />
        <div className="flex items-center gap-1">
          <span
            className={`text-white font-semibold transition-all duration-300 ${
              priceUpdated ? 'text-green-400' : ''
            }`}
          >
            {formattedRate}
          </span>
          <AssetOption ticker={toDisplayAsset} />
        </div>
      </div>

      {/* Right: refresh */}
      <div className="flex-1 flex items-center justify-end">
        {onRefresh && (
          <button
            className="p-1 rounded-md hover:bg-surface-high/60 text-content-tertiary hover:text-content-secondary transition-all active:scale-95"
            onClick={onRefresh}
            title={t('tradeMarketMaker.swap.refresh')}
            type="button"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  )
}

interface ExchangeRateSectionProps {
  selectedPair: TradingPair | null
  price: number | null
  isPriceLoading: boolean
  fromAsset: string
  toAsset: string
  bitcoinUnit: string
  formatAmount: (amount: number, asset: string) => string
  getAssetPrecision: (asset: string) => number
  assets?: NiaAsset[]
  onRefresh?: () => void
}

export const ExchangeRateSection: React.FC<ExchangeRateSectionProps> = ({
  selectedPair,
  price,
  isPriceLoading,
  fromAsset,
  toAsset,
  bitcoinUnit,
  formatAmount,
  getAssetPrecision,
  assets = [],
  onRefresh,
}) => {
  const { t } = useTranslation()
  const [showPriceUpdate, setShowPriceUpdate] = useState(false)
  const [prevPrice, setPrevPrice] = useState<number | null>(null)
  const [lastQuoteTimestamp, setLastQuoteTimestamp] = useState<number | null>(
    null
  )
  const [isPriceFresh, setIsPriceFresh] = useState(true)

  // Store the previous price in a ref to detect changes
  const prevPriceRef = useRef<number | null>(null)

  // Effect to detect price updates
  useEffect(() => {
    const currentPrice = price
    const prevStoredPrice = prevPriceRef.current

    // Update the ref with the current price
    prevPriceRef.current = currentPrice

    // Only trigger animation if we have a previous price and it changed
    if (
      prevPrice !== null &&
      currentPrice !== null &&
      prevPrice !== currentPrice
    ) {
      setShowPriceUpdate(true)
      setLastQuoteTimestamp(Date.now())
      setIsPriceFresh(true)

      // Reset animation after it completes
      const timer = setTimeout(() => {
        setShowPriceUpdate(false)
      }, 400) // Shorter animation duration

      return () => clearTimeout(timer)
    }

    // Check if the price changed (new quote received)
    if (
      prevStoredPrice !== null &&
      currentPrice !== null &&
      prevStoredPrice !== currentPrice
    ) {
      // If the price changed, update the timestamp
      setLastQuoteTimestamp(Date.now())
      setIsPriceFresh(true)
    }

    // Update previous price and set initial timestamp if first load
    if (currentPrice !== null) {
      setPrevPrice(currentPrice)
      if (lastQuoteTimestamp === null) {
        setLastQuoteTimestamp(Date.now())
        setIsPriceFresh(true)
      }
    }
  }, [price, prevPrice, lastQuoteTimestamp])

  // Update the formatted time difference every second and check price freshness
  useEffect(() => {
    if (lastQuoteTimestamp === null) return

    const updateFormattedTime = () => {
      // Check if price is fresh (less than threshold)
      const now = Date.now()
      const timeSinceLastUpdate = now - lastQuoteTimestamp
      setIsPriceFresh(timeSinceLastUpdate < PRICE_FRESH_THRESHOLD)
    }

    // Initial update
    updateFormattedTime()

    // Set up interval to update every second
    const intervalId = setInterval(updateFormattedTime, 1000)

    return () => clearInterval(intervalId)
  }, [lastQuoteTimestamp])

  // Don't render if no price data
  if (!selectedPair || price === null) {
    return (
      <div className="flex items-center gap-2 py-1 text-content-tertiary">
        <RefreshCw className="w-3 h-3 animate-spin" />
        <span className="text-xs">{t('trade.exchangeRate.loadingRate')}</span>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Rate Display */}
      <ExchangeRateDisplay
        assets={assets}
        bitcoinUnit={bitcoinUnit}
        formatAmount={formatAmount}
        fromAsset={fromAsset}
        getAssetPrecision={getAssetPrecision}
        isPriceFresh={isPriceFresh}
        lastQuoteTimestamp={lastQuoteTimestamp}
        onRefresh={onRefresh}
        price={price}
        priceUpdated={showPriceUpdate}
        selectedPair={selectedPair}
        toAsset={toAsset}
      />

      {/* Loading State Overlay */}
      {isPriceLoading && (
        <div className="absolute inset-0 bg-surface-base/50 backdrop-blur-sm rounded-xl flex items-center justify-center">
          <div className="flex items-center gap-3 text-content-secondary">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="font-medium">
              {t('trade.exchangeRate.updatingRate')}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
