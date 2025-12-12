import { Info } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()

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
          ? t('channelConfiguration.feeBreakdown.totalCostBreakdown')
          : t('channelConfiguration.feeBreakdown.estimatedCosts')}
        {isLoading && (
          <span className="ml-2 text-sm text-gray-400">
            {t('channelConfiguration.feeBreakdown.calculating')}
          </span>
        )}
      </h3>
      <div className="space-y-2">
        {/* Channel Fees */}
        <div className="flex justify-between text-sm items-center">
          <span className="text-gray-300">
            {t('channelConfiguration.feeBreakdown.setupFee')}
          </span>
          <span className="text-white font-medium">
            {formatNumberWithCommas(fees.setup_fee.toString())} sats
          </span>
        </div>
        <div className="flex justify-between text-sm items-center">
          <span className="text-gray-300">
            {t('channelConfiguration.feeBreakdown.capacityFee')}
          </span>
          <span className="text-white font-medium">
            {formatNumberWithCommas(fees.capacity_fee.toString())} sats
          </span>
        </div>
        <div className="flex justify-between text-sm items-center">
          <span className="text-gray-300">
            {t('channelConfiguration.feeBreakdown.durationFee')}
          </span>
          <span className="text-white font-medium">
            {formatNumberWithCommas(fees.duration_fee.toString())} sats
          </span>
        </div>

        {/* Discount if applicable */}
        {fees.applied_discount && fees.discount_code && (
          <div className="flex justify-between items-center py-2 border-b border-green-700/30 bg-green-900/20 -mx-3 px-3">
            <span className="text-green-300 font-medium">
              {t('channelConfiguration.feeBreakdown.discount', {
                code: fees.discount_code,
              })}
            </span>
            <span className="font-medium text-green-400">
              -{Math.round(fees.applied_discount * 100)}%
            </span>
          </div>
        )}

        <div className="flex justify-between text-sm pt-2 border-t border-blue-700/30">
          <span className="text-gray-300 font-medium">
            {t('channelConfiguration.feeBreakdown.channelFees')}
          </span>
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
              {t('channelConfiguration.feeBreakdown.totalPayment')}
            </span>
            <span className="text-blue-200 font-bold text-base">
              {formatNumberWithCommas(calculateGrandTotal().toString())} sats
            </span>
          </div>
        )}
      </div>

      {!showGrandTotal && (
        <div className="mt-4 text-xs text-gray-400">
          <p>{t('channelConfiguration.feeBreakdown.feeExplanation')}</p>
        </div>
      )}
    </div>
  )
}
