import type { LiquiditySection } from '../components/OrderSummaryCard'

interface CreateBitcoinLiquiditySectionParams {
  iconSrc: string
  inbound: number
  inboundLabel: string
  outbound: number
  outboundLabel: string
  ticker: string
  title: string
  totalLabel: string
}

interface CreateAssetLiquiditySectionParams {
  iconSrc: string
  inbound: number
  inboundLabel: string
  outbound: number
  outboundLabel: string
  subtitle?: string
  ticker: string
  title: string
  titleClassName?: string
  totalLabel: string
}

export const createBitcoinLiquiditySection = ({
  iconSrc,
  inbound,
  inboundLabel,
  outbound,
  outboundLabel,
  ticker,
  title,
  totalLabel,
}: CreateBitcoinLiquiditySectionParams): LiquiditySection => ({
  accentClassName: 'text-amber-300',
  backgroundClassName: 'bg-amber-400/6',
  borderClassName: 'border-amber-400/15',
  iconAlt: 'BTC',
  iconSrc,
  inbound,
  inboundColor: 'bg-blue-400/50',
  inboundLabel,
  outbound,
  outboundColor: 'bg-amber-400',
  outboundLabel,
  ticker,
  title,
  totalLabel,
})

export const createAssetLiquiditySection = ({
  iconSrc,
  inbound,
  inboundLabel,
  outbound,
  outboundLabel,
  subtitle,
  ticker,
  title,
  titleClassName,
  totalLabel,
}: CreateAssetLiquiditySectionParams): LiquiditySection => ({
  accentClassName: 'text-cyan-300',
  backgroundClassName: 'bg-cyan-400/6',
  borderClassName: 'border-cyan-400/15',
  iconAlt: ticker || 'Asset',
  iconSrc,
  inbound,
  inboundColor: 'bg-sky-400/35',
  inboundLabel,
  outbound,
  outboundColor: 'bg-cyan-400',
  outboundLabel,
  subtitle,
  ticker,
  title,
  titleClassName,
  totalLabel,
})
