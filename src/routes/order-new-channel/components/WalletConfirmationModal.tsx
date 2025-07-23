import { AlertTriangle, Zap, Link as ChainIcon } from 'lucide-react'
import React from 'react'

import { formatBitcoinAmount } from '../../../helpers/number'

interface WalletConfirmationModalProps {
  isOpen: boolean
  isProcessing: boolean
  paymentMethod: 'lightning' | 'onchain'
  currentPayment: any
  bitcoinUnit: string
  outboundLiquidity: number
  onChainBalance: number
  selectedFee: string
  customFee: number
  feeRates: Array<{ label: string; rate: number; value: string }>
  onClose: () => void
  onConfirm: () => void
}

export const WalletConfirmationModal: React.FC<
  WalletConfirmationModalProps
> = ({
  isOpen,
  isProcessing,
  paymentMethod,
  currentPayment,
  bitcoinUnit,
  outboundLiquidity,
  onChainBalance,
  selectedFee,
  customFee,
  feeRates,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => !isProcessing && onClose()}
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 max-w-md w-full">
          {isProcessing ? (
            <div className="flex flex-col items-center py-6">
              <div className="w-16 h-16 mb-4">
                <div
                  className="w-full h-full border-4 border-blue-500/30 border-t-blue-500 
                              rounded-full animate-spin"
                />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                Processing Payment
              </h3>
              <p className="text-slate-400 text-center">
                Please wait while we process your payment...
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-yellow-500" />
                <h3 className="text-xl font-bold text-white">
                  Confirm Payment
                </h3>
              </div>
              <div className="space-y-4">
                {/* Payment Details Section */}
                <div className="bg-slate-800/50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Payment Type:</span>
                    <span className="text-white font-medium flex items-center gap-2">
                      {paymentMethod === 'lightning' ? (
                        <>
                          <Zap className="w-4 h-4 text-yellow-500" />
                          Lightning
                        </>
                      ) : (
                        <>
                          <ChainIcon className="w-4 h-4 text-blue-500" />
                          On-chain
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Balance Section */}
                <div className="bg-slate-800/50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">
                      {paymentMethod === 'lightning'
                        ? 'Max Sendable:'
                        : 'Available Balance:'}
                    </span>
                    <span className="text-white font-medium">
                      {paymentMethod === 'lightning'
                        ? `${formatBitcoinAmount(outboundLiquidity, bitcoinUnit)}`
                        : `${formatBitcoinAmount(onChainBalance, bitcoinUnit)}`}{' '}
                      {bitcoinUnit}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Amount to Pay:</span>
                    <span className="text-white font-medium">
                      {formatBitcoinAmount(
                        currentPayment?.order_total_sat || 0,
                        bitcoinUnit
                      )}{' '}
                      {bitcoinUnit}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Remaining Balance:</span>
                    <span className="text-white font-medium">
                      {formatBitcoinAmount(
                        paymentMethod === 'lightning'
                          ? outboundLiquidity -
                              (currentPayment?.order_total_sat || 0)
                          : onChainBalance -
                              (currentPayment?.order_total_sat || 0),
                        bitcoinUnit
                      )}{' '}
                      {bitcoinUnit}
                    </span>
                  </div>
                </div>

                {/* Fee Section - Only for on-chain */}
                {paymentMethod === 'onchain' && (
                  <div className="bg-slate-800/50 rounded-xl p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Fee Rate:</span>
                      <span className="text-white font-medium">
                        {selectedFee === 'custom'
                          ? `${customFee} sat/vB`
                          : `${feeRates.find((rate) => rate.value === selectedFee)?.rate} sat/vB`}
                      </span>
                    </div>
                  </div>
                )}

                <div className="border-t border-slate-800 my-4" />
                <p className="text-yellow-500/80 text-sm">
                  Please verify all details before confirming. This action
                  cannot be undone.
                </p>
                <div className="flex gap-3 mt-6">
                  <button
                    className="flex-1 py-3 px-4 rounded-xl border border-slate-700
                             text-slate-300 hover:bg-slate-800 transition-colors"
                    onClick={onClose}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700
                             text-white rounded-xl font-medium transition-colors"
                    onClick={onConfirm}
                    type="button"
                  >
                    Confirm Payment
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
