import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  customModelId,
  loadModelCatalog,
  mergeCatalog,
  parsePublishedCatalog,
} from '../mindCatalog'
import type { CatalogModel } from '../mind'
const small: CatalogModel = {
  displayName: 'Small',
  family: 'qwen',
  hfFile: 'Small.gguf',
  hfRepo: 'owner/model',
  id: 'small',
  quant: 'Q4_K_M',
  ramHintGb: 2,
  sizeBytes: 1000,
}
const source = `export const QWEN35_MODELS = [${JSON.stringify(small)}]; export const DEFAULT_MODEL_ID = 'small';`
beforeEach(() => {
  const cache = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => cache.get(key) ?? null,
    setItem: (key: string, value: string) => cache.set(key, value),
  })
})
afterEach(() => vi.unstubAllGlobals())
it('parses published literal data and the default model without evaluating code', () => {
  expect(parsePublishedCatalog(source)[0]).toMatchObject({
    id: 'small',
    recommended: true,
  })
})
it('rejects executable expressions in a catalog', () => {
  expect(() =>
    parsePublishedCatalog('export const QWEN35_MODELS = [runCode()];')
  ).toThrow()
})
it('preserves provider IDs and custom models while adding new published models', () => {
  const newer = { ...small, hfFile: 'New.gguf', id: 'new' }
  const custom = { ...small, hfFile: 'Custom.gguf', id: 'user-model' }
  const catalog = mergeCatalog(
    [{ ...small, id: 'installed-id' }, custom],
    [small, newer]
  )
  expect(catalog.map((m) => m.id)).toEqual([
    'installed-id',
    customModelId(newer),
    'user-model',
  ])
})
it('loads the latest published version and retains the catalog when offline', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      json: async () => ({ version: '0.8.1' }),
      ok: true,
    })
    .mockResolvedValueOnce({ ok: true, text: async () => source })
  vi.stubGlobal('fetch', fetchMock)
  expect((await loadModelCatalog([small]))[0].recommended).toBe(true)
  expect(fetchMock.mock.calls[1][0]).toContain('@0.8.1/dist/qvac/models.js')
  fetchMock.mockRejectedValue(new Error('offline'))
  expect((await loadModelCatalog([small]))[0].recommended).toBe(true)
})
it('falls back to the provider on an invalid feed with no cache', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
  expect(await loadModelCatalog([small])).toEqual([small])
})
