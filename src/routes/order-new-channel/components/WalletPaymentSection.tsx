import { AlertTriangle } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const hasBalanceData =
    !isLoadingData &&
    typeof outboundLiquidity === 'number' &&
    typeof onChainBalance === 'number'

  if (!hasBalanceData) {
    return (
      <div className="flex items-center justify-center gap-3 p-8">
        <ClipLoader color="#3B82F6" size={24} />
        <span className="text-content-secondary">
          {t('orderChannel.step3.loadingBalance')}
        </span>
      </div>
    )
  }

  // Hide the entire "Pay with Wallet" section if using lightning and no outbound liquidity
  const hasNoLightningLiquidity =
    paymentMethod === 'lightning' && outboundLiquidity <= 0

  if (hasNoLightningLiquidity) {
    return null
  }

  const insufficientBalance =
    paymentMethod === 'lightning'
      ? outboundLiquidity < (currentPayment?.order_total_sat || 0)
      : onChainBalance < (currentPayment?.order_total_sat || 0)

  return (
    <div className="mb-6">
      {/* Balance Header */}
      <div className="flex items-center justify-between mb-4 p-4 bg-surface-base/50 rounded-xl">
        <label className="flex items-center space-x-3">
          <input
            checked={useWalletFunds}
            className="form-checkbox h-5 w-5 text-blue-500 rounded border-border-default bg-surface-high disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={insufficientBalance}
            onChange={(e) => onUseWalletFundsChange(e.target.checked)}
            type="checkbox"
          />
          <span
            className={`font-medium ${insufficientBalance ? 'text-content-tertiary' : 'text-white'}`}
          >
            {t('orderChannel.step3.payWithWallet')}
          </span>
        </label>
        <div className="text-right">
          <div className="text-sm text-content-secondary">
            {paymentMethod === 'lightning'
              ? t('orderChannel.step3.maxSendable')
              : t('orderChannel.step3.available')}
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
                {t('orderChannel.step3.insufficientBalance')}
              </h4>
              <p className="text-content-secondary text-xs mt-1">
                {t('orderChannel.step3.required')}:{' '}
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
            className="w-full px-6 py-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 font-medium bg-primary hover:bg-primary-emphasis text-primary-foreground"
            onClick={onPayClick}
          >
            <span>{paymentMethod === 'lightning' ? '⚡' : '₿'}</span>
            {t('orderChannel.step3.pay')}{' '}
            {formatBitcoinAmount(
              currentPayment?.order_total_sat || 0,
              bitcoinUnit
            )}{' '}
            {bitcoinUnit}
            <span className="text-xs opacity-75">
              (
              {paymentMethod === 'lightning'
                ? t('orderChannel.step3.lightning')
                : t('orderChannel.step3.onchain')}
              )
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
