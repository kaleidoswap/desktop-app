import type { MindHardware, CatalogModel } from '../../api/mind'
import { modelMemoryBudgetGb } from './modelCatalog'

export function HardwareSummary({
  hardware,
}: {
  hardware: MindHardware | null
}) {
  if (!hardware || !hardware.totalMemoryBytes) return null
  return (
    <p className="mb-3 text-xs text-content-secondary">
      This device: {(hardware.totalMemoryBytes / 1024 ** 3).toFixed(0)} GB RAM ·{' '}
      {hardware.logicalCores} CPU cores. Recommendations leave memory for your
      system. Speed also depends on CPU and GPU.
    </p>
  )
}

export function ModelMemoryNotice({
  model,
  hardware,
}: {
  model: CatalogModel
  hardware: MindHardware | null
}) {
  if (!hardware || !hardware.totalMemoryBytes || model.ramHintGb <= 0)
    return null
  if (model.ramHintGb > modelMemoryBudgetGb(hardware))
    return (
      <p className="mt-1 text-xs text-status-warning">
        May not fit in this device&apos;s memory.
      </p>
    )
  if (model.ramHintGb * 1024 ** 3 > hardware.availableMemoryBytes)
    return (
      <p className="mt-1 text-xs text-status-warning">
        Memory is currently low. Close other apps before starting.
      </p>
    )
  return (
    <p className="mt-1 text-xs text-status-success">
      Expected to fit in this device&apos;s RAM.
    </p>
  )
}
