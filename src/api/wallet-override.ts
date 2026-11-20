import type { NodeApiWrapper } from './node-api-wrapper'

/**
 * A wallet that answers the node API in place of the connected node. The P2P wallet sets one while
 * its pages are open, so the wallet screens (which ask `nodeApi`) show it without knowing the
 * difference. Nothing else sets it; null means the connected node.
 */
let override: NodeApiWrapper | null = null

export const setWalletOverride = (wrapper: NodeApiWrapper | null) => {
  override = wrapper
}

export const getWalletOverride = (): NodeApiWrapper | null => override
