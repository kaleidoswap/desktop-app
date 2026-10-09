export interface PickerAsset {
  asset_id: string
  ticker: string
  name?: string
  hasBalance: boolean
}

export const isUsdt = (a: { ticker?: string | null; name?: string | null }) =>
  a.ticker?.toUpperCase() === 'USDT' || /tether usd/i.test(a.name ?? '')

/**
 * Order of the "other assets" slider: recently deposited first (most recent
 * first), then assets the wallet holds, then alphabetical. `exclude` drops the
 * asset pinned as a large tile (USDT).
 */
export const orderOtherAssets = (
  assets: PickerAsset[],
  recent: string[],
  exclude?: string
): PickerAsset[] => {
  const rank = (a: PickerAsset) => {
    const r = recent.indexOf(a.asset_id)
    return r === -1 ? Number.MAX_SAFE_INTEGER : r
  }
  return assets
    .filter((a) => a.asset_id !== exclude)
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        Number(b.hasBalance) - Number(a.hasBalance) ||
        a.ticker.localeCompare(b.ticker)
    )
}
