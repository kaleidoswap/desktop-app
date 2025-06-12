import { toast } from 'react-toastify'

import { TradingPair } from '../../../slices/makerApi/makerApi.slice'
import { Channel, NiaAsset } from '../../../slices/nodeApi/nodeApi.slice'
import { logger } from '../../../utils/logger'

import { ASSET_CONFLICT_MESSAGES } from './errorMessages'

const MSATS_PER_SAT = 1000

/**
 * Gets the minimum order size for a specific asset from the trading pair
 */
const getMinOrderSizeForAsset = async (
  asset: string,
  selectedPair: TradingPair | null
): Promise<number> => {
  if (!selectedPair) {
    return 0
  }

  // Determine if this asset is the base or quote asset in the pair
  const isBaseAsset = selectedPair.base_asset === asset
  let minOrderSize: number

  if (isBaseAsset) {
    minOrderSize = selectedPair.min_base_order_size
  } else {
    minOrderSize = selectedPair.min_quote_order_size
  }

  // Convert from millisats to sats for BTC
  if (asset === 'BTC') {
    minOrderSize = minOrderSize / MSATS_PER_SAT
  }

  return minOrderSize
}

/**
 * Finds a complementary asset for a given asset from available trading pairs
 */
export const findComplementaryAsset = (
  asset: string,
  tradablePairs: TradingPair[]
): string | undefined => {
  const pair = tradablePairs.find(
    (pair) =>
      (pair.base_asset === asset && pair.quote_asset !== asset) ||
      (pair.quote_asset === asset && pair.base_asset !== asset)
  )

  if (!pair) return undefined

  return pair.base_asset === asset ? pair.quote_asset : pair.base_asset
}

/**
 * Creates a handler for asset change events
 */
export const createAssetChangeHandler = (
  form: any,
  tradablePairs: TradingPair[],
  updateMinMaxAmounts: () => Promise<void>,
  calculateMaxTradableAmount: (
    asset: string,
    isFrom: boolean
  ) => Promise<number>,
  setFromAmount: (
    amount: number,
    fromAsset: string,
    percentageOfMax?: number
  ) => Promise<string | null>,
  setSelectedPair: (pair: TradingPair | null) => void,
  setMaxFromAmount: (amount: number) => void
) => {
  return async (field: 'fromAsset' | 'toAsset', newValue: string) => {
    const currentFromAsset = form.getValues().fromAsset
    const currentToAsset = form.getValues().toAsset

    logger.info(
      `Changing ${field} from ${field === 'fromAsset' ? currentFromAsset : currentToAsset} to ${newValue}`
    )

    // Store the previous values in case we need to revert
    const previousFromAsset = currentFromAsset
    const previousToAsset = currentToAsset

    // Pre-check if a valid pair exists for this asset combination
    let newFromAsset = field === 'fromAsset' ? newValue : currentFromAsset
    let newToAsset = field === 'toAsset' ? newValue : currentToAsset

    // If they would be the same, find a complementary asset
    if (newFromAsset === newToAsset) {
      const complementaryAssets = tradablePairs
        .filter(
          (pair) =>
            pair.base_asset === newValue || pair.quote_asset === newValue
        )
        .flatMap((pair) => [pair.base_asset, pair.quote_asset])
        .filter((asset) => asset !== newValue)
        .filter((asset, index, self) => self.indexOf(asset) === index)

      if (complementaryAssets.length === 0) {
        logger.error(`No complementary assets found for ${newValue}`)
        toast.error(`Cannot select ${newValue} for both assets`)
        return
      }

      if (field === 'fromAsset') {
        newToAsset = complementaryAssets[0]
      } else {
        newFromAsset = complementaryAssets[0]
      }
    }

    // Check if a valid pair exists for this combination
    const validPair = tradablePairs.find(
      (pair) =>
        (pair.base_asset === newFromAsset && pair.quote_asset === newToAsset) ||
        (pair.base_asset === newToAsset && pair.quote_asset === newFromAsset)
    )

    if (!validPair) {
      logger.error(`No valid pair exists for ${newFromAsset}/${newToAsset}`)

      // Try to find any valid pair including the new asset
      const pairsWithNewAsset = tradablePairs.filter(
        (pair) => pair.base_asset === newValue || pair.quote_asset === newValue
      )

      if (pairsWithNewAsset.length === 0) {
        toast.error(`No trading pairs available for ${newValue}`)
        return
      }

      // Take the first available pair with the new asset
      const alternativePair = pairsWithNewAsset[0]

      // Use this pair instead
      if (field === 'fromAsset') {
        newFromAsset = newValue
        newToAsset =
          newValue === alternativePair.base_asset
            ? alternativePair.quote_asset
            : alternativePair.base_asset
      } else {
        newToAsset = newValue
        newFromAsset =
          newValue === alternativePair.base_asset
            ? alternativePair.quote_asset
            : alternativePair.base_asset
      }

      logger.debug(`Using alternative pair: ${newFromAsset}/${newToAsset}`)
    }

    // Now actually update the form values
    form.setValue('fromAsset', newFromAsset)
    form.setValue('toAsset', newToAsset)

    // Find and set the selected pair
    const selectedPair = tradablePairs.find(
      (pair) =>
        (pair.base_asset === newFromAsset && pair.quote_asset === newToAsset) ||
        (pair.base_asset === newToAsset && pair.quote_asset === newFromAsset)
    )

    if (selectedPair) {
      setSelectedPair(selectedPair)
      logger.debug(
        `Selected pair: ${selectedPair.base_asset}/${selectedPair.quote_asset}`
      )
    } else {
      // This should not happen since we already checked above
      logger.error(
        `Unexpected: No matching tradable pair found for ${newFromAsset}/${newToAsset}`
      )
      toast.error('Failed to find a valid trading pair')
      form.setValue('fromAsset', previousFromAsset)
      form.setValue('toAsset', previousToAsset)
      return
    }

    // After changing assets, update min/max amounts
    await updateMinMaxAmounts()

    // Calculate max amount for the currently selected fromAsset
    const updatedFromAsset = form.getValues().fromAsset
    const newMaxAmount = await calculateMaxTradableAmount(
      updatedFromAsset,
      true
    )
    setMaxFromAmount(newMaxAmount)

    // When changing the from asset, always set the amount to minimum tradable for better UX
    if (field === 'fromAsset') {
      // Get the minimum order size for the new asset from the selected pair
      const minOrderSize = await getMinOrderSizeForAsset(
        updatedFromAsset,
        selectedPair
      )
      await setFromAmount(minOrderSize, updatedFromAsset, 25) // Set to 25% size indicator
      logger.info(
        `Changed from asset to ${updatedFromAsset}, set amount to minimum: ${minOrderSize}`
      )
    } else {
      // For toAsset changes, preserve the current from amount
      const currentFromAmount = form.getValues().from
      if (
        !currentFromAmount ||
        parseFloat(currentFromAmount.replace(/,/g, '')) === 0
      ) {
        // Set to 100% of max using helper function only if no amount is set
        await setFromAmount(newMaxAmount, updatedFromAsset, 100)
      }
      // Otherwise keep the existing amount as is
    }
  }
}

/**
 * Creates a handler for swapping assets
 */
export const createSwapAssetsHandler = (
  selectedPair: TradingPair | null,
  form: any,
  calculateMaxTradableAmount: (
    asset: string,
    isFrom: boolean
  ) => Promise<number>,
  updateMinMaxAmounts: () => Promise<void>,
  setMaxFromAmount: (amount: number) => void
) => {
  return async () => {
    if (selectedPair) {
      const fromAsset = form.getValues().fromAsset
      const toAsset = form.getValues().toAsset
      const fromAmount = form.getValues().from
      const toAmount = form.getValues().to

      logger.info(
        `Swapping assets: from=${fromAsset}(${fromAmount}) to=${toAsset}(${toAmount})`
      )

      // Swap the assets in the form
      form.setValue('fromAsset', toAsset)
      form.setValue('toAsset', fromAsset)

      // Set the new from amount to the old to amount
      form.setValue('from', toAmount)

      // Don't set the to amount - it will be recalculated by the updateToAmount effect
      // Clear it temporarily to avoid showing stale data
      // form.setValue('to', '')

      // Recalculate max amount for the new fromAsset (which was previously toAsset)
      const newMaxAmount = await calculateMaxTradableAmount(toAsset, true)
      setMaxFromAmount(newMaxAmount)

      // Make sure to call updateMinMaxAmounts after all the changes
      // This will ensure state is properly updated for future operations
      await updateMinMaxAmounts()
    }
  }
}

/**
 * Gets available asset IDs from channels that can be used for trading
 * Returns asset IDs for proper filtering against trading pairs
 */
export const getAvailableAssets = (
  channels: Channel[],
  _assets: NiaAsset[] // Prefixed with underscore to indicate intentionally unused
): string[] => {
  // Get unique asset IDs from channels that are ready and usable
  const channelAssetIds = new Set<string>(
    channels
      .filter(
        (c) =>
          c.ready && (c.outbound_balance_msat > 0 || c.inbound_balance_msat > 0)
      )
      .map((c) => c.asset_id)
      .filter((assetId): assetId is string => assetId !== null) // Filter out null values
  )

  // Always include BTC
  channelAssetIds.add('BTC')

  return Array.from(channelAssetIds)
}

/**
 * Gets available asset tickers from channels that can be used for trading
 * This is separate from getAvailableAssets which now returns asset IDs
 */
export const getAvailableAssetTickers = (
  channels: Channel[],
  assets: NiaAsset[]
): string[] => {
  // Get unique assets from channels that are ready and usable
  const channelAssets = new Set<string>(
    channels
      .filter(
        (c) =>
          c.ready && (c.outbound_balance_msat > 0 || c.inbound_balance_msat > 0)
      )
      .map((c) => assets.find((a) => a.asset_id === c.asset_id)?.ticker)
      .filter((ticker): ticker is string => ticker !== undefined) // Type guard to filter out undefined values
  )

  // Always include BTC
  channelAssets.add('BTC')

  return Array.from(channelAssets)
}

/**
 * Validates trading pairs to ensure no ticker conflicts exist
 * A ticker conflict occurs when the same ticker (e.g., "USDT") has different asset IDs
 * This indicates different assets with the same ticker, which should not be traded
 *
 * @param pairs Array of trading pairs to validate
 * @returns Object containing valid pairs and any conflicts found
 */
export const validateTradingPairs = (
  pairs: TradingPair[]
): {
  validPairs: TradingPair[]
  conflicts: Array<{
    ticker: string
    assetIds: string[]
    conflictingPairs: TradingPair[]
  }>
} => {
  // Track ticker to asset ID mappings
  const tickerToAssetIds = new Map<string, Set<string>>()
  const assetIdToPairs = new Map<string, TradingPair[]>()

  // Build mappings
  pairs.forEach((pair) => {
    // Track base asset
    if (!tickerToAssetIds.has(pair.base_asset)) {
      tickerToAssetIds.set(pair.base_asset, new Set())
    }
    tickerToAssetIds.get(pair.base_asset)!.add(pair.base_asset_id)

    // Track quote asset
    if (!tickerToAssetIds.has(pair.quote_asset)) {
      tickerToAssetIds.set(pair.quote_asset, new Set())
    }
    tickerToAssetIds.get(pair.quote_asset)!.add(pair.quote_asset_id)

    // Track pairs by asset ID
    const baseKey = `${pair.base_asset}:${pair.base_asset_id}`
    const quoteKey = `${pair.quote_asset}:${pair.quote_asset_id}`

    if (!assetIdToPairs.has(baseKey)) {
      assetIdToPairs.set(baseKey, [])
    }
    if (!assetIdToPairs.has(quoteKey)) {
      assetIdToPairs.set(quoteKey, [])
    }

    assetIdToPairs.get(baseKey)!.push(pair)
    assetIdToPairs.get(quoteKey)!.push(pair)
  })

  // Find conflicts (tickers with multiple asset IDs)
  const conflicts: Array<{
    ticker: string
    assetIds: string[]
    conflictingPairs: TradingPair[]
  }> = []

  const conflictingTickers = new Set<string>()

  tickerToAssetIds.forEach((assetIds, ticker) => {
    if (assetIds.size > 1) {
      const conflictingPairs = pairs.filter(
        (pair) =>
          (pair.base_asset === ticker && assetIds.has(pair.base_asset_id)) ||
          (pair.quote_asset === ticker && assetIds.has(pair.quote_asset_id))
      )

      conflicts.push({
        assetIds: Array.from(assetIds),
        conflictingPairs,
        ticker,
      })

      conflictingTickers.add(ticker)

      logger.warn(
        `Ticker conflict detected for "${ticker}": multiple asset IDs found [${Array.from(assetIds).join(', ')}]. ` +
          `${conflictingPairs.length} pairs affected.`
      )
    }
  })

  // Filter out pairs that involve conflicting tickers
  const validPairs = pairs.filter(
    (pair) =>
      !conflictingTickers.has(pair.base_asset) &&
      !conflictingTickers.has(pair.quote_asset)
  )

  if (conflicts.length > 0) {
    logger.warn(
      `Found ${conflicts.length} ticker conflicts. Filtered out ${pairs.length - validPairs.length} pairs. ` +
        `${validPairs.length} valid pairs remaining.`
    )
  }

  return { conflicts, validPairs }
}

/**
 * Logs detailed information about asset conflicts for debugging
 * @param conflicts Array of conflicts detected
 */
export const logAssetConflicts = (
  conflicts: Array<{
    ticker: string
    assetIds: string[]
    conflictingPairs: TradingPair[]
  }>
): void => {
  if (conflicts.length === 0) {
    logger.info('No asset conflicts detected')
    return
  }

  logger.warn(`=== ASSET CONFLICT REPORT ===`)
  logger.warn(`Found ${conflicts.length} ticker conflicts:`)

  conflicts.forEach((conflict, index) => {
    logger.warn(`\n${index + 1}. Ticker: "${conflict.ticker}"`)
    logger.warn(`   Asset IDs: ${conflict.assetIds.join(', ')}`)
    logger.warn(`   Affected pairs: ${conflict.conflictingPairs.length}`)

    conflict.conflictingPairs.forEach((pair, pairIndex) => {
      logger.warn(
        `     ${pairIndex + 1}. ${pair.base_asset}(${pair.base_asset_id}) / ${pair.quote_asset}(${pair.quote_asset_id})`
      )
    })
  })

  logger.warn(`=== END CONFLICT REPORT ===\n`)
}

/**
 * Checks if a trading pair is safe to trade (no asset conflicts)
 * @param pair The trading pair to check
 * @param allPairs All available trading pairs to check against
 * @returns True if the pair is safe to trade, false if there are conflicts
 */
export const isPairSafeToTrade = (
  pair: TradingPair,
  allPairs: TradingPair[]
): boolean => {
  const { validPairs } = validateTradingPairs(allPairs)
  return validPairs.some(
    (validPair) =>
      validPair.base_asset === pair.base_asset &&
      validPair.base_asset_id === pair.base_asset_id &&
      validPair.quote_asset === pair.quote_asset &&
      validPair.quote_asset_id === pair.quote_asset_id
  )
}

/**
 * Gets all asset conflicts for a specific ticker
 * @param ticker The ticker to check for conflicts
 * @param allPairs All available trading pairs
 * @returns Array of asset IDs that conflict for this ticker, or empty array if no conflicts
 */
export const getAssetConflictsForTicker = (
  ticker: string,
  allPairs: TradingPair[]
): string[] => {
  const { conflicts } = validateTradingPairs(allPairs)
  const conflict = conflicts.find((c) => c.ticker === ticker)
  return conflict ? conflict.assetIds : []
}

/**
 * Creates a handler for fetching and setting trading pairs
 */
export const createFetchAndSetPairsHandler = (
  getPairs: () => Promise<{ data?: { pairs: TradingPair[] } }>,
  dispatch: (action: any) => void,
  getAvailableAssetsParam: () => string[],
  form: any,
  formatAmount: (amount: number, asset: string) => string,
  setTradingPairs: (pairs: TradingPair[]) => void,
  setTradablePairs: (pairs: TradingPair[]) => void,
  setSelectedPair: (pair: TradingPair | null) => void,
  setIsPairsLoading?: (loading: boolean) => void
) => {
  // Add a static flag to prevent multiple simultaneous calls
  let isCurrentlyFetching = false

  return async () => {
    // Prevent multiple simultaneous calls
    if (isCurrentlyFetching) {
      logger.debug(
        'fetchAndSetPairs already in progress, skipping duplicate call'
      )
      return
    }

    isCurrentlyFetching = true

    if (setIsPairsLoading) {
      setIsPairsLoading(true)
    }
    try {
      const getPairsResponse = await getPairs()
      if (
        !('data' in getPairsResponse) ||
        !getPairsResponse.data ||
        !getPairsResponse.data.pairs
      ) {
        throw new Error(
          'Failed to fetch trading pairs data or data is malformed'
        )
      }

      const allPairs: TradingPair[] = getPairsResponse.data.pairs

      // Validate pairs to ensure no ticker conflicts (same ticker with different asset IDs)
      const { validPairs: validatedPairs, conflicts } =
        validateTradingPairs(allPairs)

      // Log conflicts if any were found
      if (conflicts.length > 0) {
        const totalExcludedPairs = allPairs.length - validatedPairs.length

        // Log detailed conflict information for debugging
        logAssetConflicts(conflicts)

        // Show individual conflict warnings
        conflicts.forEach((conflict) => {
          toast.warn(
            ASSET_CONFLICT_MESSAGES.TICKER_CONFLICT(
              conflict.ticker,
              conflict.assetIds,
              conflict.conflictingPairs.length
            )
          )
        })

        // Show summary if multiple conflicts
        if (conflicts.length > 1) {
          toast.info(
            ASSET_CONFLICT_MESSAGES.MULTIPLE_CONFLICTS(
              conflicts.length,
              totalExcludedPairs,
              validatedPairs.length
            )
          )
        }
      }

      dispatch(setTradingPairs(validatedPairs))

      const availableAssetIds = getAvailableAssetsParam()

      // Debug logging to understand the mismatch
      logger.debug('Available asset IDs from channels:', availableAssetIds)
      logger.debug(
        'Trading pairs asset IDs:',
        validatedPairs.map((p) => ({
          base: p.base_asset_id,
          baseTicker: p.base_asset,
          quote: p.quote_asset_id,
          quoteTicker: p.quote_asset,
        }))
      )

      // Enhanced filtering: Check both exact asset ID matches and ticker-based matching
      const filteredPairs = validatedPairs.filter((pair: TradingPair) => {
        // Direct asset ID matching (primary method)
        const baseIdMatch = availableAssetIds.includes(pair.base_asset_id)
        const quoteIdMatch = availableAssetIds.includes(pair.quote_asset_id)

        if (baseIdMatch && quoteIdMatch) {
          return true
        }

        // Secondary matching: If direct ID match fails, try ticker-based matching for BTC
        // This handles cases where channels have 'BTC' as asset_id but pairs might have different base_asset_id
        const hasBaseBTC =
          pair.base_asset === 'BTC' && availableAssetIds.includes('BTC')
        const hasQuoteBTC =
          pair.quote_asset === 'BTC' && availableAssetIds.includes('BTC')

        // For BTC pairs, allow if one asset is BTC and we have BTC in channels
        if (
          (hasBaseBTC && quoteIdMatch) ||
          (baseIdMatch && hasQuoteBTC) ||
          (hasBaseBTC && hasQuoteBTC)
        ) {
          return true
        }

        return false
      })

      logger.debug(
        `Filtered ${validatedPairs.length} pairs down to ${filteredPairs.length} tradable pairs`
      )

      setTradablePairs(filteredPairs)

      if (filteredPairs.length === 0) {
        if (validatedPairs.length === 0) {
          logger.warn(
            'No valid trading pairs available after filtering asset conflicts'
          )
          // toast.error(ASSET_CONFLICT_MESSAGES.NO_VALID_PAIRS)
        } else {
          logger.warn(
            'No tradable pairs found for available assets - asset IDs do not match between channels and maker pairs'
          )
          logger.debug('Available asset IDs:', availableAssetIds)
          logger.debug(
            'Pair asset IDs needed:',
            validatedPairs
              .map((p) => [p.base_asset_id, p.quote_asset_id])
              .flat()
          )
          // toast.error(ASSET_CONFLICT_MESSAGES.NO_TRADABLE_PAIRS)
        }
        return
      }

      // Try to find a pair with BTC first
      const btcPair = filteredPairs.find(
        (pair: TradingPair) =>
          pair.base_asset === 'BTC' || pair.quote_asset === 'BTC'
      )

      const selectedPair = btcPair || filteredPairs[0]
      setSelectedPair(selectedPair)

      // Set initial assets based on the selected pair
      const fromAsset = selectedPair.base_asset
      const toAsset = selectedPair.quote_asset

      form.setValue('fromAsset', fromAsset)
      form.setValue('toAsset', toAsset)

      // Set initial amount to minimum order size
      let defaultMinAmount = selectedPair.min_base_order_size
      // Convert from millisats to sats for BTC
      if (fromAsset === 'BTC') {
        defaultMinAmount = defaultMinAmount / MSATS_PER_SAT
      }
      const formattedAmount = formatAmount(defaultMinAmount, fromAsset)
      form.setValue('from', formattedAmount)

      logger.info(
        `Pairs fetched successfully. Selected pair: ${fromAsset}/${toAsset}`
      )
    } catch (error) {
      logger.error('Error fetching pairs:', error)
      toast.error('Failed to fetch trading pairs')
    } finally {
      isCurrentlyFetching = false
      if (setIsPairsLoading) {
        setIsPairsLoading(false)
      }
    }
  }
}

/**
 * Maps an asset ID to its ticker symbol
 * This is crucial for UI display, as users should see tickers not asset IDs
 *
 * @param assetId The full asset ID (e.g., "rgb:Dg!Mttpk-NSLmSJF-iDdTsdE-mnAg5$V-KqWib!Y-kkWETBE")
 * @param assets List of assets to map from
 * @returns The ticker symbol (e.g., "USDT") or a shortened version of the asset ID if not found
 */
export const mapAssetIdToTicker = (
  assetId: string,
  assets: NiaAsset[]
): string => {
  // Return BTC as is
  if (assetId === 'BTC') {
    return assetId
  }

  // Try to find the asset in the assets list
  const asset = assets.find((a) => a.asset_id === assetId)
  if (asset && asset.ticker) {
    return asset.ticker
  }

  // If we can't find a mapping, create a shortened display version
  if (assetId.startsWith('rgb:')) {
    // Display just "RGB" and first 6 chars to keep it manageable
    return `RGB:${assetId.slice(4, 10)}...`
  }

  // For any other asset type, shorten display
  return `${assetId.slice(0, 10)}...`
}

/**
 * Maps a ticker symbol to its full asset ID
 * This is needed for WebSocket communication where we must use asset IDs
 *
 * @param ticker The ticker symbol (e.g., "USDT")
 * @param assets List of assets to map from
 * @returns The full asset ID or the original ticker if not found
 */
export const mapTickerToAssetId = (
  ticker: string,
  assets: NiaAsset[]
): string => {
  // Return BTC as is
  if (ticker === 'BTC' || ticker === 'SAT') {
    return 'BTC'
  }

  // Try to find the asset in the assets list
  const asset = assets.find((a) => a.ticker === ticker)
  if (asset && asset.asset_id) {
    return asset.asset_id
  }

  // If we can't find a mapping, return the ticker (may be an asset ID already)
  return ticker
}

/**
 * Checks if a string is likely an asset ID rather than a ticker
 * Used to determine if we need to convert for display
 *
 * @param assetString The string to check
 * @returns True if it appears to be an asset ID
 */
export const isAssetId = (assetString: string): boolean => {
  // RGB assets start with "rgb:"
  if (assetString.startsWith('rgb:')) {
    return true
  }

  // Asset IDs tend to be long
  if (assetString.length > 20) {
    return true
  }

  return false
}
