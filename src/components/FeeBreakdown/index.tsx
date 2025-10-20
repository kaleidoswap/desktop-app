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

import { formatNumberWithCommas } from '../../helpers/number'

interface Fee {
  amount: number
  description: string
  whatItCovers: string[]
  isOptional?: boolean
}

interface ColorConfig {
  bg: string
  border: string
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
      className={`border-2 ${color.border} rounded-xl overflow-hidden transition-all duration-300`}
    >
      {/* Header - Always visible */}
      <button
        className={`w-full p-4 bg-gradient-to-r ${color.bg} hover:opacity-90 transition-opacity flex items-center justify-between group`}
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 bg-slate-900/50 rounded-lg ${color.icon}`}>
            {icon}
          </div>
          <div className="text-left">
            <h4 className="text-sm font-bold text-white">{title}</h4>
            <p className="text-xs text-gray-300 mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-white">
            {formatNumberWithCommas(amount.toString())} sats
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
          )}
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="p-4 bg-slate-900/30 border-t border-slate-700/30 animate-in slide-in-from-top-2 duration-200">
          <p className="text-xs font-semibold text-gray-300 mb-2">
            What this fee covers:
          </p>
          <ul className="space-y-1.5">
            {whatItCovers.map((item, index) => (
              <li
                className="flex items-start gap-2 text-xs text-gray-400"
                key={index}
              >
                <span className="text-blue-400 mt-0.5">•</span>
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
  const [expandedFee, setExpandedFee] = useState<string | null>(null)

  const fees: Record<string, Fee & { icon: React.ReactNode; color: any }> = {
    capacity: {
      amount: capacityFee,
      color: {
        bg: 'from-blue-900/30 to-indigo-900/30',
        border: 'border-blue-700/40',
        icon: 'text-blue-400',
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
        bg: 'from-purple-900/30 to-violet-900/30',
        border: 'border-purple-700/40',
        icon: 'text-purple-400',
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
        bg: 'from-amber-900/30 to-orange-900/30',
        border: 'border-amber-700/40',
        icon: 'text-amber-400',
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
    <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 rounded-2xl p-6 border border-slate-700/50 shadow-2xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <DollarSign className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              {assetPrice && assetPrice > 0
                ? 'Total Cost Breakdown'
                : 'Fee Breakdown'}
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Click each item to see what it covers
            </p>
          </div>
        </div>
        {isLoading && (
          <span className="text-xs text-yellow-400 flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
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
      <div className="pt-4 border-t-2 border-slate-700/50">
        <div className="flex justify-between items-center py-2 px-4 bg-slate-800/40 rounded-lg">
          <span className="text-sm font-semibold text-gray-300">
            Channel Fees Subtotal
          </span>
          <span className="text-base font-bold text-white">
            {formatNumberWithCommas(totalFee.toString())} sats
          </span>
        </div>
      </div>

      {/* Discount (if applicable) */}
      {discount && discount.percentage > 0 && (
        <div className="bg-green-900/20 border-2 border-green-700/40 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-green-300">
                Discount Applied ({discount.code})
              </span>
            </div>
            <span className="text-base font-bold text-green-400">
              -{Math.round(discount.percentage * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Asset Purchase (if applicable) */}
      {assetPrice && assetPrice > 0 && assetTicker && (
        <div className="bg-emerald-900/20 border-2 border-emerald-700/40 rounded-xl p-4">
          <div className="flex items-start gap-3 mb-2">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <Wallet className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-emerald-200 mb-1">
                Asset Purchase ({assetTicker})
              </h4>
              <p className="text-xs text-emerald-100/80">
                Cost to purchase RGB assets at current market rate
              </p>
            </div>
            <span className="text-base font-bold text-emerald-300">
              {formatNumberWithCommas(assetPrice.toString())} sats
            </span>
          </div>
        </div>
      )}

      {/* Your Liquidity */}
      <div className="bg-orange-900/20 border-2 border-orange-700/40 rounded-xl p-4">
        <div className="flex items-start gap-3 mb-2">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <Wallet className="w-4 h-4 text-orange-400" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-orange-200 mb-1">
              Your Liquidity
            </h4>
            <p className="text-xs text-orange-100/80">
              Bitcoin you're adding to the channel (your outbound capacity)
            </p>
          </div>
          <span className="text-base font-bold text-orange-300">
            {formatNumberWithCommas(yourLiquidity.toString())} sats
          </span>
        </div>
      </div>

      {/* Grand Total */}
      <div className="pt-4 border-t-2 border-slate-600/50">
        <div className="flex justify-between items-center py-4 px-5 bg-gradient-to-r from-blue-900/40 to-purple-900/40 rounded-xl border-2 border-blue-600/40">
          <div>
            <span className="text-lg font-bold text-blue-100">
              Total Payment
            </span>
            <p className="text-xs text-blue-200/70 mt-1">
              Amount you'll pay to create this channel
            </p>
          </div>
          <span className="text-2xl font-bold text-blue-200">
            {formatNumberWithCommas(grandTotal.toString())} sats
          </span>
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <HelpCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-2 text-xs text-slate-300">
            <p className="font-semibold text-blue-300">
              Understanding the costs:
            </p>
            <ul className="space-y-1 ml-4 list-disc">
              <li>
                <strong>Channel Fees:</strong> Paid to the LSP for setting up
                and maintaining your channel
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
            <p className="pt-2 text-slate-400">
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
