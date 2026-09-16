import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { OnlineLibraryPage } from '~/components/features/library/OnlineLibraryPage'
import { useI18n } from '~/components/layout/contexts/I18nContext'
import { PageLoadingState } from '~/components/ui/LoadingState'
import Navigation from '~/components/ui/Navigation'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const { t } = useI18n()
  return (
    <div className="relative flex min-h-screen w-full flex-col">
      <Navigation />
      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8 mt-24">
        <div className="mx-auto max-w-6xl">
          <Suspense fallback={<PageLoadingState loadingLabel={t('common.loading')} />}>
            <OnlineLibraryPage />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
