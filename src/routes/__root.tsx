import { createRootRoute, Outlet } from '@tanstack/react-router'
import { I18nProvider } from '~/components/layout/contexts/I18nContext'
import { ThemeProvider } from '~/components/layout/contexts/ThemeContext'
import { TranscriptionLanguageProvider } from '~/components/layout/contexts/TranscriptionLanguageContext'
import { QueryProvider } from '~/components/layout/providers/QueryProvider'
import { PageErrorBoundary } from '~/components/ui/ErrorBoundary'
import PwaRegister from '~/components/ui/PwaRegister'
import { Toaster } from '~/components/ui/sonner'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <ThemeProvider defaultTheme="system">
      <TranscriptionLanguageProvider>
        <I18nProvider>
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
  )
}
