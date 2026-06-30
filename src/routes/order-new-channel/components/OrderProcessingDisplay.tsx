import { CheckCircle } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { Card } from '../../../components/ui'
import { formatBitcoinAmount } from '../../../helpers/number'
import { useAssetIcon } from '../../../helpers/utils'
import { Lsps1CreateOrderResponse } from '../../../slices/makerApi/makerApi.slice'
import { NiaAsset } from '../../../slices/nodeApi/nodeApi.slice'
import rgbIcon from '../../../assets/rgb-logo.svg'

interface OrderProcessingDisplayProps {
  paymentMethod: 'lightning' | 'onchain'
  currentPayment: any
  bitcoinUnit: string
  orderId?: string
  assetInfo?: NiaAsset | null
  orderPayload?: any
  order?: Lsps1CreateOrderResponse | null
}

export const OrderProcessingDisplay: React.FC<OrderProcessingDisplayProps> = ({
  paymentMethod,
  currentPayment,
  bitcoinUnit,
  orderId,
  assetInfo,
  orderPayload,
  order,
}) => {
  const { t } = useTranslation()
  const [assetIcon] = useAssetIcon(assetInfo?.ticker ?? '', rgbIcon)
  const hasAsset = !!(orderPayload?.asset_id || order?.asset_id)

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[70vh] text-white p-4">
      <div className="w-full max-w-lg text-center">
        {/* Animated loading ring (wallet-unlock style) with current icon */}
        <div className="relative mx-auto mb-6 w-28 h-28">
          <div className="absolute inset-0 rounded-full border-2 border-primary/15" />
          <div className="absolute inset-2 rounded-full border border-dashed border-primary/20 animate-[spin_12s_linear_infinite]" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary/50 border-r-primary/30 animate-[spin_4s_linear_infinite]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/10">
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-2xl font-bold mb-3">
          {t('orderChannel.step3.paymentReceived')}
        </h3>

        {/* Subtitle */}
        <p className="text-content-secondary mb-6">
          {t('orderChannel.step3.waitingMakerConfirmation')}
        </p>

        {/* Order details */}
        <Card className="divide-y divide-border-default/40 text-left">
          {/* Amount */}
          <div className="flex items-center justify-between py-3 first:pt-0">
            <span className="text-sm text-content-secondary">
              {t('orderChannel.step3.amount')}
            </span>
            <span className="text-sm text-white font-medium">
              {formatBitcoinAmount(
                currentPayment?.order_total_sat || 0,
                bitcoinUnit
              )}{' '}
              {bitcoinUnit === 'SAT' ? 'SATS' : bitcoinUnit}
            </span>
          </div>

          {/* Method */}
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-content-secondary">
              {t('orderChannel.step3.method')}
            </span>
            <span className="text-sm text-white font-medium">
              {paymentMethod === 'lightning'
                ? t('orderChannel.step3.lightning')
                : t('orderChannel.step3.onchain')}
            </span>
          </div>

          {/* Type */}
          {hasAsset && (
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-content-secondary">Type</span>
              <span className="text-sm text-white font-medium">
                {t('orderChannel.step3.rgbAssetChannel')}
              </span>
            </div>
          )}

          {/* Asset */}
          {hasAsset && assetInfo && (
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-content-secondary">Asset</span>
              <span className="flex items-center gap-1.5 text-sm text-white font-medium">
                <img
                  alt={assetInfo.ticker}
                  className="w-4 h-4 rounded-full"
                  src={assetIcon}
                />
                {assetInfo.name} ({assetInfo.ticker})
              </span>
            </div>
          )}

          {/* Order ID */}
          {orderId && (
            <div className="flex items-start justify-between gap-4 py-3 last:pb-0">
              <span className="text-sm text-content-secondary shrink-0">
                Order ID
              </span>
              <span className="text-xs text-white font-mono break-all text-right">
                {orderId}
              </span>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
