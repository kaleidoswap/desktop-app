import {
  ArrowLeftRight,
  CircleHelp,
  History,
  Menu,
  Settings,
  UsersRound,
  Wallet,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import {
  MAINNET_ACTIVITY_PATH,
  MAINNET_MARKET_PATH,
  MAINNET_NODE_PATH,
  MAINNET_SETTINGS_PATH,
  MAINNET_WALLET_PATH,
  P2P_ACTIVITY_PATH,
  P2P_BALANCE_PATH,
  P2P_NODE_PATH,
  P2P_SETTINGS_PATH,
  P2P_TRADE_PATH,
  P2P_WALLET_PATH,
  SETTINGS_PATH,
  WALLET_DASHBOARD_PATH,
  WALLET_SETUP_PATH,
} from '../../app/router/paths'
import { useAppSelector } from '../../app/store/hooks'
import type { BitcoinNetwork } from '../../constants'
import logoFull from '../../assets/logo-full.svg'
import { NetworkPicker } from '../../routes/p2p-home/NetworkPicker'
import { lastWalletContext } from '../../routes/p2p-home/navigation'
import { rememberNodeWalletNetwork } from '../../routes/p2p-home/networks'
import { AppVersion } from '../AppVersion'
import { SupportModal } from '../SupportModal'
import { LanguagePicker } from './LanguagePicker'

export type DesktopSection =
  'wallet' | 'market' | 'activity' | 'node' | 'settings' | 'accounts'
type Context = 'mainnet' | 'test' | 'node'

interface Props {
  context: Context
  section: DesktopSection
  title: string
  children: ReactNode
  headerActions?: ReactNode
  navigationLocked?: boolean
  setupNetwork?: BitcoinNetwork
  secondaryNav?: ReactNode
  onHelp?: () => void
}

interface Entry {
  section: DesktopSection
  to: string
  label: string
  icon: LucideIcon
}

const linkClass =
  'flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium focus-visible:outline-primary'
const idleClass = 'text-[#bccdc7] hover:bg-[#26332f] hover:text-white'

export function DesktopFrame({
  context,
  section,
  title,
  children,
  headerActions,
  secondaryNav,
  onHelp,
  setupNetwork,
  navigationLocked = false,
}: Props) {
  const { t } = useTranslation()
  const location = useLocation()
  const [openAt, setOpenAt] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const mobileOpen = !navigationLocked && openAt === location.key
  const account = useAppSelector((state) => state.nodeSettings.data)
  const hasNode = context === 'node' && Boolean(account.name)
  const walletContext = hasNode
    ? account.network === 'Mainnet'
      ? 'mainnet'
      : 'test'
    : context === 'node'
      ? lastWalletContext()
      : context
  const mainnet = walletContext === 'mainnet'
  const primary: Entry[] = [
    {
      icon: Wallet,
      label: t('p2pShell.wallet'),
      section: 'wallet',
      to: mainnet ? MAINNET_WALLET_PATH : P2P_BALANCE_PATH,
    },
    {
      icon: ArrowLeftRight,
      label: t('unified.market'),
      section: 'market',
      to: mainnet ? MAINNET_MARKET_PATH : P2P_TRADE_PATH,
    },
    {
      icon: History,
      label: t('unified.activity'),
      section: 'activity',
      to: mainnet ? MAINNET_ACTIVITY_PATH : P2P_ACTIVITY_PATH,
    },
    {
      icon: Zap,
      label: t('unified.node'),
      section: 'node',
      to: hasNode
        ? WALLET_DASHBOARD_PATH
        : mainnet
          ? MAINNET_NODE_PATH
          : P2P_NODE_PATH,
    },
  ]
  const utility: Entry[] = [
    {
      icon: Settings,
      label: t('navigation.settings'),
      section: 'settings',
      to: hasNode
        ? SETTINGS_PATH
        : mainnet
          ? MAINNET_SETTINGS_PATH
          : P2P_SETTINGS_PATH,
    },
    {
      icon: UsersRound,
      label: t('unified.accounts'),
      section: 'accounts',
      to: WALLET_SETUP_PATH,
    },
  ]

  const follow = (toWallet: boolean) => {
    setOpenAt(null)
    const fromNetwork = hasNode ? account.network : setupNetwork
    if (toWallet && !mainnet && fromNetwork)
      rememberNodeWalletNetwork(fromNetwork)
  }
  const renderEntry = (entry: Entry) => {
    const active = section === entry.section
    return (
      <Link
        aria-current={active ? 'page' : undefined}
        className={`${linkClass} ${active ? 'bg-[#30463e] text-[#b1f2ca]' : idleClass}`}
        key={entry.section}
        onClick={() =>
          follow(['wallet', 'market', 'activity'].includes(entry.section))
        }
        state={entry.section === 'accounts' ? { walletContext } : undefined}
        to={entry.to}
      >
        <entry.icon aria-hidden className="h-4 w-4 shrink-0" />
        {entry.label}
      </Link>
    )
  }

  return (
    <div className="flex h-dvh min-w-0 flex-col overflow-hidden bg-surface-base md:flex-row">
      <nav
        aria-label={t('p2pShell.menu')}
        className="z-40 flex shrink-0 flex-col bg-[#192321] text-[#edf8f2] md:w-52 md:overflow-y-auto"
        onKeyDown={(event) => {
          if (mobileOpen && event.key === 'Escape') {
            setOpenAt(null)
            menuButton.current?.focus()
          }
        }}
        ref={(element) => {
          if (element) element.inert = navigationLocked
        }}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-2 md:pb-6 md:pt-6">
          <Link
            aria-label={t('p2pShell.home')}
            onClick={() => follow(true)}
            to={mainnet ? MAINNET_WALLET_PATH : P2P_WALLET_PATH}
          >
            <img alt="KaleidoSwap" className="h-6" src={logoFull} />
          </Link>
          <button
            aria-controls="desktop-navigation"
            aria-expanded={mobileOpen}
            aria-label={t('navigation.menu')}
            className="grid h-9 w-10 place-items-center rounded-md hover:bg-[#26332f] md:hidden"
            onClick={() => setOpenAt(mobileOpen ? null : location.key)}
            ref={menuButton}
            type="button"
          >
            {mobileOpen ? (
              <X aria-hidden size={19} />
            ) : (
              <Menu aria-hidden size={19} />
            )}
          </button>
        </div>
        <div
          className={`${mobileOpen ? 'flex' : 'hidden'} max-h-[65dvh] flex-col overflow-y-auto px-3 pb-3 md:flex md:max-h-none md:flex-1 md:pb-5`}
          id="desktop-navigation"
        >
          <div className="flex flex-col gap-1">{primary.map(renderEntry)}</div>
          <div className="my-2 border-t border-[#374640] md:mt-auto" />
          <div className="flex flex-col gap-1">
            {utility.map(renderEntry)}
            <button
              className={`${linkClass} ${idleClass}`}
              onClick={() => {
                setOpenAt(null)
                if (onHelp) onHelp()
                else setHelpOpen(true)
              }}
              type="button"
            >
              <CircleHelp aria-hidden className="h-4 w-4 shrink-0" />
              {t('navigation.helpSupport')}
            </button>
          </div>
          <AppVersion className="relative mt-3 hidden self-center md:block" />
        </div>
      </nav>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-raised">
        <header className="relative z-30 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-divider/20 bg-surface-elevated px-3 py-2 sm:px-5">
          <strong className="mr-auto truncate text-sm font-semibold text-content-primary">
            {title}
          </strong>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div
              className="min-w-0"
              ref={(element) => {
                if (element) element.inert = navigationLocked
              }}
            >
              <NetworkPicker
                context={
                  context === 'node' && !hasNode ? walletContext : context
                }
                setupNetwork={setupNetwork}
              />
            </div>
            <LanguagePicker />
            {headerActions}
          </div>
        </header>
        {secondaryNav}
        <div className="relative min-h-0 min-w-0 flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
      {!onHelp && (
        <SupportModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
      )}
    </div>
  )
}
