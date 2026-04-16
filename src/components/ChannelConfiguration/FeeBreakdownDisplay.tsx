import { Info } from 'lucide-react'
import React from 'react'
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
      <h3 className="text-lg font-semibold text-content-primary mb-3 flex items-center gap-2">
        <Info className="w-5 h-5 text-primary" />
        {showGrandTotal && additionalCosts.length > 0
          ? t('channelConfiguration.feeBreakdown.totalCostBreakdown')
          : t('channelConfiguration.feeBreakdown.estimatedCosts')}
        {isLoading && (
          <span className="ml-2 text-sm text-content-secondary">
            {t('channelConfiguration.feeBreakdown.calculating')}
          </span>
        )}
      </h3>
      <div className="space-y-2">
        {/* Channel Fees */}
        <div className="flex justify-between text-sm items-center">
          <span className="text-content-secondary">
            {t('channelConfiguration.feeBreakdown.setupFee')}
          </span>
          {fees ? (
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
          {fees ? (
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
          {fees ? (
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
          {fees ? (
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
            {fees ? (
              <span className="text-primary font-bold text-base">
                {formatNumberWithCommas(calculateGrandTotal().toString())} sats
              </span>
            ) : (
              <SkeletonBar wide />
            )}
          </div>
        )}
      </div>

      {!showGrandTotal && (
        <div className="mt-4 text-xs text-content-secondary">
          <p>{t('channelConfiguration.feeBreakdown.feeExplanation')}</p>
        </div>
      )}
    </div>
  )
}
