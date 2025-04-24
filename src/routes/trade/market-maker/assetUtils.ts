import { toast } from 'react-toastify'

import { TradingPair } from '../../../slices/makerApi/makerApi.slice'
import { Channel, NiaAsset } from '../../../slices/nodeApi/nodeApi.slice'
import { logger } from '../../../utils/logger'

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

    // Set to 100% of max using helper function
    await setFromAmount(newMaxAmount, updatedFromAsset, 100)
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
 * Gets available assets from channels
 */
export const getAvailableAssets = (
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
 * Creates a handler for fetching and setting trading pairs
 */
export const createFetchAndSetPairsHandler = (
  getPairs: any,
  dispatch: any,
  getAvailableAssets: () => string[],
  form: any,
  formatAmount: (amount: number, asset: string) => string,
  setTradingPairs: (pairs: any[]) => void,
  setTradablePairs: (pairs: TradingPair[]) => void,
  setSelectedPair: (pair: TradingPair | null) => void
) => {
  return async () => {
    try {
      const getPairsResponse = await getPairs()
      if (!('data' in getPairsResponse) || !getPairsResponse.data) {
        throw new Error('Failed to fetch trading pairs data')
      }

      dispatch(setTradingPairs(getPairsResponse.data.pairs))
      const availableAssets = getAvailableAssets()

      // Filter pairs where at least one asset is in user's channels or is BTC
      const filteredPairs = getPairsResponse.data.pairs.filter(
        (pair: TradingPair) =>
          availableAssets.includes(pair.base_asset) ||
          availableAssets.includes(pair.quote_asset)
      )

      setTradablePairs(filteredPairs)

      if (filteredPairs.length === 0) {
        logger.warn('No tradable pairs found for available assets')
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
      const defaultMinAmount = selectedPair.min_order_size
      const formattedAmount = formatAmount(defaultMinAmount, fromAsset)
      form.setValue('from', formattedAmount)

      logger.info(
        `Pairs fetched successfully. Selected pair: ${fromAsset}/${toAsset}`
      )
    } catch (error) {
      logger.error('Error fetching pairs:', error)
      toast.error('Failed to fetch trading pairs')
    }
  }
}
