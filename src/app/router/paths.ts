const BASE_PATH = '/'
const makePath = (paths: string[]) => {
  if (paths.length === 0) return BASE_PATH
  if (paths.length === 1) return `${BASE_PATH}${paths[0]}`
  if (paths.length === 2) return paths.join('/')
  return ''
}

export const ROOT_PATH = makePath([])

export const WALLET_SETUP_PATH = makePath(['wallet-setup'])

export const WALLET_INIT_PATH = makePath(['init'])

export const WALLET_REMOTE_PATH = makePath(['wallet-config'])

export const WALLET_RESTORE_PATH = makePath(['wallet-restore'])

export const WALLET_UNLOCK_PATH = makePath(['wallet-unlock'])

export const TRADE_PATH = makePath(['trade'])

export const TRADE_MARKET_MAKER_PATH = makePath(['market-maker'])
export const TRADE_MANUAL_PATH = makePath(['manual'])
export const TRADE_NOSTR_P2P_PATH = makePath(['nostr-p2p'])

export const WALLET_DASHBOARD_PATH = makePath(['wallet-dashboard'])

export const SETTINGS_PATH = makePath(['settings'])

export const WALLET_HISTORY_PATH = makePath(['wallet-history'])

export const WALLET_HISTORY_DEPOSITS_PATH = makePath([
  WALLET_HISTORY_PATH,
  'deposits',
])
export const WALLET_HISTORY_WITHDRAWALS_PATH = makePath([
  WALLET_HISTORY_PATH,
  'withdrawals',
])
export const WALLET_HISTORY_TRADES_PATH = makePath([
  WALLET_HISTORY_PATH,
  'trades',
])

export const WALLET_HISTORY_ASSETS_PATH = makePath([
  WALLET_HISTORY_PATH,
  'assets',
])

export const CHANNELS_PATH = makePath(['channels'])

export const CREATE_NEW_CHANNEL_PATH = makePath(['create-new-channel'])
export const ORDER_CHANNEL_PATH = makePath(['order-new-channel'])

export const CREATEUTXOS_PATH = makePath(['createutxos'])
