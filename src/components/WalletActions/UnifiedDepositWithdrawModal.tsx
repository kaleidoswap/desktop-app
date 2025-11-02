import {
  X,
  ArrowDownRight,
  ArrowUpRight,
  Bitcoin,
  Zap,
  Wallet,
} from 'lucide-react'
import { useState } from 'react'

import { useAppSelector } from '../../app/store/hooks'
import { Button } from '../ui'

interface UnifiedDepositWithdrawModalProps {
  onClose: () => void
  defaultAction?: 'deposit' | 'withdraw'
  assetId?: string
}

type ActionType = 'deposit' | 'withdraw'
type WalletType = 'onchain' | 'lightning' | 'spark'

export const UnifiedDepositWithdrawModal: React.FC<
  UnifiedDepositWithdrawModalProps
> = ({ onClose, defaultAction = 'deposit' }) => {
  const [action, setAction] = useState<ActionType>(defaultAction)
  const [walletType, setWalletType] = useState<WalletType>('onchain')

  const sparkConnected = useAppSelector((state) => state.spark.connected)

  const handleActionToggle = (newAction: ActionType) => {
    setAction(newAction)
  }

  const getWalletOptions = () => {
    if (action === 'deposit') {
      return [
        {
          available: true,
          icon: Bitcoin,
          label: 'On-Chain',
          type: 'onchain' as const,
        },
        {
          available: true,
          icon: Zap,
          label: 'Lightning',
          type: 'lightning' as const,
        },
        {
          available: sparkConnected,
          icon: Wallet,
          label: 'Spark',
          type: 'spark' as const,
        },
      ]
    } else {
      return [
        {
          available: true,
          icon: Bitcoin,
          label: 'On-Chain',
          type: 'onchain' as const,
        },
        {
          available: true,
          icon: Zap,
          label: 'Lightning',
          type: 'lightning' as const,
        },
        {
          available: sparkConnected,
          icon: Wallet,
          label: 'Spark (L1)',
          type: 'spark' as const,
        },
      ]
    }
  }

  const renderActionContent = () => {
    // This will be populated with actual deposit/withdraw logic
    // For now, we'll show the selection interface
    return (
      <div className="space-y-6">
        {/* Wallet Type Selection */}
        <div>
          <label className="text-sm font-medium text-slate-300 mb-3 block">
            Select Wallet
          </label>
          <div className="grid grid-cols-3 gap-3">
            {getWalletOptions().map((option) => (
              <button
                className={`
                  relative p-4 rounded-xl border-2 transition-all duration-200
                  ${
                    walletType === option.type
                      ? 'border-cyan bg-cyan/10 shadow-lg shadow-cyan/20'
                      : option.available
                        ? 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800/70'
                        : 'border-slate-800 bg-slate-900/50 opacity-40 cursor-not-allowed'
                  }
                `}
                disabled={!option.available}
                key={option.type}
                onClick={() => setWalletType(option.type)}
              >
                <div className="flex flex-col items-center space-y-2">
                  <option.icon
                    className={`w-6 h-6 ${
                      walletType === option.type
                        ? 'text-cyan'
                        : option.available
                          ? 'text-slate-400'
                          : 'text-slate-600'
                    }`}
                  />
                  <span
                    className={`text-sm font-medium ${
                      walletType === option.type
                        ? 'text-cyan'
                        : option.available
                          ? 'text-slate-300'
                          : 'text-slate-600'
                    }`}
                  >
                    {option.label}
                  </span>
                  {!option.available && (
                    <span className="text-xs text-slate-500">
                      Not available
                    </span>
                  )}
                </div>
                {walletType === option.type && (
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan/5 to-blue-500/5 pointer-events-none" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Action-specific content will be rendered here */}
        <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700">
          <div className="text-center text-slate-400 py-8">
            <p className="text-sm">
              {action === 'deposit' ? 'Deposit' : 'Withdraw'} via{' '}
              {walletType === 'onchain'
                ? 'On-Chain'
                : walletType === 'lightning'
                  ? 'Lightning'
                  : 'Spark'}
            </p>
            <p className="text-xs mt-2 text-slate-500">
              Content will be loaded based on selection
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button className="flex-1" onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button className="flex-1" variant="primary">
            Continue
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white">Wallet Actions</h2>
            {/* Action Toggle */}
            <div className="flex bg-slate-800/50 rounded-lg p-1 border border-slate-700">
              <button
                className={`
                  px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200
                  ${
                    action === 'deposit'
                      ? 'bg-green-500/20 text-green-400 shadow-lg shadow-green-500/10'
                      : 'text-slate-400 hover:text-slate-300'
                  }
                `}
                onClick={() => handleActionToggle('deposit')}
              >
                <ArrowDownRight className="w-4 h-4 inline mr-1.5" />
                Deposit
              </button>
              <button
                className={`
                  px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200
                  ${
                    action === 'withdraw'
                      ? 'bg-red-500/20 text-red-400 shadow-lg shadow-red-500/10'
                      : 'text-slate-400 hover:text-slate-300'
                  }
                `}
                onClick={() => handleActionToggle('withdraw')}
              >
                <ArrowUpRight className="w-4 h-4 inline mr-1.5" />
                Withdraw
              </button>
            </div>
          </div>
          <button
            className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-lg"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">{renderActionContent()}</div>
      </div>
    </div>
  )
}
