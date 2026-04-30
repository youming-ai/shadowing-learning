import { SettingsCard, SettingsSection } from "@/components/features/settings/SettingsCard";

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
          <h3 className="settings-pro-title">用AI解锁全部功能</h3>
          <p className="settings-pro-description">升级 Pro 版本，使用AI增强你的语言学习体验。</p>
          <button type="button" className="settings-pro-button">
            升级至 Pro 版本
          </button>
        </div>
      </SettingsCard>
    </SettingsSection>
  );
}
