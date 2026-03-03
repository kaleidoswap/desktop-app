import {
  ChevronDown,
  ChevronUp,
  DollarSign,
  Clock,
  Zap,
  Wallet,
  HelpCircle,
} from 'lucide-react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { formatNumberWithCommas } from '../../helpers/number'

interface Fee {
  amount: number
  description: string
  whatItCovers: string[]
  isOptional?: boolean
}

interface ColorConfig {
  accentBorder: string
  iconBg: string
  icon: string
}

interface FeeBreakdownProps {
  setupFee: number
  capacityFee: number
  durationFee: number
  totalFee: number
  assetPrice?: number
  assetTicker?: string
  yourLiquidity: number
  discount?: {
    code: string
    percentage: number
  }
  isLoading?: boolean
}

interface FeeItemProps {
  icon: React.ReactNode
  title: string
  amount: number
  description: string
  whatItCovers: string[]
  color: ColorConfig
  isExpanded: boolean
  onToggle: () => void
}

const FeeItem: React.FC<FeeItemProps> = ({
  icon,
  title,
  amount,
  description,
  whatItCovers,
  color,
  isExpanded,
  onToggle,
}) => {
  return (
    <div
      className={`border border-border-default ${color.accentBorder} rounded-xl overflow-hidden`}
    >
      <button
        className="w-full p-4 bg-surface-elevated hover:bg-surface-high transition-colors flex items-center justify-between group"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 ${color.iconBg} rounded-lg ${color.icon}`}>
            {icon}
          </div>
          <div className="text-left">
            <h4 className="text-sm font-bold text-content-primary">{title}</h4>
            <p className="text-xs text-content-secondary mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-content-primary">
            {formatNumberWithCommas(amount.toString())} sats
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-content-tertiary group-hover:text-content-secondary transition-colors" />
          ) : (
            <ChevronDown className="w-4 h-4 text-content-tertiary group-hover:text-content-secondary transition-colors" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="p-4 bg-surface-base/30 border-t border-border-default/30 animate-in slide-in-from-top-2 duration-200">
          <p className="text-xs font-semibold text-content-secondary mb-2">
            What this fee covers:
          </p>
          <ul className="space-y-1.5">
            {whatItCovers.map((item, index) => (
              <li
                className="flex items-start gap-2 text-xs text-content-secondary"
                key={index}
              >
                <span className={`${color.icon} mt-0.5`}>•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export const FeeBreakdown: React.FC<FeeBreakdownProps> = ({
  setupFee,
  capacityFee,
  durationFee,
  totalFee,
  assetPrice,
  assetTicker,
  yourLiquidity,
  discount,
  isLoading = false,
}) => {
  const { t } = useTranslation()
  const [expandedFee, setExpandedFee] = useState<string | null>(null)

  const fees: Record<string, Fee & { icon: React.ReactNode; color: ColorConfig }> = {
    capacity: {
      amount: capacityFee,
      color: {
        accentBorder: 'border-l-2 border-l-primary',
        icon: 'text-primary',
        iconBg: 'bg-primary/10',
      },
      description: 'Fee based on channel size',
      icon: <Wallet className="w-4 h-4" />,
      whatItCovers: [
        'Liquidity provision by the LSP for your channel',
        'Capital lockup cost - LSP commits Bitcoin to your channel',
        'Network bandwidth and routing capacity allocation',
        'Risk premium for providing inbound liquidity',
      ],
    },
    duration: {
      amount: durationFee,
      color: {
        accentBorder: 'border-l-2 border-l-secondary',
        icon: 'text-secondary',
        iconBg: 'bg-secondary/10',
      },
      description: 'Time-based channel maintenance fee',
      icon: <Clock className="w-4 h-4" />,
      whatItCovers: [
        'Guaranteed channel uptime for the selected duration',
        'Ongoing channel monitoring and maintenance',
        'Network routing optimizations and fee adjustments',
        'Customer support and channel issue resolution',
      ],
    },
    setup: {
      amount: setupFee,
      color: {
        accentBorder: 'border-l-2 border-l-status-warning',
        icon: 'text-status-warning',
        iconBg: 'bg-status-warning/10',
      },
      description: 'One-time channel creation fee',
      icon: <Zap className="w-4 h-4" />,
      whatItCovers: [
        'On-chain transaction fees for opening the channel',
        'Channel setup and initialization on the Lightning Network',
        'Initial routing table configuration and network announcement',
        'LSP operational costs for channel management',
      ],
    },
  }

  const grandTotal = totalFee + yourLiquidity + (assetPrice || 0)

  return (
    <div className="bg-surface-overlay rounded-2xl p-6 border border-border-default shadow-xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <DollarSign className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-content-primary">
              {assetPrice && assetPrice > 0
                ? 'Total Cost Breakdown'
                : 'Fee Breakdown'}
            </h3>
            <p className="text-xs text-content-secondary mt-1">
              Click each item to see what it covers
            </p>
          </div>
        </div>
        {isLoading && (
          <span className="text-xs text-status-warning flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-status-warning border-t-transparent rounded-full animate-spin" />
            Calculating...
          </span>
        )}
      </div>

      {/* Fee Items */}
      <div className="space-y-3">
        <FeeItem
          {...fees.setup}
          isExpanded={expandedFee === 'setup'}
          onToggle={() =>
            setExpandedFee(expandedFee === 'setup' ? null : 'setup')
          }
          title="Setup Fee"
        />
        <FeeItem
          {...fees.capacity}
          isExpanded={expandedFee === 'capacity'}
          onToggle={() =>
            setExpandedFee(expandedFee === 'capacity' ? null : 'capacity')
          }
          title="Capacity Fee"
        />
        <FeeItem
          {...fees.duration}
          isExpanded={expandedFee === 'duration'}
          onToggle={() =>
            setExpandedFee(expandedFee === 'duration' ? null : 'duration')
          }
          title="Duration Fee"
        />
      </div>

      {/* Channel Fees Subtotal */}
      <div className="pt-4 border-t border-border-default">
        <div className="flex justify-between items-center py-2 px-4 bg-surface-elevated rounded-lg">
          <span className="text-sm font-semibold text-content-secondary">
            Channel Fees Subtotal
          </span>
          <span className="text-base font-bold text-content-primary">
            {formatNumberWithCommas(totalFee.toString())} sats
          </span>
        </div>
      </div>

      {/* Discount (if applicable) */}
      {discount && discount.percentage > 0 && (
        <div className="bg-status-success/10 border border-status-success/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-status-success">
              Discount Applied ({discount.code})
            </span>
            <span className="text-base font-bold text-status-success">
              -{Math.round(discount.percentage * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Asset Purchase (if applicable) */}
      {assetPrice && assetPrice > 0 && assetTicker && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
          <div className="flex items-start gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Wallet className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-content-primary mb-1">
                Asset Purchase ({assetTicker})
              </h4>
              <p className="text-xs text-content-secondary">
                Cost to purchase RGB assets at current market rate
              </p>
            </div>
            <span className="text-base font-bold text-primary">
              {formatNumberWithCommas(assetPrice.toString())} sats
            </span>
          </div>
        </div>
      )}

      {/* Your Liquidity */}
      <div className="bg-status-warning/10 border border-status-warning/20 rounded-xl p-4">
        <div className="flex items-start gap-3 mb-2">
          <div className="p-2 bg-status-warning/10 rounded-lg">
            <Wallet className="w-4 h-4 text-status-warning" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-content-primary mb-1">
              Your Liquidity
            </h4>
            <p className="text-xs text-content-secondary">
              Bitcoin you're adding to the channel (your outbound capacity)
            </p>
          </div>
          <span className="text-base font-bold text-status-warning">
            {formatNumberWithCommas(yourLiquidity.toString())} sats
          </span>
        </div>
      </div>

      {/* Grand Total */}
      <div className="pt-4 border-t border-border-default">
        <div className="flex justify-between items-center py-4 px-5 bg-primary/10 rounded-xl border border-primary/20">
          <div>
            <span className="text-lg font-bold text-content-primary">
              Total Payment
            </span>
            <p className="text-xs text-content-secondary mt-1">
              Amount you'll pay to create this channel
            </p>
          </div>
          <span className="text-2xl font-bold text-primary">
            {formatNumberWithCommas(grandTotal.toString())} sats
          </span>
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-surface-elevated border border-border-default/40 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <HelpCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="space-y-2 text-xs text-content-secondary">
            <p className="font-semibold text-content-secondary">
              Understanding the costs:
            </p>
            <ul className="space-y-1 ml-4 list-disc">
              <li>
                <strong>{t('components.feeBreakdown.channelFees')}</strong> Paid
                to the LSP for setting up and maintaining your channel
              </li>
              <li>
                <strong>Asset Purchase:</strong> Cost to buy RGB assets at
                market rate (if selected)
              </li>
              <li>
                <strong>Your Liquidity:</strong> Your Bitcoin that goes into the
                channel (you still own this!)
              </li>
            </ul>
            <p className="pt-2 text-content-secondary">
              <strong>Note:</strong> Your liquidity is not a fee - it's your
              money in the channel that you can spend. Only the channel fees are
              paid to the LSP.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
