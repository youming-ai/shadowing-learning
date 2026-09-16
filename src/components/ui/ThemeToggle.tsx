'use client'

import { useI18n } from '~/components/layout/contexts/I18nContext'
import { useTheme } from '~/components/layout/contexts/ThemeContext'

// 导航栏主题切换按钮（只显示图标）
export function ThemeToggleIcon() {
  const { t } = useI18n()
  const { theme, toggleTheme } = useTheme()

  const getIcon = () => {
    if (theme === 'system') {
      return 'desktop_windows'
    }
    if (theme === 'high-contrast') {
      return 'contrast'
    }
    return theme === 'dark' ? 'dark_mode' : 'light_mode'
  }

  return (
    <button type="button" onClick={toggleTheme} className="nav-button" title={t('nav.toggleTheme')}>
      <span className="material-symbols-outlined text-3xl">{getIcon()}</span>
      <span className="sr-only">{t('nav.toggleTheme')}</span>
    </button>
  )
}
