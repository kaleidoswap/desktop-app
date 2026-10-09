import type { CatalogModel, MindHardware } from '../../api/mind'

export function modelMemoryBudgetGb(hardware: MindHardware): number {
  const total = hardware.totalMemoryBytes / 1024 ** 3
  return Math.max(0, total - Math.max(2, total * 0.25))
}

export function getRecommendedModelId(
  catalog: CatalogModel[],
  hardware?: MindHardware | null
): string | undefined {
  const recommended = catalog.find((model) => model.recommended) ?? catalog[0]
  if (!hardware || hardware.totalMemoryBytes <= 0)
    return recommended?.id ?? catalog[0]?.id
  const budget = modelMemoryBudgetGb(hardware)
  const fits = catalog.filter(
    (model) => model.ramHintGb > 0 && model.ramHintGb <= budget
  )
  return (
    fits.find((model) => model.id === recommended?.id)?.id ??
    fits.sort((a, b) => b.ramHintGb - a.ramHintGb)[0]?.id
  )
}
