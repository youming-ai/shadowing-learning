import { SettingsCard, SettingsSection } from '~/components/features/settings/SettingsCard'
import { useI18n } from '~/components/layout/contexts/I18nContext'

/**
 * Pro billing is not wired yet. Keep the section as a roadmap teaser without a dead CTA.
 */
export function ProUpgradeSection() {
  const { t } = useI18n()
  return (
    <SettingsSection sectionKey="pro" title={t('settings.pro.title')}>
      <SettingsCard>
        <div className="settings-pro-card">
          <div className="settings-pro-icon">
            <span className="material-symbols-outlined text-5xl text-yellow-400">
              workspace_premium
            </span>
          </div>
          <h3 className="settings-pro-title">{t('settings.pro.heading')}</h3>
          <p className="settings-pro-description">{t('settings.pro.description')}</p>
          <p className="mt-3 text-xs text-[var(--text-tertiary)]">{t('settings.pro.comingSoon')}</p>
        </div>
      </SettingsCard>
    </SettingsSection>
  )
}
