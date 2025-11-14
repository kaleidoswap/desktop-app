import { AlertTriangle, CheckCircle } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { formatAssetAmountWithPrecision } from '../../../../../helpers/number'
import { NiaAsset } from '../../../../../slices/nodeApi/nodeApi.slice'
import { LightningInvoiceDetailsProps } from '../types'

const LightningInvoiceDetails: React.FC<LightningInvoiceDetailsProps> = ({
  decodedInvoice,
  assets,
  bitcoinUnit,
  maxLightningCapacity,
}) => {
  const { t } = useTranslation()

  if (!decodedInvoice) return null

  const hasAsset = decodedInvoice.asset_id && decodedInvoice.asset_amount

  const assetInfo = hasAsset
    ? assets.data?.nia.find(
        (asset: NiaAsset) => asset.asset_id === decodedInvoice.asset_id
      )
    : null
  const ticker =
    assetInfo?.ticker || t('withdrawModal.main.labels.unknownAsset')

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
        {t('withdrawModal.details.lightning.title')}
      </h4>
      <div className="space-y-2 text-xs">
        {hasAsset && (
          <>
            <div className="flex justify-between">
              <span className="text-slate-400">
                {t('withdrawModal.details.lightning.assetLabel')}
              </span>
              <div className="flex items-center">
                <span className="text-white font-medium">{ticker}</span>
                <span className="text-slate-500 ml-1">
                  ({decodedInvoice.asset_id!.slice(0, 8)}...
                  {decodedInvoice.asset_id!.slice(-4)})
                </span>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">
                {t('withdrawModal.details.lightning.assetAmountLabel')}
              </span>
              <span className="text-white font-bold">
                {formattedAssetAmount} {ticker}
              </span>
            </div>
            {assetInfo && (
              <div className="flex justify-between">
                <span className="text-slate-400">
                  {t('withdrawModal.details.lightning.lightningBalanceLabel')}
                </span>
                <span
                  className={`font-medium ${!isAssetBalanceExceeded ? 'text-green-400' : 'text-red-400'}`}
                >
                  {formattedAssetBalance} {ticker}
                </span>
              </div>
            )}

            <div className="border-t border-blue-500/20 pt-2 mt-1">
              <div className="flex justify-between">
                <span className="text-slate-400">
                  {t('withdrawModal.details.lightning.btcAmountLabel')}
                </span>
                <span className="text-white font-bold">
                  {t('withdrawModal.details.lightning.satValue', {
                    value: invoiceAmountSats.toLocaleString(),
                  })}
                </span>
              </div>
            </div>
          </>
        )}

        {/* Show BTC amount for regular Lightning invoices */}
        {!hasAsset && (
          <div className="flex justify-between">
            <span className="text-slate-400">
              {t('withdrawModal.details.lightning.amountLabel')}
            </span>
            <span className="text-white font-bold">
              {t('withdrawModal.details.lightning.satValue', {
                value: invoiceAmountSats.toLocaleString(),
              })}
            </span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-slate-400">
            {t('withdrawModal.details.lightning.descriptionLabel')}
          </span>
          <span className="text-white truncate max-w-[250px]">
            {decodedInvoice.payment_hash
              ? t('withdrawModal.details.lightning.descriptionPayment', {
                  hash: decodedInvoice.payment_hash.substring(0, 6),
                })
              : t('withdrawModal.details.lightning.descriptionFallback')}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-400">
            {t('withdrawModal.details.lightning.expiresLabel')}
          </span>
          <span className="text-white">
            {new Date(
              Date.now() + (decodedInvoice.expiry_sec || 3600) * 1000
            ).toLocaleString()}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-400">
            {t('withdrawModal.details.lightning.payeeLabel')}
          </span>
          <span className="text-white font-mono text-[10px] truncate max-w-[250px]">
            {decodedInvoice.payee_pubkey.slice(0, 10)}...
            {decodedInvoice.payee_pubkey.slice(-6)}
          </span>
        </div>

        <div className="mt-2 pt-2 border-t border-blue-500/20">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">
              {t('withdrawModal.details.lightning.maxOutboundLabel')}
            </span>
            <span
              className={`font-medium ${isCapacityExceeded ? 'text-red-400' : 'text-green-400'}`}
            >
              {t('withdrawModal.details.lightning.satValue', {
                value: maxCapacitySats.toLocaleString(),
              })}
            </span>
          </div>

          <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressBarColor(capacityPercentage)}`}
              style={{ width: `${capacityPercentage}%` }}
            />
          </div>

          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-slate-500">
              {t('withdrawModal.details.lightning.capacityMin')}
            </span>
            <span
              className={`text-[10px] font-medium ${getColorClass(capacityPercentage)}`}
            >
              {t('withdrawModal.details.lightning.capacityUsage', {
                percentage: capacityPercentage,
              })}
            </span>
            <span className="text-[10px] text-slate-500">
              {t('withdrawModal.details.lightning.satValue', {
                value: maxCapacitySats.toLocaleString(),
              })}
            </span>
          </div>

          {isCapacityExceeded ? (
            <div className="mt-1 text-yellow-400 text-[10px] flex items-start gap-1">
              <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span>
                {t('withdrawModal.details.lightning.lowCapacityWarning')}
              </span>
            </div>
          ) : (
            <div className="mt-1 text-green-400 text-[10px] flex items-start gap-1">
              <CheckCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span>{t('withdrawModal.details.lightning.withinCapacity')}</span>
            </div>
          )}

          {/* Display warning if asset balance is insufficient */}
          {hasAsset && isAssetBalanceExceeded && (
            <div className="mt-1 text-red-400 text-[10px] flex items-start gap-1">
              <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span>
                {t('withdrawModal.details.lightning.insufficientAsset', {
                  ticker,
                })}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export { LightningInvoiceDetails }
