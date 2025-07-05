import { Copy } from 'lucide-react'
import { useCallback, useEffect, useState, useMemo, useRef } from 'react'
import { useForm, SubmitHandler } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

import { webSocketService } from '../../../app/hubs/websocketService'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks'
// import { StatusToast } from '../../../components/StatusToast'
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
} from '../../../components/Trade'
import { MIN_CHANNEL_CAPACITY } from '../../../constants'
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
import { createFromAmountChangeHandler } from './formUtils'
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

const MSATS_PER_SAT = 1000
const RGB_HTLC_MIN_SAT = 3000

export const Component = () => {
  // Declare makerConnectionUrl at the very top
  const makerConnectionUrl = useAppSelector(
    (state) => state.nodeSettings.data.default_maker_url
  )

  // Declare minLoadingDone state and effect after makerConnectionUrl
  const [minLoadingDone, setMinLoadingDone] = useState(false)
  useEffect(() => {
    setMinLoadingDone(false)
    const timer = setTimeout(() => setMinLoadingDone(true), 600) // 600ms minimum spinner
    return () => clearTimeout(timer)
  }, [makerConnectionUrl])

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
  const [hasValidChannelsForTrading, setHasValidChannelsForTrading] =
    useState(false)
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

  // Component mount state management
  const isMountedRef = useRef(false)
  const initializationRef = useRef(false)
  const lastSuccessfulConnectionRef = useRef(0)

  // Add a ref to track when we're in the middle of initialization to prevent conflicts
  // This helps solve the race condition issues when navigating between pages
  const isInitializingRef = useRef(false)

  // Add setup tracking to prevent multiple simultaneous setup calls
  const isSetupRunningRef = useRef(false)

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

  // Start connection timeout when WebSocket initialization begins
  const startConnectionTimeout = useCallback(() => {
    // Clear any existing timeout first
    if (connectionTimeoutTimer) {
      clearTimeout(connectionTimeoutTimer)
    }

    const timeoutId = window.setTimeout(() => {
      logger.warn('WebSocket connection timeout after 30 seconds')
      setConnectionTimeout(true)
      setConnectionTimeoutTimer(null)
    }, 30000) // 30 second timeout

    setConnectionTimeoutTimer(timeoutId)
    setConnectionStartTime(Date.now())
    setConnectionTimeout(false)
    logger.debug('Started 30-second connection timeout')
  }, [connectionTimeoutTimer])

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

  // Optimize the quote response selector to prevent unnecessary updates
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

    // First try direct lookup with current assets
    let key = `${fromAssetId}/${toAssetId}/${fromAmount}`
    let quote = state.pairs.quotes[key]

    if (!quote) {
      // If not found, look for any quotes with matching fromAsset and amount
      const matchingQuoteKey = Object.keys(state.pairs.quotes).find(
        (k) => k.startsWith(`${fromAssetId}/`) && k.endsWith(`/${fromAmount}`)
      )

      if (matchingQuoteKey) {
        quote = state.pairs.quotes[matchingQuoteKey]
        // Log that we found a quote with a different asset
        logger.info(
          `Found quote with key ${matchingQuoteKey} instead of ${key}`
        )

        // Don't automatically change the user's selected toAsset anymore
        // This was causing the issue where user selections were being overridden
        // The fallback quote won't be used if it doesn't match the user's selection
        const quoteToAssetId = quote?.to_asset
        if (quoteToAssetId && quoteToAssetId !== toAssetId) {
          // The quote is for a different asset than what the user selected
          // Don't use this quote and don't override the user's choice
          logger.debug(
            `Quote asset ${quoteToAssetId} doesn't match selected asset ${toAssetId}, ignoring fallback quote`
          )
          return null
        }
      }
    }

    return quote
  })

  // Process quote response updates in a separate effect to batch state updates
  useEffect(() => {
    if (!quoteResponse) {
      // Quote was cleared (likely due to an error), clear the UI state
      try {
        window.requestAnimationFrame(() => {
          form.setValue('to', '')
          form.setValue('rfq_id', '')
          setHasValidQuote(false)
          setQuoteExpiresAt(null)
          setIsToAmountLoading(false)
          setIsPriceLoading(false)
          setIsQuoteLoading(false)
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

      // Use requestAnimationFrame to batch updates and prevent render loops
      window.requestAnimationFrame(() => {
        setQuoteResponseTimestamp(Date.now())
        setIsToAmountLoading(false)
        setIsPriceLoading(false)
        setIsQuoteLoading(false) // Clear quote loading when we receive a response

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
  }, [quoteResponse, form, assets])

  // Add state for quote validity tracking
  const [hasValidQuote, setHasValidQuote] = useState(false)
  const [quoteExpiresAt, setQuoteExpiresAt] = useState<number | null>(null)

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

  // Track when assets data is loaded from the query - ensure proper synchronization
  useEffect(() => {
    if (assetsData && assetsData.nia) {
      // Set assets immediately and mark as loaded
      setAssets(assetsData.nia)
      setIsAssetsLoaded(true)

      // Log for debugging
      logger.debug('Assets loaded and synchronized:', {
        assetCount: assetsData.nia.length,
        assetIds: assetsData.nia.map((a) => a.asset_id),
      })
    } else if (assetsData === undefined) {
      // Reset loading state if assets data becomes unavailable
      setIsAssetsLoaded(false)
      logger.debug('Assets data unavailable, resetting loading state')
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
      // Use formatAssetAmountWithPrecision which already includes grouping (thousand separators)
      // and ensure comma separators are applied
      return formatAssetAmountWithPrecision(amount, asset, bitcoinUnit, assets)
    },
    [assets, bitcoinUnit]
  )

  // Handle quote errors immediately to reset loading states
  useEffect(() => {
    if (quoteError) {
      logger.warn('Quote error received, resetting loading states:', quoteError)

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

  // Update quote request handler with loading state setters
  const requestQuote = useMemo(
    () =>
      createQuoteRequestHandler(
        form,
        parseAssetAmount,
        assets,
        setIsQuoteLoading,
        setIsToAmountLoading,
        () => hasValidQuote
      ),
    [form, parseAssetAmount, assets, hasValidQuote]
  )

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
      setSelectedSize(size) // Use setSelectedSize when size is clicked
      // When a size button is clicked, we explicitly pass the size percentage
      // to setFromAmount so it can also update the selectedSize state.
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

      // If there's no fromAmount set, initialize it with a reasonable default value
      const currentFromAmount = form.getValues().from
      if (
        !currentFromAmount ||
        parseFloat(currentFromAmount.replace(/,/g, '')) === 0
      ) {
        // Use 25% of max as a reasonable starting amount
        const maxFromAmount = newMaxFromAmount / 1000
        const initialAmount = Math.min(
          maxFromAmount * 0.25,
          Math.max(minOrderSize * 2, maxFromAmount * 0.1)
        )
        logger.debug(
          `Initializing from amount to ${initialAmount} ${fromAsset}`
        )

        // Format and set the initial amount
        const formattedAmount = formatAmount(initialAmount, fromAsset)
        form.setValue('from', formattedAmount, { shouldValidate: true })
        // setSelectedSize(25) // Set to 25% by default // REMOVE THIS LINE

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

  // Add a new effect to initialize the UI with a default "to" amount when pair is selected
  useEffect(() => {
    if (selectedPair && minFromAmount > 0 && !form.getValues().to) {
      // If there's no "from" amount yet, set a default
      if (!form.getValues().from) {
        const fromAsset = form.getValues().fromAsset
        const initialAmount = Math.max(minFromAmount * 2, maxFromAmount * 0.25)
        const formattedAmount = formatAmount(initialAmount, fromAsset)

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
        setIsPairsLoading,
        // Only show user error if all required data is loaded
        isInitialDataLoaded && isAssetsLoaded && isChannelsLoaded
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

  // Add at the top, after other useState declarations
  const [initStableTimer, setInitStableTimer] = useState<number | null>(null)

  // Replace the main WebSocket initialization effect
  useEffect(() => {
    isMountedRef.current = true
    let initTimeoutId: number | null = null

    // Function to initialize WebSocket with debouncing
    const initWebSocket = async () => {
      // Prevent multiple initializations using refs for stability
      if (
        initializationRef.current ||
        !isMountedRef.current ||
        isInitializingRef.current
      ) {
        logger.debug(
          'WebSocket initialization skipped: already initializing or component unmounted'
        )
        return
      }

      // Check if circuit breaker is active - don't try to connect if it is
      const diagnostics = webSocketService.getDiagnostics()
      if (diagnostics.circuitBreakerOpen) {
        logger.warn(
          'WebSocket initialization skipped: circuit breaker is active. Wait for it to reset or switch makers.'
        )
        if (isMountedRef.current) {
          setIsWebSocketInitialized(true) // Mark as "initialized" to prevent retry loop
        }
        return
      }

      // Only proceed if we have pubKey (required for consistent client ID)
      if (!pubKey) {
        logger.warn('WebSocket initialization requires pubKey as client ID')
        return
      }

      // Enhanced requirement checking - ensure channels, assets, AND RTK Query data are fully loaded
      const hasBasicRequirements =
        channels.length > 0 &&
        assets.length > 0 &&
        isAssetsLoaded &&
        isChannelsLoaded &&
        assetsData?.nia &&
        assetsData.nia.length > 0

      if (!hasBasicRequirements) {
        logger.warn('Basic requirements not met for WebSocket initialization', {
          assets: assets.length,
          channels: channels.length,
          hasRTKAssets: !!assetsData?.nia,
          isAssetsLoaded,
          isChannelsLoaded,
          rtkAssetCount: assetsData?.nia?.length || 0,
        })
        return
      }

      // Enhanced channel completeness check - verify RGB channels are loaded if expected
      const expectedRgbAssets = assetsData.nia.filter(
        (asset) => asset.asset_id !== 'BTC'
      )
      const rgbChannels = channels.filter(
        (c) => c.asset_id && c.asset_id !== 'BTC'
      )

      // If we have RGB assets but no RGB channels, channels might still be loading
      if (expectedRgbAssets.length > 0 && rgbChannels.length === 0) {
        logger.debug(
          'RGB assets expected but no RGB channels found yet - delaying WebSocket initialization',
          {
            expectedRgbAssets: expectedRgbAssets.length,
            foundRgbChannels: rgbChannels.length,
            totalChannels: channels.length,
          }
        )
        return
      }

      // Check for any tradable channels (don't require specific assets)
      const hasAnyTradableChannels = channels.some(
        (channel) =>
          channel.ready &&
          (channel.outbound_balance_msat > 0 ||
            channel.inbound_balance_msat > 0) &&
          channel.asset_id
      )

      if (!hasAnyTradableChannels) {
        logger.warn(
          'No tradable channels found. WebSocket initialization skipped.'
        )
        if (isMountedRef.current) {
          setIsWebSocketInitialized(true)
        }
        return
      }

      // Check if we're already connected with the same client ID to prevent duplicate connections
      if (webSocketService.isConnected()) {
        logger.info('WebSocket already connected, skipping initialization')
        if (isMountedRef.current) {
          setIsWebSocketInitialized(true)
          setIsLoading(false)

          // Ensure we have pairs if connected but no pairs loaded
          if (tradablePairs.length === 0) {
            setTimeout(async () => {
              try {
                await fetchAndSetPairs()
              } catch (error) {
                logger.error(
                  'Error fetching pairs on existing connection:',
                  error
                )
              }
            }, 500)
          }
        }
        return
      }

      // Mark as initializing to prevent conflicts
      isInitializingRef.current = true
      initializationRef.current = true
      logger.debug('Starting WebSocket initialization process')

      // Set loading state immediately
      if (isMountedRef.current) {
        setIsLoading(true)
      }

      // Start the 30-second connection timeout
      startConnectionTimeout()

      try {
        // Use pubkey[:16]-uuid format for client ID
        const pubKeyPrefix = pubKey.slice(0, 16)
        const uuid = crypto.randomUUID()
        const clientId = `${pubKeyPrefix}-${uuid}`

        logger.info(
          `Initializing WebSocket connection to ${makerConnectionUrl} with pubKey as client ID: ${clientId.slice(0, 16)}...`
        )

        // Validate the makerConnectionUrl before attempting connection
        try {
          new URL(makerConnectionUrl)
        } catch (urlError) {
          throw new Error(`Invalid maker URL: ${makerConnectionUrl}`)
        }

        // Initialize the connection through the service
        const success = webSocketService.init(
          makerConnectionUrl,
          clientId,
          dispatch
        )

        if (success) {
          logger.info('WebSocket initialization successful')
          lastSuccessfulConnectionRef.current = Date.now()

          // Fetch trading pairs after connection is established
          // Use a timeout to wait for connection to be fully ready before fetching pairs
          setTimeout(async () => {
            if (tradablePairs.length === 0 && isMountedRef.current) {
              try {
                await fetchAndSetPairs()
              } catch (pairsError) {
                logger.error(
                  'Error fetching pairs after WebSocket connection:',
                  pairsError
                )
                // Don't fail the whole initialization if pairs fetch fails
                if (isMountedRef.current) {
                  toast.warning(
                    'Connected to maker but failed to load trading pairs. Try refreshing.'
                  )
                }
              }
            }
          }, 1000) // 1 second delay to ensure connection stability

          // Log WebSocket diagnostics
          const diagnostics = webSocketService.getDiagnostics()
          logger.info('WebSocket connection diagnostics:', diagnostics)
        } else {
          logger.error('WebSocket initialization failed', {
            hasAssets: !!assetsData?.nia?.length,
            hasChannels: channels.length > 0,
            makerConnectionUrl,
            pubKeyAvailable: !!pubKey,
          })
          if (isMountedRef.current) {
            // Only show error toast if this is a real failure, not just normal loading
            if (assetsData?.nia?.length && channels.length > 0) {
              toast.error(
                'Could not connect to market maker. Check the maker URL and try again.',
                {
                  autoClose: 5000,
                  toastId: 'websocket-connection-failed',
                }
              )
            } else {
              // Don't show error during normal loading - data is still being fetched
              logger.info(
                'WebSocket initialization skipped during data loading phase'
              )
            }
          }
        }
      } catch (error) {
        // Clear connection timeout on error
        clearConnectionTimeout()

        logger.error('Error during WebSocket initialization:', error)
        if (isMountedRef.current) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'
          toast.error(
            `Connection error: ${errorMessage}. Please check settings and try again.`,
            {
              autoClose: 5000,
              toastId: 'websocket-initialization-error',
            }
          )
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false)
          setIsWebSocketInitialized(true)
        }
        // Always reset the initializing flag
        isInitializingRef.current = false
      }
    }

    // Debounced initialization to prevent rapid reconnections
    const debouncedInit = () => {
      if (initTimeoutId) {
        clearTimeout(initTimeoutId)
      }
      initTimeoutId = window.setTimeout(() => {
        initWebSocket()
        initTimeoutId = null
      }, 2000) // Increased debounce time to 2 seconds to allow assets to fully load and prevent rapid reconnections
    }

    // --- STABILIZATION TIMER LOGIC ---
    // Only initialize if all required data is present and stable for 1s
    if (
      channels.length > 0 &&
      assets.length > 0 &&
      isAssetsLoaded &&
      isChannelsLoaded &&
      pubKey &&
      makerConnectionUrl &&
      !isWebSocketInitialized &&
      !webSocketService.isConnected() &&
      !isInitializingRef.current
    ) {
      // Additional validation before initialization
      try {
        new URL(makerConnectionUrl)
        logger.info(
          'Scheduling WebSocket initialization with stabilization timer'
        )
        if (initStableTimer) {
          clearTimeout(initStableTimer)
        }
        const timer = window.setTimeout(() => {
          debouncedInit()
          setInitStableTimer(null)
        }, 3000) // 3s stabilization to prevent frequent reconnections
        setInitStableTimer(timer)
      } catch (urlError) {
        logger.error(
          `Invalid maker URL detected: ${makerConnectionUrl}`,
          urlError
        )
        if (isMountedRef.current) {
          setErrorMessage(
            `Invalid maker URL: ${makerConnectionUrl}. Please check your settings.`
          )
          setIsWebSocketInitialized(true) // Prevent retry loop
        }
      }
    } else if (
      channels.length === 0 ||
      assets.length === 0 ||
      !isAssetsLoaded ||
      !isChannelsLoaded ||
      !assetsData?.nia
    ) {
      // Don't reset initialization flag if basic data is not available
      logger.debug(
        'Basic data not available, skipping WebSocket initialization',
        {
          assets: assets.length,
          channels: channels.length,
          hasRTKAssets: !!assetsData?.nia,
          isAssetsLoaded,
          isChannelsLoaded,
          rtkAssetCount: assetsData?.nia?.length || 0,
        }
      )
    } else if (!pubKey) {
      logger.warn('WebSocket initialization skipped: pubKey not available')
    } else if (!makerConnectionUrl) {
      logger.warn('WebSocket initialization skipped: maker URL not configured')
    } else if (webSocketService.isConnected()) {
      logger.debug(
        'WebSocket already connected, ensuring initialization state is set'
      )
      if (isMountedRef.current && !isWebSocketInitialized) {
        setIsWebSocketInitialized(true)
      }
    } else if (isWebSocketInitialized) {
      logger.debug(
        'WebSocket initialization already completed, but not connected - potential connection issue'
      )
    }

    // Clean up function - disconnect WebSocket when leaving market maker page
    return () => {
      isMountedRef.current = false
      // Clear any pending initialization
      if (initTimeoutId) {
        clearTimeout(initTimeoutId)
        initTimeoutId = null
      }
      if (initStableTimer) {
        clearTimeout(initStableTimer)
        setInitStableTimer(null)
      }
      clearConnectionTimeout()
      isInitializingRef.current = false
      // Only disconnect if actually leaving the market maker route
      if (window.location.pathname !== '/market-maker') {
        logger.info('Leaving /market-maker route, disconnecting WebSocket')
        webSocketService.close()
        setIsWebSocketInitialized(false)
        initializationRef.current = false
      }
    }
  }, [
    makerConnectionUrl,
    pubKey,
    channels.length,
    assets.length,
    isAssetsLoaded,
    isChannelsLoaded,
    assetsData?.nia?.length,
    isWebSocketInitialized,
    startConnectionTimeout,
    clearConnectionTimeout,
  ])

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
    let intervalId: NodeJS.Timeout | null = null

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

  // Fetch initial data
  useEffect(() => {
    const setup = async () => {
      // Prevent multiple simultaneous setup calls
      if (isSetupRunningRef.current) {
        logger.debug('Setup already running, skipping duplicate call')
        return
      }

      isSetupRunningRef.current = true
      setIsLoading(true)

      try {
        // First, ensure we have assets data from RTK Query before proceeding
        if (!assetsData?.nia || assetsData.nia.length === 0) {
          logger.info(
            'Waiting for assets data to be available from RTK Query...',
            {
              assetCount: assetsData?.nia?.length || 0,
              hasAssetsData: !!assetsData,
            }
          )
          return
        }

        // Set assets first to ensure they're available for all subsequent operations
        setAssets(assetsData.nia)
        setIsAssetsLoaded(true)

        logger.info('Assets synchronized for initial data fetching:', {
          assetCount: assetsData.nia.length,
          firstFewAssetIds: assetsData.nia.slice(0, 3).map((a) => a.asset_id),
        })

        const [nodeInfoResponse, balanceResponse, getPairsResponse] =
          await Promise.all([
            nodeInfo(),
            btcBalance({ skip_sync: false }),
            getPairs(),
          ])

        if ('data' in nodeInfoResponse && nodeInfoResponse.data) {
          setPubKey(nodeInfoResponse.data.pubkey)
        }

        let supportedAssets: string[] = []
        if ('data' in getPairsResponse && getPairsResponse.data) {
          const pairs = getPairsResponse.data.pairs
          supportedAssets = Array.from(
            new Set(
              pairs.flatMap((pair) => [pair.base_asset_id, pair.quote_asset_id])
            )
          )
        }

        // Enhanced channel loading with retry logic for incomplete data
        const loadChannelsWithRetry = async (
          maxRetries = 3,
          retryDelay = 1000
        ): Promise<Channel[]> => {
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              const listChannelsResponse = await listChannels()

              if ('data' in listChannelsResponse && listChannelsResponse.data) {
                const channelsList = listChannelsResponse.data.channels

                // Count channels with different asset types
                const btcChannels = channelsList.filter(
                  (c) => c.asset_id === 'BTC' || !c.asset_id
                )
                const rgbChannels = channelsList.filter(
                  (c) => c.asset_id && c.asset_id !== 'BTC'
                )

                logger.debug(`Channel loading attempt ${attempt}:`, {
                  btcChannels: btcChannels.length,
                  rgbChannels: rgbChannels.length,
                  totalChannels: channelsList.length,
                  uniqueAssetIds: [
                    ...new Set(
                      channelsList.map((c) => c.asset_id).filter(Boolean)
                    ),
                  ],
                })

                // If we have assets in RTK query, we should expect to have channels for them too
                // Check if we have channels for at least some of the assets we know about
                const expectedRgbAssetCount = assetsData.nia.filter(
                  (asset) => asset.asset_id !== 'BTC'
                ).length

                // Accept the channels if:
                // 1. We have at least one channel, AND
                // 2. Either we have RGB channels OR we're on the last retry
                const hasMinimumChannels = channelsList.length > 0
                const hasExpectedRgbChannels =
                  rgbChannels.length > 0 || expectedRgbAssetCount === 0
                const isLastAttempt = attempt === maxRetries

                if (
                  hasMinimumChannels &&
                  (hasExpectedRgbChannels || isLastAttempt)
                ) {
                  if (
                    isLastAttempt &&
                    rgbChannels.length === 0 &&
                    expectedRgbAssetCount > 0
                  ) {
                    logger.warn(
                      'Final channel loading attempt: missing expected RGB channels',
                      {
                        expectedRgbAssets: expectedRgbAssetCount,
                        foundRgbChannels: rgbChannels.length,
                      }
                    )
                  }
                  return channelsList
                }

                // If not sufficient, retry unless it's the last attempt
                if (attempt < maxRetries) {
                  logger.info(
                    `Channel data appears incomplete (attempt ${attempt}/${maxRetries}), retrying...`,
                    {
                      expected: `>= ${expectedRgbAssetCount} RGB channels`,
                      found: `${rgbChannels.length} RGB channels`,
                    }
                  )
                  await new Promise((resolve) =>
                    setTimeout(resolve, retryDelay)
                  )
                  continue
                }

                // Last attempt - return what we have
                return channelsList
              }

              throw new Error('No channel data received')
            } catch (error) {
              logger.error(`Channel loading attempt ${attempt} failed:`, error)
              if (attempt === maxRetries) {
                throw error
              }
              await new Promise((resolve) => setTimeout(resolve, retryDelay))
            }
          }

          throw new Error('Failed to load channels after all retries')
        }

        // Load channels with retry logic
        const channelsList = await loadChannelsWithRetry()
        setChannels(channelsList)
        setIsChannelsLoaded(true)

        // Check if there's at least one channel with a market maker supported asset
        const hasValidChannels = channelsList.some(
          (channel: Channel) =>
            channel.asset_id !== null &&
            channel.ready &&
            (channel.outbound_balance_msat > 0 ||
              channel.inbound_balance_msat > 0) &&
            supportedAssets.includes(channel.asset_id)
        )
        setHasValidChannelsForTrading(hasValidChannels)

        // Check if there's enough balance to open a channel
        if ('data' in balanceResponse && balanceResponse.data) {
          const { vanilla } = balanceResponse.data
          setHasEnoughBalance(vanilla.spendable >= MIN_CHANNEL_CAPACITY)
        }

        // Add a small delay before fetching pairs to ensure channel state is fully settled
        await new Promise((resolve) => setTimeout(resolve, 200))

        // Fetch trading pairs after all basic data is loaded and settled
        await fetchAndSetPairs()

        logger.info('Initial data fetched successfully')
        setIsInitialDataLoaded(true)
      } catch (error) {
        logger.error('Error during setup:', error)
        toast.error(
          'Failed to initialize the swap component. Please try again.'
        )
      } finally {
        setIsLoading(false)
        isSetupRunningRef.current = false
      }
    }

    // Only run setup if we haven't loaded initial data yet
    if (!isInitialDataLoaded && !isSetupRunningRef.current) {
      // If assets aren't ready yet, retry in a moment
      if (!assetsData?.nia?.length) {
        const retryTimeout = setTimeout(() => {
          if (
            !isInitialDataLoaded &&
            assetsData?.nia?.length &&
            isMountedRef.current &&
            !isSetupRunningRef.current
          ) {
            setup()
          }
        }, 1000) // Retry after 1 second

        return () => clearTimeout(retryTimeout)
      } else {
        setup()
      }
    }
  }, [
    nodeInfo,
    listChannels,
    btcBalance,
    getPairs,
    assetsData,
    dispatch,
    form,
    formatAmount,
    fetchAndSetPairs,
    isInitialDataLoaded,
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
        assets, // 1
        pubKey, // 2
        currentPrice || 0, // 3
        selectedPair, // 4
        parseAssetAmount, // 5
        formatAmount, // 6
        tradablePairs, // 7
        initSwap, // 8
        taker, // 9
        execSwap, // 10
        setSwapRecapDetails, // 11
        setShowRecap, // 12
        setErrorMessage // 13
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

      // Reset the circuit breaker and WebSocket state
      webSocketService.resetForNewMaker()
      setIsWebSocketInitialized(false)
      initializationRef.current = false
      isInitializingRef.current = false

      // Clear any existing error messages
      setErrorMessage(null)

      // Reinitialize the WebSocket connection
      const pubKeyPrefix = pubKey.slice(0, 16)
      const uuid = crypto.randomUUID()
      const clientId = `${pubKeyPrefix}-${uuid}`

      const reconnected = webSocketService.init(
        makerConnectionUrl,
        clientId,
        dispatch
      )

      if (reconnected) {
        logger.info('Successfully reconnected to market maker')
        lastSuccessfulConnectionRef.current = Date.now()
        setIsWebSocketInitialized(true)

        // Wait a moment for connection to stabilize, then request a quote
        setTimeout(() => {
          if (webSocketService.isConnected()) {
            debouncedQuoteRequest(requestQuote)
          }
        }, 1000)
      } else {
        logger.error('Failed to reconnect to market maker')
        toast.error(
          'Failed to reconnect to market maker. Please check your connection.',
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
                            getAssetPrecisionWrapper
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

  // Determine if we're still in a loading state - be more comprehensive
  const isStillLoading =
    !connectionTimeout && // Don't show loading if connection has timed out
    (!minLoadingDone ||
      isLoading || // True during the main setup fetchData
      !isInitialDataLoaded ||
      !isChannelsLoaded ||
      !isAssetsLoaded ||
      isPairsLoading || // True until fetchAndSetPairs completes
      (!!makerConnectionUrl &&
        hasTradableChannels(channels) &&
        !isWebSocketInitialized) ||
      channels.length === 0 ||
      (tradablePairs.length === 0 && isPairsLoading))

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

  // Determine if we should show the "no trading channels" message
  const shouldShowNoChannelsMessage =
    !isStillLoading &&
    (!makerConnectionUrl || // Case 1: No maker URL configured
      !hasValidChannelsForTrading || // Case 2: Initial setup deemed no valid channels
      (tradablePairs.length === 0 &&
        !isPairsLoading &&
        isWebSocketInitialized) || // Case 3: No pairs and not loading and WS init done
      // Case 4: Maker URL exists, WS init done, not connected, AND no physical tradable channels
      (!!makerConnectionUrl &&
        isWebSocketInitialized &&
        !wsConnected &&
        !hasTradableChannels(channels)))

  // Determine if we should show the WebSocket disconnected message
  const shouldShowWSDisconnectedMessage =
    !isStillLoading &&
    !!makerConnectionUrl && // Maker URL must exist
    (isWebSocketInitialized || connectionTimeout) && // WebSocket initialization must have been attempted OR timed out
    !wsConnected && // WebSocket is currently not connected
    hasTradableChannels(channels) && // Physical tradable channels exist
    hasValidChannelsForTrading // Trading was deemed possible based on initial channel/pair checks

  return (
    <div className="w-full min-h-screen overflow-y-auto relative">
      {shouldShowNoChannelsMessage ? (
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
        <div className="w-full min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative flex items-center justify-center">
          {/* Ultra Modern Background Enhancement */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/20 via-transparent to-purple-950/20 pointer-events-none"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.1),transparent_50%)] pointer-events-none"></div>

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
                    Connecting to Market Maker
                  </p>
                  <p className="text-slate-300 text-base leading-relaxed">
                    {isLoading
                      ? 'Initializing trading infrastructure and establishing secure connection...'
                      : !isChannelsLoaded
                        ? 'Loading channel information and verifying liquidity...'
                        : !isAssetsLoaded
                          ? 'Loading supported assets and trading pairs...'
                          : isPairsLoading
                            ? 'Fetching real-time trading pairs and market data...'
                            : !!makerConnectionUrl && !isWebSocketInitialized
                              ? 'Establishing WebSocket connection for live quotes...'
                              : 'Finalizing setup and preparing trading interface...'}
                  </p>
                  <div className="w-80 h-2 bg-slate-800/60 rounded-full overflow-hidden backdrop-blur-sm border border-slate-600/40 shadow-inner">
                    <div className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 rounded-full animate-pulse shadow-lg"></div>
                  </div>
                </div>
              </div>
            ) : shouldShowWSDisconnectedMessage ? (
              <div className="flex justify-center items-center min-h-[60vh]">
                <div className="relative overflow-hidden bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-2xl rounded-3xl border border-slate-600/50 shadow-2xl max-w-3xl w-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-red-500/8 via-orange-500/6 to-red-500/8"></div>
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/2 to-transparent"></div>
                  <div className="relative p-8">
                    {connectionTimeout ? (
                      <div className="text-center space-y-6">
                        <div className="flex justify-center mb-4">
                          <div className="w-16 h-16 bg-gradient-to-br from-red-500/30 via-orange-500/25 to-red-500/30 rounded-full flex items-center justify-center border border-red-500/40 backdrop-blur-sm">
                            <div className="w-8 h-8 text-red-400">⚠️</div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h2 className="text-2xl font-bold text-white bg-gradient-to-r from-white via-red-100 to-orange-100 bg-clip-text text-transparent">
                            Connection Timeout
                          </h2>
                          <p className="text-slate-300 text-lg leading-relaxed max-w-2xl mx-auto">
                            Unable to connect to the market maker after 30
                            seconds. This could be due to network issues, an
                            incorrect maker URL, or the maker being temporarily
                            unavailable.
                          </p>
                          <div className="bg-gradient-to-br from-slate-800/50 via-slate-700/40 to-slate-800/50 backdrop-blur-xl rounded-xl p-4 border border-slate-600/40 shadow-inner">
                            <p className="text-slate-400 text-sm">
                              <strong className="text-white">
                                Current Maker:
                              </strong>{' '}
                              {makerConnectionUrl
                                ? new URL(makerConnectionUrl).hostname
                                : 'None'}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                          <button
                            className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600/30 via-blue-600/25 to-purple-600/30 text-white hover:from-cyan-600/40 hover:to-purple-600/40 transition-all border border-cyan-500/50 hover:border-purple-400/70 font-semibold shadow-lg backdrop-blur-sm"
                            onClick={() => {
                              // Reset timeout state and try to reconnect
                              setConnectionTimeout(false)
                              clearConnectionTimeout()
                              setIsWebSocketInitialized(false)
                              initializationRef.current = false
                              isInitializingRef.current = false
                            }}
                            type="button"
                          >
                            Retry Connection
                          </button>

                          <button
                            className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-600/30 via-orange-600/25 to-amber-600/30 text-amber-300 hover:from-amber-600/40 hover:to-orange-600/40 transition-all border border-amber-500/50 hover:border-orange-400/70 font-semibold shadow-lg backdrop-blur-sm"
                            onClick={refreshAmounts}
                            type="button"
                          >
                            Change Market Maker
                          </button>
                        </div>

                        <div className="text-xs text-slate-500 space-y-2">
                          <p>Need help? Check that:</p>
                          <ul className="list-disc list-inside space-y-1 text-left max-w-md mx-auto">
                            <li>Your internet connection is stable</li>
                            <li>The maker URL is correct and reachable</li>
                            <li>The market maker service is running</li>
                            <li>No firewall is blocking the connection</li>
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <WebSocketDisconnectedMessage
                        makerUrl={makerConnectionUrl}
                        onMakerChange={refreshAmounts}
                        onRetryConnection={handleReconnectToMaker}
                      />
                    )}
                  </div>
                </div>
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
