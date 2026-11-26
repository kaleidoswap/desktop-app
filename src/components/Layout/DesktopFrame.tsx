import {
  DrawerFooter,
  DrawerNavItem,
  DrawerSection,
  DrawerSidebar,
  Icon,
  IconButton,
  KaleidoswapLogo,
  type IconName,
} from 'kaleido-ui'
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
  icon: IconName
}

const drawerLabelClass =
  '[&>span:last-child]:min-w-0 [&>span:last-child]:whitespace-normal [&>span:last-child]:break-words [&>span:last-child]:text-left [&>span:last-child]:leading-tight'

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
      icon: 'account_balance_wallet',
      label: t('p2pShell.wallet'),
      section: 'wallet',
      to: mainnet ? MAINNET_WALLET_PATH : P2P_BALANCE_PATH,
    },
    {
      icon: 'swap_horiz',
      label: t('unified.market'),
      section: 'market',
      to: mainnet ? MAINNET_MARKET_PATH : P2P_TRADE_PATH,
    },
    {
      icon: 'history',
      label: t('unified.activity'),
      section: 'activity',
      to: mainnet ? MAINNET_ACTIVITY_PATH : P2P_ACTIVITY_PATH,
    },
    {
      icon: 'bolt',
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
      icon: 'settings',
      label: t('navigation.settings'),
      section: 'settings',
      to: hasNode
        ? SETTINGS_PATH
        : mainnet
          ? MAINNET_SETTINGS_PATH
          : P2P_SETTINGS_PATH,
    },
    {
      icon: 'person',
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
  const renderEntry = (entry: Entry) => (
    <DrawerNavItem
      active={section === entry.section}
      asChild
      className={drawerLabelClass}
      icon={<Icon name={entry.icon} size="md" />}
      key={entry.section}
      label={entry.label}
      title={entry.label}
    >
      <Link
        onClick={() =>
          follow(['wallet', 'market', 'activity'].includes(entry.section))
        }
        state={entry.section === 'accounts' ? { walletContext } : undefined}
        to={entry.to}
      />
    </DrawerNavItem>
  )

  return (
    <div className="flex h-dvh min-w-0 flex-col overflow-hidden bg-background md:flex-row">
      <DrawerSidebar
        className="z-40 h-auto w-full border-b md:h-full md:w-60 md:border-b-0"
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
        <div className="flex items-center justify-between gap-2 px-4 py-2 md:px-6 md:py-6">
          <Link
            aria-label={t('p2pShell.home')}
            className="rounded-md text-foreground focus-visible:outline-ring"
            onClick={() => follow(true)}
            to={mainnet ? MAINNET_WALLET_PATH : P2P_WALLET_PATH}
          >
            <KaleidoswapLogo className="h-7 w-auto" title="" />
          </Link>
          <IconButton
            aria-controls="desktop-navigation"
            aria-expanded={mobileOpen}
            className="md:hidden"
            icon={mobileOpen ? 'close' : 'menu'}
            label={t('navigation.menu')}
            onClick={() => setOpenAt(mobileOpen ? null : location.key)}
            ref={menuButton}
            type="button"
          />
        </div>
        <nav
          aria-label={t('p2pShell.menu')}
          className={`${mobileOpen ? 'flex' : 'hidden'} max-h-[65dvh] min-h-0 flex-col gap-4 overflow-y-auto md:flex md:max-h-none md:flex-1`}
          id="desktop-navigation"
        >
          <DrawerSection className="px-3">
            {primary.map(renderEntry)}
          </DrawerSection>
          <DrawerFooter className="px-3 md:mt-auto">
            {utility.map(renderEntry)}
            <DrawerNavItem
              asChild
              className={drawerLabelClass}
              icon={<Icon name="help" size="md" />}
              label={t('navigation.helpSupport')}
            >
              <button
                className="w-full text-left"
                onClick={() => {
                  setOpenAt(null)
                  if (onHelp) onHelp()
                  else setHelpOpen(true)
                }}
                type="button"
              />
            </DrawerNavItem>
            <AppVersion className="relative mx-auto mt-2 hidden w-fit md:block" />
          </DrawerFooter>
        </nav>
      </DrawerSidebar>
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
