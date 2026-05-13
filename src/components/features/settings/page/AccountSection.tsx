import { SettingsCard, SettingsSection } from "@/components/features/settings/SettingsCard";

export function AccountSection() {
  return (
    <SettingsSection sectionKey="account" title="账户">
      <SettingsCard>
        <div className="settings-account-card">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAVggjacLpzCBlHtQuABdJULeCi1w2opekbSUwOXmVy686CdgE44pgyfq6PcG5ME-tqv6D5SQFCAru8GDuvHKGv1cLsR5QiO7Gq_bUHHSKZNSr_xOcmawrbklpXjLyu3-_vSp7GGtscYmk0UGflFOVvgd1GbGQd4R_Hl-fwYnWoCLuODRnZ6OrMryxPfEIjCXTAPRqjEM3-gM6UsPKi9My_91NLNkF46jBcZYT1o8e1Bi9uXsMzm7H0bde8XHQqZnzhvHRGyy5LHZ4"
            alt="User Avatar"
            width={64}
            height={64}
            className="settings-account-avatar"
          />
          <div className="settings-account-info">
            <p className="settings-account-name">免费用户</p>
            <p className="settings-account-label">剩余免费时长</p>
          </div>
          <div className="settings-progress-bar">
            <div className="settings-progress-fill" style={{ width: "25%" }}></div>
          </div>
          <p className="settings-progress-text">剩余 15 / 60 分钟</p>
        </div>
      </SettingsCard>
    </SettingsSection>
  );
}
