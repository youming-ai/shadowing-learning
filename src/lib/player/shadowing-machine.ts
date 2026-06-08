export interface ShadowingConfig {
  enabled: boolean
  repeatCount: number // default 3, range 1..5
  gapRatio: number // gap = lineDuration * gapRatio, default 1.0
  gapFloorMs: number // default 800
  practiceRate: number // default 0.75; 1.0 = no slow-down
  autoAdvance: boolean // default true
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

export function reduceShadowing(
  state: ShadowingState,
  _event: ShadowingEvent,
  _ctx: ReduceCtx,
): ReduceResult {
  // Filled in across the following tasks. Default: no-op passthrough.
  return { next: state, commands: [] }
}
