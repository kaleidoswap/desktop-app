import React, { useEffect, useState } from 'react'

import { BTC_ASSET_ID } from '../../../../../constants'
import {
  formatBitcoinAmount,
  msatToSat,
  formatAssetAmountWithPrecision,
  formatNumberWithCommas,
} from '../../../../../helpers/number'
import { ConfirmationModalProps, HTLCStatus, AssetOption } from '../types'

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  pendingData,
  availableAssets,
  bitcoinUnit,
  feeRates,
  customFee,
  assets,
  isConfirming,
  onCancel,
  onConfirm,
  validationError,
  paymentStatus,
  isPollingStatus,
}) => {
  const decodedInvoice = pendingData?.decodedInvoice
  const isLightningPayment = pendingData?.network === 'lightning'
  const isRgbLightningPayment =
    isLightningPayment &&
    decodedInvoice?.asset_amount &&
    decodedInvoice?.asset_id
  const hasRegularBtcAmount =
    isLightningPayment && decodedInvoice?.amt_msat && !decodedInvoice?.asset_id

  const [showOverlay, setShowOverlay] = useState(false)

  useEffect(() => {
    async function handleShowOverlay() {
      if (paymentStatus === HTLCStatus.Failed) {
        setShowOverlay(true)
        await new Promise((resolve) => setTimeout(resolve, 3000))
        setShowOverlay(false)
      }
    }

    handleShowOverlay()
  }, [paymentStatus])

  const getBtcAmount = () => {
    if (!decodedInvoice?.amt_msat) return null

    const amountSats = msatToSat(decodedInvoice.amt_msat)
    return formatBitcoinAmount(amountSats, bitcoinUnit)
  }

  // Helper to format asset amounts with precision
  const getAssetAmount = (amount: number, assetId: string) => {
    if (assetId === BTC_ASSET_ID) {
      // For BTC, amount is already in display units
      return formatBitcoinAmount(
        bitcoinUnit === 'SAT' ? amount : amount * 100000000,
        bitcoinUnit
      )
    }

    // For RGB assets, format with precision
    const assetInfo = assets.data?.nia.find((a: any) => a.asset_id === assetId)
    const ticker = assetInfo?.ticker || 'Unknown'

    return formatAssetAmountWithPrecision(
      amount,
      ticker,
      bitcoinUnit,
      assets.data?.nia
    )
  }

  const renderOverlay = () => {
    if (!showOverlay) return null

    if (paymentStatus === HTLCStatus.Failed) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-800 border border-red-500/20 rounded-2xl p-6 max-w-sm mx-auto text-center shadow-xl animate-scaleIn">
            <div className="w-16 h-16 mx-auto bg-red-500/10 rounded-full flex items-center justify-center mb-4">
              <svg
                className="h-10 w-10 text-red-400"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  clipRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  fillRule="evenodd"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Payment Failed
            </h2>
            <p className="text-slate-300 mb-6">
              Your lightning payment could not be processed.
            </p>
            <div className="text-sm text-slate-400 animate-pulse">
              Closing automatically...
            </div>
          </div>
        </div>
      )
    }

    return null
  }

  const renderPaymentStatus = () => {
    if (!isLightningPayment) return null

    if (isPollingStatus) {
      return (
        <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <div className="text-blue-400 text-sm">
              <p>Checking payment status... This may take a moment.</p>
            </div>
          </div>
        </div>
      )
    }

    if (paymentStatus === HTLCStatus.Pending) {
      return (
        <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
          <div className="flex items-start gap-2">
            <div className="text-blue-400 text-sm">
              <p>
                Payment is in progress. Please wait while the Lightning Network
                processes your payment.
              </p>
            </div>
          </div>
        </div>
      )
    }

    if (paymentStatus === HTLCStatus.Failed) {
      return (
        <div className="p-4 bg-red-500/10 rounded-xl border border-red-500/20">
          <div className="flex items-start gap-3">
            <div className="bg-red-500/20 rounded-full p-2 flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  clipRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  fillRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-red-400 font-semibold text-sm mb-1">
                Payment Failed
              </h3>
              <p className="text-red-300 text-xs">
                Your Lightning payment could not be processed. Please check the
                error details below.
              </p>
            </div>
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <>
      {renderOverlay()}

      <div className="space-y-4">
        <div className="p-3 bg-slate-800/50 rounded-xl">
          <div className="space-y-2 divide-y divide-slate-700/50">
            {/* Type */}
            <div className="flex justify-between py-2">
              <span className="text-slate-400 text-sm">Type:</span>
              <span className="text-white text-sm">
                {isLightningPayment
                  ? 'Lightning Payment'
                  : 'On-chain Withdrawal'}
              </span>
            </div>

            {/* Asset */}
            <div className="flex justify-between py-2">
              <span className="text-slate-400 text-sm">Asset:</span>
              <span className="text-white text-sm">
                {availableAssets.find(
                  (a: AssetOption) => a.value === pendingData?.asset_id
                )?.label || 'Unknown'}
              </span>
            </div>

            {/* Amount - Only show for on-chain or for regular BTC Lightning payments */}
            {!isRgbLightningPayment && (
              <div className="flex justify-between py-2">
                <span className="text-slate-400 text-sm">Amount:</span>
                <span className="text-white text-sm font-medium">
                  {hasRegularBtcAmount
                    ? getBtcAmount()
                    : pendingData?.asset_id === BTC_ASSET_ID
                      ? `${pendingData?.amount && pendingData?.asset_id ? getAssetAmount(Number(pendingData.amount), pendingData.asset_id) : pendingData?.amount} ${availableAssets.find((a: AssetOption) => a.value === pendingData?.asset_id)?.label}`
                      : `${formatNumberWithCommas(String(pendingData?.amount || '0'))} ${availableAssets.find((a: AssetOption) => a.value === pendingData?.asset_id)?.label}`}
                </span>
              </div>
            )}

            {/* BTC Amount (only if Lightning payment with asset_id and asset_amount) */}
            {isRgbLightningPayment && decodedInvoice?.amt_msat && (
              <div className="flex justify-between py-2">
                <span className="text-slate-400 text-sm">BTC Amount:</span>
                <span className="text-white text-sm font-medium">
                  {getBtcAmount()}
                </span>
              </div>
            )}

            {/* Donation Status (only for RGB transfers) */}
            {pendingData?.network === 'on-chain' && pendingData?.donation && (
              <div className="flex justify-between py-2">
                <span className="text-slate-400 text-sm">Transfer Type:</span>
                <span className="text-blue-400 text-sm font-medium flex items-center gap-1">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                  Gift/Donation
                </span>
              </div>
            )}

            {/* Payment Hash (if Lightning) */}
            {isLightningPayment && decodedInvoice?.payment_hash && (
              <div className="flex justify-between py-2">
                <span className="text-slate-400 text-sm">Payment Hash:</span>
                <span className="text-white text-sm font-mono break-all max-w-[70%] text-right">
                  {decodedInvoice.payment_hash.slice(0, 8)}...
                  {decodedInvoice.payment_hash.slice(-8)}
                </span>
              </div>
            )}

            {/* Asset ID (if RGB Lightning) */}
            {isLightningPayment && decodedInvoice?.asset_id && (
              <div className="flex justify-between py-2">
                <span className="text-slate-400 text-sm">Asset ID:</span>
                <span className="text-white text-sm font-mono break-all max-w-[70%] text-right">
                  {decodedInvoice.asset_id.slice(0, 8)}...
                  {decodedInvoice.asset_id.slice(-8)}
                </span>
              </div>
            )}

            {/* Asset Amount (if RGB Lightning) */}
            {isLightningPayment &&
              decodedInvoice?.asset_amount &&
              decodedInvoice?.asset_id && (
                <div className="flex justify-between py-2">
                  <span className="text-slate-400 text-sm">Asset Amount:</span>
                  <span className="text-white text-sm font-medium">
                    {getAssetAmount(
                      decodedInvoice.asset_amount,
                      decodedInvoice.asset_id
                    )}{' '}
                    {availableAssets.find(
                      (a: AssetOption) => a.value === decodedInvoice?.asset_id
                    )?.label || 'Unknown'}
                  </span>
                </div>
              )}

            {/* Fee (for BTC only) */}
            {pendingData?.asset_id === BTC_ASSET_ID &&
              pendingData?.network === 'on-chain' && (
                <div className="flex justify-between py-2">
                  <span className="text-slate-400 text-sm">Fee Rate:</span>
                  <span className="text-white text-sm">
                    {pendingData?.fee_rate === 'custom'
                      ? `${customFee} sat/vB (Custom)`
                      : `${
                          feeRates.find(
                            (f) => f.value === pendingData?.fee_rate
                          )?.rate
                        } sat/vB (${
                          pendingData?.fee_rate.charAt(0).toUpperCase() +
                          pendingData?.fee_rate.slice(1)
                        })`}
                  </span>
                </div>
              )}

            {/* Destination */}
            <div className="flex justify-between py-2">
              <span className="text-slate-400 text-sm">
                {isLightningPayment ? 'Invoice:' : 'Address:'}
              </span>
              <span className="text-white text-sm font-mono break-all max-w-[70%] text-right">
                {pendingData?.address && pendingData.address.length > 30
                  ? `${pendingData.address.slice(0, 15)}...${pendingData.address.slice(-15)}`
                  : pendingData?.address}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Status for Lightning payments */}
        {isLightningPayment && renderPaymentStatus()}

        {/* RGB asset notice */}
        {pendingData?.asset_id !== BTC_ASSET_ID && (
          <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <div className="flex items-start gap-2">
              <div className="text-blue-400 text-xs">
                <p>
                  This is an RGB asset transfer. The process may take a few
                  minutes to complete and requires recipient acknowledgment.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Display Validation Error if present */}
        {validationError && (
          <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/30 text-red-400 text-sm">
            <p>
              <strong>Error:</strong> {validationError}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 mt-4">
          <button
            className="flex-1 px-4 py-2.5 border border-slate-700 hover:bg-slate-800/50
                     text-slate-300 rounded-lg transition-colors text-sm"
            disabled={isConfirming || showOverlay}
            onClick={onCancel}
            type="button"
          >
            Back
          </button>
          <button
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900
                     text-white rounded-lg transition-colors flex items-center justify-center
                     gap-2 disabled:cursor-not-allowed text-sm"
            disabled={
              isConfirming ||
              isPollingStatus ||
              paymentStatus === HTLCStatus.Succeeded ||
              paymentStatus === HTLCStatus.Failed ||
              showOverlay
            }
            onClick={onConfirm}
            type="button"
          >
            {isConfirming ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Confirm</span>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  )
}

export { ConfirmationModal }
