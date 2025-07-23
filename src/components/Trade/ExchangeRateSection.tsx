import { TrendingUp, Clock, RefreshCw } from 'lucide-react'
import React, { useState, useEffect, useRef } from 'react'

import { calculateAndFormatRate } from '../../helpers/number'
import {
  mapAssetIdToTicker,
  isAssetId,
} from '../../routes/trade/market-maker/assetUtils'
import { TradingPair } from '../../slices/makerApi/makerApi.slice'
import { NiaAsset } from '../../slices/nodeApi/nodeApi.slice'

import { AssetOption } from './AssetComponents'

// Helper function to format time difference
const formatTimeDifference = (timestamp: number): string => {
  const now = Date.now()
  const diffInSeconds = Math.floor((now - timestamp) / 1000)

  if (diffInSeconds < 5) return 'just now'
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`
  if (diffInSeconds < 120) return '1m ago'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 7200) return '1h ago'
  return `${Math.floor(diffInSeconds / 3600)}h ago`
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
}) => {
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
    selectedPair,
    bitcoinUnit,
    getAssetPrecision
  )

  return (
    <div className="space-y-3">
      {/* Main Rate Display */}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-base">
          <div className="flex items-center gap-1.5">
            <span className="text-white font-bold">1</span>
            <AssetOption ticker={fromDisplayAsset} />
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-green-500" />
            <span className="text-slate-400 font-medium">=</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`text-white font-bold transition-all duration-300 ${
                priceUpdated ? 'text-green-400 scale-105' : ''
              }`}
            >
              {formattedRate}
            </span>
            <AssetOption ticker={toDisplayAsset} />
          </div>
        </div>
      </div>

      {/* Status Information */}
      <div className="flex items-center justify-between text-xs bg-slate-800/30 rounded-lg px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-slate-500" />
          <span className="text-slate-500">Updated:</span>
          <span className="text-slate-300 font-medium">
            {lastQuoteTimestamp
              ? formatTimeDifference(lastQuoteTimestamp)
              : 'Never'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <div
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border ${
              isPriceFresh
                ? 'bg-green-500/10 text-green-400 border-green-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            }`}
          >
            <div
              className={`w-1 h-1 rounded-full ${
                isPriceFresh ? 'bg-green-500' : 'bg-amber-500'
              }`}
            ></div>
            <span className="text-xs font-semibold">
              {isPriceFresh ? 'Live' : 'Stale'}
            </span>
          </div>
        </div>
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
}) => {
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
      <div className="flex items-center justify-center py-8 text-slate-400">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading exchange rate...</span>
        </div>
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
        price={price}
        priceUpdated={showPriceUpdate}
        selectedPair={selectedPair}
        toAsset={toAsset}
      />

      {/* Loading State Overlay */}
      {isPriceLoading && (
        <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm rounded-xl flex items-center justify-center">
          <div className="flex items-center gap-3 text-slate-300">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="font-medium">Updating rate...</span>
          </div>
        </div>
      )}
    </div>
  )
}
