import {
  History,
  ArrowLeftRight,
  CircleHelp,
  Zap,
  Settings,
  Wallet,
} from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

import {
  MAINNET_ACTIVITY_PATH,
  MAINNET_MARKET_PATH,
  MAINNET_NODE_PATH,
  MAINNET_WALLET_PATH,
  P2P_ACTIVITY_PATH,
  P2P_BALANCE_PATH,
  P2P_NODE_PATH,
  P2P_SETTINGS_PATH,
  P2P_TRADE_PATH,
  P2P_WALLET_PATH,
  WALLET_SETUP_PATH,
} from '../../app/router/paths'
import logoFull from '../../assets/logo-full.svg'
import { AppVersion } from '../../components/AppVersion'
import { Layout } from '../../components/Layout'
import { P2pGate } from '../trade/nostr-p2p'
import {
  P2pSessionProvider,
  useOptionalP2pSession,
} from '../trade/nostr-p2p/session'
import { NetworkPicker } from './NetworkPicker'
import { rememberProfile } from './navigation'
import { openGuide, P2pGuide } from './P2pGuide'

const itemClass =
  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors'
const idle = 'text-[#bccdc7] hover:bg-[#26332f] hover:text-white'
function NavItem({
  to,
  icon,
  label,
}: {
  to: string
  icon: ReactNode
  label: string
}) {
  return (
    <NavLink
      className={({ isActive }) =>
        `${itemClass} ${isActive ? 'bg-[#30463e] text-[#b1f2ca]' : idle}`
      }
      end
      to={to}
    >
      {icon}
      {label}
    </NavLink>
  )
}

function Shell({ mainnet = false }: { mainnet?: boolean }) {
  const { t } = useTranslation()
  const session = useOptionalP2pSession()
  const { pathname } = useLocation()
  const node = pathname === P2P_NODE_PATH
  useEffect(() => {
    rememberProfile(mainnet ? 'mainnet' : node ? 'node' : 'test')
  }, [mainnet, node])
  const walletLabel = t('p2pShell.wallet', { defaultValue: 'Wallet' })
  const marketLabel = t('unified.market', { defaultValue: 'P2P market' })
  const nodeLabel = t('unified.node', { defaultValue: 'Lightning node' })
  const activityLabel = t('unified.activity', { defaultValue: 'Activity' })
  const sectionLabels: Record<string, string> = {
    [MAINNET_ACTIVITY_PATH]: activityLabel,
    [MAINNET_MARKET_PATH]: marketLabel,
    [MAINNET_NODE_PATH]: nodeLabel,
    [MAINNET_WALLET_PATH]: walletLabel,
    [P2P_ACTIVITY_PATH]: activityLabel,
    [P2P_BALANCE_PATH]: walletLabel,
    [P2P_NODE_PATH]: nodeLabel,
    [P2P_SETTINGS_PATH]: t('p2pShell.settings', { defaultValue: 'Settings' }),
    [P2P_TRADE_PATH]: marketLabel,
    [P2P_WALLET_PATH]: t('p2pShell.home', { defaultValue: 'Home' }),
  }
  const size = 'h-4 w-4 shrink-0'
  return (
    <Layout walletActions={session?.phase === 'running'}>
      <div className="flex h-screen flex-col overflow-hidden bg-surface-base md:flex-row">
        <nav
          aria-label={t('p2pShell.menu', { defaultValue: 'Main' })}
          className="flex shrink-0 flex-col gap-1 bg-[#192321] px-3 py-3 text-[#edf8f2] md:w-48 md:overflow-y-auto md:py-6"
        >
          <div className="flex items-center justify-between gap-2 md:flex-col md:items-stretch">
            <Link
              aria-label={
                mainnet
                  ? 'KaleidoSwap'
                  : t('p2pShell.home', { defaultValue: 'Home' })
              }
              className="ml-2 md:mb-6"
              to={mainnet ? MAINNET_WALLET_PATH : P2P_WALLET_PATH}
            >
              <img alt="KaleidoSwap" className="h-6" src={logoFull} />
            </Link>
          </div>
          <div className="flex flex-wrap md:flex-col md:gap-1">
            <NavItem
              icon={<Wallet className={size} />}
              label={walletLabel}
              to={mainnet ? MAINNET_WALLET_PATH : P2P_BALANCE_PATH}
            />
            <NavItem
              icon={<ArrowLeftRight className={size} />}
              label={marketLabel}
              to={mainnet ? MAINNET_MARKET_PATH : P2P_TRADE_PATH}
            />
            <NavItem
              icon={<History className={size} />}
              label={activityLabel}
              to={mainnet ? MAINNET_ACTIVITY_PATH : P2P_ACTIVITY_PATH}
            />
            <div className="mx-2 my-3 hidden border-t border-[#374640] md:block" />
            <NavItem
              icon={<Zap className={size} />}
              label={nodeLabel}
              to={mainnet ? MAINNET_NODE_PATH : P2P_NODE_PATH}
            />
          </div>
          <div className="hidden md:block md:flex-1" />
          <div className="flex flex-wrap md:flex-col">
            {session?.phase === 'running' && (
              <button
                className={`${itemClass} ${idle}`}
                onClick={() => openGuide()}
                type="button"
              >
                <CircleHelp className={size} />
                {t('p2pShell.guide', { defaultValue: 'Guide' })}
              </button>
            )}
            {session && (
              <NavItem
                icon={<Settings className={size} />}
                label={t('p2pShell.settings', { defaultValue: 'Settings' })}
                to={P2P_SETTINGS_PATH}
              />
            )}
            <Link
              className="px-3 py-2 text-sm text-[#bccdc7] hover:text-white"
              to={WALLET_SETUP_PATH}
            >
              {t('unified.accounts', {
                defaultValue: 'Accounts & KaleidoMind',
              })}
            </Link>
          </div>
          <AppVersion className="relative mt-3 hidden self-center md:block" />
        </nav>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-raised">
          <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-divider/20 bg-surface-elevated px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-2 text-xs text-content-secondary">
              <span className="hidden sm:block">Desktop</span>
              <span
                aria-hidden
                className="hidden text-content-tertiary sm:block"
              >
                /
              </span>
              <strong className="truncate font-semibold text-content-primary">
                {sectionLabels[pathname]}
              </strong>
            </div>
            <NetworkPicker className="min-w-0" />
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
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
          </div>
        </main>
      </div>
    </Layout>
  )
}

export const MainnetShell = () => <Shell mainnet />

export function Component() {
  const { pathname } = useLocation()
  if (pathname === P2P_NODE_PATH) return <Shell />
  return (
    <P2pSessionProvider>
      <Shell />
    </P2pSessionProvider>
  )
}
