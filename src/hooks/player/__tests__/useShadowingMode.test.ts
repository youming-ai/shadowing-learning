import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useShadowingMode } from "../useShadowingMode";

describe("useShadowingMode", () => {
  const segments = [
    { id: 1, start: 0, end: 3 },
    { id: 2, start: 3, end: 6 },
    { id: 3, start: 6, end: 10 },
  ];

  it("returns isShadowingMode false by default", () => {
    const { result } = renderHook(() =>
      useShadowingMode({ segments, isPlaying: true, currentTime: 0 }),
    );
    expect(result.current.isShadowingMode).toBe(false);
  });

  it("toggles shadowing mode", () => {
    const { result } = renderHook(() =>
      useShadowingMode({ segments, isPlaying: true, currentTime: 0 }),
    );
    act(() => result.current.toggleShadowingMode());
    expect(result.current.isShadowingMode).toBe(true);
  });

  it("requests pause when currentTime reaches end of active segment while shadowing", () => {
    const onRequestPause = vi.fn();
    const { result, rerender } = renderHook(
      ({ currentTime }) =>
        useShadowingMode({
          segments,
          isPlaying: true,
          currentTime,
          onRequestPause,
        }),
      {
        initialProps: { currentTime: 2.0 },
      },
    );

    act(() => result.current.toggleShadowingMode());

    rerender({ currentTime: 3.0 });

    expect(onRequestPause).toHaveBeenCalled();
  });

  it("does not request pause when shadowing mode is off", () => {
    const onRequestPause = vi.fn();
    const { rerender } = renderHook(
      ({ currentTime }) =>
        useShadowingMode({
          segments,
          isPlaying: true,
          currentTime,
          onRequestPause,
        }),
      {
        initialProps: { currentTime: 2.0 },
      },
    );

    rerender({ currentTime: 3.0 });
    expect(onRequestPause).not.toHaveBeenCalled();
  });
});
