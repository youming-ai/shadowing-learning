import { ExternalLinkIcon } from "lucide-react";
import {
  SettingsCard,
  SettingsRowContent,
  SettingsSection,
} from "@/components/features/settings/SettingsCard";

export function FeedbackSection() {
  return (
    <SettingsSection title="意见反馈">
      <SettingsCard>
        <a href="mailto:feedback@shadowing-learning.app" className="settings-link">
          <SettingsRowContent title="电子邮件" />
          <div className="flex items-center gap-2">
            <span className="settings-value">feedback@shadowing-learning.app</span>
            <ExternalLinkIcon className="h-4 w-4 text-gray-400" />
          </div>
        </a>
      </SettingsCard>
    </SettingsSection>
  );
}
