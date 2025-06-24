import { AlertTriangle } from 'lucide-react'
import React from 'react'
import { ClipLoader } from 'react-spinners'

import { formatBitcoinAmount } from '../../../helpers/number'

import { FeeSelector } from './FeeSelector'

interface WalletPaymentSectionProps {
  useWalletFunds: boolean
  onUseWalletFundsChange: (value: boolean) => void
  paymentMethod: 'lightning' | 'onchain'
  outboundLiquidity: number
  onChainBalance: number
  currentPayment: any
  bitcoinUnit: string
  isLoadingData: boolean
  selectedFee: string
  customFee: number
  onFeeChange: (fee: string) => void
  onCustomFeeChange: (fee: number) => void
  onPayClick: () => void
}

export const WalletPaymentSection: React.FC<WalletPaymentSectionProps> = ({
  useWalletFunds,
  onUseWalletFundsChange,
  paymentMethod,
  outboundLiquidity,
  onChainBalance,
  currentPayment,
  bitcoinUnit,
  isLoadingData,
  selectedFee,
  customFee,
  onFeeChange,
  onCustomFeeChange,
  onPayClick,
}) => {
  const hasBalanceData =
    !isLoadingData &&
    typeof outboundLiquidity === 'number' &&
    typeof onChainBalance === 'number'

  if (!hasBalanceData) {
    return (
      <div className="flex items-center justify-center gap-3 p-8">
        <ClipLoader color="#3B82F6" size={24} />
        <span className="text-gray-400">Loading wallet balance...</span>
      </div>
    )
  }

  const insufficientBalance =
    paymentMethod === 'lightning'
      ? outboundLiquidity < (currentPayment?.order_total_sat || 0)
      : onChainBalance < (currentPayment?.order_total_sat || 0)

  return (
    <div className="mb-6">
      {/* Balance Header */}
      <div className="flex items-center justify-between mb-4 p-4 bg-gray-900/50 rounded-xl">
        <label className="flex items-center space-x-3">
          <input
            checked={useWalletFunds}
            className="form-checkbox h-5 w-5 text-blue-500 rounded border-gray-600 bg-gray-700"
            onChange={(e) => onUseWalletFundsChange(e.target.checked)}
            type="checkbox"
          />
          <span className="text-white font-medium">Pay with Wallet</span>
        </label>
        <div className="text-right">
          <div className="text-sm text-gray-400">
            {paymentMethod === 'lightning' ? 'Max Sendable' : 'Available'}
          </div>
          <div className="text-white font-medium">
            {formatBitcoinAmount(
              paymentMethod === 'lightning'
                ? outboundLiquidity
                : onChainBalance,
              bitcoinUnit
            )}{' '}
            {bitcoinUnit}
          </div>
        </div>
      </div>

      {/* Insufficient Balance Warning */}
      {insufficientBalance && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div>
              <h4 className="text-red-500 font-medium text-sm">
                Insufficient Balance
              </h4>
              <p className="text-gray-400 text-xs mt-1">
                Required:{' '}
                {formatBitcoinAmount(
                  currentPayment?.order_total_sat || 0,
                  bitcoinUnit
                )}{' '}
                {bitcoinUnit}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Payment Controls */}
      {useWalletFunds && !insufficientBalance && (
        <div className="space-y-4">
          {/* Fee Selection for On-chain */}
          {paymentMethod === 'onchain' && (
            <FeeSelector
              customFee={customFee}
              onCustomFeeChange={onCustomFeeChange}
              onFeeChange={onFeeChange}
              selectedFee={selectedFee}
            />
          )}

          {/* Pay Button */}
          <button
            className="w-full px-6 py-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 font-medium bg-blue-500 hover:bg-blue-600 text-white"
            onClick={onPayClick}
          >
            <span>{paymentMethod === 'lightning' ? '⚡' : '₿'}</span>
            Pay{' '}
            {formatBitcoinAmount(
              currentPayment?.order_total_sat || 0,
              bitcoinUnit
            )}{' '}
            {bitcoinUnit}
            <span className="text-xs opacity-75">
              ({paymentMethod === 'lightning' ? 'Lightning' : 'On-chain'})
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
