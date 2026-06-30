import {
  AlertTriangle,
  ArrowUpRight,
  Clock,
  Rocket,
  Settings,
  Wallet,
  X,
  Zap,
} from 'lucide-react'
import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { formatBitcoinAmount } from '../../../helpers/number'
import BitcoinLogo from '../../../assets/bitcoin-logo.svg'
import LightningLogo from '../../../assets/lightning-logo.svg'

interface WalletConfirmationModalProps {
  isOpen: boolean
  isProcessing: boolean
  bitcoinUnit: string
  outboundLiquidity: number
  onChainBalance: number
  lightningAmountSat?: number
  onchainAmountSat?: number
  selectedFee: string
  customFee: number
  onFeeChange: (fee: string) => void
  onCustomFeeChange: (fee: number) => void
  onClose: () => void
  onPay: (method: 'lightning' | 'onchain') => void
}

const feeOptions = [
  {
    icon: <Clock className="w-4 h-4" />,
    label: 'Slow',
    rate: '1 sat/vB',
    value: 'slow',
  },
  {
    icon: <Zap className="w-4 h-4" />,
    label: 'Normal',
    rate: '2 sat/vB',
    value: 'normal',
  },
  {
    icon: <Rocket className="w-4 h-4" />,
    label: 'Fast',
    rate: '3 sat/vB',
    value: 'fast',
  },
  {
    icon: <Settings className="w-4 h-4" />,
    label: 'Custom',
    rate: 'set rate',
    value: 'custom',
  },
]

export const WalletConfirmationModal: React.FC<
  WalletConfirmationModalProps
> = ({
  isOpen,
  isProcessing,
  bitcoinUnit,
  outboundLiquidity,
  onChainBalance,
  lightningAmountSat = 0,
  onchainAmountSat = 0,
  selectedFee,
  customFee,
  onFeeChange,
  onCustomFeeChange,
  onClose,
  onPay,
}) => {
  const { t } = useTranslation()
  const [selectedMethod, setSelectedMethod] = useState<
    'lightning' | 'onchain' | null
  >(null)

  if (!isOpen) return null
  if (typeof document === 'undefined') return null

  const lightningAvailable = lightningAmountSat > 0
  const onchainAvailable = onchainAmountSat > 0
  const hasLightningBalance = outboundLiquidity >= lightningAmountSat
  const hasOnchainBalance = onChainBalance >= onchainAmountSat

  const displayUnit = bitcoinUnit === 'SAT' ? 'SATS' : bitcoinUnit

  const canPay =
    selectedMethod === 'lightning'
      ? hasLightningBalance
      : selectedMethod === 'onchain'
        ? hasOnchainBalance
        : false

  const handleCardClick = (method: 'lightning' | 'onchain') => {
    setSelectedMethod((prev) => (prev === method ? null : method))
  }

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => !isProcessing && onClose()}
      />

      <div className="absolute inset-0 overflow-y-auto px-4 py-8 flex items-center justify-center">
        <div className="w-full max-w-lg rounded-2xl border border-border-default/40 bg-surface-overlay shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border-default/30">
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-primary" />
              <h3 className="text-base font-semibold text-white">
                {t('orderChannel.step3.payWithWallet')}
              </h3>
            </div>
            <button
              className="text-content-secondary hover:text-white p-1.5 rounded-lg hover:bg-surface-high/60 transition-colors"
              onClick={onClose}
              type="button"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="px-5 py-4 space-y-3">
            {isProcessing ? (
              <div className="flex flex-col items-center justify-center py-10">
                <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <p className="mt-4 text-sm font-medium text-content-primary">
                  {t('orderChannel.step3.processingPayment')}
                </p>
                <p className="mt-1 text-sm text-content-secondary">
                  {t('orderChannel.step3.processingWait')}
                </p>
              </div>
            ) : (
              <>
                {/* Lightning card */}
                {lightningAvailable && (
                  <div
                    className={`rounded-lg border p-3 flex flex-col gap-3 cursor-pointer transition-all duration-200 ${
                      selectedMethod === 'lightning'
                        ? 'border-primary bg-primary/10'
                        : 'border-border-default hover:border-primary/50'
                    }`}
                    onClick={() => handleCardClick('lightning')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img
                          alt="Lightning"
                          className="w-4 h-4 flex-shrink-0"
                          src={LightningLogo}
                        />
                        <span className="text-sm font-medium text-white">
                          Lightning
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-content-secondary">
                        <span>
                          {t('components.buyChannelModal.availableLabel')}:{' '}
                          <span className="text-white font-medium">
                            {formatBitcoinAmount(
                              outboundLiquidity,
                              bitcoinUnit
                            )}{' '}
                            {displayUnit}
                          </span>
                        </span>
                      </div>
                    </div>

                    {!hasLightningBalance && (
                      <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2.5">
                        <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                        <p className="text-xs text-yellow-200">
                          {t('components.buyChannelModal.balanceNeededTitle')}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Onchain card */}
                {onchainAvailable && (
                  <div
                    className={`rounded-lg border p-3 flex flex-col gap-3 cursor-pointer transition-all duration-200 ${
                      selectedMethod === 'onchain'
                        ? 'border-primary bg-primary/10'
                        : 'border-border-default hover:border-primary/50'
                    }`}
                    onClick={() => handleCardClick('onchain')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img
                          alt="Bitcoin"
                          className="w-4 h-4 flex-shrink-0"
                          src={BitcoinLogo}
                        />
                        <span className="text-sm font-medium text-white">
                          Onchain
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-content-secondary">
                        <span>
                          {t('components.buyChannelModal.availableLabel')}:{' '}
                          <span className="text-white font-medium">
                            {formatBitcoinAmount(onChainBalance, bitcoinUnit)}{' '}
                            {displayUnit}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Fee selector — shown when Onchain is selected */}
                    {selectedMethod === 'onchain' && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <label className="block text-xs font-medium text-content-secondary mb-2">
                          {t('orderChannel.step3.feeRateLabel')}
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                          {feeOptions.map(({ value, label, icon, rate }) => (
                            <button
                              className={`py-1.5 px-2 flex flex-col items-center justify-center gap-0.5 rounded-lg transition-all duration-200 border text-xs ${
                                selectedFee === value
                                  ? 'bg-primary/10 border-primary text-primary'
                                  : 'border-white/20 hover:border-primary/50 text-content-secondary'
                              }`}
                              key={value}
                              onClick={() => onFeeChange(value)}
                              type="button"
                            >
                              {icon}
                              <span className="text-[10px]">{label}</span>
                              <span className="text-[9px]">
                                {value === 'custom' && selectedFee === 'custom'
                                  ? `${customFee} sat/vB`
                                  : rate}
                              </span>
                            </button>
                          ))}
                        </div>
                        {selectedFee === 'custom' && (
                          <div className="mt-2">
                            <input
                              className="w-full px-3 py-2 bg-surface-overlay/50 rounded-xl border border-border-default focus:border-primary/60 focus:ring-1 focus:ring-primary/30 focus:outline-none text-white text-sm"
                              min={0.1}
                              onChange={(e) =>
                                onCustomFeeChange(
                                  parseFloat(e.target.value) || 1
                                )
                              }
                              step={0.1}
                              type="number"
                              value={customFee}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {!hasOnchainBalance && (
                      <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2.5">
                        <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                        <p className="text-xs text-yellow-200">
                          {t('components.buyChannelModal.balanceNeededTitle')}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Single pay button */}
                <button
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-[#12131C] transition-colors hover:bg-primary-emphasis disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!selectedMethod || !canPay}
                  onClick={() => selectedMethod && onPay(selectedMethod)}
                  type="button"
                >
                  <ArrowUpRight className="h-4 w-4" />
                  {t('orderChannel.step3.pay')}
                  {selectedMethod && (
                    <>
                      {' '}
                      {formatBitcoinAmount(
                        selectedMethod === 'lightning'
                          ? lightningAmountSat
                          : onchainAmountSat,
                        bitcoinUnit
                      )}{' '}
                      {displayUnit}
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
