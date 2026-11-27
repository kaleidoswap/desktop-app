import {
  Button,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  PageHeader,
} from 'kaleido-ui'
import { Cloud, Server } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import {
  desktopPathname,
  MAINNET_NODE_PATH,
  P2P_NODE_PATH,
  P2P_TRADE_PATH,
  CHANNELS_PATH,
  WALLET_REMOTE_PATH,
  WALLET_SETUP_PATH,
} from '../../app/router/paths'
import { useAppDispatch, useAppSelector } from '../../app/store/hooks'
import { getNetworkDisplayName } from '../../constants'
import { setAppMode } from '../../slices/settings/settings.slice'
import {
  nodeWalletNetworkKey,
  useSelectedTestNetwork,
  useDesktopTestNetworks,
} from './networks'

export function TestNetworkGate() {
  const pathname = desktopPathname(useLocation().pathname)
  const { t } = useTranslation()
  const node = pathname === MAINNET_NODE_PATH
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col items-start gap-5">
      <PageHeader
        className="max-w-xl"
        description={
          node
            ? t('unified.nodeTestOnly', {
                defaultValue:
                  'Run a local RGB Lightning node or connect to a remote node on a test network.',
              })
            : t('unified.marketTestOnly', {
                defaultValue:
                  'Find and publish offers via Nostr. On test networks, trades settle on-chain using your separate trading wallet.',
              })
        }
        title={
          node
            ? t('unified.node', { defaultValue: 'Lightning node' })
            : t('unified.market', { defaultValue: 'P2P market' })
        }
        variant="page"
      />
      <Button asChild>
        <Link to={node ? P2P_NODE_PATH : P2P_TRADE_PATH}>
          {t('unified.switchTest', { defaultValue: 'Switch to test networks' })}
        </Link>
      </Button>
    </section>
  )
}

export function Component() {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const account = useAppSelector((s) => s.nodeSettings.data)
  const reachable = useAppSelector((s) => s.node.reachability === 'reachable')
  const networks = useDesktopTestNetworks()
  const selected = useSelectedTestNetwork(networks)
  const connected =
    account.name &&
    account.network !== 'Mainnet' &&
    reachable &&
    (!selected || selected.key === nodeWalletNetworkKey(account.network))
  const activateNode = () => dispatch(setAppMode('both'))
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col items-start gap-5">
      <PageHeader
        title={t('unified.node', { defaultValue: 'Lightning node' })}
        variant="page"
      />
      {connected && (
        <Button
          asChild
          className="h-auto min-h-11 max-w-full whitespace-normal py-2 text-left [overflow-wrap:anywhere]"
        >
          <Link onClick={activateNode} to={CHANNELS_PATH}>
            {t('unified.openNode', {
              defaultValue: 'Open {{name}} · {{network}}',
              name: account.name,
              network: getNetworkDisplayName(account.network),
            })}
          </Link>
        </Button>
      )}
      <Card aria-labelledby="node-setup-title" className="w-full" role="region">
        <CardHeader>
          <h2 className="text-subhead font-bold" id="node-setup-title">
            {t('launcher.setUpNode')}
          </h2>
          <CardDescription>{t('unified.nodeTestOnly')}</CardDescription>
        </CardHeader>
        <CardFooter className="flex-wrap gap-3">
          <Button asChild variant="surface">
            <Link
              onClick={activateNode}
              state={{ from: P2P_NODE_PATH }}
              to={`${WALLET_SETUP_PATH}?node=local`}
            >
              <Server aria-hidden size={18} />
              {t('launcher.cards.local', { defaultValue: 'Run a node here' })}
            </Link>
          </Button>
          <Button asChild variant="surface">
            <Link
              onClick={activateNode}
              state={{ from: P2P_NODE_PATH }}
              to={WALLET_REMOTE_PATH}
            >
              <Cloud aria-hidden size={18} />
              {t('launcher.cards.remote', { defaultValue: 'Connect a node' })}
            </Link>
          </Button>
        </CardFooter>
      </Card>
      <Button asChild className="px-0" size="sm" variant="link">
        <Link state={{ walletContext: 'test' }} to={WALLET_SETUP_PATH}>
          {t('unified.manageNodes')}
        </Link>
      </Button>
    </section>
  )
}
