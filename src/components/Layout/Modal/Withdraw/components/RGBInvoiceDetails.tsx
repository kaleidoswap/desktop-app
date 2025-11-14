import React from 'react'
import { useTranslation } from 'react-i18next'

import { formatAssetAmountWithPrecision } from '../../../../../helpers/number'
import { NiaAsset } from '../../../../../slices/nodeApi/nodeApi.slice'
import { RGBInvoiceDetailsProps } from '../types'

// RGBInvoiceDetails component for displaying decoded RGB invoice information
const RGBInvoiceDetails: React.FC<RGBInvoiceDetailsProps> = ({
  decodedRgbInvoice,
  assets,
  bitcoinUnit,
}) => {
  const { t } = useTranslation()

  if (!decodedRgbInvoice) return null

  const assetInfo = assets.data?.nia.find(
    (asset: NiaAsset) => asset.asset_id === decodedRgbInvoice.asset_id
  )
  const ticker =
    assetInfo?.ticker || t('withdrawModal.main.labels.unknownAsset')

  // Format the asset balance with proper precision
  const formattedBalance = assetInfo
    ? formatAssetAmountWithPrecision(
        assetInfo.balance.spendable,
        ticker,
        bitcoinUnit,
        assets.data?.nia
      )
    : '0'

  // Get amount from assignment and format for display
  const assignmentAmount =
    decodedRgbInvoice.assignment?.type === 'Fungible'
      ? decodedRgbInvoice.assignment.value
      : decodedRgbInvoice.assignment?.type === 'InflationRight'
        ? decodedRgbInvoice.assignment.value
        : null

  const formattedAmount = assignmentAmount
    ? formatAssetAmountWithPrecision(
        assignmentAmount,
        ticker,
        bitcoinUnit,
        assets.data?.nia
      )
    : null

  return (
    <div className="p-3 bg-green-500/10 rounded-xl border border-green-500/20">
      <h4 className="text-green-400 text-sm font-medium mb-2">
        {t('withdrawModal.details.rgb.title')}
      </h4>
      <div className="space-y-2 text-xs">
        {decodedRgbInvoice.asset_id && (
          <div className="flex justify-between">
            <span className="text-slate-400">
              {t('withdrawModal.details.rgb.assetLabel')}
            </span>
            <div className="flex items-center">
              <span className="text-white font-medium">{ticker}</span>
              <span className="text-slate-500 ml-1">
                ({decodedRgbInvoice.asset_id.slice(0, 8)}...
                {decodedRgbInvoice.asset_id.slice(-4)})
              </span>
            </div>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-slate-400">
            {t('withdrawModal.details.rgb.requestedAmountLabel')}
          </span>
          {assignmentAmount ? (
            <span className="text-white font-medium">
              {formattedAmount} {ticker}
            </span>
          ) : (
            <span className="text-yellow-400 font-medium text-xs">
              {t('withdrawModal.details.rgb.amountNotSpecified')}
            </span>
          )}
        </div>
        {assignmentAmount && (
          <div className="mt-1 p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
            <p className="text-xs text-yellow-400">
              {t('withdrawModal.details.rgb.amountHint')}
            </p>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-slate-400">
            {t('withdrawModal.details.rgb.recipientLabel')}
          </span>
          <span className="text-white font-mono text-[10px] truncate max-w-[250px]">
            {decodedRgbInvoice.recipient_id.slice(0, 10)}...
            {decodedRgbInvoice.recipient_id.slice(-6)}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-slate-400">
            {t('withdrawModal.details.rgb.expiresLabel')}
          </span>
          <span className="text-white">
            {new Date(
              decodedRgbInvoice.expiration_timestamp * 1000
            ).toLocaleString()}
          </span>
        </div>

        {decodedRgbInvoice.transport_endpoints &&
          decodedRgbInvoice.transport_endpoints.length > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">
                {t('withdrawModal.details.rgb.transportLabel')}
              </span>
              <span className="text-white truncate max-w-[250px]">
                {t('withdrawModal.details.rgb.transportValue', {
                  count: decodedRgbInvoice.transport_endpoints.length,
                })}
              </span>
            </div>
          )}

        {assetInfo && (
          <div className="mt-2 pt-2 border-t border-green-500/20">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">
                {t('withdrawModal.details.rgb.balanceLabel')}
              </span>
              <span className="text-green-400 font-medium">
                {formattedBalance} {ticker}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export { RGBInvoiceDetails }
