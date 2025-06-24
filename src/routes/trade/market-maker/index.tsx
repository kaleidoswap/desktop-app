import { Copy, HelpCircle } from 'lucide-react'
import { useCallback, useEffect, useState, useMemo, useRef } from 'react'
import { useForm, SubmitHandler } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'

import { webSocketService } from '../../../app/hubs/websocketService'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks'
import { Loader } from '../../../components/Loader'
// import { StatusToast } from '../../../components/StatusToast'
import { SwapConfirmation } from '../../../components/SwapConfirmation'
import { SwapRecap } from '../../../components/SwapRecap'
import {
  SwapInputField,
  ExchangeRateSection,
  SwapButton,
  MakerSelector,
  FeeSection,
  QuickAmountSection,
} from '../../../components/Trade'
import {
  NoTradingChannelsMessage,
  createTradingChannelsMessageProps,
  WebSocketDisconnectedMessage,
} from '../../../components/Trade/NoChannelsMessage'
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
import { setTradingPairs } from '../../../slices/makerApi/pairs.slice'
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
} from './quoteUtils'
import {
  createSwapExecutor,
  copyToClipboard as copyToClipboardUtil,
  SwapDetails as SwapDetailsType,
} from './swapUtils'
import { Fields } from './types'

const MSATS_PER_SAT = 1000
const RGB_HTLC_MIN_SAT = 3000

// Add storage constants
const STORAGE_KEY_PREFIX = 'kaleidoswap_'
const STORAGE_ASSETS_KEY = `${STORAGE_KEY_PREFIX}last_assets`
const STORAGE_PAIR_KEY = `${STORAGE_KEY_PREFIX}last_pair`

// Add utility functions to save/load pair preferences
const saveLastAssets = (fromAsset: string, toAsset: string) => {
  try {
    localStorage.setItem(
      STORAGE_ASSETS_KEY,
      JSON.stringify({ fromAsset, toAsset })
    )
    logger.debug(`Saved last assets: from=${fromAsset}, to=${toAsset}`)
  } catch (error) {
    logger.error('Error saving last assets to localStorage:', error)
  }
}

const saveLastPair = (pairId: string) => {
  try {
    localStorage.setItem(STORAGE_PAIR_KEY, pairId)
    logger.debug(`Saved last pair: ${pairId}`)
  } catch (error) {
    logger.error('Error saving last pair to localStorage:', error)
  }
}

const loadLastAssets = (): { fromAsset: string; toAsset: string } | null => {
  try {
    const storedData = localStorage.getItem(STORAGE_ASSETS_KEY)
    if (storedData) {
      const assets = JSON.parse(storedData)
      logger.debug(
        `Loaded last assets: from=${assets.fromAsset}, to=${assets.toAsset}`
      )
      return assets
    }
  } catch (error) {
    logger.error('Error loading last assets from localStorage:', error)
  }
  return null
}

export const Component = () => {
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

  const [showRecap, setShowRecap] = useState<boolean>(false)
  const [swapRecapDetails, setSwapRecapDetails] =
    useState<SwapDetailsType | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)

  // Component mount state management
  const isMountedRef = useRef(false)
  const initializationRef = useRef(false)

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
        }
      })
    }

    // Check both maker and taker swaps
    checkForSuccessfulSwaps(prevSwaps.maker, currentSwaps.maker, 'maker')
    checkForSuccessfulSwaps(prevSwaps.taker, currentSwaps.taker, 'taker')

    // Update the ref with current data
    previousSwapsRef.current = swapsData
  }, [swapsData, assets])

  const makerConnectionUrl = useAppSelector(
    (state) => state.nodeSettings.data.default_maker_url
  )
  const wsConnected = useAppSelector((state) => state.pairs.wsConnected)
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

        // Update the form toAsset to match what we actually have a quote for
        if (quote && quote.to_asset) {
          // Map asset ID to ticker for UI display
          const toTickerForUI = mapAssetIdToTicker(quote.to_asset, assets)

          // Request animation frame to avoid state updates during render
          window.requestAnimationFrame(() => {
            // We need to update the to asset in the form to match what the quote is for
            form.setValue('toAsset', toTickerForUI)
            logger.debug(`Updated toAsset to ${toTickerForUI} to match quote`)
          })
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
          setQuoteAge(0)
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
  const [quoteAge, setQuoteAge] = useState<number>(0)

  // Update quote validity every second
  useEffect(() => {
    if (!quoteExpiresAt) {
      setHasValidQuote(false)
      return
    }

    const checkValidity = () => {
      const now = Date.now()
      const expiresAtMs = quoteExpiresAt * 1000 // Convert to ms if in seconds
      const isExpired = now >= expiresAtMs
      const ageMs = Math.max(0, now - (quoteResponseTimestamp || 0))

      setQuoteAge(Math.floor(ageMs / 1000)) // Age in seconds
      setHasValidQuote(!isExpired)
    }

    // Check immediately
    checkValidity()

    // Then set up an interval
    const interval = setInterval(checkValidity, 1000)
    return () => clearInterval(interval)
  }, [quoteExpiresAt, quoteResponseTimestamp])

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

  // Track when assets data is loaded from the query
  useEffect(() => {
    if (assetsData && assetsData.nia) {
      setAssets(assetsData.nia)
      setIsAssetsLoaded(true)
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

  // Update quote request handler
  const requestQuote = useMemo(
    () => createQuoteRequestHandler(form, parseAssetAmount, assets),
    [form, parseAssetAmount, assets]
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

      // Simulate change event to trigger quote update
      requestQuote()
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

        // Request a quote with this initial amount
        setTimeout(() => requestQuote(), 100)
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

        // Request a quote with this initial amount
        setTimeout(() => requestQuote(), 100)
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
      // Call the original handler
      originalHandler(field, value)

      // Save the updated assets to localStorage
      const otherField = field === 'fromAsset' ? 'toAsset' : 'fromAsset'
      const otherValue = form.getValues()[otherField]

      if (otherValue) {
        const fromAsset = field === 'fromAsset' ? value : otherValue
        const toAsset = field === 'toAsset' ? value : otherValue
        saveLastAssets(fromAsset, toAsset)
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
  ])

  // Add effect to load and restore the user's last used pair and assets
  useEffect(() => {
    if (tradablePairs.length > 0 && assets.length > 0) {
      // Only try to restore if we haven't already set assets (empty state)
      const currentFromAsset = form.getValues().fromAsset
      const currentToAsset = form.getValues().toAsset

      if (
        (!currentFromAsset || currentFromAsset === 'BTC') &&
        !currentToAsset
      ) {
        // Try to load last assets from localStorage
        const lastAssets = loadLastAssets()

        if (lastAssets) {
          // Verify the assets still exist in available assets
          const fromAssetExists = assetExists(lastAssets.fromAsset, assets)
          const toAssetExists = assetExists(lastAssets.toAsset, assets)

          // Only restore if both assets exist
          if (fromAssetExists && toAssetExists) {
            // Make sure there's a valid trading pair for these assets
            const pairExists = tradablePairs.some(
              (p) =>
                (p.base_asset === lastAssets.fromAsset &&
                  p.quote_asset === lastAssets.toAsset) ||
                (p.base_asset === lastAssets.toAsset &&
                  p.quote_asset === lastAssets.fromAsset)
            )

            if (pairExists) {
              // Set the assets in the form
              form.setValue('fromAsset', lastAssets.fromAsset)
              form.setValue('toAsset', lastAssets.toAsset)

              // Update the UI based on these assets
              setTimeout(() => {
                updateMinMaxAmounts()
                requestQuote()
              }, 100)
            }
          }
        }
      }
    }
  }, [tradablePairs, assets, form, updateMinMaxAmounts, requestQuote])

  // Helper function to check if an asset exists
  const assetExists = (assetId: string, assetsList: NiaAsset[]): boolean => {
    // Check if it's BTC (which is not in the assets list)
    if (assetId === 'BTC') return true

    // Check if it's an RGB asset (should be in the assets list)
    return assetsList.some(
      (a) => a.asset_id === assetId || a.ticker === assetId
    )
  }

  // Update effect to save pair when it changes
  useEffect(() => {
    if (selectedPair && selectedPair.id) {
      saveLastPair(selectedPair.id)
    }
  }, [selectedPair])

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
        isToAmountLoading
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
        getAvailableAssets,
        form,
        formatAmount,
        setTradingPairs,
        setTradablePairs,
        setSelectedPair,
        setIsPairsLoading
      ),
    [getPairs, dispatch, getAvailableAssets, form, formatAmount]
  )

  // WebSocket initialization effect - scoped to market maker page only with debouncing
  useEffect(() => {
    isMountedRef.current = true
    let initTimeoutId: number | null = null

    // Function to initialize WebSocket with debouncing
    const initWebSocket = async () => {
      // Prevent multiple initializations using refs for stability
      if (initializationRef.current || !isMountedRef.current) {
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

      // Start WebSocket connection as soon as we have basic requirements
      const hasBasicRequirements = channels.length > 0 && assets.length > 0

      if (!hasBasicRequirements) {
        logger.warn('Basic requirements not met for WebSocket initialization')
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

      // Mark as initialized to prevent re-runs
      initializationRef.current = true
      logger.debug('Starting WebSocket initialization process')

      // Set loading state immediately
      if (isMountedRef.current) {
        setIsLoading(true)
      }

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
          logger.error('WebSocket initialization failed')
          if (isMountedRef.current) {
            toast.error(
              'Could not connect to market maker. Check the maker URL and try again.',
              {
                autoClose: 5000,
                toastId: 'websocket-connection-failed',
              }
            )
          }
        }
      } catch (error) {
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
      }, 300) // Reduced debounce time for more responsive maker switching
    }

    // Only initialize if we have all required data and haven't initialized yet
    // Also check if we're already connected to prevent double initialization
    if (
      channels.length > 0 &&
      assets.length > 0 &&
      pubKey &&
      makerConnectionUrl &&
      !isWebSocketInitialized &&
      !webSocketService.isConnected()
    ) {
      // Additional validation before initialization
      try {
        new URL(makerConnectionUrl)
        logger.info('Scheduling WebSocket initialization with debouncing')
        debouncedInit()
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
    } else if (channels.length === 0 || assets.length === 0) {
      // Don't reset initialization flag if basic data is not available
      // This prevents reconnection loops when data is temporarily unavailable
      logger.debug(
        'Basic data not available, skipping WebSocket initialization'
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

      // Only log and disconnect if we actually initialized the connection
      if (initializationRef.current || isWebSocketInitialized) {
        logger.info(
          'Market maker component unmounting - disconnecting WebSocket'
        )

        // Add a small delay to prevent rapid close/reconnect cycles
        // This helps when the component is rapidly mounting/unmounting
        setTimeout(() => {
          // Double-check that we're still unmounted before closing
          if (!isMountedRef.current) {
            // Close the WebSocket connection when leaving the market maker page
            webSocketService.close()
          }
        }, 500) // 500ms delay

        // Reset WebSocket initialization state immediately
        setIsWebSocketInitialized(false)
        initializationRef.current = false
      }
    }
  }, [
    // Use only essential, stable dependencies to prevent re-mounting loops
    makerConnectionUrl,
    pubKey,
    // Remove dynamic arrays and use only their lengths
    channels.length > 0,
    assets.length > 0,
    // Remove isWebSocketInitialized from dependencies to prevent loops
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

  // Add a window beforeunload event listener to clean up connections when closing the app
  // Note: This is redundant since the main cleanup happens in the WebSocket init effect
  // but kept for safety in case of abrupt app closure
  useEffect(() => {
    const handleBeforeUnload = () => {
      logger.info('App closing, ensuring WebSocket connection is cleaned up')
      webSocketService.close()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

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

  // Handle maker URL changes - re-fetch pairs when maker changes
  useEffect(() => {
    // Only run if we have initial data loaded and a maker URL
    if (isInitialDataLoaded && makerConnectionUrl) {
      logger.info(
        `Maker URL changed to: ${makerConnectionUrl}, resetting state and re-fetching trading pairs`
      )

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
      setQuoteAge(0)

      // Reset min/max amounts since they're specific to the maker's pairs
      setMinFromAmount(0)
      setMaxFromAmount(0)
      setMaxToAmount(0)

      // Clear form amounts but keep assets
      form.setValue('to', '')
      form.setValue('rfq_id', '')

      // Re-fetch trading pairs from the new maker
      fetchAndSetPairs()
    }
  }, [makerConnectionUrl, isInitialDataLoaded, fetchAndSetPairs, form])

  // Fetch initial data
  useEffect(() => {
    const setup = async () => {
      setIsLoading(true)
      try {
        const [
          nodeInfoResponse,
          listChannelsResponse,
          balanceResponse,
          getPairsResponse,
        ] = await Promise.all([
          nodeInfo(),
          listChannels(),
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

        if ('data' in listChannelsResponse && listChannelsResponse.data) {
          const channelsList = listChannelsResponse.data.channels
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
        }

        // Check if there's enough balance to open a channel
        if ('data' in balanceResponse && balanceResponse.data) {
          const { vanilla } = balanceResponse.data
          setHasEnoughBalance(vanilla.spendable >= MIN_CHANNEL_CAPACITY)
        }

        if (assetsData) {
          setAssets(assetsData.nia)
          setIsAssetsLoaded(true)
        }

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
      }
    }

    setup()
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
  ])

  // Update amounts when selectedPair feed changes - don't try to use selectedPairFeed directly
  useEffect(() => {
    if (selectedPair) {
      // We have a pair selected, request quotes directly instead of relying on selectedPairFeed
      setIsPriceLoading(false)
      const fromAmount = form.getValues().from

      if (fromAmount) {
        setIsToAmountLoading(true)
        requestQuote()
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

      // Request an initial quote with a slight delay to prevent rapid requests
      setTimeout(() => {
        requestQuote()
      }, 500)

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

  // Update effect to request quote when from amount changes - use subscription instead of watch
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
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

          // Don't set isQuoteLoading here - let the requestQuote function handle it
          // This prevents the "Getting Latest Quote" message from showing unnecessarily
          requestQuote()
        } else if (!fromAmount || fromAmount === '0') {
          // Clear "to" amount when "from" is empty
          form.setValue('to', '')
          setIsToAmountLoading(false)
          setIsQuoteLoading(false)
          setHasValidQuote(false)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [form, wsConnected, requestQuote, hasValidQuote])

  // Create a debounced effect for from amount changes - optimized to reduce re-renders and server load
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'from') {
        const currentFromAmount = value.from
        if (debouncedFromAmount !== currentFromAmount) {
          const timer = setTimeout(() => {
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
              requestQuote()
            }
          }, 1000) // Increased from 500ms to 1000ms to reduce server load
          return () => clearTimeout(timer)
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
    (excludeAsset: string) => {
      // Get all unique assets from tradable pairs
      const allPairAssets = tradablePairs
        .flatMap((pair) => [pair.base_asset, pair.quote_asset])
        .filter((asset, index, self) => self.indexOf(asset) === index)

      // Ensure we're comparing by ticker if excludeAsset is a ticker
      const excludeAssetId = mapTickerToAssetId(excludeAsset, assets)

      // Include all assets that are part of a valid trading pair
      // This ensures all tradable assets appear in the dropdown
      const tradableAssets = allPairAssets
        // Remove the currently selected asset from options
        .filter((asset) => {
          const assetId = mapTickerToAssetId(asset, assets)
          return assetId !== excludeAssetId
        })
        .map((asset) => {
          // Always display the ticker for the asset
          const displayTicker = isAssetId(asset)
            ? mapAssetIdToTicker(asset, assets)
            : asset

          // Get the asset ID for this asset
          const assetId = isAssetId(asset)
            ? asset
            : mapTickerToAssetId(asset, assets)

          return {
            // Include asset ID for enhanced selector
            assetId: assetId,

            // Don't disable any assets in the dropdown
            disabled: false,

            ticker: displayTicker,

            // Store the actual asset value (which might be an ID or ticker)
            value: asset,
          }
        })

      return tradableAssets
    },
    [tradablePairs, getAvailableAssets, assets]
  )

  // Memoized asset options for both fields to prevent recomputation on every render
  const fromAssetOptions = useMemo(
    () => getAssetOptions(form.getValues().toAsset),
    [getAssetOptions, form.getValues().toAsset, tradablePairs]
  )

  const toAssetOptions = useMemo(
    () => getAssetOptions(form.getValues().fromAsset),
    [getAssetOptions, form.getValues().fromAsset, tradablePairs]
  )

  // Add a window focus event listener to reconnect when the user tabs back to the market maker page
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
        // Throttle focus-based reconnections to prevent rapid attempts
        const now = Date.now()
        if (now - lastReconnectAttemptRef.current < 5000) {
          // Increased from 3000 to 5000
          logger.debug('Focus-based reconnection throttled')
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

            // Use the service's reconnect method for better reliability
            const reconnectInitiated = webSocketService.reconnect()

            if (reconnectInitiated) {
              logger.info(
                'Successfully initiated WebSocket reconnect after page focus'
              )
              // Wait a moment and check if connected
              setTimeout(() => {
                if (webSocketService.isConnected()) {
                  logger.info('WebSocket reconnected after page focus')
                } else {
                  logger.warn(
                    'WebSocket reconnect initiated but not connected yet'
                  )
                }
              }, 2000)
            }
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
  }, [makerConnectionUrl, pubKey, wsConnected, isWebSocketInitialized])

  // Update SwapButton to use isQuoteLoading
  const handleReconnectToMaker = async () => {
    try {
      // Only show loading if we don't have a valid quote
      if (!hasValidQuote) {
        setIsQuoteLoading(true)
      }

      // Reset the circuit breaker and try to reconnect
      webSocketService.resetForNewMaker()

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
        // Request a fresh quote after reconnection
        setTimeout(() => {
          requestQuote()
        }, 1000) // Wait for connection to stabilize
      } else {
        logger.error('Failed to reconnect to market maker')
      }
    } catch (error) {
      console.error('Error reconnecting to market maker:', error)
      toast.error('Failed to reconnect to price feed. Please try again.', {
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

  // Render the swap form UI
  const renderSwapForm = () => (
    <div className="w-full max-w-5xl mx-auto pb-8">
      {/* Main Trading Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left Column - Trading Form */}
        <div className="lg:col-span-3">
          <div className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md rounded-xl border border-slate-700/70 shadow-xl">
            {/* Enhanced Header with Connection Status */}
            <div className="border-b border-slate-700/70 px-4 py-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      wsConnected
                        ? 'bg-green-500 animate-pulse'
                        : 'bg-red-500 animate-pulse'
                    }`}
                  ></div>
                  <h2 className="text-base font-semibold text-white">
                    Market Maker Trading
                  </h2>
                  {!wsConnected && (
                    <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded-full">
                      Connection Lost
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <MakerSelector
                    hasNoPairs={!hasTradablePairs}
                    onMakerChange={refreshAmounts}
                  />

                  {/* WebSocket connection status */}
                  {!wsConnected && (
                    <button
                      className="text-xs px-2 py-1 rounded-md bg-blue-600/30 text-blue-400 hover:bg-blue-600/50 transition-colors border border-blue-500/30"
                      onClick={handleReconnectToMaker}
                      type="button"
                    >
                      Reconnect
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Trading Form */}
            <div className="p-4">
              <form
                className="space-y-4"
                onSubmit={form.handleSubmit(onSubmit)}
              >
                {/* From Asset Section */}
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

                {/* Swap Direction Button */}
                <div className="flex justify-center py-2">
                  <button
                    className={`p-2 rounded-full bg-slate-800 border-2 transition-all transform hover:scale-105 hover:rotate-180 duration-300
                      ${
                        hasChannels && hasTradablePairs && !isSwapInProgress
                          ? 'border-blue-500/50 hover:border-blue-500 cursor-pointer'
                          : 'border-slate-700 opacity-50 cursor-not-allowed'
                      }`}
                    onClick={() =>
                      hasChannels &&
                      hasTradablePairs &&
                      !isSwapInProgress &&
                      onSwapAssets()
                    }
                    type="button"
                  >
                    <SwapIcon />
                  </button>
                </div>

                {/* To Asset Section */}
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
                  onAssetChange={(value) => handleAssetChange('toAsset', value)}
                  readOnly={true}
                  useEnhancedSelector={true}
                  value={form.getValues().to || ''}
                />

                {/* Error Message */}
                {errorMessage && (
                  <div
                    className={`${
                      errorMessage.includes('You can only receive up to')
                        ? 'bg-orange-500/10 border border-orange-500/20'
                        : 'bg-red-500/10 border border-red-500/20'
                    } rounded-lg px-3 py-2 backdrop-blur-sm`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span
                          className={`${
                            errorMessage.includes('You can only receive up to')
                              ? 'text-orange-500'
                              : 'text-red-500'
                          } font-medium text-sm block`}
                        >
                          {errorMessage.includes('You can only receive up to')
                            ? 'Max Receivable Exceeded'
                            : 'Trade Error'}
                        </span>
                        <span
                          className={`${
                            errorMessage.includes('You can only receive up to')
                              ? 'text-orange-400/90'
                              : 'text-red-400/90'
                          } text-xs leading-relaxed block mt-1`}
                        >
                          {errorMessage}
                        </span>
                      </div>
                      <button
                        className="p-1 hover:bg-red-500/10 rounded transition-colors flex-shrink-0"
                        onClick={() => copyToClipboard(errorMessage)}
                        title="Copy error message"
                      >
                        <Copy className="w-3 h-3 text-red-500" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
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
              </form>
            </div>
          </div>
        </div>

        {/* Right Column - Trading Information */}
        <div className="lg:col-span-2 space-y-4">
          {/* Quick Amount Section - Always Visible */}
          {hasChannels && hasTradablePairs && (
            <div className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md rounded-xl border border-slate-700/70 shadow-xl">
              <div className="p-4">
                <QuickAmountSection
                  availableAmount={
                    maxFromAmount > 0
                      ? `${formatAmount(maxFromAmount, form.getValues().fromAsset)} ${displayAsset(form.getValues().fromAsset)}`
                      : undefined
                  }
                  className="mb-4"
                  disabled={
                    !hasChannels ||
                    !hasTradablePairs ||
                    isSwapInProgress ||
                    showConfirmation
                  }
                  onSizeClick={onSizeClick}
                  selectedSize={selectedSize}
                />
              </div>
            </div>
          )}

          {/* Combined Rate & Quote Status Card */}
          {selectedPair && (
            <div className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-md rounded-xl border border-slate-700/70 shadow-xl">
              <div className="p-4">
                {/* Exchange Rate Section */}
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2"></div>
                    Exchange Rate
                  </h3>
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

                {/* Quote Status Section */}
                {quoteResponse && (
                  <div className="border-t border-slate-700/50 pt-4">
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center">
                      <div
                        className={`w-1.5 h-1.5 rounded-full mr-2 ${hasValidQuote ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}
                      ></div>
                      Quote Status
                    </h3>
                    <div
                      className={`p-3 rounded-lg flex items-center justify-between ${hasValidQuote ? 'bg-green-900/20 border border-green-800/30' : 'bg-yellow-900/20 border border-yellow-800/30'}`}
                    >
                      <div className="flex items-center">
                        <div
                          className={`w-2 h-2 rounded-full mr-2 ${hasValidQuote ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}
                        ></div>
                        <div>
                          <span
                            className={`text-xs font-medium ${hasValidQuote ? 'text-green-400' : 'text-yellow-400'}`}
                          >
                            {hasValidQuote ? 'Quote Valid' : 'Quote Expired'}
                          </span>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {hasValidQuote
                              ? `Updated ${quoteAge}s ago`
                              : 'Please refresh for current price'}
                          </p>
                        </div>
                      </div>
                      <button
                        className="px-3 py-1.5 rounded-md bg-blue-600/30 text-blue-400 hover:bg-blue-600/50 transition-colors text-xs font-medium"
                        onClick={() => requestQuote()}
                        type="button"
                      >
                        Refresh
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Fee Information Card */}
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
  )

  // Determine if we're still in a loading state - be more comprehensive
  const isStillLoading =
    isLoading || // True during the main setup fetchData
    !isInitialDataLoaded ||
    !isChannelsLoaded ||
    !isAssetsLoaded ||
    isPairsLoading || // True until fetchAndSetPairs completes
    // Only wait for WebSocket if we have tradable channels AND a maker URL
    (!!makerConnectionUrl &&
      hasTradableChannels(channels) &&
      !isWebSocketInitialized)
  // Removed the problematic condition that was waiting for pairs when WebSocket is connected
  // If we have no tradable pairs, we should show the appropriate message, not keep loading

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
    isWebSocketInitialized && // WebSocket initialization must have been attempted
    !wsConnected && // WebSocket is currently not connected
    hasTradableChannels(channels) && // Physical tradable channels exist
    hasValidChannelsForTrading // Trading was deemed possible based on initial channel/pair checks

  return (
    <div className="w-full min-h-full overflow-y-auto">
      {isStillLoading ? (
        <div className="flex flex-col justify-center items-center h-64 gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full blur-lg"></div>
            <div className="relative">
              <Loader />
            </div>
          </div>
          <div className="text-center space-y-2">
            <p className="text-blue-400 font-semibold text-base">
              Connecting to Market Maker
            </p>
            <p className="text-slate-400 text-sm max-w-md">
              {isLoading
                ? 'Fetching initial data...'
                : !isChannelsLoaded
                  ? 'Loading channel information...'
                  : !isAssetsLoaded
                    ? 'Loading asset information...'
                    : isPairsLoading
                      ? 'Loading trading pairs...'
                      : !!makerConnectionUrl && !isWebSocketInitialized
                        ? 'Establishing WebSocket connection...'
                        : 'Finalizing setup...'}
            </p>
            <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      ) : shouldShowWSDisconnectedMessage ? (
        <div className="w-full flex justify-center py-4">
          <WebSocketDisconnectedMessage
            makerUrl={makerConnectionUrl}
            onMakerChange={refreshAmounts}
          />
        </div>
      ) : shouldShowNoChannelsMessage ? (
        <div className="w-full flex justify-center py-4">
          <div className="space-y-4">
            <NoTradingChannelsMessage
              {...createTradingChannelsMessageProps(
                assets,
                tradablePairs,
                hasEnoughBalance,
                navigate,
                refreshAmounts
              )}
            />
            {/* Additional helpful message for switching makers */}
            <div className="max-w-2xl mx-auto bg-slate-900/30 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4">
              <div className="flex items-center gap-3 text-slate-400">
                <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                  <HelpCircle className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-sm">
                  No compatible trading pairs found with this market maker. Try
                  switching to a different maker above or create channels with
                  supported assets.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full py-4 px-3">{renderSwapForm()}</div>
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
            refreshAmounts()
          }}
          swapDetails={swapRecapDetails}
        />
      )}
      {/* <div className="w-full max-w-4xl mx-auto"> 
        {assets.length > 0 && <StatusToast assets={assets} />}
      </div> */}
    </div>
  )
}
