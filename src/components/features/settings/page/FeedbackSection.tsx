import { ExternalLinkIcon } from 'lucide-react'
import {
  SettingsCard,
  SettingsRowContent,
  SettingsSection,
} from '~/components/features/settings/SettingsCard'
import { useI18n } from '~/components/layout/contexts/I18nContext'

const FEEDBACK_URL = 'https://github.com/youming-ai/shadowing-learning/issues'

export function FeedbackSection() {
  const { t } = useI18n()
  return (
    <SettingsSection title={t('settings.feedback.title')}>
      <SettingsCard>
        <a href={FEEDBACK_URL} target="_blank" rel="noreferrer" className="settings-link">
          <SettingsRowContent
            title={t('settings.feedback.github')}
            description={t('settings.feedback.githubHint')}
          />
          <div className="flex items-center gap-2">
            <ExternalLinkIcon className="h-4 w-4 text-gray-400" />
          </div>
        </a>
      </SettingsCard>
    </SettingsSection>
  )
}
