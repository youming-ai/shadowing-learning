import { SettingsCard, SettingsSection } from '~/components/features/settings/SettingsCard'

/**
 * Pro billing is not wired yet. Keep the section as a roadmap teaser without a dead CTA.
 */
export function ProUpgradeSection() {
  return (
    <SettingsSection sectionKey="pro" title="升级 Pro 版本">
      <SettingsCard>
        <div className="settings-pro-card">
          <div className="settings-pro-icon">
            <span className="material-symbols-outlined text-5xl text-yellow-400">
              workspace_premium
            </span>
          </div>
          <h3 className="settings-pro-title">用 AI 解锁全部功能</h3>
          <p className="settings-pro-description">
            订阅、跨设备同步与用量统计即将推出。当前版本可免费在本机使用全部已上线能力。
          </p>
          <p className="mt-3 text-xs text-[var(--text-tertiary)]">敬请期待</p>
        </div>
      </SettingsCard>
    </SettingsSection>
  )
}
