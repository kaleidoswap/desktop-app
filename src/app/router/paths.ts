const BASE_PATH = '/'
const makePath = (paths: string[]) => {
  if (paths.length === 0) return BASE_PATH
  if (paths.length === 1) return `${BASE_PATH}${paths[0]}`
  if (paths.length === 2) return paths.join('/')
  return ''
}

// React Router matches these static routes case-insensitively and accepts trailing slashes.
export const desktopPathname = (pathname: string) =>
  pathname.replace(/\/+$/, '').toLowerCase() || BASE_PATH

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
/** The P2P market as an app of its own: no node, its own wallet. */
export const P2P_WALLET_PATH = makePath(['p2p'])
/** The P2P app's own pages, under its shell. */
export const P2P_TRADE_PATH = `${P2P_WALLET_PATH}/trade`
export const P2P_BALANCE_PATH = `${P2P_WALLET_PATH}/wallet`
export const P2P_ACTIVITY_PATH = `${P2P_WALLET_PATH}/activity`
export const P2P_NODE_PATH = `${P2P_WALLET_PATH}/node`
export const P2P_SETTINGS_PATH = `${P2P_WALLET_PATH}/settings`
export const MAINNET_PATH = makePath(['mainnet'])
export const MAINNET_WALLET_PATH = `${MAINNET_PATH}/wallet`
export const MAINNET_ACTIVITY_PATH = `${MAINNET_PATH}/activity`
export const MAINNET_MARKET_PATH = `${MAINNET_PATH}/market`
export const MAINNET_SETTINGS_PATH = `${MAINNET_PATH}/settings`
export const MAINNET_NODE_PATH = `${MAINNET_PATH}/node`

export const TRADE_DCA_PATH = makePath(['dca'])
export const TRADE_LIMIT_PATH = makePath(['limit-orders'])

export const isNodeMarketPath = (pathname: string) =>
  [
    TRADE_PATH,
    TRADE_MARKET_MAKER_PATH,
    TRADE_MANUAL_PATH,
    TRADE_DCA_PATH,
    TRADE_LIMIT_PATH,
    TRADE_NOSTR_P2P_PATH,
  ].includes(desktopPathname(pathname))

export const WALLET_DASHBOARD_PATH = makePath(['wallet-dashboard'])

export const SETTINGS_PATH = makePath(['settings'])

export const NWC_PATH = makePath(['nwc'])

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

export const WALLET_HISTORY_CHANNEL_ORDERS_PATH = makePath([
  WALLET_HISTORY_PATH,
  'channel-orders',
])

export const CHANNELS_PATH = makePath(['channels'])

export const CREATE_NEW_CHANNEL_PATH = makePath(['create-new-channel'])
export const ORDER_CHANNEL_PATH = makePath(['order-new-channel'])

export const CREATEUTXOS_PATH = makePath(['createutxos'])

export const KALEIDO_MIND_PATH = makePath(['kaleido-mind'])
// Chat is the landing view (index of /kaleido-mind). The Brain overview moved to
// its own path so chat gets top billing.
export const KALEIDO_MIND_BRAIN_PATH = makePath([KALEIDO_MIND_PATH, 'brain'])
export const KALEIDO_MIND_MODELS_PATH = makePath([KALEIDO_MIND_PATH, 'models'])
export const KALEIDO_MIND_SKILLS_PATH = makePath([KALEIDO_MIND_PATH, 'skills'])
export const KALEIDO_MIND_CHAT_PATH = makePath([KALEIDO_MIND_PATH, 'chat'])
export const KALEIDO_MIND_AGENT_PATH = makePath([KALEIDO_MIND_PATH, 'agent'])
