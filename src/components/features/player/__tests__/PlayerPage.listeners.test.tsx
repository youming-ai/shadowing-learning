import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ReactNode, StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import PlayerPageComponent from "@/components/features/player/PlayerPage";
import { DBUtils } from "@/lib/db/db";

vi.mock("@/hooks/useFileStatus", () => ({
  useFileStatusManager: () => ({
    startTranscription: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Navigation pulls in I18n + transcription-language contexts that aren't
// relevant to this test; render an inert stub instead.
vi.mock("@/components/ui/Navigation", () => ({
  default: () => null,
}));

function wrap(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <StrictMode>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </StrictMode>
  );
}

describe("PlayerPage — audio event listeners", () => {
  it("attaches timeupdate listener so subtitles can scroll once data loads", async () => {
    const blob = new Blob(["fake audio"], { type: "audio/mpeg" });
    const fileId = await DBUtils.addFile({
      name: "fixture.mp3",
      size: blob.size,
      type: blob.type,
      blob,
      isChunked: false,
      uploadedAt: new Date(),
      updatedAt: new Date(),
    });

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      },
    });

    const Wrapper = wrap(client);
    render(
      <Wrapper>
        <PlayerPageComponent fileId={String(fileId)} />
      </Wrapper>,
    );

    // Wait for the audio element to actually mount (it only renders after the
    // file query resolves).
    const audio = await waitFor(() => {
      const el = document.querySelector("audio");
      if (!el) throw new Error("audio element not in DOM yet");
      return el as HTMLAudioElement;
    });

    // If the listener attachment effect re-runs once the audio element exists,
    // dispatching `timeupdate` should propagate currentTime into player state
    // and re-render the progress label.
    Object.defineProperty(audio, "currentTime", {
      configurable: true,
      get: () => 12.5,
    });
    fireEvent(audio, new Event("timeupdate"));

    await waitFor(() => {
      // `00:12` is the formatted output for currentTime=12.5 produced by
      // PlayerFooter.formatTime — its presence proves the listener fired and
      // state updated, which is the same path subtitle scrolling depends on.
      expect(screen.getByText("00:12")).toBeInTheDocument();
    });
  });
});
