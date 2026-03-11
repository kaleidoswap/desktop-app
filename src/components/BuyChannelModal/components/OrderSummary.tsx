import { useTranslation } from 'react-i18next'

import bitcoinLogo from '../../../assets/bitcoin-logo.svg'
import tetherLogo from '../../../assets/tether-logo.svg'
import { formatNumberWithCommas } from '../../../helpers/number'
import { LiquidityBar } from '../../../routes/trade/dca/components/LiquidityBar'
import { ChannelFees } from '../../../slices/makerApi/makerApi.slice'
import { AssetInfo } from '../../../utils/channelOrderUtils'

interface OrderSummaryProps {
  orderPayload: any
  fees: ChannelFees | null
  assetMap: Record<string, AssetInfo>
  compact?: boolean
  quote?: any
}

export const OrderSummary: React.FC<OrderSummaryProps> = ({
  orderPayload,
  fees,
  assetMap,
  quote,
}) => {
  const { t } = useTranslation()
  if (!orderPayload) return null

  const clientBtc = orderPayload.client_balance_sat || 0
  const lspBtc = orderPayload.lsp_balance_sat || 0
  const totalCapacityBtc = clientBtc + lspBtc

  const assetInfo = orderPayload.asset_id ? assetMap[orderPayload.asset_id] : null
  const precision = assetInfo?.precision ?? 0
  const factor = Math.pow(10, precision)
  const clientAsset = assetInfo ? (orderPayload.client_asset_amount || 0) / factor : 0
  const lspAsset = assetInfo ? (orderPayload.lsp_asset_amount || 0) / factor : 0
  const totalCapacityAsset = clientAsset + lspAsset

  const assetPriceSats =
    quote
      ? (quote.from_asset?.amount || (quote as any).from_amount || 0) / 1000
      : 0

  const channelFees = fees?.total_fee || 0
  const totalOrder = assetPriceSats + clientBtc + channelFees

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-overlay/30 overflow-hidden">
      {/* BTC Liquidity */}
      <div className="p-4 space-y-2.5">
        <div className="flex items-center gap-2">
          <img src={bitcoinLogo} alt="BTC" className="w-4 h-4 rounded-full" />
          <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
            Bitcoin
          </span>
          <span className="ml-auto text-xs text-content-tertiary">
            {formatNumberWithCommas(totalCapacityBtc)} sats total
          </span>
        </div>
        <LiquidityBar
          outbound={clientBtc}
          inbound={lspBtc}
          outboundLabel={formatNumberWithCommas(clientBtc) + ' sats'}
          inboundLabel={formatNumberWithCommas(lspBtc) + ' sats'}
          outboundColor="bg-amber-400"
          inboundColor="bg-blue-400/50"
        />
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-content-tertiary mb-0.5">Your Outbound</p>
            <p className="text-amber-300 font-semibold">
              {formatNumberWithCommas(clientBtc)} sats
            </p>
          </div>
          <div className="text-right">
            <p className="text-content-tertiary mb-0.5">Your Inbound</p>
            <p className="text-content-secondary font-medium">
              {formatNumberWithCommas(lspBtc)} sats
            </p>
          </div>
        </div>
      </div>

      {/* USDT Liquidity */}
      {assetInfo && (clientAsset > 0 || lspAsset > 0) && (
        <>
          <div className="h-px bg-border-subtle" />
          <div className="p-4 space-y-2.5">
            <div className="flex items-center gap-2">
              <img src={tetherLogo} alt={assetInfo.ticker} className="w-4 h-4 rounded-full" />
              <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
                {assetInfo.ticker}
              </span>
              <span className="ml-auto text-xs text-content-tertiary">
                {totalCapacityAsset.toFixed(2)} {assetInfo.ticker} total
              </span>
            </div>
            <LiquidityBar
              outbound={clientAsset}
              inbound={lspAsset}
              outboundLabel={clientAsset.toFixed(2) + ' ' + assetInfo.ticker}
              inboundLabel={lspAsset.toFixed(2) + ' ' + assetInfo.ticker}
              outboundColor="bg-emerald-400"
              inboundColor="bg-emerald-400/30"
            />
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-content-tertiary mb-0.5">Your Outbound</p>
                <p className="text-emerald-300 font-semibold">
                  {clientAsset.toFixed(2)} {assetInfo.ticker}
                </p>
              </div>
              <div className="text-right">
                <p className="text-content-tertiary mb-0.5">Your Inbound</p>
                <p className="text-content-secondary font-medium">
                  {lspAsset.toFixed(2)} {assetInfo.ticker}
                </p>
              </div>
            </div>
            {assetPriceSats > 0 && (
              <div className="flex justify-between text-xs pt-2 border-t border-border-subtle">
                <span className="text-content-tertiary">Asset cost</span>
                <span className="text-emerald-300 font-semibold">
                  {formatNumberWithCommas(assetPriceSats)} sats
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Fees + Total */}
      <div className="h-px bg-border-subtle" />
      <div className="p-4 space-y-1.5">
        {fees && fees.total_fee > 0 && (
          <>
            {fees.setup_fee > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-content-tertiary">Setup fee</span>
                <span className="text-content-secondary">
                  {formatNumberWithCommas(fees.setup_fee)} sats
                </span>
              </div>
            )}
            {fees.capacity_fee > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-content-tertiary">Capacity fee</span>
                <span className="text-content-secondary">
                  {formatNumberWithCommas(fees.capacity_fee)} sats
                </span>
              </div>
            )}
            {fees.duration_fee > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-content-tertiary">Duration fee</span>
                <span className="text-content-secondary">
                  {formatNumberWithCommas(fees.duration_fee)} sats
                </span>
              </div>
            )}
            {fees.applied_discount && fees.applied_discount > 0 && (
              <div className="flex justify-between text-xs text-green-400">
                <span>{t('components.buyChannelModal.discount')}</span>
                <span>-{formatNumberWithCommas(fees.applied_discount)} sats</span>
              </div>
            )}
          </>
        )}
        <div className="flex justify-between items-center pt-2 mt-1 border-t border-border-subtle">
          <span className="font-semibold text-white text-sm">Total to Pay</span>
          <div>
            <span className="text-xl font-bold text-white">
              {formatNumberWithCommas(totalOrder)}
            </span>
            <span className="text-sm text-content-secondary ml-1">sats</span>
          </div>
        </div>
      </div>
    </div>
  )
}
