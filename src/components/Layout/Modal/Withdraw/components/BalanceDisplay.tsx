import React from 'react'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()

  if (addressType === 'bitcoin') {
    const amount =
      bitcoinUnit === 'SAT'
        ? assetBalance.toLocaleString()
        : (assetBalance / 100000000).toFixed(8)
    return (
      <p className="text-content-secondary text-sm mb-4">
        {t('withdrawModal.balance.btcLabel')}{' '}
        <span className="text-white font-medium">
          {amount} {bitcoinUnit === 'SAT' ? 'SATS' : bitcoinUnit}
        </span>
      </p>
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
      const displayBalance = assetBalance / Math.pow(10, precision)

      return (
        <p className="text-content-secondary text-sm mb-4">
          {t('withdrawModal.balance.assetLabel', { ticker })}{' '}
          <span className="text-white font-medium">
            {displayBalance.toFixed(precision)} {ticker}
          </span>
        </p>
      )
    }
  }

  return null
}

export { BalanceDisplay }
