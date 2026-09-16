import { SettingsCard, SettingsSection } from '~/components/features/settings/SettingsCard'
import { useI18n } from '~/components/layout/contexts/I18nContext'

/**
 * Local-first account shell. No auth / quota backend yet — show honest offline status
 * instead of fake remaining minutes.
 */
export function AccountSection() {
  const { t } = useI18n()
  return (
    <SettingsSection sectionKey="account" title={t('account.title')}>
      <SettingsCard>
        <div className="settings-account-card">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-muted)]">
            <span className="material-symbols-outlined text-3xl text-[var(--text-secondary)]">
              person
            </span>
          </div>
          <div className="settings-account-info">
            <p className="settings-account-name">{t('account.localUser')}</p>
            <p className="settings-account-label">{t('account.localUserHint')}</p>
          </div>
        </div>
      </SettingsCard>
    </SettingsSection>
  )
}
