import { invoke } from '@tauri-apps/api/core'
import {
  ArrowLeftRight,
  Brain,
  House,
  Server,
  Settings,
  Wallet,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import {
  KALEIDO_MIND_PATH,
  P2P_ACTIVITY_PATH,
  P2P_SETTINGS_PATH,
  P2P_TRADE_PATH,
  P2P_WALLET_PATH,
  WALLET_SETUP_PATH,
} from '../../app/router/paths'
import { useAppDispatch } from '../../app/store/hooks'
import logoFull from '../../assets/logo-full.svg'
import { AppVersion } from '../../components/AppVersion'
import { Layout } from '../../components/Layout'
import { nodeApi } from '../../slices/nodeApi/nodeApi.slice'
import { nodeSettingsActions } from '../../slices/nodeSettings/nodeSettings.slice'
import { setAppMode } from '../../slices/settings/settings.slice'
import { networkLabel } from '../trade/nostr-p2p/format'
import { P2pGate } from '../trade/nostr-p2p'
import { P2pSessionProvider, useP2pSession } from '../trade/nostr-p2p/session'
import { WalletSwitch } from '../trade/nostr-p2p/WalletSwitch'

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

/** The menu of the P2P app: its pages, the node it does not need yet, and the open wallet. */
function Sidebar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const session = useP2pSession()

  // the same way into KaleidoMind as the start screen's: without a node
  const openMind = async () => {
    try {
      await invoke('set_current_account', { accountName: null })
    } catch {
      // Mind opens anyway; the node it would have shown is simply not connected
    }
    dispatch(nodeSettingsActions.resetNodeSettings())
    dispatch(nodeApi.util.resetApiState())
    dispatch(setAppMode('mind'))
    navigate(KALEIDO_MIND_PATH)
  }

  return (
    <nav
      aria-label={t('p2pShell.menu', { defaultValue: 'Main' })}
      className="flex w-60 shrink-0 flex-col gap-1 border-r border-divider/10 bg-surface-base px-3 py-4"
    >
      <img
        alt="KaleidoSwap"
        className="mb-5 ml-2 h-7 self-start"
        src={logoFull}
      />
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
      <button
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-content-secondary transition-colors hover:bg-surface-overlay/50 hover:text-content-primary"
        onClick={() => void openMind()}
        type="button"
      >
        <Brain className="h-[18px] w-[18px]" />
        KaleidoMind
      </button>

      <p className="mx-3 mb-1 mt-5 text-[11px] font-medium uppercase tracking-wider text-content-tertiary">
        {t('p2pShell.node', { defaultValue: 'Lightning node' })}
      </p>
      <div className="mx-1 flex flex-col gap-2 rounded-xl border border-dashed border-divider/30 p-3">
        <span className="flex items-center gap-2 text-sm font-medium text-content-primary">
          <Server className="h-4 w-4 text-content-tertiary" />
          {t('p2pShell.nodeOff', { defaultValue: 'Not connected' })}
        </span>
        <span className="text-xs leading-relaxed text-content-tertiary">
          {t('p2pShell.nodeWhy', {
            defaultValue:
              'Channels and instant Lightning swaps show up here once a node is connected.',
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

      <div className="flex-1" />
      <NavItem
        icon={<Settings className="h-[18px] w-[18px]" />}
        label={t('p2pShell.settings', { defaultValue: 'Settings' })}
        to={P2P_SETTINGS_PATH}
      />
      <div className="mt-2 flex flex-col gap-1.5 rounded-xl border border-divider/20 bg-surface-elevated/40 p-2">
        <WalletSwitch
          onCreate={session.addWallet}
          onSelect={session.chooseWallet}
          selectedId={session.walletId}
          wallets={session.wallets}
        />
        {session.config && (
          <span className="px-1 text-[11px] text-content-tertiary">
            {networkLabel(session.config.network)} ·{' '}
            {t('p2pShell.onchain', { defaultValue: 'on-chain RGB' })}
          </span>
        )}
      </div>
      <AppVersion className="relative mt-2 self-center" />
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
