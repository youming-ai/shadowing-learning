"use client";

import { FeedbackSection } from "~/components/features/settings/page/FeedbackSection";
import { LearningLanguageSection } from "~/components/features/settings/page/LearningLanguageSection";
import { SettingsLayout } from "~/components/features/settings/SettingsLayout";

export default function SettingsPage() {
  return (
    <SettingsLayout>
      <div className="space-y-8">
        <LearningLanguageSection />
        <FeedbackSection />
      </div>
    </SettingsLayout>
  );
}
