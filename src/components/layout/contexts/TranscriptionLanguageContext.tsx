"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

/** * 支持Translation目标Language（母语） * Transcription完成后，将Transcription内容Translation成用户母语*/
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

/** * 支持TranscriptionLanguage（目标Language） * Audio/视频原始Language，传给 Whisper API 进行语音识别*/
export const TRANSCRIPTION_LANGUAGES = {
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

/** * Get浏览器默认Language*/
export function getBrowserLanguage(): string {
  if (typeof navigator === "undefined") return "en";

  const browserLang = navigator.language || (navigator as any).userLanguage;

  // Check完整Language代码i否在支持Language列tablein
  if (browserLang in TRANSCRIPTION_LANGUAGES) {
    return browserLang;
  }

  // SimplifiedLanguage代码（只取主要Language部分）
  const mainLang = browserLang.split("-")[0];

  // 映射To支持Language代码
  const languageMap: Record<string, string> = {
    zh: "zh-CN", // 默认简体in文
    en: "en",
    ja: "ja",
    ko: "ko",
  };

  return languageMap[mainLang] || "en";
}

/** * 学习Language配置class型*/
export interface LearningLanguageConfig {
  /** 母语Language - Transcription时Translation目标Language*/
  nativeLanguage: string;
  /** 目标Language - Transcription时API使用Language*/
  targetLanguage: string;
}

export type TranscriptionLanguageCode = keyof typeof TRANSCRIPTION_LANGUAGES;

interface TranscriptionLanguageContextType {
  /** 当前TranscriptionLanguage代码*/
  language: TranscriptionLanguageCode;
  /** SetTranscriptionLanguage*/
  setLanguage: (language: TranscriptionLanguageCode) => void;
  /** GetLanguage配置*/
  getLanguageConfig: (
    code: TranscriptionLanguageCode,
  ) => (typeof TRANSCRIPTION_LANGUAGES)[TranscriptionLanguageCode];
  /** 学习Language配置*/
  learningLanguage: LearningLanguageConfig;
  /** Set学习Language*/
  setLearningLanguage: (config: LearningLanguageConfig) => void;
  /** Get支持Language列table*/
  getSupportedLanguages: () => typeof SUPPORTED_LANGUAGES;
  /** GetTranscription支持Language列table*/
  getTranscriptionLanguages: () => typeof TRANSCRIPTION_LANGUAGES;
}

const TranscriptionLanguageContext = createContext<TranscriptionLanguageContextType | undefined>(
  undefined,
);

const STORAGE_KEY = "shadowing-learning-transcription-language";
const LEARNING_LANGUAGE_KEY = "shadowing-learning-language";
const DEFAULT_LANGUAGE: TranscriptionLanguageCode = "zh-CN";

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
  const [language, setLanguageState] = useState<TranscriptionLanguageCode>(DEFAULT_LANGUAGE);
  const [learningLanguage, setLearningLanguageState] = useState<LearningLanguageConfig>({
    nativeLanguage: "zh-CN", // 默认简体in文a母语
    targetLanguage: "ja", // 默认日语a目标Language
  });
  const [isClient, setIsClient] = useState(false);

  // 初始化 - 从localStorage read
  useEffect(() => {
    setIsClient(true);

    // readTranscriptionLanguageSet
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as TranscriptionLanguageCode;
      if (stored && stored in TRANSCRIPTION_LANGUAGES) {
        setLanguageState(stored);
      }
    } catch {
      // localStorage 不可用时静默Process
    }

    // read学习LanguageSet
    try {
      const storedLearning = localStorage.getItem(LEARNING_LANGUAGE_KEY);
      if (storedLearning) {
        const parsed = JSON.parse(storedLearning) as LearningLanguageConfig;
        setLearningLanguageState(parsed);
      }
    } catch (error) {
      console.warn("Failed to read learning language from localStorage:", error);
    }

    // If没有学习LanguageSet，使用默认值
    if (!localStorage.getItem(LEARNING_LANGUAGE_KEY)) {
      const defaultConfig: LearningLanguageConfig = {
        nativeLanguage: "zh-CN", // 默认简体in文a母语
        targetLanguage: "ja", // 默认日语a目标Language
      };
      setLearningLanguageState(defaultConfig);
      localStorage.setItem(LEARNING_LANGUAGE_KEY, JSON.stringify(defaultConfig));
    }
  }, []);

  // SetTranscriptionLanguage并持久化
  const setLanguage = useCallback((newLanguage: TranscriptionLanguageCode) => {
    setLanguageState(newLanguage);
    try {
      localStorage.setItem(STORAGE_KEY, newLanguage);
    } catch {
      // localStorage 不可用时静默Process
    }
  }, []);

  // Set学习Language并持久化
  const setLearningLanguage = useCallback((config: LearningLanguageConfig) => {
    setLearningLanguageState(config);
    try {
      localStorage.setItem(LEARNING_LANGUAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.warn("Failed to save learning language to localStorage:", error);
    }
  }, []);

  // GetLanguage配置
  const getLanguageConfig = useCallback((code: TranscriptionLanguageCode) => {
    return TRANSCRIPTION_LANGUAGES[code];
  }, []);

  // Get支持Language列table
  const getSupportedLanguages = useCallback(() => SUPPORTED_LANGUAGES, []);

  // GetTranscription支持Language列table
  const getTranscriptionLanguages = useCallback(() => TRANSCRIPTION_LANGUAGES, []);

  // 防止服务端/client不一致
  if (!isClient) {
    return null;
  }

  return (
    <TranscriptionLanguageContext.Provider
      value={{
        language,
        setLanguage,
        getLanguageConfig,
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
