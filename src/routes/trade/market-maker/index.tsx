import { Copy } from 'lucide-react'
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
  calculateExchangeRate,
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
  const [selectedSize, setSelectedSize] = useState(100)
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
  const [hasValidChannelsForTrading, setHasValidChannelsForTrading] =
    useState(false)
  const [debouncedFromAmount, setDebouncedFromAmount] = useState('')

  const [showRecap, setShowRecap] = useState<boolean>(false)
  const [swapRecapDetails, setSwapRecapDetails] =
    useState<SwapDetailsType | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)

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
  const [loadingResetKey, setLoadingResetKey] = useState(0)

  // Get the quote response from Redux based on our current form values
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

    // If we have a new quote that's different from the last one, track it
    if (
      quote &&
      (!lastQuoteResponseRef.current ||
        quote.to_amount !== lastQuoteResponseRef.current.to_amount ||
        quote.timestamp !== lastQuoteResponseRef.current.timestamp)
    ) {
      lastQuoteResponseRef.current = quote

      // Avoid calling setState during render by using requestAnimationFrame
      window.requestAnimationFrame(() => {
        setQuoteResponseTimestamp(Date.now())
        setIsToAmountLoading(false)
        setIsPriceLoading(false)

        // Update the price from the quote
        if (quote.price) {
          setCurrentPrice(quote.price)
          logger.debug(`Updated price to: ${quote.price}`)
        }

        // Update the fees
        if (quote.fee) {
          setFees({
            baseFee: quote.fee.base_fee,
            feeRate: quote.fee.fee_rate,
            totalFee: quote.fee.final_fee,
            variableFee: quote.fee.variable_fee,
          })
          logger.debug(
            `Updated fees: base=${quote.fee.base_fee}, rate=${quote.fee.fee_rate}, total=${quote.fee.final_fee}`
          )
        }

        // Update quote validity tracking
        setHasValidQuote(true)
        setQuoteExpiresAt(quote.expires_at || null)

        // Format and update the 'to' field with the received amount
        const toTickerForUI = mapAssetIdToTicker(quote.to_asset, assets)

        // If to_asset is BTC, convert from millisats to sats
        let displayToAmount = quote.to_amount
        if (quote.to_asset === 'BTC' || toTickerForUI === 'BTC') {
          displayToAmount = Math.round(displayToAmount / MSATS_PER_SAT)
          logger.debug(
            `Converting BTC to_amount from ${quote.to_amount} millisats to ${displayToAmount} sats`
          )
        }

        const formattedToAmount = formatAmount(displayToAmount, toTickerForUI)
        form.setValue('to', formattedToAmount)

        // Important: Save the RFQ ID from the quote to use when executing the swap
        if (quote.rfq_id) {
          form.setValue('rfq_id', quote.rfq_id)
          logger.debug(`Saved RFQ ID: ${quote.rfq_id} for later swap execution`)
        }

        logger.debug(
          `Setting 'to' form value to ${formattedToAmount} (raw: ${quote.to_amount})`
        )

        // Clear any validation errors if we got a valid quote
        setErrorMessage(null)
      })

      logger.debug(
        `New quote received for ${key}: ${quote.to_amount}, updating UI`
      )
    }

    return quote
  })

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

  // Add updateToAmount implementation
  const updateToAmount = useCallback(
    (amount: number, asset: string) => {
      const formattedAmount = formatAmount(amount, asset)
      form.setValue('to', formattedAmount)
      // Reset loading state
      setIsToAmountLoading(false)
      // Increment loading reset key to force re-render of to-field
      setLoadingResetKey((prev) => prev + 1)
    },
    [form, formatAmount]
  )

  // Add a dedicated effect to process the quote response and update the RFQ ID
  useEffect(() => {
    if (quoteResponse && quoteResponseTimestamp > 0) {
      setIsPriceLoading(false)
      setIsToAmountLoading(false)

      // Use updateToAmount to set the quoted amount
      if (quoteResponse.to_amount) {
        let toAmount = quoteResponse.to_amount

        // If to_asset is BTC, convert from millisats to sats
        if (
          quoteResponse.to_asset === 'BTC' ||
          form.getValues().toAsset === 'BTC'
        ) {
          toAmount = Math.round(toAmount / MSATS_PER_SAT)
          logger.debug(
            `Converting BTC to_amount from ${quoteResponse.to_amount} millisats to ${toAmount} sats`
          )
        }

        updateToAmount(toAmount, form.getValues().toAsset)

        // Check if the quoted amount exceeds maximum receivable amount
        if (toAmount > maxToAmount) {
          const formattedMaxToAmount = formatAmount(
            maxToAmount,
            form.getValues().toAsset
          )
          const displayedAsset = displayAsset(form.getValues().toAsset)
          const errorMsg = `You can only receive up to ${formattedMaxToAmount} ${displayedAsset}.`
          logger.warn(
            `Quote exceeds maximum receivable amount: ${toAmount} > ${maxToAmount}`
          )
          setErrorMessage(errorMsg)
        } else {
          // Clear any error message about exceeding maximum receivable amount if it exists
          const currentErrorMessage = errorMessage || ''
          if (currentErrorMessage.includes(`You can only receive up to`)) {
            setErrorMessage(null)
          }
        }
      }

      // Always update the RFQ ID from the current quote to ensure we have the latest
      if (quoteResponse.rfq_id) {
        form.setValue('rfq_id', quoteResponse.rfq_id)
      }
    }
  }, [
    quoteResponseTimestamp,
    quoteResponse,
    form,
    updateToAmount,
    maxToAmount,
    formatAmount,
    displayAsset,
    errorMessage,
  ])

  // Update quote request handler
  const requestQuote = useMemo(
    () => createQuoteRequestHandler(form, parseAssetAmount, assets),
    [form, parseAssetAmount, assets]
  )

  // Calculate rate using a memoized function
  const calculateRate = useCallback(() => {
    if (currentPrice !== null && selectedPair) {
      const isCurrentPairInverted = isPairInverted(
        form.getValues().fromAsset,
        form.getValues().toAsset
      )
      return calculateExchangeRate(
        currentPrice,
        1, // Size doesn't matter for rate calculation
        isCurrentPairInverted
      )
    }
    return 1
  }, [currentPrice, selectedPair, form, isPairInverted])

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
      return handler(size)
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

      logger.debug(
        `Updated max amounts - From: ${newMaxFromAmount} ${fromAsset}, To: ${newMaxToAmount} ${toAsset}`
      )

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
      if (!currentFromAmount || parseFloat(currentFromAmount) === 0) {
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
        setSelectedSize(25) // Set to 25% by default

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
      logger.debug(
        `Initializing UI with default values for pair ${selectedPair.base_asset}/${selectedPair.quote_asset}`
      )

      // If there's no "from" amount yet, set a default
      if (!form.getValues().from) {
        const fromAsset = form.getValues().fromAsset
        const initialAmount = Math.max(minFromAmount * 2, maxFromAmount * 0.25)
        const formattedAmount = formatAmount(initialAmount, fromAsset)

        logger.debug(
          `Setting initial "from" amount to ${formattedAmount} ${fromAsset}`
        )
        form.setValue('from', formattedAmount, { shouldValidate: true })
        setSelectedSize(25) // Set to 25% by default

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
        logger.debug('Attempting to restore last used pair and assets')

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
              logger.debug(
                `Restoring last assets: from=${lastAssets.fromAsset}, to=${lastAssets.toAsset}`
              )

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

  // Update error message when amounts change
  useEffect(() => {
    const fromAmount = parseAssetAmount(
      form.watch('from'),
      form.watch('fromAsset')
    )
    const toAmount = parseAssetAmount(form.watch('to'), form.watch('toAsset'))

    // Use our utility function to generate error messages
    const errorMsg = getValidationError(
      fromAmount,
      toAmount,
      minFromAmount,
      maxFromAmount,
      maxToAmount,
      max_outbound_htlc_sat,
      form.watch('fromAsset'),
      form.watch('toAsset'),
      formatAmount,
      displayAsset,
      assets
    )

    setErrorMessage(errorMsg)
  }, [
    form.watch('from'),
    form.watch('to'),
    form.watch('fromAsset'),
    form.watch('toAsset'),
    minFromAmount,
    maxFromAmount,
    maxToAmount,
    max_outbound_htlc_sat,
    parseAssetAmount,
    formatAmount,
    displayAsset,
    assets,
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
        setSelectedPair
      ),
    [getPairs, dispatch, getAvailableAssets, form, formatAmount]
  )

  // Initialize WebSocket connection
  useEffect(() => {
    // Skip if no maker URL is provided
    if (!makerConnectionUrl) {
      logger.warn(
        'No maker connection URL provided. WebSocket initialization skipped.'
      )
      return
    }

    // Log connection attempt
    logger.info(
      `Attempting to initialize WebSocket connection to ${makerConnectionUrl}`
    )

    // Track if component is mounted
    let isMounted = true

    // Function to initialize WebSocket
    const initWebSocket = async () => {
      // Check for valid channels before attempting to connect
      const tradableAssetIds = channels
        .filter(
          (channel) =>
            channel.ready &&
            (channel.outbound_balance_msat > 0 ||
              channel.inbound_balance_msat > 0) &&
            channel.asset_id
        )
        .map((channel) => channel.asset_id as string)
        .filter((id, index, self) => self.indexOf(id) === index)

      if (tradableAssetIds.length === 0) {
        logger.warn(
          'No tradable channels with assets found. WebSocket initialization skipped.'
        )
        return
      }

      // Set loading state
      if (isMounted) {
        setIsLoading(true)
      }

      try {
        // Create client ID based on pubkey or timestamp if not available
        const clientId = pubKey || `client-${Date.now()}`

        // Log connection attempt with detailed info
        logger.info(
          `Initializing WebSocket connection to ${makerConnectionUrl} with client ID ${clientId} and ${tradableAssetIds.length} tradable assets`
        )

        // Initialize the connection through the service
        const success = webSocketService.init(
          makerConnectionUrl,
          clientId,
          dispatch
        )

        if (success) {
          logger.info('WebSocket initialization successful')

          // Log WebSocket diagnostics
          const diagnostics = webSocketService.getDiagnostics()
          logger.info('WebSocket connection diagnostics:', diagnostics)
        } else {
          logger.error('WebSocket initialization failed')
          if (isMounted) {
            toast.error(
              'Could not connect to market maker. Trading may be limited.'
            )
          }
        }
      } catch (error) {
        logger.error('Error during WebSocket initialization:', error)
        if (isMounted) {
          toast.error(
            'Error connecting to market maker. Please try again later.'
          )
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    // Initialize WebSocket if we have channels and assets data
    if (channels.length > 0 && assets.length > 0) {
      initWebSocket()
    }

    // Clean up function
    return () => {
      isMounted = false
      // Note: We don't close the WebSocket connection on component unmount
      // The webSocketService manages its own lifecycle and will be reused across the app
      logger.info(
        'WebSocket initialization component unmounting - connection maintained by service'
      )
    }
  }, [makerConnectionUrl, pubKey, dispatch, channels, assets, selectedPair])

  // Restore the effect to update min and max amounts when selected pair changes
  useEffect(() => {
    if (selectedPair) {
      updateMinMaxAmounts()
    }
  }, [selectedPair, updateMinMaxAmounts])

  // Add a window beforeunload event listener to clean up connections when closing the app
  useEffect(() => {
    const handleBeforeUnload = () => {
      logger.info('App closing, cleaning up WebSocket connection')
      webSocketService.close()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  // Simplified retryConnection function
  const retryConnection = useCallback(async () => {
    logger.info('Manually reconnecting WebSocket...')
    setIsLoading(true)

    try {
      // Use the service's reconnect method
      const reconnectInitiated = webSocketService.reconnect()

      if (reconnectInitiated) {
        // Wait a moment for the connection to establish
        await new Promise((resolve) => setTimeout(resolve, 2000))

        // Check if the connection was successful
        if (webSocketService.isConnected()) {
          // Refresh pairs after successful reconnection
          await fetchAndSetPairs()
          toast.success('Successfully reconnected to market maker')
        } else {
          // If not connected after delay, try again
          logger.warn('WebSocket reconnection initiated but not connected yet')
          toast.warning('Reconnection in progress. Please wait...')
        }
      } else {
        logger.error('Failed to initiate WebSocket reconnection')
        toast.error('Failed to reconnect. Please try again.')
      }
    } catch (error) {
      logger.error('Error during manual WebSocket reconnection:', error)
      toast.error('Failed to reconnect to market maker')
    } finally {
      // Refresh amounts after reconnection attempt
      try {
        await refreshAmounts()
      } catch (error) {
        logger.error('Error refreshing amounts after reconnection:', error)
      }
      setIsLoading(false)
    }
  }, [fetchAndSetPairs, refreshAmounts])

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
        }

        await fetchAndSetPairs()

        logger.info('Initial data fetched successfully')
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
    if (form.getValues().fromAsset && form.getValues().toAsset && wsConnected) {
      // Start quote request timer with increased interval to reduce load
      startQuoteRequestTimer(requestQuote, 8000) // Increased from default 5000ms to 8000ms

      // Request an initial quote
      requestQuote()

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

  // Update effect to request quote when from amount changes
  useEffect(() => {
    const fromAmount = form.watch('from')
    const fromAsset = form.watch('fromAsset')
    const toAsset = form.watch('toAsset')

    // Only request quote if we have all required values
    if (fromAmount && fromAsset && toAsset && wsConnected) {
      // Even if no selected pair, we should still try to get a quote
      // Wrap state updates in requestAnimationFrame to avoid infinite update loops
      window.requestAnimationFrame(() => {
        setIsToAmountLoading(true)
        setIsQuoteLoading(true)

        // Short timeout to ensure state updates are applied before requesting quote
        setTimeout(() => {
          requestQuote()
        }, 0)
      })
    } else if (!fromAmount || fromAmount === '0') {
      // Clear "to" amount when "from" is empty
      form.setValue('to', '')

      // Wrap state updates in requestAnimationFrame to avoid race conditions
      window.requestAnimationFrame(() => {
        setIsToAmountLoading(false)
        setIsQuoteLoading(false)
      })
    }
  }, [form, wsConnected, requestQuote])

  // Create a debounced effect for from amount changes
  useEffect(() => {
    if (debouncedFromAmount !== form.watch('from')) {
      const timer = setTimeout(() => {
        // Use debouncedFromAmount in comparison
        if (
          debouncedFromAmount &&
          form.watch('fromAsset') &&
          form.watch('toAsset')
        ) {
          requestQuote()
        }
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [debouncedFromAmount, form, requestQuote])

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
      const availableAssets = getAvailableAssets()
      logger.debug(
        `Available assets for trading: ${JSON.stringify(availableAssets)}`
      )

      // Get all unique assets from tradable pairs
      const allPairAssets = tradablePairs
        .flatMap((pair) => [pair.base_asset, pair.quote_asset])
        .filter((asset, index, self) => self.indexOf(asset) === index)

      logger.debug(
        `All assets from tradable pairs: ${JSON.stringify(allPairAssets)}`
      )

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

          return {
            // Don't disable any assets in the dropdown
            disabled: false,
            ticker: displayTicker,
            // Store the actual asset value (which might be an ID or ticker)
            value: asset,
          }
        })

      logger.debug(
        `Tradable asset options (excluding ${excludeAsset}): ${JSON.stringify(tradableAssets)}`
      )

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

  // Add a window focus event listener to reconnect when the user tabs back to the app
  useEffect(() => {
    if (!makerConnectionUrl) return

    // Track if the page has been in the background
    let wasInBackground = false

    // Handler for when the page loses focus
    const handleBlur = () => {
      logger.debug('Application window lost focus')
      wasInBackground = true
    }

    // Handler for when the page gains focus
    const handleFocus = async () => {
      if (wasInBackground && !wsConnected) {
        logger.info(
          'Application was in background and WebSocket is disconnected, attempting to reconnect'
        )
        wasInBackground = false

        try {
          // Attempt to reconnect
          const reconnectInitiated = webSocketService.reconnect()
          if (reconnectInitiated) {
            logger.info(
              'Successfully initiated WebSocket reconnect after page focus'
            )
            // Wait a moment and check if connected
            setTimeout(() => {
              if (webSocketService.isConnected()) {
                logger.info('WebSocket reconnected after page focus')
              }
            }, 1000)
          }
        } catch (error) {
          logger.error('Error reconnecting WebSocket after page focus:', error)
        }
      }

      wasInBackground = false
    }

    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
    }
  }, [makerConnectionUrl, wsConnected])

  // Update SwapButton to use isQuoteLoading
  const handleReconnectToMaker = async () => {
    try {
      setIsQuoteLoading(true)
      // Try to reconnect the WebSocket
      const reconnected = Boolean(await retryConnection())
      if (reconnected) {
        logger.info('Successfully reconnected to market maker')
        // Request a fresh quote after reconnection
        requestQuote()
      } else {
        logger.error('Failed to reconnect to market maker')
      }
    } catch (error) {
      console.error('Error reconnecting to market maker:', error)
      toast.error('Failed to reconnect to price feed. Please try again.')
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
    <div className="swap-form-container w-full max-w-xl">
      <div className="bg-gradient-to-b from-slate-900/95 to-slate-800/95 backdrop-blur-md rounded-2xl border border-slate-700/70 shadow-xl w-full">
        <div className="border-b border-slate-700/70 px-4 py-3">
          <div className="flex justify-between items-center">
            <MakerSelector hasNoPairs={false} onMakerChange={refreshAmounts} />

            {/* WebSocket connection status indicator */}
            <div className="flex items-center space-x-2">
              {!wsConnected && (
                <button
                  className="text-xs px-2 py-1 rounded bg-blue-600/30 text-blue-400 hover:bg-blue-600/50"
                  onClick={handleReconnectToMaker}
                  type="button"
                >
                  Reconnect
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-3.5">
          <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
            <SwapInputField
              asset={form.getValues().fromAsset}
              assetOptions={fromAssetOptions}
              availableAmount={`${formatAmount(maxFromAmount, form.getValues().fromAsset)} ${displayAsset(form.getValues().fromAsset)}`}
              availableAmountLabel="Available:"
              disabled={!hasChannels || !hasTradablePairs || isSwapInProgress}
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
                // Manually set debounced value after handling the input
                setDebouncedFromAmount(e.target.value)
                quoteHandler(e)
              }}
              onAssetChange={(value) => handleAssetChange('fromAsset', value)}
              onRefresh={refreshAmounts}
              onSizeClick={onSizeClick}
              selectedSize={selectedSize}
              showMaxHtlc
              showMinAmount
              showSizeButtons
              value={form.getValues().from}
            />

            <div className="flex justify-center -my-1">
              <button
                className={`p-1.5 rounded-lg bg-slate-800 border transition-all transform hover:scale-110
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

            <SwapInputField
              asset={form.getValues().toAsset}
              assetOptions={toAssetOptions}
              availableAmount={`${formatAmount(maxToAmount, form.getValues().toAsset)} ${displayAsset(form.getValues().toAsset)}`}
              availableAmountLabel="Can receive up to:"
              disabled={!hasChannels || !hasTradablePairs || isSwapInProgress}
              formatAmount={formatAmount}
              getDisplayAsset={displayAsset}
              isLoading={isToAmountLoading}
              key={`to-field-${loadingResetKey}`}
              label="You Receive (Estimated)"
              maxAmount={maxToAmount}
              onAssetChange={(value) => handleAssetChange('toAsset', value)}
              readOnly={true}
              value={form.getValues().to || ''}
            />

            {selectedPair && (
              <>
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

                {/* Quote freshness indicator */}
                {quoteResponse && (
                  <div
                    className={`mt-2 px-3 py-2 rounded-lg flex items-center justify-between ${hasValidQuote ? 'bg-green-900/20 border border-green-800/30' : 'bg-yellow-900/20 border border-yellow-800/30'}`}
                  >
                    <div className="flex items-center">
                      <div
                        className={`w-2 h-2 rounded-full mr-2 ${hasValidQuote ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}
                      ></div>
                      <span
                        className={`text-xs ${hasValidQuote ? 'text-green-400' : 'text-yellow-400'}`}
                      >
                        {hasValidQuote
                          ? `Quote valid (${quoteAge}s ago)`
                          : 'Quote expired - update price'}
                      </span>
                    </div>
                    <button
                      className="text-xs px-2 py-1 rounded bg-blue-600/30 text-blue-400 hover:bg-blue-600/50"
                      onClick={() => requestQuote()}
                      type="button"
                    >
                      Refresh
                    </button>
                  </div>
                )}
              </>
            )}

            <FeeSection
              assets={assets}
              bitcoinUnit={bitcoinUnit}
              displayAsset={displayAsset}
              fees={fees}
              quoteResponse={quoteResponse}
              toAsset={form.getValues().toAsset}
            />

            {errorMessage && (
              <div
                className={`${
                  errorMessage.includes('You can only receive up to')
                    ? 'bg-orange-500/10 border border-orange-500/20'
                    : 'bg-red-500/10 border border-red-500/20'
                } rounded-lg px-3 py-2.5 mt-2.5`}
              >
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span
                      className={`${
                        errorMessage.includes('You can only receive up to')
                          ? 'text-orange-500'
                          : 'text-red-500'
                      } font-medium`}
                    >
                      {errorMessage.includes('You can only receive up to')
                        ? 'Max Receivable Exceeded'
                        : 'Trade Error'}
                    </span>
                    <button
                      className="p-1 hover:bg-red-500/10 rounded transition-colors"
                      onClick={() => copyToClipboard(errorMessage)}
                      title="Copy error message"
                    >
                      <Copy className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                  <span
                    className={`${
                      errorMessage.includes('You can only receive up to')
                        ? 'text-orange-400/90'
                        : 'text-red-400/90'
                    } text-sm leading-relaxed`}
                  >
                    {errorMessage}
                  </span>
                </div>
              </div>
            )}

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
  )

  return (
    <div className="container px-2 mx-auto">
      {isLoading ? (
        <div className="flex flex-col justify-center items-center h-64 gap-4">
          <Loader />
          <div className="text-center">
            <p className="text-blue-400 font-medium">
              Connecting to Market Maker
            </p>
            <p className="text-slate-400 text-sm mt-1">
              Fetching available trading pairs and checking channel balances...
            </p>
          </div>
        </div>
      ) : !hasValidChannelsForTrading ? (
        <div className="w-full flex justify-center">
          <NoTradingChannelsMessage
            {...createTradingChannelsMessageProps(
              assets,
              tradablePairs,
              hasEnoughBalance,
              navigate,
              refreshAmounts
            )}
          />
        </div>
      ) : !wsConnected && hasTradableChannels(channels) ? (
        <div className="w-full flex justify-center">
          <WebSocketDisconnectedMessage
            makerUrl={makerConnectionUrl}
            onMakerChange={retryConnection}
          />
        </div>
      ) : !wsConnected || tradablePairs.length === 0 ? (
        <div className="w-full flex justify-center">
          <NoTradingChannelsMessage
            {...createTradingChannelsMessageProps(
              assets,
              tradablePairs,
              hasEnoughBalance,
              navigate,
              refreshAmounts
            )}
          />
        </div>
      ) : (
        <div className="w-full flex justify-center py-1">
          {renderSwapForm()}
        </div>
      )}

      <SwapConfirmation
        bitcoinUnit={bitcoinUnit}
        exchangeRate={calculateRate()}
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
