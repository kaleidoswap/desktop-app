import type { BreezSdk } from '@breeztech/breez-sdk-spark'

export type WalletType = 'rln' | 'spark' | 'arkade'

export type WalletStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'syncing'

export type SparkNetwork = 'mainnet' | 'regtest' | 'testnet' | 'signet'
export interface SparkTokenBalance {
  tokenIdentifier: string
  balance: bigint
  tokenPublicKey: string
  name?: string
  ticker?: string
}

export interface SparkWalletConfig {
  mnemonic: string
  passphrase?: string
  network: SparkNetwork
  apiKey: string
  storageDir: string
  walletId?: string
  walletLabel?: string
}

export interface SparkWalletInfo {
  balanceSats: number
  sparkAddress: string
  bitcoinAddress: string
  network: string
  tokenBalances?: Map<string, SparkTokenBalance>
}

export interface SparkWalletInstance {
  id: string
  label: string
  config: SparkWalletConfig
  sdk: BreezSdk | null
  info: SparkWalletInfo | null
  status: WalletStatus
  error: string | null
  createdAt: number
}

export interface MultiWalletConfig {
  activeWalletId?: string
  wallets: Record<string, SparkWalletConfig>
  defaultNetwork: SparkNetwork
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
  walletId?: string
}

export interface SparkWalletState {
  // Legacy single wallet support (backward compatible)
  sdk: BreezSdk | null
  connected: boolean
  connecting: boolean
  info: SparkWalletInfo | null
  error: string | null
  payments: SparkPayment[]

  // Multi-wallet support
  wallets: Record<string, SparkWalletInstance>
  activeWalletId: string | null
  multiWalletEnabled: boolean
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
