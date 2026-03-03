import { AlertTriangle, Zap, Link as ChainIcon } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => !isProcessing && onClose()}
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="bg-surface-base rounded-2xl border border-border-subtle p-6 max-w-md w-full">
          {isProcessing ? (
            <div className="flex flex-col items-center py-6">
              <div className="w-16 h-16 mb-4">
                <div
                  className="w-full h-full border-4 border-blue-500/30 border-t-blue-500
                              rounded-full animate-spin"
                />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                {t('orderChannel.step3.processingPayment')}
              </h3>
              <p className="text-content-secondary text-center">
                {t('orderChannel.step3.processingWait')}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-yellow-500" />
                <h3 className="text-xl font-bold text-white">
                  {t('orderChannel.step3.confirmPayment')}
                </h3>
              </div>
              <div className="space-y-4">
                {/* Payment Details Section */}
                <div className="bg-surface-overlay/50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-content-secondary">
                      {t('orderChannel.step3.paymentType')}:
                    </span>
                    <span className="text-white font-medium flex items-center gap-2">
                      {paymentMethod === 'lightning' ? (
                        <>
                          <Zap className="w-4 h-4 text-yellow-500" />
                          {t('orderChannel.step3.lightning')}
                        </>
                      ) : (
                        <>
                          <ChainIcon className="w-4 h-4 text-blue-500" />
                          {t('orderChannel.step3.onchain')}
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Balance Section */}
                <div className="bg-surface-overlay/50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-content-secondary">
                      {paymentMethod === 'lightning'
                        ? t('orderChannel.step3.maxSendable')
                        : t('orderChannel.step3.availableBalance')}
                      :
                    </span>
                    <span className="text-white font-medium">
                      {paymentMethod === 'lightning'
                        ? `${formatBitcoinAmount(outboundLiquidity, bitcoinUnit)}`
                        : `${formatBitcoinAmount(onChainBalance, bitcoinUnit)}`}{' '}
                      {bitcoinUnit}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-content-secondary">
                      {t('orderChannel.step3.amountToPay')}:
                    </span>
                    <span className="text-white font-medium">
                      {formatBitcoinAmount(
                        currentPayment?.order_total_sat || 0,
                        bitcoinUnit
                      )}{' '}
                      {bitcoinUnit}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-content-secondary">
                      {t('orderChannel.step3.remainingBalance')}:
                    </span>
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
                  <div className="bg-surface-overlay/50 rounded-xl p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-content-secondary">
                        {t('orderChannel.step3.feeRate')}:
                      </span>
                      <span className="text-white font-medium">
                        {selectedFee === 'custom'
                          ? `${customFee} ${t('orderChannel.feeUnit')}`
                          : `${feeRates.find((rate) => rate.value === selectedFee)?.rate} ${t('orderChannel.feeUnit')}`}
                      </span>
                    </div>
                  </div>
                )}

                <div className="border-t border-border-subtle my-4" />
                <p className="text-yellow-500/80 text-sm">
                  {t('orderChannel.step3.verifyDetails')}
                </p>
                <div className="flex gap-3 mt-6">
                  <button
                    className="flex-1 py-3 px-4 rounded-xl border border-border-default
                             text-content-secondary hover:bg-surface-overlay transition-colors"
                    onClick={onClose}
                    type="button"
                  >
                    {t('orderChannel.step3.cancel')}
                  </button>
                  <button
                    className="flex-1 py-3 px-4 bg-primary hover:bg-primary-emphasis
                             text-primary-foreground rounded-xl font-medium transition-colors"
                    onClick={onConfirm}
                    type="button"
                  >
                    {t('orderChannel.step3.confirmPayment')}
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
