import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { MyAudioPage } from '~/components/features/library/MyAudioPage'
import { PageLoadingState } from '~/components/ui/LoadingState'
import Navigation from '~/components/ui/Navigation'

export const Route = createFileRoute('/me')({
  component: MyAudioRoute,
})

function MyAudioRoute() {
  return (
    <div className="relative flex min-h-screen w-full flex-col">
      <Navigation />
      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8 mt-24">
        <div className="mx-auto max-w-6xl">
          <Suspense fallback={<PageLoadingState />}>
            <MyAudioPage />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
