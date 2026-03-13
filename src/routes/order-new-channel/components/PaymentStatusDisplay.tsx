import { Clock, RefreshCcw, ArrowLeft } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { formatBitcoinAmount } from '../../../helpers/number'
import { Lsps1CreateOrderResponse } from '../../../slices/makerApi/makerApi.slice'
import { NiaAsset } from '../../../slices/nodeApi/nodeApi.slice'

interface PaymentStatusDisplayProps {
  status: 'success' | 'error' | 'expired'
  paymentMethod: 'lightning' | 'onchain'
  currentPayment: any
  bitcoinUnit: string
  assetInfo?: NiaAsset | null
  order?: Lsps1CreateOrderResponse | null
  orderPayload?: any
  onRestart?: () => void
  onBack?: () => void
}

export const PaymentStatusDisplay: React.FC<PaymentStatusDisplayProps> = ({
  status,
  paymentMethod,
  currentPayment,
  bitcoinUnit,
  assetInfo,
  order,
  orderPayload,
  onRestart,
  onBack,
}) => {
  const { t } = useTranslation()
  if (status === 'success') {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="relative overflow-hidden rounded-[28px] border border-emerald-400/20 bg-surface-base/90 p-8 text-center shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
          <div className="pointer-events-none absolute -left-16 top-0 h-44 w-44 rounded-full bg-emerald-400/12 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-400/15">
            <svg
              className="h-10 w-10 text-emerald-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M5 13l4 4L19 7"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          </div>
          <h3 className="mb-4 text-2xl font-bold text-white">
            {t('orderChannel.step3.paymentSuccessful')}
          </h3>
          <p className="mb-6 text-content-secondary">
            {t('orderChannel.step3.channelOpening')}
          </p>
          <div className="mb-6 inline-block rounded-[20px] border border-border-subtle bg-surface-overlay/50 p-4">
            <div className="flex items-center gap-4 text-sm">
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
          </div>

          {/* Asset Information */}
          {(orderPayload?.asset_id || order?.asset_id) && (
            <div className="inline-block rounded-[20px] border border-emerald-400/20 bg-emerald-400/8 p-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                <span className="text-sm font-medium text-emerald-200">
                  {t('orderChannel.step3.rgbAssetChannel')}
                </span>
              </div>
              <div className="text-center text-sm text-content-secondary mb-2">
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
                <div className="pt-2 border-t border-purple-500/20 text-xs space-y-1">
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
        </div>
      </div>
    )
  }

  if (status === 'expired') {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="relative overflow-hidden rounded-[28px] border border-yellow-500/20 bg-surface-base/90 p-8 text-center shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
          <div className="pointer-events-none absolute -left-16 top-0 h-44 w-44 rounded-full bg-yellow-500/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-48 w-48 rounded-full bg-orange-500/10 blur-3xl" />
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-yellow-500/15">
            <Clock className="h-10 w-10 text-yellow-300" />
          </div>
          <h3 className="mb-4 text-2xl font-bold text-white">
            {t('orderChannel.step4.expiredTitle')}
          </h3>
          <p className="mb-6 text-content-secondary">
            {t('orderChannel.step3.expiredMessage')}
          </p>

          <div className="flex gap-3 justify-center">
            {onRestart && (
              <button
                className="flex max-w-xs flex-1 items-center justify-center gap-2 rounded-xl bg-yellow-500 px-6 py-3 font-medium text-slate-950 transition-colors hover:bg-yellow-400"
                onClick={onRestart}
              >
                <RefreshCcw className="w-4 h-4" />
                {t('orderChannel.step3.createNewOrder')}
              </button>
            )}
            {onBack && (
              <button
                className="flex items-center justify-center gap-2 rounded-xl border border-border-subtle bg-surface-overlay/60 px-6 py-3 font-medium text-white transition-colors hover:border-yellow-500/30"
                onClick={onBack}
              >
                <ArrowLeft className="w-4 h-4" />
                {t('orderChannel.step3.backButton')}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="relative overflow-hidden rounded-[28px] border border-red-500/20 bg-surface-base/90 p-8 text-center shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
          <div className="pointer-events-none absolute -left-16 top-0 h-44 w-44 rounded-full bg-red-500/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl" />
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/15">
            <svg
              className="h-10 w-10 text-red-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M6 18L18 6M6 6l12 12"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          </div>
          <h3 className="mb-4 text-2xl font-bold text-white">
            {t('orderChannel.step4.errorTitle')}
          </h3>
          <p className="mb-6 text-content-secondary">
            {t('orderChannel.step3.errorMessage')}
          </p>

          <div className="flex gap-3 justify-center">
            {onRestart && (
              <button
                className="flex max-w-xs flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-6 py-3 font-medium text-white transition-colors hover:bg-red-400"
                onClick={onRestart}
              >
                <RefreshCcw className="w-4 h-4" />
                {t('orderChannel.step3.tryAgain')}
              </button>
            )}
            {onBack && (
              <button
                className="flex items-center justify-center gap-2 rounded-xl border border-border-subtle bg-surface-overlay/60 px-6 py-3 font-medium text-white transition-colors hover:border-red-500/30"
                onClick={onBack}
              >
                <ArrowLeft className="w-4 h-4" />
                {t('orderChannel.step3.backButton')}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}
