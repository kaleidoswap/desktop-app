import { describe, expect, it } from 'vitest'
import type { CatalogModel } from '../../../api/mind'
import { getRecommendedModelId } from '../modelCatalog'

const model = (id: string, recommended?: boolean): CatalogModel => ({
  displayName: id,
  family: 'qwen3.5',
  hfFile: 'model.gguf',
  hfRepo: 'repo/model',
  id,
  quant: 'Q4_K_M',
  ramHintGb: 3,
  recommended,
  sizeBytes: 1000,
})

describe('Mind model recommendation', () => {
  it('uses the provider recommendation even when a smaller model is listed first', () => {
    expect(
      getRecommendedModelId([model('qwen3.5-0.8b'), model('qwen3.5-2b', true)])
    ).toBe('qwen3.5-2b')
  })
  it('supports older providers without the recommendation flag', () => {
    expect(
      getRecommendedModelId([model('legacy-default'), model('other')])
    ).toBe('legacy-default')
  })
  it('handles a catalog that has not loaded yet', () => {
    expect(getRecommendedModelId([])).toBeUndefined()
  })
})

const hardware = (gb: number) => ({
  architecture: 'aarch64',
  availableMemoryBytes: gb * 1024 ** 3,
  logicalCores: 4,
  totalMemoryBytes: gb * 1024 ** 3,
})
it('suggests the smaller model on a 4 GB device', () => {
  expect(
    getRecommendedModelId(
      [{ ...model('small'), ramHintGb: 1.5 }, model('balanced', true)],
      hardware(4)
    )
  ).toBe('small')
})
it('keeps the balanced recommendation on a large machine instead of choosing the largest download', () => {
  expect(
    getRecommendedModelId(
      [model('balanced', true), { ...model('large'), ramHintGb: 26 }],
      hardware(64)
    )
  ).toBe('balanced')
})
it('does not recommend an unknown or oversized model on a 2 GB device', () => {
  expect(
    getRecommendedModelId(
      [{ ...model('custom'), ramHintGb: 0 }, model('balanced', true)],
      hardware(2)
    )
  ).toBeUndefined()
})
