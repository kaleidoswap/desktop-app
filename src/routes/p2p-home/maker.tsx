import { MakerSection } from '../trade/nostr-p2p/maker/MakerSection'
import { useP2pSession } from '../trade/nostr-p2p/session'

/** Being a maker in the P2P app: launch a token, set a strategy, sign the policy, watch it live. */
export const Component = () => {
  const { config } = useP2pSession()
  if (!config) return null
  return <MakerSection network={config.network} networkKey={config.key} />
}
