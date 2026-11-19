import {
  ArrowLeftRight,
  House,
  Rocket,
  Server,
  Settings,
  Wallet,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import {
  P2P_ACTIVITY_PATH,
  P2P_MAKER_PATH,
  P2P_SETTINGS_PATH,
  P2P_TRADE_PATH,
  P2P_WALLET_PATH,
  WALLET_SETUP_PATH,
} from '../../app/router/paths'
import logoFull from '../../assets/logo-full.svg'
import { AppVersion } from '../../components/AppVersion'
import { Layout } from '../../components/Layout'
import { P2pGate } from '../trade/nostr-p2p'
import { makerAvailableOn } from '../trade/nostr-p2p/maker/makerApi'
import { NetworkPicker } from './NetworkPicker'
import { P2pSessionProvider, useP2pSession } from '../trade/nostr-p2p/session'

const NavItem = ({
  to,
  icon,
  label,
  end,
}: {
  to: string
  icon: ReactNode
  label: string
  end?: boolean
}) => (
  <NavLink
    className={({ isActive }) =>
      `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-content-secondary hover:bg-surface-overlay/50 hover:text-content-primary'
      }`
    }
    end={end}
    to={to}
  >
    {icon}
    {label}
  </NavLink>
)

/** The menu of the P2P app: its pages, and the node it does not need yet. */
function Sidebar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { config } = useP2pSession()
  const maker = !!config && makerAvailableOn(config.network)

  return (
    <nav
      aria-label={t('p2pShell.menu', { defaultValue: 'Main' })}
      className="flex w-60 shrink-0 flex-col gap-1 border-r border-divider/10 bg-surface-base px-3 py-4"
    >
      <img
        alt="KaleidoSwap"
        className="mb-4 ml-2 h-7 self-start"
        src={logoFull}
      />
      <NetworkPicker className="mb-4" />
      <NavItem
        end
        icon={<House className="h-[18px] w-[18px]" />}
        label={t('p2pShell.home', { defaultValue: 'Home' })}
        to={P2P_WALLET_PATH}
      />
      <NavItem
        icon={<ArrowLeftRight className="h-[18px] w-[18px]" />}
        label={t('p2pShell.trade', { defaultValue: 'Trade' })}
        to={P2P_TRADE_PATH}
      />
      <NavItem
        icon={<Wallet className="h-[18px] w-[18px]" />}
        label={t('p2pShell.wallet', { defaultValue: 'Wallet' })}
        to={P2P_ACTIVITY_PATH}
      />
      {maker && (
        <NavItem
          icon={<Rocket className="h-[18px] w-[18px]" />}
          label={t('p2pShell.maker', { defaultValue: 'Maker' })}
          to={P2P_MAKER_PATH}
        />
      )}

      <div className="flex-1" />
      <div className="mx-1 mb-3 flex flex-col gap-2 rounded-xl border border-dashed border-divider/30 p-3">
        <span className="flex items-center gap-2 text-sm font-medium text-content-primary">
          <Server className="h-4 w-4 text-content-tertiary" />
          {t('p2pShell.nodeOff', { defaultValue: 'No Lightning node' })}
        </span>
        <span className="text-xs leading-relaxed text-content-tertiary">
          {t('p2pShell.nodeWhy', {
            defaultValue:
              'Connect one to add channels and instant Lightning swaps.',
          })}
        </span>
        <button
          className="self-start text-sm font-medium text-primary hover:underline"
          onClick={() => navigate(WALLET_SETUP_PATH)}
          type="button"
        >
          {t('p2pShell.connectNode', { defaultValue: 'Connect a node' })}
        </button>
      </div>
      <NavItem
        icon={<Settings className="h-[18px] w-[18px]" />}
        label={t('p2pShell.settings', { defaultValue: 'Settings' })}
        to={P2P_SETTINGS_PATH}
      />
      <AppVersion className="relative mt-3 self-center" />
    </nav>
  )
}

function Shell() {
  const session = useP2pSession()
  return (
    <div className="flex h-screen overflow-hidden bg-surface-base">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-screen-xl px-6 py-6">
          <P2pGate session={session}>
            <Outlet />
          </P2pGate>
        </div>
      </main>
    </div>
  )
}

/**
 * The P2P app: a wallet of its own and a market run by independent makers over Nostr, with no node
 * needed. One menu for its pages, and one trading wallet session that all of them share.
 */
export const Component = () => (
  <Layout>
    <P2pSessionProvider>
      <Shell />
    </P2pSessionProvider>
  </Layout>
)
