import { describe, expect, it } from 'vitest'
import { resolveUiLanguage, translateStandalone } from '~/lib/i18n/standalone'
import type { TranslationKey } from '~/lib/i18n/translations'
import { translations } from '~/lib/i18n/translations'

/**
 * i18n 完整性：新增翻译键必须四个语种一起加，否则某个语言下会回落显示 key 本身。
 */
describe('translations 完整性', () => {
  const locales = Object.keys(translations)

  it('四个语种的 key 集合完全一致', () => {
    const keySets = locales.map((locale) => new Set(Object.keys(translations[locale])))
    for (const keys of keySets.slice(1)) {
      expect([...keys].sort()).toEqual([...keySets[0]].sort())
    }
  })

  it('所有值都是非空字符串', () => {
    for (const locale of locales) {
      for (const [key, value] of Object.entries(translations[locale])) {
        expect(typeof value, `${locale}.${key}`).toBe('string')
        expect(value.trim().length, `${locale}.${key}`).toBeGreaterThan(0)
      }
    }
  })

  it('插值占位符在四个语种中一致', () => {
    const placeholderPattern = /\{\{(\w+)\}\}/g
    const keys = Object.keys(translations[locales[0]]) as (keyof TranslationKey)[]
    for (const key of keys) {
      const expected = [...translations[locales[0]][key].matchAll(placeholderPattern)]
        .map((match) => match[1])
        .sort()
      for (const locale of locales.slice(1)) {
        const actual = [...translations[locale][key].matchAll(placeholderPattern)]
          .map((match) => match[1])
          .sort()
        expect(actual, `${locale}.${String(key)}`).toEqual(expected)
      }
    }
  })
})

describe('translateStandalone', () => {
  it('兜底返回 key 而不是抛错', () => {
    expect(translateStandalone('definitely.missing' as never)).toBe('definitely.missing')
  })

  it('替换插值参数', () => {
    expect(translateStandalone('watch.record.error.denied')).not.toBe('watch.record.error.denied')
    expect(translateStandalone('watch.shadowing.pass', { current: 1, total: 2 })).not.toContain(
      '{{',
    )
  })
})

describe('resolveUiLanguage', () => {
  it('始终返回四个支持语言之一', () => {
    expect(Object.keys(translations)).toContain(resolveUiLanguage())
  })
})
