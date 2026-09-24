import { describe, it, expect } from 'vitest'

import de from '../locales/de.json'
import en from '../locales/en.json'
import es from '../locales/es.json'
import fr from '../locales/fr.json'
import itLocale from '../locales/it.json'
import ja from '../locales/ja.json'
import ko from '../locales/ko.json'
import zh from '../locales/zh.json'

type Json = Record<string, unknown>

/**
 * Flatten a locale into `path -> value kind`. Arrays are recorded as `array`
 * rather than walked, because components read them with
 * `t(key, { returnObjects: true })` and then `.map()` over the result — an
 * object with numeric keys passes a key-set comparison but crashes at runtime.
 */
const shapeOf = (obj: Json, prefix = ''): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix + key
    if (Array.isArray(value)) {
      out[path] = `array(${value.length})`
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(out, shapeOf(value as Json, `${path}.`))
    } else {
      out[path] = typeof value
    }
  }
  return out
}

const locales: Array<[string, Json]> = [
  ['de', de],
  ['es', es],
  ['fr', fr],
  ['it', itLocale],
  ['ja', ja],
  ['ko', ko],
  ['zh', zh],
]

const enShape = shapeOf(en as Json)

describe('locale files', () => {
  it.each(locales)('%s has exactly the keys en.json has', (_name, locale) => {
    const shape = shapeOf(locale)
    expect(Object.keys(shape).sort()).toEqual(Object.keys(enShape).sort())
  })

  it.each(locales)('%s matches en.json value shapes', (_name, locale) => {
    const shape = shapeOf(locale)
    const mismatched = Object.keys(enShape).filter(
      (path) => path in shape && shape[path] !== enShape[path]
    )
    expect(mismatched).toEqual([])
  })

  it.each(locales)('%s keeps en.json interpolation tokens', (_name, locale) => {
    const shape = shapeOf(locale)
    const flat = (obj: Json, prefix = ''): Record<string, string> => {
      const out: Record<string, string> = {}
      for (const [key, value] of Object.entries(obj)) {
        const path = prefix + key
        if (typeof value === 'string') out[path] = value
        else if (typeof value === 'object' && value !== null)
          Object.assign(out, flat(value as Json, `${path}.`))
      }
      return out
    }
    const enFlat = flat(en as Json)
    const localeFlat = flat(locale)
    const dropped = Object.entries(enFlat).flatMap(([path, value]) => {
      const tokens = value.match(/{{\w+}}/g) ?? []
      const translated = localeFlat[path]
      if (translated === undefined) return []
      return tokens
        .filter((token) => !translated.includes(token))
        .map((token) => `${path}: ${token}`)
    })
    expect(dropped).toEqual([])
    expect(Object.keys(shape).length).toBeGreaterThan(0)
  })
})
