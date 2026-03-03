import { Clock, CheckCircle, ArrowRight } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { formatBitcoinAmount } from '../../../helpers/number'
import { Lsps1CreateOrderResponse } from '../../../slices/makerApi/makerApi.slice'
import { NiaAsset } from '../../../slices/nodeApi/nodeApi.slice'

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
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-8 text-center">
        {/* Animated Icon */}
        <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6 relative">
          <div className="absolute inset-0 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin"></div>
          <CheckCircle className="w-10 h-10 text-blue-500" />
        </div>

        {/* Title */}
        <h3 className="text-2xl font-bold text-white mb-4">
          {t('orderChannel.step3.paymentReceived')}
        </h3>

        {/* Subtitle */}
        <p className="text-content-secondary mb-6">
          {t('orderChannel.step3.processingSubtitle')}
        </p>

        {/* Payment Details */}
        <div className="bg-surface-overlay/50 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-center gap-4 text-sm mb-3">
            <span className="text-content-secondary">
              {t('orderChannel.step3.amount')}:
            </span>
            <span className="text-white font-medium">
              {formatBitcoinAmount(
                currentPayment?.order_total_sat || 0,
                bitcoinUnit
              )}{' '}
              {bitcoinUnit}
            </span>
            <span className="text-content-secondary">•</span>
            <span className="text-content-secondary">
              {t('orderChannel.step3.method')}:
            </span>
            <span className="text-white font-medium flex items-center gap-1">
              {paymentMethod === 'lightning' ? (
                <>⚡ {t('orderChannel.step3.lightning')}</>
              ) : (
                <>₿ {t('orderChannel.step3.onchain')}</>
              )}
            </span>
          </div>

          {orderId && (
            <div className="text-xs text-content-tertiary font-mono">
              {t('orderChannel.step3.order')}: {orderId.slice(0, 8)}...
              {orderId.slice(-8)}
            </div>
          )}
        </div>

        {/* Asset Information */}
        {(orderPayload?.asset_id || order?.asset_id) && (
          <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
              <span className="text-purple-300 text-sm font-medium">
                {t('orderChannel.step3.rgbAssetChannel')}
              </span>
            </div>
            <div className="text-center text-sm text-content-secondary">
              {assetInfo ? (
                <>
                  {assetInfo.name} ({assetInfo.ticker})
                </>
              ) : (
                <span className="font-mono text-xs">
                  {(order?.asset_id || orderPayload?.asset_id)
                    ?.split('-')
                    .slice(0, 2)
                    .join('-')}
                  ...
                </span>
              )}
            </div>
            {(order?.lsp_asset_amount ||
              orderPayload?.lsp_asset_amount ||
              order?.client_asset_amount ||
              orderPayload?.client_asset_amount) && (
              <div className="mt-3 pt-3 border-t border-purple-500/20 text-xs space-y-1">
                {(order?.lsp_asset_amount ||
                  orderPayload?.lsp_asset_amount) && (
                  <div className="flex justify-center gap-2">
                    <span className="text-content-tertiary">
                      {t('orderChannel.step3.lspAmount')}:
                    </span>
                    <span className="text-purple-300">
                      {(
                        order?.lsp_asset_amount ||
                        orderPayload?.lsp_asset_amount
                      )?.toLocaleString()}
                      {assetInfo ? ` ${assetInfo.ticker}` : ''}
                    </span>
                  </div>
                )}
                {(order?.client_asset_amount ||
                  orderPayload?.client_asset_amount) && (
                  <div className="flex justify-center gap-2">
                    <span className="text-content-tertiary">
                      {t('orderChannel.step3.yourAmount')}:
                    </span>
                    <span className="text-blue-300">
                      {(
                        order?.client_asset_amount ||
                        orderPayload?.client_asset_amount
                      )?.toLocaleString()}
                      {assetInfo ? ` ${assetInfo.ticker}` : ''}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Progress Steps */}
        <div className="mb-6">
          <div className="flex items-center justify-center space-x-4 mb-4">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="ml-2 text-sm text-green-400">
                {t('orderChannel.step3.paymentReceivedStatus')}
              </span>
            </div>
            <ArrowRight className="text-content-tertiary" size={16} />
            <div className="flex items-center">
              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="ml-2 text-sm text-blue-400">
                {t('orderChannel.step3.processingOrder')}
              </span>
            </div>
            <ArrowRight className="text-content-tertiary" size={16} />
            <div className="flex items-center">
              <div className="w-3 h-3 bg-surface-elevated rounded-full"></div>
              <span className="ml-2 text-sm text-content-tertiary">
                {t('orderChannel.step3.channelReady')}
              </span>
            </div>
          </div>
        </div>

        {/* Status Message */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
          <div className="flex items-center justify-center gap-2 text-sm text-blue-400">
            <Clock className="w-4 h-4" />
            <span>{t('orderChannel.step3.waitingMakerConfirmation')}</span>
          </div>
        </div>

        {/* Pulsing dots for visual feedback */}
        <div className="flex justify-center items-center mt-6 space-x-1">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <div
            className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"
            style={{ animationDelay: '0.2s' }}
          ></div>
          <div
            className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"
            style={{ animationDelay: '0.4s' }}
          ></div>
        </div>
      </div>
    </div>
  )
}
