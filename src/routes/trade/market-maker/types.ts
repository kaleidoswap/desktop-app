import { TradingPair } from '../../../slices/makerApi/makerApi.slice'
import { Channel, NiaAsset } from '../../../slices/nodeApi/nodeApi.slice'

export interface Fields {
  rfq_id: string
  from: string
  fromAsset: string
  to: string
  toAsset: string
}

export interface SwapExecutionParams {
  from: string
  fromAsset: string
  to: string
  toAsset: string
  rfq_id: string
}

export interface TradeContextProps {
  // State
  channels: Channel[]
  assets: NiaAsset[]
  tradablePairs: TradingPair[]
  selectedPair: TradingPair | null
  selectedSize: number
  minFromAmount: number
  maxFromAmount: number
  maxToAmount: number
  max_outbound_htlc_sat: number
  errorMessage: string | null
  isSwapInProgress: boolean

  // Functions
  formatAmount: (amount: number, asset: string) => string
  parseAssetAmount: (amount: string | undefined | null, asset: string) => number
  displayAsset: (asset: string) => string
  updateToAmount: (fromAmount: string) => void
  setFromAmount: (
    amount: number,
    fromAsset: string,
    percentageOfMax?: number
  ) => Promise<string | null>
  onSizeClick: (size: number) => Promise<void>
  onSwapAssets: () => Promise<void>
  handleAssetChange: (field: 'fromAsset' | 'toAsset', newValue: string) => void
  refreshAmounts: () => Promise<void>
}
