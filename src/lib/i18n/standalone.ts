import { type TranslationKey, translations } from './translations'

type SupportedUiLanguage = keyof typeof translations

const UI_LANGUAGE_KEY = 'shadowing-learning-ui-language'
const LEARNING_LANGUAGE_KEY = 'shadowing-learning-language'
/**
 * 最终回落。与 `I18nProvider` 的 `translations[current] || translations['en-US']`
 * 一致：只有 `ko` 这类没有对应界面语言的学习语言会走到这里。
 */
const DEFAULT_UI_LANGUAGE: SupportedUiLanguage = 'en-US'

function normalizeCandidate(candidate: unknown): SupportedUiLanguage {
  if (typeof candidate === 'string') {
    if (candidate in translations) return candidate as SupportedUiLanguage
    // 学习语言存的是翻译目标码（en/ja/ko/zh-CN/zh-TW），不是界面码；
    // 逐个映射到四种界面语言，映射不到的回落到默认。
    if (candidate === 'en' || candidate.startsWith('en')) return 'en-US'
    if (candidate === 'ja' || candidate.startsWith('ja')) return 'ja-JP'
    if (candidate.startsWith('zh-TW')) return 'zh-TW'
    if (candidate.startsWith('zh')) return 'zh-CN'
  }
  return DEFAULT_UI_LANGUAGE
}

function readStoredLanguage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function readPersistedNativeLanguage(): string | null {
  const raw = readStoredLanguage(LEARNING_LANGUAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { nativeLanguage?: unknown }
    return typeof parsed.nativeLanguage === 'string' ? parsed.nativeLanguage : null
  } catch {
    return null
  }
}

/**
 * 错误边界等不能使用 React Context 的地方，用这组独立查表函数取界面文案。
 *
 * 优先级：已保存的界面语言 > 已保存的学习语言 > en-US（与 I18nProvider 一致）。
 * 任何一步读不到都回落，不抛错。
 */
export function resolveUiLanguage(): SupportedUiLanguage {
  return normalizeCandidate(
    readStoredLanguage(UI_LANGUAGE_KEY) ?? readPersistedNativeLanguage() ?? DEFAULT_UI_LANGUAGE,
  )
}

export function translateStandalone(
  key: keyof TranslationKey,
  params?: Record<string, string | number>,
): string {
  const dictionary = translations[resolveUiLanguage()]
  let text = dictionary[key] ?? key
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      text = text.replace(new RegExp(`{{${escaped}}}`, 'g'), String(value))
    }
  }
  return text
}
