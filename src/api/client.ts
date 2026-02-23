import { KaleidoClient } from 'kaleidoswap-sdk';
import { NodeApiWrapper } from './node-api-wrapper';

export interface MinimalState {
    nodeSettings: {
        data?: {
            node_url?: string;
            bearer_token?: string;
            default_maker_url?: string;
        } | null;
    };
}

let clientInstance: KaleidoClient | null = null;
let nodeApiWrapper: NodeApiWrapper | null = null;
let currentBaseUrl: string | null = null;
let currentNodeUrl: string | null = null;
let currentAuthToken: string | null = null;

export const getKaleidoClient = async (state: MinimalState): Promise<KaleidoClient> => {
    const nodeUrl = state.nodeSettings.data?.node_url;
    const authToken = state.nodeSettings.data?.bearer_token;
    const baseUrl = state.nodeSettings.data?.default_maker_url || 'http://localhost:8000';

    // Check if we need to recreate the client
    // - If it doesn't exist
    // - If config changed
    const needsRecreate =
        !clientInstance ||
        currentNodeUrl !== (nodeUrl ?? null) ||
        currentAuthToken !== (authToken ?? null) ||
        currentBaseUrl !== baseUrl;

    if (needsRecreate) {
        console.log('[Client] Creating KaleidoClient', {
            baseUrl,
            nodeUrl,
        });

        // Create new instance with the TypeScript SDK using static factory
        clientInstance = KaleidoClient.create({
            baseUrl,
            nodeUrl,
            apiKey: authToken,
        });

        // Create wrapper instance
        nodeApiWrapper = new NodeApiWrapper(clientInstance.rln);

        currentBaseUrl = baseUrl;
        currentNodeUrl = nodeUrl ?? null;
        currentAuthToken = authToken ?? null;
    }

    // At this point clientInstance is guaranteed to be non-null
    return clientInstance!;
};

/**
 * Get the Node API wrapper with enhanced error handling and request defaults
 */
export const getNodeApiWrapper = async (state: MinimalState): Promise<NodeApiWrapper> => {
    // Ensure client is initialized
    await getKaleidoClient(state);

    // At this point nodeApiWrapper is guaranteed to be non-null
    return nodeApiWrapper!;
};

