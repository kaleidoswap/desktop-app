import { Info } from 'lucide-react'
import React from 'react'

import { formatNumberWithCommas } from '../../helpers/number'
import { ChannelFees } from '../../slices/makerApi/makerApi.slice'

interface FeeBreakdownDisplayProps {
  fees: ChannelFees
  isLoading?: boolean
  showGrandTotal?: boolean
  additionalCosts?: Array<{
    label: string
    amount: number
    className?: string
  }>
  containerClassName?: string
}

export const FeeBreakdownDisplay: React.FC<FeeBreakdownDisplayProps> = ({
  fees,
  isLoading = false,
  showGrandTotal = false,
  additionalCosts = [],
  containerClassName = 'bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-700/50 rounded-xl p-4',
}) => {
  const calculateGrandTotal = () => {
    const additionalTotal = additionalCosts.reduce(
      (sum, cost) => sum + cost.amount,
      0
    )
    return fees.total_fee + additionalTotal
  }

  return (
    <div className={containerClassName}>
      <h3 className="text-lg font-semibold text-blue-200 mb-3 flex items-center gap-2">
        <Info className="w-5 h-5" />
        {showGrandTotal && additionalCosts.length > 0
          ? 'Total Cost Breakdown'
          : 'Estimated Costs'}
        {isLoading && (
          <span className="ml-2 text-sm text-gray-400">(calculating...)</span>
        )}
      </h3>
      <div className="space-y-2">
        {/* Channel Fees */}
        <div className="flex justify-between text-sm items-center">
          <span className="text-gray-300">Setup Fee</span>
          <span className="text-white font-medium">
            {formatNumberWithCommas(fees.setup_fee.toString())} sats
          </span>
        </div>
        <div className="flex justify-between text-sm items-center">
          <span className="text-gray-300">Capacity Fee</span>
          <span className="text-white font-medium">
            {formatNumberWithCommas(fees.capacity_fee.toString())} sats
          </span>
        </div>
        <div className="flex justify-between text-sm items-center">
          <span className="text-gray-300">Duration Fee</span>
          <span className="text-white font-medium">
            {formatNumberWithCommas(fees.duration_fee.toString())} sats
          </span>
        </div>

        {/* Discount if applicable */}
        {fees.applied_discount && fees.discount_code && (
          <div className="flex justify-between items-center py-2 border-b border-green-700/30 bg-green-900/20 -mx-3 px-3">
            <span className="text-green-300 font-medium">
              Discount ({fees.discount_code})
            </span>
            <span className="font-medium text-green-400">
              -{Math.round(fees.applied_discount * 100)}%
            </span>
          </div>
        )}

        <div className="flex justify-between text-sm pt-2 border-t border-blue-700/30">
          <span className="text-gray-300 font-medium">Channel Fees</span>
          <span className="text-white font-semibold">
            {formatNumberWithCommas(fees.total_fee.toString())} sats
          </span>
        </div>

        {/* Additional costs */}
        {additionalCosts.map((cost, index) => (
          <div
            className={`flex justify-between text-sm ${cost.className || ''}`}
            key={index}
          >
            <span className={cost.className ? '' : 'text-gray-300'}>
              {cost.label}
            </span>
            <span className={cost.className ? '' : 'text-white font-medium'}>
              {formatNumberWithCommas(cost.amount.toString())} sats
            </span>
          </div>
        ))}

        {/* Grand Total */}
        {showGrandTotal && (
          <div className="flex justify-between pt-2 border-t-2 border-blue-700/50">
            <span className="text-blue-100 font-bold text-base">
              Total Payment
            </span>
            <span className="text-blue-200 font-bold text-base">
              {formatNumberWithCommas(calculateGrandTotal().toString())} sats
            </span>
          </div>
        )}
      </div>

      {!showGrandTotal && (
        <div className="mt-4 text-xs text-gray-400">
          <p>
            This fee covers the cost of setting up and maintaining your channel.
            The total amount you'll need to pay includes this fee plus your
            desired channel liquidity.
          </p>
        </div>
      )}
    </div>
  )
}
