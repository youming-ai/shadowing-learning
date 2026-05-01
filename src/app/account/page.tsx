import type { Metadata } from "next";
import AccountPage from "@/components/features/settings/AccountPage";
import Navigation from "@/components/ui/Navigation";

export const metadata: Metadata = {
  title: "用户中心",
  description: "查看影子跟读的使用统计、本地存储与练习记录。",
  robots: { index: false, follow: false },
  alternates: { canonical: "/account" },
};

export default function AccountRoute() {
  return (
    <div className="relative flex min-h-screen w-full flex-col">
      <Navigation />
      <main className="flex-1">
        <div className="flex-1 px-4 py-8 sm:px-6 lg:px-8 mt-24">
          <div className="mx-auto max-w-4xl">
            <AccountPage />
          </div>
        </div>
      </main>
    </div>
  );
}
