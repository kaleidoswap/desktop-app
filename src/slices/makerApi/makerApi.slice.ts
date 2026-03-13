import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import { getKaleidoClient } from '../../api/client'
import { RootState } from '../../app/store'
import {
  ConfirmSwapRequest,
  TradingPair as PairResponse,
  GetQuoteResponse,
  GetQuoteRequest,
  GetLspInfoResponse as GetInfoResponseModel,
  GetLspOrderResponse as OrderResponse,
  CreateLspOrderRequest as CreateOrderRequest,
  GetLspOrderRequest as GetOrderRequest,
  RetryDeliveryResponse,
  RetryDeliveryRequest,
  GetSwapStatusResponse as SwapStatusResponse,
  GetSwapStatusRequest as SwapStatusRequest,
  EstimateLspFeesResponse as ChannelFees,
  InitiateSwapRequest,
  InitiateSwapResponse,
} from 'kaleidoswap-sdk'

// Types matching new OpenAPI schema

export interface TradingLimits {
  layer: string
  min_amount: number
  max_amount: number
  is_active?: boolean
}

export interface Media {
  file_path: string
  digest: string
  mime: string
}

export interface SwapRoute {
  from_layer: string
  to_layer: string
}

export interface TradableAsset {
  ticker: string
  name: string
  precision: number
  protocol_ids: Record<string, string> // e.g., { "RGB": "rgb:xxx", "BTC": "BTC" }
  media?: Media | null
  issued_supply?: number | null
  timestamp?: number | null
  endpoints: TradingLimits[]
}

export interface TradingPair {
  id: string
  base: TradableAsset
  quote: TradableAsset
  price?: string | null
  routes: SwapRoute[]
  is_active: boolean

  // Backward-compatible computed fields (populated by normalizePair helper)
  base_asset?: string // base.ticker
  quote_asset?: string // quote.ticker
  base_asset_id?: string // getAssetId(base)
  quote_asset_id?: string // getAssetId(quote)
  min_base_order_size?: number // base.endpoints[0].min_amount
  min_quote_order_size?: number // quote.endpoints[0].min_amount
  max_base_order_size?: number // base.endpoints[0].max_amount
  max_quote_order_size?: number // quote.endpoints[0].max_amount
}

// Helper functions to get asset IDs from TradableAsset
export const getAssetId = (asset: TradableAsset, protocol = 'RGB'): string => {
  if (!asset.protocol_ids) {
    return asset.ticker
  }
  return (
    asset.protocol_ids[protocol] || asset.protocol_ids['BTC'] || asset.ticker
  )
}

export const getRgbAssetId = (asset: TradableAsset): string | undefined => {
  return asset.protocol_ids?.['RGB']
}

// Convenience accessors for TradingPair
export const getBaseAssetId = (pair: TradingPair): string =>
  getAssetId(pair.base)
export const getQuoteAssetId = (pair: TradingPair): string =>
  getAssetId(pair.quote)
export const getBaseAsset = (pair: TradingPair): string => pair.base.ticker
export const getQuoteAsset = (pair: TradingPair): string => pair.quote.ticker

// Backward-compatible access functions (for use in code that used old field names)
export const pairBaseAsset = (pair: TradingPair): string => pair.base.ticker
export const pairQuoteAsset = (pair: TradingPair): string => pair.quote.ticker
export const pairBaseAssetId = (pair: TradingPair): string =>
  getAssetId(pair.base)
export const pairQuoteAssetId = (pair: TradingPair): string =>
  getAssetId(pair.quote)

// Get min order size from endpoints
export const getMinBaseOrderSize = (pair: TradingPair): number => {
  const endpoint = pair.base.endpoints?.[0]
  return endpoint?.min_amount || 0
}

export const getMinQuoteOrderSize = (pair: TradingPair): number => {
  const endpoint = pair.quote.endpoints?.[0]
  return endpoint?.min_amount || 0
}

export const getMaxBaseOrderSize = (pair: TradingPair): number => {
  const endpoint = pair.base.endpoints?.[0]
  return endpoint?.max_amount || Number.MAX_SAFE_INTEGER
}

export const getMaxQuoteOrderSize = (pair: TradingPair): number => {
  const endpoint = pair.quote.endpoints?.[0]
  return endpoint?.max_amount || Number.MAX_SAFE_INTEGER
}

/**
 * Normalize pair data from API by populating backward-compatible fields.
 * Call this on pairs returned from the API to ensure old field names work.
 */
export const normalizePair = (pair: TradingPair): TradingPair => {
  return {
    ...pair,
    base_asset: pair.base?.ticker,
    quote_asset: pair.quote?.ticker,
    base_asset_id: pair.base ? getAssetId(pair.base) : undefined,
    quote_asset_id: pair.quote ? getAssetId(pair.quote) : undefined,
    min_base_order_size: pair.base?.endpoints?.[0]?.min_amount || 0,
    min_quote_order_size: pair.quote?.endpoints?.[0]?.min_amount || 0,
    max_base_order_size:
      pair.base?.endpoints?.[0]?.max_amount || Number.MAX_SAFE_INTEGER,
    max_quote_order_size:
      pair.quote?.endpoints?.[0]?.max_amount || Number.MAX_SAFE_INTEGER,
  }
}

/**
 * Normalize an array of pairs from API response.
 */
export const normalizePairs = (pairs: TradingPair[]): TradingPair[] => {
  return pairs.map(normalizePair)
}
export type Lsps1CreateOrderRequest = CreateOrderRequest
export type Lsps1CreateOrderResponse = OrderResponse
export type QuoteRequest = GetQuoteRequest
export type QuoteResponse = GetQuoteResponse
export type Lsps1GetInfoResponse = GetInfoResponseModel
export type Lsps1GetOrderResponse = OrderResponse
export type Lsps1GetOrderRequest = GetOrderRequest
export type InitSwapResponse = InitiateSwapResponse
export type InitSwapRequest = InitiateSwapRequest
export type ExecSwapRequest = ConfirmSwapRequest
export type StatusResponse = SwapStatusResponse
export type StatusRequest = SwapStatusRequest
export type GetPairsResponse = PairResponse
export type { ChannelFees }

export const makerApi = createApi({
  reducerPath: 'makerApi',
  baseQuery: fakeBaseQuery(),
  endpoints: (builder) => ({
    create_order: builder.query<
      Lsps1CreateOrderResponse,
      Lsps1CreateOrderRequest
    >({
      queryFn: async (args, api) => {
        try {
          const client = await getKaleidoClient(api.getState() as RootState)
          const res = await client.maker.createLspOrder(args)
          return { data: res }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          return { error: { status: 500, data: { error: msg } } }
        }
      },
    }),
    estimate_fees: builder.query<ChannelFees, Lsps1CreateOrderRequest>({
      queryFn: async (args, api) => {
        try {
          const client = await getKaleidoClient(api.getState() as RootState)
          const res = await client.maker.estimateLspFees(args)
          return { data: res }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          return { error: { status: 500, data: { error: msg } } }
        }
      },
    }),
    execSwap: builder.query<null, ExecSwapRequest>({
      queryFn: async (args, api) => {
        try {
          const client = await getKaleidoClient(api.getState() as RootState)
          await client.maker.executeSwap(args)
          return { data: null }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          return { error: { status: 500, data: { error: msg } } }
        }
      },
    }),
    getPairs: builder.query<GetPairsResponse, void>({
      queryFn: async (_args, api) => {
        try {
          const client = await getKaleidoClient(api.getState() as RootState)
          const res = await client.maker.listPairs()
          return { data: res as any }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          return { error: { status: 500, data: { error: msg } } }
        }
      },
    }),
    getQuote: builder.query<QuoteResponse, QuoteRequest>({
      queryFn: async (args, api) => {
        try {
          const client = await getKaleidoClient(api.getState() as RootState)
          const res = await client.maker.getQuote(args)
          return { data: res }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          return { error: { status: 500, data: { error: msg } } }
        }
      },
    }),
    get_info: builder.query<Lsps1GetInfoResponse, void>({
      queryFn: async (_args, api) => {
        try {
          const client = await getKaleidoClient(api.getState() as RootState)
          const res = await client.maker.getLspInfo()
          return { data: res }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          return { error: { status: 500, data: { error: msg } } }
        }
      },
    }),
    get_order: builder.query<Lsps1GetOrderResponse, Lsps1GetOrderRequest>({
      queryFn: async (args, api) => {
        try {
          const client = await getKaleidoClient(api.getState() as RootState)
          const res = await client.maker.getLspOrder(args)
          return { data: res }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          return { error: { status: 500, data: { error: msg } } }
        }
      },
    }),
    initSwap: builder.query<InitSwapResponse, InitSwapRequest>({
      queryFn: async (args, api) => {
        try {
          const client = await getKaleidoClient(api.getState() as RootState)
          const res = await client.maker.initSwap(args)
          return { data: res }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          return { error: { status: 500, data: { error: msg } } }
        }
      },
    }),
    retry_delivery: builder.query<RetryDeliveryResponse, RetryDeliveryRequest>({
      queryFn: async (args, api) => {
        try {
          const client = await getKaleidoClient(api.getState() as RootState)
          const res = await client.maker.retryAssetDelivery(args)
          return { data: res }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          return { error: { status: 500, data: { error: msg } } }
        }
      },
    }),
    status: builder.query<StatusResponse, StatusRequest>({
      queryFn: async (args, api) => {
        try {
          const client = await getKaleidoClient(api.getState() as RootState)
          const res = await client.maker.getAtomicSwapStatus(args)
          return { data: res }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          return { error: { status: 500, data: { error: msg } } }
        }
      },
    }),
  }),
})
