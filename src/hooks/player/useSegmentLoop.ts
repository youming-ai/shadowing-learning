import { useCallback, useEffect, useRef, useState } from 'react'
import { findActiveSegmentIndex } from '~/lib/player/active-segment'

interface SegmentLike {
  start: number
  end: number
}

/**
 * 单句循环：开启时锁定当前段，currentTime 越过段尾即跳回段首。
 * 4Hz tick 下 YouTube 最多越界 ~250ms（spec 已接受）。
 */
export function useSegmentLoop(
  segments: SegmentLike[],
  currentTime: number,
  seekTo: (seconds: number) => void,
) {
  const [isLooping, setIsLooping] = useState(false)
  const lockedRef = useRef<SegmentLike | null>(null)

  const toggleLoop = useCallback(() => {
    setIsLooping((prev) => {
      if (prev) {
        lockedRef.current = null
        return false
      }
      const idx = findActiveSegmentIndex(segments, currentTime)
      if (idx < 0) return false
      lockedRef.current = segments[idx]
      return true
    })
  }, [segments, currentTime])

  useEffect(() => {
    const locked = lockedRef.current
    if (!isLooping || !locked) return
    if (currentTime >= locked.end || currentTime < locked.start - 0.5) {
      seekTo(locked.start)
    }
  }, [isLooping, currentTime, seekTo])

  return { isLooping, toggleLoop }
}
