import { Assignment, NiaAsset } from '../slices/nodeApi/nodeApi.slice'

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
  nia?: unknown[] | null
  cfa?: unknown[] | null
  uda?: unknown[] | null
  ifa?: unknown[] | null
}

/**
 * Combine every RGB asset schema (NIA, CFA, UDA, IFA) returned by `listassets`
 * into a single display-ready list.
 *
 * Historically the dashboard and most asset lists only read `data.nia`, so a
 * received collectible (CFA), unique (UDA) or inflatable (IFA) asset never
 * showed up even though the node knew about it. CFA assets carry no `ticker`,
 * so we fall back to `name` (then asset_id) to keep a stable display label.
 */
export const getAllRgbAssets = (
  data: ListAssetsLike | undefined | null
): NiaAsset[] => {
  if (!data) return []
  return [
    ...(data.nia ?? []),
    ...(data.cfa ?? []),
    ...(data.uda ?? []),
    ...(data.ifa ?? []),
  ].map((asset) => {
    const a = asset as Record<string, unknown>
    return {
      ...a,
      ticker:
        (a.ticker as string) ?? (a.name as string) ?? (a.asset_id as string),
    } as NiaAsset
  })
}
