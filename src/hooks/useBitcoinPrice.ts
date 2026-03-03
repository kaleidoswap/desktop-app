import { useAppSelector } from '../app/store/hooks'
import {
  CURRENCY_SYMBOLS,
  FiatCurrency,
  useGetBitcoinPriceQuery,
} from '../slices/priceApi/priceApi.slice'
import { SATOSHIS_PER_BTC } from '../helpers/number'

interface UseBitcoinPriceResult {
  btcPrice: number | undefined
  fiatCurrency: FiatCurrency
  isLoading: boolean
  formatFiat: (satoshis: number) => string | null
}

export const useBitcoinPrice = (): UseBitcoinPriceResult => {
  const fiatCurrency = useAppSelector((s) => s.settings.fiatCurrency)
  const { data, isLoading } = useGetBitcoinPriceQuery(fiatCurrency, {
    pollingInterval: 5 * 60 * 1000, // refresh every 5 minutes
  })

  const btcPrice = data?.bitcoin?.[fiatCurrency]

  const formatFiat = (satoshis: number): string | null => {
    if (btcPrice === undefined) return null
    const fiatValue = (satoshis / SATOSHIS_PER_BTC) * btcPrice

    const symbol = CURRENCY_SYMBOLS[fiatCurrency]
    const isJpy = fiatCurrency === 'jpy'

    return `${symbol}${new Intl.NumberFormat('en-US', {
      maximumFractionDigits: isJpy ? 0 : 2,
      minimumFractionDigits: isJpy ? 0 : 2,
    }).format(fiatValue)}`
  }

  return { btcPrice, fiatCurrency, isLoading, formatFiat }
}
