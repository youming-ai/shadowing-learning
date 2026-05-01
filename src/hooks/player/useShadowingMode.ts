import { useCallback, useEffect, useRef, useState } from "react";

interface UseShadowingModeOptions {
  segments: Array<{ start: number; end: number }>;
  isPlaying: boolean;
  currentTime: number;
  onRequestPause?: () => void;
}

export interface UseShadowingModeReturn {
  isShadowingMode: boolean;
  toggleShadowingMode: () => void;
  activeSegmentEnd: number | null;
}

export function useShadowingMode({
  segments,
  isPlaying,
  currentTime,
  onRequestPause,
}: UseShadowingModeOptions): UseShadowingModeReturn {
  const [isShadowingMode, setIsShadowingMode] = useState(false);
  const lastPauseTimeRef = useRef<number>(-1);

  const toggleShadowingMode = useCallback(() => {
    setIsShadowingMode((prev) => !prev);
  }, []);

  const activeSegmentEnd = (() => {
    if (segments.length === 0) return null;
    for (const seg of segments) {
      if (currentTime >= seg.start && currentTime <= seg.end) {
        return seg.end;
      }
    }
    return null;
  })();

  useEffect(() => {
    if (!isShadowingMode || !isPlaying || activeSegmentEnd === null) return;

    if (currentTime >= activeSegmentEnd && Math.abs(currentTime - lastPauseTimeRef.current) > 0.5) {
      lastPauseTimeRef.current = currentTime;
      onRequestPause?.();
    }
  }, [isShadowingMode, isPlaying, currentTime, activeSegmentEnd, onRequestPause]);

  return {
    isShadowingMode,
    toggleShadowingMode,
    activeSegmentEnd,
  };
}
