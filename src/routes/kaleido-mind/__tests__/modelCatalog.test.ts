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
