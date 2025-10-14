import { Clock, RefreshCcw, ArrowLeft } from 'lucide-react'
import React from 'react'

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
  if (status === 'success') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-2xl p-8 text-center">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-green-500"
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
          <h3 className="text-2xl font-bold text-white mb-4">
            Payment Successful!
          </h3>
          <p className="text-gray-400 mb-6">
            Your channel is being opened. This may take a few minutes to
            complete.
          </p>
          <div className="bg-gray-800/50 rounded-xl p-4 inline-block mb-6">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-400">Amount:</span>
              <span className="text-white font-medium">
                {formatBitcoinAmount(
                  currentPayment?.order_total_sat || 0,
                  bitcoinUnit
                )}{' '}
                {bitcoinUnit}
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-400">Method:</span>
              <span className="text-white font-medium flex items-center gap-1">
                {paymentMethod === 'lightning' ? (
                  <>⚡ Lightning</>
                ) : (
                  <>₿ On-chain</>
                )}
              </span>
            </div>
          </div>

          {/* Asset Information */}
          {(orderPayload?.asset_id || order?.asset_id) && (
            <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-4 inline-block">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                <span className="text-purple-300 text-sm font-medium">
                  RGB Asset Channel
                </span>
              </div>
              <div className="text-center text-sm text-gray-400 mb-2">
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
                      <span className="text-gray-500">LSP Amount:</span>
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
                      <span className="text-gray-500">Your Amount:</span>
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
      <div className="max-w-2xl mx-auto">
        <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-2xl p-8 text-center">
          <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-10 h-10 text-yellow-500" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-4">
            Payment Expired
          </h3>
          <p className="text-gray-400 mb-6">
            The payment window has expired. Please create a new order to
            continue.
          </p>

          <div className="flex gap-3 justify-center">
            {onRestart && (
              <button
                className="flex-1 max-w-xs px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                onClick={onRestart}
              >
                <RefreshCcw className="w-4 h-4" />
                Create New Order
              </button>
            )}
            {onBack && (
              <button
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                onClick={onBack}
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-gradient-to-br from-red-500/10 to-pink-500/10 border border-red-500/20 rounded-2xl p-8 text-center">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-red-500"
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
          <h3 className="text-2xl font-bold text-white mb-4">Payment Failed</h3>
          <p className="text-gray-400 mb-6">
            There was an issue processing your payment. You can try creating a
            new order.
          </p>

          <div className="flex gap-3 justify-center">
            {onRestart && (
              <button
                className="flex-1 max-w-xs px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                onClick={onRestart}
              >
                <RefreshCcw className="w-4 h-4" />
                Try Again
              </button>
            )}
            {onBack && (
              <button
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                onClick={onBack}
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}
