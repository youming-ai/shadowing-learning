import { useCallback, useEffect, useRef, useState } from 'react'
import { findActiveSegmentIndex } from '~/lib/player/active-segment'
import {
  DEFAULT_SHADOWING_CONFIG,
  INITIAL_SHADOWING_STATE,
  reduceShadowing,
  type ShadowingCommand,
  type ShadowingConfig,
  type ShadowingEvent,
  type ShadowingState,
} from '~/lib/player/shadowing-machine'

const STORAGE_KEY = 'shadowing-config'

function loadConfig(): ShadowingConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_SHADOWING_CONFIG }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SHADOWING_CONFIG }
    const parsed = JSON.parse(raw) as Partial<ShadowingConfig>
    return {
      ...DEFAULT_SHADOWING_CONFIG,
      ...parsed,
      // Runtime enable is session-scoped; never auto-start from storage.
      enabled: false,
      repeatCount: clampInt(parsed.repeatCount ?? DEFAULT_SHADOWING_CONFIG.repeatCount, 1, 5),
      gapRatio: clampNumber(parsed.gapRatio ?? DEFAULT_SHADOWING_CONFIG.gapRatio, 0, 3),
      gapFloorMs: clampNumber(parsed.gapFloorMs ?? DEFAULT_SHADOWING_CONFIG.gapFloorMs, 0, 10_000),
      practiceRate: clampNumber(
        parsed.practiceRate ?? DEFAULT_SHADOWING_CONFIG.practiceRate,
        0.25,
        2,
      ),
      autoAdvance: parsed.autoAdvance ?? DEFAULT_SHADOWING_CONFIG.autoAdvance,
    }
  } catch {
    return { ...DEFAULT_SHADOWING_CONFIG }
  }
}

function persistConfig(config: ShadowingConfig) {
  if (typeof window === 'undefined') return
  try {
    const { enabled: _enabled, ...rest } = config
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest))
  } catch {
    // ignore quota / private mode
  }
}

function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)))
}

function clampNumber(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

export interface ShadowingPlayerControls {
  play: () => void
  pause: () => void
  seekTo: (seconds: number) => void
  setRate: (rate: number) => void
}

interface UseShadowingPracticeOptions {
  segments: { start: number; end: number }[]
  currentTime: number
  player: ShadowingPlayerControls
  /** Footer playback rate restored when shadowing leaves listening. */
  browseRate: number
}

export function useShadowingPractice({
  segments,
  currentTime,
  player,
  browseRate,
}: UseShadowingPracticeOptions) {
  const [config, setConfig] = useState<ShadowingConfig>(() => loadConfig())
  const [state, setState] = useState<ShadowingState>(INITIAL_SHADOWING_STATE)
  const gapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const segmentsRef = useRef(segments)
  segmentsRef.current = segments
  const configRef = useRef(config)
  configRef.current = config
  const stateRef = useRef(state)
  stateRef.current = state
  const playerRef = useRef(player)
  playerRef.current = player
  const browseRateRef = useRef(browseRate)
  browseRateRef.current = browseRate

  const clearGapTimer = useCallback(() => {
    if (gapTimerRef.current !== null) {
      clearTimeout(gapTimerRef.current)
      gapTimerRef.current = null
    }
  }, [])

  const dispatchRef = useRef<(event: ShadowingEvent) => void>(() => {})

  const executeCommands = useCallback(
    (commands: ShadowingCommand[]) => {
      const p = playerRef.current
      for (const cmd of commands) {
        switch (cmd.type) {
          case 'SEEK':
            p.seekTo(cmd.time)
            break
          case 'PAUSE':
            p.pause()
            break
          case 'PLAY':
            p.play()
            break
          case 'SET_RATE':
            p.setRate(cmd.rate)
            break
          case 'START_GAP_TIMER': {
            clearGapTimer()
            gapTimerRef.current = setTimeout(() => {
              gapTimerRef.current = null
              dispatchRef.current({ type: 'GAP_ELAPSED' })
            }, cmd.ms)
            break
          }
        }
      }
    },
    [clearGapTimer],
  )

  const dispatch = useCallback(
    (event: ShadowingEvent) => {
      const result = reduceShadowing(stateRef.current, event, {
        segments: segmentsRef.current,
        config: configRef.current,
      })
      stateRef.current = result.next
      setState(result.next)

      if (result.next.phase === 'idle') {
        // Practice finished or disabled — restore browse rate.
        playerRef.current.setRate(browseRateRef.current)
      }

      executeCommands(result.commands)
    },
    [executeCommands],
  )

  dispatchRef.current = dispatch

  useEffect(() => () => clearGapTimer(), [clearGapTimer])

  // Drive TICK from player time updates while listening.
  useEffect(() => {
    if (!config.enabled || state.phase !== 'listening') return
    dispatch({ type: 'TICK', time: currentTime })
  }, [currentTime, config.enabled, state.phase, dispatch])

  // When browse rate changes while shadowing is off, apply immediately.
  useEffect(() => {
    if (!config.enabled) {
      player.setRate(browseRate)
    }
  }, [browseRate, config.enabled, player])

  const toggleShadowing = useCallback(() => {
    clearGapTimer()
    const nextEnabled = !configRef.current.enabled
    const nextConfig = { ...configRef.current, enabled: nextEnabled }
    configRef.current = nextConfig
    setConfig(nextConfig)
    persistConfig(nextConfig)

    if (nextEnabled) {
      const idx = findActiveSegmentIndex(segmentsRef.current, currentTime)
      const activeIndex = idx >= 0 ? idx : 0
      stateRef.current = { ...stateRef.current, activeIndex, playsDone: 0 }
      setState(stateRef.current)
      dispatch({ type: 'TOGGLE', enabled: true })
    } else {
      dispatch({ type: 'TOGGLE', enabled: false })
      playerRef.current.setRate(browseRateRef.current)
    }
  }, [clearGapTimer, currentTime, dispatch])

  const setShadowingConfig = useCallback(
    (patch: Partial<ShadowingConfig>) => {
      const next: ShadowingConfig = {
        ...configRef.current,
        ...patch,
        enabled: configRef.current.enabled,
        repeatCount: clampInt(patch.repeatCount ?? configRef.current.repeatCount, 1, 5),
        gapRatio: clampNumber(patch.gapRatio ?? configRef.current.gapRatio, 0, 3),
        gapFloorMs: clampNumber(patch.gapFloorMs ?? configRef.current.gapFloorMs, 0, 10_000),
        practiceRate: clampNumber(patch.practiceRate ?? configRef.current.practiceRate, 0.25, 2),
      }
      configRef.current = next
      setConfig(next)
      persistConfig(next)
      dispatch({ type: 'CONFIG_CHANGE', patch })

      if (next.enabled && stateRef.current.phase === 'listening') {
        playerRef.current.setRate(next.practiceRate)
      }
    },
    [dispatch],
  )

  const jumpToIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= segmentsRef.current.length) return
      clearGapTimer()
      dispatch({ type: 'JUMP', index })
    },
    [clearGapTimer, dispatch],
  )

  return {
    config,
    state,
    toggleShadowing,
    setShadowingConfig,
    jumpToIndex,
  }
}
