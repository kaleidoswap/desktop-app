import type { CatalogModel } from '../../api/mind'

export function getRecommendedModelId(
  catalog: CatalogModel[]
): string | undefined {
  return catalog.find((model) => model.recommended)?.id ?? catalog[0]?.id
}
