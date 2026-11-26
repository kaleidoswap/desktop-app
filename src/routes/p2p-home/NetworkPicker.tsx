import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'kaleido-ui'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import {
  desktopPathname,
  MAINNET_NODE_PATH,
  MAINNET_PATH,
  P2P_NODE_PATH,
  WALLET_INIT_PATH,
  WALLET_REMOTE_PATH,
  WALLET_RESTORE_PATH,
  WALLET_SETUP_PATH,
  WALLET_UNLOCK_PATH,
} from '../../app/router/paths'
import { useAppSelector } from '../../app/store/hooks'
import { type BitcoinNetwork, getNetworkDisplayName } from '../../constants'
import { useOptionalP2pSession } from '../trade/nostr-p2p/session'
import { saveNetwork } from '../trade/nostr-p2p/wallets'
import { rememberWalletContext, switchNetworkPath } from './navigation'
import {
  nodeWalletNetworkKey,
  useSelectedTestNetwork,
  useDesktopTestNetworks,
} from './networks'

export function NetworkPicker({
  className = '',
  context,
  setupNetwork,
}: {
  className?: string
  context?: 'mainnet' | 'test' | 'node'
  setupNetwork?: BitcoinNetwork
}) {
  const { t } = useTranslation()
  const { pathname: routePath, search, state } = useLocation()
  const pathname = desktopPathname(routePath)
  const navigate = useNavigate()
  const session = useOptionalP2pSession()
  const account = useAppSelector((s) => s.nodeSettings.data)
  const networks = useDesktopTestNetworks(session?.networks)
  const selected = useSelectedTestNetwork(networks)
  const node = context === 'node' && !!account.name
  const nodeWizard =
    [
      WALLET_INIT_PATH,
      WALLET_REMOTE_PATH,
      WALLET_RESTORE_PATH,
      WALLET_UNLOCK_PATH,
    ].includes(pathname) ||
    (pathname === WALLET_SETUP_PATH &&
      new URLSearchParams(search).get('node') === 'local')
  const activeNetwork =
    node || (pathname === WALLET_UNLOCK_PATH && account.name)
      ? account.network
      : setupNetwork
  const mainnet = activeNetwork
    ? activeNetwork === 'Mainnet'
    : context === 'mainnet' || pathname.startsWith(`${MAINNET_PATH}/`)
  const shortTest = t('unified.test', { defaultValue: 'test' })
  const testOptions = networks.map((network) => ({
    title: `${network.label} · ${shortTest}`,
    value: network.key,
  }))
  const nodeKey = activeNetwork && nodeWalletNetworkKey(activeNetwork)
  if (
    activeNetwork &&
    nodeKey &&
    !mainnet &&
    !testOptions.some((option) => option.value === nodeKey)
  )
    testOptions.push({
      title: `${getNetworkDisplayName(activeNetwork)} · ${shortTest}`,
      value: nodeKey,
    })
  if (!networks.length)
    testOptions.push({
      title: t('unified.testNetworks', { defaultValue: 'Test networks' }),
      value: 'test',
    })
  const value = mainnet
    ? 'mainnet'
    : nodeKey
      ? nodeKey
      : (session?.config?.key ?? selected?.key ?? 'test')
  const options = [
    { title: 'Bitcoin Mainnet', value: 'mainnet' },
    ...testOptions,
  ]
  return (
    <Select
      onValueChange={(key) => {
        if (key === value) return
        if (networks.some((option) => option.key === key)) {
          if (session) session.setNetworkKey(key)
          else saveNetwork(key)
        }
        const nextMainnet = key === 'mainnet'
        if (node || nodeWizard) {
          navigate(nextMainnet ? MAINNET_NODE_PATH : P2P_NODE_PATH)
        } else if (pathname === WALLET_SETUP_PATH) {
          const walletContext = nextMainnet ? 'mainnet' : 'test'
          rememberWalletContext(walletContext)
          navigate(
            { pathname, search },
            { replace: true, state: { ...state, walletContext } }
          )
        } else if (nextMainnet !== mainnet) {
          navigate(switchNetworkPath(pathname, nextMainnet))
        } else if (!session && pathname !== P2P_NODE_PATH) {
          navigate(P2P_NODE_PATH)
        }
      }}
      value={value}
    >
      <SelectTrigger
        aria-label={t('p2pSettings.network', { defaultValue: 'Network' })}
        className={`min-h-9 ${className}`}
        compact
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        align="end"
        className="max-h-[var(--radix-select-content-available-height)]"
      >
        {options.map((option) => (
          <SelectItem
            key={option.value}
            textValue={option.title}
            value={option.value}
          >
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className={`h-2 w-2 shrink-0 rounded-full ${option.value === 'mainnet' ? 'bg-status-success' : 'bg-secondary-content'}`}
              />
              {option.title}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
