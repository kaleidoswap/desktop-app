import { Copy, Wallet, Link, Plus, ShoppingCart } from 'lucide-react'
import { useCallback, useEffect, useState, useMemo, useRef } from 'react'
import { useForm, SubmitHandler } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

import { webSocketService } from '../../../app/hubs/websocketService'
import {
  CREATE_NEW_CHANNEL_PATH,
  ORDER_CHANNEL_PATH,
} from '../../../app/router/paths'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks'
import { SwapConfirmation } from '../../../components/SwapConfirmation'
import { SwapRecap } from '../../../components/SwapRecap'
import {
  SwapInputField,
  ExchangeRateSection,
  SwapButton,
  MakerSelector,
  FeeSection,
  NoTradingChannelsMessage,
  createTradingChannelsMessageProps,
  WebSocketDisconnectedMessage,
  ChannelsNotReadyMessage,
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
import { SwapIcon } from '../../../icons/Swap'
import { makerApi, TradingPair } from '../../../slices/makerApi/makerApi.slice'
import {
  setTradingPairs,
  clearQuoteError,
} from '../../../slices/makerApi/pairs.slice'
import {
  nodeApi,
  Channel,
  NiaAsset,
  SwapStatus,
} from '../../../slices/nodeApi/nodeApi.slice'
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
  getAvailableAssets as getAvailableAssetsUtil,
  createFetchAndSetPairsHandler,
  mapAssetIdToTicker,
  mapTickerToAssetId,
  isAssetId,
} from './assetUtils'
import { hasTradableChannels, logChannelDiagnostics } from './channelUtils'

// Import our utility modules
import { getValidationError } from './errorMessages'
import {
  createFromAmountChangeHandler,
  createToAmountChangeHandler,
} from './formUtils'
import {
  createQuoteRequestHandler,
  startQuoteRequestTimer,
  stopQuoteRequestTimer,
  createAmountChangeQuoteHandler,
  debouncedQuoteRequest,
  clearDebouncedQuoteRequest,
} from './quoteUtils'
import {
  createSwapExecutor,
  copyToClipboard as copyToClipboardUtil,
  SwapDetails as SwapDetailsType,
} from './swapUtils'
import { Fields } from './types'
import { initializeWebSocketWithRetry } from './websocketUtils'

export const Component = () => {
  // Declare makerConnectionUrl at the very top
  const makerConnectionUrl = useAppSelector(
    (state) => state.nodeSettings.data.default_maker_url
  )

  // Loading states optimization - replace multiple loading states with simplified approach
  const [loadingPhase, setLoadingPhase] = useState<
    | 'initializing'
    | 'validating-balance'
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
  const [isPriceLoading, setIsPriceLoading] = useState(true)
  const [isQuoteLoading, setIsQuoteLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [fees, setFees] = useState({
    baseFee: 0,
    feeRate: 0,
    totalFee: 0,
    variableFee: 0,
  })

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

  // Add state for quote validity tracking
  const [hasValidQuote, setHasValidQuote] = useState(false)
  const [quoteExpiresAt, setQuoteExpiresAt] = useState<number | null>(null)

  // Component mount state management
  const isMountedRef = useRef(false)
  const initializationRef = useRef(false)
  const lastSuccessfulConnectionRef = useRef(0)
  const errorMessageTimeoutRef = useRef<number | null>(null)

  const isInitializingRef = useRef(false)
  const setupRunningRef = useRef(false)

  // Fetch list of swaps and poll for updates
  const { data: swapsData } = nodeApi.useListSwapsQuery(undefined, {
    pollingInterval: 5000, // Poll every 5 seconds
    refetchOnMountOrArgChange: true,
  })

  // Derive isSwapInProgress from swapsData
  const isSwapInProgress = useMemo(() => {
    if (!swapsData) return false
    const { maker, taker } = swapsData
    const pendingOrWaitingMaker = maker.some(
      (swap) =>
        swap.status === SwapStatus.Pending || swap.status === SwapStatus.Waiting
    )
    const pendingOrWaitingTaker = taker.some(
      (swap) =>
        swap.status === SwapStatus.Pending || swap.status === SwapStatus.Waiting
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
          prevSwap.status !== SwapStatus.Succeeded &&
          currentSwap.status === SwapStatus.Succeeded
        ) {
          // Create a more detailed success message
          const getAssetTicker = (assetId: string | null) => {
            if (!assetId || assetId === 'BTC') return 'BTC'
            const asset = assets.find((a) => a.asset_id === assetId)
            return asset?.ticker || assetId.slice(0, 8) + '...'
          }

          const fromTicker = getAssetTicker(currentSwap.from_asset)
          const toTicker = getAssetTicker(currentSwap.to_asset)

          let message = `Swap completed successfully!`

          // Add asset details if available
          if (currentSwap.qty_from && currentSwap.qty_to) {
            // Format amounts properly
            let formattedFromAmount = currentSwap.qty_from
            let formattedToAmount = currentSwap.qty_to

            // Handle BTC conversion from millisats to sats if needed
            if (currentSwap.from_asset === 'BTC' || fromTicker === 'BTC') {
              formattedFromAmount = Math.round(
                currentSwap.qty_from / MSATS_PER_SAT
              )
            }
            if (currentSwap.to_asset === 'BTC' || toTicker === 'BTC') {
              formattedToAmount = Math.round(currentSwap.qty_to / MSATS_PER_SAT)
            }

            // Use formatAmount to add proper number formatting with commas
            const displayFromAmount = formatAmount(
              formattedFromAmount,
              fromTicker
            )
            const displayToAmount = formatAmount(formattedToAmount, toTicker)

            // Get display asset names (handles SAT vs BTC based on user preference)
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
    checkForSuccessfulSwaps(prevSwaps.maker, currentSwaps.maker, 'maker')
    checkForSuccessfulSwaps(prevSwaps.taker, currentSwaps.taker, 'taker')

    // Update the ref with current data
    previousSwapsRef.current = swapsData
  }, [swapsData, assets])

  // minLoadingDone effect is already declared earlier in the component

  const wsConnected = useAppSelector((state) => state.pairs.wsConnected)
  const quoteError = useAppSelector((state) => state.pairs.quoteError)
  const bitcoinUnit = useAppSelector((state) => state.settings.bitcoinUnit)

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
  const [quoteResponseTimestamp, setQuoteResponseTimestamp] = useState(0)

  // Update quote request handler with loading state setters
  const requestQuote = useMemo(
    () =>
      createQuoteRequestHandler(
        form,
        parseAssetAmount,
        assets,
        setIsQuoteLoading,
        setIsToAmountLoading,
        () => hasValidQuote,
        maxFromAmount,
        minFromAmount
      ),
    [
      form,
      parseAssetAmount,
      assets,
      hasValidQuote,
      maxFromAmount,
      minFromAmount,
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

    // Map the from/toAsset to asset IDs for lookup
    const fromAssetId = mapTickerToAssetId(fromAsset, assets)
    const toAssetId = mapTickerToAssetId(toAsset, assets)

    // Only look for exact match - no fallback to other quotes
    const key = `${fromAssetId}/${toAssetId}/${fromAmount}`
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
                setErrorMessage(
                  'Unable to get quote from market maker. Please try again.'
                )
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
      quoteResponse.to_amount !== lastQuoteResponseRef.current.to_amount ||
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

        // Update the fees
        if (quoteResponse.fee) {
          setFees({
            baseFee: quoteResponse.fee.base_fee,
            feeRate: quoteResponse.fee.fee_rate,
            totalFee: quoteResponse.fee.final_fee,
            variableFee: quoteResponse.fee.variable_fee,
          })
        }

        // Update quote validity tracking
        setHasValidQuote(true)
        setQuoteExpiresAt(quoteResponse.expires_at || null)

        // Format and update the 'to' field with the received amount
        const toTickerForUI = mapAssetIdToTicker(quoteResponse.to_asset, assets)

        // If to_asset is BTC, convert from millisats to sats
        let displayToAmount = quoteResponse.to_amount
        if (quoteResponse.to_asset === 'BTC' || toTickerForUI === 'BTC') {
          displayToAmount = Math.round(displayToAmount / MSATS_PER_SAT)
        }

        const formattedToAmount = formatAmount(displayToAmount, toTickerForUI)

        form.setValue('to', formattedToAmount)

        // Important: Save the RFQ ID from the quote to use when executing the swap
        if (quoteResponse.rfq_id) {
          form.setValue('rfq_id', quoteResponse.rfq_id)
        }

        // Clear any validation errors if we got a valid quote
        setErrorMessage(null)
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
  const [taker] = nodeApi.endpoints.taker.useLazyQuery()
  const [initSwap] = makerApi.endpoints.initSwap.useLazyQuery()
  const [execSwap] = makerApi.endpoints.execSwap.useLazyQuery()
  const [getPairs] = makerApi.endpoints.getPairs.useLazyQuery()
  const [btcBalance] = nodeApi.endpoints.btcBalance.useLazyQuery()

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
      setAssets(assetsData.nia)
      setIsAssetsLoaded(true)
    } else if (assetsData === undefined) {
      // Reset loading state if assets data becomes unavailable
      setIsAssetsLoaded(false)
    }
  }, [assetsData])

  const getAssetPrecisionWrapper = useCallback(
    (asset: string): number => {
      return getAssetPrecision(asset, bitcoinUnit, assets)
    },
    [assets, bitcoinUnit]
  )

  // Display asset handler that shows tickers instead of asset IDs
  const displayAsset = useCallback(
    (asset: string) => {
      // First map asset ID to ticker if needed
      const assetForDisplay = isAssetId(asset)
        ? mapAssetIdToTicker(asset, assets)
        : asset

      // Then apply Bitcoin unit conversion if needed
      return getDisplayAsset(assetForDisplay, bitcoinUnit)
    },
    [bitcoinUnit, assets]
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

          userFriendlyError = `Amount must be between ${formattedMin} and ${formattedMax} ${displayAssetName}.`
        } else {
          userFriendlyError =
            'The amount you entered is outside the valid range for this trading pair.'
        }
      } else if (quoteError.includes('No tradable pair found')) {
        userFriendlyError = 'This trading pair is not currently available.'
      } else if (quoteError.includes('Invalid asset')) {
        userFriendlyError = 'One of the selected assets is not valid.'
      } else if (quoteError.includes('Failed to calculate quote')) {
        userFriendlyError =
          'Unable to calculate quote. Please try a different amount.'
      }

      // Show the user-friendly error message
      setErrorMessage(userFriendlyError)

      // Clear the error from the store after handling it
      dispatch(clearQuoteError())
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
      const assetsList = assetsData.nia

      if (asset === 'BTC') {
        if (channels.length === 0) {
          logger.warn('No channels available for BTC')
          return 0
        }

        const channelHtlcLimits = channels.map(
          (c) => c.next_outbound_htlc_limit_msat / MSATS_PER_SAT
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
        const maxTradableAmount = maxHtlcLimit - RGB_HTLC_MIN_SAT
        setMaxOutboundHtlcSat(maxTradableAmount)
        return maxTradableAmount
      } else {
        const assetInfo = assetsList.find((a) => a.ticker === asset)
        if (!assetInfo) {
          logger.warn(`No asset info found for ticker: ${asset}`)
          return 0
        }

        const assetChannels = channels.filter(
          (c: Channel) => c.asset_id === assetInfo.asset_id
        )
        if (assetChannels.length === 0) {
          logger.warn(
            `No channels found for asset: ${asset} (asset_id: ${assetInfo.asset_id})`
          )
          return 0
        }

        let maxAssetAmount = 0
        if (isFrom) {
          const localAmounts = assetChannels.map(
            (c: Channel) => c.asset_local_amount
          )
          maxAssetAmount =
            localAmounts.length > 0 ? Math.max(...localAmounts) : 0
        } else {
          const remoteAmounts = assetChannels.map(
            (c: Channel) => c.asset_remote_amount
          )
          maxAssetAmount =
            remoteAmounts.length > 0 ? Math.max(...remoteAmounts) : 0
        }
        return maxAssetAmount
      }
    },
    [channels, assetsData]
  )

  // Enhanced updateMinMaxAmounts to ensure consistent validation
  const updateMinMaxAmounts = useCallback(async () => {
    if (selectedPair) {
      const fromAsset = form.getValues().fromAsset
      const toAsset = form.getValues().toAsset

      let minOrderSize: number
      if (!isPairInverted(fromAsset, toAsset)) {
        minOrderSize = selectedPair.min_base_order_size
        if (fromAsset === 'BTC') {
          // For BTC, convert from millisats to sats
          minOrderSize = minOrderSize / MSATS_PER_SAT
        }
      } else {
        minOrderSize = selectedPair.min_quote_order_size
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

      // Check if current "to" amount exceeds the new max
      const currentToAmount = parseAssetAmount(form.getValues().to, toAsset)
      if (currentToAmount > newMaxToAmount) {
        const formattedMaxToAmount = formatAmount(newMaxToAmount, toAsset)
        const displayedAsset = displayAsset(toAsset)
        const errorMsg = `You can only receive up to ${formattedMaxToAmount} ${displayedAsset}.`
        logger.warn(
          `Current to amount (${currentToAmount}) exceeds maximum receivable amount (${newMaxToAmount})`
        )
        setErrorMessage(errorMsg)
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
  const onSwapAssets = useMemo(
    () =>
      createSwapAssetsHandler(
        selectedPair,
        form,
        calculateMaxTradableAmount,
        updateMinMaxAmounts,
        setMaxFromAmount
      ),
    [
      selectedPair,
      form,
      calculateMaxTradableAmount,
      updateMinMaxAmounts,
      setMaxFromAmount,
    ]
  )

  // Update handleAssetChange to save preferences
  const handleAssetChange = useMemo(() => {
    const originalHandler = createAssetChangeHandler(
      form,
      tradablePairs,
      updateMinMaxAmounts,
      calculateMaxTradableAmount,
      setFromAmount,
      setSelectedPair,
      setMaxFromAmount
    )

    // Return enhanced handler that also saves preferences
    return (field: 'fromAsset' | 'toAsset', value: string) => {
      // Clear any existing quote error when user changes assets
      dispatch(clearQuoteError())

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
        setMaxToAmount
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
    ]
  )

  // Helper function to refresh channels and then amounts
  const refreshChannelsAndAmounts = useCallback(async () => {
    try {
      // First refresh channel data to get updated balances
      const channelsResponse = await listChannels()
      if ('data' in channelsResponse && channelsResponse.data) {
        setChannels(channelsResponse.data.channels)
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
        isPriceLoading
      )

      setErrorMessage(errorMsg)
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
  ])

  // Create handler for asset changes
  const getAvailableAssets = useCallback((): string[] => {
    // Use our utility function but pass in the channels and assets
    logChannelDiagnostics(channels)
    return getAvailableAssetsUtil(channels, assets)
  }, [channels, assets])

  // Use our utility function to create the fetch and set pairs handler
  const fetchAndSetPairs = useMemo(
    () =>
      createFetchAndSetPairsHandler(
        getPairs,
        dispatch,
        channels,
        // Use RTK Query data directly to ensure we have the latest assets
        assetsData?.nia || [],
        form,
        formatAmount,
        setTradingPairs,
        setTradablePairs,
        setSelectedPair,
        setIsPairsLoading
      ),
    [
      getPairs,
      dispatch,
      channels,
      assetsData?.nia,
      form,
      formatAmount,
      isInitialDataLoaded,
      isAssetsLoaded,
      isChannelsLoaded,
    ]
  )

  // Create a version that accepts fresh data as parameters
  const fetchAndSetPairsWithData = useCallback(
    (freshChannels: Channel[], freshAssets: NiaAsset[]) =>
      createFetchAndSetPairsHandler(
        getPairs,
        dispatch,
        freshChannels,
        freshAssets,
        form,
        formatAmount,
        setTradingPairs,
        setTradablePairs,
        setSelectedPair,
        setIsPairsLoading
      )(),
    [
      getPairs,
      dispatch,
      form,
      formatAmount,
      setTradingPairs,
      setTradablePairs,
      setSelectedPair,
      setIsPairsLoading,
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
        setErrorMessage(null)
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
        setPubKey(nodeInfoResponse.data.pubkey)
        logger.debug('✅ Node info retrieved, pubkey set')

        // Validate channels response
        if (!('data' in channelsResponse) || !channelsResponse.data) {
          logger.error('❌ Failed to get channels data')
          throw new Error('Failed to get channels information')
        }

        const channelsList = channelsResponse.data.channels

        if (channelsList.length === 0) {
          logger.warn('❌ No channels found - lets check the balance')
          setLoadingPhase('validating-balance')

          // Get balance info
          const balanceResponse = await btcBalance({ skip_sync: false })
          if (!('data' in balanceResponse) || !balanceResponse.data) {
            logger.error('❌ Failed to get balance data')
            throw new Error('Failed to get balance information')
          }

          const { vanilla } = balanceResponse.data
          const hasEnough = vanilla.spendable >= MIN_CHANNEL_CAPACITY
          setHasEnoughBalance(hasEnough)

          logger.info(
            `💰 Balance check: ${vanilla.spendable} sats (min required: ${MIN_CHANNEL_CAPACITY})`
          )
          if (!hasEnough) {
            logger.warn(
              '❌ No channels and insufficient balance - redirecting to deposit'
            )
            setLoadingPhase('error')
            setValidationError('insufficient-balance')
            return
          } else {
            // No channels but sufficient balance - show no channels message
            logger.warn(
              '❌ No channels found but sufficient balance - redirecting to channel creation'
            )
            setLoadingPhase('error')
            setValidationError('no-channels')
            return
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
        setChannels(channelsList)
        setIsChannelsLoaded(true)
        setAssets(assetsData.nia)
        setIsAssetsLoaded(true)

        // Check if we have channels but none are ready - if so, set ready phase to show channels not ready message
        const readyChannels = channelsList.filter((c) => c.ready)
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
          channelsList,
          assetsData.nia
        )

        logger.info(
          `📈 Trading pairs result: found=${pairsFound}, count=${tradablePairs.length}`,
          {
            assetsAvailable: assetsData.nia.length,
            channelsAvailable: channelsList.length,
            channelsReady: channelsList.filter((c) => c.ready).length,
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
      } catch (error) {
        logger.error('💥 Error during optimized setup:', error)
        setLoadingPhase('error')
        setValidationError('setup-error')
        toast.error(
          'Failed to initialize the trading interface. Please try again.'
        )
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
    listChannels,
    fetchAndSetPairs,
    makerConnectionUrl,
  ])

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

          toast.error(
            'Failed to establish live connection to market maker. Please check the maker URL and try again.'
          )
        }
      } catch (error) {
        logger.error('Error initializing WebSocket:', error)
        toast.error('Connection error occurred. Trading may be limited.')
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
    copyToClipboardUtil(text)
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
        taker,
        execSwap,
        setSwapRecapDetails,
        setShowRecap,
        setErrorMessage
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
      taker,
      execSwap,
      setSwapRecapDetails,
      setShowRecap,
      setErrorMessage,
    ]
  )

  // Check for available channels
  const hasChannels = useMemo(() => channels.length > 0, [channels])

  // Check for tradable pairs
  const hasTradablePairs = useMemo(
    () => tradablePairs.length > 0,
    [tradablePairs]
  )

  // Update the getAssetOptions function to map asset IDs to tickers for UI display
  const getAssetOptions = useCallback(
    (excludeAsset: string = '') => {
      const safeAssets = assets || []
      // Get all unique assets from tradable pairs
      const allPairAssets = tradablePairs
        .flatMap((pair) => [pair.base_asset, pair.quote_asset])
        .filter((asset, index, self) => self.indexOf(asset) === index)

      // Ensure we're comparing by ticker if excludeAsset is a ticker
      const excludeAssetId = mapTickerToAssetId(excludeAsset, safeAssets)

      // Include all assets that are part of a valid trading pair
      // This ensures all tradable assets appear in the dropdown
      const tradableAssets = allPairAssets
        // Remove the currently selected asset from options
        .filter((asset) => {
          const assetId = mapTickerToAssetId(asset, safeAssets)
          return assetId !== excludeAssetId
        })
        .map((asset) => {
          // Always display the ticker for the asset
          const displayTicker = isAssetId(asset)
            ? mapAssetIdToTicker(asset, safeAssets)
            : asset

          // Get the asset ID for this asset
          const assetId = isAssetId(asset)
            ? asset
            : mapTickerToAssetId(asset, safeAssets)

          return {
            assetId: assetId,
            disabled: false,
            ticker: displayTicker,
            value: asset,
          }
        })

      return tradableAssets
    },
    [tradablePairs, getAvailableAssets, assets]
  )

  // Memoized asset options for both fields to prevent recomputation on every render
  const fromAssetOptions = useMemo(
    () => (form ? getAssetOptions(form.getValues()?.toAsset ?? '') : []),
    [getAssetOptions, form?.getValues()?.toAsset, tradablePairs]
  )

  const toAssetOptions = useMemo(
    () => (form ? getAssetOptions(form.getValues()?.fromAsset ?? '') : []),
    [getAssetOptions, form?.getValues()?.fromAsset, tradablePairs]
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
        toast.warning(
          'Please wait for the app to finish loading before reconnecting.',
          {
            autoClose: 3000,
          }
        )
        return
      }

      logger.info('Manual reconnection requested - resetting WebSocket state')

      // Reset the circuit breaker and WebSocket state completely
      webSocketService.resetForNewMaker()
      setIsWebSocketInitialized(false)
      initializationRef.current = false
      isInitializingRef.current = false

      // Clear any existing error messages
      setErrorMessage(null)

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

        toast.success('Reconnected to market maker successfully!', {
          autoClose: 3000,
          toastId: 'market-maker-reconnection-success',
        })
      } else {
        logger.error('Failed to reconnect to market maker after retry attempts')

        // Get diagnostics for troubleshooting
        const diagnostics = webSocketService.getDiagnostics()
        logger.debug('Reconnection failure diagnostics:', diagnostics)

        toast.error(
          'Failed to reconnect to market maker. Please check the maker URL and your network connection.',
          {
            autoClose: 5000,
            toastId: 'market-maker-reconnection-failed',
          }
        )
      }
    } catch (error) {
      logger.error('Error reconnecting to market maker:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Failed to reconnect: ${errorMessage}`, {
        autoClose: 5000,
        toastId: 'market-maker-reconnection-failed',
      })
    } finally {
      setIsQuoteLoading(false)
    }
  }

  // Submit handler - make sure we check for a valid quote with RFQ ID
  const onSubmit: SubmitHandler<Fields> = async () => {
    const fromAmount = parseAssetAmount(
      form.getValues().from,
      form.getValues().fromAsset
    )
    const toAmount = parseAssetAmount(
      form.getValues().to,
      form.getValues().toAsset
    )
    const rfqId = form.getValues().rfq_id

    // Check for zero amounts
    if (fromAmount === 0 || toAmount === 0) {
      setErrorMessage('Cannot swap zero amounts. Please enter a valid amount.')
      return
    }

    // Verify we have a valid RFQ ID for executing the swap
    if (!rfqId) {
      setErrorMessage(
        'No valid quote available. Please try refreshing the quote.'
      )
      return
    }

    // Check maximum receivable amount (add explicit check here to prevent bypassing validation)
    if (toAmount > maxToAmount) {
      const formattedMaxToAmount = formatAmount(
        maxToAmount,
        form.getValues().toAsset
      )
      const displayedAsset = displayAsset(form.getValues().toAsset)
      setErrorMessage(
        `You can only receive up to ${formattedMaxToAmount} ${displayedAsset}.`
      )
      return
    }

    if (
      !hasChannels ||
      !hasTradablePairs ||
      isSwapInProgress ||
      !wsConnected ||
      !hasValidQuote ||
      errorMessage
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
  const renderSwapForm = () => (
    <div className="w-full max-w-7xl mx-auto">
      {/* Premium Trading Interface - Optimized for space */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 min-h-[450px]">
        {/* Main Trading Panel - Compact Ultra Modern */}
        <div className="xl:col-span-8 order-1">
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-2xl rounded-2xl border border-slate-700/50 shadow-2xl h-full flex flex-col">
            {/* Enhanced ambient glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-blue-500/8 to-purple-600/10 pointer-events-none"></div>
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/2 to-transparent pointer-events-none"></div>

            {/* Ultra Compact Modern Header Design */}
            <div className="relative border-b border-slate-700/40 px-4 py-2 flex-shrink-0 bg-gradient-to-r from-slate-800/70 via-slate-700/50 to-slate-800/70">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"></div>
                    <h2 className="text-sm font-bold bg-gradient-to-r from-white via-cyan-100 to-blue-100 bg-clip-text text-transparent">
                      Live Trading
                    </h2>
                  </div>

                  {/* Integrated Maker Status */}
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-slate-400">via</span>
                    <div className="flex items-center space-x-1.5">
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          wsConnected
                            ? hasTradablePairs
                              ? 'bg-emerald-400'
                              : 'bg-amber-400'
                            : 'bg-red-400 animate-pulse'
                        }`}
                      ></div>
                      <span
                        className={`font-medium ${
                          wsConnected
                            ? hasTradablePairs
                              ? 'text-emerald-300'
                              : 'text-amber-300'
                            : 'text-red-300'
                        }`}
                      >
                        {makerConnectionUrl
                          ? new URL(makerConnectionUrl).hostname
                          : 'No Maker'}
                      </span>
                      {wsConnected && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            hasTradablePairs
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {hasTradablePairs ? 'Ready' : 'No Pairs'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Compact Maker Selector */}
                  <MakerSelector onMakerChange={refreshAmounts} />

                  {!wsConnected && (
                    <button
                      className="px-2.5 py-1 rounded-md bg-gradient-to-r from-cyan-600/30 to-blue-600/30 text-cyan-400 hover:from-cyan-600/40 hover:to-blue-600/40 transition-all border border-cyan-500/50 hover:border-cyan-400/70 font-medium text-xs shadow-lg hover:shadow-cyan-500/25"
                      onClick={handleReconnectToMaker}
                      type="button"
                    >
                      Reconnect
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Trading Form - Compact Premium Layout */}
            <div className="relative flex-1 p-4 flex flex-col">
              <form
                className="flex-1 flex flex-col justify-between"
                onSubmit={form.handleSubmit(onSubmit)}
              >
                {/* Trading Inputs with Compact Premium Styling */}
                <div className="space-y-3">
                  {/* From Asset Section - Compact Premium Card */}
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-blue-500/15 to-purple-600/20 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                    <div className="relative bg-gradient-to-br from-slate-800/80 via-slate-700/60 to-slate-800/80 backdrop-blur-xl rounded-2xl border border-slate-600/60 p-1 hover:border-slate-500/80 transition-all duration-500 shadow-2xl group-hover:shadow-cyan-500/10">
                      <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-cyan-400/3 to-transparent rounded-2xl pointer-events-none"></div>
                      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/1 to-transparent rounded-2xl pointer-events-none"></div>
                      <SwapInputField
                        asset={form.getValues().fromAsset}
                        assetOptions={fromAssetOptions}
                        availableAmount={`${formatAmount(maxFromAmount, form.getValues().fromAsset)} ${displayAsset(form.getValues().fromAsset)}`}
                        availableAmountLabel="Available:"
                        disabled={
                          !hasChannels ||
                          !hasTradablePairs ||
                          isSwapInProgress ||
                          showConfirmation
                        }
                        formatAmount={formatAmount}
                        getDisplayAsset={displayAsset}
                        label="You Send"
                        maxAmount={maxFromAmount}
                        maxHtlcAmount={max_outbound_htlc_sat}
                        minAmount={minFromAmount}
                        onAmountChange={(e) => {
                          const baseHandler = createFromAmountChangeHandler(
                            form,
                            getAssetPrecisionWrapper,
                            setDebouncedFromAmount,
                            maxFromAmount
                          )
                          const quoteHandler =
                            createAmountChangeQuoteHandler(requestQuote)
                          baseHandler(e)
                          setDebouncedFromAmount(e.target.value || '')
                          quoteHandler(e)
                        }}
                        onAssetChange={(value) =>
                          handleAssetChange('fromAsset', value)
                        }
                        onRefresh={refreshAmounts}
                        onSizeClick={onSizeClick}
                        selectedSize={selectedSize}
                        showMaxHtlc
                        showMinAmount
                        showSizeButtons
                        useEnhancedSelector={true}
                        value={form.getValues().from}
                      />
                    </div>
                  </div>

                  {/* Compact Ultra Modern Swap Direction Button */}
                  <div className="flex justify-center py-1">
                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/30 via-blue-500/25 to-purple-600/30 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                      <button
                        className={`relative p-3 rounded-2xl bg-gradient-to-br from-slate-800/90 via-slate-700/80 to-slate-800/90 backdrop-blur-xl border-2 transition-all transform hover:scale-110 hover:rotate-180 duration-800 shadow-xl ${
                          hasChannels && hasTradablePairs && !isSwapInProgress
                            ? 'border-cyan-500/60 hover:border-cyan-400/80 hover:shadow-cyan-500/40 cursor-pointer'
                            : 'border-slate-600/50 opacity-50 cursor-not-allowed'
                        }`}
                        onClick={() =>
                          hasChannels &&
                          hasTradablePairs &&
                          !isSwapInProgress &&
                          onSwapAssets()
                        }
                        type="button"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-cyan-400/5 to-transparent rounded-2xl"></div>
                        <div className="absolute inset-0 bg-gradient-to-tl from-transparent via-white/2 to-transparent rounded-2xl"></div>
                        <SwapIcon />
                      </button>
                    </div>
                  </div>

                  {/* To Asset Section - Compact Premium Card */}
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-blue-500/15 to-cyan-500/20 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                    <div className="relative bg-gradient-to-br from-slate-800/80 via-slate-700/60 to-slate-800/80 backdrop-blur-xl rounded-2xl border border-slate-600/60 p-1 hover:border-slate-500/80 transition-all duration-500 shadow-2xl group-hover:shadow-purple-500/10">
                      <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-purple-400/3 to-transparent rounded-2xl pointer-events-none"></div>
                      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/1 to-transparent rounded-2xl pointer-events-none"></div>
                      <SwapInputField
                        asset={form.getValues().toAsset}
                        assetOptions={toAssetOptions}
                        availableAmount={`${formatAmount(maxToAmount, form.getValues().toAsset)} ${displayAsset(form.getValues().toAsset)}`}
                        availableAmountLabel="Can receive up to:"
                        disabled={
                          !hasChannels || !hasTradablePairs || isSwapInProgress
                        }
                        formatAmount={formatAmount}
                        getDisplayAsset={displayAsset}
                        isLoading={isToAmountLoading}
                        label="You Receive (Estimated)"
                        maxAmount={maxToAmount}
                        onAmountChange={(e) => {
                          const baseHandler = createToAmountChangeHandler(
                            form,
                            getAssetPrecisionWrapper,
                            maxToAmount
                          )
                          const quoteHandler =
                            createAmountChangeQuoteHandler(requestQuote)
                          baseHandler(e)
                          quoteHandler(e)
                        }}
                        onAssetChange={(value) =>
                          handleAssetChange('toAsset', value)
                        }
                        onRefresh={refreshAmounts}
                        readOnly={true}
                        useEnhancedSelector={true}
                        value={form.getValues().to || ''}
                      />
                    </div>
                  </div>

                  {/* Compact Ultra Modern Error Message */}
                  {errorMessage && (
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-red-500/20 via-orange-500/15 to-red-500/20 border border-red-500/40 backdrop-blur-xl shadow-xl">
                      <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-orange-500/8 to-red-500/10"></div>
                      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
                      <div className="relative p-3">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-r from-red-500/30 to-orange-500/30 border border-red-500/50 flex items-center justify-center mt-0.5">
                            <div className="w-2 h-2 rounded-full bg-gradient-to-r from-red-400 to-orange-400"></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-red-300 font-semibold text-sm mb-1">
                              {errorMessage.includes(
                                'You can only receive up to'
                              )
                                ? 'Maximum Limit Exceeded'
                                : 'Trading Error'}
                            </h4>
                            <p className="text-red-400/90 text-sm leading-relaxed">
                              {errorMessage}
                            </p>
                          </div>
                          <button
                            className="flex-shrink-0 p-2 hover:bg-red-500/20 rounded-xl transition-colors border border-red-500/30 hover:border-red-500/50 backdrop-blur-sm"
                            onClick={() => copyToClipboard(errorMessage)}
                            title="Copy error message"
                          >
                            <Copy className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Compact Premium Submit Button */}
                <div className="mt-4 flex-shrink-0">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/30 via-blue-500/25 to-purple-600/30 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                    <SwapButton
                      errorMessage={errorMessage}
                      hasChannels={hasChannels}
                      hasTradablePairs={hasTradablePairs}
                      hasValidQuote={hasValidQuote}
                      isPriceLoading={isPriceLoading}
                      isQuoteLoading={isQuoteLoading}
                      isSwapInProgress={isSwapInProgress}
                      isToAmountLoading={isToAmountLoading}
                      wsConnected={wsConnected}
                    />
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Compact Ultra Modern Information Panels */}
        <div className="xl:col-span-4 order-2 flex flex-col space-y-3">
          {/* Exchange Rate & Quote Status - Compact Premium Design */}
          {selectedPair && (
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-2xl rounded-2xl border border-slate-600/50 shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/8 via-blue-500/6 to-purple-600/8"></div>
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/2 to-transparent"></div>

              <div className="relative p-4">
                {/* Compact Ultra Modern Header */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-white flex items-center">
                    <div
                      className={`w-2 h-2 rounded-full mr-2 shadow-lg bg-gradient-to-r ${hasValidQuote ? 'from-emerald-400 to-green-500' : 'from-amber-400 to-orange-500'}`}
                    ></div>
                    Exchange Rate & Quote
                  </h3>
                  <button
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600/30 via-blue-600/25 to-purple-600/30 text-cyan-400 hover:from-cyan-600/40 hover:to-purple-600/40 transition-all border border-cyan-500/50 hover:border-purple-400/70 text-xs font-medium shadow-lg backdrop-blur-sm"
                    onClick={() => debouncedQuoteRequest(requestQuote)}
                    type="button"
                  >
                    ↻ Refresh
                  </button>
                </div>

                {/* Compact Ultra Modern Content Area */}
                <div className="bg-gradient-to-br from-slate-800/50 via-slate-700/40 to-slate-800/50 backdrop-blur-xl rounded-xl p-3 border border-slate-600/40 shadow-inner">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-xl pointer-events-none"></div>
                  {/* Exchange Rate Display */}
                  <ExchangeRateSection
                    assets={assets}
                    bitcoinUnit={bitcoinUnit}
                    formatAmount={formatAmount}
                    fromAsset={form.getValues().fromAsset}
                    getAssetPrecision={getAssetPrecisionWrapper}
                    isPriceLoading={isPriceLoading}
                    price={currentPrice}
                    selectedPair={selectedPair}
                    toAsset={form.getValues().toAsset}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Fee Information - Compact Ultra Modern Design */}
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-2xl rounded-2xl border border-slate-600/50 shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/8 via-pink-500/6 to-purple-600/8"></div>
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/2 to-transparent"></div>

            <div className="relative p-4">
              <div className="bg-gradient-to-br from-slate-800/50 via-slate-700/40 to-slate-800/50 backdrop-blur-xl rounded-xl p-3 border border-slate-600/40 shadow-inner">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-xl pointer-events-none"></div>
                <FeeSection
                  assets={assets}
                  bitcoinUnit={bitcoinUnit}
                  displayAsset={displayAsset}
                  fees={fees}
                  quoteResponse={quoteResponse}
                  toAsset={form.getValues().toAsset}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
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
    navigate(ORDER_CHANNEL_PATH)
  }, [navigate])

  // Determine what to show based on loading phase and validation state
  const shouldShowNoChannelsMessage =
    loadingPhase === 'error' && validationError === 'no-trading-pairs'

  const shouldShowInsufficientBalance =
    loadingPhase === 'error' && validationError === 'insufficient-balance'

  const shouldShowNoChannels =
    loadingPhase === 'error' && validationError === 'no-channels'

  const shouldShowWSDisconnectedMessage =
    loadingPhase === 'ready' && !wsConnected && isWebSocketInitialized

  // Check if we have channels but they're not ready yet
  const hasUnreadyChannels =
    channels.length > 0 && !channels.some((channel) => channel.ready)
  const shouldShowChannelsNotReady =
    loadingPhase === 'ready' && hasUnreadyChannels

  // Dynamic loading message based on phase
  const getLoadingMessage = () => {
    switch (loadingPhase) {
      case 'validating-balance':
        return 'Checking wallet balance and requirements...'
      case 'validating-channels':
        return 'Verifying channel availability and liquidity...'
      case 'connecting-maker':
        return 'Connecting to market maker and fetching trading pairs...'
      default:
        return 'Initializing trading infrastructure...'
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
                Insufficient Bitcoin Balance
              </h2>
              <p className="text-slate-400 text-center text-base max-w-md">
                You need bitcoin to open a trading channel. Please deposit some
                BTC to get started with trading.
              </p>

              <div className="flex gap-4 pt-4">
                <button
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl 
                           font-medium transition-colors flex items-center gap-2 text-base
                           shadow-lg hover:shadow-blue-500/25 hover:scale-105"
                  onClick={handleDepositAction}
                >
                  <Wallet className="w-5 h-5" />
                  Deposit Bitcoin
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
                No Channels Available
              </h2>
              <p className="text-slate-400 text-center text-base max-w-md">
                To start trading, you need to create a channel with some assets
                or buy one from a Lightning Service Provider.
              </p>

              <div className="flex gap-4 pt-4">
                <button
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl 
                           font-medium transition-colors flex items-center gap-2 text-base
                           shadow-lg hover:shadow-blue-500/25 hover:scale-105"
                  onClick={handleCreateChannelAction}
                >
                  <Plus className="w-5 h-5" />
                  Create Channel
                </button>
                <button
                  className="px-6 py-3 border border-blue-500/50 text-blue-500 rounded-xl 
                           hover:bg-blue-500/10 transition-colors flex items-center gap-2 text-base
                           shadow-lg hover:shadow-blue-500/25 hover:scale-105"
                  onClick={handleBuyChannelAction}
                >
                  <ShoppingCart className="w-5 h-5" />
                  Buy from LSP
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : /* Show channels not ready message */
      shouldShowChannelsNotReady ? (
        <div className="flex justify-center items-center min-h-[60vh]">
          <ChannelsNotReadyMessage onRefresh={refreshChannelsAndAmounts} />
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
        <div className="w-full min-h-full relative flex items-center justify-center">
          <div className="w-full max-w-screen-xl mx-auto px-4 py-6">
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
                      ? 'Connecting to Market Maker'
                      : 'Initializing Trading Interface'}
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
              <div className="flex justify-center items-start min-h-[60vh]">
                {renderSwapForm()}
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
    </div>
  )
}

// Export with a named export for the trade hub
export const MarketMakerComponent = Component
