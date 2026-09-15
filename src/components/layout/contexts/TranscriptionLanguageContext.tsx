'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

/** * 支持的语言列表 - 用作母语（翻译目标）以及通用语言代号。*/
export const SUPPORTED_LANGUAGES = {
  'zh-CN': {
    code: 'zh-CN',
    name: '简体中文',
    flag: '🇨🇳',
  },
  'zh-TW': {
    code: 'zh-TW',
    name: '繁體中文',
    flag: '🇹🇼',
  },
  en: {
    code: 'en',
    name: 'English',
    flag: '🇺🇸',
  },
  ja: {
    code: 'ja',
    name: '日本語',
    flag: '🇯🇵',
  },
  ko: {
    code: 'ko',
    name: '한국어',
    flag: '🇰🇷',
  },
} as const

/** * 学习语言配置：仅保留母语（=翻译目标语言）。*/
export interface LearningLanguageConfig {
  /** 母语：字幕翻译要翻成的目标语言（也用于 UI 文案）。*/
  nativeLanguage: string
}

interface TranscriptionLanguageContextType {
  /** 学习语言配置（仅母语）。*/
  learningLanguage: LearningLanguageConfig
  /** 更新学习语言配置。*/
  setLearningLanguage: (config: LearningLanguageConfig) => void
  /** 获取支持的语言列表。*/
  getSupportedLanguages: () => typeof SUPPORTED_LANGUAGES
}

const TranscriptionLanguageContext = createContext<TranscriptionLanguageContextType | undefined>(
  undefined,
)

const LEARNING_LANGUAGE_KEY = 'shadowing-learning-language'
const LEGACY_TRANSCRIPTION_KEY = 'shadowing-learning-transcription-language'

export function useTranscriptionLanguage() {
  const context = useContext(TranscriptionLanguageContext)
  if (!context) {
    throw new Error('useTranscriptionLanguage must be used within a TranscriptionLanguageProvider')
  }
  return context
}

interface TranscriptionLanguageProviderProps {
  children: React.ReactNode
}

export function TranscriptionLanguageProvider({ children }: TranscriptionLanguageProviderProps) {
  const [learningLanguage, setLearningLanguageState] = useState<LearningLanguageConfig>({
    nativeLanguage: 'zh-CN',
  })
  const [isClient, setIsClient] = useState(false)

  // 初始化 - 从 localStorage 读取
  useEffect(() => {
    setIsClient(true)

    try {
      const storedLearning = localStorage.getItem(LEARNING_LANGUAGE_KEY)
      if (storedLearning) {
        const parsed = JSON.parse(storedLearning) as Partial<LearningLanguageConfig> & {
          targetLanguage?: string
        }
        const native =
          parsed?.nativeLanguage && parsed.nativeLanguage in SUPPORTED_LANGUAGES
            ? parsed.nativeLanguage
            : 'zh-CN'
        setLearningLanguageState({ nativeLanguage: native })
      } else {
        const defaultConfig: LearningLanguageConfig = { nativeLanguage: 'zh-CN' }
        setLearningLanguageState(defaultConfig)
        localStorage.setItem(LEARNING_LANGUAGE_KEY, JSON.stringify(defaultConfig))
      }
    } catch (error) {
      console.warn('Failed to read learning language from localStorage:', error)
    }

    // 清理已废弃的转录语言键，避免老用户残留奇怪状态。
    try {
      localStorage.removeItem(LEGACY_TRANSCRIPTION_KEY)
    } catch {
      // 静默
    }
  }, [])

  const setLearningLanguage = useCallback((config: LearningLanguageConfig) => {
    setLearningLanguageState(config)
    try {
      localStorage.setItem(LEARNING_LANGUAGE_KEY, JSON.stringify(config))
    } catch (error) {
      console.warn('Failed to save learning language to localStorage:', error)
    }
  }, [])

  const getSupportedLanguages = useCallback(() => SUPPORTED_LANGUAGES, [])

  // 防止服务端/client不一致
  if (!isClient) {
    return (
      <TranscriptionLanguageContext.Provider
        value={{
          learningLanguage: { nativeLanguage: 'zh-CN' },
          setLearningLanguage: () => {},
          getSupportedLanguages: () => SUPPORTED_LANGUAGES,
        }}
      >
        {children}
      </TranscriptionLanguageContext.Provider>
    )
  }

  return (
    <TranscriptionLanguageContext.Provider
      value={{
        learningLanguage,
        setLearningLanguage,
        getSupportedLanguages,
      }}
    >
      {children}
    </TranscriptionLanguageContext.Provider>
  )
}
