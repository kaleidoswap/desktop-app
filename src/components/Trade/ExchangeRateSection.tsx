import React, { useState, useEffect, useRef } from 'react'

import { calculateAndFormatRate } from '../../helpers/number'
import { SparkIcon } from '../../icons/Spark'
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
  if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`
  if (diffInSeconds < 120) return '1 minute ago'
  if (diffInSeconds < 3600)
    return `${Math.floor(diffInSeconds / 60)} minutes ago`
  if (diffInSeconds < 7200) return '1 hour ago'
  return `${Math.floor(diffInSeconds / 3600)} hours ago`
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

  const displayRate = (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        <span className="text-white font-medium">1</span>
        <AssetOption ticker={fromDisplayAsset} />
      </div>
      <span className="text-slate-400">=</span>
      <div className="flex items-center gap-1.5">
        <span
          className={`text-white font-medium ${priceUpdated ? 'text-update-flash' : ''}`}
        >
          {calculateAndFormatRate(
            fromAsset,
            toAsset,
            price,
            selectedPair,
            bitcoinUnit,
            getAssetPrecision
          )}
        </span>
        <AssetOption ticker={toDisplayAsset} />
      </div>
    </div>
  )

  return <div className="flex-1 text-base">{displayRate}</div>
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
  const [showTimestampOverlay, setShowTimestampOverlay] = useState(false)
  const [formattedTimeDiff, setFormattedTimeDiff] = useState<string>('')
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
      setFormattedTimeDiff(formatTimeDifference(lastQuoteTimestamp))

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

  if (!selectedPair) return null

  return (
    <div className="exchange-rate-section relative">
      <div className="text-center text-xs text-slate-400 flex items-center justify-center gap-1 mb-1">
        <div className="w-1 h-1 rounded-full bg-emerald-500" />
        Best Exchange Rate Available
      </div>
      <div className="bg-slate-800/50 rounded-lg p-2 space-y-1.5">
        <div className="flex justify-between items-center text-xs text-slate-400">
          <span>Exchange Rate</span>
          <div className="flex items-center gap-1 relative">
            {/* Status indicator dot */}
            <div
              className="relative"
              onMouseEnter={() => setShowTimestampOverlay(true)}
              onMouseLeave={() => setShowTimestampOverlay(false)}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${isPriceFresh ? 'bg-emerald-500/50 animate-pulse' : 'bg-red-500/50'}`}
              />

              {/* Timestamp Tooltip */}
              {showTimestampOverlay && lastQuoteTimestamp && (
                <div className="absolute right-0 top-5 z-10 w-48 bg-slate-900 border border-slate-700 rounded-md shadow-lg p-2 text-left">
                  <div className="text-white text-xs font-medium">
                    Last Quote Received
                  </div>
                  <div
                    className={`text-xs ${isPriceFresh ? 'text-emerald-400' : 'text-red-400'}`}
                  >
                    {formattedTimeDiff}
                  </div>
                  {lastQuoteTimestamp && (
                    <div className="text-xs text-slate-400 mt-0.5">
                      {new Date(lastQuoteTimestamp).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              )}
            </div>

            <span>{isPriceFresh ? 'Live Price' : 'Price Not Updated'}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          {isPriceLoading ? (
            <div
              className="flex-1 px-3 py-1.5 bg-slate-900/50 rounded-lg border border-slate-700 
                         text-slate-400 min-h-[32px] flex items-center text-sm"
            >
              Loading exchange rate...
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-between">
              <ExchangeRateDisplay
                assets={assets}
                bitcoinUnit={bitcoinUnit}
                formatAmount={formatAmount}
                fromAsset={fromAsset}
                getAssetPrecision={getAssetPrecision}
                price={price}
                priceUpdated={showPriceUpdate}
                selectedPair={selectedPair}
                toAsset={toAsset}
              />
              <div className="flex items-center gap-2">
                <SparkIcon color="#fff" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
