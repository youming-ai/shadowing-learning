/**
 * 「节拍」节奏分析 —— 跟读的时序反馈。
 *
 * 这是本项目区别于普通字幕阅读器的信号：Trancy 一类产品只给发音打分数，
 * 不告诉你"你是抢拍还是拖拍"。而这两件事只需要录音本身 + 原句时长即可算出，
 * 不需要云端、不需要 ASR。
 *
 * 分工（刻意如此）：
 * - 本模块是**纯函数**，只吃 PCM 采样，不碰 DOM / AudioContext，因此可单测。
 * - 蓝牙解码（Blob → PCM）在 `~/lib/audio/decode` 里，那里才允许出现浏览器 API。
 *
 * 术语：
 * - **基准（reference）**：算延迟的零点。目前有两种，语义不同，UI 必须区分：
 *   - `sentenceEnd`：原句播完、进入跟读间隔的那一刻（推荐基准，间距模型下唯一有意义的零点）
 *   - `manual`：按下录音键那一刻（没有间隔模型时的退路）
 * - **开口延迟（onset latency）**：从基准到用户第一个有效声音的秒数。正数=晚了。
 * - **语速比（pace ratio）**：用户有效语音时长 ÷ 原句自然时长。1.0=同速。
 *
 * 注意：原句可能以 0.75x 慢放练习，但语速比的参照是**原句自然时长**
 * （`segment.end - segment.start`），不是被拉长后的墙钟时长——否则用户在正常语速下
 * 会被判成"快 33%"。这个选择写在 `referenceSec` 的调用方。
 */

/** RMS 低于此值视为整段无人声（约 -42 dBFS）。 */
export const MIN_PEAK_RMS = 0.008

/** 噪声底之上的倍数，超过才算有声。 */
export const NOISE_FACTOR = 3

/** 同时要求达到峰值的一定比例，避免把整体很轻的录音全部判成有声。 */
export const PEAK_RATIO = 0.12

/** 连续多少帧越阈才算"起音"，用于滤掉单帧咔哒声。 */
export const MIN_VOICED_FRAMES = 3

/** 开口延迟分档阈值（秒）。 */
export const RHYTHM_THRESHOLDS = {
  /** 早于此值 → 抢拍（基本与原句重叠） */
  aheadSec: -0.15,
  /** 晚于此值 → 拖拍 */
  lateSec: 0.6,
  /** 语速比偏离 1.0 超过此比例时，UI 可额外提示快/慢 */
  paceTolerance: 0.2,
} as const

export type RhythmVerdict = 'ahead' | 'onTime' | 'late'

/** 计算包络的参数。 */
export interface EnvelopeOptions {
  /** 帧长（毫秒）。越长越平滑，越短越灵敏。默认 20。 */
  frameMs?: number
  /** 帧移（毫秒）。默认 10（即 50% 重叠）。 */
  hopMs?: number
}

export interface Envelope {
  /** 每帧 RMS。 */
  rms: Float32Array
  /** 帧移的秒数 —— 把帧序号换算成时间用它。 */
  hopSec: number
  /** 帧长的秒数 —— 帧尾时间要额外加它。 */
  frameSec: number
}

export interface SpeechBounds {
  /** 第一个有效声音的起始秒数（相对录音开头）。 */
  onsetSec: number
  /** 最后一个有效声音的结束秒数（相对录音开头）。 */
  offsetSec: number
}

export interface RhythmReference {
  /** 零点语义。 */
  basis: 'sentenceEnd' | 'manual'
  /** 录音开始时刻相对零点的秒数（由 hook 用 performance.now() 差值算出）。 */
  startDelaySec: number
  /** 原句自然时长（秒），即 `segment.end - segment.start`。<=0 时不做语速比。 */
  referenceSec: number
}

export interface RhythmResult {
  basis: RhythmReference['basis']
  /** 相对录音开头的起止，便于调试与展示原始区间。 */
  onsetSec: number
  offsetSec: number
  /** 开口延迟：基准 → 第一个有效声音。 */
  onsetLatencySec: number
  /** 有效语音时长。 */
  speechSec: number
  /** 语速比；`referenceSec` 非法时为 null。 */
  paceRatio: number | null
  verdict: RhythmVerdict
}

/** 采集真正开始那一刻的处境。用于换算"相对原句结束"的零点。*/
export interface StartDelayInput {
  /** 采集开始时的阶段 */
  phase: 'listening' | 'gap' | 'other'
  /** 当前阶段开始时刻（单调 ms）。仅 `gap` 用得上。*/
  phaseStartedAtMs: number
  /** 采集真正开始的时刻（单调 ms） */
  capturedAtMs: number
  /** 采集开始那一刻的媒体播放位置（秒）。仅 `listening` 用得上。*/
  mediaTimeSec: number
  /** 原句结束的媒体时间（秒） */
  segmentEndSec: number
  /** 当前实际播放倍速。仅 `listening` 用得上。*/
  rate: number
}

/**
 * 换算"从原句结束到采集开始"的秒数（可为负）。
 *
 * 两种处境归一到同一个零点——**原句结束的那一刻**：
 *
 * - `gap`：媒体已暂停在原句末尾，零点就是阶段开始的墙钟时刻，结果必然 ≥ 0。
 * - `listening`：媒体还在播、原句尚未结束，把"剩余媒体时长"按倍速换算成墙钟时长后取**负**。
 *   于是**抢拍（在原句结束前就开口）能得到负值**，`ahead` 分档才真正可达；
 *   这也是"真正的影子跟读"（与原声重叠）唯一可被测量的场景。
 *
 * `other`（未开启跟读等）返回 null：没有任何有意义的零点，调用方退化为 `manual`。
 */
export function computeStartDelaySec(input: StartDelayInput): number | null {
  if (input.phase === 'gap') {
    return Math.max(0, (input.capturedAtMs - input.phaseStartedAtMs) / 1000)
  }
  if (input.phase === 'listening' && input.rate > 0) {
    const remainingSec = Math.max(0, input.segmentEndSec - input.mediaTimeSec)
    return -(remainingSec / input.rate)
  }
  return null
}

/**
 * 组装给 `analyzeSamples` 的参考量。拿不到有意义的零点时退化为 `manual`
 * （此时开口延迟无意义，UI 只展示语速比、不展示分档）。
 */
export function buildRhythmReference(
  input: StartDelayInput & { referenceSec: number },
): RhythmReference {
  const startDelaySec = computeStartDelaySec(input)
  if (startDelaySec === null) {
    return { basis: 'manual', startDelaySec: 0, referenceSec: input.referenceSec }
  }
  return { basis: 'sentenceEnd', startDelaySec, referenceSec: input.referenceSec }
}

/**
 * 取第 p 分位数（0..1）。用于估计噪声底：说话人只占录音的一小部分，
 * 低分位数比"最小值"稳（不会被一帧纯数字静音带偏），也比"均值"稳（不被语音拉高）。
 */
function percentile(values: Float32Array, p: number): number {
  if (values.length === 0) return 0
  const sorted = Array.from(values).sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))
  return sorted[idx]
}

/** 把 PCM 采样切成带重叠的帧，算每帧 RMS。多声道请在调用前混成单声道。 */
export function computeEnvelope(
  samples: Float32Array,
  sampleRate: number,
  opts: EnvelopeOptions = {},
): Envelope {
  const frameMs = opts.frameMs ?? 20
  const hopMs = opts.hopMs ?? 10
  const frameLen = Math.max(1, Math.round((frameMs / 1000) * sampleRate))
  const hopLen = Math.max(1, Math.round((hopMs / 1000) * sampleRate))
  const frameSec = frameLen / sampleRate
  const hopSec = hopLen / sampleRate

  if (samples.length < frameLen) {
    return { rms: new Float32Array(0), hopSec, frameSec }
  }

  const frameCount = Math.floor((samples.length - frameLen) / hopLen) + 1
  const rms = new Float32Array(frameCount)
  for (let f = 0; f < frameCount; f++) {
    const start = f * hopLen
    let sum = 0
    for (let i = 0; i < frameLen; i++) {
      const s = samples[start + i]
      sum += s * s
    }
    rms[f] = Math.sqrt(sum / frameLen)
  }

  return { rms, hopSec, frameSec }
}

/**
 * 在包络上找语音起止。
 *
 * 返回 null 的情形（调用方应显示"没听到人声"而不是报错）：
 * - 帧数不足以做判断
 * - 峰值低于 `MIN_PEAK_RMS`（整段基本无声）
 *
 * 阈值取三者最大：噪声底 × `NOISE_FACTOR`、峰值 × `PEAK_RATIO`、`MIN_PEAK_RMS`。
 * 起音/收音都要求连续 `MIN_VOICED_FRAMES` 帧越阈，以滤掉极短的咔哒与尾部杂音
 * （默认 3 帧 × 帧移 10ms ≈ 30ms）。
 *
 * **已知边界（刻意取舍）**：整段能量恒定、既无停顿也无起伏的信号会被判为无人声。
 * 因为此时噪声底≈峰值，二者在信息上无法区分"纯底噪"与"等幅持续音"。真实语音总有
 * 音节动态，不会踩到；而用户按了录音却一言不发的场景，我们更希望报告"没听到人声"，
 * 而不是拿底噪编出一组节奏数字。
 */
export function detectSpeechBounds(
  envelope: Envelope,
  minVoicedFrames = MIN_VOICED_FRAMES,
): SpeechBounds | null {
  const { rms, hopSec, frameSec } = envelope
  if (rms.length === 0) return null

  let peak = 0
  for (let i = 0; i < rms.length; i++) {
    if (rms[i] > peak) peak = rms[i]
  }
  if (peak < MIN_PEAK_RMS) return null

  const noiseFloor = percentile(rms, 0.1)
  const threshold = Math.max(noiseFloor * NOISE_FACTOR, peak * PEAK_RATIO, MIN_PEAK_RMS)
  const need = Math.max(1, Math.floor(minVoicedFrames))

  // 起音：第一个"连续 need 帧都越阈"的**起点**
  let onsetFrame = -1
  let run = 0
  for (let i = 0; i < rms.length; i++) {
    if (rms[i] >= threshold) {
      run++
      if (run >= need) {
        onsetFrame = i - (need - 1)
        break
      }
    } else {
      run = 0
    }
  }
  if (onsetFrame < 0) return null

  // 收音：最后一个"连续 need 帧都越阈"的**终点**
  let offsetFrame = -1
  run = 0
  for (let i = rms.length - 1; i >= 0; i--) {
    if (rms[i] >= threshold) {
      run++
      if (run >= need) {
        offsetFrame = i + (need - 1)
        break
      }
    } else {
      run = 0
    }
  }
  if (offsetFrame < onsetFrame) return null

  const onsetSec = onsetFrame * hopSec
  const offsetSec = offsetFrame * hopSec + frameSec
  if (offsetSec <= onsetSec) return null

  return { onsetSec, offsetSec }
}

/** 按开口延迟分档。 */
export function classifyVerdict(onsetLatencySec: number): RhythmVerdict {
  if (onsetLatencySec <= RHYTHM_THRESHOLDS.aheadSec) return 'ahead'
  if (onsetLatencySec >= RHYTHM_THRESHOLDS.lateSec) return 'late'
  return 'onTime'
}

/**
 * 从 PCM 采样直接出节奏结论。任一步失败都返回 null（UI 显示为"无法分析"，
 * 而不是抛错——跟读练习中分析失败不该打断练习）。
 */
export function analyzeSamples(
  samples: Float32Array,
  sampleRate: number,
  reference: RhythmReference,
  opts: EnvelopeOptions = {},
): RhythmResult | null {
  if (sampleRate <= 0) return null
  const envelope = computeEnvelope(samples, sampleRate, opts)
  const bounds = detectSpeechBounds(envelope)
  if (!bounds) return null

  const speechSec = bounds.offsetSec - bounds.onsetSec
  const onsetLatencySec = reference.startDelaySec + bounds.onsetSec
  const paceRatio = reference.referenceSec > 0 ? speechSec / reference.referenceSec : null

  return {
    basis: reference.basis,
    onsetSec: bounds.onsetSec,
    offsetSec: bounds.offsetSec,
    onsetLatencySec,
    speechSec,
    paceRatio,
    verdict: classifyVerdict(onsetLatencySec),
  }
}
