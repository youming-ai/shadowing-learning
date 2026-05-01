import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAudioPlayer } from "../useAudioPlayer";

describe("useAudioPlayer loop", () => {
  it("resets loop guard when new loop points are set", () => {
    const { result } = renderHook(() => useAudioPlayer());

    act(() => result.current.onSetLoop(1, 2));
    act(() => result.current.handleSeek(1.5));
    act(() => result.current.onPlay());
    act(() => result.current.updatePlayerState({ currentTime: 2.0 }));
    expect(result.current.audioPlayerState.currentTime).toBe(1);

    act(() => result.current.onSetLoop(1.5, 2));
    act(() => result.current.handleSeek(1.5));
    act(() => result.current.onPlay());
    act(() => result.current.updatePlayerState({ currentTime: 2.05 }));
    expect(result.current.audioPlayerState.currentTime).toBe(1.5);
  });

  it("exposes setLoopPoints in return value", () => {
    const { result } = renderHook(() => useAudioPlayer());
    expect(typeof result.current.setLoopPoints).toBe("function");
  });
});
