import { createFileRoute } from "@tanstack/react-router";
import SettingsPage from "~/components/features/settings/SettingsPage";
import Navigation from "~/components/ui/Navigation";

export const Route = createFileRoute("/settings")({
  component: SettingsRoute,
});

function SettingsRoute() {
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
