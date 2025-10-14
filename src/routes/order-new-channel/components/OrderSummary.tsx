import React from 'react'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { toast } from 'react-toastify'

import { formatBitcoinAmount } from '../../../helpers/number'
import { Lsps1CreateOrderResponse } from '../../../slices/makerApi/makerApi.slice'
import { NiaAsset } from '../../../slices/nodeApi/nodeApi.slice'

interface OrderSummaryProps {
  order: Lsps1CreateOrderResponse
  bitcoinUnit: string
  currentPayment: any
  assetInfo: NiaAsset | null
  orderPayload?: any
}

export const OrderSummary: React.FC<OrderSummaryProps> = ({
  order,
  bitcoinUnit,
  currentPayment,
  assetInfo,
  orderPayload,
}) => {
  const totalCapacity = order.lsp_balance_sat + order.client_balance_sat

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <span className="bg-blue-500 w-2 h-2 rounded-full mr-2"></span>
          Order Summary
        </h3>
        {order.order_id && (
          <CopyToClipboard
            onCopy={() => toast.success('Order ID copied!')}
            text={order.order_id}
          >
            <button className="text-xs text-gray-400 hover:text-white font-mono bg-gray-900/50 px-2 py-1 rounded transition-colors">
              {order.order_id.slice(0, 8)}...
            </button>
          </CopyToClipboard>
        )}
      </div>

      <div className="space-y-4">
        {/* Channel Info (Confirmed) */}
        <div className="bg-gray-900/50 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-gray-400">Confirmed Channel</span>
            <span className="text-white font-bold">
              {formatBitcoinAmount(totalCapacity, bitcoinUnit)} {bitcoinUnit}
            </span>
          </div>

          {/* Liquidity Bar */}
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Your Liquidity</span>
              <span>LSP Liquidity</span>
            </div>
            <div className="relative h-3 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300"
                style={{
                  width: `${(order.client_balance_sat / totalCapacity) * 100}%`,
                }}
              ></div>
              <div
                className="absolute right-0 top-0 h-full bg-gradient-to-l from-purple-500 to-purple-400 transition-all duration-300"
                style={{
                  width: `${(order.lsp_balance_sat / totalCapacity) * 100}%`,
                }}
              ></div>
            </div>
          </div>

          <div className="flex justify-between text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-gray-400">Your:</span>
              <span className="text-blue-400 font-medium">
                {formatBitcoinAmount(order.client_balance_sat, bitcoinUnit)}{' '}
                {bitcoinUnit}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-400">LSP:</span>
              <span className="text-purple-400 font-medium">
                {formatBitcoinAmount(order.lsp_balance_sat, bitcoinUnit)}{' '}
                {bitcoinUnit}
              </span>
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Asset Badge - Simple display */}
        {orderPayload?.asset_id && assetInfo && (
          <div className="flex items-center justify-center">
            <span className="px-4 py-2 bg-purple-500/20 rounded-lg text-purple-300 text-sm font-medium flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
              RGB Asset: {assetInfo.ticker}
            </span>
          </div>
        )}

        {/* Cost Breakdown */}
        <div className="bg-gray-900/50 rounded-xl p-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Channel Amount:</span>
              <span className="text-white">
                {formatBitcoinAmount(
                  (currentPayment?.order_total_sat || 0) -
                    (currentPayment?.fee_total_sat || 0),
                  bitcoinUnit
                )}{' '}
                {bitcoinUnit}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Service Fee:</span>
              <span className="text-white">
                {formatBitcoinAmount(
                  currentPayment?.fee_total_sat || 0,
                  bitcoinUnit
                )}{' '}
                {bitcoinUnit}
              </span>
            </div>
            <div className="h-px bg-gray-700 my-2"></div>
            <div className="flex justify-between">
              <span className="text-gray-400 font-medium">Total:</span>
              <span className="text-white font-bold">
                {formatBitcoinAmount(
                  currentPayment?.order_total_sat || 0,
                  bitcoinUnit
                )}{' '}
                {bitcoinUnit}
              </span>
            </div>
          </div>
        </div>

        {/* Expiry Info */}
        {/* <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
          <div className="flex items-center gap-2 text-sm text-blue-400">
            <Clock className="w-4 h-4" />
            <span>
              Expires:{' '}
              {new Date(currentPayment?.expires_at || '').toLocaleString(
                'en-US',
                {
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  month: 'short',
                }
              )}
            </span>
          </div>
        </div> */}
      </div>
    </div>
  )
}
