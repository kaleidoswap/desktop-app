import React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { formatNumberWithCommas } from '../../helpers/number'
import { ChannelFees } from '../../slices/makerApi/makerApi.slice'

interface FeeBreakdownDisplayProps {
  fees: ChannelFees | null
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
  containerClassName = 'bg-surface-overlay/80 border border-border-default/50 rounded-xl p-4',
}) => {
  const { t } = useTranslation()

  const calculateGrandTotal = () => {
    if (!fees) return 0
    const additionalTotal = additionalCosts.reduce(
      (sum, cost) => sum + cost.amount,
      0
    )
    return fees.total_fee + additionalTotal
  }

  const SkeletonBar = ({ wide }: { wide?: boolean }) => (
    <div
      className={`h-4 rounded bg-surface-high/60 animate-pulse ${wide ? 'w-24' : 'w-16'}`}
    />
  )

  return (
    <div className={containerClassName}>
      <div className="text-sm font-medium text-white mb-3">
        {showGrandTotal && additionalCosts.length > 0
          ? t('channelConfiguration.feeBreakdown.totalCostBreakdown')
          : t('channelConfiguration.feeBreakdown.estimatedCosts')}
      </div>
      <div className="space-y-2">
        {/* Channel Fees */}
        <div className="flex justify-between text-sm items-center">
          <span className="text-content-secondary">
            {t('channelConfiguration.feeBreakdown.setupFee')}
          </span>
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-content-tertiary" />
          ) : fees ? (
            <span className="text-content-primary font-medium">
              {formatNumberWithCommas(fees.setup_fee.toString())} sats
            </span>
          ) : (
            <SkeletonBar />
          )}
        </div>
        <div className="flex justify-between text-sm items-center">
          <span className="text-content-secondary">
            {t('channelConfiguration.feeBreakdown.capacityFee')}
          </span>
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-content-tertiary" />
          ) : fees ? (
            <span className="text-content-primary font-medium">
              {formatNumberWithCommas(fees.capacity_fee.toString())} sats
            </span>
          ) : (
            <SkeletonBar />
          )}
        </div>
        <div className="flex justify-between text-sm items-center">
          <span className="text-content-secondary">
            {t('channelConfiguration.feeBreakdown.durationFee')}
          </span>
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-content-tertiary" />
          ) : fees ? (
            <span className="text-content-primary font-medium">
              {formatNumberWithCommas(fees.duration_fee.toString())} sats
            </span>
          ) : (
            <SkeletonBar />
          )}
        </div>

        {/* Discount if applicable */}
        {fees?.applied_discount && fees?.discount_code && (
          <div className="flex justify-between items-center py-2 border-b border-status-success/20 bg-status-success/10 -mx-3 px-3">
            <span className="text-status-success font-medium">
              {t('channelConfiguration.feeBreakdown.discount', {
                code: fees.discount_code,
              })}
            </span>
            <span className="font-medium text-status-success">
              -{Math.round(fees.applied_discount * 100)}%
            </span>
          </div>
        )}

        <div className="flex justify-between text-sm pt-2 border-t border-border-default/30">
          <span className="text-content-secondary font-medium">
            {t('channelConfiguration.feeBreakdown.channelFees')}
          </span>
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-content-tertiary" />
          ) : fees ? (
            <span className="text-content-primary font-semibold">
              {formatNumberWithCommas(fees.total_fee.toString())} sats
            </span>
          ) : (
            <SkeletonBar wide />
          )}
        </div>

        {/* Additional costs */}
        {additionalCosts.map((cost, index) => (
          <div
            className={`flex justify-between text-sm ${cost.className || ''}`}
            key={index}
          >
            <span className={cost.className ? '' : 'text-content-secondary'}>
              {cost.label}
            </span>
            <span
              className={
                cost.className ? '' : 'text-content-primary font-medium'
              }
            >
              {formatNumberWithCommas(cost.amount.toString())} sats
            </span>
          </div>
        ))}

        {/* Grand Total */}
        {showGrandTotal && (
          <div className="flex justify-between pt-2 border-t border-border-default">
            <span className="text-content-primary font-bold text-base">
              {t('channelConfiguration.feeBreakdown.totalPayment')}
            </span>
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-content-tertiary" />
            ) : fees ? (
              <span className="text-primary font-bold text-base">
                {formatNumberWithCommas(calculateGrandTotal().toString())} sats
              </span>
            ) : (
              <SkeletonBar wide />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
