import Decimal from 'decimal.js'

import { getNumberLocale } from './number'

export type AssetInfo = {
  label: string
  precision: number
  fullId: string
}

export const formatBitcoinAmount = (
  amount: string | number,
  bitcoinUnit: string
): string => {
  const locale = getNumberLocale()
  const amountDecimal = new Decimal(amount)
  if (bitcoinUnit === 'SAT') {
    return amountDecimal.toNumber().toLocaleString(locale, {
      maximumFractionDigits: 0,
      useGrouping: true,
    })
  } else {
    return amountDecimal.div(100000000).toNumber().toLocaleString(locale, {
      maximumFractionDigits: 8,
      minimumFractionDigits: 8,
      useGrouping: true,
    })
  }
}

export const formatAssetAmount = (
  amount: string | number,
  isBtc: boolean,
  bitcoinUnit: string,
  precision: number
): string => {
  if (isBtc) {
    return formatBitcoinAmount(amount, bitcoinUnit)
  }
  const locale = getNumberLocale()
  const amountDecimal = new Decimal(amount)
  return amountDecimal
    .div(Math.pow(10, precision))
    .toNumber()
    .toLocaleString(locale, {
      maximumFractionDigits: precision,
      minimumFractionDigits: 0,
      useGrouping: true,
    })
}

export const resolveAssetInfo = (
  assetId: string | null | undefined,
  listAssetsData: any
): AssetInfo | null => {
  if (!assetId) return null

  const nia = listAssetsData?.nia ?? []
  const uda = listAssetsData?.uda ?? []
  const cfa = listAssetsData?.cfa ?? []

  const niaMatch = nia.find((a: any) => a.asset_id === assetId)
  if (niaMatch)
    return {
      fullId: assetId,
      label: niaMatch.ticker ?? niaMatch.name ?? assetId,
      precision: niaMatch.precision ?? 0,
    }

  const udaMatch = uda.find((a: any) => a.asset_id === assetId)
  if (udaMatch)
    return {
      fullId: assetId,
      label: udaMatch.ticker ?? udaMatch.name ?? assetId,
      precision: udaMatch.precision ?? 0,
    }

  const cfaMatch = cfa.find((a: any) => a.asset_id === assetId)
  if (cfaMatch)
    return {
      fullId: assetId,
      label: cfaMatch.name ?? assetId,
      precision: cfaMatch.precision ?? 0,
    }

  return {
    fullId: assetId,
    label: assetId,
    precision: 0,
  }
}
