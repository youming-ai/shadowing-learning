import type { Metadata } from "next";
import SettingsPage from "@/components/features/settings/SettingsPage";
import Navigation from "@/components/ui/Navigation";

export const metadata: Metadata = {
  title: "设置",
  description: "调整影子跟读的语言、主题和转录偏好。",
  robots: { index: false, follow: false },
  alternates: { canonical: "/settings" },
};

export default function SettingsRoute() {
  return (
    <div className="relative flex min-h-screen w-full flex-col">
      <Navigation />
      <main className="flex-1">
        <div className="flex-1 px-4 py-8 sm:px-6 lg:px-8 mt-24">
          <div className="mx-auto max-w-4xl">
            <SettingsPage />
          </div>
        </div>
      </main>
    </div>
  );
}
