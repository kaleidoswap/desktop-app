import { Link as ChainIcon, Wallet, X, Zap } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { formatBitcoinAmount } from '../../../helpers/number'

import { FeeSelector } from './FeeSelector'

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

  if (!isOpen) return null

  const lightningAvailable = lightningAmountSat > 0
  const onchainAvailable = onchainAmountSat > 0
  const hasLightningBalance = outboundLiquidity >= lightningAmountSat
  const hasOnchainBalance = onChainBalance >= onchainAmountSat

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => !isProcessing && onClose()}
      />

      <div className="absolute inset-0 overflow-y-auto px-4 py-8 flex items-center justify-center">
        <div className="w-full max-w-2xl rounded-[28px] border border-border-subtle bg-surface-base/95 shadow-[0_30px_100px_rgba(2,6,23,0.6)]">
          <div className="flex items-start justify-between border-b border-border-subtle px-6 py-5">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-content-tertiary">
                  {t('components.buyChannelModal.walletEyebrow')}
                </p>
                <h3 className="mt-2 text-xl font-semibold text-content-primary">
                  {t('orderChannel.step3.payWithWallet')}
                </h3>
                <p className="mt-2 text-sm text-content-secondary">
                  {t('components.buyChannelModal.walletDescription')}
                </p>
              </div>
            </div>

            <button
              className="rounded-xl border border-border-subtle bg-surface-overlay/60 p-2 text-content-secondary transition-colors hover:text-content-primary"
              onClick={onClose}
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 px-6 py-5">
            {isProcessing ? (
              <div className="flex flex-col items-center justify-center py-10">
                <div className="h-14 w-14 rounded-full border-4 border-cyan-400/20 border-t-cyan-300 animate-spin" />
                <p className="mt-5 text-lg font-medium text-content-primary">
                  {t('orderChannel.step3.processingPayment')}
                </p>
                <p className="mt-2 text-sm text-content-secondary">
                  {t('orderChannel.step3.processingWait')}
                </p>
              </div>
            ) : (
              <>
                {lightningAvailable && (
                  <div
                    className={`rounded-[24px] border p-5 ${
                      hasLightningBalance
                        ? 'border-cyan-400/20 bg-cyan-400/8'
                        : 'border-border-subtle bg-surface-overlay/40'
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/12 text-cyan-200">
                          <Zap className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-content-primary">
                            {t('orderChannel.step3.lightning')}
                          </p>
                          <p className="mt-1 text-sm text-content-secondary">
                            {t(
                              'components.buyChannelModal.walletLightningDescription'
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[320px]">
                        <div className="rounded-2xl border border-border-subtle bg-surface-base/50 px-4 py-3">
                          <p className="text-[11px] uppercase tracking-[0.26em] text-content-tertiary">
                            {t('components.buyChannelModal.availableLabel')}
                          </p>
                          <p className="mt-2 text-base font-semibold text-content-primary">
                            {formatBitcoinAmount(
                              outboundLiquidity,
                              bitcoinUnit
                            )}{' '}
                            {bitcoinUnit}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border-subtle bg-surface-base/50 px-4 py-3">
                          <p className="text-[11px] uppercase tracking-[0.26em] text-content-tertiary">
                            {t('components.buyChannelModal.paymentLabel')}
                          </p>
                          <p className="mt-2 text-base font-semibold text-cyan-200">
                            {formatBitcoinAmount(
                              lightningAmountSat,
                              bitcoinUnit
                            )}{' '}
                            {bitcoinUnit}
                          </p>
                        </div>
                      </div>
                    </div>

                    {!hasLightningBalance && (
                      <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/8 px-3 py-2">
                        <p className="text-sm font-medium text-amber-100">
                          {t('components.buyChannelModal.balanceNeededTitle')}
                        </p>
                        <p className="mt-1 text-sm text-amber-100/80">
                          {t(
                            'components.buyChannelModal.balanceNeededDescription'
                          )}
                        </p>
                      </div>
                    )}

                    <button
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-emphasis disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={!hasLightningBalance}
                      onClick={() => onPay('lightning')}
                      type="button"
                    >
                      <Zap className="h-4 w-4" />
                      {t('orderChannel.step3.pay')}{' '}
                      {formatBitcoinAmount(lightningAmountSat, bitcoinUnit)}{' '}
                      {bitcoinUnit}
                    </button>
                  </div>
                )}

                {onchainAvailable && (
                  <div
                    className={`rounded-[24px] border p-5 ${
                      hasOnchainBalance
                        ? 'border-amber-400/20 bg-amber-400/8'
                        : 'border-border-subtle bg-surface-overlay/40'
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/12 text-amber-200">
                          <ChainIcon className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-content-primary">
                            {t('orderChannel.step3.onchain')}
                          </p>
                          <p className="mt-1 text-sm text-content-secondary">
                            {t(
                              'components.buyChannelModal.walletOnchainDescription'
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[320px]">
                        <div className="rounded-2xl border border-border-subtle bg-surface-base/50 px-4 py-3">
                          <p className="text-[11px] uppercase tracking-[0.26em] text-content-tertiary">
                            {t('components.buyChannelModal.availableLabel')}
                          </p>
                          <p className="mt-2 text-base font-semibold text-content-primary">
                            {formatBitcoinAmount(onChainBalance, bitcoinUnit)}{' '}
                            {bitcoinUnit}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border-subtle bg-surface-base/50 px-4 py-3">
                          <p className="text-[11px] uppercase tracking-[0.26em] text-content-tertiary">
                            {t('components.buyChannelModal.paymentLabel')}
                          </p>
                          <p className="mt-2 text-base font-semibold text-amber-200">
                            {formatBitcoinAmount(onchainAmountSat, bitcoinUnit)}{' '}
                            {bitcoinUnit}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <FeeSelector
                        customFee={customFee}
                        onCustomFeeChange={onCustomFeeChange}
                        onFeeChange={onFeeChange}
                        selectedFee={selectedFee}
                      />
                    </div>

                    {!hasOnchainBalance && (
                      <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/8 px-3 py-2">
                        <p className="text-sm font-medium text-amber-100">
                          {t('components.buyChannelModal.balanceNeededTitle')}
                        </p>
                        <p className="mt-1 text-sm text-amber-100/80">
                          {t(
                            'components.buyChannelModal.balanceNeededDescription'
                          )}
                        </p>
                      </div>
                    )}

                    <button
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={!hasOnchainBalance}
                      onClick={() => onPay('onchain')}
                      type="button"
                    >
                      <ChainIcon className="h-4 w-4" />
                      {t('orderChannel.step3.pay')}{' '}
                      {formatBitcoinAmount(onchainAmountSat, bitcoinUnit)}{' '}
                      {bitcoinUnit}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
