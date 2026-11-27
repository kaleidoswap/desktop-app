import { buttonVariants, cn } from 'kaleido-ui'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import {
  MAINNET_ACTIVITY_PATH,
  MAINNET_SETTINGS_PATH,
  MAINNET_WALLET_PATH,
  P2P_ACTIVITY_PATH,
  P2P_SETTINGS_PATH,
  P2P_BALANCE_PATH,
  SETTINGS_PATH,
  WALLET_HISTORY_DEPOSITS_PATH,
  WALLET_DASHBOARD_PATH,
} from '../../app/router/paths'
import { useAppSelector } from '../../app/store/hooks'
import { useOptionalP2pSession } from '../trade/nostr-p2p/session'
import { saveNetwork } from '../trade/nostr-p2p/wallets'
import { nodeWalletNetworkKey, useDesktopTestNetworks } from './networks'

const destinations = {
  activity: {
    label: 'unified.activitySource',
    mainnet: MAINNET_ACTIVITY_PATH,
    node: WALLET_HISTORY_DEPOSITS_PATH,
    trading: P2P_ACTIVITY_PATH,
  },
  settings: {
    label: 'unified.settingsSource',
    mainnet: MAINNET_SETTINGS_PATH,
    node: SETTINGS_PATH,
    trading: P2P_SETTINGS_PATH,
  },
  wallet: {
    label: 'unified.walletSource',
    mainnet: MAINNET_WALLET_PATH,
    node: WALLET_DASHBOARD_PATH,
    trading: P2P_BALANCE_PATH,
  },
} as const

/** Each source opens its own wallet backend and only offers a switch on the same chain. */
export function WalletNodeSources({
  section,
  source,
}: {
  section: keyof typeof destinations
  source: 'node' | 'mainnet' | 'trading'
}) {
  const { t } = useTranslation()
  const account = useAppSelector((state) => state.nodeSettings.data)
  const session = useOptionalP2pSession()
  const mainnet = account.network === 'Mainnet'
  const needsTestNetworks = source === 'node' && !!account.name && !mainnet
  const networks = useDesktopTestNetworks(
    needsTestNetworks ? undefined : (session?.networks ?? [])
  )
  const networkKey = nodeWalletNetworkKey(account.network)
  const testWallet = networks.find((option) => option.key === networkKey)
  const sameChain =
    source === 'node'
      ? mainnet || Boolean(testWallet)
      : source === 'mainnet'
        ? mainnet
        : Boolean(session?.config && session.config.key === networkKey)
  if (!account.name || !sameChain) return null

  const paths = destinations[section]
  const walletLabel = mainnet
    ? 'p2pShell.wallet'
    : 'p2pMarket.funds.tradingTitle'
  const links = [
    {
      current: source !== 'node',
      label: t(section === 'wallet' ? 'unified.onchainWallet' : walletLabel),
      onClick: testWallet ? () => saveNetwork(testWallet.key) : undefined,
      to: mainnet ? paths.mainnet : paths.trading,
    },
    {
      current: source === 'node',
      label: t(section === 'wallet' ? 'unified.nodeWallet' : 'unified.node'),
      to: paths.node,
    },
  ]
  return (
    <nav
      aria-label={t(paths.label)}
      className="mb-4 flex w-fit max-w-full flex-wrap gap-1 rounded-xl bg-surface-card p-1"
    >
      {links.map(({ current, label, to, onClick }) =>
        current ? (
          <span
            aria-current="page"
            className={cn(
              buttonVariants({ size: 'sm', variant: 'surface' }),
              'text-brand'
            )}
            key={to}
          >
            {label}
          </span>
        ) : (
          <Link
            className={buttonVariants({ size: 'sm', variant: 'quiet' })}
            key={to}
            onClick={onClick}
            to={to}
          >
            {label}
          </Link>
        )
      )}
    </nav>
  )
}
