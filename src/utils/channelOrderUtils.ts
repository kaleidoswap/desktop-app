import { FetchBaseQueryError } from '@reduxjs/toolkit/query'

/**
 * Shared utilities for channel ordering
 * Used by both order-new-channel and market-maker pages
 */

export interface AssetInfo {
  name: string
  ticker: string
  asset_id: string
  precision: number
  min_initial_client_amount: number
  max_initial_client_amount: number
  min_initial_lsp_amount: number
  max_initial_lsp_amount: number
  min_channel_amount: number
  max_channel_amount: number
}

export interface LspOptions {
  min_required_channel_confirmations: number
  min_funding_confirms_within_blocks: number
  min_onchain_payment_confirmations: number
  supports_zero_channel_reserve: boolean
  min_onchain_payment_size_sat: number
  max_channel_expiry_blocks: number
  min_initial_client_balance_sat: number
  max_initial_client_balance_sat: number
  min_initial_lsp_balance_sat: number
  max_initial_lsp_balance_sat: number
  min_channel_balance_sat: number
  max_channel_balance_sat: number
}

export interface ChannelOrderPayload {
  announce_channel: boolean
  channel_expiry_blocks: number
  client_balance_sat: number
  client_pubkey: string
  funding_confirms_within_blocks: number
  lsp_balance_sat: number
  refund_onchain_address: string
  required_channel_confirmations: number
  asset_id?: string
  lsp_asset_amount?: number
  client_asset_amount?: number
  rfq_id?: string
}

export interface CreateChannelOrderParams {
  capacitySat: number
  clientBalanceSat: number
  channelExpireBlocks: number
  assetId?: string
  lspAssetAmount?: number // LSP's asset amount (inbound liquidity for receiving)
  clientAssetAmount?: number // Client's asset amount (for buying assets in market maker)
  clientPubKey: string
  addressRefund: string
  lspOptions?: LspOptions
  rfqId?: string
}

/**
 * Helper function to extract meaningful error messages
 */
export const extractErrorMessage = (error: any): string => {
  // Handle string errors
  if (typeof error === 'string') {
    return error
  }

  // Handle object errors with nested structures
  if (typeof error === 'object' && error !== null) {
    // Common error message fields
    const possibleFields = ['error', 'message', 'detail', 'description', 'msg']

    for (const field of possibleFields) {
      if (error[field] && typeof error[field] === 'string') {
        return error[field]
      }
    }

    // Check for nested error objects
    if (error.error && typeof error.error === 'object') {
      return extractErrorMessage(error.error)
    }

    // If it's an array, try to extract from the first element
    if (Array.isArray(error) && error.length > 0) {
      return extractErrorMessage(error[0])
    }

    // Last resort: stringify the object but limit length
    const stringified = JSON.stringify(error)
    return stringified.length > 200
      ? stringified.substring(0, 200) + '...'
      : stringified
  }

  return 'Unknown error format'
}

/**
 * Builds a channel order payload from parameters
 */
export const buildChannelOrderPayload = (
  params: CreateChannelOrderParams
): ChannelOrderPayload => {
  const {
    capacitySat,
    clientBalanceSat,
    channelExpireBlocks,
    assetId,
    lspAssetAmount,
    clientAssetAmount,
    clientPubKey,
    addressRefund,
    lspOptions,
    rfqId,
  } = params

  const payload: ChannelOrderPayload = {
    announce_channel: true,
    channel_expiry_blocks: channelExpireBlocks,
    client_balance_sat: clientBalanceSat,
    client_pubkey: clientPubKey,
    funding_confirms_within_blocks:
      lspOptions?.min_funding_confirms_within_blocks || 1,
    lsp_balance_sat: capacitySat - clientBalanceSat,
    refund_onchain_address: addressRefund,
    required_channel_confirmations:
      lspOptions?.min_required_channel_confirmations || 3,
  }

  if (assetId) {
    payload.asset_id = assetId

    // LSP's portion (inbound liquidity for receiving/buying)
    if (lspAssetAmount && lspAssetAmount > 0) {
      payload.lsp_asset_amount = lspAssetAmount
    }

    // Client asset amount (for buying assets in market maker)
    if (clientAssetAmount && clientAssetAmount > 0) {
      payload.client_asset_amount = clientAssetAmount
    }

    // Add rfq_id if provided (required when buying assets)
    if (rfqId) {
      payload.rfq_id = rfqId
    }
  }

  return payload
}

/**
 * Formats error message from RTK Query error
 */
export const formatRtkQueryError = (error: FetchBaseQueryError): string => {
  let errorMessage = 'An error occurred while creating the channel order'

  if ('status' in error) {
    const fetchError = error as FetchBaseQueryError

    // Handle different status codes and error structures
    if (fetchError.status === 'FETCH_ERROR') {
      errorMessage =
        'Network error: Unable to connect to the LSP server. Please check your internet connection and LSP server status.'
    } else if (fetchError.status === 'TIMEOUT_ERROR') {
      errorMessage =
        'Request timeout: The LSP server took too long to respond. Please try again.'
    } else if (fetchError.status === 'PARSING_ERROR') {
      errorMessage =
        'Response parsing error: Invalid data received from the LSP server.'
    } else if (typeof fetchError.status === 'number') {
      // HTTP status errors with improved error extraction
      const extractedError = fetchError.data
        ? extractErrorMessage(fetchError.data)
        : null

      if (fetchError.status >= 400 && fetchError.status < 500) {
        // Client errors (4xx)
        const baseMessage = `Request error (${fetchError.status})`
        if (extractedError && extractedError !== 'Unknown error format') {
          errorMessage = `${baseMessage}: ${extractedError}`
        } else {
          // Provide specific messages for common 4xx errors
          switch (fetchError.status) {
            case 400:
              errorMessage = `${baseMessage}: Invalid request parameters. Please check your input and try again.`
              break
            case 401:
              errorMessage = `${baseMessage}: Authentication required. Please check your LSP credentials.`
              break
            case 403:
              errorMessage = `${baseMessage}: Access forbidden. You may not have permission to create orders.`
              break
            case 404:
              errorMessage = `${baseMessage}: LSP endpoint not found. Please check the LSP server configuration.`
              break
            case 422:
              errorMessage = `${baseMessage}: Invalid order data. Please verify your channel parameters.`
              break
            case 429:
              errorMessage = `${baseMessage}: Too many requests. Please wait a moment and try again.`
              break
            default:
              errorMessage = `${baseMessage}: Client request error. Please check your input.`
          }
        }
      } else if (fetchError.status >= 500) {
        // Server errors (5xx)
        errorMessage = `Server error (${fetchError.status}): The LSP server is experiencing issues. Please try again later.`
        if (extractedError && extractedError !== 'Unknown error format') {
          errorMessage += ` Details: ${extractedError}`
        }
      } else {
        errorMessage = `HTTP error (${fetchError.status}): An unexpected error occurred`
        if (extractedError && extractedError !== 'Unknown error format') {
          errorMessage += `: ${extractedError}`
        }
      }
    } else {
      // Non-numeric status (FETCH_ERROR, etc.)
      errorMessage = `Network error: ${fetchError.status || 'Unknown network issue'}`
    }
  }

  return errorMessage
}

/**
 * Validates channel parameters against LSP options
 */
export const validateChannelParams = (
  params: CreateChannelOrderParams,
  assets: AssetInfo[],
  effectiveMinCapacity: number,
  effectiveMaxCapacity: number
): { isValid: boolean; error?: string } => {
  const {
    capacitySat,
    clientBalanceSat,
    channelExpireBlocks,
    assetId,
    lspAssetAmount,
    lspOptions,
  } = params

  // Validate channel capacity
  if (capacitySat < effectiveMinCapacity) {
    return {
      error: `Channel capacity must be at least ${effectiveMinCapacity.toLocaleString()} sats`,
      isValid: false,
    }
  }
  if (capacitySat > effectiveMaxCapacity) {
    return {
      error: `Channel capacity cannot exceed ${effectiveMaxCapacity.toLocaleString()} sats`,
      isValid: false,
    }
  }

  // Validate client balance
  if (
    lspOptions &&
    clientBalanceSat < lspOptions.min_initial_client_balance_sat
  ) {
    return {
      error: `Your channel liquidity must be at least ${lspOptions.min_initial_client_balance_sat} sats`,
      isValid: false,
    }
  }
  if (
    lspOptions &&
    clientBalanceSat > lspOptions.max_initial_client_balance_sat
  ) {
    return {
      error: `Your channel liquidity cannot exceed ${lspOptions.max_initial_client_balance_sat} sats`,
      isValid: false,
    }
  }
  if (clientBalanceSat > capacitySat) {
    return {
      error: 'Client balance cannot be greater than capacity',
      isValid: false,
    }
  }

  // Validate channel expiry
  if (
    lspOptions &&
    channelExpireBlocks > lspOptions.max_channel_expiry_blocks
  ) {
    return {
      error: `Channel expiry cannot exceed ${lspOptions.max_channel_expiry_blocks} blocks`,
      isValid: false,
    }
  }

  // Validate asset if selected
  if (assetId) {
    const selectedAsset = assets.find((asset) => asset.asset_id === assetId)

    // Check if asset is supported by LSP
    if (!selectedAsset) {
      return {
        error: `Asset ${assetId} is not supported by this LSP. Please select a different asset or check the LSP's supported assets list.`,
        isValid: false,
      }
    }

    // Validate LSP asset amount if provided
    if (lspAssetAmount && lspAssetAmount > 0) {
      if (lspAssetAmount < selectedAsset.min_channel_amount) {
        return {
          error: `Asset amount must be at least ${selectedAsset.min_channel_amount / Math.pow(10, selectedAsset.precision)} ${selectedAsset.ticker}`,
          isValid: false,
        }
      }
      if (lspAssetAmount > selectedAsset.max_channel_amount) {
        return {
          error: `Asset amount cannot exceed ${selectedAsset.max_channel_amount / Math.pow(10, selectedAsset.precision)} ${selectedAsset.ticker}`,
          isValid: false,
        }
      }
    }
  }

  return { isValid: true }
}
