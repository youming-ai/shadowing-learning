import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "跟读练习",
  description: "影子跟读的播放器：时间轴字幕、逐句重复、跟读练习。",
  robots: { index: false, follow: false },
};

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
