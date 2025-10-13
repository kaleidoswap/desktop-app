import { Channel } from '../../../slices/nodeApi/nodeApi.slice'
import { logger } from '../../../utils/logger'

/**
 * Checks if a single channel is considered tradable
 * @param channel The channel to check
 * @returns boolean indicating if the channel is tradable
 */
export const isTradableChannel = (channel: Channel): boolean => {
  return (
    // Channel must be ready
    channel.ready &&
    // Channel must have either outbound or inbound balance
    (channel.outbound_balance_msat > 0 || channel.inbound_balance_msat > 0) &&
    channel.next_outbound_htlc_minimum_msat > 0 &&
    // Channel must have a valid asset_id
    channel.asset_id !== null &&
    channel.asset_id !== undefined
  )
}

/**
 * Checks if there are any tradable channels in the provided array
 * @param channels Array of channels to check
 * @returns boolean indicating if there's at least one tradable channel
 */
export const hasTradableChannels = (channels: Channel[]): boolean => {
  return channels.some((channel) => isTradableChannel(channel))
}

/**
 * Filters the provided array to only include tradable channels
 * @param channels Array of channels to filter
 * @returns Array containing only tradable channels
 */
export const getTradableChannels = (channels: Channel[]): Channel[] => {
  return channels.filter((channel) => isTradableChannel(channel))
}

/**
 * Counts the number of tradable channels in the provided array
 * @param channels Array of channels to count from
 * @returns Number of tradable channels
 */
export const countTradableChannels = (channels: Channel[]): number => {
  return getTradableChannels(channels).length
}

/**
 * Channel diagnostics interface for reporting channel status
 */
export interface ChannelDiagnostics {
  totalChannels: number
  tradableChannels: number
  readyChannels: number
  channelsWithBalance: number
  channelsWithAssetId: number
}

/**
 * Gets diagnostic information about the tradable channels
 * @param channels Array of channels to analyze
 * @returns Object with diagnostic counts
 */
export const getTradableChannelDiagnostics = (
  channels: Channel[]
): ChannelDiagnostics => {
  return {
    channelsWithAssetId: channels.filter(
      (c) => c.asset_id !== null && c.asset_id !== undefined
    ).length,
    channelsWithBalance: channels.filter(
      (c) => c.outbound_balance_msat > 0 || c.inbound_balance_msat > 0
    ).length,
    readyChannels: channels.filter((c) => c.ready).length,
    totalChannels: channels.length,
    tradableChannels: countTradableChannels(channels),
  }
}

// Cache for last logged diagnostics to prevent excessive logging
let lastLoggedDiagnostics: string | null = null
let lastLogTime = 0
const LOG_THROTTLE_MS = 5000 // Only log every 5 seconds

/**
 * Logs diagnostic information about the tradable channels
 * @param channels Array of channels to analyze and log
 * @param force Force logging even if throttled
 */
export const logChannelDiagnostics = (
  channels: Channel[],
  force = false
): void => {
  const diagnostics = getTradableChannelDiagnostics(channels)
  const diagnosticsString = JSON.stringify(diagnostics)
  const now = Date.now()

  // Skip logging if same diagnostics were logged recently (unless forced)
  if (
    !force &&
    lastLoggedDiagnostics === diagnosticsString &&
    now - lastLogTime < LOG_THROTTLE_MS
  ) {
    return
  }

  lastLoggedDiagnostics = diagnosticsString
  lastLogTime = now

  logger.info(`Channel diagnostics:`)
  logger.info(`- Total channels: ${diagnostics.totalChannels}`)
  logger.info(`- Tradable channels: ${diagnostics.tradableChannels}`)
  logger.info(`- Ready channels: ${diagnostics.readyChannels}`)
  logger.info(`- Channels with balance: ${diagnostics.channelsWithBalance}`)
  logger.info(`- Channels with asset ID: ${diagnostics.channelsWithAssetId}`)
}

/**
 * Formats a channel diagnostics message for error reporting
 * @param channels Array of channels to analyze
 * @returns String message explaining the state of channels
 */
export const getChannelDiagnosticsMessage = (channels: Channel[]): string => {
  const diagnostics = getTradableChannelDiagnostics(channels)

  if (diagnostics.totalChannels === 0) {
    return 'No channels found. Please open channels to trade.'
  }

  if (diagnostics.tradableChannels === 0) {
    if (diagnostics.readyChannels === 0) {
      return 'Channels are not ready yet. Please wait for channels to become active.'
    }

    if (diagnostics.channelsWithBalance === 0) {
      return 'Channels have no balance. Please add funds to your channels.'
    }

    if (diagnostics.channelsWithAssetId === 0) {
      return 'No asset channels found. Please open channels with supported assets.'
    }

    return 'No tradable channels found. Channels may be missing balance or proper setup.'
  }

  return `${diagnostics.tradableChannels} tradable channels available.`
}

/**
 * Checks if a specific asset has at least one ready channel
 * @param channels Array of channels to check
 * @param assetId The asset ID to check for
 * @returns boolean indicating if there's at least one ready channel for the asset
 */
export const hasReadyChannelForAsset = (
  channels: Channel[],
  assetId: string | null
): boolean => {
  if (!assetId) return false

  const assetChannels = channels.filter((c) => c.asset_id === assetId)
  return assetChannels.some((c) => c.ready)
}

/**
 * Checks if a specific asset has channels but all are unconfirmed (not ready)
 * @param channels Array of channels to check
 * @param assetId The asset ID to check for
 * @returns boolean indicating if there are channels but none are ready
 */
export const hasOnlyUnconfirmedChannelsForAsset = (
  channels: Channel[],
  assetId: string | null
): boolean => {
  if (!assetId) return false

  const assetChannels = channels.filter((c) => c.asset_id === assetId)

  // If no channels exist for this asset, return false
  if (assetChannels.length === 0) return false

  // Return true if all channels are unconfirmed (not ready)
  return assetChannels.every((c) => !c.ready)
}

/**
 * Gets the count of ready channels for a specific asset
 * @param channels Array of channels to check
 * @param assetId The asset ID to check for
 * @returns Number of ready channels for the asset
 */
export const getReadyChannelCountForAsset = (
  channels: Channel[],
  assetId: string | null
): number => {
  if (!assetId) return 0

  const assetChannels = channels.filter((c) => c.asset_id === assetId)
  return assetChannels.filter((c) => c.ready).length
}

/**
 * Gets all channels for a specific asset
 * @param channels Array of channels to filter
 * @param assetId The asset ID to filter by
 * @returns Array of channels for the specific asset
 */
export const getChannelsForAsset = (
  channels: Channel[],
  assetId: string | null
): Channel[] => {
  if (!assetId) return []
  return channels.filter((c) => c.asset_id === assetId)
}

/**
 * Interface for asset channel status
 */
export interface AssetChannelStatus {
  assetId: string
  hasChannels: boolean
  hasReadyChannels: boolean
  readyChannelCount: number
  totalChannelCount: number
  allUnconfirmed: boolean
}

/**
 * Gets detailed channel status for a specific asset
 * @param channels Array of channels to analyze
 * @param assetId The asset ID to check
 * @returns Detailed status object for the asset's channels
 */
export const getAssetChannelStatus = (
  channels: Channel[],
  assetId: string | null
): AssetChannelStatus => {
  if (!assetId) {
    return {
      allUnconfirmed: false,
      assetId: assetId || '',
      hasChannels: false,
      hasReadyChannels: false,
      readyChannelCount: 0,
      totalChannelCount: 0,
    }
  }

  const assetChannels = getChannelsForAsset(channels, assetId)
  const readyChannels = assetChannels.filter((c) => c.ready)

  return {
    allUnconfirmed: assetChannels.length > 0 && readyChannels.length === 0,
    assetId,
    hasChannels: assetChannels.length > 0,
    hasReadyChannels: readyChannels.length > 0,
    readyChannelCount: readyChannels.length,
    totalChannelCount: assetChannels.length,
  }
}
