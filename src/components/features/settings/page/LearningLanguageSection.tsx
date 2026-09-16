/** * 学习语言设置 — 只保留"母语"（=翻译目标语言）。*/

'use client'

import {
  SettingsCard,
  SettingsRow,
  SettingsRowContent,
  SettingsSection,
} from '~/components/features/settings/SettingsCard'
import { useI18n } from '~/components/layout/contexts/I18nContext'
import { useTranscriptionLanguage } from '~/components/layout/contexts/TranscriptionLanguageContext'

export function LearningLanguageSection() {
  const { t } = useI18n()
  const { learningLanguage, setLearningLanguage, getSupportedLanguages } =
    useTranscriptionLanguage()
  const supportedLanguages = getSupportedLanguages()

  const handleNativeLanguageChange = (languageCode: string) => {
    setLearningLanguage({ nativeLanguage: languageCode })
  }

  return (
    <SettingsSection title={t('settings.learning.title')}>
      <SettingsCard>
        <SettingsRow>
          <SettingsRowContent
            title={t('settings.learning.native')}
            description={t('settings.learning.nativeHint')}
          />
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
                      ? 'bg-primary/20 ring-2 ring-primary scale-110'
                      : 'bg-muted/50 hover:bg-muted hover:scale-105'
                  }
                `}
                title={config.name}
                aria-label={t('settings.learning.chooseNative', { name: config.name })}
                aria-pressed={learningLanguage.nativeLanguage === code}
              >
                {config.flag}
              </button>
            ))}
          </div>
        </SettingsRow>
      </SettingsCard>
    </SettingsSection>
  )
}
