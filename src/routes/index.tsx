import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import FileManager from "~/components/features/file/FileManager";
import StatsCards from "~/components/features/file/StatsCards";
import { PageLoadingState } from "~/components/ui/LoadingState";
import Navigation from "~/components/ui/Navigation";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="relative flex min-h-screen w-full flex-col">
      <Navigation />
      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8 mt-24">
        <div className="mx-auto max-w-5xl">
          <Suspense fallback={<PageLoadingState />}>
            <div className="mb-8">
              <StatsCards />
            </div>
            <FileManager />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
