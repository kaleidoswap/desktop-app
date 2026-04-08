import { KaleidoClient } from 'kaleido-sdk'
import { NodeApiWrapper } from './node-api-wrapper'

export interface MinimalState {
  nodeSettings: {
    data?: {
      node_url?: string
      bearer_token?: string
      default_maker_url?: string
    } | null
  }
}

let clientInstance: KaleidoClient | null = null
let nodeApiWrapper: NodeApiWrapper | null = null
let currentBaseUrl: string | null = null
let currentNodeUrl: string | null = null
let currentAuthToken: string | null = null

export const buildLocalNodeUrl = (port: string | number): string =>
  `http://127.0.0.1:${port}`

export const normalizeNodeUrl = (
  nodeUrl?: string | null
): string | undefined => {
  if (!nodeUrl) return undefined

  try {
    const normalizedUrl = new URL(nodeUrl)
    if (normalizedUrl.hostname === 'localhost') {
      normalizedUrl.hostname = '127.0.0.1'
    }
    return normalizedUrl.toString().replace(/\/$/, '')
  } catch {
    return nodeUrl
  }
}

export const getKaleidoClient = async (
  state: MinimalState
): Promise<KaleidoClient> => {
  const nodeUrl = normalizeNodeUrl(state.nodeSettings.data?.node_url)
  const authToken = state.nodeSettings.data?.bearer_token
  const baseUrl =
    state.nodeSettings.data?.default_maker_url || 'http://localhost:8000'

  // Check if we need to recreate the client
  // - If it doesn't exist
  // - If config changed
  const needsRecreate =
    !clientInstance ||
    currentNodeUrl !== (nodeUrl ?? null) ||
    currentAuthToken !== (authToken ?? null) ||
    currentBaseUrl !== baseUrl

  if (needsRecreate) {
    // Create new instance with the TypeScript SDK using static factory
    clientInstance = KaleidoClient.create({
      apiKey: authToken,
      baseUrl,
      nodeUrl,
      timeout: 60,
    })

    // Create wrapper instance
    nodeApiWrapper = new NodeApiWrapper(clientInstance.rln)

    currentBaseUrl = baseUrl
    currentNodeUrl = nodeUrl ?? null
    currentAuthToken = authToken ?? null
  }

  // At this point clientInstance is guaranteed to be non-null
  return clientInstance!
}

/**
 * Get the Node API wrapper with enhanced error handling and request defaults
 */
export const getNodeApiWrapper = async (
  state: MinimalState
): Promise<NodeApiWrapper> => {
  // Ensure client is initialized
  await getKaleidoClient(state)

  // At this point nodeApiWrapper is guaranteed to be non-null
  return nodeApiWrapper!
}
