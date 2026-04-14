import { Wallet, Link, Plus, ShoppingCart } from 'lucide-react'
import type { ChangeEvent } from 'react'
import { useCallback, useEffect, useState, useMemo, useRef } from 'react'
import { useForm, SubmitHandler } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

import { getKaleidoClient } from '../../../api/client'
import { webSocketService } from '../../../app/hubs/websocketService'
import { CREATE_NEW_CHANNEL_PATH } from '../../../app/router/paths'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks'
import { useSettings } from '../../../hooks/useSettings'
import { BuyChannelModal } from '../../../components/BuyChannelModal'
import { SwapConfirmation } from '../../../components/SwapConfirmation'
import { SwapRecap } from '../../../components/SwapRecap'
import {
  NoTradingChannelsMessage,
  createTradingChannelsMessageProps,
  WebSocketDisconnectedMessage,
} from '../../../components/Trade'
import {
  MIN_CHANNEL_CAPACITY,
  MSATS_PER_SAT,
  RGB_HTLC_MIN_SAT,
} from '../../../constants'
import {
  getAssetPrecision,
  formatAssetAmountWithPrecision,
  parseAssetAmountWithPrecision,
  getDisplayAsset,
  satToMsat,
} from '../../../helpers/number'
import { makerApi, TradingPair } from '../../../slices/makerApi/makerApi.slice'
import {
  setTradingPairs,
  clearQuoteError,
} from '../../../slices/makerApi/pairs.slice'
import { nodeApi } from '../../../slices/nodeApi/nodeApi.slice'
import type { AssetNIA as NiaAsset, Channel } from 'kaleido-sdk/rln'

import { uiSliceActions } from '../../../slices/ui/ui.slice'
import { logger } from '../../../utils/logger'

// Import channel utilities
import {
  createSizeClickHandler,
  createRefreshAmountsHandler,
} from './amountUtils'
import {
  createAssetChangeHandler,
  createSwapAssetsHandler,
  createFetchAndSetPairsHandler,
  mapAssetIdToTicker,
  mapTickerToAssetId,
  isAssetId,
} from './assetUtils'
import {
  hasTradableChannels,
  getTradableChannels,
  hasOnlyUnconfirmedChannelsForAsset,
  getAssetChannelStatus,
} from './channelUtils'

// Import our utility modules
import { getValidationError, getValidationWarning } from './errorMessages'
import {
  createFromAmountChangeHandler,
  createToAmountChangeHandler,
} from './formUtils'
import {
  createQuoteRequestHandler,
  createReverseQuoteRequestHandler,
  startQuoteRequestTimer,
  stopQuoteRequestTimer,
  createAmountChangeQuoteHandler,
  createToAmountChangeQuoteHandler,
  debouncedQuoteRequest,
  clearDebouncedQuoteRequest,
} from './quoteUtils'
import {
  createSwapExecutor,
  copyToClipboard as copyToClipboardUtil,
  SwapDetails as SwapDetailsType,
} from './swapUtils'
import { MarketMakerFormPanel } from './components/MarketMakerFormPanel'
import { Fields } from './types'
import { initializeWebSocketWithRetry } from './websocketUtils'

export const Component = () => {
  // Add translation hook
  const { t } = useTranslation()

  // Declare makerConnectionUrl at the very top
  const makerConnectionUrl = useAppSelector(
    (state) => state.nodeSettings.data.default_maker_url
  )

  // Loading states optimization - replace multiple loading states with simplified approach
  const [loadingPhase, setLoadingPhase] = useState<
    | 'validating-balance'
    | 'initializing'
    | 'validating-channels'
    | 'connecting-maker'
    | 'ready'
    | 'error'
  >('initializing')
  const [validationError, setValidationError] = useState<string | null>(null)

  // Component initialization logging
  useEffect(() => {
    logger.info('🏁 Market Maker component mounted', {
      makerUrl: makerConnectionUrl || 'Not configured',
      timestamp: new Date().toISOString(),
    })

    return () => {
      logger.info('🔚 Market Maker component unmounting')
    }
  }, [])

  // Track loading phase changes
  useEffect(() => {
    logger.info(`🔄 Loading phase changed: ${loadingPhase}`, {
      previousPhase: 'transition',
      timestamp: new Date().toISOString(),
      validationError: validationError,
    })
  }, [loadingPhase, validationError])

  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const form = useForm<Fields>({
    defaultValues: {
      from: '',
      fromAsset: 'BTC',
      rfq_id: '',
      to: '',
      toAsset: '',
    },
  })

  const [channels, setChannels] = useState<Channel[]>([])
  const [assets, setAssets] = useState<NiaAsset[]>([])
  const [tradablePairs, setTradablePairs] = useState<TradingPair[]>([])
  const [selectedPair, setSelectedPair] = useState<TradingPair | null>(null)
  const [pubKey, setPubKey] = useState('')
  const [selectedSize, setSelectedSize] = useState<number | undefined>(
    undefined
  )
  const [hasEnoughBalance, setHasEnoughBalance] = useState(true)

  const [minFromAmount, setMinFromAmount] = useState(0)
  const [maxFromAmount, setMaxFromAmount] = useState(0)
  const [maxToAmount, setMaxToAmount] = useState(0)
  const [max_outbound_htlc_sat, setMaxOutboundHtlcSat] = useState(0)

  const [isToAmountLoading, setIsToAmountLoading] = useState(true)
  const [isFromAmountLoading, setIsFromAmountLoading] = useState(false)
  const [isPriceLoading, setIsPriceLoading] = useState(true)
  const [isQuoteLoading, setIsQuoteLoading] = useState(false)
  const lastQuoteDirectionRef = useRef<'from' | 'to'>('from')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [warningMessage, setWarningMessage] = useState<string | null>(null)
  const [fees, setFees] = useState({
    baseFee: 0,
    feeRate: 0,
    totalFee: 0,
    variableFee: 0,
  })

  // Store precision from quote for assets not in our list
  const [quoteAssetPrecision, setQuoteAssetPrecision] = useState<{
    [assetId: string]: number
  }>({})

  const [isLoading, setIsLoading] = useState(true)
  const [isInitialDataLoaded, setIsInitialDataLoaded] = useState(false)
  const [isPairsLoading, setIsPairsLoading] = useState(true)
  const [isChannelsLoaded, setIsChannelsLoaded] = useState(false)
  const [isAssetsLoaded, setIsAssetsLoaded] = useState(false)
  const [hasValidChannelsForTrading] = useState(false)
  const [isWebSocketInitialized, setIsWebSocketInitialized] = useState(false)
  const [debouncedFromAmount, setDebouncedFromAmount] = useState('')

  // Removed unused state variables

  // Add connection timeout state variables
  const [connectionTimeout, setConnectionTimeout] = useState(false)
  const [connectionTimeoutTimer, setConnectionTimeoutTimer] = useState<
    number | null
  >(null)
  const [connectionStartTime, setConnectionStartTime] = useState<number | null>(
    null
  )

  // Add compatibility checking state variables (removed unused state)

  const [showRecap, setShowRecap] = useState<boolean>(false)
  const [swapRecapDetails, setSwapRecapDetails] =
    useState<SwapDetailsType | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [showBuyChannelModal, setShowBuyChannelModal] = useState(false)

  // Add state for quote validity tracking
  const [hasValidQuote, setHasValidQuote] = useState(false)
  const [quoteExpiresAt, setQuoteExpiresAt] = useState<number | null>(null)

  // Track which asset needs a channel
  const [missingChannelAsset, setMissingChannelAsset] = useState<{
    asset: string
    assetId: string
    isFromAsset: boolean
  } | null>(null)

  // Store BTC balance for use when no channels exist
  const [onchainBtcBalance, setOnchainBtcBalance] = useState(0)

  // Store LSP channel order limits
  const [lspChannelLimits, setLspChannelLimits] = useState<{
    min_initial_client_balance_sat: number
    max_initial_client_balance_sat: number
    min_channel_balance_sat: number
    max_channel_balance_sat: number
  } | null>(null)

  // Track if user is trading without channels (using onchain balance)
  const [isUsingOnchainBalance, setIsUsingOnchainBalance] = useState(false)

  // Component mount state management
  const isMountedRef = useRef(false)
  const initializationRef = useRef(false)
  const lastSuccessfulConnectionRef = useRef(0)
  const errorMessageTimeoutRef = useRef<number | null>(null)

  const isInitializingRef = useRef(false)
  const setupRunningRef = useRef(false)

  // Fetch list of swaps and poll for updates
  // Fetch list of swaps and poll for updates
  const { data: swapsData } = nodeApi.useListSwapsQuery(undefined, {
    pollingInterval: 5000, // Poll every 5 seconds
    refetchOnMountOrArgChange: true,
  })

  // Derive isSwapInProgress from swapsData
  const isSwapInProgress = useMemo(() => {
    if (!swapsData) return false
    const { maker, taker } = swapsData
    const pendingOrWaitingMaker = (maker || []).some(
      (swap: any) => swap.status === 'Pending' || swap.status === 'Waiting'
    )
    const pendingOrWaitingTaker = (taker || []).some(
      (swap: any) => swap.status === 'Pending' || swap.status === 'Waiting'
    )
    return pendingOrWaitingMaker || pendingOrWaitingTaker
  }, [swapsData])

  // Track successful swaps and show toast notifications
  const previousSwapsRef = useRef<typeof swapsData>()

  // Track last reconnection attempt to prevent rapid reconnections
  const lastReconnectAttemptRef = useRef(0)

  // Connection timeout utilities (simplified for new approach)
  const clearConnectionTimeout = useCallback(() => {
    if (connectionTimeoutTimer) {
      clearTimeout(connectionTimeoutTimer)
      setConnectionTimeoutTimer(null)
      logger.debug('Cleared connection timeout')
    }
    setConnectionTimeout(false)
    setConnectionStartTime(null)
  }, [connectionTimeoutTimer])

  useEffect(() => {
    if (!swapsData) {
      previousSwapsRef.current = swapsData
      return
    }

    const prevSwaps = previousSwapsRef.current
    if (!prevSwaps) {
      previousSwapsRef.current = swapsData
      return
    }

    const currentSwaps = swapsData

    // Check for newly succeeded swaps in both maker and taker arrays
    const checkForSuccessfulSwaps = (
      prevSwapArray: any[],
      currentSwapArray: any[],
      swapType: 'maker' | 'taker'
    ) => {
      currentSwapArray.forEach((currentSwap) => {
        const prevSwap = prevSwapArray.find(
          (swap) => swap.payment_hash === currentSwap.payment_hash
        )

        // Check if swap status changed to succeeded
        if (
          prevSwap &&
          prevSwap.status !== 'Succeeded' &&
          currentSwap.status === 'Succeeded'
        ) {
          // Resolve asset IDs to tickers using the comprehensive mapper
          const fromTicker = currentSwap.from_asset
            ? mapAssetIdToTicker(currentSwap.from_asset, assets, tradablePairs)
            : 'BTC'
          const toTicker = currentSwap.to_asset
            ? mapAssetIdToTicker(currentSwap.to_asset, assets, tradablePairs)
            : 'BTC'

          let message = t('tradeMarketMaker.toast.swapCompleted')

          // Add asset details if available
          if (currentSwap.qty_from && currentSwap.qty_to) {
            // BTC amounts in the Swap schema are in millisats; convert to sats
            const fromAmountRaw =
              fromTicker === 'BTC'
                ? Math.round(currentSwap.qty_from / MSATS_PER_SAT)
                : currentSwap.qty_from
            const toAmountRaw =
              toTicker === 'BTC'
                ? Math.round(currentSwap.qty_to / MSATS_PER_SAT)
                : currentSwap.qty_to

            const displayFromAmount = formatAmount(fromAmountRaw, fromTicker)
            const displayToAmount = formatAmount(toAmountRaw, toTicker)
            const displayFromAsset = displayAsset(fromTicker)
            const displayToAsset = displayAsset(toTicker)

            message += ` - ${displayFromAmount} ${displayFromAsset} → ${displayToAmount} ${displayToAsset}`
          }

          message += ` (${currentSwap.payment_hash.slice(0, 8)}...)`

          // Show success toast
          toast.success(message, {
            autoClose: 5000,
            closeOnClick: true,
            draggable: true,
            hideProgressBar: false,
            pauseOnHover: true,
            position: 'top-right',
          })

          logger.info(
            `Swap ${currentSwap.payment_hash} completed successfully as ${swapType}`
          )

          // Refresh min/max/available amounts after successful swap
          refreshChannelsAndAmounts()
        }
      })
    }

    // Check both maker and taker swaps
    checkForSuccessfulSwaps(
      prevSwaps.maker || [],
      currentSwaps.maker || [],
      'maker'
    )
    checkForSuccessfulSwaps(
      prevSwaps.taker || [],
      currentSwaps.taker || [],
      'taker'
    )

    // Update the ref with current data
    previousSwapsRef.current = swapsData
  }, [swapsData, assets, tradablePairs])

  // minLoadingDone effect is already declared earlier in the component

  const wsConnected = useAppSelector((state) => state.pairs.wsConnected)
  const quoteError = useAppSelector((state) => state.pairs.quoteError)
  const { bitcoinUnit } = useSettings()

  // Define parseAssetAmount early to avoid initialization error in quoteResponse
  const parseAssetAmount = useCallback(
    (amount: string | undefined | null, asset: string): number => {
      return parseAssetAmountWithPrecision(amount, asset, bitcoinUnit, assets)
    },
    [bitcoinUnit, assets]
  )

  // Replace selectedPairFeed with direct price tracking
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)

  // Create a ref to track the quote response
  const lastQuoteResponseRef = useRef<any>(null)
  const lastReverseQuoteRef = useRef<any>(null)
  const [quoteResponseTimestamp, setQuoteResponseTimestamp] = useState(0)

  // Update quote request handler with loading state setters
  const requestQuote = useMemo(
    () =>
      createQuoteRequestHandler(
        form,
        parseAssetAmount,
        assets,
        tradablePairs,
        setIsQuoteLoading,
        setIsToAmountLoading,
        () => hasValidQuote,
        maxFromAmount,
        minFromAmount,
        t
      ),
    [
      form,
      parseAssetAmount,
      assets,
      tradablePairs,
      hasValidQuote,
      maxFromAmount,
      minFromAmount,
      t,
    ]
  )

  // Reverse quote request handler (for setting to_amount to get from_amount)
  const requestReverseQuote = useMemo(
    () =>
      createReverseQuoteRequestHandler(
        form,
        parseAssetAmount,
        assets,
        tradablePairs,
        setIsQuoteLoading,
        setIsFromAmountLoading,
        () => hasValidQuote,
        maxToAmount,
        t
      ),
    [
      form,
      parseAssetAmount,
      assets,
      tradablePairs,
      hasValidQuote,
      maxToAmount,
      t,
    ]
  )

  // Replace the quoteResponse selector with a simpler version that only uses the latest quote
  const quoteResponse = useAppSelector((state) => {
    const fromAsset = form.getValues().fromAsset
    const toAsset = form.getValues().toAsset
    let fromAmount = parseAssetAmount(form.getValues().from, fromAsset)

    // Ensure key matches storage: use msats for BTC
    if (fromAsset === 'BTC') {
      fromAmount = satToMsat(fromAmount)
    }

    // Don't try to look up quotes if assets aren't set
    if (!fromAsset || !toAsset || fromAmount <= 0) {
      return null
    }

    // Use tickers for lookup to match how quotes are stored in pairs.slice.ts
    // The updateQuote action uses: `${quote.from_asset.ticker}/${quote.to_asset.ticker}/${quote.from_asset.amount}`
    const key = `${fromAsset}/${toAsset}/${fromAmount}`
    return state.pairs.quotes[key] || null
  })

  // Update the quote response effect to handle connection errors
  useEffect(() => {
    if (!quoteResponse) {
      // Quote was cleared or not found
      try {
        window.requestAnimationFrame(() => {
          form.setValue('to', '')
          form.setValue('rfq_id', '')
          setHasValidQuote(false)
          setQuoteExpiresAt(null)
          setIsToAmountLoading(false)
          setIsPriceLoading(false)
          setIsQuoteLoading(false)

          // Only show connection error if:
          // 1. We're connected to WebSocket
          // 2. There's a 'from' amount entered
          // 3. We're not currently in any loading state
          // 4. There's no existing error message (to avoid overwriting validation errors)
          const fromAmount = form.getValues().from
          const hasFromAmount = fromAmount && fromAmount !== '0'

          if (
            wsConnected &&
            hasFromAmount &&
            !isToAmountLoading &&
            !isPriceLoading &&
            !errorMessage
          ) {
            // Clear any existing error timeout
            if (errorMessageTimeoutRef.current) {
              clearTimeout(errorMessageTimeoutRef.current)
              errorMessageTimeoutRef.current = null
            }

            // Add a small delay to avoid showing error during rapid quote requests
            errorMessageTimeoutRef.current = window.setTimeout(() => {
              // Double-check conditions haven't changed during the timeout
              if (
                wsConnected &&
                !isToAmountLoading &&
                !isPriceLoading &&
                !hasValidQuote
              ) {
                // Preserve unconfirmed channel errors - they take priority
                setErrorMessage((prev) => {
                  if (prev && prev.includes('awaiting confirmation')) {
                    return prev
                  }
                  return t('tradeMarketMaker.error.unableToGetQuote')
                })
              }
              errorMessageTimeoutRef.current = null
            }, 1000) // 1 second delay to allow for quote processing
          }
        })
      } catch (error) {
        logger.error('Error clearing quote response UI state:', error)
      }
      return
    }

    // Check if this is a new quote that's different from the last one
    const isNewQuote =
      !lastQuoteResponseRef.current ||
      quoteResponse.to_asset.amount !==
        lastQuoteResponseRef.current.to_asset.amount ||
      quoteResponse.timestamp !== lastQuoteResponseRef.current.timestamp

    if (isNewQuote) {
      lastQuoteResponseRef.current = quoteResponse

      // Clear any pending error message timeout since we got a quote
      if (errorMessageTimeoutRef.current) {
        clearTimeout(errorMessageTimeoutRef.current)
        errorMessageTimeoutRef.current = null
      }

      // Use requestAnimationFrame to batch updates and prevent render loops
      window.requestAnimationFrame(() => {
        const now = Date.now()
        const quoteTimestamp = quoteResponse.timestamp * 1000 // Convert to ms
        const quoteAge = now - quoteTimestamp

        // Only use quotes that are less than 30 seconds old
        if (quoteAge > 30000) {
          logger.warn('Received stale quote, requesting fresh quote')
          setHasValidQuote(false)
          setQuoteExpiresAt(null)
          form.setValue('to', '')
          form.setValue('rfq_id', '')
          // Request a fresh quote
          debouncedQuoteRequest(requestQuote)
          return
        }

        setQuoteResponseTimestamp(now)
        setIsToAmountLoading(false)
        setIsPriceLoading(false)
        setIsQuoteLoading(false)

        // Update the price from the quote
        if (quoteResponse.price) {
          setCurrentPrice(quoteResponse.price)
        }

        // Update the fees and store precision for the to_asset
        if (quoteResponse.fee) {
          setFees({
            baseFee: quoteResponse.fee.base_fee,
            feeRate: quoteResponse.fee.fee_rate,
            totalFee: quoteResponse.fee.final_fee,
            variableFee: quoteResponse.fee.variable_fee,
          })

          // Store the precision for the to_asset if provided
          // This is crucial for assets not in our listAssets
          if (
            quoteResponse.fee.fee_asset_precision !== undefined &&
            quoteResponse.to_asset
          ) {
            // Store precision by ticker for display
            setQuoteAssetPrecision((prev) => ({
              ...prev,
              [quoteResponse.to_asset.ticker]:
                quoteResponse.fee.fee_asset_precision,
            }))
            logger.debug(
              `Stored precision ${quoteResponse.fee.fee_asset_precision} for asset ${quoteResponse.to_asset.ticker}`
            )
          }
        }

        // Update quote validity tracking
        setHasValidQuote(true)
        setQuoteExpiresAt(quoteResponse.expires_at || null)

        // Format and update the 'to' field with the received amount
        const toTickerForUI = quoteResponse.to_asset.ticker

        // If to_asset is BTC, convert from millisats to sats
        let displayToAmount = quoteResponse.to_asset.amount
        if (
          quoteResponse.to_asset.ticker === 'BTC' ||
          toTickerForUI === 'BTC'
        ) {
          displayToAmount = Math.round(displayToAmount / MSATS_PER_SAT)
        }

        // Format the amount using precision from quote if available
        // This is crucial for assets not in our listAssets
        let formattedToAmount: string
        if (
          quoteResponse.fee?.fee_asset_precision !== undefined &&
          quoteResponse.to_asset.ticker !== 'BTC' &&
          toTickerForUI !== 'BTC'
        ) {
          // Use precision directly from quote for non-BTC assets
          const precision = quoteResponse.fee.fee_asset_precision
          const divisor = Math.pow(10, precision)
          const formattedAmount = (displayToAmount / divisor).toFixed(precision)
          formattedToAmount = new Intl.NumberFormat('en-US', {
            maximumFractionDigits: precision,
            minimumFractionDigits: precision,
            useGrouping: true,
          }).format(parseFloat(formattedAmount))
          logger.debug(
            `Formatted to_amount using quote precision ${precision}: ${displayToAmount} -> ${formattedToAmount}`
          )
        } else {
          // Fall back to standard formatting for BTC or when precision not in quote
          formattedToAmount = formatAmount(displayToAmount, toTickerForUI)
        }

        form.setValue('to', formattedToAmount)

        // Important: Save the RFQ ID and asset IDs from the quote to use when executing the swap
        if (quoteResponse.rfq_id) {
          form.setValue('rfq_id', quoteResponse.rfq_id)
        }

        // Store the asset_id (protocol IDs) for validation
        if (quoteResponse.from_asset?.asset_id) {
          form.setValue('fromAssetId', quoteResponse.from_asset.asset_id)
        }
        if (quoteResponse.to_asset?.asset_id) {
          form.setValue('toAssetId', quoteResponse.to_asset.asset_id)
        }

        // Clear any validation errors if we got a valid quote, but not unconfirmed channel errors
        setErrorMessage((prev) => {
          if (prev && prev.includes('awaiting confirmation')) {
            return prev // Keep the unconfirmed channel error
          }
          return null // Clear other errors
        })
      })
    }
  }, [quoteResponse, form, assets, requestQuote])

  // Update quote validity every second with extended grace period
  useEffect(() => {
    if (!quoteExpiresAt) {
      setHasValidQuote(false)
      return
    }

    const checkValidity = () => {
      const now = Date.now()
      const expiresAtMs = quoteExpiresAt * 1000 // Convert to ms if in seconds
      const isExpired = now >= expiresAtMs
      setHasValidQuote(!isExpired)
    }

    // Check immediately
    checkValidity()

    // Then set up an interval
    const interval = setInterval(checkValidity, 1000)
    return () => clearInterval(interval)
  }, [quoteExpiresAt, quoteResponseTimestamp, isQuoteLoading])

  const [listChannels] = nodeApi.endpoints.listChannels.useLazyQuery()
  const [nodeInfo] = nodeApi.endpoints.nodeInfo.useLazyQuery()
  const [whitelistTrade] = nodeApi.useWhitelistTradeMutation()
  // const [getPairs] = makerApi.useLazyGetPairsQuery()
  const [initSwap] = makerApi.endpoints.initSwap.useLazyQuery()
  const [execSwap] = makerApi.endpoints.execSwap.useLazyQuery()
  const [btcBalance] = nodeApi.endpoints.btcBalance.useLazyQuery()
  const [getInfo] = makerApi.endpoints.get_info.useLazyQuery()

  // Function to get SDK client for maker API calls
  const state = useAppSelector((state) => state)
  const getClient = useCallback(async () => {
    return await getKaleidoClient(state)
  }, [state])

  const { data: assetsData } = nodeApi.endpoints.listAssets.useQuery(
    undefined,
    {
      pollingInterval: 30000,
      refetchOnFocus: false,
      refetchOnMountOrArgChange: true,
      refetchOnReconnect: false,
    }
  )

  useEffect(() => {
    if (assetsData && assetsData.nia) {
      // Set assets immediately and mark as loaded
      setAssets(
        assetsData.nia.map((a: any) => ({
          ...a,
          is_active: true,
          media: a.media
            ? ({
                digest: '',
                file_path: a.media.file_path ?? '',
                mime: a.media.mime ?? '',
              } as any)
            : undefined,
          name: a.name ?? '',
          precision: a.precision ?? 8,
          ticker: a.ticker ?? '',
        }))
      )
      setIsAssetsLoaded(true)
    } else if (assetsData === undefined) {
      // Reset loading state if assets data becomes unavailable
      setIsAssetsLoaded(false)
    }
  }, [assetsData])

  const getAssetPrecisionWrapper = useCallback(
    (asset: string): number => {
      // First check if we have precision from a quote for this asset
      // This handles assets not in our listAssets
      const assetId = mapTickerToAssetId(asset, tradablePairs)
      if (assetId && quoteAssetPrecision[assetId] !== undefined) {
        return quoteAssetPrecision[assetId]
      }
      // Fall back to the standard precision lookup
      return getAssetPrecision(asset, bitcoinUnit, assets)
    },
    [assets, bitcoinUnit, quoteAssetPrecision, tradablePairs]
  )

  // Display asset handler that shows tickers instead of asset IDs
  const displayAsset = useCallback(
    (asset: string) => {
      // First map asset ID to ticker if needed
      const assetForDisplay = isAssetId(asset)
        ? mapAssetIdToTicker(asset, assets, tradablePairs)
        : asset

      // Then apply Bitcoin unit conversion if needed
      return getDisplayAsset(assetForDisplay, bitcoinUnit)
    },
    [bitcoinUnit, assets, tradablePairs]
  )

  const isPairInverted = useCallback(
    (fromAsset: string, toAsset: string) => {
      if (!selectedPair) return false
      return (
        selectedPair.quote_asset === fromAsset &&
        selectedPair.base_asset === toAsset
      )
    },
    [selectedPair]
  )

  // Update formatAmount callback to ensure comma thousand separators
  const formatAmount = useCallback(
    (amount: number, asset: string) => {
      return formatAssetAmountWithPrecision(amount, asset, bitcoinUnit, assets)
    },
    [assets, bitcoinUnit]
  )

  // Reverse quote listener — receives quote responses via custom event (no Redux subscription overhead)
  useEffect(() => {
    const handler = (e: Event) => {
      if (lastQuoteDirectionRef.current !== 'to') return
      const quote = (e as CustomEvent).detail

      const fromAsset = form.getValues().fromAsset
      const toAsset = form.getValues().toAsset
      if (
        !fromAsset ||
        !toAsset ||
        quote.from_asset?.ticker !== fromAsset ||
        quote.to_asset?.ticker !== toAsset
      )
        return

      if (
        lastReverseQuoteRef.current &&
        quote.timestamp === lastReverseQuoteRef.current.timestamp
      )
        return

      lastReverseQuoteRef.current = quote

      const fromTickerForUI = quote.from_asset.ticker
      let displayFromAmount = quote.from_asset.amount
      if (fromTickerForUI === 'BTC') {
        displayFromAmount = Math.round(displayFromAmount / MSATS_PER_SAT)
      }
      const formattedFromAmount = formatAmount(
        displayFromAmount,
        fromTickerForUI
      )
      form.setValue('from', formattedFromAmount)
      setDebouncedFromAmount(formattedFromAmount)
      setIsFromAmountLoading(false)
      setIsQuoteLoading(false)

      setHasValidQuote(true)
      setQuoteExpiresAt(quote.expires_at || null)

      if (quote.price) {
        setCurrentPrice(quote.price)
      }
      if (quote.rfq_id) {
        form.setValue('rfq_id', quote.rfq_id)
      }
      if (quote.from_asset?.asset_id) {
        form.setValue('fromAssetId', quote.from_asset.asset_id)
      }
      if (quote.to_asset?.asset_id) {
        form.setValue('toAssetId', quote.to_asset.asset_id)
      }

      setErrorMessage((prev) => {
        if (prev && prev.includes('awaiting confirmation')) return prev
        return null
      })
    }

    window.addEventListener('kaleidoswap-quote-response', handler)
    return () =>
      window.removeEventListener('kaleidoswap-quote-response', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatAmount, form])

  // Handle quote errors immediately to reset loading states
  useEffect(() => {
    if (quoteError) {
      // Immediately reset loading states when a quote error occurs
      setIsToAmountLoading(false)
      setIsPriceLoading(false)
      setIsQuoteLoading(false)
      setHasValidQuote(false)
      setQuoteExpiresAt(null)

      // Clear the form values related to the failed quote
      form.setValue('to', '')
      form.setValue('rfq_id', '')

      // Create a user-friendly error message
      let userFriendlyError = quoteError

      if (quoteError.includes('equivalent base amount must be between')) {
        // Extract the range from the error message if possible
        const match = quoteError.match(/between (\d+) and (\d+)/)
        if (match) {
          const minAmount = parseInt(match[1])
          const maxAmount = parseInt(match[2])
          const fromAsset = form.getValues().fromAsset

          // Convert from millisats to sats for BTC
          let displayMin = minAmount
          let displayMax = maxAmount
          if (fromAsset === 'BTC') {
            displayMin = Math.round(minAmount / 1000)
            displayMax = Math.round(maxAmount / 1000)
          }

          const formattedMin = formatAmount(displayMin, fromAsset)
          const formattedMax = formatAmount(displayMax, fromAsset)
          const displayAssetName = displayAsset(fromAsset)

          userFriendlyError = t('tradeMarketMaker.error.amountMustBeBetween', {
            asset: displayAssetName,
            max: formattedMax,
            min: formattedMin,
          })
        } else {
          userFriendlyError = t('tradeMarketMaker.error.amountOutsideRange')
        }
      } else if (quoteError.includes('No tradable pair found')) {
        userFriendlyError = t('tradeMarketMaker.error.pairNotAvailable')
      } else if (quoteError.includes('Invalid asset')) {
        userFriendlyError = t('tradeMarketMaker.error.assetNotValid')
      } else if (quoteError.includes('Failed to calculate quote')) {
        userFriendlyError = t('tradeMarketMaker.error.unableToCalculateQuote')
      }

      // Show the user-friendly error message, but preserve unconfirmed channel errors
      setErrorMessage((prev) => {
        if (prev && prev.includes('awaiting confirmation')) {
          return prev
        }
        return userFriendlyError
      })

      // Clear the error from the store after handling it
      dispatch(clearQuoteError(undefined))
    }
  }, [quoteError, form, dispatch, formatAmount, displayAsset])

  // Replace the original setFromAmount function with the enhanced one
  const setFromAmount = useCallback(
    (amount: number, fromAsset: string, percentageOfMax?: number) => {
      const formattedAmount = formatAmount(amount, fromAsset)
      form.setValue('from', formattedAmount, { shouldValidate: true })

      // If percentageOfMax is provided, update selected size accordingly
      if (percentageOfMax !== undefined) {
        setSelectedSize(percentageOfMax)
      }

      // Simulate change event to trigger quote update - debounced for 0.5 sec
      debouncedQuoteRequest(requestQuote)
      return Promise.resolve(null)
    },
    [form, formatAmount, requestQuote]
  )

  // Create onSizeClick handler from our utility
  const onSizeClick = useMemo(() => {
    const handler = createSizeClickHandler(form, maxFromAmount, setFromAmount)
    return (size: number) => {
      setSelectedSize(size)
      return handler(size, size)
    }
  }, [form, maxFromAmount, setFromAmount])

  // Use most of the existing calculateMaxTradableAmount function
  const calculateMaxTradableAmount = useCallback(
    async (asset: string, isFrom: boolean): Promise<number> => {
      if (!assetsData) {
        logger.error('Assets data not available')
        return 0
      }
      const assetsList = assetsData.nia ?? []

      if (asset === 'BTC') {
        const tradableChannels = channels.filter(
          (c) => c.ready && (c.next_outbound_htlc_minimum_msat ?? 0) > 0
        )

        if (tradableChannels.length === 0) {
          // If no tradable channels exist, check if we can use onchain balance
          // Only allow using onchain balance when buying assets (isFrom = true for BTC)
          if (isFrom && onchainBtcBalance > 0) {
            logger.info(
              `No channels available, using onchain BTC balance: ${onchainBtcBalance} sats`
            )
            setIsUsingOnchainBalance(true)

            let maxAllowed = onchainBtcBalance

            // Respect LSP channel order limits
            if (lspChannelLimits) {
              maxAllowed = Math.min(
                maxAllowed,
                lspChannelLimits.max_initial_client_balance_sat
              )
              logger.debug(`Applied LSP channel limit: ${maxAllowed} sats`)
            }

            // Respect max order size from trading pair
            if (selectedPair) {
              const fromAsset = form.getValues().fromAsset
              const toAsset = form.getValues().toAsset

              let maxOrderSize: number
              if (!isPairInverted(fromAsset, toAsset)) {
                maxOrderSize = selectedPair.max_base_order_size ?? 0
              } else {
                maxOrderSize = selectedPair.max_quote_order_size ?? 0
              }

              // Convert from millisats to sats for BTC
              if (fromAsset === 'BTC') {
                maxOrderSize = maxOrderSize / MSATS_PER_SAT
              }

              maxAllowed = Math.min(maxAllowed, maxOrderSize)
              logger.debug(`Applied max order size limit: ${maxAllowed} sats`)
            }

            return maxAllowed
          }

          logger.warn(
            'No channels available for BTC and no onchain balance fallback'
          )
          setIsUsingOnchainBalance(false)
          return 0
        }

        // We have tradable channels, but check if we need to buy a channel for the other asset
        // If trading BTC -> Asset and we don't have a channel for that asset, use onchain balance
        if (isFrom && selectedPair) {
          const fromAsset = form.getValues().fromAsset
          const toAsset = form.getValues().toAsset

          // Only check if BTC is the fromAsset and we're trading for another asset
          if (fromAsset === 'BTC' && toAsset !== 'BTC') {
            const toAssetId = mapTickerToAssetId(
              toAsset,
              selectedPair ? [selectedPair] : []
            )
            const toAssetStatus = getAssetChannelStatus(channels, toAssetId)

            // If the toAsset has no ready channels, we'll need to buy a channel
            // In this case, use onchain balance instead of lightning balance
            if (!toAssetStatus.hasReadyChannels && onchainBtcBalance > 0) {
              logger.info(
                `Trading for ${toAsset} which has no ready channels, using onchain BTC balance: ${onchainBtcBalance} sats`
              )
              setIsUsingOnchainBalance(true)

              let maxAllowed = onchainBtcBalance

              // Respect LSP channel order limits
              if (lspChannelLimits) {
                maxAllowed = Math.min(
                  maxAllowed,
                  lspChannelLimits.max_initial_client_balance_sat
                )
                logger.debug(`Applied LSP channel limit: ${maxAllowed} sats`)
              }

              // Respect max order size from trading pair
              let maxOrderSize: number
              if (!isPairInverted(fromAsset, toAsset)) {
                maxOrderSize = selectedPair.max_base_order_size ?? 0
              } else {
                maxOrderSize = selectedPair.max_quote_order_size ?? 0
              }

              // Convert from millisats to sats for BTC
              if (fromAsset === 'BTC') {
                maxOrderSize = maxOrderSize / MSATS_PER_SAT
              }

              maxAllowed = Math.min(maxAllowed, maxOrderSize)
              logger.debug(`Applied max order size limit: ${maxAllowed} sats`)

              return maxAllowed
            }
          }
        }

        // We have tradable channels and either:
        // - Not trading for an asset that needs a channel purchase, OR
        // - No onchain balance available
        // Use normal lightning flow
        setIsUsingOnchainBalance(false)
        const channelHtlcLimits = tradableChannels.map(
          (c) => (c.next_outbound_htlc_limit_msat ?? 0) / MSATS_PER_SAT
        )

        // If no channels have limits, return 0
        if (
          channelHtlcLimits.length === 0 ||
          Math.max(...channelHtlcLimits) <= 0
        ) {
          logger.warn('No valid HTLC limits found')
          return 0
        }

        const maxHtlcLimit = Math.max(...channelHtlcLimits)
        const maxTradableAmount = Math.max(0, maxHtlcLimit - RGB_HTLC_MIN_SAT)
        setMaxOutboundHtlcSat(maxTradableAmount)
        return maxTradableAmount
      } else {
        const assetInfo = assetsList.find((a: any) => a.ticker === asset)
        if (!assetInfo) {
          logger.warn(`No asset info found for ticker: ${asset}`)
          return 0
        }

        const assetChannels = channels.filter(
          (c: Channel) => c.asset_id === assetInfo.asset_id && c.ready
        )

        if (assetChannels.length === 0) {
          // If receiving an asset without a channel, allow trading up to pair limits
          // The user will need to buy a channel, but we show them the quote
          if (!isFrom && selectedPair) {
            logger.info(
              `No ready channels for ${asset}, allowing receive up to pair limits for channel purchase`
            )
            const fromAsset = form.getValues().fromAsset
            const toAsset = form.getValues().toAsset

            let maxOrderSize: number
            if (!isPairInverted(fromAsset, toAsset)) {
              maxOrderSize = selectedPair.max_quote_order_size ?? 0
            } else {
              maxOrderSize = selectedPair.max_base_order_size ?? 0
            }

            // For receiving assets, return the max order size from the pair
            // This allows the user to see quotes even without a channel
            return maxOrderSize
          }

          logger.warn(
            `No ready channels found for sending asset: ${asset} (asset_id: ${assetInfo.asset_id})`
          )
          return 0
        }

        const maxAssetAmount = isFrom
          ? (() => {
              const localAmounts = assetChannels.map(
                (c: Channel) => c.asset_local_amount ?? 0
              )
              return localAmounts.length > 0 ? Math.max(...localAmounts) : 0
            })()
          : (() => {
              const remoteAmounts = assetChannels.map(
                (c: Channel) => c.asset_remote_amount ?? 0
              )
              return remoteAmounts.length > 0 ? Math.max(...remoteAmounts) : 0
            })()
        return maxAssetAmount
      }
    },
    [
      channels,
      assetsData,
      onchainBtcBalance,
      lspChannelLimits,
      selectedPair,
      form,
      isPairInverted,
    ]
  )

  // Enhanced updateMinMaxAmounts to ensure consistent validation
  const updateMinMaxAmounts = useCallback(async () => {
    if (selectedPair) {
      const fromAsset = form.getValues().fromAsset
      const toAsset = form.getValues().toAsset

      let minOrderSize: number
      if (!isPairInverted(fromAsset, toAsset)) {
        minOrderSize = selectedPair.min_base_order_size ?? 0
        if (fromAsset === 'BTC') {
          // For BTC, convert from millisats to sats
          minOrderSize = minOrderSize / MSATS_PER_SAT
        }
      } else {
        minOrderSize = selectedPair.min_quote_order_size ?? 0
        if (fromAsset === 'BTC') {
          // For BTC, convert from millisats to sats
          minOrderSize = minOrderSize / MSATS_PER_SAT
        }
      }
      setMinFromAmount(minOrderSize)

      // Calculate max amounts
      const newMaxFromAmount = await calculateMaxTradableAmount(fromAsset, true)
      const newMaxToAmount = await calculateMaxTradableAmount(toAsset, false)

      setMaxFromAmount(newMaxFromAmount)
      setMaxToAmount(newMaxToAmount)

      // Check if user is missing a channel for any of the assets
      // Only suggest buying a channel if NO ready channels exist for that asset
      let missingChannel: {
        asset: string
        assetId: string
        isFromAsset: boolean
      } | null = null

      // Check fromAsset for missing ready channel
      if (fromAsset !== 'BTC') {
        // Use mapTickerToAssetId to get the proper asset ID
        const fromAssetId = mapTickerToAssetId(
          fromAsset,
          selectedPair ? [selectedPair] : []
        )
        logger.debug(
          `[Channel Check] Checking fromAsset: ${fromAsset}, mapped to ID: ${fromAssetId}`
        )

        if (fromAssetId && fromAssetId !== fromAsset) {
          const channelStatus = getAssetChannelStatus(channels, fromAssetId)
          logger.debug(
            `[Channel Check] ${fromAsset} fromAsset status:`,
            channelStatus
          )
          // Only set missingChannel if NO channels exist at all (not just unconfirmed)
          // If channels exist but are unconfirmed, the separate "awaiting confirmation" error will show
          if (
            !channelStatus.hasReadyChannels &&
            !channelStatus.allUnconfirmed
          ) {
            missingChannel = {
              asset: fromAsset,
              assetId: fromAssetId,
              isFromAsset: true,
            }
            logger.info(
              `[Channel Check] Missing channel detected for fromAsset ${fromAsset}`
            )
          }
        } else {
          logger.warn(
            `[Channel Check] Could not map fromAsset ticker ${fromAsset} to asset ID`
          )
        }
      }

      // Check toAsset for missing ready channel (only if fromAsset has channels or is BTC)
      if (!missingChannel && toAsset !== 'BTC') {
        // Use mapTickerToAssetId to get the proper asset ID
        const toAssetId = mapTickerToAssetId(
          toAsset,
          selectedPair ? [selectedPair] : []
        )
        logger.info(
          `[Channel Check] Checking toAsset: ${toAsset}, mapped to ID: ${toAssetId}`
        )

        if (toAssetId && toAssetId !== toAsset) {
          const channelStatus = getAssetChannelStatus(channels, toAssetId)

          logger.info(`[Channel Check] ${toAsset} toAsset channel status:`, {
            allUnconfirmed: channelStatus.allUnconfirmed,
            assetId: toAssetId,
            hasChannels: channelStatus.hasChannels,
            hasReadyChannels: channelStatus.hasReadyChannels,
            readyChannelCount: channelStatus.readyChannelCount,
            totalChannelCount: channelStatus.totalChannelCount,
          })

          logger.info(
            `[Channel Check] Condition check: !hasReadyChannels && !allUnconfirmed = ${!channelStatus.hasReadyChannels} && ${!channelStatus.allUnconfirmed} = ${!channelStatus.hasReadyChannels && !channelStatus.allUnconfirmed}`
          )

          // Only set missingChannel if NO channels exist at all (not just unconfirmed)
          // If channels exist but are unconfirmed, the separate "awaiting confirmation" error will show
          if (
            !channelStatus.hasReadyChannels &&
            !channelStatus.allUnconfirmed
          ) {
            missingChannel = {
              asset: toAsset,
              assetId: toAssetId,
              isFromAsset: false,
            }
            logger.info(
              `[Channel Check] ✓ Missing channel detected for toAsset ${toAsset}`
            )
          } else {
            logger.info(
              `[Channel Check] ✗ toAsset ${toAsset} has channels or all unconfirmed`
            )
          }
        } else {
          logger.warn(
            `[Channel Check] Could not map toAsset ticker ${toAsset} to asset ID`
          )
        }
      }

      // Special case: If no tradable channels exist at all,
      // and we're buying a non-BTC asset, set that asset as missing
      // This handles the onchain balance scenario
      if (!missingChannel && toAsset !== 'BTC') {
        const tradableChannels = getTradableChannels(channels)
        if (tradableChannels.length === 0 && fromAsset === 'BTC') {
          const toAssetId = mapTickerToAssetId(
            toAsset,
            selectedPair ? [selectedPair] : []
          )
          logger.info(
            `[Channel Check] Special case: No tradable channels, checking toAsset: ${toAsset}, mapped to ID: ${toAssetId}`
          )

          if (toAssetId && toAssetId !== toAsset) {
            missingChannel = {
              asset: toAsset,
              assetId: toAssetId,
              isFromAsset: false,
            }
            logger.info(
              `[Channel Check] ✓ No channels available, missing ${toAsset} channel for receiving`
            )
          } else {
            logger.warn(
              `[Channel Check] Could not map toAsset ticker ${toAsset} to asset ID in special case`
            )
          }
        }
      }

      logger.info(`[Channel Check] === FINAL RESULT ===`)
      logger.info(`[Channel Check] missingChannelAsset:`, missingChannel)
      logger.info(`[Channel Check] Total channels in system:`, channels.length)
      logger.info(
        `[Channel Check] Channel asset IDs:`,
        channels.map((c) => ({ assetId: c.asset_id, ready: c.ready }))
      )
      setMissingChannelAsset(missingChannel)

      // If a channel is missing, clear validation errors so the "Buy channel" button shows properly
      // The UI will display a dedicated message about needing a channel
      if (missingChannel) {
        setErrorMessage((prev) => {
          // Preserve unconfirmed channel errors - they take priority
          if (prev && prev.includes('awaiting confirmation')) {
            return prev
          }
          return null
        })
      } else {
        // Only check amount limits if no channel is missing
        const currentToAmount = parseAssetAmount(form.getValues().to, toAsset)
        if (currentToAmount > newMaxToAmount && newMaxToAmount > 0) {
          const formattedMaxToAmount = formatAmount(newMaxToAmount, toAsset)
          const displayedAsset = displayAsset(toAsset)
          const errorMsg = t('tradeMarketMaker.error.canOnlyReceiveUpTo', {
            amount: formattedMaxToAmount,
            asset: displayedAsset,
          })
          logger.warn(
            `Current to amount (${currentToAmount}) exceeds maximum receivable amount (${newMaxToAmount})`
          )
          // Preserve unconfirmed channel errors - they take priority
          setErrorMessage((prev) => {
            if (prev && prev.includes('awaiting confirmation')) {
              return prev
            }
            return errorMsg
          })
        }
      }

      // Enhanced logic to always ensure minimum amount is set when needed
      const currentFromAmount = form.getValues().from
      const currentFromAmountParsed = parseFloat(
        currentFromAmount?.replace(/,/g, '') || '0'
      )

      if (
        !currentFromAmount ||
        currentFromAmountParsed <= 0 ||
        isNaN(currentFromAmountParsed)
      ) {
        // Always set to minimum amount if the user has sufficient balance
        const initialAmount = Math.max(minOrderSize, minOrderSize * 1.1) // Slightly above minimum for better UX

        logger.debug(
          `Setting from amount to minimum: ${initialAmount} ${fromAsset} (was: ${currentFromAmount})`
        )

        // Format and set the initial amount
        const formattedAmount = formatAmount(initialAmount, fromAsset)
        form.setValue('from', formattedAmount, { shouldValidate: true })

        // Request a quote with this initial amount - debounced for 0.5 sec
        debouncedQuoteRequest(requestQuote)
      }
    }
  }, [
    selectedPair,
    form,
    calculateMaxTradableAmount,
    isPairInverted,
    formatAmount,
    requestQuote,
    parseAssetAmount,
    displayAsset,
    assetsData,
    channels,
  ])

  // Enhanced effect to initialize the UI with minimum amounts when pair is selected
  useEffect(() => {
    if (selectedPair && minFromAmount > 0) {
      const currentFromAmount = form.getValues().from
      const currentFromAmountParsed = parseFloat(
        currentFromAmount?.replace(/,/g, '') || '0'
      )

      // Always ensure we have a minimum amount set
      if (
        !currentFromAmount ||
        currentFromAmountParsed <= 0 ||
        isNaN(currentFromAmountParsed)
      ) {
        const fromAsset = form.getValues().fromAsset
        // Use minimum order size, ensuring it's valid
        const initialAmount = Math.max(minFromAmount, minFromAmount * 1.1)
        const formattedAmount = formatAmount(initialAmount, fromAsset)

        logger.debug(
          `Initializing UI with minimum amount: ${initialAmount} ${fromAsset}`
        )

        form.setValue('from', formattedAmount, { shouldValidate: true })

        // Request a quote with this initial amount - debounced for 0.5 sec
        debouncedQuoteRequest(requestQuote)
      }
    }
  }, [
    selectedPair,
    minFromAmount,
    maxFromAmount,
    form,
    formatAmount,
    requestQuote,
  ])

  // Create onSwapAssets handler from our utility
  const onSwapAssets = useMemo(() => {
    // Disable swapping when using onchain balance (must be BTC → Asset only)
    if (isUsingOnchainBalance && !hasTradableChannels(channels)) {
      return async () => {
        toast.warning(t('tradeMarketMaker.error.swapDisabledOnchain'))
        logger.info('Swap disabled: using onchain balance')
      }
    }

    return createSwapAssetsHandler(
      selectedPair,
      form,
      calculateMaxTradableAmount,
      updateMinMaxAmounts,
      setMaxFromAmount,
      formatAmount,
      getAssetPrecisionWrapper
    )
  }, [
    selectedPair,
    form,
    calculateMaxTradableAmount,
    updateMinMaxAmounts,
    setMaxFromAmount,
    formatAmount,
    getAssetPrecisionWrapper,
    isUsingOnchainBalance,
    channels,
  ])

  // Update handleAssetChange to save preferences
  const handleAssetChange = useMemo(() => {
    const originalHandler = createAssetChangeHandler(
      form,
      tradablePairs,
      updateMinMaxAmounts,
      calculateMaxTradableAmount,
      setFromAmount,
      setSelectedPair,
      setMaxFromAmount,
      t
    )

    // Return enhanced handler that also saves preferences
    return (field: 'fromAsset' | 'toAsset', value: string) => {
      // Clear any existing quote error when user changes assets
      dispatch(clearQuoteError(undefined))

      // Call the original handler
      originalHandler(field, value)

      // Save the updated assets to localStorage - removed unused variable assignment
      const otherField = field === 'fromAsset' ? 'toAsset' : 'fromAsset'
      const otherValue = form.getValues()[otherField]

      if (otherValue) {
        // Removed unused variable assignments
      }
    }
  }, [
    form,
    tradablePairs,
    updateMinMaxAmounts,
    calculateMaxTradableAmount,
    setFromAmount,
    setSelectedPair,
    setMaxFromAmount,
    dispatch,
  ])

  // Create refreshAmounts handler from our utility
  const refreshAmounts = useMemo(
    () =>
      createRefreshAmountsHandler(
        selectedPair,
        form,
        calculateMaxTradableAmount,
        updateMinMaxAmounts,
        selectedSize,
        setFromAmount,
        setIsLoading,
        setMaxFromAmount,
        setMaxToAmount,
        t
      ),
    [
      selectedPair,
      form,
      calculateMaxTradableAmount,
      updateMinMaxAmounts,
      selectedSize,
      setFromAmount,
      setIsLoading,
      setMaxFromAmount,
      setMaxToAmount,
      t,
    ]
  )

  // Helper function to refresh channels and then amounts
  const refreshChannelsAndAmounts = useCallback(async () => {
    try {
      // First refresh channel data to get updated balances
      const channelsResponse = await listChannels()
      if ('data' in channelsResponse && channelsResponse.data) {
        setChannels(channelsResponse.data.channels ?? [])
      }
      // Then call the existing refreshAmounts
      await refreshAmounts()
    } catch (error) {
      logger.error('Error refreshing channels and amounts:', error)
      // Still try to refresh amounts even if channel refresh fails
      await refreshAmounts()
    }
  }, [listChannels, setChannels, refreshAmounts])

  // Update error message when amounts change - use subscription instead of watch
  useEffect(() => {
    const subscription = form.watch((value) => {
      const fromAmount = parseAssetAmount(
        value.from || '',
        value.fromAsset || ''
      )
      const toAmount = parseAssetAmount(value.to || '', value.toAsset || '')

      // Use our utility function to generate error messages
      const errorMsg = getValidationError(
        fromAmount,
        toAmount,
        minFromAmount,
        maxFromAmount,
        maxToAmount,
        max_outbound_htlc_sat,
        value.fromAsset || '',
        value.toAsset || '',
        formatAmount,
        displayAsset,
        assets,
        isToAmountLoading,
        isQuoteLoading,
        isPriceLoading,
        missingChannelAsset,
        t
      )

      // Compute warning for max-exceeded (amber, not cleared by quotes)
      const warningMsg = getValidationWarning(
        fromAmount,
        toAmount,
        maxFromAmount,
        maxToAmount,
        value.fromAsset || '',
        value.toAsset || '',
        formatAmount,
        displayAsset,
        assets,
        isToAmountLoading,
        isQuoteLoading,
        isPriceLoading,
        missingChannelAsset,
        t
      )
      setWarningMessage(warningMsg)

      // Preserve unconfirmed channel errors - they take priority over amount validation errors
      setErrorMessage((prev) => {
        if (prev && prev.includes('awaiting confirmation')) {
          return prev // Keep the unconfirmed channel error
        }
        return errorMsg
      })
    })

    return () => subscription.unsubscribe()
  }, [
    minFromAmount,
    maxFromAmount,
    maxToAmount,
    max_outbound_htlc_sat,
    parseAssetAmount,
    formatAmount,
    displayAsset,
    assets,
    form,
    isToAmountLoading,
    isQuoteLoading,
    isPriceLoading,
    missingChannelAsset,
  ])

  // Use our utility function to create the fetch and set pairs handler
  const fetchAndSetPairs = useMemo(
    () =>
      createFetchAndSetPairsHandler(
        getClient,
        dispatch,
        channels,
        // Use RTK Query data directly to ensure we have the latest assets
        (assetsData?.nia || []).map((a: any) => ({
          ...a,
          is_active: true,
          media: a.media
            ? ({
                digest: '',
                file_path: a.media.file_path ?? '',
                mime: a.media.mime ?? '',
              } as any)
            : undefined,
          name: a.name ?? '',
          precision: a.precision ?? 8,
          ticker: a.ticker ?? '',
        })),
        form,
        formatAmount,
        setTradingPairs,
        setTradablePairs,
        setSelectedPair,
        setIsPairsLoading,
        t
      ),
    [
      getClient,
      dispatch,
      channels,
      assetsData?.nia,
      form,
      formatAmount,
      isInitialDataLoaded,
      isAssetsLoaded,
      isChannelsLoaded,
      t,
    ]
  )

  // Create a version that accepts fresh data as parameters
  const fetchAndSetPairsWithData = useCallback(
    (freshChannels: Channel[], freshAssets: NiaAsset[]) =>
      createFetchAndSetPairsHandler(
        getClient,
        dispatch,
        freshChannels,
        freshAssets,
        form,
        formatAmount,
        (p: TradingPair[]) => dispatch(setTradingPairs(p) as any),
        (p: TradingPair[]) => setTradablePairs(p),
        (p: TradingPair | null) => setSelectedPair(p),
        setIsPairsLoading,
        t
      )(),
    [
      dispatch,
      form,
      formatAmount,
      setTradingPairs,
      setTradablePairs,
      setSelectedPair,
      setIsPairsLoading,
      t,
    ]
  )

  // Separate effect to handle channels and assets changes without reinitializing WebSocket
  useEffect(() => {
    // Only update state if WebSocket is already initialized
    if (isWebSocketInitialized && channels.length > 0 && assets.length > 0) {
      // Fetch pairs if we don't have them yet
      if (tradablePairs.length === 0) {
        fetchAndSetPairs().catch((error) => {
          logger.error('Error fetching pairs after data update:', error)
        })
      }
    }
  }, [
    channels.length,
    assets.length,
    isWebSocketInitialized,
    tradablePairs.length,
    fetchAndSetPairs,
  ])

  // Restore the effect to update min and max amounts when selected pair changes
  useEffect(() => {
    if (selectedPair) {
      updateMinMaxAmounts()
    }
  }, [selectedPair, updateMinMaxAmounts])

  // Auto-refresh amounts every 30 seconds
  useEffect(() => {
    let intervalId: number | any = null

    // Only start auto-refresh if we have a selected pair and WebSocket is connected
    if (selectedPair && wsConnected && !isSwapInProgress) {
      intervalId = setInterval(() => {
        logger.debug('Auto-refreshing amounts...')
        refreshAmounts()
      }, 30000) // 30 seconds - reduced frequency to prevent connection overload
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [selectedPair, wsConnected, isSwapInProgress, refreshAmounts])

  // Comprehensive cleanup effect for WebSocket and component state
  useEffect(() => {
    const handleBeforeUnload = () => {
      logger.info('App closing, ensuring WebSocket connection is cleaned up')
      webSocketService.close()
    }

    const handleUnload = () => {
      // Clean up any pending timeouts and state
      clearDebouncedQuoteRequest()
      clearConnectionTimeout()

      // Clear any pending connection timeout
      if (connectionTimeoutTimer) {
        clearTimeout(connectionTimeoutTimer)
        setConnectionTimeoutTimer(null)
      }

      // Clear any pending error message timeout
      if (errorMessageTimeoutRef.current) {
        clearTimeout(errorMessageTimeoutRef.current)
        errorMessageTimeoutRef.current = null
      }

      // Reset all refs
      isMountedRef.current = false
      initializationRef.current = false
      isInitializingRef.current = false

      // Close WebSocket connection
      webSocketService.close()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('unload', handleUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('unload', handleUnload)

      // Final cleanup on component unmount
      handleUnload()
    }
  }, [])

  // Add effect to update elapsed time display during connection
  useEffect(() => {
    let intervalId: number | null = null

    if (connectionStartTime && !isWebSocketInitialized && !connectionTimeout) {
      intervalId = window.setInterval(() => {
        // Removed elapsed calculation and setElapsedSeconds call since we removed that state
      }, 1000)
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [connectionStartTime, isWebSocketInitialized, connectionTimeout])

  // Monitor WebSocket connection status and clear timeout when connected
  useEffect(() => {
    if (wsConnected) {
      logger.info(
        'WebSocket connected successfully, clearing connection timeout'
      )
      clearConnectionTimeout()
    }
  }, [wsConnected, clearConnectionTimeout])

  // Also clear timeout when connection is ready and validated
  useEffect(() => {
    if (isWebSocketInitialized && !connectionTimeout && connectionStartTime) {
      logger.info(
        'WebSocket initialized successfully, clearing connection timeout'
      )
      clearConnectionTimeout()
    }
  }, [
    isWebSocketInitialized,
    connectionTimeout,
    connectionStartTime,
    clearConnectionTimeout,
  ])

  // Add a more robust page visibility API listener to handle when page becomes hidden/visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        logger.debug('Page became hidden, WebSocket remains connected')
        // Don't close WebSocket when page is hidden - just log it
      } else {
        logger.debug('Page became visible, checking WebSocket connection')
        // Check if we need to reconnect after page becomes visible
        if (
          isWebSocketInitialized &&
          !webSocketService.isConnected() &&
          makerConnectionUrl
        ) {
          logger.info(
            'Page visible and WebSocket disconnected, attempting to reconnect'
          )
          // Use a small delay to avoid rapid reconnection attempts
          setTimeout(() => {
            if (!webSocketService.isConnected()) {
              webSocketService.reconnect()
            }
          }, 1000)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isWebSocketInitialized, makerConnectionUrl])

  // Track previous maker URL to only reset when it actually changes
  const previousMakerUrlRef = useRef<string>('')

  // Handle maker URL changes - re-fetch pairs when maker changes
  useEffect(() => {
    // Only run if we have initial data loaded, assets loaded, and a maker URL
    if (
      isInitialDataLoaded &&
      isAssetsLoaded &&
      isChannelsLoaded &&
      makerConnectionUrl
    ) {
      // Check if the URL has actually changed
      if (previousMakerUrlRef.current === makerConnectionUrl) {
        logger.debug('Maker URL unchanged, skipping reset')
        return
      }

      // Update the previous URL reference
      const previousUrl = previousMakerUrlRef.current
      previousMakerUrlRef.current = makerConnectionUrl

      // Only reset if we had a previous URL (not initial load)
      if (previousUrl) {
        logger.info(
          `Maker URL changed from ${previousUrl} to: ${makerConnectionUrl}, resetting state and re-fetching trading pairs`
        )

        // Check if WebSocket is currently stable and connected to the same URL
        const isConnectionStable =
          webSocketService.isConnected() &&
          webSocketService.getCurrentUrl() === makerConnectionUrl &&
          tradablePairs.length > 0

        if (isConnectionStable) {
          logger.info(
            'WebSocket connection is stable to same URL, skipping reset'
          )
          // Just re-fetch pairs without resetting connection
          fetchAndSetPairs()
          return
        }

        // Reset WebSocket initialization state to allow reconnection to new maker
        setIsWebSocketInitialized(false)
        initializationRef.current = false
        isInitializingRef.current = false

        // Reset maker-specific state
        setSelectedPair(null)
        setCurrentPrice(null)
        setFees({
          baseFee: 0,
          feeRate: 0,
          totalFee: 0,
          variableFee: 0,
        })
        // Don't clear unconfirmed channel errors when resetting state
        setErrorMessage((prev) =>
          prev?.includes('awaiting confirmation') ? prev : null
        )
        setIsToAmountLoading(true)
        setIsPriceLoading(true)
        setIsQuoteLoading(false)
        setHasValidQuote(false)
        setQuoteExpiresAt(null)

        // Reset min/max amounts since they're specific to the maker's pairs
        setMinFromAmount(0)
        setMaxFromAmount(0)
        setMaxToAmount(0)

        // Clear form amounts but keep assets
        form.setValue('to', '')
        form.setValue('rfq_id', '')

        // Clear any existing connection timeout when switching makers
        clearConnectionTimeout()

        // Reset WebSocket service for new maker
        webSocketService.resetForNewMaker()
      } else {
        logger.info(
          `Initial maker URL set to: ${makerConnectionUrl}, proceeding with normal initialization`
        )
      }

      // Re-fetch trading pairs from the new maker (always do this for new URLs)
      fetchAndSetPairs()
    }
  }, [
    makerConnectionUrl,
    isInitialDataLoaded,
    isAssetsLoaded,
    isChannelsLoaded,
    fetchAndSetPairs,
    form,
  ])

  // Optimized initialization with step-by-step validation
  useEffect(() => {
    if (loadingPhase !== 'initializing') {
      logger.debug(`Skipping setup - current phase: ${loadingPhase}`)
      return
    }

    if (setupRunningRef.current) {
      logger.debug('Setup already running, skipping duplicate execution')
      return
    }

    logger.info('🚀 Starting optimized market maker initialization')

    const optimizedSetup = async () => {
      if (setupRunningRef.current) {
        logger.debug('Setup already running, aborting duplicate execution')
        return
      }

      setupRunningRef.current = true

      try {
        // Phase 1: Get node info and channels first

        // Always fetch BTC balance and LSP info for potential onchain trading
        logger.info('💰 Fetching BTC balance and LSP info...')
        setLoadingPhase('validating-balance')

        const balanceResponse = await btcBalance()

        if (!('data' in balanceResponse) || !balanceResponse.data) {
          logger.error('❌ Failed to get balance data')
          throw new Error('Failed to get balance information')
        }

        let lspInfoResponse: any = null
        try {
          lspInfoResponse = await getInfo()
          if (lspInfoResponse.error) {
            logger.warn(
              '⚠️ LSP info fetch failed, continuing without channel limits'
            )
          }
        } catch (error: any) {
          if (error?.status === 'TIMEOUT_ERROR') {
            logger.warn(
              '⚠️ LSP info request timed out - maker server not responding. Continuing without channel limits.'
            )
          } else {
            logger.warn(
              '⚠️ Failed to fetch LSP info, continuing without channel limits:',
              error
            )
          }
        }

        logger.info('🔗 Phase 1: Checking channels and node info')
        setLoadingPhase('validating-channels')

        // Get node info and channels in parallel
        const [nodeInfoResponse, channelsResponse] = await Promise.all([
          nodeInfo(),
          listChannels(),
        ])

        // Validate node info
        if (!('data' in nodeInfoResponse) || !nodeInfoResponse.data) {
          logger.error('❌ Failed to get node info')
          throw new Error('Failed to get node information')
        }
        setPubKey(nodeInfoResponse.data.pubkey ?? '')
        logger.debug('✅ Node info retrieved, pubkey set')

        // Validate channels response
        if (!('data' in channelsResponse) || !channelsResponse.data) {
          logger.error('❌ Failed to get channels data')
          throw new Error('Failed to get channels information')
        }

        const channelsList = channelsResponse.data.channels

        const { vanilla, colored } = balanceResponse.data
        const totalOnchainBalance =
          (vanilla?.spendable ?? 0) + (colored?.spendable ?? 0)
        setOnchainBtcBalance(totalOnchainBalance)
        logger.info(`💰 Onchain BTC balance: ${totalOnchainBalance} sats`)

        // Store LSP channel limits if available
        if (
          lspInfoResponse &&
          'data' in lspInfoResponse &&
          lspInfoResponse.data?.options
        ) {
          setLspChannelLimits({
            max_channel_balance_sat:
              lspInfoResponse.data.options.max_channel_balance_sat,
            max_initial_client_balance_sat:
              lspInfoResponse.data.options.max_initial_client_balance_sat,
            min_channel_balance_sat:
              lspInfoResponse.data.options.min_channel_balance_sat,
            min_initial_client_balance_sat:
              lspInfoResponse.data.options.min_initial_client_balance_sat,
          })
          logger.info('✅ LSP channel limits loaded')
        } else {
          logger.info('ℹ️ No LSP channel limits available - will use defaults')
        }

        if ((channelsList ?? []).length === 0) {
          logger.warn(
            '⚠️ No channels found - checking if we can trade with onchain balance'
          )

          const hasEnough = totalOnchainBalance >= MIN_CHANNEL_CAPACITY
          setHasEnoughBalance(hasEnough)

          logger.info(
            `💰 Balance check: ${totalOnchainBalance} sats (min required: ${MIN_CHANNEL_CAPACITY})`
          )
          if (!hasEnough) {
            logger.warn(
              '❌ No channels and insufficient balance - redirecting to deposit'
            )
            setLoadingPhase('error')
            setValidationError('insufficient-balance')
            return
          } else {
            // No channels but sufficient balance - allow trading with onchain balance
            logger.info(
              '✅ No channels found but sufficient balance - allowing onchain trading'
            )
            // Continue with initialization to allow asset viewing and buying
          }
        }

        // Step 3: Set assets from RTK Query data
        logger.info('🎨 Phase 3: Setting up assets')
        if (!assetsData?.nia) {
          logger.error('❌ No assets data available from RTK Query')
          setLoadingPhase('error')
          setValidationError('no-assets')
          return
        }

        // Step 4: Update state and process fresh data
        logger.info('🔄 Updating channels and assets state...')

        // Update state with fresh data
        setChannels(channelsList ?? [])
        setIsChannelsLoaded(true)
        setAssets(
          assetsData.nia.map((a: any) => ({
            ...a,
            is_active: true,
            media: a.media
              ? ({
                  digest: '',
                  file_path: a.media.file_path ?? '',
                  mime: a.media.mime ?? '',
                } as any)
              : undefined,
            name: a.name ?? '',
            precision: a.precision ?? 8,
            ticker: a.ticker ?? '',
          }))
        )
        setIsAssetsLoaded(true)

        // Check if we have channels but none are ready - if so, set ready phase to show channels not ready message
        const readyChannels = (channelsList ?? []).filter((c: any) => c.ready)
        if (readyChannels.length === 0) {
          logger.warn(
            '❌ Channels exist but none are ready - setting ready phase to show channels not ready message'
          )
          setLoadingPhase('ready')
          setIsInitialDataLoaded(true)
          return
        }

        // Step 5: Quick maker compatibility check using fresh data
        logger.info(
          '🤝 Phase 5: Connecting to maker and fetching trading pairs'
        )
        setLoadingPhase('connecting-maker')

        logger.debug('Fetching trading pairs from maker with fresh data...')

        // Fetch pairs using fresh data instead of waiting for state to update
        const pairsFound = await fetchAndSetPairsWithData(
          channelsList ?? [],
          assetsData.nia.map((a: any) => ({
            ...a,
            is_active: true,
            media: a.media
              ? ({
                  digest: '',
                  file_path: a.media.file_path ?? '',
                  mime: a.media.mime ?? '',
                } as any)
              : undefined,
            name: a.name ?? '',
            precision: a.precision ?? 8,
            ticker: a.ticker ?? '',
          }))
        )

        logger.info(
          `📈 Trading pairs result: found=${pairsFound}, count=${tradablePairs.length}`,
          {
            assetsAvailable: assetsData.nia.length,
            channelsAvailable: (channelsList ?? []).length,
            channelsReady: (channelsList ?? []).filter((c: any) => c.ready)
              .length,
          }
        )

        if (!pairsFound) {
          logger.warn('❌ No tradable pairs found from maker')
          setLoadingPhase('error')
          setValidationError('no-trading-pairs')
          return
        }

        // Step 5: Mark as ready for WebSocket connection
        logger.info('🎉 All validations passed! Ready for trading')
        setLoadingPhase('ready')
        setIsInitialDataLoaded(true)
      } catch (error: any) {
        logger.error('💥 Error during optimized setup:', error)
        setLoadingPhase('error')
        setValidationError('setup-error')

        // Show specific error message for timeout
        let errorMessage = t('tradeMarketMaker.toast.initializationFailed')
        if (error?.status === 'TIMEOUT_ERROR') {
          errorMessage = t('tradeMarketMaker.toast.reconnectFailed')
        } else if (error?.status === 'FETCH_ERROR') {
          errorMessage = t('tradeMarketMaker.toast.connectionError')
        } else if (error?.message) {
          errorMessage = error.message
        }

        toast.error(errorMessage)
      } finally {
        setupRunningRef.current = false
      }
    }

    // Check assets data availability
    if (!assetsData) {
      logger.debug('⏳ Waiting for RTK Query assets data - no data yet')
      return
    }

    if (!assetsData.nia) {
      logger.error('❌ RTK Query returned data but no nia array')
      setLoadingPhase('error')
      setValidationError('setup-error')
      return
    }

    optimizedSetup()
  }, [
    loadingPhase,
    assetsData?.nia?.length,
    nodeInfo,
    btcBalance,
    getInfo,
    listChannels,
    fetchAndSetPairs,
    makerConnectionUrl,
  ])

  // Ensure BTC is the fromAsset when using onchain balance (no channels)
  useEffect(() => {
    if (
      isUsingOnchainBalance &&
      !hasTradableChannels(channels) &&
      form &&
      tradablePairs.length > 0
    ) {
      const currentFromAsset = form.getValues().fromAsset
      const currentToAsset = form.getValues().toAsset

      // If fromAsset is not BTC, force it to be BTC
      if (currentFromAsset !== 'BTC') {
        logger.info('Forcing fromAsset to BTC when using onchain balance')
        form.setValue('fromAsset', 'BTC')

        // If toAsset was BTC or empty, select the first available asset
        if (!currentToAsset || currentToAsset === 'BTC') {
          const availableAssets = tradablePairs
            .flatMap((pair) => [pair.base_asset, pair.quote_asset])
            .filter((asset): asset is string => !!asset)
            .filter(
              (asset, index, self) =>
                asset !== 'BTC' && self.indexOf(asset) === index
            )

          if (availableAssets.length > 0) {
            form.setValue('toAsset', availableAssets[0])
            logger.info(
              `Set toAsset to ${availableAssets[0]} when using onchain balance`
            )
          }
        }
      }

      // If toAsset is BTC, change it to another asset
      if (currentToAsset === 'BTC') {
        const availableAssets = tradablePairs
          .flatMap((pair) => [pair.base_asset, pair.quote_asset])
          .filter((asset): asset is string => !!asset)
          .filter(
            (asset, index, self) =>
              asset !== 'BTC' && self.indexOf(asset) === index
          )

        if (availableAssets.length > 0) {
          form.setValue('toAsset', availableAssets[0])
          logger.info(
            `Changed toAsset from BTC to ${availableAssets[0]} when using onchain balance`
          )
        }
      }
    }
  }, [isUsingOnchainBalance, channels, form, tradablePairs])

  // WebSocket initialization - only runs when we reach 'ready' phase
  useEffect(() => {
    if (
      loadingPhase !== 'ready' ||
      isWebSocketInitialized ||
      !makerConnectionUrl ||
      !pubKey
    ) {
      return
    }

    const initializeWebSocket = async () => {
      try {
        logger.info('Initializing WebSocket connection for trading interface')

        // Use pubkey[:16]-uuid format for client ID
        const pubKeyPrefix = pubKey.slice(0, 16)
        const uuid = crypto.randomUUID()
        const clientId = `${pubKeyPrefix}-${uuid}`

        // Check if already connected to prevent unnecessary initialization
        if (
          webSocketService.isConnected() &&
          webSocketService.getCurrentUrl() === makerConnectionUrl &&
          webSocketService.isConnectionReadyForCommunication()
        ) {
          logger.info(
            'WebSocket already connected and ready, skipping initialization'
          )
          setIsWebSocketInitialized(true)
          lastSuccessfulConnectionRef.current = Date.now()
          return
        }

        // Use the retry method for better reliability on initial connection
        const success = await initializeWebSocketWithRetry(
          makerConnectionUrl,
          clientId,
          dispatch,
          5, // 5 retry attempts
          8000 // Reduced timeout to 8 seconds per attempt
        )

        if (success) {
          logger.info('WebSocket initialized and connected successfully')
          setIsWebSocketInitialized(true)
          lastSuccessfulConnectionRef.current = Date.now()
        } else {
          logger.error(
            'WebSocket initialization failed after all retry attempts'
          )

          // Get diagnostics for troubleshooting
          const diagnostics = webSocketService.getDiagnostics()
          logger.debug('WebSocket failure diagnostics:', diagnostics)

          toast.error(t('tradeMarketMaker.toast.connectionFailed'))
        }
      } catch (error) {
        logger.error('Error initializing WebSocket:', error)
        toast.error(t('tradeMarketMaker.toast.connectionError'))
      }
    }

    // Reduced delay for faster initialization
    const timer = setTimeout(initializeWebSocket, 200)
    return () => clearTimeout(timer)
  }, [
    loadingPhase,
    isWebSocketInitialized,
    makerConnectionUrl,
    pubKey,
    dispatch,
  ])

  // Update amounts when selectedPair feed changes - don't try to use selectedPairFeed directly
  useEffect(() => {
    if (selectedPair) {
      // We have a pair selected, request quotes directly instead of relying on selectedPairFeed
      setIsPriceLoading(false)
      const fromAmount = form.getValues().from

      if (fromAmount) {
        setIsToAmountLoading(true)
        debouncedQuoteRequest(requestQuote)
      }
    } else {
      // No selected pair, clear "to" amount
      form.setValue('to', '')
      setIsPriceLoading(true)
    }
  }, [form, selectedPair, requestQuote])

  // Set up quote request timer when component mounts or when assets change
  useEffect(() => {
    const fromAsset = form.getValues().fromAsset
    const toAsset = form.getValues().toAsset

    if (fromAsset && toAsset && fromAsset !== toAsset && wsConnected) {
      // Start quote request timer with increased interval to reduce server load
      startQuoteRequestTimer(requestQuote, 12000) // Increased from 8000ms to 12000ms to reduce server load

      // Request an initial quote with debouncing to prevent rapid requests
      debouncedQuoteRequest(requestQuote)

      return () => {
        // Stop timer when component unmounts or assets change
        stopQuoteRequestTimer()
      }
    }
  }, [
    form.getValues().fromAsset,
    form.getValues().toAsset,
    wsConnected,
    requestQuote,
  ])

  // Ref to track form change debounce timer
  const formChangeTimerRef = useRef<number | null>(null)

  // Debounced form change handler to prevent rapid quote requests
  const debouncedFormChange = useCallback(
    (value: any, { name }: any) => {
      // Clear any existing timer
      if (formChangeTimerRef.current) {
        clearTimeout(formChangeTimerRef.current)
      }

      // Set a new timer
      formChangeTimerRef.current = window.setTimeout(() => {
        if (name === 'from' || name === 'fromAsset' || name === 'toAsset') {
          const fromAmount = value.from
          const fromAsset = value.fromAsset
          const toAsset = value.toAsset

          // Only request quote if we have all required values and assets are different
          if (
            fromAmount &&
            fromAsset &&
            toAsset &&
            fromAsset !== toAsset &&
            wsConnected
          ) {
            // Only set loading states if we don't already have a valid quote
            if (!hasValidQuote) {
              setIsToAmountLoading(true)
              setIsPriceLoading(true)
            }

            debouncedQuoteRequest(requestQuote)
          } else if (!fromAmount || fromAmount === '0') {
            // Clear "to" amount when "from" is empty
            form.setValue('to', '')
            setIsToAmountLoading(false)
            setIsQuoteLoading(false)
            setHasValidQuote(false)
          }
        }
        formChangeTimerRef.current = null
      }, 800) // 800ms debounce to prevent rapid quote requests
    },
    [wsConnected, requestQuote, hasValidQuote, form]
  )

  // Update effect to request quote when from amount changes - use subscription instead of watch
  useEffect(() => {
    const subscription = form.watch(debouncedFormChange)

    return () => {
      subscription.unsubscribe()
      // Cancel any pending form change timer
      if (formChangeTimerRef.current) {
        clearTimeout(formChangeTimerRef.current)
        formChangeTimerRef.current = null
      }
    }
  }, [form, debouncedFormChange])

  // Create a debounced effect for from amount changes - optimized to reduce re-renders and server load
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'from') {
        const currentFromAmount = value.from
        if (debouncedFromAmount !== currentFromAmount) {
          setDebouncedFromAmount(currentFromAmount || '')
          // Only request quote if we have valid values, assets are different, and are connected
          if (
            currentFromAmount &&
            currentFromAmount !== '0' &&
            value.fromAsset &&
            value.toAsset &&
            value.fromAsset !== value.toAsset &&
            wsConnected
          ) {
            debouncedQuoteRequest(requestQuote)
          }
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [debouncedFromAmount, form, requestQuote, wsConnected])

  // Function to copy error details to clipboard
  const copyToClipboard = (text: string) => {
    copyToClipboardUtil(text, t)
  }

  // Use our utility function to create a swap executor
  const executeSwap = useMemo(
    () =>
      createSwapExecutor(
        assets,
        pubKey,
        currentPrice || 0,
        selectedPair,
        parseAssetAmount,
        formatAmount,
        tradablePairs,
        initSwap,
        whitelistTrade,
        execSwap,
        setSwapRecapDetails,
        setShowRecap,
        setErrorMessage,
        t
      ),
    [
      assets,
      pubKey,
      currentPrice,
      selectedPair,
      parseAssetAmount,
      formatAmount,
      tradablePairs,
      initSwap,
      whitelistTrade,
      execSwap,
      setSwapRecapDetails,
      setShowRecap,
      setErrorMessage,
      t,
    ]
  )

  // Check for available channels or onchain balance
  const hasChannels = useMemo(
    () => channels.length > 0 || isUsingOnchainBalance,
    [channels, isUsingOnchainBalance]
  )

  // Check for tradable pairs
  const hasTradablePairs = useMemo(
    () => tradablePairs.length > 0,
    [tradablePairs]
  )

  // Update the getAssetOptions function to map asset IDs to tickers for UI display
  const getAssetOptions = useCallback(
    (excludeAsset: string = '', isFromField: boolean = false) => {
      const safeAssets = assets || []
      // Get all unique assets from tradable pairs
      let allPairAssets = tradablePairs
        .flatMap((pair) => [pair.base_asset, pair.quote_asset])
        .filter((asset): asset is string => !!asset)
        .filter((asset, index, self) => self.indexOf(asset) === index)

      // When using onchain balance (no channels), restrict asset selection
      if (isUsingOnchainBalance && !hasTradableChannels(channels)) {
        if (isFromField) {
          // For "from" field, only allow BTC
          allPairAssets = allPairAssets.filter((asset) => asset === 'BTC')
        } else {
          // For "to" field, exclude BTC (only allow buying assets)
          allPairAssets = allPairAssets.filter((asset) => asset !== 'BTC')
        }
      }

      // Ensure we're comparing by ticker if excludeAsset is a ticker
      const excludeAssetId = mapTickerToAssetId(excludeAsset, tradablePairs)

      // Include all assets that are part of a valid trading pair
      // This ensures all tradable assets appear in the dropdown
      const tradableAssets = allPairAssets
        // Remove the currently selected asset from options
        .filter((asset) => {
          const assetId = mapTickerToAssetId(asset, tradablePairs)
          return assetId !== excludeAssetId
        })
        .map((asset) => {
          // Always display the ticker for the asset
          const displayTicker = isAssetId(asset)
            ? mapAssetIdToTicker(asset, safeAssets, tradablePairs)
            : asset

          // Get the asset ID for this asset
          const assetId = isAssetId(asset)
            ? asset
            : mapTickerToAssetId(asset, tradablePairs)

          return {
            assetId: assetId,
            disabled: false,
            ticker: displayTicker,
            value: asset,
          }
        })

      return tradableAssets
    },
    [tradablePairs, assets, isUsingOnchainBalance, channels]
  )

  // Memoized asset options for both fields to prevent recomputation on every render
  const fromAssetOptions = useMemo(
    () => (form ? getAssetOptions(form.getValues()?.toAsset ?? '', true) : []),
    [
      getAssetOptions,
      form?.getValues()?.toAsset,
      tradablePairs,
      isUsingOnchainBalance,
    ]
  )

  const toAssetOptions = useMemo(
    () =>
      form ? getAssetOptions(form.getValues()?.fromAsset ?? '', false) : [],
    [
      getAssetOptions,
      form?.getValues()?.fromAsset,
      tradablePairs,
      isUsingOnchainBalance,
    ]
  )

  // Improved window focus event listener with better logic
  useEffect(() => {
    if (!makerConnectionUrl) return

    // Track if the page has been in the background
    let wasInBackground = false
    let reconnectTimeoutId: number | null = null

    // Handler for when the page loses focus
    const handleBlur = () => {
      logger.debug('Market maker page lost focus')
      wasInBackground = true
      // Clear any pending reconnect attempts
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId)
        reconnectTimeoutId = null
      }
    }

    // Handler for when the page gains focus
    const handleFocus = async () => {
      if (wasInBackground && !wsConnected && isWebSocketInitialized) {
        // Enhanced throttling - check both time and last successful connection
        const now = Date.now()
        const timeSinceLastAttempt = now - lastReconnectAttemptRef.current
        const timeSinceLastSuccess = now - lastSuccessfulConnectionRef.current

        // Only attempt reconnection if:
        // 1. Enough time has passed since last attempt (5 seconds)
        // 2. We haven't had a successful connection very recently (10 seconds)
        // 3. We're not currently initializing
        if (
          timeSinceLastAttempt < 5000 ||
          timeSinceLastSuccess < 10000 ||
          isInitializingRef.current
        ) {
          logger.debug('Focus-based reconnection throttled', {
            isInitializing: isInitializingRef.current,
            timeSinceLastAttempt,
            timeSinceLastSuccess,
          })
          wasInBackground = false
          return
        }

        logger.info(
          'Market maker page was in background and WebSocket is disconnected, scheduling reconnect'
        )
        wasInBackground = false
        lastReconnectAttemptRef.current = now

        // Add a delay before attempting reconnection to let things stabilize
        reconnectTimeoutId = window.setTimeout(async () => {
          try {
            // Check if we have the required connection parameters and are still on the market maker page
            if (!makerConnectionUrl || !pubKey) {
              logger.warn(
                'Cannot reconnect WebSocket: missing connection parameters (pubKey required)'
              )
              return
            }

            // Double-check that we're still disconnected before attempting reconnect
            if (webSocketService.isConnected()) {
              logger.info(
                'WebSocket already connected, skipping focus-based reconnect'
              )
              return
            }

            // Check if we have the required data loaded from both component state and RTK Query
            if (
              !isAssetsLoaded ||
              !isChannelsLoaded ||
              assets.length === 0 ||
              channels.length === 0 ||
              !assetsData?.nia?.length
            ) {
              logger.warn(
                'Cannot reconnect WebSocket: assets or channels not loaded',
                {
                  assetsLength: assets.length,
                  channelsLength: channels.length,
                  isAssetsLoaded,
                  isChannelsLoaded,
                  rtkAssetsLength: assetsData?.nia?.length || 0,
                }
              )
              return
            }

            // Use reset and re-initialize for better reliability
            webSocketService.resetForNewMaker()

            logger.info(
              'Successfully reset WebSocket service after page focus, triggering re-initialization'
            )

            // Reset our initialization state to allow re-initialization
            setIsWebSocketInitialized(false)
            initializationRef.current = false
            isInitializingRef.current = false

            // Wait a moment and check if reconnection worked
            setTimeout(() => {
              if (webSocketService.isConnected()) {
                logger.info('WebSocket reconnected after page focus')
                lastSuccessfulConnectionRef.current = Date.now()
              } else {
                logger.warn(
                  'WebSocket re-initialization attempt completed, connection status will be checked'
                )
              }
            }, 3000)
          } catch (error) {
            logger.error(
              'Error reconnecting WebSocket after page focus:',
              error
            )
          } finally {
            reconnectTimeoutId = null
          }
        }, 2000) // 2 second delay before attempting reconnect
      }

      wasInBackground = false
    }

    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
      // Clean up any pending reconnect
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId)
        reconnectTimeoutId = null
      }
    }
  }, [
    makerConnectionUrl,
    pubKey,
    wsConnected,
    isWebSocketInitialized,
    isAssetsLoaded,
    isChannelsLoaded,
    assets.length,
    channels.length,
    assetsData?.nia?.length,
  ])

  // Update SwapButton to use isQuoteLoading
  const handleReconnectToMaker = async () => {
    try {
      // Only show loading if we don't have a valid quote
      if (!hasValidQuote) {
        setIsQuoteLoading(true)
      }

      // Check if we have the required data before attempting reconnection
      if (
        !isAssetsLoaded ||
        !isChannelsLoaded ||
        !pubKey ||
        !makerConnectionUrl
      ) {
        logger.warn('Cannot reconnect: missing required data', {
          hasMakerUrl: !!makerConnectionUrl,
          hasPubKey: !!pubKey,
          isAssetsLoaded,
          isChannelsLoaded,
        })
        toast.warning(t('tradeMarketMaker.toast.reconnectWait'), {
          autoClose: 3000,
        })
        return
      }

      logger.info('Manual reconnection requested - resetting WebSocket state')

      // Reset the circuit breaker and WebSocket state completely
      webSocketService.resetForNewMaker()
      setIsWebSocketInitialized(false)
      initializationRef.current = false
      isInitializingRef.current = false

      // Clear any existing error messages except unconfirmed channel errors
      setErrorMessage((prev) =>
        prev?.includes('awaiting confirmation') ? prev : null
      )

      // Use the optimized retry method for reconnection
      const pubKeyPrefix = pubKey.slice(0, 16)
      const uuid = crypto.randomUUID()
      const clientId = `${pubKeyPrefix}-${uuid}`

      const reconnected = await initializeWebSocketWithRetry(
        makerConnectionUrl,
        clientId,
        dispatch,
        3, // 3 retry attempts for manual reconnection
        6000 // 6 second timeout per attempt
      )

      if (reconnected) {
        logger.info('Successfully reconnected to market maker')
        lastSuccessfulConnectionRef.current = Date.now()
        setIsWebSocketInitialized(true)

        // Request a quote now that connection is established and ready
        setTimeout(() => {
          debouncedQuoteRequest(requestQuote)
        }, 500) // Small delay to ensure connection is fully stable

        toast.success(t('tradeMarketMaker.toast.reconnectSuccess'), {
          autoClose: 3000,
          toastId: 'market-maker-reconnection-success',
        })
      } else {
        logger.error('Failed to reconnect to market maker after retry attempts')

        // Get diagnostics for troubleshooting
        const diagnostics = webSocketService.getDiagnostics()
        logger.debug('Reconnection failure diagnostics:', diagnostics)

        toast.error(t('tradeMarketMaker.toast.reconnectFailed'), {
          autoClose: 5000,
          toastId: 'market-maker-reconnection-failed',
        })
      }
    } catch (error) {
      logger.error('Error reconnecting to market maker:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      toast.error(
        t('tradeMarketMaker.toast.reconnectError', { error: errorMessage }),
        {
          autoClose: 5000,
          toastId: 'market-maker-reconnection-failed',
        }
      )
    } finally {
      setIsQuoteLoading(false)
    }
  }

  // Submit handler - make sure we check for a valid quote with RFQ ID
  const onSubmit: SubmitHandler<Fields> = async () => {
    const fromAsset = form.getValues().fromAsset
    const toAsset = form.getValues().toAsset
    const fromAmount = parseAssetAmount(form.getValues().from, fromAsset)
    const toAmount = parseAssetAmount(form.getValues().to, toAsset)
    const rfqId = form.getValues().rfq_id

    // Check for zero amounts
    if (fromAmount === 0 || toAmount === 0) {
      setErrorMessage(t('tradeMarketMaker.error.cannotSwapZeroAmounts'))
      return
    }

    // Verify we have a valid RFQ ID first
    if (!rfqId) {
      setErrorMessage(t('tradeMarketMaker.error.noValidQuote'))
      return
    }

    // If using onchain balance (no channels), create a channel order instead of a regular swap
    if (isUsingOnchainBalance && !hasTradableChannels(channels)) {
      logger.info(
        'User is buying asset with onchain balance - opening channel order modal'
      )
      setShowBuyChannelModal(true)
      toast.info(t('tradeMarketMaker.toast.channelOrderCreating'))
      return
    }

    // If user is missing a channel for a specific asset
    // But don't open modal if there's an unconfirmed channel (it's pending)
    if (missingChannelAsset) {
      // Check if the error is about an unconfirmed channel
      if (errorMessage && errorMessage.includes('awaiting confirmation')) {
        toast.warning(t('tradeMarketMaker.error.pleaseWaitChannelConfirmation'))
        return
      }
      setShowBuyChannelModal(true)
      toast.info(
        t('tradeMarketMaker.toast.createAssetChannel', {
          asset: missingChannelAsset.asset,
        })
      )
      return
    }

    // If user has no channels at all (shouldn't reach here due to earlier checks)
    if (!hasTradableChannels(channels)) {
      setShowBuyChannelModal(true)
      toast.info(t('tradeMarketMaker.toast.needChannelToTrade'))
      return
    }

    // Check if the fromAsset has ready channels (for non-BTC assets)
    if (fromAsset !== 'BTC') {
      const fromAssetId = mapTickerToAssetId(fromAsset, tradablePairs)
      const fromAssetStatus = getAssetChannelStatus(channels, fromAssetId)

      if (!fromAssetStatus.hasReadyChannels) {
        if (fromAssetStatus.allUnconfirmed) {
          setErrorMessage(
            t('tradeMarketMaker.error.channelAwaitingConfirmation', {
              asset: fromAsset,
            })
          )
          logger.warn(`Cannot swap: ${fromAsset} channel not ready`)
          return
        } else if (!fromAssetStatus.hasChannels) {
          setErrorMessage(
            t('tradeMarketMaker.error.noAssetChannel', { asset: fromAsset })
          )
          logger.warn(`Cannot swap: No ${fromAsset} channel found`)
          return
        }
      }
    }

    // Check if the toAsset has ready channels (for non-BTC assets)
    if (toAsset !== 'BTC') {
      const toAssetId = mapTickerToAssetId(toAsset, tradablePairs)
      const toAssetStatus = getAssetChannelStatus(channels, toAssetId)

      if (!toAssetStatus.hasReadyChannels) {
        if (toAssetStatus.allUnconfirmed) {
          setErrorMessage(
            t('tradeMarketMaker.error.channelAwaitingConfirmation', {
              asset: toAsset,
            })
          )
          logger.warn(`Cannot swap: ${toAsset} channel not ready`)
          return
        } else if (!toAssetStatus.hasChannels) {
          setErrorMessage(
            t('tradeMarketMaker.error.noAssetChannelReceive', {
              asset: toAsset,
            })
          )
          logger.warn(`Cannot swap: No ${toAsset} channel found`)
          return
        }
      }
    }

    if (
      !hasChannels ||
      !hasTradablePairs ||
      isSwapInProgress ||
      !wsConnected ||
      !hasValidQuote ||
      errorMessage ||
      warningMessage
    ) {
      return
    }

    logger.debug(`Proceeding with swap using RFQ ID: ${rfqId}`)
    setShowConfirmation(true)
  }

  // Wrapper around executeSwap to handle UI state
  const handleExecuteSwap = async (data: Fields) => {
    try {
      await executeSwap(data)
    } finally {
      setShowConfirmation(false)
    }
  }

  // Render the swap form UI with enhanced modern design
  const handleFromAmountChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const baseHandler = createFromAmountChangeHandler(
        form,
        getAssetPrecisionWrapper,
        setDebouncedFromAmount,
        maxFromAmount
      )
      const quoteHandler = createAmountChangeQuoteHandler(requestQuote)

      lastQuoteDirectionRef.current = 'from'
      lastReverseQuoteRef.current = null
      baseHandler(event)
      setDebouncedFromAmount(event.target.value || '')
      quoteHandler(event)
    },
    [form, getAssetPrecisionWrapper, maxFromAmount, requestQuote]
  )

  const handleToAmountChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      // Only trigger reverse quotes for real user input, not programmatic setValue from forward quotes
      if (!event.isTrusted) return

      const baseHandler = createToAmountChangeHandler(
        form,
        getAssetPrecisionWrapper,
        maxToAmount
      )
      const quoteHandler = createToAmountChangeQuoteHandler(requestReverseQuote)

      const value = event.target.value
      if (value && value !== '0') {
        lastQuoteDirectionRef.current = 'to'
      } else {
        lastQuoteDirectionRef.current = 'from'
        lastReverseQuoteRef.current = null
      }
      baseHandler(event)
      quoteHandler(event)
    },
    [form, getAssetPrecisionWrapper, maxToAmount, requestReverseQuote]
  )

  // Simplified loading state based on validation phase
  const isStillLoading =
    loadingPhase === 'initializing' ||
    loadingPhase === 'validating-balance' ||
    loadingPhase === 'validating-channels' ||
    loadingPhase === 'connecting-maker'

  // Debug logging for loading states
  useEffect(() => {
    const debugInfo = {
      hasChannels: channels.length > 0,
      hasTradableChannels: hasTradableChannels(channels),
      hasValidChannelsForTrading,
      isAssetsLoaded,
      isChannelsLoaded,
      isInitialDataLoaded,
      isLoading,
      isPairsLoading,
      isStillLoading,
      isWebSocketInitialized,
      makerConnectionUrl: !!makerConnectionUrl,
      makerUrl: makerConnectionUrl
        ? new URL(makerConnectionUrl).hostname
        : 'none',
      pubKeyAvailable: !!pubKey,
      // Additional debug info
      shouldWaitForWebSocket:
        !!makerConnectionUrl &&
        hasTradableChannels(channels) &&
        !isWebSocketInitialized,

      tradablePairsCount: tradablePairs.length,
      wsConnected,
      wsConnectionState: webSocketService.isConnected()
        ? 'connected'
        : 'disconnected',
    }

    logger.debug('Market Maker Page Loading States:', debugInfo)

    // Log important state changes
    if (!wsConnected && makerConnectionUrl && isWebSocketInitialized) {
      logger.warn(
        'WebSocket initialized but not connected - potential connection issue'
      )
    }

    if (tradablePairs.length === 0 && wsConnected) {
      logger.warn('Connected to maker but no trading pairs available')
    }
  }, [
    isLoading,
    isInitialDataLoaded,
    isChannelsLoaded,
    isAssetsLoaded,
    isPairsLoading,
    hasValidChannelsForTrading,
    isWebSocketInitialized,
    wsConnected,
    makerConnectionUrl,
    tradablePairs.length,
    isStillLoading,
    channels,
    pubKey,
  ])

  // Handle validation actions when user clicks buttons
  const handleDepositAction = useCallback(() => {
    dispatch(uiSliceActions.setModal({ assetId: undefined, type: 'deposit' }))
  }, [dispatch])

  const handleCreateChannelAction = useCallback(() => {
    navigate(CREATE_NEW_CHANNEL_PATH)
  }, [navigate])

  const handleBuyChannelAction = useCallback(() => {
    setShowBuyChannelModal(true)
  }, [])

  // Determine what to show based on loading phase and validation state
  const shouldShowNoChannelsMessage =
    loadingPhase === 'error' && validationError === 'no-trading-pairs'

  const shouldShowInsufficientBalance =
    loadingPhase === 'error' && validationError === 'insufficient-balance'

  const shouldShowNoChannels =
    loadingPhase === 'error' && validationError === 'no-channels'

  const shouldShowWSDisconnectedMessage =
    loadingPhase === 'ready' && !wsConnected && isWebSocketInitialized

  // Helper function to check if a specific asset has only unconfirmed channels
  const hasOnlyUnconfirmedChannels = useCallback(
    (asset: string): boolean => {
      if (!asset || asset === 'BTC') return false

      const assetId = mapTickerToAssetId(asset, tradablePairs)

      logger.debug(`[Channel Check] Asset: ${asset}, AssetId: ${assetId}`)

      // Use the utility function from channelUtils
      const result = hasOnlyUnconfirmedChannelsForAsset(channels, assetId)

      logger.debug(
        `[Channel Check] ${asset} - Has only unconfirmed channels: ${result}`
      )

      return result
    },
    [channels, assets, tradablePairs]
  )

  // Watch for asset changes to trigger re-validation
  const watchedFromAsset = form?.watch('fromAsset')
  const watchedToAsset = form?.watch('toAsset')

  // Check if currently selected assets have only unconfirmed channels
  const fromAssetUnconfirmed = useMemo(() => {
    if (!form || !watchedFromAsset) return false
    return hasOnlyUnconfirmedChannels(watchedFromAsset)
  }, [watchedFromAsset, hasOnlyUnconfirmedChannels])

  const toAssetUnconfirmed = useMemo(() => {
    if (!form || !watchedToAsset) return false
    return hasOnlyUnconfirmedChannels(watchedToAsset)
  }, [watchedToAsset, hasOnlyUnconfirmedChannels])

  // Set error message when asset has unconfirmed channels
  useEffect(() => {
    if (fromAssetUnconfirmed || toAssetUnconfirmed) {
      const unconfirmedAsset = fromAssetUnconfirmed
        ? watchedFromAsset
        : watchedToAsset
      setErrorMessage(
        t('tradeMarketMaker.error.channelAwaitingPlural', {
          asset: unconfirmedAsset,
        })
      )
    } else {
      // Clear the error if it was about unconfirmed channels and now both are confirmed
      setErrorMessage((prev) => {
        if (prev && prev.includes('awaiting confirmation')) {
          return null
        }
        return prev
      })
    }
  }, [
    fromAssetUnconfirmed,
    toAssetUnconfirmed,
    watchedFromAsset,
    watchedToAsset,
    t,
  ])

  // Dynamic loading message based on phase
  const getLoadingMessage = () => {
    switch (loadingPhase) {
      case 'validating-balance':
        return t('tradeMarketMaker.loading.checkingBalance')
      case 'validating-channels':
        return t('tradeMarketMaker.loading.verifyingChannels')
      case 'connecting-maker':
        return t('tradeMarketMaker.loading.connectingMaker')
      default:
        return t('tradeMarketMaker.loading.initializingInfrastructure')
    }
  }

  return (
    <div className="w-full min-h-full overflow-y-auto relative">
      {/* Handle insufficient balance with action buttons */}
      {shouldShowInsufficientBalance ? (
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="max-w-2xl w-full bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800/50 p-8">
            <div className="flex flex-col items-center space-y-6">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
                <Wallet className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-white">
                {t('tradeMarketMaker.noChannels.insufficientBalance')}
              </h2>
              <p className="text-slate-400 text-center text-base max-w-md">
                {t('tradeMarketMaker.noChannels.insufficientBalanceMessage')}
              </p>

              <div className="flex gap-4 pt-4">
                <button
                  className="px-6 py-3 bg-primary hover:bg-primary-emphasis text-primary-foreground rounded-xl
                           font-medium transition-colors flex items-center gap-2 text-base
                           shadow-lg hover:shadow-blue-500/25 hover:scale-105"
                  onClick={handleDepositAction}
                >
                  <Wallet className="w-5 h-5" />
                  {t('tradeMarketMaker.noChannels.depositBitcoin')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : /* Handle no channels with action buttons */
      shouldShowNoChannels ? (
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="max-w-2xl w-full bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800/50 p-8">
            <div className="flex flex-col items-center space-y-6">
              <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center">
                <Link className="w-8 h-8 text-blue-500" />
              </div>
              <h2 className="text-2xl font-bold text-white">
                {t('tradeMarketMaker.noChannels.noChannelsAvailable')}
              </h2>
              <p className="text-slate-400 text-center text-base max-w-md">
                {t('tradeMarketMaker.noChannels.noChannelsMessage')}
              </p>

              <div className="flex gap-4 pt-4">
                <button
                  className="px-6 py-3 bg-primary hover:bg-primary-emphasis text-primary-foreground rounded-xl
                           font-medium transition-colors flex items-center gap-2 text-base
                           shadow-lg hover:shadow-blue-500/25 hover:scale-105"
                  onClick={handleCreateChannelAction}
                >
                  <Plus className="w-5 h-5" />
                  {t('tradeMarketMaker.noChannels.createChannel')}
                </button>
                <button
                  className="px-6 py-3 border border-blue-500/50 text-blue-500 rounded-xl
                           hover:bg-blue-500/10 transition-colors flex items-center gap-2 text-base
                           shadow-lg hover:shadow-blue-500/25 hover:scale-105"
                  onClick={handleBuyChannelAction}
                >
                  <ShoppingCart className="w-5 h-5" />
                  {t('tradeMarketMaker.noChannels.buyFromLSP')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : /* Show existing NoTradingChannelsMessage for maker compatibility issues */
      shouldShowNoChannelsMessage ? (
        <NoTradingChannelsMessage
          {...createTradingChannelsMessageProps(
            assets,
            tradablePairs,
            hasEnoughBalance,
            navigate,
            refreshAmounts
          )}
        />
      ) : (
        <div className="w-full min-h-full relative">
          <div className="w-full max-w-screen-xl mx-auto px-4 py-2">
            {isStillLoading ? (
              <div className="flex flex-col justify-center items-center min-h-[60vh] gap-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/30 via-blue-500/25 to-purple-600/30 rounded-full blur-2xl"></div>
                  <div className="relative bg-gradient-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 backdrop-blur-2xl rounded-3xl p-6 border border-slate-600/50 shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-cyan-400/3 to-transparent rounded-3xl"></div>
                    <div className="w-10 h-10 border-4 border-cyan-500/50 border-t-cyan-400 rounded-full animate-spin"></div>
                  </div>
                </div>
                <div className="text-center space-y-4 max-w-lg">
                  <p className="text-white font-bold text-xl bg-gradient-to-r from-white via-cyan-100 to-blue-100 bg-clip-text text-transparent">
                    {loadingPhase === 'connecting-maker'
                      ? t('tradeMarketMaker.loading.connectingToMaker')
                      : t('tradeMarketMaker.loading.initializingInterface')}
                  </p>
                  <p className="text-slate-300 text-base leading-relaxed">
                    {getLoadingMessage()}
                  </p>
                  <div className="w-80 h-2 bg-slate-800/60 rounded-full overflow-hidden backdrop-blur-sm border border-slate-600/40 shadow-inner">
                    <div className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 rounded-full animate-pulse shadow-lg"></div>
                  </div>
                </div>
              </div>
            ) : shouldShowWSDisconnectedMessage ? (
              <div className="flex justify-center items-center min-h-[60vh]">
                <WebSocketDisconnectedMessage
                  makerUrl={makerConnectionUrl}
                  onMakerChange={refreshAmounts}
                  onRetryConnection={handleReconnectToMaker}
                />
              </div>
            ) : (
              <div className="flex justify-center items-start py-4">
                <MarketMakerFormPanel
                  assets={assets}
                  bitcoinUnit={bitcoinUnit}
                  channels={channels}
                  currentPrice={currentPrice}
                  displayAsset={displayAsset}
                  errorMessage={errorMessage}
                  fees={fees}
                  form={form}
                  formatAmount={formatAmount}
                  fromAssetOptions={fromAssetOptions}
                  fromAssetUnconfirmed={fromAssetUnconfirmed}
                  getAssetPrecision={getAssetPrecisionWrapper}
                  hasChannels={hasChannels}
                  hasTradablePairs={hasTradablePairs}
                  hasValidQuote={hasValidQuote}
                  isPriceLoading={isPriceLoading}
                  isQuoteLoading={isQuoteLoading}
                  isSwapInProgress={isSwapInProgress}
                  isFromAmountLoading={isFromAmountLoading}
                  isToAmountLoading={isToAmountLoading}
                  isUsingOnchainBalance={isUsingOnchainBalance}
                  maxFromAmount={maxFromAmount}
                  maxOutboundHtlcSat={max_outbound_htlc_sat}
                  maxToAmount={maxToAmount}
                  minFromAmount={minFromAmount}
                  missingChannelAsset={missingChannelAsset}
                  onAssetChange={handleAssetChange}
                  onCopyError={copyToClipboard}
                  onFromAmountChange={handleFromAmountChange}
                  onMakerChange={refreshAmounts}
                  onReconnectToMaker={handleReconnectToMaker}
                  onRefreshExchangeRate={() =>
                    debouncedQuoteRequest(requestQuote)
                  }
                  onSizeClick={onSizeClick}
                  onSubmit={onSubmit}
                  onSwapAssets={onSwapAssets}
                  onToAmountChange={handleToAmountChange}
                  quoteResponse={quoteResponse}
                  selectedPair={selectedPair}
                  selectedSize={selectedSize}
                  showConfirmation={showConfirmation}
                  toAssetOptions={toAssetOptions}
                  toAssetUnconfirmed={toAssetUnconfirmed}
                  tradablePairs={tradablePairs}
                  warningMessage={warningMessage}
                  wsConnected={wsConnected}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <SwapConfirmation
        bitcoinUnit={bitcoinUnit}
        exchangeRate={currentPrice || 0}
        fromAmount={form.getValues().from}
        fromAsset={form.getValues().fromAsset}
        getAssetPrecision={getAssetPrecisionWrapper}
        isLoading={isSwapInProgress}
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={() => handleExecuteSwap(form.getValues())}
        selectedPair={selectedPair}
        toAmount={form.getValues().to}
        toAsset={form.getValues().toAsset}
      />

      {swapRecapDetails && (
        <SwapRecap
          bitcoinUnit={bitcoinUnit}
          getAssetPrecision={getAssetPrecisionWrapper}
          isOpen={showRecap}
          onClose={() => {
            setShowRecap(false)
            refreshChannelsAndAmounts()
          }}
          swapDetails={swapRecapDetails}
        />
      )}

      <BuyChannelModal
        isOpen={showBuyChannelModal}
        onClose={() => setShowBuyChannelModal(false)}
        onSuccess={() => {
          setShowBuyChannelModal(false)
          toast.success(t('tradeMarketMaker.toast.channelCreatedSuccess'))
          setTimeout(() => {
            refreshChannelsAndAmounts()
          }, 1000)
        }}
        preselectedAsset={(() => {
          // Use the missingChannelAsset state if available
          if (missingChannelAsset) {
            const amount = missingChannelAsset.isFromAsset
              ? parseFloat(form.getValues().from || '0')
              : parseFloat(form.getValues().to || '0')

            return {
              amount: amount,
              assetId: missingChannelAsset.assetId,
            }
          }

          const toAsset = form.getValues().toAsset
          const fromAsset = form.getValues().fromAsset
          const toAmount = parseFloat(form.getValues().to || '0')

          // Check which asset is missing and preselect it
          const channelAssetIds = new Set(
            channels
              .filter((c) => c.ready)
              .map((c) => c.asset_id)
              .filter((id): id is string => id !== null)
          )
          channelAssetIds.add('BTC')

          // If receiving asset is missing, preselect it
          if (
            toAsset !== 'BTC' &&
            !channelAssetIds.has(selectedPair?.quote_asset_id || '')
          ) {
            return {
              amount: toAmount,
              assetId: selectedPair?.quote_asset_id || toAsset,
            }
          }

          // If sending asset is missing, preselect it
          if (
            fromAsset !== 'BTC' &&
            !channelAssetIds.has(selectedPair?.base_asset_id || '')
          ) {
            const fromAmount = parseFloat(form.getValues().from || '0')
            return {
              amount: fromAmount,
              assetId: selectedPair?.base_asset_id || fromAsset,
            }
          }

          // Fallback to toAsset if it's not BTC
          if (toAsset && toAsset !== 'BTC') {
            return {
              amount: toAmount,
              assetId: selectedPair?.quote_asset_id || toAsset,
            }
          }

          return undefined
        })()}
      />
    </div>
  )
}

// Export with a named export for the trade hub
export const MarketMakerComponent = Component
