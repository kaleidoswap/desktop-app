import { Info, ArrowRightLeft, Coins, Zap } from 'lucide-react'

import { formatNumberWithCommas } from '../../../helpers/number'
import { ChannelFees } from '../../../slices/makerApi/makerApi.slice'
import { AssetInfo } from '../../../utils/channelOrderUtils'

interface OrderSummaryProps {
  orderPayload: any
  fees: ChannelFees | null
  assetMap: Record<string, AssetInfo>
  compact?: boolean
  quote?: any
}

export const OrderSummary: React.FC<OrderSummaryProps> = ({
  orderPayload,
  fees,
  assetMap,
  compact = false,
  quote,
}) => {
  if (!orderPayload) return null

  const totalCapacity =
    (orderPayload.client_balance_sat || 0) + (orderPayload.lsp_balance_sat || 0)
  const assetInfo = orderPayload.asset_id
    ? assetMap[orderPayload.asset_id]
    : null

  // Calculate asset price from quote or payload
  const assetPriceSats = quote
    ? quote.from_amount / 1000
    : orderPayload.client_asset_amount && assetInfo
      ? 0 // Could calculate if we have the info
      : 0

  // Calculate total order
  const assetCost = assetPriceSats || 0
  const bitcoinLiquidity = orderPayload.client_balance_sat || 0
  const channelFees = fees?.total_fee || 0
  const totalOrder = assetCost + bitcoinLiquidity + channelFees

  return (
    <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-xl p-5 border border-gray-700/50">
      {!compact && (
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Info className="w-5 h-5 text-blue-400" />
          Order Summary
        </h3>
      )}

      <div className="space-y-4">
        {/* Bitcoin Liquidity Section */}
        <div className="bg-gray-900/50 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-orange-400" />
            <h4 className="text-xs font-semibold text-orange-300 uppercase tracking-wide">
              Bitcoin Liquidity
            </h4>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Your Outbound</span>
            <span className="text-white font-semibold">
              {formatNumberWithCommas(orderPayload.client_balance_sat || 0)}{' '}
              sats
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Your Inbound</span>
            <span className="text-gray-300">
              {formatNumberWithCommas(orderPayload.lsp_balance_sat || 0)} sats
            </span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-gray-700/50">
            <span className="text-gray-400">Total Capacity</span>
            <span className="text-orange-300 font-semibold">
              {formatNumberWithCommas(totalCapacity)} sats
            </span>
          </div>
        </div>

        {/* Asset Section */}
        {assetInfo && orderPayload.client_asset_amount && (
          <div className="bg-gradient-to-br from-emerald-900/20 to-green-900/20 rounded-lg p-3 border border-emerald-700/30 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-semibold text-emerald-300 uppercase tracking-wide">
                Asset Purchase
              </h4>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-emerald-200/70">Asset</span>
              <span className="text-white font-semibold">
                {assetInfo.ticker}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-emerald-200/70">Amount</span>
              <span className="text-emerald-300 font-bold text-base">
                {formatNumberWithCommas(
                  (
                    orderPayload.client_asset_amount /
                    Math.pow(10, assetInfo.precision)
                  ).toFixed(assetInfo.precision)
                )}{' '}
                {assetInfo.ticker}
              </span>
            </div>
            {assetPriceSats > 0 && (
              <div className="flex justify-between text-sm pt-2 border-t border-emerald-700/30">
                <span className="text-emerald-200/70">Price</span>
                <span className="text-emerald-300 font-semibold">
                  {formatNumberWithCommas(assetPriceSats)} sats
                </span>
              </div>
            )}
          </div>
        )}

        {/* Fees Section */}
        {fees && (
          <div className="bg-gray-900/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <ArrowRightLeft className="w-4 h-4 text-blue-400" />
              <h4 className="text-xs font-semibold text-blue-300 uppercase tracking-wide">
                Fees Breakdown
              </h4>
            </div>
            {fees.setup_fee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Setup Fee</span>
                <span className="text-gray-300">
                  {formatNumberWithCommas(fees.setup_fee)} sats
                </span>
              </div>
            )}
            {fees.capacity_fee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Capacity Fee</span>
                <span className="text-gray-300">
                  {formatNumberWithCommas(fees.capacity_fee)} sats
                </span>
              </div>
            )}
            {fees.duration_fee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Duration Fee</span>
                <span className="text-gray-300">
                  {formatNumberWithCommas(fees.duration_fee)} sats
                </span>
              </div>
            )}
            {fees.applied_discount && fees.applied_discount > 0 && (
              <div className="flex justify-between text-sm text-green-400">
                <span>Discount</span>
                <span>
                  -{formatNumberWithCommas(fees.applied_discount)} sats
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm pt-2 border-t border-gray-700/50">
              <span className="text-gray-400">Total Fees</span>
              <span className="text-blue-300 font-semibold">
                {formatNumberWithCommas(fees.total_fee)} sats
              </span>
            </div>
          </div>
        )}

        {/* Total Order */}
        <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-lg p-4 border border-blue-700/50">
          <div className="flex justify-between items-center">
            <span className="text-gray-200 font-semibold">Total Order</span>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">
                {formatNumberWithCommas(totalOrder)}
                <span className="text-base text-gray-400 ml-1">sats</span>
              </div>
              {assetInfo && orderPayload.client_asset_amount && (
                <div className="text-xs text-gray-400 mt-1">
                  {assetPriceSats > 0 &&
                    `${formatNumberWithCommas(assetPriceSats)} (asset) + `}
                  {formatNumberWithCommas(bitcoinLiquidity)} (liquidity) +{' '}
                  {formatNumberWithCommas(channelFees)} (fees)
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
