/**
 * Pure shadowing practice state machine.
 * No DOM / audio side effects — the hook translates commands into player actions.
 */

export interface ShadowingConfig {
  enabled: boolean
  /** Default 3, range 1..5 */
  repeatCount: number
  /** gap = lineDuration * gapRatio, default 1.0 */
  gapRatio: number
  /** Default 800 */
  gapFloorMs: number
  /** Default 0.75; 1.0 = no slow-down */
  practiceRate: number
  /** Default true */
  autoAdvance: boolean
}

export const DEFAULT_SHADOWING_CONFIG: ShadowingConfig = {
  enabled: false,
  repeatCount: 3,
  gapRatio: 1.0,
  gapFloorMs: 800,
  practiceRate: 0.75,
  autoAdvance: true,
}

export type ShadowingPhase = 'idle' | 'listening' | 'gap'

export interface ShadowingState {
  phase: ShadowingPhase
  activeIndex: number
  playsDone: number
}

export type ShadowingEvent =
  | { type: 'TICK'; time: number }
  | { type: 'GAP_ELAPSED' }
  | { type: 'TOGGLE'; enabled: boolean }
  | { type: 'CONFIG_CHANGE'; patch: Partial<ShadowingConfig> }
  | { type: 'JUMP'; index: number }

export type ShadowingCommand =
  | { type: 'SEEK'; time: number }
  | { type: 'PAUSE' }
  | { type: 'PLAY' }
  | { type: 'SET_RATE'; rate: number }
  | { type: 'START_GAP_TIMER'; ms: number }

export interface ReduceCtx {
  segments: { start: number; end: number }[]
  config: ShadowingConfig
}

export interface ReduceResult {
  next: ShadowingState
  commands: ShadowingCommand[]
}

/** Boundary slack (seconds) for end-of-segment detection. */
export const EPSILON = 0.03

export const INITIAL_SHADOWING_STATE: ShadowingState = {
  phase: 'idle',
  activeIndex: 0,
  playsDone: 0,
}

function listeningCommands(
  seg: { start: number; end: number },
  practiceRate: number,
): ShadowingCommand[] {
  return [
    { type: 'SEEK', time: seg.start },
    { type: 'SET_RATE', rate: practiceRate },
    { type: 'PLAY' },
  ]
}

export function reduceShadowing(
  state: ShadowingState,
  event: ShadowingEvent,
  ctx: ReduceCtx,
): ReduceResult {
  const { config } = ctx

  switch (event.type) {
    case 'TOGGLE': {
      if (event.enabled) {
        const seg = ctx.segments[state.activeIndex]
        const next: ShadowingState = {
          phase: 'listening',
          activeIndex: state.activeIndex,
          playsDone: 0,
        }
        const commands: ShadowingCommand[] = [{ type: 'SET_RATE', rate: config.practiceRate }]
        if (seg) {
          commands.push({ type: 'SEEK', time: seg.start }, { type: 'PLAY' })
        }
        return { next, commands }
      }
      return {
        next: { phase: 'idle', activeIndex: state.activeIndex, playsDone: 0 },
        commands: [{ type: 'PAUSE' }],
      }
    }

    case 'TICK': {
      if (state.phase !== 'listening') return { next: state, commands: [] }
      const seg = ctx.segments[state.activeIndex]
      if (!seg) return { next: state, commands: [] }
      if (event.time < seg.end - EPSILON) return { next: state, commands: [] }
      const lineDurationMs = (seg.end - seg.start) * 1000
      const gapMs = Math.max(config.gapFloorMs, lineDurationMs * config.gapRatio)
      return {
        next: { phase: 'gap', activeIndex: state.activeIndex, playsDone: state.playsDone },
        commands: [{ type: 'PAUSE' }, { type: 'START_GAP_TIMER', ms: gapMs }],
      }
    }

    case 'GAP_ELAPSED': {
      if (state.phase !== 'gap') return { next: state, commands: [] }
      const seg = ctx.segments[state.activeIndex]
      if (!seg) return { next: state, commands: [] }

      if (state.playsDone + 1 < config.repeatCount) {
        return {
          next: {
            phase: 'listening',
            activeIndex: state.activeIndex,
            playsDone: state.playsDone + 1,
          },
          commands: listeningCommands(seg, config.practiceRate),
        }
      }

      const nextIndex = state.activeIndex + 1
      const nextSeg = ctx.segments[nextIndex]
      if (config.autoAdvance && nextSeg) {
        return {
          next: { phase: 'listening', activeIndex: nextIndex, playsDone: 0 },
          commands: listeningCommands(nextSeg, config.practiceRate),
        }
      }

      return {
        next: { phase: 'idle', activeIndex: state.activeIndex, playsDone: state.playsDone },
        commands: [{ type: 'PAUSE' }],
      }
    }

    case 'JUMP': {
      const seg = ctx.segments[event.index]
      if (config.enabled && seg) {
        return {
          next: { phase: 'listening', activeIndex: event.index, playsDone: 0 },
          commands: listeningCommands(seg, config.practiceRate),
        }
      }
      return {
        next: { phase: 'idle', activeIndex: event.index, playsDone: 0 },
        commands: [],
      }
    }

    case 'CONFIG_CHANGE':
      // Config is owned/merged by the hook and re-supplied via ctx.
      return { next: state, commands: [] }

    default:
      return { next: state, commands: [] }
  }
}
