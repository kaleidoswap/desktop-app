import { buttonVariants, cn, Icon } from 'kaleido-ui'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import {
  MAINNET_MARKET_PATH,
  P2P_TRADE_PATH,
  TRADE_MARKET_MAKER_PATH,
} from '../../app/router/paths'
import { useAppSelector } from '../../app/store/hooks'
import {
  nodeWalletNetworkKey,
  rememberNodeWalletNetwork,
  useDesktopTestNetworks,
} from '../../routes/p2p-home/networks'

export function MarketVenues({
  context,
  nostr = context !== 'node',
}: {
  context: 'mainnet' | 'test' | 'node'
  nostr?: boolean
}) {
  const { t } = useTranslation()
  const account = useAppSelector((state) => state.nodeSettings.data)
  const networks = useDesktopTestNetworks(context === 'node' ? undefined : [])
  const mainnet =
    context === 'mainnet' ||
    (context === 'node' && account.network === 'Mainnet')
  const nodeKey = nodeWalletNetworkKey(account.network)
  const walletMarket = mainnet ? MAINNET_MARKET_PATH : P2P_TRADE_PATH
  const canOpenBook =
    context !== 'node' || mainnet || networks.some(({ key }) => key === nodeKey)
  const venues = [
    {
      active: nostr,
      icon: 'hub' as const,
      label: t('unified.nostrVenue'),
      onClick:
        context === 'node' && !mainnet
          ? () => rememberNodeWalletNetwork(account.network)
          : undefined,
      to: canOpenBook ? walletMarket : undefined,
    },
    {
      active: !nostr,
      icon: 'bolt' as const,
      label: t('unified.lightningVenue'),
      to:
        context === 'node'
          ? TRADE_MARKET_MAKER_PATH
          : walletMarket + '?venue=lightning',
    },
  ]
  return (
    <nav
      aria-label={t('unified.markets')}
      className="flex shrink-0 flex-wrap gap-1 border-b border-divider/20 bg-surface-elevated px-3 py-2 sm:px-5"
    >
      {venues.map(({ active, icon, label, onClick, to }) => {
        const className = cn(
          buttonVariants({ size: 'sm', variant: active ? 'ghost' : 'quiet' }),
          active && 'bg-primary/10 text-brand'
        )
        const content = (
          <>
            <Icon name={icon} size="sm" />
            {label}
          </>
        )
        if (active)
          return (
            <span aria-current="page" className={className} key={icon}>
              {content}
            </span>
          )
        if (!to)
          return (
            <span
              aria-disabled="true"
              className={cn(className, 'opacity-60')}
              key={icon}
              title={t('p2pMarket.noNetwork')}
            >
              {content}
            </span>
          )
        return (
          <Link className={className} key={icon} onClick={onClick} to={to}>
            {content}
          </Link>
        )
      })}
    </nav>
  )
}
