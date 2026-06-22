import { useCallback, useEffect, useRef, useState } from 'react'
import { createAdapter } from '~/components/features/player/sources/factory'
import type { MediaSourceAdapter } from '~/components/features/player/sources/types'
import type { MediaRow } from '~/types/db/database'

export interface PlayerAdapterState {
  isReady: boolean
  isPlaying: boolean
  currentTime: number
  duration: number
  availableRates: number[]
  embedBlocked: boolean
}

export function usePlayerAdapter(media: MediaRow | null) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const adapterRef = useRef<MediaSourceAdapter | null>(null)
  const [state, setState] = useState<PlayerAdapterState>({
    isReady: false,
    isPlaying: false,
    currentTime: 0,
    duration: media?.durationSec ?? 0,
    availableRates: [1],
    embedBlocked: false,
  })

  // biome-ignore lint/correctness/useExhaustiveDependencies: media.id 变化才重建 adapter
  useEffect(() => {
    const container = containerRef.current
    if (!media || !container) return

    const adapter = createAdapter(media)
    adapterRef.current = adapter
    const offs = [
      adapter.on('ready', () =>
        setState((s) => ({
          ...s,
          isReady: true,
          duration: adapter.getDuration(),
          availableRates: adapter.getAvailablePlaybackRates(),
        })),
      ),
      adapter.on('play', () => setState((s) => ({ ...s, isPlaying: true }))),
      adapter.on('pause', () => setState((s) => ({ ...s, isPlaying: false }))),
      adapter.on('ended', () => setState((s) => ({ ...s, isPlaying: false }))),
      adapter.on('timeupdate', (t) =>
        setState((s) => ({
          ...s,
          currentTime: typeof t === 'number' ? t : adapter.getCurrentTime(),
        })),
      ),
      adapter.on('error', (payload) => {
        if ((payload as { code?: string })?.code === 'EMBED_BLOCKED') {
          setState((s) => ({ ...s, embedBlocked: true }))
        }
      }),
    ]
    adapter.mount(container).catch(() => {
      // mount 失败（如 blob 缺失）由上层错误态兜底
    })

    return () => {
      for (const off of offs) off()
      adapter.destroy()
      adapterRef.current = null
      setState((s) => ({ ...s, isReady: false, isPlaying: false, currentTime: 0 }))
    }
  }, [media?.id])

  const play = useCallback(() => void adapterRef.current?.play(), [])
  const pause = useCallback(() => adapterRef.current?.pause(), [])
  const seekTo = useCallback((sec: number) => {
    adapterRef.current?.seekTo(sec)
    setState((s) => ({ ...s, currentTime: sec }))
  }, [])
  const setRate = useCallback((r: number) => adapterRef.current?.setPlaybackRate(r), [])
  const setVolume = useCallback((v: number) => adapterRef.current?.setVolume(v), [])

  return { containerRef, ...state, play, pause, seekTo, setRate, setVolume }
}
