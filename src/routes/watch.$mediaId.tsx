import { createFileRoute } from '@tanstack/react-router'
import PlayerErrorBoundary from '~/components/features/player/PlayerErrorBoundary'
import WatchPage from '~/components/features/watch/WatchPage'

export const Route = createFileRoute('/watch/$mediaId')({
  component: WatchRoute,
})

function WatchRoute() {
  const { mediaId } = Route.useParams()
  return (
    <PlayerErrorBoundary>
      <WatchPage mediaId={mediaId} />
    </PlayerErrorBoundary>
  )
}
