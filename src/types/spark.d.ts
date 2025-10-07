import type { BreezSdk } from '@breeztech/breez-sdk-spark'

export type WalletType = 'rln' | 'spark'

export interface SparkWalletConfig {
  mnemonic: string
  passphrase?: string
  network: 'mainnet' | 'testnet' | 'signet'
  apiKey: string
  storageDir: string
}

export interface SparkWalletInfo {
  balanceSats: number
  sparkAddress: string
  bitcoinAddress: string
  network: string
}

export interface SparkPayment {
  id: string
  amount: number
  direction: 'incoming' | 'outgoing'
  status: 'pending' | 'completed' | 'failed'
  timestamp: number
  type: 'lightning' | 'onchain' | 'spark'
  description?: string
  paymentHash?: string
  address?: string
}

export interface SparkWalletState {
  sdk: BreezSdk | null
  connected: boolean
  connecting: boolean
  info: SparkWalletInfo | null
  error: string | null
  payments: SparkPayment[]
}

export interface PreparedPayment {
  paymentRequest: string
  amount: number
  fees: {
    lightning?: number
    onchain?: {
      slow: number
      medium: number
      fast: number
    }
    spark?: number
  }
}

export interface SendPaymentOptions {
  preferSpark?: boolean
  confirmationSpeed?: 'slow' | 'medium' | 'fast'
  completionTimeout?: number
}

export interface ReceivePaymentRequest {
  amount: number
  description?: string
  type: 'lightning' | 'onchain' | 'spark'
}
