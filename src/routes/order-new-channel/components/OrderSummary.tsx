import React from 'react'
import { useTranslation } from 'react-i18next'

import bitcoinLogo from '../../../assets/bitcoin-logo.svg'
import tetherLogo from '../../../assets/tether-logo.svg'
import {
  LiquiditySection,
  OrderSummaryCard,
} from '../../../components/OrderSummaryCard'
import { formatBitcoinAmount } from '../../../helpers/number'
import { Lsps1CreateOrderResponse } from '../../../slices/makerApi/makerApi.slice'
import { NiaAsset } from '../../../slices/nodeApi/nodeApi.slice'

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

  const lspAssetRaw =
    order.lsp_asset_amount || orderPayload?.lsp_asset_amount || 0
  const clientAssetRaw =
    order.client_asset_amount || orderPayload?.client_asset_amount || 0
  const hasAsset = !!(order.asset_id || orderPayload?.asset_id)

  const channelAmount =
    (currentPayment?.order_total_sat || 0) -
    (currentPayment?.fee_total_sat || 0)

  const liquiditySections: LiquiditySection[] = [
    {
      accentClassName: 'text-amber-300',
      backgroundClassName: 'bg-amber-400/6',
      borderClassName: 'border-amber-400/15',
      iconAlt: 'BTC',
      iconSrc: bitcoinLogo,
      inbound: order.lsp_balance_sat,
      inboundColor: 'bg-blue-400/50',
      inboundLabel: `${formatBitcoinAmount(order.lsp_balance_sat, bitcoinUnit)} ${bitcoinUnit}`,
      outbound: order.client_balance_sat,
      outboundColor: 'bg-amber-400',
      outboundLabel: `${formatBitcoinAmount(order.client_balance_sat, bitcoinUnit)} ${bitcoinUnit}`,
      ticker: t('orderChannel.step3.confirmedChannel'),
      title: t('orderChannel.step3.confirmedChannel'),
      totalLabel: `${formatBitcoinAmount(totalCapacity, bitcoinUnit)} ${bitcoinUnit}`,
    },
  ]

  if (hasAsset && (lspAssetRaw > 0 || clientAssetRaw > 0)) {
    liquiditySections.push({
      accentClassName: 'text-cyan-300',
      backgroundClassName: 'bg-cyan-400/6',
      borderClassName: 'border-cyan-400/15',
      iconAlt: assetInfo?.ticker || 'Asset',
      iconSrc: tetherLogo,
      inbound: lspAssetRaw,
      inboundColor: 'bg-sky-400/35',
      inboundLabel: `${lspAssetRaw.toLocaleString()}${
        assetInfo ? ` ${assetInfo.ticker}` : ''
      }`,
      outbound: clientAssetRaw,
      outboundColor: 'bg-cyan-400',
      outboundLabel:
        clientAssetRaw > 0
          ? `${clientAssetRaw.toLocaleString()}${
              assetInfo ? ` ${assetInfo.ticker}` : ''
            }`
          : '0',
      ticker: assetInfo?.ticker || 'RGB',
      title: assetInfo
        ? `${assetInfo.name} (${assetInfo.ticker})`
        : t('orderChannel.step3.rgbAssetChannel'),
      titleClassName: 'text-cyan-300',
      totalLabel: `${(clientAssetRaw + lspAssetRaw).toLocaleString()}${
        assetInfo ? ` ${assetInfo.ticker}` : ''
      }`,
    })
  }

  return (
    <OrderSummaryCard
      costBreakdown={{
        items: [
          {
            label: t('orderChannel.step3.channelAmount'),
            value: `${formatBitcoinAmount(channelAmount, bitcoinUnit)} ${bitcoinUnit}`,
          },
          {
            label: t('orderChannel.step3.serviceFee'),
            value: `${formatBitcoinAmount(
              currentPayment?.fee_total_sat || 0,
              bitcoinUnit
            )} ${bitcoinUnit}`,
          },
        ],
        totalLabel: t('orderChannel.step3.total'),
        totalValue: `${formatBitcoinAmount(
          currentPayment?.order_total_sat || 0,
          bitcoinUnit
        )} ${bitcoinUnit}`,
      }}
      description="Final liquidity split and payment totals for this order."
      headerEyebrow="Review"
      liquiditySections={liquiditySections}
      stackSections
      title="Channel summary"
      totalCapacityLabel="Total capacity"
      totalCapacityValue={`${formatBitcoinAmount(totalCapacity, bitcoinUnit)} ${bitcoinUnit}`}
    />
  )
}
