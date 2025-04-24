import { RefreshCw } from 'lucide-react'
import React, { useCallback, useState, useEffect, useRef } from 'react'

import { SATOSHIS_PER_BTC } from '../../helpers/number'
import { SparkIcon } from '../../icons/Spark'
import { TradingPair } from '../../slices/makerApi/makerApi.slice'

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
}

export const ExchangeRateDisplay: React.FC<ExchangeRateDisplayProps> = ({
  fromAsset,
  toAsset,
  price,
  selectedPair,
  bitcoinUnit,
  getAssetPrecision,
  priceUpdated,
}) => {
  const calculateAndFormatRate = useCallback(
    (
      fromAsset: string,
      toAsset: string,
      price: number | null,
      selectedPair: { base_asset: string; quote_asset: string } | null
    ) => {
      if (!price || !selectedPair) return 'Price not available'

      let rate = price
      let displayFromAsset = fromAsset
      let displayToAsset = toAsset

      const isInverted =
        fromAsset === selectedPair.quote_asset &&
        toAsset === selectedPair.base_asset

      const precision = !isInverted
        ? getAssetPrecision(displayToAsset)
        : getAssetPrecision(displayFromAsset)

      let fromUnit = displayFromAsset === 'BTC' ? bitcoinUnit : displayFromAsset
      let toUnit = displayToAsset === 'BTC' ? bitcoinUnit : displayToAsset

      if (
        (fromUnit === 'SAT' && !isInverted) ||
        (toUnit === 'SAT' && isInverted)
      ) {
        rate = rate / SATOSHIS_PER_BTC
      }

      const formattedRate = !isInverted
        ? new Intl.NumberFormat('en-US', {
            maximumFractionDigits: precision > 4 ? precision : 4,
            minimumFractionDigits: precision,
            useGrouping: true,
          }).format(
            parseFloat(
              (rate / Math.pow(10, precision)).toFixed(
                precision > 4 ? precision : 4
              )
            )
          )
        : new Intl.NumberFormat('en-US', {
            maximumFractionDigits: precision > 4 ? precision : 4,
            minimumFractionDigits: precision,
            useGrouping: true,
          }).format(
            parseFloat(
              (Math.pow(10, precision) / rate).toFixed(
                precision > 4 ? precision : 4
              )
            )
          )

      return (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-white font-medium">1</span>
            <AssetOption ticker={fromUnit} />
          </div>
          <span className="text-slate-400">=</span>
          <div className="flex items-center gap-1.5">
            <span
              className={`text-white font-medium ${priceUpdated ? 'text-update-flash' : ''}`}
            >
              {formattedRate}
            </span>
            <AssetOption ticker={toUnit} />
          </div>
        </div>
      )
    },
    [bitcoinUnit, getAssetPrecision, priceUpdated]
  )

  const displayRate = calculateAndFormatRate(
    fromAsset,
    toAsset,
    price,
    selectedPair
  )

  return <div className="flex-1 text-base">{displayRate}</div>
}

interface ExchangeRateSectionProps {
  selectedPair: TradingPair | null
  selectedPairFeed: any
  isPriceLoading: boolean
  fromAsset: string
  toAsset: string
  bitcoinUnit: string
  formatAmount: (amount: number, asset: string) => string
  getAssetPrecision: (asset: string) => number
  onReconnect?: () => void
}

export const ExchangeRateSection: React.FC<ExchangeRateSectionProps> = ({
  selectedPair,
  selectedPairFeed,
  isPriceLoading,
  fromAsset,
  toAsset,
  bitcoinUnit,
  formatAmount,
  getAssetPrecision,
  onReconnect,
}) => {
  const [showPriceUpdate, setShowPriceUpdate] = useState(false)
  const [prevPrice, setPrevPrice] = useState<number | null>(null)
  const [lastQuoteTimestamp, setLastQuoteTimestamp] = useState<number | null>(
    null
  )
  const [showTimestampOverlay, setShowTimestampOverlay] = useState(false)
  const [formattedTimeDiff, setFormattedTimeDiff] = useState<string>('')
  const [isPriceFresh, setIsPriceFresh] = useState(true)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const autoReconnectTimeoutRef = useRef<number | null>(null)

  // Store the previous selectedPairFeed in a ref to detect changes
  const prevSelectedPairFeedRef = useRef<any>(null)

  // Effect to detect price updates
  useEffect(() => {
    const currentPrice = selectedPairFeed?.price
    const currentFeed = selectedPairFeed
    const prevFeed = prevSelectedPairFeedRef.current

    // Update the ref with the current feed
    prevSelectedPairFeedRef.current = currentFeed

    // Only trigger animation if we have a previous price and it changed
    if (
      prevPrice !== null &&
      currentPrice !== null &&
      prevPrice !== currentPrice
    ) {
      setShowPriceUpdate(true)
      setLastQuoteTimestamp(Date.now())
      setIsPriceFresh(true)
      setIsReconnecting(false)

      // Reset animation after it completes
      const timer = setTimeout(() => {
        setShowPriceUpdate(false)
      }, 400) // Shorter animation duration

      return () => clearTimeout(timer)
    }

    // Check if the feed object itself changed (new quote received)
    if (prevFeed && currentFeed && prevFeed !== currentFeed) {
      // If the feed object changed but the price didn't, we still want to update the timestamp
      if (prevFeed.price === currentFeed.price) {
        setLastQuoteTimestamp(Date.now())
        setIsPriceFresh(true)
        setIsReconnecting(false)
      }
    }

    // Update previous price and set initial timestamp if first load
    if (currentPrice !== null) {
      setPrevPrice(currentPrice)
      if (lastQuoteTimestamp === null) {
        setLastQuoteTimestamp(Date.now())
        setIsPriceFresh(true)
      }
    }
  }, [selectedPairFeed, prevPrice, lastQuoteTimestamp])

  // Auto-reconnect logic when price gets stale
  useEffect(() => {
    if (
      !isPriceFresh &&
      !isReconnecting &&
      onReconnect &&
      autoReconnectTimeoutRef.current === null
    ) {
      // Wait for 10 seconds before attempting an automatic reconnection
      autoReconnectTimeoutRef.current = setTimeout(() => {
        handleReconnect()
        autoReconnectTimeoutRef.current = null
      }, 10000)
    }

    return () => {
      if (autoReconnectTimeoutRef.current) {
        clearTimeout(autoReconnectTimeoutRef.current)
        autoReconnectTimeoutRef.current = null
      }
    }
  }, [isPriceFresh, isReconnecting, onReconnect])

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

  const handleReconnect = () => {
    if (onReconnect && !isReconnecting) {
      setIsReconnecting(true)
      onReconnect()

      // Reset reconnecting state after a timeout if it doesn't succeed
      setTimeout(() => {
        if (!isPriceFresh) {
          setIsReconnecting(false)
        }
      }, 5000)
    }
  }

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

            {/* Refresh button when price is not fresh */}
            {!isPriceFresh && onReconnect && (
              <button
                className="ml-2 p-1 rounded-full bg-slate-700 hover:bg-slate-600 transition-colors"
                disabled={isReconnecting}
                onClick={handleReconnect}
                title="Reconnect to price feed"
              >
                <RefreshCw
                  className={`w-3 h-3 text-white ${isReconnecting ? 'animate-spin' : ''}`}
                />
              </button>
            )}
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
                bitcoinUnit={bitcoinUnit}
                formatAmount={formatAmount}
                fromAsset={fromAsset}
                getAssetPrecision={getAssetPrecision}
                price={selectedPairFeed ? selectedPairFeed.price : null}
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
