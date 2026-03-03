import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export const SUPPORTED_CURRENCIES = ['usd', 'eur', 'gbp', 'jpy', 'chf'] as const
export type FiatCurrency = (typeof SUPPORTED_CURRENCIES)[number]

export const CURRENCY_SYMBOLS: Record<FiatCurrency, string> = {
  usd: '$',
  eur: '€',
  gbp: '£',
  jpy: '¥',
  chf: 'CHF ',
}

export const CURRENCY_LABELS: Record<FiatCurrency, string> = {
  usd: 'USD',
  eur: 'EUR',
  gbp: 'GBP',
  jpy: 'JPY',
  chf: 'CHF',
}

interface CoinGeckoPriceResponse {
  bitcoin: Partial<Record<FiatCurrency, number>>
}

export const priceApi = createApi({
  reducerPath: 'priceApi',
  baseQuery: fetchBaseQuery({
    baseUrl: 'https://api.coingecko.com/api/v3',
  }),
  endpoints: (builder) => ({
    getBitcoinPrice: builder.query<CoinGeckoPriceResponse, FiatCurrency>({
      query: (currency) =>
        `/simple/price?ids=bitcoin&vs_currencies=${currency}`,
      keepUnusedDataFor: 300, // cache for 5 minutes
    }),
  }),
})

export const { useGetBitcoinPriceQuery } = priceApi
