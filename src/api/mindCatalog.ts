import { z } from 'zod'
import { parse } from 'acorn'
import type { CatalogModel } from './mind'

const modelSchema = z.object({
  displayName: z.string().min(1).max(200),
  family: z.string().min(1),
  hfFile: z.string().regex(/^[\w. -]+\.gguf$/i),
  hfRepo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  id: z.string().min(1),
  notes: z.string().optional(),
  quant: z.string(),
  ramHintGb: z.number().positive(),
  recommended: z.boolean().optional(),
  sizeBytes: z.number().positive(),
})
const feedSchema = z.object({
  models: z.array(modelSchema).min(1).max(100),
  schemaVersion: z.literal(1),
})
const CACHE_KEY = 'kaleido-mind.catalog.v1'
const REGISTRY_URL = 'https://registry.npmjs.org/@kaleidorg%2fmind/latest'

export function customModelId(
  model: Pick<CatalogModel, 'hfRepo' | 'hfFile'>
): string {
  return `hf-${model.hfRepo}-${model.hfFile}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function mergeCatalog(
  provider: CatalogModel[],
  online: CatalogModel[]
): CatalogModel[] {
  const artifact = (m: CatalogModel) => `${m.hfRepo}/${m.hfFile}`
  const seen = new Set(online.map(artifact))
  return [
    ...online.map((model) => ({
      ...model,
      id:
        provider.find((p) => artifact(p) === artifact(model))?.id ??
        customModelId(model),
    })),
    ...provider
      .filter((model) => !seen.has(artifact(model)))
      .map((model) => ({ ...model, recommended: false })),
  ]
}

// Decode only literal data from the published model module. Never import or
// evaluate network JavaScript; reject expressions, calls, getters and spreads.
function readLiteral(node: unknown): unknown {
  const ast = node as {
    type: string
    value?: unknown
    elements?: unknown[]
    properties?: Array<{
      type: string
      computed: boolean
      kind: string
      key: { type: string; name?: string; value?: unknown }
      value: unknown
    }>
  }
  if (ast.type === 'Literal') return ast.value
  if (ast.type === 'ArrayExpression') return ast.elements?.map(readLiteral)
  if (ast.type === 'ObjectExpression') {
    return Object.fromEntries(
      (ast.properties ?? []).map((property) => {
        if (
          property.type !== 'Property' ||
          property.computed ||
          property.kind !== 'init'
        )
          throw new Error('Catalog contains an expression')
        const key =
          property.key.type === 'Identifier'
            ? property.key.name
            : property.key.value
        if (
          typeof key !== 'string' ||
          ['__proto__', 'constructor', 'prototype'].includes(key)
        )
          throw new Error('Invalid catalog key')
        return [key, readLiteral(property.value)]
      })
    )
  }
  throw new Error('Catalog contains executable code')
}

export function parsePublishedCatalog(source: string): CatalogModel[] {
  if (source.length > 1_000_000) throw new Error('Catalog too large')
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' })
  const exports = new Map<string, unknown>()
  for (const statement of ast.body) {
    if (
      statement.type !== 'ExportNamedDeclaration' ||
      statement.declaration?.type !== 'VariableDeclaration'
    )
      continue
    for (const declaration of statement.declaration.declarations) {
      if (declaration.id.type !== 'Identifier') continue
      if (['QWEN35_MODELS', 'DEFAULT_MODEL_ID'].includes(declaration.id.name))
        exports.set(declaration.id.name, readLiteral(declaration.init))
    }
  }
  const models = z
    .array(modelSchema)
    .min(1)
    .max(100)
    .parse(exports.get('QWEN35_MODELS'))
  const recommendedId = z.string().parse(exports.get('DEFAULT_MODEL_ID'))
  if (!models.some((model) => model.id === recommendedId))
    throw new Error('Recommended model missing')
  return models.map((model) => ({
    ...model,
    recommended: model.id === recommendedId,
  }))
}

/** Network failure or an invalid feed must never hide the offline catalog. */
export async function loadModelCatalog(
  provider: CatalogModel[]
): Promise<CatalogModel[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const metadata = await fetch(REGISTRY_URL, {
      cache: 'no-cache',
      signal: controller.signal,
    })
    if (!metadata.ok) throw new Error('Registry unavailable')
    const { version } = z
      .object({ version: z.string().regex(/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/) })
      .parse(await metadata.json())
    const response = await fetch(
      `https://cdn.jsdelivr.net/npm/@kaleidorg/mind@${version}/dist/qvac/models.js`,
      { signal: controller.signal }
    )
    if (!response.ok) throw new Error('Catalog unavailable')
    const feed = {
      models: parsePublishedCatalog(await response.text()),
      schemaVersion: 1,
    }
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(feed))
    } catch {
      /* storage may be unavailable */
    }
    return mergeCatalog(provider, feed.models)
  } catch {
    try {
      const cached = feedSchema.parse(
        JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null')
      )
      return mergeCatalog(provider, cached.models)
    } catch {
      return provider
    }
  } finally {
    clearTimeout(timer)
  }
}
