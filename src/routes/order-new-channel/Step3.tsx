import React, { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Copy,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-toastify'
import CopyToClipboard from 'react-copy-to-clipboard'

import BitcoinLogo from '../../assets/bitcoin-logo.svg'
import rgbIcon from '../../assets/rgb-logo.svg'
import { Button, Card } from '../../components/ui'
import { useAssetIcon } from '../../helpers/utils'
import { formatBitcoinAmount } from '../../helpers/number'
import { useSettings } from '../../hooks/useSettings'
import { Lsps1CreateOrderResponse } from '../../slices/makerApi/makerApi.slice'
import { nodeApi, NiaAsset } from '../../slices/nodeApi/nodeApi.slice'
import { AssetInfo } from '../../utils/channelOrderUtils'

interface Props {
  order: Lsps1CreateOrderResponse | null
  orderPayload?: any
  assetInfo?: AssetInfo | null
  onBack: () => void
  onNext: () => void
}

const formatNumber = (num: number) =>
  num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')

const formatDuration = (blocks: number) => {
  if (blocks <= 4320) return '1 Month'
  if (blocks <= 12960) return '3 Months'
  return '6 Months'
}

const formatOrderId = (id: string) =>
  id.length > 16 ? `${id.slice(0, 8)}...${id.slice(-8)}` : id

export const Step3: React.FC<Props> = ({
  order,
  orderPayload,
  assetInfo: assetInfoProp,
  onBack,
  onNext,
}) => {
  const { t } = useTranslation()
  const { bitcoinUnit } = useSettings()
  const [fetchedAssetInfo, setFetchedAssetInfo] = useState<NiaAsset | null>(
    null
  )
  const [getAssetList] = nodeApi.endpoints.listAssets.useLazyQuery()

  const assetTicker = assetInfoProp?.ticker || fetchedAssetInfo?.ticker || ''
  const assetName = assetInfoProp?.name || fetchedAssetInfo?.name || ''
  const [assetIcon] = useAssetIcon(assetTicker, rgbIcon)

  useEffect(() => {
    if (assetInfoProp) return
    const assetId = order?.asset_id || orderPayload?.asset_id
    if (assetId) {
      getAssetList().then((result) => {
        if (result.data) {
          const asset = result.data?.nia?.find(
            (a: any) => a.asset_id === assetId
          )
          if (asset) setFetchedAssetInfo(asset)
        }
      })
    }
  }, [order?.asset_id, orderPayload?.asset_id, getAssetList, assetInfoProp])

  const handleCopyOrderId = useCallback(() => {
    toast.success(t('orderChannel.paymentCopied'))
  }, [t])

  if (!order) {
    return (
      <div className="max-w-lg mx-auto flex justify-center items-center h-64">
        <span className="text-content-secondary">
          {t('orderChannel.step3.loadingOrder')}
        </span>
      </div>
    )
  }

  const displayUnit = bitcoinUnit === 'SAT' ? 'SATS' : bitcoinUnit

  const totalCapacity = order.lsp_balance_sat + order.client_balance_sat
  const currentPayment = order.payment?.bolt11 || order.payment?.onchain
  const amountSat = currentPayment?.order_total_sat || 0
  const feeSat = currentPayment?.fee_total_sat || 0
  const channelAmountSat = amountSat - feeSat
  const hasAsset = !!(order.asset_id || orderPayload?.asset_id)
  const lspAssetRaw =
    order.lsp_asset_amount || orderPayload?.lsp_asset_amount || 0
  const clientAssetRaw =
    order.client_asset_amount || orderPayload?.client_asset_amount || 0
  const totalAssetAmount = lspAssetRaw + clientAssetRaw

  return (
    <div className="max-w-lg mx-auto">
      <Card className="mb-6 divide-y divide-border-default/40">
        {/* Order ID */}
        <div className="flex items-start justify-between py-4 first:pt-0">
          <span className="text-sm text-content-secondary shrink-0 mr-4">
            Order ID
          </span>
          <div className="flex items-center gap-1">
            <span className="text-sm text-white font-mono">
              {formatOrderId(order.order_id)}
            </span>
            <div className="relative group/copy">
              <CopyToClipboard onCopy={handleCopyOrderId} text={order.order_id}>
                <button
                  className="text-content-tertiary hover:text-white p-0.5 rounded transition-colors"
                  type="button"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </CopyToClipboard>
              <div className="absolute bottom-full mb-1.5 right-0 bg-surface-high text-content-primary text-[10px] rounded-md py-0.5 px-1.5 opacity-0 group-hover/copy:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-border-default/40 shadow-lg z-20">
                Copy Order ID
              </div>
            </div>
          </div>
        </div>

        {/* BTC Section */}
        {(() => {
          const btcOut = order.client_balance_sat
          const btcIn = order.lsp_balance_sat
          const btcTotal = btcOut + btcIn
          const btcOutPct = btcTotal > 0 ? (btcOut / btcTotal) * 100 : 50
          const btcInPct = btcTotal > 0 ? (btcIn / btcTotal) * 100 : 50
          return (
            <div className="py-4">
              <div className="flex items-center gap-1.5 mb-3">
                <img alt="Bitcoin" className="w-4 h-4" src={BitcoinLogo} />
                <span className="text-sm font-semibold text-white">
                  Bitcoin (BTC)
                </span>
                <span className="ml-auto text-xs text-content-tertiary">
                  {formatNumber(totalCapacity)} SATS total
                </span>
              </div>
              <div className="pl-6">
                <div className="grid grid-cols-3 items-center text-xs mb-1">
                  <span className="flex items-center gap-1 text-purple-400 font-medium">
                    <ArrowUpRight className="w-3 h-3" />
                    {formatBitcoinAmount(btcOut, bitcoinUnit)} {displayUnit}
                  </span>
                  <span className="text-center text-content-tertiary text-[10px] font-semibold uppercase tracking-wider">
                    BTC
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400 font-medium justify-end">
                    {formatBitcoinAmount(btcIn, bitcoinUnit)} {displayUnit}
                    <ArrowDownRight className="w-3 h-3" />
                  </span>
                </div>
                <div className="relative h-1.5 bg-surface-high/60 rounded-full overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full bg-[#9365FF] rounded-l-full"
                    style={{ width: `${btcOutPct}%` }}
                  />
                  <div
                    className="absolute right-0 top-0 h-full bg-emerald-500 rounded-r-full"
                    style={{ width: `${btcInPct}%` }}
                  />
                  <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-surface-high/80" />
                </div>
                <div className="grid grid-cols-3 text-[10px] mt-1">
                  <span className="text-purple-400/70">Outbound</span>
                  <span />
                  <span className="text-right text-emerald-400/70">
                    Inbound
                  </span>
                </div>
              </div>
            </div>
          )
        })()}

        {/* RGB Asset Section */}
        {hasAsset &&
          totalAssetAmount > 0 &&
          (() => {
            const assetOutPct =
              totalAssetAmount > 0
                ? (clientAssetRaw / totalAssetAmount) * 100
                : 50
            const assetInPct =
              totalAssetAmount > 0 ? (lspAssetRaw / totalAssetAmount) * 100 : 50
            return (
              <div className="py-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <img
                    alt={assetTicker}
                    className="w-4 h-4 rounded-full"
                    src={assetIcon}
                  />
                  <span className="text-sm font-semibold text-white">
                    {assetTicker}
                    {assetName ? ` (${assetName})` : ''}
                  </span>
                  <span className="ml-auto text-xs text-content-tertiary">
                    {totalAssetAmount.toLocaleString()} {assetTicker} total
                  </span>
                </div>
                <div className="pl-6">
                  <div className="grid grid-cols-3 items-center text-xs mb-1">
                    <span className="flex items-center gap-1 text-purple-400 font-medium">
                      <ArrowUpRight className="w-3 h-3" />
                      {clientAssetRaw.toLocaleString()} {assetTicker}
                    </span>
                    <span className="text-center text-content-tertiary text-[10px] font-semibold uppercase tracking-wider">
                      {assetTicker}
                    </span>
                    <span className="flex items-center gap-1 text-emerald-400 font-medium justify-end">
                      {lspAssetRaw.toLocaleString()} {assetTicker}
                      <ArrowDownRight className="w-3 h-3" />
                    </span>
                  </div>
                  <div className="relative h-1.5 bg-surface-high/60 rounded-full overflow-hidden">
                    <div
                      className="absolute left-0 top-0 h-full bg-[#9365FF] rounded-l-full"
                      style={{ width: `${assetOutPct}%` }}
                    />
                    <div
                      className="absolute right-0 top-0 h-full bg-emerald-500 rounded-r-full"
                      style={{ width: `${assetInPct}%` }}
                    />
                    <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-surface-high/80" />
                  </div>
                  <div className="grid grid-cols-3 text-[10px] mt-1">
                    <span className="text-purple-400/70">Outbound</span>
                    <span />
                    <span className="text-right text-emerald-400/70">
                      Inbound
                    </span>
                  </div>
                </div>
              </div>
            )
          })()}

        {/* Duration */}
        <div className="flex items-center justify-between py-4">
          <span className="text-sm text-content-secondary">
            Channel Lock Duration
          </span>
          <span className="text-white font-semibold">
            {formatDuration(order.channel_expiry_blocks)}
          </span>
        </div>

        {/* Total Cost */}
        <div className="flex items-center justify-between py-4 last:pb-0">
          <span className="text-sm text-content-secondary">Total Cost</span>
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-white font-semibold">
                {formatNumber(amountSat)} SATS
              </span>
            </div>
            {channelAmountSat > 0 && (
              <span className="text-xs text-content-secondary">
                Channel amount: {formatNumber(channelAmountSat)} SATS
              </span>
            )}
            {feeSat > 0 && (
              <span className="text-xs text-content-secondary">
                Service fee: {formatNumber(feeSat)} SATS
              </span>
            )}
          </div>
        </div>
      </Card>

      <div className="flex justify-between mt-8">
        <button
          className="px-3 py-2 text-content-secondary hover:text-white transition-colors flex items-center gap-1.5 hover:bg-surface-overlay/50 rounded-lg text-sm"
          onClick={onBack}
          type="button"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t('orderChannel.step3.backButton')}
        </button>
        <Button
          icon={<ArrowRight className="w-5 h-5" />}
          iconPosition="right"
          onClick={onNext}
          size="lg"
          variant="primary"
        >
          {t('orderChannel.step3.continueToPayment')}
        </Button>
      </div>
    </div>
  )
}
