import React from 'react'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'

import { formatBitcoinAmount } from '../../../helpers/number'
import { Lsps1CreateOrderResponse } from '../../../slices/makerApi/makerApi.slice'
import { NiaAsset } from '../../../slices/nodeApi/nodeApi.slice'
import { LiquidityBar } from '../../trade/dca/components/LiquidityBar'
import bitcoinLogo from '../../../assets/bitcoin-logo.svg'
import tetherLogo from '../../../assets/tether-logo.svg'

interface OrderSummaryProps {
  order: Lsps1CreateOrderResponse
  bitcoinUnit: string
  currentPayment: any
  assetInfo: NiaAsset | null
  orderPayload?: any
}

export const OrderSummary: React.FC<OrderSummaryProps> = ({
  order,
  bitcoinUnit,
  currentPayment,
  assetInfo,
  orderPayload,
}) => {
  const { t } = useTranslation()
  const totalCapacity = order.lsp_balance_sat + order.client_balance_sat

  const lspAssetRaw = order.lsp_asset_amount || orderPayload?.lsp_asset_amount || 0
  const clientAssetRaw = order.client_asset_amount || orderPayload?.client_asset_amount || 0
  const hasAsset = !!(order.asset_id || orderPayload?.asset_id)

  return (
    <div className="rounded-xl border border-border-subtle overflow-hidden">
      {/* BTC Section */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={bitcoinLogo} alt="BTC" className="w-5 h-5" />
            <span className="text-sm font-semibold text-content-primary">
              {t('orderChannel.step3.confirmedChannel')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {order.order_id && (
              <CopyToClipboard
                onCopy={() => toast.success(t('orderChannel.orderCopy'))}
                text={order.order_id}
              >
                <button className="text-[11px] text-content-secondary hover:text-white font-mono bg-surface-base/50 px-2 py-0.5 rounded transition-colors">
                  #{order.order_id.slice(0, 6)}…
                </button>
              </CopyToClipboard>
            )}
            <span className="text-sm font-bold text-amber-400">
              {formatBitcoinAmount(totalCapacity, bitcoinUnit)} {bitcoinUnit}
            </span>
          </div>
        </div>

        <LiquidityBar
          outbound={order.client_balance_sat}
          inbound={order.lsp_balance_sat}
          outboundLabel={`${formatBitcoinAmount(order.client_balance_sat, bitcoinUnit)} ${bitcoinUnit}`}
          inboundLabel={`${formatBitcoinAmount(order.lsp_balance_sat, bitcoinUnit)} ${bitcoinUnit}`}
          outboundColor="bg-amber-400"
          inboundColor="bg-blue-400/50"
        />

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-content-tertiary mb-0.5">Your outbound</p>
            <p className="font-semibold text-amber-400">
              {formatBitcoinAmount(order.client_balance_sat, bitcoinUnit)} {bitcoinUnit}
            </p>
          </div>
          <div className="text-right">
            <p className="text-content-tertiary mb-0.5">LSP inbound</p>
            <p className="font-semibold text-content-secondary">
              {formatBitcoinAmount(order.lsp_balance_sat, bitcoinUnit)} {bitcoinUnit}
            </p>
          </div>
        </div>
      </div>

      {/* Asset section */}
      {hasAsset && (lspAssetRaw > 0 || clientAssetRaw > 0) && (
        <>
          <div className="h-px bg-border-subtle" />
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <img src={tetherLogo} alt="Asset" className="w-5 h-5" />
              <span className="text-sm font-semibold text-emerald-400">
                {assetInfo ? `${assetInfo.name} (${assetInfo.ticker})` : t('orderChannel.step3.rgbAssetChannel')}
              </span>
            </div>

            <LiquidityBar
              outbound={clientAssetRaw}
              inbound={lspAssetRaw}
              outboundLabel={clientAssetRaw > 0 ? `${clientAssetRaw.toLocaleString()}${assetInfo ? ` ${assetInfo.ticker}` : ''}` : '0'}
              inboundLabel={`${lspAssetRaw.toLocaleString()}${assetInfo ? ` ${assetInfo.ticker}` : ''}`}
              outboundColor="bg-emerald-400"
              inboundColor="bg-emerald-400/30"
            />

            <div className="grid grid-cols-2 gap-3 text-xs">
              {clientAssetRaw > 0 && (
                <div>
                  <p className="text-content-tertiary mb-0.5">Your outbound</p>
                  <p className="font-semibold text-emerald-400">
                    {clientAssetRaw.toLocaleString()}{assetInfo ? ` ${assetInfo.ticker}` : ''}
                  </p>
                </div>
              )}
              <div className={clientAssetRaw > 0 ? 'text-right' : ''}>
                <p className="text-content-tertiary mb-0.5">LSP inbound</p>
                <p className="font-semibold text-content-secondary">
                  {lspAssetRaw.toLocaleString()}{assetInfo ? ` ${assetInfo.ticker}` : ''}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Cost breakdown */}
      <div className="h-px bg-border-subtle" />
      <div className="p-4 space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-content-secondary">{t('orderChannel.step3.channelAmount')}</span>
          <span className="text-content-primary">
            {formatBitcoinAmount(
              (currentPayment?.order_total_sat || 0) - (currentPayment?.fee_total_sat || 0),
              bitcoinUnit
            )}{' '}
            {bitcoinUnit}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-content-secondary">{t('orderChannel.step3.serviceFee')}</span>
          <span className="text-content-primary">
            {formatBitcoinAmount(currentPayment?.fee_total_sat || 0, bitcoinUnit)} {bitcoinUnit}
          </span>
        </div>
        <div className="h-px bg-border-subtle my-1" />
        <div className="flex justify-between">
          <span className="text-sm font-semibold text-content-secondary">
            {t('orderChannel.step3.total')}
          </span>
          <span className="text-sm font-bold text-amber-400">
            {formatBitcoinAmount(currentPayment?.order_total_sat || 0, bitcoinUnit)} {bitcoinUnit}
          </span>
        </div>
      </div>
    </div>
  )
}
