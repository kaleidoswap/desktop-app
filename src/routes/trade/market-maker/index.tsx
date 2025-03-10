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
} from '../../../helpers/number'
import { SwapIcon } from '../../../icons/Swap'
import { makerApi, TradingPair } from '../../../slices/makerApi/makerApi.slice'
import {
  setTradingPairs,
  subscribeToPair,
  unsubscribeFromPair,
} from '../../../slices/makerApi/pairs.slice'
import {
  nodeApi,
  Channel,
  NiaAsset,
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
} from './assetUtils'
import { hasTradableChannels, logChannelDiagnostics } from './channelUtils'

// Import our utility modules
import { getValidationError } from './errorMessages'
import {
  createFromAmountChangeHandler,
} from './formUtils'
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
import { subscribeToPairFeed } from './websocketUtils'

const MSATS_PER_SAT = 1000
const RGB_HTLC_MIN_SAT = 3000

export const Component = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const usePrevious = (value: any) => {
    const ref = useRef()
    useEffect(() => {
      ref.current = value
    }, [value])
    return ref.current
  }

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
    variableFee: 0,
    totalFee: 0,
    feeRate: 0,
  })

  const [isSwapInProgress, setIsSwapInProgress] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasValidChannelsForTrading, setHasValidChannelsForTrading] =
    useState(false)
  const [debouncedFromAmount, setDebouncedFromAmount] = useState('')

  const [showRecap, setShowRecap] = useState<boolean>(false)
  const [swapRecapDetails, setSwapRecapDetails] =
    useState<SwapDetailsType | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const makerConnectionUrl = useAppSelector(
    (state) => state.nodeSettings.data.default_maker_url
  )
  const wsConnected = useAppSelector((state) => state.pairs.wsConnected)
  const bitcoinUnit = useAppSelector((state) => state.settings.bitcoinUnit)
  
  // Define parseAssetAmount early to avoid initialization error in quoteResponse
  const parseAssetAmount = (amount: string | undefined | null, asset: string): number => {
    return parseAssetAmountWithPrecision(amount, asset, bitcoinUnit, assets)
  }
  
  // Replace selectedPairFeed with direct price tracking
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);

  // Create a ref to track the quote response
  const lastQuoteResponseRef = useRef<any>(null);
  const [quoteResponseTimestamp, setQuoteResponseTimestamp] = useState(0);
  const [loadingResetKey, setLoadingResetKey] = useState(0);

  // Get the quote response from Redux based on our current form values
  const quoteResponse = useAppSelector((state) => {
    const fromAsset = form.getValues().fromAsset;
    const toAsset = form.getValues().toAsset;
    const fromAmount = parseAssetAmount(form.getValues().from, fromAsset);
    
    if (fromAsset && toAsset && fromAmount > 0) {
      const key = `${fromAsset}/${toAsset}/${fromAmount}`;
      const quote = state.pairs.quotes[key];
      
      // If we have a new quote that's different from the last one, track it
      if (quote && (!lastQuoteResponseRef.current || 
          quote.to_amount !== lastQuoteResponseRef.current.to_amount ||
          quote.timestamp !== lastQuoteResponseRef.current.timestamp)) {
        lastQuoteResponseRef.current = quote;
        
        // Avoid calling setState during render by using requestAnimationFrame
        window.requestAnimationFrame(() => {
          setQuoteResponseTimestamp(Date.now());
          
          // Update the price from the quote
          if (quote.price) {
            setCurrentPrice(quote.price);
          }
        });
        
        logger.debug(`New quote received for ${key}: ${quote.to_amount}`);
      }
      
      return quote;
    }
    return null;
  });

  // Add state for quote validity tracking
  const [hasValidQuote, setHasValidQuote] = useState(false);
  const [quoteExpiresAt, setQuoteExpiresAt] = useState<number | null>(null);
  const [quoteAge, setQuoteAge] = useState<number>(0);

  // Update quote validity every second
  useEffect(() => {
    if (!quoteExpiresAt) {
      setHasValidQuote(false);
      return;
    }

    const checkValidity = () => {
      const now = Date.now();
      const expiresAtMs = quoteExpiresAt * 1000; // Convert to ms if in seconds
      const isExpired = now >= expiresAtMs;
      const ageMs = Math.max(0, now - (quoteResponseTimestamp || 0));
      
      setQuoteAge(Math.floor(ageMs / 1000)); // Age in seconds
      setHasValidQuote(!isExpired);
    };

    // Check immediately
    checkValidity();
    
    // Then set up an interval
    const interval = setInterval(checkValidity, 1000);
    return () => clearInterval(interval);
  }, [quoteExpiresAt, quoteResponseTimestamp]);

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

  const displayAsset = useCallback(
    (asset: string) => {
      return getDisplayAsset(asset, bitcoinUnit)
    },
    [bitcoinUnit]
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

  const formatAmount = useCallback(
    (amount: number, asset: string) => {
      return formatAssetAmountWithPrecision(amount, asset, bitcoinUnit, assets)
    },
    [assets, bitcoinUnit]
  )

  // Update to amount when quote response changes
  useEffect(() => {
    if (quoteResponse) {
      // Log the entire quote response for debugging
      logger.info('Processing quote response:', quoteResponse, 'timestamp:', quoteResponseTimestamp);
      
      // Immediately reset all loading states to avoid UI stuck in loading state
      setIsToAmountLoading(false);
      setIsQuoteLoading(false);
      setIsPriceLoading(false);
      
      // The quote response structure has to_amount (not taker_to_amount)
      const toAmount = quoteResponse.to_amount;
      
      if (toAmount !== undefined && toAmount !== null) {
        // Format the amount according to the asset precision
        const formattedAmount = formatAmount(toAmount, form.getValues().toAsset);
        logger.info(`Setting "to" field to: ${formattedAmount} (raw: ${toAmount})`);
        
        // Set the to amount from the quote
        form.setValue(
          'to',
          formattedAmount,
          { shouldValidate: true }
        );
        
        // Store the RFQ ID from the quote response if available
        if (quoteResponse.rfq_id) {
          logger.debug(`Setting RFQ ID from quote: ${quoteResponse.rfq_id}`);
          form.setValue('rfq_id', quoteResponse.rfq_id);
        }
        
        // Set fees information
        setFees({
          baseFee: quoteResponse.base_fee || 0,
          variableFee: quoteResponse.variable_fee || 0,
          totalFee: quoteResponse.final_fee || 0,
          feeRate: quoteResponse.fee_rate || 0,
        });
        
        // Set quote validity information
        setQuoteExpiresAt(quoteResponse.expires_at || null);
        setHasValidQuote(true);
        
        // Update loading states - make sure to do this in a way that doesn't trigger infinite updates
        window.requestAnimationFrame(() => {
          // Force a re-render to ensure loading states are reflected
          setLoadingResetKey(prev => prev + 1);
        });
        
        logger.info(`Updated "to" amount from quote response: ${toAmount} -> ${formattedAmount}`);
      } else {
        logger.error('Quote response missing to_amount:', quoteResponse);
        // Handle error case - set loading to false to avoid getting stuck
        setHasValidQuote(false);
        setQuoteExpiresAt(null);
        
        window.requestAnimationFrame(() => {
          setLoadingResetKey(prev => prev + 1);
        });
      }
    }
  // Remove quoteResponseTimestamp from dependencies to prevent infinite loop
  }, [quoteResponse, form, formatAmount]);

  // Update quote request handler
  const requestQuote = useMemo(
    () =>
      createQuoteRequestHandler(
        form,
        parseAssetAmount,
        setIsQuoteLoading
      ),
    [form, parseAssetAmount]
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

  // Update the "to" amount based on the "from" amount - simplified since we're using the WebSocket
  const updateToAmount = useCallback(
    (fromAmount: string) => {
      const fromAsset = form.getValues().fromAsset
      const toAsset = form.getValues().toAsset
      
      if (!fromAsset || !toAsset || !fromAmount || fromAmount === '0') {
        form.setValue('to', '')
        setIsToAmountLoading(false)
        return
      }
      
      // Request a new quote via WebSocket
      setIsToAmountLoading(true)
      requestQuote()
    },
    [form, requestQuote, setIsToAmountLoading]
  )

  // Create compatible setFromAmount function for handlers that expect the different signature
  const setFromAmount = useCallback(
    (amount: number, fromAsset: string, percentageOfMax?: number) => {
      const formattedAmount = formatAmount(amount, fromAsset)
      form.setValue('from', formattedAmount, { shouldValidate: true })
      // Simulate change event to trigger quote update
      requestQuote()
      return Promise.resolve(null)
    },
    [form, formatAmount, requestQuote]
  )

  // Create onSizeClick handler from our utility
  const onSizeClick = useMemo(
    () => createSizeClickHandler(form, maxFromAmount, setFromAmount),
    [form, maxFromAmount, setFromAmount]
  )

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
          const localAmounts = assetChannels.map((c: Channel) => c.asset_local_amount)
          maxAssetAmount =
            localAmounts.length > 0 ? Math.max(...localAmounts) : 0
        } else {
          const remoteAmounts = assetChannels.map((c: Channel) => c.asset_remote_amount)
          maxAssetAmount =
            remoteAmounts.length > 0 ? Math.max(...remoteAmounts) : 0
        }
        return maxAssetAmount
      }
    },
    [channels, assetsData]
  )

  // Keep existing updateMinMaxAmounts for now
  const updateMinMaxAmounts = useCallback(async () => {
    if (selectedPair) {
      const fromAsset = form.getValues().fromAsset
      const toAsset = form.getValues().toAsset

      let minOrderSize
      if (!isPairInverted(fromAsset, toAsset)) {
        minOrderSize = selectedPair.min_order_size
      } else {
        const rate = calculateRate()
        minOrderSize = selectedPair.min_order_size / rate
      }
      setMinFromAmount(minOrderSize)

      // Calculate max amounts
      const newMaxFromAmount = await calculateMaxTradableAmount(fromAsset, true)
      const newMaxToAmount = await calculateMaxTradableAmount(toAsset, false)

      setMaxFromAmount(newMaxFromAmount)
      setMaxToAmount(newMaxToAmount)
    }
  }, [
    selectedPair,
    form,
    calculateMaxTradableAmount,
    isPairInverted,
    calculateRate,
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

  // Create handleAssetChange handler from our utility
  const handleAssetChange = useMemo(
    () =>
      createAssetChangeHandler(
        form,
        tradablePairs,
        updateMinMaxAmounts,
        calculateMaxTradableAmount,
        setFromAmount,
        setSelectedPair,
        setMaxFromAmount
      ),
    [
      form,
      tradablePairs,
      updateMinMaxAmounts,
      calculateMaxTradableAmount,
      setFromAmount,
      setSelectedPair,
      setMaxFromAmount,
    ]
  )

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
      displayAsset
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

          // Subscribe to the selected trading pair if available
          if (selectedPair) {
            const pairString = `${selectedPair.base_asset}/${selectedPair.quote_asset}`
            logger.info(`Subscribing to initial trading pair: ${pairString}`)
            webSocketService.subscribeToPair(pairString)
          }

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

  // Subscribe to selected pair feed when it changes
  useEffect(() => {
    if (!selectedPair || !wsConnected) return

    const pair = `${selectedPair.base_asset}/${selectedPair.quote_asset}`
    logger.info(`Subscribing to trading pair: ${pair}`)

    // Use the service to subscribe
    webSocketService.subscribeToPair(pair)

    // Dispatch Redux action to track subscription
    dispatch(subscribeToPair(pair))

    // Return cleanup function
    return () => {
      // Store the pair value in a closure to ensure we unsubscribe from the correct pair
      // This ensures we unsubscribe from the previous pair when selectedPair changes
      logger.info(
        `Unsubscribing from pair ${pair} due to pair change or unmount`
      )
      webSocketService.unsubscribeFromPair(pair)
      dispatch(unsubscribeFromPair(pair))
    }
  }, [selectedPair, wsConnected, dispatch])

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
      const success = webSocketService.reconnect()

      if (success) {
        // Refresh pairs after reconnection
        await fetchAndSetPairs()
        toast.success('Successfully reconnected to market maker')
      } else {
        toast.error('Failed to reconnect. Please try again.')
      }
    } catch (error) {
      logger.error('Error during manual WebSocket reconnection:', error)
      toast.error('Failed to reconnect to market maker')
    } finally {
      // Refresh amounts after reconnection attempt
      await refreshAmounts()
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
      setIsPriceLoading(false);
      const fromAmount = form.getValues().from;
      
      if (fromAmount) {
        setIsToAmountLoading(true);
        requestQuote();
      }
    } else {
      // No selected pair, clear "to" amount
      form.setValue('to', '');
      setIsPriceLoading(true);
    }
  }, [form, selectedPair, requestQuote]);

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
  }, [form.getValues().fromAsset, form.getValues().toAsset, wsConnected, requestQuote]);

  // Update effect to request quote when from amount changes
  useEffect(() => {
    const fromAmount = form.watch('from');
    const fromAsset = form.watch('fromAsset');
    const toAsset = form.watch('toAsset');
    
    // Only request quote if we have all required values
    if (fromAmount && fromAsset && toAsset && wsConnected) {
      // Even if no selected pair, we should still try to get a quote
      // Wrap state updates in requestAnimationFrame to avoid infinite update loops
      window.requestAnimationFrame(() => {
        setIsToAmountLoading(true);
        setIsQuoteLoading(true);
        
        // Short timeout to ensure state updates are applied before requesting quote
        setTimeout(() => {
          requestQuote();
        }, 0);
      });
    } else if (!fromAmount || fromAmount === '0') {
      // Clear "to" amount when "from" is empty
      form.setValue('to', '');
      
      // Wrap state updates in requestAnimationFrame to avoid race conditions
      window.requestAnimationFrame(() => {
        setIsToAmountLoading(false);
        setIsQuoteLoading(false);
      });
    }
  }, [form, wsConnected, requestQuote]);

  // Render a fees section
  const renderFeesSection = () => {
    if (!fees.totalFee) return null;
    
    return (
      <div className="mt-2 p-3 bg-slate-800/80 rounded-lg">
        <h3 className="text-slate-300 text-sm font-medium mb-1">Fees</h3>
        <div className="grid grid-cols-2 gap-1 text-xs">
          <span className="text-slate-400">Base fee:</span>
          <span className="text-slate-200 text-right">{formatAmount(fees.baseFee, 'BTC')} {displayAsset('BTC')}</span>
          
          <span className="text-slate-400">Variable fee:</span>
          <span className="text-slate-200 text-right">{formatAmount(fees.variableFee, 'BTC')} {displayAsset('BTC')}</span>
          
          <span className="text-slate-400">Total fee:</span>
          <span className="text-slate-200 text-right">{formatAmount(fees.totalFee, 'BTC')} {displayAsset('BTC')}</span>
          
          <span className="text-slate-400">Fee rate:</span>
          <span className="text-slate-200 text-right">{(fees.feeRate * 100).toFixed(2)}%</span>
        </div>
      </div>
    );
  };

  // Render the swap form UI
  const renderSwapForm = () => (
    <div className="swap-form-container w-full max-w-2xl">
      <div className="bg-gradient-to-b from-slate-900/95 to-slate-800/95 backdrop-blur-md rounded-2xl border border-slate-700/70 shadow-xl w-full">
        <div className="border-b border-slate-700/70 px-4 pt-4 pb-3">
          <div className="flex justify-between items-center">
            <MakerSelector hasNoPairs={false} onMakerChange={refreshAmounts} />
            
            {/* WebSocket connection status indicator */}
            <div className="flex items-center space-x-2 ml-2">
              <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className={`text-xs ${wsConnected ? 'text-green-400' : 'text-red-400'}`}>
                {wsConnected ? 'Connected' : 'Disconnected'}
              </span>
              {!wsConnected && (
                <button
                  className="text-xs px-2 py-1 rounded bg-blue-600/30 text-blue-400 hover:bg-blue-600/50 ml-2"
                  onClick={handleReconnectToMaker}
                  type="button"
                >
                  Reconnect
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-4">
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
                  getAssetPrecisionWrapper,
                  parseAssetAmount,
                  setDebouncedFromAmount
                )
                const quoteHandler = createAmountChangeQuoteHandler(requestQuote)
                baseHandler(e)
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

            <div className="flex justify-center my-0">
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
              isLoading={false}
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
                  bitcoinUnit={bitcoinUnit}
                  formatAmount={formatAmount}
                  fromAsset={form.getValues().fromAsset}
                  getAssetPrecision={getAssetPrecisionWrapper}
                  isPriceLoading={false}
                  price={currentPrice}
                  selectedPair={selectedPair}
                  toAsset={form.getValues().toAsset}
                />
                
                {/* Quote freshness indicator */}
                {quoteResponse && (
                  <div className={`mt-2 p-2 rounded-lg flex items-center justify-between ${hasValidQuote ? 'bg-green-900/20 border border-green-800/30' : 'bg-yellow-900/20 border border-yellow-800/30'}`}>
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full mr-2 ${hasValidQuote ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div>
                      <span className={`text-xs ${hasValidQuote ? 'text-green-400' : 'text-yellow-400'}`}>
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

            {renderFeesSection()}

            {errorMessage && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mt-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-red-500 font-medium">
                      Trade Error
                    </span>
                    <button
                      className="p-1 hover:bg-red-500/10 rounded transition-colors"
                      onClick={() => copyToClipboard(errorMessage)}
                      title="Copy error message"
                    >
                      <Copy className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                  <span className="text-red-400/90 text-sm leading-relaxed">
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
              isPriceLoading={false}
              isSwapInProgress={isSwapInProgress}
              isToAmountLoading={false}
              wsConnected={wsConnected}
            />
          </form>
        </div>
      </div>
    </div>
  )

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
        setErrorMessage,
        setIsSwapInProgress
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
    ]
  )

  // Check for available channels
  const hasChannels = useMemo(() => channels.length > 0, [channels])

  // Check for tradable pairs
  const hasTradablePairs = useMemo(
    () => tradablePairs.length > 0,
    [tradablePairs]
  )

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

      // Include all assets that are part of a valid trading pair
      // This ensures all tradable assets appear in the dropdown
      const tradableAssets = allPairAssets
        // Remove the currently selected asset from options
        .filter((asset) => asset !== excludeAsset)
        .map((asset) => ({
          // Don't disable any assets in the dropdown
          disabled: false,

          ticker: displayAsset(asset),

          value: asset,
        }))

      logger.debug(
        `Tradable asset options (excluding ${excludeAsset}): ${JSON.stringify(tradableAssets)}`
      )

      return tradableAssets
    },
    [tradablePairs, getAvailableAssets, displayAsset]
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
      logger.debug('Application window gained focus')

      // If the page was in the background and the WebSocket is disconnected, reconnect
      if (wasInBackground && !wsConnected && makerConnectionUrl) {
        logger.info(
          'Application was in background and WebSocket is disconnected, attempting to reconnect'
        )
        wasInBackground = false

        try {
          // Attempt to reconnect
          const success = webSocketService.reconnect()
          if (success) {
            logger.info('Successfully reconnected WebSocket after page focus')
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

  // Add the reconnect handler and pass it to ExchangeRateSection
  const handleReconnectToMaker = async () => {
    try {
      // Try to reconnect the WebSocket
      const reconnected = Boolean(await retryConnection())

    } catch (error) {
      console.error('Error reconnecting to market maker:', error)
      toast.error('Failed to reconnect to price feed. Please try again.')
    }
  }

  // Submit handler
  const onSubmit: SubmitHandler<Fields> = async () => {
    const fromAmount = parseAssetAmount(
      form.getValues().from,
      form.getValues().fromAsset
    )
    const toAmount = parseAssetAmount(
      form.getValues().to,
      form.getValues().toAsset
    )

    // Check for zero amounts
    if (fromAmount === 0 || toAmount === 0) {
      setErrorMessage('Cannot swap zero amounts. Please enter a valid amount.')
      return
    }

    if (
      !hasChannels ||
      !hasTradablePairs ||
      isSwapInProgress ||
      !wsConnected ||
      errorMessage
    ) {
      return
    }
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

  return (
    <div className="container mx-auto">
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
        <div className="w-full flex justify-center">{renderSwapForm()}</div>
      )}

      <SwapConfirmation
        bitcoinUnit={bitcoinUnit}
        exchangeRate={calculateRate()}
        formatAmount={formatAmount}
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
