import { describe, expect, it } from 'vitest'
import {
  analyzeSamples,
  buildRhythmReference,
  classifyVerdict,
  computeEnvelope,
  computeStartDelaySec,
  detectSpeechBounds,
  MIN_PEAK_RMS,
  RHYTHM_THRESHOLDS,
  type RhythmReference,
} from '~/lib/player/rhythm'

const SAMPLE_RATE = 16_000

/** 生成 [0, totalSec) 的采样，`speech` 指定的区间填入 440Hz 正弦，其余为指定幅度的底噪。 */
function makeSignal(
  totalSec: number,
  speech: Array<[number, number]>,
  opts: { speechAmp?: number; noiseAmp?: number; syllableHz?: number } = {},
): Float32Array {
  const { speechAmp = 0.5, noiseAmp = 0, syllableHz } = opts
  const total = Math.round(totalSec * SAMPLE_RATE)
  const out = new Float32Array(total)
  for (let i = 0; i < total; i++) {
    const t = i / SAMPLE_RATE
    const inSpeech = speech.some(([s, e]) => t >= s && t < e)
    if (inSpeech) {
      // syllableHz 给语音加上音节起伏（谷值约 10%），贴近真实语音的能量动态；
      // 不加则是等幅正弦，属于"能量恒定"的退化信号。
      const envelope = syllableHz
        ? 0.1 + 0.9 * (0.5 - 0.5 * Math.cos(2 * Math.PI * syllableHz * t))
        : 1
      out[i] = speechAmp * envelope * Math.sin(2 * Math.PI * 440 * t)
    } else if (noiseAmp > 0) {
      // 确定性的"底噪"：用不同频率的低幅正弦代替随机数，保证测试可复现
      out[i] = noiseAmp * Math.sin(2 * Math.PI * 97 * t)
    }
  }
  return out
}

describe('computeEnvelope', () => {
  it('按帧长/帧移切分并返回每帧 RMS', () => {
    const env = computeEnvelope(new Float32Array(SAMPLE_RATE), SAMPLE_RATE, {
      frameMs: 20,
      hopMs: 10,
    })
    expect(env.frameSec).toBeCloseTo(0.02, 5)
    expect(env.hopSec).toBeCloseTo(0.01, 5)
    // 1s、帧长 20ms、帧移 10ms → (16000-320)/160 + 1 = 99
    expect(env.rms.length).toBe(99)
  })

  it('正弦的 RMS 约等于幅度/√2', () => {
    const env = computeEnvelope(makeSignal(0.5, [[0, 0.5]], { speechAmp: 0.8 }), SAMPLE_RATE)
    const mid = env.rms[Math.floor(env.rms.length / 2)]
    expect(mid).toBeCloseTo(0.8 / Math.SQRT2, 2)
  })

  it('采样短于一个帧长时返回空包络而不是抛错', () => {
    const env = computeEnvelope(new Float32Array(10), SAMPLE_RATE)
    expect(env.rms.length).toBe(0)
  })
})

describe('detectSpeechBounds', () => {
  it('定位已知的语音起止', () => {
    // 0.5s 静音 → 1.0s 语音 → 0.5s 静音
    const samples = makeSignal(2.0, [[0.5, 1.5]])
    const bounds = detectSpeechBounds(computeEnvelope(samples, SAMPLE_RATE))
    expect(bounds).not.toBeNull()
    expect(bounds?.onsetSec).toBeGreaterThan(0.45)
    expect(bounds?.onsetSec).toBeLessThan(0.56)
    expect(bounds?.offsetSec).toBeGreaterThan(1.44)
    expect(bounds?.offsetSec).toBeLessThan(1.56)
  })

  it('整段静音时返回 null（UI 显示"没听到人声"）', () => {
    expect(detectSpeechBounds(computeEnvelope(makeSignal(1.0, []), SAMPLE_RATE))).toBeNull()
  })

  it('极低幅度的录音判为无人声', () => {
    const quiet = makeSignal(1.0, [[0.2, 0.8]], { speechAmp: MIN_PEAK_RMS / 2 })
    expect(detectSpeechBounds(computeEnvelope(quiet, SAMPLE_RATE))).toBeNull()
  })

  it('底噪明显但不含人声时不误判（阈值随噪声底抬升）', () => {
    // 全段 0.05 幅度的恒定底噪，峰值≈0.035 > MIN_PEAK_RMS，但它是"处处相同"的，
    // 噪声底会把它一起抬上去，因此不该被当成整段都在说话。
    const noisy = makeSignal(1.0, [], { noiseAmp: 0.05 })
    const bounds = detectSpeechBounds(computeEnvelope(noisy, SAMPLE_RATE))
    expect(bounds).toBeNull()
  })

  it('默认连续帧要求可滤掉约 10ms 的短促咔哒', () => {
    // 咔哒 0.200–0.210（10ms）远低于默认 need*hop = 30ms，不该被当作开口
    const samples = makeSignal(1.0, [
      [0.2, 0.21],
      [0.5, 0.9],
    ])
    const bounds = detectSpeechBounds(computeEnvelope(samples, SAMPLE_RATE))
    expect(bounds?.onsetSec).toBeGreaterThan(0.45)
  })

  it('连续帧要求可调：50ms 短段在 need=8 时被忽略、need=3 时被采用', () => {
    const samples = makeSignal(1.0, [
      [0.2, 0.25],
      [0.5, 0.9],
    ])
    const env = computeEnvelope(samples, SAMPLE_RATE)
    expect(detectSpeechBounds(env, 8)?.onsetSec).toBeGreaterThan(0.45)
    expect(detectSpeechBounds(env, 3)?.onsetSec).toBeLessThan(0.36)
  })

  it('多段语音时覆盖首尾整体区间', () => {
    const samples = makeSignal(2.0, [
      [0.3, 0.6],
      [1.2, 1.6],
    ])
    const bounds = detectSpeechBounds(computeEnvelope(samples, SAMPLE_RATE))
    expect(bounds?.onsetSec).toBeGreaterThan(0.25)
    expect(bounds?.onsetSec).toBeLessThan(0.36)
    expect(bounds?.offsetSec).toBeGreaterThan(1.54)
  })
})

describe('classifyVerdict', () => {
  it('按阈值分为抢拍 / 合拍 / 拖拍', () => {
    expect(classifyVerdict(-0.3)).toBe('ahead')
    expect(classifyVerdict(0)).toBe('onTime')
    expect(classifyVerdict(0.4)).toBe('onTime')
    expect(classifyVerdict(1.2)).toBe('late')
  })

  it('阈值边界本身归入对应档位', () => {
    expect(classifyVerdict(RHYTHM_THRESHOLDS.aheadSec)).toBe('ahead')
    expect(classifyVerdict(RHYTHM_THRESHOLDS.lateSec)).toBe('late')
  })
})

describe('computeStartDelaySec / buildRhythmReference', () => {
  const base = {
    phaseStartedAtMs: 1000,
    capturedAtMs: 1400,
    mediaTimeSec: 8,
    segmentEndSec: 10,
    rate: 1,
  } as const

  it('gap：零点就是阶段开始时刻，结果非负', () => {
    expect(computeStartDelaySec({ ...base, phase: 'gap' })).toBeCloseTo(0.4, 5)
  })

  it('gap：即使时间倒退（异常时钟）也不会给出负值', () => {
    expect(computeStartDelaySec({ ...base, phase: 'gap', capturedAtMs: 500 })).toBe(0)
  })

  it('listening：媒体还在播 → 得到负值，抢拍因此可达', () => {
    // 距原句结束还有 2s 媒体时间，1x → -2s
    expect(computeStartDelaySec({ ...base, phase: 'listening' })).toBeCloseTo(-2, 5)
  })

  it('listening：按倍速换算剩余时长（0.75x 慢放 → 墙钟更长）', () => {
    expect(computeStartDelaySec({ ...base, phase: 'listening', rate: 0.75 })).toBeCloseTo(
      -(2 / 0.75),
      4,
    )
  })

  it('listening：媒体已越过原句末尾时不产生正延迟', () => {
    expect(computeStartDelaySec({ ...base, phase: 'listening', mediaTimeSec: 12 })).toBeCloseTo(
      -0,
      5,
    )
  })

  it('listening：倍速非法时无法换算 → null', () => {
    expect(computeStartDelaySec({ ...base, phase: 'listening', rate: 0 })).toBeNull()
  })

  it('other：没有有意义的零点 → null', () => {
    expect(computeStartDelaySec({ ...base, phase: 'other' })).toBeNull()
  })

  it('buildRhythmReference：有零点时 basis=sentenceEnd 并带上原句时长', () => {
    const ref = buildRhythmReference({ ...base, phase: 'listening', referenceSec: 4 })
    expect(ref.basis).toBe('sentenceEnd')
    expect(ref.startDelaySec).toBeCloseTo(-2, 5)
    expect(ref.referenceSec).toBe(4)
  })

  it('buildRhythmReference：拿不到零点时退化为 manual（只保留语速比）', () => {
    const ref = buildRhythmReference({ ...base, phase: 'other', referenceSec: 4 })
    expect(ref.basis).toBe('manual')
    expect(ref.startDelaySec).toBe(0)
    expect(ref.referenceSec).toBe(4)
  })

  it('端到端：listening 下抢先开口 → 分档为"抢拍"（该档位确实可达）', () => {
    // 距结束还有 1s 媒体时间，用户在录音内 0.2s 就开口 → 延迟 ≈ -0.8s
    const ref = buildRhythmReference({
      ...base,
      phase: 'listening',
      mediaTimeSec: 9,
      rate: 1,
      referenceSec: 4,
    })
    const samples = makeSignal(2.0, [[0.2, 1.2]], { syllableHz: 4 })
    const result = analyzeSamples(samples, SAMPLE_RATE, ref)
    expect(result?.verdict).toBe('ahead')
    expect(result?.onsetLatencySec).toBeLessThan(0)
  })
})

describe('analyzeSamples', () => {
  const reference: RhythmReference = {
    basis: 'sentenceEnd',
    startDelaySec: 0.2,
    referenceSec: 2.0,
  }

  it('开口延迟 = 录音开始延迟 + 录音内起音偏移', () => {
    const samples = makeSignal(2.0, [[0.3, 1.3]])
    const result = analyzeSamples(samples, SAMPLE_RATE, reference)
    expect(result).not.toBeNull()
    // 0.2（按下录音前已过的间隔）+ 0.3（录音内开口）≈ 0.5
    expect(result?.onsetLatencySec).toBeGreaterThan(0.45)
    expect(result?.onsetLatencySec).toBeLessThan(0.56)
    expect(result?.verdict).toBe('onTime')
    expect(result?.basis).toBe('sentenceEnd')
  })

  it('语速比 = 有效语音时长 ÷ 原句自然时长', () => {
    // 语音 1.0s，原句 2.0s → ≈0.5（说了一半的时间）
    const samples = makeSignal(2.0, [[0.0, 1.0]])
    const result = analyzeSamples(samples, SAMPLE_RATE, reference)
    expect(result?.paceRatio).toBeGreaterThan(0.45)
    expect(result?.paceRatio).toBeLessThan(0.56)
  })

  it('语速与原句相同时比值为 1', () => {
    // 整段都是有音节起伏的语音（真实语音总是有动态），应能正常识别
    const samples = makeSignal(2.0, [[0.0, 2.0]], { syllableHz: 4 })
    const result = analyzeSamples(samples, SAMPLE_RATE, reference)
    expect(result).not.toBeNull()
    expect(result?.paceRatio).toBeGreaterThan(0.95)
    expect(result?.paceRatio).toBeLessThan(1.05)
  })

  it('能量恒定的退化信号（无停顿无起伏）判为无人声——这是刻意的保守取舍', () => {
    // 全段等幅正弦与"纯底噪"在信息上不可区分：噪声底≈峰值，阈值必然高于峰值。
    // 与其用这种信号编出一组节奏数字，不如报告"没听到人声"。
    const flat = makeSignal(2.0, [[0.0, 2.0]])
    expect(analyzeSamples(flat, SAMPLE_RATE, reference)).toBeNull()
  })

  it('原句时长非法时语速比为 null，但仍给出延迟与分档', () => {
    const samples = makeSignal(2.0, [[0.3, 1.3]])
    const result = analyzeSamples(samples, SAMPLE_RATE, { ...reference, referenceSec: 0 })
    expect(result).not.toBeNull()
    expect(result?.paceRatio).toBeNull()
    expect(result?.verdict).toBe('onTime')
  })

  it('manual 基准原样透传（UI 借此隐藏"开口延迟"）', () => {
    const samples = makeSignal(2.0, [[0.3, 1.3]])
    const result = analyzeSamples(samples, SAMPLE_RATE, {
      ...reference,
      basis: 'manual',
      startDelaySec: 0,
    })
    expect(result?.basis).toBe('manual')
    expect(result?.onsetLatencySec).toBeLessThan(0.4)
  })

  it('无人声时返回 null 而不是抛错', () => {
    expect(analyzeSamples(makeSignal(1.0, []), SAMPLE_RATE, reference)).toBeNull()
  })

  it('非法采样率返回 null', () => {
    const samples = makeSignal(1.0, [[0.1, 0.5]])
    expect(analyzeSamples(samples, 0, reference)).toBeNull()
  })

  it('明显晚开口判为拖拍', () => {
    const samples = makeSignal(2.0, [[1.2, 1.8]])
    const result = analyzeSamples(samples, SAMPLE_RATE, reference)
    // 0.2 + 1.2 = 1.4s
    expect(result?.verdict).toBe('late')
  })
})
