import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { I18nProvider } from '~/components/layout/contexts/I18nContext'
import { ThemeProvider } from '~/components/layout/contexts/ThemeContext'
import { TranscriptionLanguageProvider } from '~/components/layout/contexts/TranscriptionLanguageContext'
import { QueryProvider } from '~/components/layout/providers/QueryProvider'
import { PageErrorBoundary } from '~/components/ui/ErrorBoundary'
import { MonitoringInitializer } from '~/components/ui/MonitoringInitializer'
import PwaRegister from '~/components/ui/PwaRegister'
import { Toaster } from '~/components/ui/sonner'
import { getCspNonce } from '~/lib/security/csp-nonce'
import appCss from '../styles/app.css?url'

const SITE_NAME = '影子跟读 Shadowing'
const SITE_DESCRIPTION =
  '影子跟读 Shadowing 是一款基于 AI 的语言跟读练习应用，支持音频自动转录、字幕同步、逐句翻译，覆盖中文、英语、日语、韩语等多语种学习场景。'

export const Route = createRootRoute({
  head: () => {
    const nonce = getCspNonce()

    return {
      meta: [
        { charSet: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { title: '影子跟读 Shadowing - AI 驱动的多语言跟读学习工具' },
        { name: 'description', content: SITE_DESCRIPTION },
        { name: 'application-name', content: SITE_NAME },
        { name: 'robots', content: 'index, follow' },
        { property: 'og:type', content: 'website' },
        { property: 'og:locale', content: 'zh_CN' },
        { property: 'og:title', content: '影子跟读 Shadowing - AI 驱动的多语言跟读学习工具' },
        { property: 'og:description', content: SITE_DESCRIPTION },
        { property: 'og:site_name', content: SITE_NAME },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: '影子跟读 Shadowing - AI 驱动的多语言跟读学习工具' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-title', content: SITE_NAME },
      ],
      links: [
        { rel: 'manifest', href: '/manifest.json' },
        { rel: 'icon', href: '/icon.png' },
        { rel: 'apple-touch-icon', href: '/icon.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined&display=swap',
        },
        { rel: 'stylesheet', href: appCss },
      ],
      scripts: [
        {
          type: 'application/ld+json',
          ...(nonce ? { nonce } : {}),
          text: JSON.stringify([
            {
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: SITE_NAME,
              applicationCategory: 'EducationalApplication',
              operatingSystem: 'Web',
              inLanguage: ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'],
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
              description: SITE_DESCRIPTION,
            },
            {
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: SITE_NAME,
              inLanguage: ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'],
              description: SITE_DESCRIPTION,
            },
          ]),
        },
      ],
    }
  },
  component: RootLayout,
})

function RootLayout() {
  const nonce = getCspNonce()

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          {...(nonce ? { nonce } : {})}
          dangerouslySetInnerHTML={{
            __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","wmm91mbi3i");`,
          }}
        />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <ThemeProvider defaultTheme="system">
          <TranscriptionLanguageProvider>
            <I18nProvider>
              <MonitoringInitializer />
              <QueryProvider>
                <PageErrorBoundary>
                  <div className="relative min-h-screen">
                    <Outlet />
                  </div>
                </PageErrorBoundary>
              </QueryProvider>
              <PwaRegister />
              <Toaster />
            </I18nProvider>
          </TranscriptionLanguageProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
