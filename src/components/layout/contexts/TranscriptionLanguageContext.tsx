"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

/** * 支持的语言列表 - 用作母语（翻译目标）以及通用语言代号。 * 音频源语言不再由 settings 决定，而是由 Whisper auto-detect。*/
export const SUPPORTED_LANGUAGES = {
  "zh-CN": {
    code: "zh-CN",
    name: "简体中文",
    flag: "🇨🇳",
  },
  "zh-TW": {
    code: "zh-TW",
    name: "繁體中文",
    flag: "🇹🇼",
  },
  en: {
    code: "en",
    name: "English",
    flag: "🇺🇸",
  },
  ja: {
    code: "ja",
    name: "日本語",
    flag: "🇯🇵",
  },
  ko: {
    code: "ko",
    name: "한국어",
    flag: "🇰🇷",
  },
} as const;

// 历史命名保留：仍在被 LearningLanguageSection / 其他文件引用做语言列表展示用，
// 与 SUPPORTED_LANGUAGES 一致即可，不再代表"音频转录语言"。
export const TRANSCRIPTION_LANGUAGES = SUPPORTED_LANGUAGES;

/** * Get浏览器默认Language*/
export function getBrowserLanguage(): string {
  if (typeof navigator === "undefined") return "en";

  const browserLang = navigator.language || (navigator as any).userLanguage;

  if (browserLang in SUPPORTED_LANGUAGES) {
    return browserLang;
  }

  const mainLang = browserLang.split("-")[0];

  const languageMap: Record<string, string> = {
    zh: "zh-CN",
    en: "en",
    ja: "ja",
    ko: "ko",
  };

  return languageMap[mainLang] || "en";
}

/** * 学习语言配置：仅保留母语（=翻译目标语言）。 * 音频源语言由 Whisper auto-detect 决定，不再让用户在 settings 中指定。*/
export interface LearningLanguageConfig {
  /** 母语：转录后翻译要翻成的目标语言（也用于 UI 文案）。*/
  nativeLanguage: string;
}

export type TranscriptionLanguageCode = keyof typeof SUPPORTED_LANGUAGES;

interface TranscriptionLanguageContextType {
  /** 学习语言配置（仅母语）。*/
  learningLanguage: LearningLanguageConfig;
  /** 更新学习语言配置。*/
  setLearningLanguage: (config: LearningLanguageConfig) => void;
  /** 获取支持的语言列表。*/
  getSupportedLanguages: () => typeof SUPPORTED_LANGUAGES;
  /** 兼容旧调用：返回与 getSupportedLanguages 相同的列表。*/
  getTranscriptionLanguages: () => typeof SUPPORTED_LANGUAGES;
}

const TranscriptionLanguageContext = createContext<TranscriptionLanguageContextType | undefined>(
  undefined,
);

const LEARNING_LANGUAGE_KEY = "shadowing-learning-language";
const LEGACY_TRANSCRIPTION_KEY = "shadowing-learning-transcription-language";

export function useTranscriptionLanguage() {
  const context = useContext(TranscriptionLanguageContext);
  if (!context) {
    throw new Error("useTranscriptionLanguage must be used within a TranscriptionLanguageProvider");
  }
  return context;
}

interface TranscriptionLanguageProviderProps {
  children: React.ReactNode;
}

export function TranscriptionLanguageProvider({ children }: TranscriptionLanguageProviderProps) {
  const [learningLanguage, setLearningLanguageState] = useState<LearningLanguageConfig>({
    nativeLanguage: "zh-CN",
  });
  const [isClient, setIsClient] = useState(false);

  // 初始化 - 从 localStorage 读取
  useEffect(() => {
    setIsClient(true);

    try {
      const storedLearning = localStorage.getItem(LEARNING_LANGUAGE_KEY);
      if (storedLearning) {
        const parsed = JSON.parse(storedLearning) as Partial<LearningLanguageConfig> & {
          targetLanguage?: string;
        };
        const native =
          parsed?.nativeLanguage && parsed.nativeLanguage in SUPPORTED_LANGUAGES
            ? parsed.nativeLanguage
            : "zh-CN";
        setLearningLanguageState({ nativeLanguage: native });
      } else {
        const defaultConfig: LearningLanguageConfig = { nativeLanguage: "zh-CN" };
        setLearningLanguageState(defaultConfig);
        localStorage.setItem(LEARNING_LANGUAGE_KEY, JSON.stringify(defaultConfig));
      }
    } catch (error) {
      console.warn("Failed to read learning language from localStorage:", error);
    }

    // 清理已废弃的转录语言键，避免老用户残留奇怪状态。
    try {
      localStorage.removeItem(LEGACY_TRANSCRIPTION_KEY);
    } catch {
      // 静默
    }
  }, []);

  const setLearningLanguage = useCallback((config: LearningLanguageConfig) => {
    setLearningLanguageState(config);
    try {
      localStorage.setItem(LEARNING_LANGUAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.warn("Failed to save learning language to localStorage:", error);
    }
  }, []);

  const getSupportedLanguages = useCallback(() => SUPPORTED_LANGUAGES, []);
  const getTranscriptionLanguages = useCallback(() => SUPPORTED_LANGUAGES, []);

  // 防止服务端/client不一致
  if (!isClient) {
    return null;
  }

  return (
    <TranscriptionLanguageContext.Provider
      value={{
        learningLanguage,
        setLearningLanguage,
        getSupportedLanguages,
        getTranscriptionLanguages,
      }}
    >
      {children}
    </TranscriptionLanguageContext.Provider>
  );
}
