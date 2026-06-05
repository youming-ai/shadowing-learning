import {
  DEFAULT_SHADOWING_CONFIG,
  EPSILON,
  reduceShadowing,
  type ReduceCtx,
  type ShadowingState,
} from '~/lib/player/shadowing-machine'

describe('shadowing-machine constants', () => {
  it('exposes DEFAULT_SHADOWING_CONFIG matching the spec', () => {
    expect(DEFAULT_SHADOWING_CONFIG).toEqual({
      enabled: false,
      repeatCount: 3,
      gapRatio: 1.0,
      gapFloorMs: 800,
      practiceRate: 0.75,
      autoAdvance: true,
    })
  })

  it('exposes EPSILON as a small positive boundary slack in seconds', () => {
    expect(EPSILON).toBe(0.03)
  })
})

describe('reduceShadowing — no-op path', () => {
  const ctx: ReduceCtx = {
    segments: [
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ],
    config: { ...DEFAULT_SHADOWING_CONFIG, enabled: true },
  }

  it('returns the same state and no commands for a TICK before the segment end', () => {
    const state: ShadowingState = { phase: 'listening', activeIndex: 0, playsDone: 0 }
    const { next, commands } = reduceShadowing(state, { type: 'TICK', time: 0.5 }, ctx)
    expect(next).toEqual(state)
    expect(commands).toEqual([])
  })

  it('ignores TICK while idle', () => {
    const state: ShadowingState = { phase: 'idle', activeIndex: 0, playsDone: 0 }
    const { next, commands } = reduceShadowing(state, { type: 'TICK', time: 99 }, ctx)
    expect(next).toEqual(state)
    expect(commands).toEqual([])
  })

  it('ignores TICK while in a gap', () => {
    const state: ShadowingState = { phase: 'gap', activeIndex: 0, playsDone: 0 }
    const { next, commands } = reduceShadowing(state, { type: 'TICK', time: 99 }, ctx)
    expect(next).toEqual(state)
    expect(commands).toEqual([])
  })
})
