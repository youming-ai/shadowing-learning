/** * 学习语言设置 — 只保留"母语"（=翻译目标语言）。 * 音频源语言由 Whisper auto-detect，不再在 settings 中暴露。*/

"use client";

import {
  SettingsCard,
  SettingsRow,
  SettingsRowContent,
  SettingsSection,
} from "@/components/features/settings/SettingsCard";
import { useTranscriptionLanguage } from "@/components/layout/contexts/TranscriptionLanguageContext";

export function LearningLanguageSection() {
  const { learningLanguage, setLearningLanguage, getSupportedLanguages } =
    useTranscriptionLanguage();
  const supportedLanguages = getSupportedLanguages();

  const handleNativeLanguageChange = (languageCode: string) => {
    setLearningLanguage({ nativeLanguage: languageCode });
  };

  return (
    <SettingsSection title="学习语言">
      <SettingsCard>
        <SettingsRow>
          <SettingsRowContent title="母语" description="字幕第二行翻译要使用的语言" />
          <div className="flex items-center gap-2">
            {Object.entries(supportedLanguages).map(([code, config]) => (
              <button
                key={code}
                type="button"
                onClick={() => handleNativeLanguageChange(code)}
                className={`
                  flex items-center justify-center w-10 h-10 rounded-lg text-2xl
                  transition-all duration-200
                  ${
                    learningLanguage.nativeLanguage === code
                      ? "bg-primary/20 ring-2 ring-primary scale-110"
                      : "bg-muted/50 hover:bg-muted hover:scale-105"
                  }
                `}
                title={config.name}
                aria-label={`选择${config.name}作为母语`}
                aria-pressed={learningLanguage.nativeLanguage === code}
              >
                {config.flag}
              </button>
            ))}
          </div>
        </SettingsRow>
      </SettingsCard>
    </SettingsSection>
  );
}
