import React from 'react'

import { BTC_ASSET_ID } from '../../../../../constants'
import { NiaAsset } from '../../../../../slices/nodeApi/nodeApi.slice'
import { BalanceDisplayProps } from '../types'

// BalanceDisplay component for showing asset balances
const BalanceDisplay: React.FC<BalanceDisplayProps> = ({
  addressType,
  assetId,
  assetBalance,
  bitcoinUnit,
  assets,
}) => {
  if (addressType === 'bitcoin') {
    return (
      <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-slate-400 text-sm">Available BTC Balance:</span>
          <span className="text-white font-medium">
            {/* assetBalance is now always in satoshis, so convert for display */}
            {bitcoinUnit === 'SAT'
              ? assetBalance.toLocaleString()
              : (assetBalance / 100000000).toFixed(8)}{' '}
            {bitcoinUnit}
          </span>
        </div>
      </div>
    )
  }

  if (
    assetId &&
    assetId !== BTC_ASSET_ID &&
    addressType !== 'lightning' &&
    addressType !== 'rgb'
  ) {
    const assetInfo = assets.data?.nia.find(
      (a: NiaAsset) => a.asset_id === assetId
    )
    if (assetInfo) {
      const ticker = assetInfo.ticker
      const precision = assetInfo.precision || 8
      // Convert raw balance to display units
      const displayBalance = assetBalance / Math.pow(10, precision)

      return (
        <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-slate-400 text-sm">
              Available {ticker} Balance:
            </span>
            <span className="text-white font-medium">
              {displayBalance.toFixed(precision)} {ticker}
            </span>
          </div>
        </div>
      )
    }
  }

  return null
}

export { BalanceDisplay }
