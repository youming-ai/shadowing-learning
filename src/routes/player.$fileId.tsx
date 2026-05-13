import { createFileRoute } from "@tanstack/react-router";
import PlayerErrorBoundary from "~/components/features/player/PlayerErrorBoundary";
import PlayerPageComponent from "~/components/features/player/PlayerPage";

export const Route = createFileRoute("/player/$fileId")({
  component: PlayerRoute,
});

function PlayerRoute() {
  const { fileId } = Route.useParams();
  return (
    <PlayerErrorBoundary>
      <PlayerPageComponent fileId={fileId} />
    </PlayerErrorBoundary>
  );
}
