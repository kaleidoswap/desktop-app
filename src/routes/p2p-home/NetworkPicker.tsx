import { useTranslation } from 'react-i18next'

import { Picker } from '../trade/nostr-p2p/market/Picker'
import { useP2pSession } from '../trade/nostr-p2p/session'

const dot = (network: string) => (
  <span
    aria-hidden
    className={`h-2.5 w-2.5 flex-none rounded-full ${network === 'mainnet' ? 'bg-status-success' : 'bg-status-warning'}`}
  />
)

/**
 * Which network the P2P app trades on. Each network has its own wallets and market, so switching
 * restarts the trading wallet on the other one. Hidden when the app knows only one network.
 */
export function NetworkPicker({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  const { config, networks, setNetworkKey } = useP2pSession()
  if (!config || networks.length < 2) return null
  const about: Record<string, string> = {
    regtest: t('p2pNetwork.regtest', { defaultValue: 'Local test chain' }),
    signet: t('p2pNetwork.signet', {
      defaultValue: 'Public signet · test coins',
    }),
    signetcustom: t('p2pNetwork.signetcustom', {
      defaultValue: 'Custom signet · fast blocks, test coins',
    }),
  }
  return (
    <Picker
      className={className}
      label={t('p2pSettings.network', { defaultValue: 'Network' })}
      onChange={setNetworkKey}
      options={networks.map((n) => ({
        leading: dot(n.network),
        subtitle: about[n.network],
        title: n.label,
        value: n.key,
      }))}
      value={config.key}
      variant="pill"
    />
  )
}
