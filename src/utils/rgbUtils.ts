import { Assignment, NiaAsset } from '../slices/nodeApi/nodeApi.slice'
import listings from '../constants/rgb-asset-listings.json'

// Sources for the pinned on-chain BFA contracts:
// Signet: https://github.com/UTEXO-Protocol/rgb-lib-wasm/issues/134#issuecomment-7102964005
// Mainnet: https://github.com/UTEXO-Protocol/enclave-signer/releases/tag/prod-mainnet-v0.1.0
// Mutinynet: https://faucet.mutinynet.kaleidoswap.com/api/info (onchain rail).
export function onchainUsdtId(network: string | undefined): string | undefined {
  if (!network || !Object.hasOwn(listings, network)) return undefined
  return listings[network as keyof typeof listings].find(
    (listing) => listing.ticker === 'USDT'
  )?.asset_id
}

// An issuer may choose the same ticker as USDT or BTC. Only the chain's pinned
// USDT contract gets its brand icon in on-chain asset lists.
export function rgbIconTicker(
  id: string,
  ticker: string,
  network: string | undefined
): string {
  const pinned = onchainUsdtId(network)
  if (pinned && id === pinned) return 'USDT'
  return ['BTC', 'USDT', 'USDT0', 'USD₮'].includes(ticker.toUpperCase())
    ? ''
    : ticker
}

// Helper function to extract amount from assignment
export const getAssignmentAmount = (assignment: Assignment): number => {
  switch (assignment.type) {
    case 'Fungible':
      return assignment.value || 0
    case 'InflationRight':
      return assignment.value || 0
    case 'Any':
    case 'NonFungible':
    case 'ReplaceRight':
    default:
      return 0
  }
}

interface ListAssetsLike {
  bfa?: unknown[] | null
  nia?: unknown[] | null
  cfa?: unknown[] | null
  uda?: unknown[] | null
  ifa?: unknown[] | null
}

/**
 * Combine the asset schemas returned by `listassets`
 * into a single display-ready list.
 *
 * Historically the dashboard and most asset lists only read `data.nia`, so a
 * received collectible (CFA), unique (UDA) or inflatable (IFA) asset never
 * showed up even though the node knew about it. CFA assets carry no `ticker`,
 * so we fall back to `name` (then asset_id) to keep a stable display label.
 */
export type WalletRgbAsset = NiaAsset & { schema: string }

export const getAllRgbAssets = (
  data: ListAssetsLike | undefined | null
): WalletRgbAsset[] => {
  if (!data) return []
  const groups = ['nia', 'cfa', 'uda', 'ifa', 'bfa'] as const
  return groups.flatMap((schema) =>
    (data[schema] ?? []).map((asset) => {
      const a = asset as Record<string, unknown>
      return {
        ...a,
        schema: schema.toUpperCase(),
        ticker: a.ticker ?? a.name ?? a.asset_id,
      } as WalletRgbAsset
    })
  )
}
