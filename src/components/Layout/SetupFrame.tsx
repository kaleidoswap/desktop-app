import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useBlocker, useLocation } from 'react-router-dom'
import {
  desktopPathname,
  WALLET_SETUP_PATH,
  WALLET_DASHBOARD_PATH,
  WALLET_REMOTE_PATH,
  WALLET_UNLOCK_PATH,
  WALLET_RESTORE_PATH,
} from '../../app/router/paths'
import { useAppSelector } from '../../app/store/hooks'
import type { BitcoinNetwork } from '../../constants'
import { lastWalletContext } from '../../routes/p2p-home/navigation'
import { DesktopFrame } from './DesktopFrame'

interface Props {
  children: ReactNode
  setupBusy?: boolean
  setupNetwork?: BitcoinNetwork
}

export function SetupFrame({
  children,
  setupBusy = false,
  setupNetwork,
}: Props) {
  const { t } = useTranslation()
  const { pathname: routePath, search, state } = useLocation()
  const pathname = desktopPathname(routePath)
  const accountNetwork = useAppSelector(
    (store) => store.nodeSettings.data.network
  )
  const network =
    pathname === WALLET_UNLOCK_PATH ? accountNetwork : setupNetwork
  const accounts =
    pathname === WALLET_SETUP_PATH &&
    new URLSearchParams(search).get('node') !== 'local'
  const previous = state?.walletContext
  const walletContext =
    previous === 'mainnet' || previous === 'test'
      ? previous
      : lastWalletContext()
  const context = accounts
    ? walletContext
    : network === 'Mainnet'
      ? 'mainnet'
      : 'test'

  // Keep a wallet operation and its in-memory recovery phrase mounted. The remote
  // connection may finish by handing its saved account directly to unlock.
  useBlocker(({ nextLocation }) => {
    if (!setupBusy) return false
    if (pathname === WALLET_REMOTE_PATH)
      return (
        nextLocation.pathname !== WALLET_UNLOCK_PATH &&
        nextLocation.pathname !== WALLET_DASHBOARD_PATH
      )
    if (
      pathname === WALLET_RESTORE_PATH &&
      nextLocation.pathname === WALLET_DASHBOARD_PATH
    )
      return false
    return true
  })
  return (
    <DesktopFrame
      context={context}
      navigationLocked={setupBusy}
      section={accounts ? 'accounts' : 'node'}
      setupNetwork={network}
      title={t(accounts ? 'unified.accounts' : 'unified.node')}
    >
      <div className="flex h-full min-h-0 flex-col">{children}</div>
    </DesktopFrame>
  )
}
