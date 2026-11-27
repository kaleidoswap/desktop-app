import { Button, PageHeader } from 'kaleido-ui'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import {
  desktopPathname,
  MAINNET_ACTIVITY_PATH,
  MAINNET_MARKET_PATH,
  MAINNET_NODE_PATH,
  MAINNET_SETTINGS_PATH,
  P2P_ACTIVITY_PATH,
  P2P_NODE_PATH,
  P2P_SETTINGS_PATH,
  P2P_TRADE_PATH,
  TRADE_MARKET_MAKER_PATH,
} from '../../app/router/paths'
import { Layout } from '../../components/Layout'
import { useAppSelector } from '../../app/store/hooks'
import {
  nodeWalletNetworkKey,
  useDesktopTestNetworks,
  useSelectedTestNetwork,
} from './networks'
import {
  DesktopFrame,
  type DesktopSection,
} from '../../components/Layout/DesktopFrame'
import { P2pGate } from '../trade/nostr-p2p'
import {
  P2pSessionProvider,
  useOptionalP2pSession,
} from '../trade/nostr-p2p/session'
import { WalletNodeSources } from './WalletNodeSources'
import { MarketVenues } from '../../components/Trade/MarketVenues'
import { rememberProfile } from './navigation'
import { P2pGuide } from './P2pGuide'

const sections: Record<string, DesktopSection> = {
  [MAINNET_ACTIVITY_PATH]: 'activity',
  [MAINNET_MARKET_PATH]: 'market',
  [MAINNET_NODE_PATH]: 'node',
  [MAINNET_SETTINGS_PATH]: 'settings',
  [P2P_ACTIVITY_PATH]: 'activity',
  [P2P_NODE_PATH]: 'node',
  [P2P_SETTINGS_PATH]: 'settings',
  [P2P_TRADE_PATH]: 'market',
}
const labels = {
  activity: 'unified.activity',
  market: 'unified.markets',
  mind: 'navigation.kaleidoMind',
  node: 'unified.node',
  settings: 'navigation.settings',
  wallet: 'p2pShell.wallet',
}
function MarketMakerEntry({ mainnet }: { mainnet: boolean }) {
  const { t } = useTranslation()
  const account = useAppSelector((state) => state.nodeSettings.data)
  const options = useDesktopTestNetworks(mainnet ? [] : undefined)
  const network = useSelectedTestNetwork(options)
  const sameNetwork = mainnet
    ? account.network === 'Mainnet'
    : network?.key === nodeWalletNetworkKey(account.network)
  if (account.name && sameNetwork)
    return <Navigate replace to={TRADE_MARKET_MAKER_PATH} />
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col items-start gap-4">
      <PageHeader
        description={t('unified.marketNodeHint')}
        title={t('navigation.marketMaker')}
        variant="page"
      />
      <Button asChild variant="surface">
        <Link to={mainnet ? MAINNET_NODE_PATH : P2P_NODE_PATH}>
          {t('launcher.cards.remote')}
        </Link>
      </Button>
    </section>
  )
}

function useLightningVenue() {
  const { pathname, search } = useLocation()
  const path = desktopPathname(pathname)
  return (
    (path === P2P_TRADE_PATH || path === MAINNET_MARKET_PATH) &&
    new URLSearchParams(search).get('venue') === 'lightning'
  )
}

function Shell({ mainnet = false }: { mainnet?: boolean }) {
  const { t } = useTranslation()
  const session = useOptionalP2pSession()
  const lightning = useLightningVenue()
  const pathname = desktopPathname(useLocation().pathname)
  useEffect(() => {
    rememberProfile(mainnet ? 'mainnet' : 'test')
  }, [mainnet])
  const section = sections[pathname] ?? 'wallet'
  return (
    <Layout walletActions={session?.phase === 'running'}>
      <DesktopFrame
        context={mainnet ? 'mainnet' : 'test'}
        secondaryNav={
          section === 'market' ? (
            <MarketVenues
              context={mainnet ? 'mainnet' : 'test'}
              nostr={!lightning}
            />
          ) : undefined
        }
        section={section}
        title={t(labels[section])}
      >
        <div className="mx-auto w-full max-w-screen-xl px-4 py-5 sm:px-6 sm:py-6">
          {(section === 'wallet' ||
            section === 'activity' ||
            section === 'settings') && (
            <WalletNodeSources
              section={section}
              source={mainnet ? 'mainnet' : 'trading'}
            />
          )}
          {lightning ? (
            <MarketMakerEntry mainnet={mainnet} />
          ) : session && section !== 'settings' ? (
            <P2pGate key={session.account} session={session}>
              <Outlet />
            </P2pGate>
          ) : (
            <Outlet />
          )}
          {session?.phase === 'running' && <P2pGuide />}
        </div>
      </DesktopFrame>
    </Layout>
  )
}

export const MainnetShell = () => <Shell mainnet />

export function Component() {
  const pathname = desktopPathname(useLocation().pathname)
  const lightning = useLightningVenue()
  if (pathname === P2P_NODE_PATH || lightning) return <Shell />
  return (
    <P2pSessionProvider>
      <Shell />
    </P2pSessionProvider>
  )
}
