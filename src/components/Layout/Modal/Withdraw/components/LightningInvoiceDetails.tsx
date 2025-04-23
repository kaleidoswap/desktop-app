import { AlertTriangle, CheckCircle } from 'lucide-react'
import React from 'react'

import { formatAssetAmountWithPrecision } from '../../../../../helpers/number'
import { NiaAsset } from '../../../../../slices/nodeApi/nodeApi.slice'
import { LightningInvoiceDetailsProps } from '../types'

const LightningInvoiceDetails: React.FC<LightningInvoiceDetailsProps> = ({
  decodedInvoice,
  assets,
  bitcoinUnit,
  maxLightningCapacity,
}) => {
  if (!decodedInvoice) return null

  const hasAsset = decodedInvoice.asset_id && decodedInvoice.asset_amount

  const assetInfo = hasAsset
    ? assets.data?.nia.find(
        (asset: NiaAsset) => asset.asset_id === decodedInvoice.asset_id
      )
    : null
  const ticker = assetInfo?.ticker || 'Unknown'

  const formattedAssetAmount =
    hasAsset && decodedInvoice.asset_amount
      ? formatAssetAmountWithPrecision(
          decodedInvoice.asset_amount,
          ticker,
          bitcoinUnit,
          assets.data?.nia
        )
      : null

  const formattedAssetBalance =
    hasAsset && assetInfo
      ? formatAssetAmountWithPrecision(
          assetInfo.balance.offchain_outbound || 0,
          ticker,
          bitcoinUnit,
          assets.data?.nia
        )
      : '0'

  const invoiceAmountSats = decodedInvoice.amt_msat / 1000
  const maxCapacitySats = maxLightningCapacity / 1000

  const capacityPercentage =
    maxCapacitySats > 0
      ? Math.min(100, Math.round((invoiceAmountSats / maxCapacitySats) * 100))
      : 0

  const getColorClass = (percentage: number) => {
    if (percentage > 90) return 'text-red-500'
    if (percentage > 70) return 'text-yellow-500'
    return 'text-green-500'
  }

  const getProgressBarColor = (percentage: number) => {
    if (percentage > 90) return 'bg-red-500'
    if (percentage > 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const isCapacityExceeded = decodedInvoice.amt_msat > maxLightningCapacity

  const isAssetBalanceExceeded =
    hasAsset && assetInfo
      ? decodedInvoice.asset_amount! >
        (assetInfo.balance.offchain_outbound || 0)
      : false

  return (
    <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
      <h4 className="text-blue-400 text-sm font-medium mb-2">
        Lightning Invoice Details
      </h4>
      <div className="space-y-2 text-xs">
        {hasAsset && (
          <>
            <div className="flex justify-between">
              <span className="text-slate-400">Asset:</span>
              <div className="flex items-center">
                <span className="text-white font-medium">{ticker}</span>
                <span className="text-slate-500 ml-1">
                  ({decodedInvoice.asset_id!.slice(0, 8)}...
                  {decodedInvoice.asset_id!.slice(-4)})
                </span>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Asset Amount:</span>
              <span className="text-white font-bold">
                {formattedAssetAmount} {ticker}
              </span>
            </div>
            {assetInfo && (
              <div className="flex justify-between">
                <span className="text-slate-400">Your Lightning Balance:</span>
                <span
                  className={`font-medium ${!isAssetBalanceExceeded ? 'text-green-400' : 'text-red-400'}`}
                >
                  {formattedAssetBalance} {ticker}
                </span>
              </div>
            )}

            <div className="border-t border-blue-500/20 pt-2 mt-1">
              <div className="flex justify-between">
                <span className="text-slate-400">BTC Amount:</span>
                <span className="text-white font-bold">
                  {invoiceAmountSats.toLocaleString()} sat
                </span>
              </div>
            </div>
          </>
        )}

        {/* Show BTC amount for regular Lightning invoices */}
        {!hasAsset && (
          <div className="flex justify-between">
            <span className="text-slate-400">Amount:</span>
            <span className="text-white font-bold">
              {invoiceAmountSats.toLocaleString()} sat
            </span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-slate-400">Description:</span>
          <span className="text-white truncate max-w-[250px]">
            {decodedInvoice.payment_hash
              ? `Payment #${decodedInvoice.payment_hash.substring(0, 6)}`
              : 'No description'}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-400">Expires:</span>
          <span className="text-white">
            {new Date(
              Date.now() + (decodedInvoice.expiry_sec || 3600) * 1000
            ).toLocaleString()}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-400">Payee:</span>
          <span className="text-white font-mono text-[10px] truncate max-w-[250px]">
            {decodedInvoice.payee_pubkey.slice(0, 10)}...
            {decodedInvoice.payee_pubkey.slice(-6)}
          </span>
        </div>

        <div className="mt-2 pt-2 border-t border-blue-500/20">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Your Max Outbound:</span>
            <span
              className={`font-medium ${isCapacityExceeded ? 'text-red-400' : 'text-green-400'}`}
            >
              {maxCapacitySats.toLocaleString()} sat
            </span>
          </div>

          <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressBarColor(capacityPercentage)}`}
              style={{ width: `${capacityPercentage}%` }}
            />
          </div>

          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-slate-500">0 sat</span>
            <span
              className={`text-[10px] font-medium ${getColorClass(capacityPercentage)}`}
            >
              Using {capacityPercentage}% of capacity
            </span>
            <span className="text-[10px] text-slate-500">
              {maxCapacitySats.toLocaleString()} sat
            </span>
          </div>

          {isCapacityExceeded ? (
            <div className="mt-1 text-yellow-400 text-[10px] flex items-start gap-1">
              <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span>
                Low visible capacity. You can still try the payment, but it
                might fail.
              </span>
            </div>
          ) : (
            <div className="mt-1 text-green-400 text-[10px] flex items-start gap-1">
              <CheckCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span>Payment amount is within your outbound capacity</span>
            </div>
          )}

          {/* Display warning if asset balance is insufficient */}
          {hasAsset && isAssetBalanceExceeded && (
            <div className="mt-1 text-red-400 text-[10px] flex items-start gap-1">
              <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span>
                Insufficient {ticker} in lightning channels for this payment.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export { LightningInvoiceDetails }
