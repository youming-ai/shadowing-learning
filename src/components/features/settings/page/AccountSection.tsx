import { SettingsCard, SettingsSection } from '~/components/features/settings/SettingsCard'

/**
 * Local-first account shell. No auth / quota backend yet — show honest offline status
 * instead of fake remaining minutes.
 */
export function AccountSection() {
  return (
    <SettingsSection sectionKey="account" title="账户">
      <SettingsCard>
        <div className="settings-account-card">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-muted)]">
            <span className="material-symbols-outlined text-3xl text-[var(--text-secondary)]">
              person
            </span>
          </div>
          <div className="settings-account-info">
            <p className="settings-account-name">本地用户</p>
            <p className="settings-account-label">数据保存在本设备浏览器中，无需登录</p>
          </div>
        </div>
      </SettingsCard>
    </SettingsSection>
  )
}
