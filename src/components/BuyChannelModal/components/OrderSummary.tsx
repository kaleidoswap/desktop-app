import { useTranslation } from 'react-i18next'

import bitcoinLogo from '../../../assets/bitcoin-logo.svg'
import tetherLogo from '../../../assets/tether-logo.svg'
import { formatNumberWithCommas } from '../../../helpers/number'
import { ChannelFees } from '../../../slices/makerApi/makerApi.slice'
import { AssetInfo } from '../../../utils/channelOrderUtils'
import {
  createAssetLiquiditySection,
  createBitcoinLiquiditySection,
} from '../../../utils/orderSummaryUtils'
import { CostBreakdownItem, OrderSummaryCard } from '../../OrderSummaryCard'

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

  const assetInfo = orderPayload.asset_id
    ? assetMap[orderPayload.asset_id]
    : null
  const precision = assetInfo?.precision ?? 0
  const factor = Math.pow(10, precision)
  const clientAsset = assetInfo
    ? (orderPayload.client_asset_amount || 0) / factor
    : 0
  const lspAsset = assetInfo ? (orderPayload.lsp_asset_amount || 0) / factor : 0
  const totalCapacityAsset = clientAsset + lspAsset

  const assetPriceSats = quote
    ? (quote.from_asset?.amount || (quote as any).from_amount || 0) / 1000
    : 0

  const channelFees = fees?.total_fee || 0
  const totalOrder = assetPriceSats + clientBtc + channelFees
  const hasAssetLiquidity = !!assetInfo && (clientAsset > 0 || lspAsset > 0)

  const costItems: CostBreakdownItem[] = []
  const liquiditySections = [
    createBitcoinLiquiditySection({
      iconSrc: bitcoinLogo,
      inbound: lspBtc,
      inboundLabel: `${formatNumberWithCommas(lspBtc)} sats`,
      outbound: clientBtc,
      outboundLabel: `${formatNumberWithCommas(clientBtc)} sats`,
      ticker: t('components.buyChannelModal.orderSummaryBitcoin'),
      title: t('components.buyChannelModal.orderSummaryBitcoin'),
      totalLabel: `${formatNumberWithCommas(totalCapacityBtc)} sats`,
    }),
  ]

  if (assetPriceSats > 0) {
    costItems.push({
      label: t('components.buyChannelModal.assetCost'),
      value: `${formatNumberWithCommas(assetPriceSats)} sats`,
      valueClassName: 'font-semibold text-cyan-300',
    })
  }

  if (fees && fees.total_fee > 0) {
    if (fees.setup_fee > 0) {
      costItems.push({
        label: t('components.buyChannelModal.setupFee'),
        value: `${formatNumberWithCommas(fees.setup_fee)} sats`,
        valueClassName: 'text-content-secondary',
      })
    }
    if (fees.capacity_fee > 0) {
      costItems.push({
        label: t('components.buyChannelModal.capacityFee'),
        value: `${formatNumberWithCommas(fees.capacity_fee)} sats`,
        valueClassName: 'text-content-secondary',
      })
    }
    if (fees.duration_fee > 0) {
      costItems.push({
        label: t('components.buyChannelModal.durationFee'),
        value: `${formatNumberWithCommas(fees.duration_fee)} sats`,
        valueClassName: 'text-content-secondary',
      })
    }
    if (fees.applied_discount && fees.applied_discount > 0) {
      costItems.push({
        label: t('components.buyChannelModal.discount'),
        value: `-${formatNumberWithCommas(fees.applied_discount)} sats`,
        valueClassName: 'text-green-400',
      })
    }
  }

  if (hasAssetLiquidity && assetInfo) {
    liquiditySections.push(
      createAssetLiquiditySection({
        iconSrc: tetherLogo,
        inbound: lspAsset,
        inboundLabel: `${lspAsset.toLocaleString('en-US', {
          maximumFractionDigits: 2,
        })} ${assetInfo.ticker}`,
        outbound: clientAsset,
        outboundLabel: `${clientAsset.toLocaleString('en-US', {
          maximumFractionDigits: 2,
        })} ${assetInfo.ticker}`,
        subtitle: assetInfo.name,
        ticker: assetInfo.ticker,
        title: `${assetInfo.name} (${assetInfo.ticker})`,
        totalLabel: `${totalCapacityAsset.toLocaleString('en-US', {
          maximumFractionDigits: 2,
        })} ${assetInfo.ticker}`,
      })
    )
  }

  return (
    <OrderSummaryCard
      costBreakdown={{
        items: costItems,
        totalLabel: t('components.buyChannelModal.totalToPay'),
        totalValue: `${formatNumberWithCommas(totalOrder)} sats`,
      }}
      liquiditySections={liquiditySections}
    />
  )
}
