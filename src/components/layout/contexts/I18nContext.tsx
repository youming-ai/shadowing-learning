"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { type TranslationKey, translations } from "@/lib/i18n/translations";
import { useTranscriptionLanguage } from "./TranscriptionLanguageContext";

interface I18nContextType {
  t: (key: keyof TranslationKey, params?: Record<string, string | number>) => string;
  currentLanguage: string;
  setLanguage: (language: string) => void;
  availableLanguages: Array<{ code: string; name: string; flag: string }>;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { learningLanguage } = useTranscriptionLanguage();
  const [currentLanguage, setCurrentLanguage] = useState(
    learningLanguage?.nativeLanguage || "en-US",
  );

  // Available languages for UI
  const availableLanguages = [
    { code: "zh-CN", name: "简体中文", flag: "🇨🇳" },
    { code: "zh-TW", name: "繁體中文", flag: "🇹🇼" },
    { code: "en-US", name: "English", flag: "🇺🇸" },
    { code: "ja-JP", name: "日本語", flag: "🇯🇵" },
  ];

  // Update language when learning language changes
  useEffect(() => {
    if (learningLanguage?.nativeLanguage) {
      setCurrentLanguage(learningLanguage.nativeLanguage);
    }
  }, [learningLanguage?.nativeLanguage]);

  // Translation function
  const t = (key: keyof TranslationKey, params?: Record<string, string | number>) => {
    const languageData = translations[currentLanguage] || translations["en-US"];
    let translation = languageData[key] || key;

    // Replace parameters in translation string
    if (params) {
      Object.entries(params).forEach(([param, value]) => {
        translation = translation.replace(new RegExp(`{{${param}}}`, "g"), String(value));
      });
    }

    return translation;
  };

  const setLanguage = (language: string) => {
    setCurrentLanguage(language);
    // Save to localStorage for persistence
    localStorage.setItem("shadowing-learning-ui-language", language);
  };

  // Load saved language from localStorage on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem("shadowing-learning-ui-language");
    if (savedLanguage && translations[savedLanguage]) {
      setCurrentLanguage(savedLanguage);
    }
  }, []);

  const value: I18nContextType = {
    t,
    currentLanguage,
    setLanguage,
    availableLanguages,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
