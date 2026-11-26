import { CircleHelp } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation } from 'react-router-dom'
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
  P2P_WALLET_PATH,
} from '../../app/router/paths'
import { Layout } from '../../components/Layout'
import {
  DesktopFrame,
  type DesktopSection,
} from '../../components/Layout/DesktopFrame'
import { P2pGate } from '../trade/nostr-p2p'
import {
  P2pSessionProvider,
  useOptionalP2pSession,
} from '../trade/nostr-p2p/session'
import { rememberProfile } from './navigation'
import { openGuide, P2pGuide } from './P2pGuide'

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
  accounts: 'unified.accounts',
  activity: 'unified.activity',
  market: 'unified.market',
  node: 'unified.node',
  settings: 'navigation.settings',
  wallet: 'p2pShell.wallet',
}
function Shell({ mainnet = false }: { mainnet?: boolean }) {
  const { t } = useTranslation()
  const session = useOptionalP2pSession()
  const pathname = desktopPathname(useLocation().pathname)
  useEffect(() => {
    rememberProfile(mainnet ? 'mainnet' : 'test')
  }, [mainnet])
  const section = sections[pathname] ?? 'wallet'
  return (
    <Layout walletActions={session?.phase === 'running'}>
      <DesktopFrame
        context={mainnet ? 'mainnet' : 'test'}
        headerActions={
          session?.phase === 'running' && (
            <button
              aria-label={t('p2pShell.guide')}
              className="rounded-md p-2 text-content-secondary hover:bg-surface-overlay"
              onClick={() => openGuide()}
              title={t('p2pShell.guide')}
              type="button"
            >
              <CircleHelp aria-hidden size={17} />
            </button>
          )
        }
        section={section}
        title={t(
          pathname === P2P_WALLET_PATH ? 'p2pShell.home' : labels[section]
        )}
      >
        <div className="mx-auto w-full max-w-screen-xl px-4 py-5 sm:px-6 sm:py-6">
          {session ? (
            <P2pGate key={session.account} session={session}>
              <Outlet />
              <P2pGuide />
            </P2pGate>
          ) : (
            <Outlet />
          )}
        </div>
      </DesktopFrame>
    </Layout>
  )
}

export const MainnetShell = () => <Shell mainnet />

export function Component() {
  const pathname = desktopPathname(useLocation().pathname)
  if (pathname === P2P_NODE_PATH) return <Shell />
  return (
    <P2pSessionProvider>
      <Shell />
    </P2pSessionProvider>
  )
}
