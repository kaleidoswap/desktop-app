export const BTC_ASSET_ID: string = 'btc'
export const MIN_CHANNEL_CAPACITY = 50_000
export const MAX_CHANNEL_CAPACITY = 16_777_215
export const KALEIDOSWAP_LSP_URL = 'http://localhost:8000'
export const DEFAULT_RGB_ICON = 'rgb-symbol-color.svg'
export const COIN_ICON_URL =
  'https://raw.githubusercontent.com/alexandrebouttier/coinmarketcap-icons-cryptos/refs/heads/main/icons/'

export type BitcoinNetwork = 'Regtest' | 'Testnet' | 'Mainnet' | 'Signet'
// Error constants
export const ERROR_NOT_ENOUGH_UNCOLORED =
  'No uncolored UTXOs are available (hint: call createutxos)'
export const ERROR_INSUFFICIENT_ALLOCATION_SLOT =
  'Cannot open channel: InsufficientAllocationSlots'
export const ERROR_INSUFFICIENT_UTXOs = [
  ERROR_NOT_ENOUGH_UNCOLORED,
  ERROR_INSUFFICIENT_ALLOCATION_SLOT,
]
