import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SHADOWING_CONFIG,
  EPSILON,
  type ReduceCtx,
  reduceShadowing,
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

describe('reduceShadowing — TOGGLE', () => {
  const ctx: ReduceCtx = {
    segments: [
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ],
    config: { ...DEFAULT_SHADOWING_CONFIG, enabled: true, practiceRate: 0.75 },
  }

  it('enable enters listening, resets playsDone, emits SET_RATE + SEEK + PLAY', () => {
    const state: ShadowingState = { phase: 'idle', activeIndex: 0, playsDone: 2 }
    const { next, commands } = reduceShadowing(state, { type: 'TOGGLE', enabled: true }, ctx)
    expect(next).toEqual({ phase: 'listening', activeIndex: 0, playsDone: 0 })
    expect(commands).toEqual([
      { type: 'SET_RATE', rate: 0.75 },
      { type: 'SEEK', time: 0 },
      { type: 'PLAY' },
    ])
  })

  it('disable returns to idle and PAUSE', () => {
    const state: ShadowingState = { phase: 'listening', activeIndex: 1, playsDone: 1 }
    const { next, commands } = reduceShadowing(state, { type: 'TOGGLE', enabled: false }, ctx)
    expect(next).toEqual({ phase: 'idle', activeIndex: 1, playsDone: 0 })
    expect(commands).toEqual([{ type: 'PAUSE' }])
  })
})

describe('reduceShadowing — TICK into GAP', () => {
  it('crossing seg.end - EPSILON while listening enters gap and emits PAUSE + START_GAP_TIMER', () => {
    const ctx: ReduceCtx = {
      segments: [
        { start: 0, end: 2 },
        { start: 2, end: 4 },
      ],
      config: { ...DEFAULT_SHADOWING_CONFIG, enabled: true, gapRatio: 1.0, gapFloorMs: 800 },
    }
    const state: ShadowingState = { phase: 'listening', activeIndex: 0, playsDone: 0 }
    const { next, commands } = reduceShadowing(state, { type: 'TICK', time: 2 - EPSILON }, ctx)
    expect(next).toEqual({ phase: 'gap', activeIndex: 0, playsDone: 0 })
    expect(commands).toEqual([{ type: 'PAUSE' }, { type: 'START_GAP_TIMER', ms: 2000 }])
  })

  it('applies the gap floor when lineDuration * gapRatio is below it', () => {
    const ctx: ReduceCtx = {
      segments: [{ start: 0, end: 0.4 }],
      config: { ...DEFAULT_SHADOWING_CONFIG, enabled: true, gapRatio: 1.0, gapFloorMs: 800 },
    }
    const state: ShadowingState = { phase: 'listening', activeIndex: 0, playsDone: 0 }
    const { commands } = reduceShadowing(state, { type: 'TICK', time: 0.4 }, ctx)
    expect(commands).toContainEqual({ type: 'START_GAP_TIMER', ms: 800 })
  })

  it('scales the gap by gapRatio when above the floor', () => {
    const ctx: ReduceCtx = {
      segments: [{ start: 0, end: 2 }],
      config: { ...DEFAULT_SHADOWING_CONFIG, enabled: true, gapRatio: 1.6, gapFloorMs: 800 },
    }
    const state: ShadowingState = { phase: 'listening', activeIndex: 0, playsDone: 0 }
    const { commands } = reduceShadowing(state, { type: 'TICK', time: 2 }, ctx)
    expect(commands).toContainEqual({ type: 'START_GAP_TIMER', ms: 3200 })
  })

  it('does nothing on a TICK that has not reached seg.end - EPSILON', () => {
    const ctx: ReduceCtx = {
      segments: [{ start: 0, end: 2 }],
      config: { ...DEFAULT_SHADOWING_CONFIG, enabled: true },
    }
    const state: ShadowingState = { phase: 'listening', activeIndex: 0, playsDone: 0 }
    const { next, commands } = reduceShadowing(state, { type: 'TICK', time: 1.9 }, ctx)
    expect(next).toEqual(state)
    expect(commands).toEqual([])
  })
})

describe('reduceShadowing — GAP_ELAPSED repeats the line', () => {
  const ctx: ReduceCtx = {
    segments: [
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ],
    config: { ...DEFAULT_SHADOWING_CONFIG, enabled: true, repeatCount: 3, practiceRate: 0.75 },
  }

  it('when playsDone+1 < repeatCount: bumps playsDone, re-listens, SEEK start + PLAY + SET_RATE', () => {
    const state: ShadowingState = { phase: 'gap', activeIndex: 0, playsDone: 0 }
    const { next, commands } = reduceShadowing(state, { type: 'GAP_ELAPSED' }, ctx)
    expect(next).toEqual({ phase: 'listening', activeIndex: 0, playsDone: 1 })
    expect(commands).toContainEqual({ type: 'SEEK', time: 0 })
    expect(commands).toContainEqual({ type: 'PLAY' })
    expect(commands).toContainEqual({ type: 'SET_RATE', rate: 0.75 })
  })

  it('repeats again from playsDone 1 -> 2 (2 < 3) on the same line', () => {
    const state: ShadowingState = { phase: 'gap', activeIndex: 0, playsDone: 1 }
    const { next, commands } = reduceShadowing(state, { type: 'GAP_ELAPSED' }, ctx)
    expect(next).toEqual({ phase: 'listening', activeIndex: 0, playsDone: 2 })
    expect(commands).toContainEqual({ type: 'SEEK', time: 0 })
  })
})

describe('reduceShadowing — GAP_ELAPSED advance / stop', () => {
  const segments = [
    { start: 0, end: 2 },
    { start: 2, end: 4 },
  ]

  it('repeats exhausted + autoAdvance + next exists: advances, resets playsDone, SEEK next + PLAY + SET_RATE', () => {
    const ctx: ReduceCtx = {
      segments,
      config: {
        ...DEFAULT_SHADOWING_CONFIG,
        enabled: true,
        repeatCount: 3,
        autoAdvance: true,
        practiceRate: 0.75,
      },
    }
    const state: ShadowingState = { phase: 'gap', activeIndex: 0, playsDone: 2 }
    const { next, commands } = reduceShadowing(state, { type: 'GAP_ELAPSED' }, ctx)
    expect(next).toEqual({ phase: 'listening', activeIndex: 1, playsDone: 0 })
    expect(commands).toContainEqual({ type: 'SEEK', time: 2 })
    expect(commands).toContainEqual({ type: 'PLAY' })
    expect(commands).toContainEqual({ type: 'SET_RATE', rate: 0.75 })
  })

  it('repeats exhausted + autoAdvance OFF: stops at idle with PAUSE', () => {
    const ctx: ReduceCtx = {
      segments,
      config: { ...DEFAULT_SHADOWING_CONFIG, enabled: true, repeatCount: 3, autoAdvance: false },
    }
    const state: ShadowingState = { phase: 'gap', activeIndex: 0, playsDone: 2 }
    const { next, commands } = reduceShadowing(state, { type: 'GAP_ELAPSED' }, ctx)
    expect(next).toEqual({ phase: 'idle', activeIndex: 0, playsDone: 2 })
    expect(commands).toEqual([{ type: 'PAUSE' }])
  })

  it('repeats exhausted on the LAST segment with autoAdvance on but no next: idle + PAUSE', () => {
    const ctx: ReduceCtx = {
      segments,
      config: { ...DEFAULT_SHADOWING_CONFIG, enabled: true, repeatCount: 3, autoAdvance: true },
    }
    const state: ShadowingState = { phase: 'gap', activeIndex: 1, playsDone: 2 }
    const { next, commands } = reduceShadowing(state, { type: 'GAP_ELAPSED' }, ctx)
    expect(next).toEqual({ phase: 'idle', activeIndex: 1, playsDone: 2 })
    expect(commands).toEqual([{ type: 'PAUSE' }])
  })

  it('repeatCount=1: first gap already exhausts repeats, advances immediately', () => {
    const ctx: ReduceCtx = {
      segments,
      config: { ...DEFAULT_SHADOWING_CONFIG, enabled: true, repeatCount: 1, autoAdvance: true },
    }
    const state: ShadowingState = { phase: 'gap', activeIndex: 0, playsDone: 0 }
    const { next, commands } = reduceShadowing(state, { type: 'GAP_ELAPSED' }, ctx)
    expect(next).toEqual({ phase: 'listening', activeIndex: 1, playsDone: 0 })
    expect(commands).toContainEqual({ type: 'SEEK', time: 2 })
  })

  it('repeatCount=1 + autoAdvance off: first gap stops at idle', () => {
    const ctx: ReduceCtx = {
      segments,
      config: { ...DEFAULT_SHADOWING_CONFIG, enabled: true, repeatCount: 1, autoAdvance: false },
    }
    const state: ShadowingState = { phase: 'gap', activeIndex: 0, playsDone: 0 }
    const { next, commands } = reduceShadowing(state, { type: 'GAP_ELAPSED' }, ctx)
    expect(next).toEqual({ phase: 'idle', activeIndex: 0, playsDone: 0 })
    expect(commands).toEqual([{ type: 'PAUSE' }])
  })
})

describe('reduceShadowing — JUMP', () => {
  const ctx: ReduceCtx = {
    segments: [
      { start: 0, end: 2 },
      { start: 2, end: 4 },
      { start: 5, end: 7 },
    ],
    config: { ...DEFAULT_SHADOWING_CONFIG, enabled: true, practiceRate: 0.75 },
  }

  it('sets activeIndex, resets playsDone, enters listening when enabled, SEEK target + PLAY + SET_RATE', () => {
    const state: ShadowingState = { phase: 'gap', activeIndex: 0, playsDone: 2 }
    const { next, commands } = reduceShadowing(state, { type: 'JUMP', index: 2 }, ctx)
    expect(next).toEqual({ phase: 'listening', activeIndex: 2, playsDone: 0 })
    expect(commands).toContainEqual({ type: 'SEEK', time: 5 })
    expect(commands).toContainEqual({ type: 'PLAY' })
    expect(commands).toContainEqual({ type: 'SET_RATE', rate: 0.75 })
  })

  it('when shadowing is disabled: sets index + resets playsDone but stays idle and emits no transport commands', () => {
    const disabledCtx: ReduceCtx = {
      segments: ctx.segments,
      config: { ...DEFAULT_SHADOWING_CONFIG, enabled: false },
    }
    const state: ShadowingState = { phase: 'idle', activeIndex: 0, playsDone: 3 }
    const { next, commands } = reduceShadowing(state, { type: 'JUMP', index: 1 }, disabledCtx)
    expect(next).toEqual({ phase: 'idle', activeIndex: 1, playsDone: 0 })
    expect(commands).toEqual([])
  })
})

describe('reduceShadowing — CONFIG_CHANGE', () => {
  const ctx: ReduceCtx = {
    segments: [{ start: 0, end: 2 }],
    config: { ...DEFAULT_SHADOWING_CONFIG, enabled: true },
  }

  it('is a pure no-op on state and emits no commands mid-practice (config is owned by the hook)', () => {
    const state: ShadowingState = { phase: 'listening', activeIndex: 0, playsDone: 1 }
    const { next, commands } = reduceShadowing(
      state,
      { type: 'CONFIG_CHANGE', patch: { repeatCount: 5, gapRatio: 1.6 } },
      ctx,
    )
    expect(next).toEqual(state)
    expect(commands).toEqual([])
  })
})

describe('reduceShadowing — full chain', () => {
  const ctx: ReduceCtx = {
    segments: [
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ],
    config: {
      ...DEFAULT_SHADOWING_CONFIG,
      enabled: true,
      repeatCount: 2,
      gapRatio: 1.0,
      gapFloorMs: 800,
      practiceRate: 0.75,
      autoAdvance: true,
    },
  }

  it('runs listen -> gap -> repeat -> gap -> advance on a 2-line, repeat=2 session', () => {
    let state: ShadowingState = { phase: 'idle', activeIndex: 0, playsDone: 0 }
    let res = reduceShadowing(state, { type: 'TOGGLE', enabled: true }, ctx)
    state = res.next
    expect(state).toEqual({ phase: 'listening', activeIndex: 0, playsDone: 0 })

    res = reduceShadowing(state, { type: 'TICK', time: 2 }, ctx)
    state = res.next
    expect(state).toEqual({ phase: 'gap', activeIndex: 0, playsDone: 0 })
    expect(res.commands).toContainEqual({ type: 'START_GAP_TIMER', ms: 2000 })

    res = reduceShadowing(state, { type: 'GAP_ELAPSED' }, ctx)
    state = res.next
    expect(state).toEqual({ phase: 'listening', activeIndex: 0, playsDone: 1 })
    expect(res.commands).toContainEqual({ type: 'SEEK', time: 0 })

    res = reduceShadowing(state, { type: 'TICK', time: 2 }, ctx)
    state = res.next
    expect(state).toEqual({ phase: 'gap', activeIndex: 0, playsDone: 1 })

    res = reduceShadowing(state, { type: 'GAP_ELAPSED' }, ctx)
    state = res.next
    expect(state).toEqual({ phase: 'listening', activeIndex: 1, playsDone: 0 })
    expect(res.commands).toContainEqual({ type: 'SEEK', time: 2 })

    res = reduceShadowing(state, { type: 'TICK', time: 4 }, ctx)
    state = res.next
    res = reduceShadowing(state, { type: 'GAP_ELAPSED' }, ctx)
    state = res.next
    expect(state).toEqual({ phase: 'listening', activeIndex: 1, playsDone: 1 })
    res = reduceShadowing(state, { type: 'TICK', time: 4 }, ctx)
    state = res.next
    res = reduceShadowing(state, { type: 'GAP_ELAPSED' }, ctx)
    state = res.next
    expect(state).toEqual({ phase: 'idle', activeIndex: 1, playsDone: 1 })
    expect(res.commands).toEqual([{ type: 'PAUSE' }])
  })

  it('practiceRate=1 still emits SET_RATE(1) when entering listening', () => {
    const rate1Ctx: ReduceCtx = {
      segments: ctx.segments,
      config: { ...ctx.config, practiceRate: 1 },
    }
    const state: ShadowingState = { phase: 'idle', activeIndex: 0, playsDone: 0 }
    const { commands } = reduceShadowing(state, { type: 'TOGGLE', enabled: true }, rate1Ctx)
    expect(commands).toContainEqual({ type: 'SET_RATE', rate: 1 })
  })

  it('manual A/B special case: huge repeatCount + zero gap keeps repeating the same line', () => {
    const abCtx: ReduceCtx = {
      segments: [{ start: 1, end: 3 }],
      config: {
        ...DEFAULT_SHADOWING_CONFIG,
        enabled: true,
        repeatCount: Number.MAX_SAFE_INTEGER,
        gapRatio: 0,
        gapFloorMs: 0,
        practiceRate: 1,
        autoAdvance: false,
      },
    }
    let state: ShadowingState = { phase: 'listening', activeIndex: 0, playsDone: 0 }
    let res = reduceShadowing(state, { type: 'TICK', time: 3 }, abCtx)
    state = res.next
    expect(state.phase).toBe('gap')
    expect(res.commands).toContainEqual({ type: 'START_GAP_TIMER', ms: 0 })

    res = reduceShadowing(state, { type: 'GAP_ELAPSED' }, abCtx)
    state = res.next
    expect(state).toEqual({ phase: 'listening', activeIndex: 0, playsDone: 1 })
    expect(res.commands).toContainEqual({ type: 'SEEK', time: 1 })
  })
})
