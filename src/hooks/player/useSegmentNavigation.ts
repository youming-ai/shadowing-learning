import { useCallback, useMemo } from 'react'
import { findActiveSegmentIndex } from '~/lib/player/active-segment'

interface SegmentLike {
  start: number
  end: number
}

/** 媒体无关的句级导航：activeIndex 复用 active-segment.ts 的二分（含空隙就近归属） */
export function useSegmentNavigation(
  segments: SegmentLike[],
  currentTime: number,
  seekTo: (seconds: number) => void,
) {
  const activeIndex = useMemo(
    () => findActiveSegmentIndex(segments, currentTime),
    [segments, currentTime],
  )

  const goPrev = useCallback(() => {
    if (activeIndex > 0) seekTo(segments[activeIndex - 1].start)
  }, [activeIndex, segments, seekTo])

  const goNext = useCallback(() => {
    if (activeIndex >= 0 && activeIndex < segments.length - 1) {
      seekTo(segments[activeIndex + 1].start)
    }
  }, [activeIndex, segments, seekTo])

  return { activeIndex, goPrev, goNext }
}
