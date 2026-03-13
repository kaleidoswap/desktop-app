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
    <div className="mx-auto max-w-3xl">
      <div className="relative overflow-hidden rounded-[28px] border border-cyan-400/20 bg-surface-base/90 p-8 text-center shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
        <div className="pointer-events-none absolute -left-16 top-0 h-44 w-44 rounded-full bg-cyan-400/12 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl" />

        {/* Animated Icon */}
        <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-cyan-400/15">
          <div className="absolute inset-0 rounded-full border-4 border-cyan-400/25 border-t-cyan-300 animate-spin"></div>
          <CheckCircle className="h-10 w-10 text-cyan-300" />
        </div>

        {/* Title */}
        <h3 className="mb-4 text-2xl font-bold text-white">
          {t('orderChannel.step3.paymentReceived')}
        </h3>

        {/* Subtitle */}
        <p className="mb-6 text-content-secondary">
          {t('orderChannel.step3.processingSubtitle')}
        </p>

        {/* Payment Details */}
        <div className="mb-6 rounded-[22px] border border-border-subtle bg-surface-overlay/50 p-4">
          <div className="mb-3 flex items-center justify-center gap-4 text-sm">
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
          <div className="mb-6 rounded-[22px] border border-emerald-400/20 bg-emerald-400/8 p-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
              <span className="text-sm font-medium text-emerald-200">
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
                    <span className="text-emerald-300">
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
          <div className="mb-4 flex items-center justify-center space-x-4">
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
        <div className="rounded-[20px] border border-cyan-400/20 bg-cyan-400/10 p-4">
          <div className="flex items-center justify-center gap-2 text-sm text-cyan-200">
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
