import {
  DecodeInvoiceResponse,
  DecodeRgbInvoiceResponse,
  NiaAsset,
} from '../../../../slices/nodeApi/nodeApi.slice'

// Use the same enum values as in nodeApi.slice.ts
export enum HTLCStatus {
  Pending = 'Pending',
  Succeeded = 'Succeeded',
  Failed = 'Failed',
}

// Form field interface
export interface Fields {
  address: string
  amount: number | string
  fee_rate: string
  asset_id: string
  network: 'on-chain' | 'lightning'
  decodedInvoice?: DecodeInvoiceResponse | null
  donation?: boolean // Whether this is a gift/donation transfer (RGB only)
}

// Fee estimation interface
export interface FeeEstimations {
  fast: number
  normal: number
  slow: number
}

// Address type enum
export type AddressType =
  | 'unknown'
  | 'bitcoin'
  | 'lightning'
  | 'lightning-address'
  | 'rgb'
  | 'invalid'

// Payment status type
export type PaymentStatus = HTLCStatus | 'Expired' | null

// Asset option interface
export interface AssetOption {
  label: string
  value: string
}

// Fee rate option interface
export interface FeeRateOption {
  label: string
  rate: number
  value: string
}

// LightningInvoiceDetails component props
export interface LightningInvoiceDetailsProps {
  decodedInvoice: DecodeInvoiceResponse
  assets: {
    data?: {
      nia: NiaAsset[]
    }
  }
  bitcoinUnit: string
  maxLightningCapacity: number
  fetchAssetBalance: (assetId: string) => Promise<void>
}

// RGBInvoiceDetails component props
export interface RGBInvoiceDetailsProps {
  decodedRgbInvoice: DecodeRgbInvoiceResponse
  assets: {
    data?: {
      nia: NiaAsset[]
    }
  }
  bitcoinUnit: string
}

// PaymentStatus component props
export interface PaymentStatusProps {
  paymentStatus: PaymentStatus
  isPollingStatus: boolean
}

// BalanceDisplay component props
export interface BalanceDisplayProps {
  addressType: AddressType
  assetId: string
  assetBalance: number
  bitcoinUnit: string
  assets: {
    data?: {
      nia: NiaAsset[]
    }
  }
}

// ConfirmationModal component props
export interface ConfirmationModalProps {
  pendingData: Fields | null
  availableAssets: AssetOption[]
  bitcoinUnit: string
  feeRates: FeeRateOption[]
  customFee: number
  assets: any
  isConfirming: boolean
  onCancel: () => void
  onConfirm: () => void
  validationError?: string | null
  paymentStatus?: PaymentStatus
  isPollingStatus?: boolean
  paymentHash?: string | null
}

// WithdrawForm component props
export interface WithdrawFormProps {
  form: any
  addressType: AddressType
  validationError: string | null
  clearValidationError: () => void
  isDecodingInvoice: boolean
  showAssetDropdown: boolean
  decodedInvoice: DecodeInvoiceResponse | null
  decodedRgbInvoice: DecodeRgbInvoiceResponse | null
  maxLightningCapacity: number
  maxAssetCapacities: Record<string, number>
  assetId: string
  assetBalance: number
  bitcoinUnit: string
  availableAssets: AssetOption[]
  feeRates: FeeRateOption[]
  feeRate: string
  customFee: number
  paymentStatus: PaymentStatus
  isPollingStatus: boolean
  assets: {
    data?: {
      nia: NiaAsset[]
    }
  }
  handleInvoiceChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handlePasteFromClipboard: () => void
  setShowAssetDropdown: (show: boolean) => void
  setValue: (name: string, value: any) => void
  fetchBtcBalance: () => Promise<void>
  fetchAssetBalance: (assetId: string) => Promise<void>
  getMinAmount: () => number
  getMinAmountMessage: () => string
  getFeeIcon: (type: string) => JSX.Element
  setCustomFee: (value: number) => void
  onSubmit: (data: Fields) => void
}
