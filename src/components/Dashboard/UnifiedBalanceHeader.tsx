import { ChevronDown, Wallet } from 'lucide-react'
import React, { useState } from 'react'

import { formatBitcoinAmount } from '../../helpers/number'
import { Card } from '../ui'

interface UnifiedBalanceHeaderProps {
  totalOnChain: number
  totalOffChain: number
  offChainLN: number
  offChainSpark: number
  bitcoinUnit: string
}

export const UnifiedBalanceHeader: React.FC<UnifiedBalanceHeaderProps> = ({
  totalOnChain,
  totalOffChain,
  offChainLN,
  offChainSpark,
  bitcoinUnit,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const totalBalance = totalOnChain + totalOffChain

  return (
    <Card className="mb-6 bg-gradient-to-br from-blue-900/20 to-purple-900/20 border-blue-500/30">
      <div className="p-6">
        {/* Main Balance Display */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <Wallet className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-1">
                Total Balance
              </h3>
              <p className="text-3xl font-bold text-white">
                {formatBitcoinAmount(totalBalance, bitcoinUnit)}
              </p>
            </div>
          </div>
          <button
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <ChevronDown
              className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {/* Quick Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-slate-800/50 rounded-xl">
            <p className="text-xs text-slate-400 mb-1">On-Chain</p>
            <p className="text-lg font-semibold text-white">
              {formatBitcoinAmount(totalOnChain, bitcoinUnit)}
            </p>
          </div>
          <div className="p-4 bg-slate-800/50 rounded-xl">
            <p className="text-xs text-slate-400 mb-1">Off-Chain</p>
            <p className="text-lg font-semibold text-white">
              {formatBitcoinAmount(totalOffChain, bitcoinUnit)}
            </p>
          </div>
        </div>

        {/* Expanded Breakdown */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">On-Chain Bitcoin</span>
              <span className="text-sm font-medium text-white">
                {formatBitcoinAmount(totalOnChain, bitcoinUnit)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Lightning Channels</span>
              <span className="text-sm font-medium text-white">
                {formatBitcoinAmount(offChainLN, bitcoinUnit)}
              </span>
            </div>
            {offChainSpark > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Spark Wallet</span>
                <span className="text-sm font-medium text-white">
                  {formatBitcoinAmount(offChainSpark, bitcoinUnit)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
