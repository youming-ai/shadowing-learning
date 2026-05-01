import type { Metadata, Viewport } from "next";
import "../styles/globals.css";
import { I18nProvider } from "@/components/layout/contexts/I18nContext";
import { ThemeProvider } from "@/components/layout/contexts/ThemeContext";
import { TranscriptionLanguageProvider } from "@/components/layout/contexts/TranscriptionLanguageContext";
import { QueryProvider } from "@/components/layout/providers/QueryProvider";
import { PageErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ToastContainer } from "@/components/ui/ErrorToast";
import { MonitoringInitializer } from "@/components/ui/MonitoringInitializer";
import PwaRegister from "@/components/ui/PwaRegister";
import { ThemeDebuggerToggle } from "@/components/ui/ThemeDebugger";

const SITE_NAME = "影子跟读 Shadowing";
const SITE_DESCRIPTION =
  "影子跟读 Shadowing 是一款基于 AI 的语言跟读练习应用，支持音频自动转录、字幕同步、逐句翻译，覆盖中文、英语、日语、韩语等多语种学习场景。";
const SITE_DESCRIPTION_EN =
  "Shadowing is an AI-powered language shadowing practice app: upload audio, get auto-transcribed time-synced subtitles, and practice with per-sentence translation across Chinese, English, Japanese, and Korean.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: {
    default: "影子跟读 Shadowing - AI 驱动的多语言跟读学习工具",
    template: "%s | 影子跟读 Shadowing",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "影子跟读",
    "shadowing",
    "language shadowing",
    "语言学习",
    "跟读练习",
    "口语练习",
    "AI 转录",
    "音频转文字",
    "字幕同步",
    "Whisper",
    "英语跟读",
    "日语跟读",
    "韩语跟读",
    "中文学习",
    "口语训练",
    "subtitle generator",
  ],
  authors: [{ name: "影子跟读团队" }],
  creator: "影子跟读团队",
  publisher: "影子跟读团队",
  category: "education",
  manifest: "/manifest.json",
  alternates: {
    canonical: "/",
    languages: {
      "zh-CN": "/",
      "zh-TW": "/",
      en: "/",
      ja: "/",
      ko: "/",
      "x-default": "/",
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    alternateLocale: ["zh_TW", "en_US", "ja_JP", "ko_KR"],
    url: "/",
    title: "影子跟读 Shadowing - AI 驱动的多语言跟读学习工具",
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: "影子跟读 Shadowing - AI 驱动的多语言跟读学习工具",
    description: SITE_DESCRIPTION_EN,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE_NAME,
  },
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    inLanguage: ["zh-CN", "zh-TW", "en", "ja", "ko"],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "CNY",
    },
    description: SITE_DESCRIPTION,
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    inLanguage: ["zh-CN", "zh-TW", "en", "ja", "ko"],
    description: SITE_DESCRIPTION,
  },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <ThemeProvider defaultTheme="system">
          <TranscriptionLanguageProvider>
            <I18nProvider>
              <MonitoringInitializer />
              <QueryProvider>
                <PageErrorBoundary>
                  <div className="relative min-h-screen">{children}</div>
                </PageErrorBoundary>
              </QueryProvider>
              <ThemeDebuggerToggle />
              <PwaRegister />
              <ToastContainer>{null}</ToastContainer>
            </I18nProvider>
          </TranscriptionLanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
