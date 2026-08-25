'use client'

import { useEffect, useRef, useState } from 'react'
import { useI18n } from '~/components/layout/contexts/I18nContext'
import { useTranscriptionLanguage } from '~/components/layout/contexts/TranscriptionLanguageContext'

// Supported languages
const languages = [
  { code: 'zh-CN', name: '简体中文', flag: '🇨🇳' },
  { code: 'zh-TW', name: '繁體中文', flag: '🇹🇼' },
  { code: 'en-US', name: 'English', flag: '🇺🇸' },
  { code: 'ja-JP', name: '日本語', flag: '🇯🇵' },
] as const

export default function LanguageToggle() {
  const { learningLanguage, setLearningLanguage } = useTranscriptionLanguage()
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Find current language config
  const currentLanguage =
    languages.find((lang) => lang.code === learningLanguage.nativeLanguage) || languages[0]

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleLanguageChange = (langCode: string) => {
    setLearningLanguage({
      ...learningLanguage,
      nativeLanguage: langCode,
    })
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        className="nav-button"
        aria-label={t('nav.switchLanguage')}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={t('nav.switchLanguage')}
      >
        <span className="material-symbols-outlined text-3xl">language</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-14 w-64 rounded-lg border bg-[var(--surface-card)] shadow-lg z-50">
          <div className="p-2">
            <div className="px-3 py-2 text-sm font-medium text-[var(--text-secondary)]">
              {t('nav.selectLanguage')}
            </div>
            <div className="mt-1 space-y-1">
              {languages.map((language) => (
                <button
                  key={language.code}
                  type="button"
                  onClick={() => handleLanguageChange(language.code)}
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--surface-hover)] ${
                    currentLanguage.code === language.code
                      ? 'bg-[var(--surface-selected)] text-[var(--accent-color)]'
                      : 'text-[var(--text-primary)]'
                  }`}
                >
                  <span className="text-lg">{language.flag}</span>
                  <span className="flex-1 text-sm font-medium">{language.name}</span>
                  {currentLanguage.code === language.code && (
                    <span className="material-symbols-outlined text-sm">check</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
