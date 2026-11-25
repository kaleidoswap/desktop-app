import { Cloud, Server } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import {
  MAINNET_NODE_PATH,
  P2P_NODE_PATH,
  P2P_TRADE_PATH,
  WALLET_DASHBOARD_PATH,
  WALLET_REMOTE_PATH,
  WALLET_SETUP_PATH,
} from '../../app/router/paths'
import { useAppDispatch, useAppSelector } from '../../app/store/hooks'
import { getNetworkDisplayName } from '../../constants'
import { setAppMode } from '../../slices/settings/settings.slice'

const button =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground'
const secondary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-divider/30 px-4 py-2 text-sm font-medium text-content-primary hover:bg-surface-overlay/50'

export function TestNetworkGate() {
  const { pathname } = useLocation()
  const { t } = useTranslation()
  const node = pathname === MAINNET_NODE_PATH
  return (
    <section className="flex max-w-xl flex-col items-start gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-content-primary">
        {node
          ? t('unified.node', { defaultValue: 'Lightning node' })
          : t('unified.market', { defaultValue: 'P2P market' })}
      </h1>
      <p className="text-content-secondary">
        {node
          ? t('unified.nodeTestOnly', {
              defaultValue:
                'Run a local RGB Lightning node or connect to a remote node on a test network.',
            })
          : t('unified.marketTestOnly', {
              defaultValue:
                'Find and publish offers via Nostr. On test networks, trades settle on-chain using your separate trading wallet.',
            })}
      </p>
      <Link className={button} to={node ? P2P_NODE_PATH : P2P_TRADE_PATH}>
        {t('unified.switchTest', { defaultValue: 'Switch to test networks' })}
      </Link>
    </section>
  )
}

export function Component() {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const account = useAppSelector((s) => s.nodeSettings.data)
  const reachable = useAppSelector((s) => s.node.reachability === 'reachable')
  // The account picker handles locked, remote and local nodes through their existing unlock flow.
  const connected = account.name && account.network !== 'Mainnet' && reachable
  const activateNode = () => dispatch(setAppMode('both'))
  return (
    <section className="flex max-w-2xl flex-col items-start gap-5">
      <h1 className="text-2xl font-bold tracking-tight text-content-primary">
        {t('unified.node', { defaultValue: 'Lightning node' })}
      </h1>
      {connected && (
        <Link
          className={button}
          onClick={activateNode}
          to={WALLET_DASHBOARD_PATH}
        >
          {t('unified.openNode', {
            defaultValue: 'Open {{name}} · {{network}}',
            name: account.name,
            network: getNetworkDisplayName(account.network),
          })}
        </Link>
      )}
      <div className="flex flex-wrap gap-3">
        <Link
          className={secondary}
          onClick={activateNode}
          to={`${WALLET_SETUP_PATH}?node=local`}
        >
          <Server aria-hidden className="h-4 w-4" />
          {t('launcher.cards.local', { defaultValue: 'Run a node here' })}
        </Link>
        <Link
          className={secondary}
          onClick={activateNode}
          to={WALLET_REMOTE_PATH}
        >
          <Cloud aria-hidden className="h-4 w-4" />
          {t('launcher.cards.remote', { defaultValue: 'Connect a node' })}
        </Link>
      </div>
      <Link
        className="text-sm font-medium text-primary hover:underline"
        to={WALLET_SETUP_PATH}
      >
        {t('unified.manageNodes', { defaultValue: 'Manage node accounts' })}
      </Link>
    </section>
  )
}
