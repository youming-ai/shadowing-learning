import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSegmentLoop } from '~/hooks/player/useSegmentLoop'
import { useSegmentNavigation } from '~/hooks/player/useSegmentNavigation'

const segs = [
  { start: 0, end: 2 },
  { start: 2, end: 5 },
  { start: 6, end: 9 },
]

describe('useSegmentNavigation', () => {
  it('activeIndex follows currentTime (gap snaps to nearest)', () => {
    const { result, rerender } = renderHook(({ t }) => useSegmentNavigation(segs, t, vi.fn()), {
      initialProps: { t: 3 },
    })
    expect(result.current.activeIndex).toBe(1)
    rerender({ t: 5.4 })
    expect(result.current.activeIndex).toBe(1)
  })

  it('goNext / goPrev seek to adjacent segment start', () => {
    const seekTo = vi.fn()
    const { result } = renderHook(() => useSegmentNavigation(segs, 3, seekTo))
    act(() => result.current.goNext())
    expect(seekTo).toHaveBeenCalledWith(6)
    act(() => result.current.goPrev())
    expect(seekTo).toHaveBeenCalledWith(0)
  })

  it('clamps at boundaries', () => {
    const seekTo = vi.fn()
    const { result } = renderHook(() => useSegmentNavigation(segs, 8, seekTo))
    act(() => result.current.goNext())
    expect(seekTo).not.toHaveBeenCalled()
  })
})

describe('useSegmentLoop', () => {
  it('when enabled, seeks back to the locked segment start as time passes its end', () => {
    const seekTo = vi.fn()
    const { result, rerender } = renderHook(({ t }) => useSegmentLoop(segs, t, seekTo), {
      initialProps: { t: 3 },
    })
    act(() => result.current.toggleLoop())
    expect(result.current.isLooping).toBe(true)
    rerender({ t: 5.1 })
    expect(seekTo).toHaveBeenCalledWith(2)
  })

  it('disabled by toggle again; no seeking', () => {
    const seekTo = vi.fn()
    const { result, rerender } = renderHook(({ t }) => useSegmentLoop(segs, t, seekTo), {
      initialProps: { t: 3 },
    })
    act(() => result.current.toggleLoop())
    act(() => result.current.toggleLoop())
    expect(result.current.isLooping).toBe(false)
    rerender({ t: 5.1 })
    expect(seekTo).not.toHaveBeenCalled()
  })
})
