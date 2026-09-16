/**
 * 解码层 —— 把录音 Blob 变成纯 PCM，交给 `~/lib/player/rhythm` 做分析。
 *
 * 这里是唯一允许出现浏览器音频 API 的地方：`rhythm.ts` 保持纯函数以便单测，
 * 而 Web Audio 在 happy-dom 里不存在。因此本模块的所有失败路径都返回 null
 * （"分析不了"），绝不抛错——跟读练习中分析失败不该打断练习。
 */

export interface DecodedAudio {
  /** 单声道混合后的采样，范围约 [-1, 1]。 */
  samples: Float32Array
  sampleRate: number
}

type AudioContextCtor = new () => AudioContext

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  if (typeof window.AudioContext !== 'undefined') return window.AudioContext
  // Safari 旧版只有 webkit 前缀
  const legacy = window as Window & { webkitAudioContext?: AudioContextCtor }
  return legacy.webkitAudioContext ?? null
}

/** 当前环境是否具备解码能力（用于 UI 区分"不支持"与"没听到人声"）。*/
export function isAudioDecodingSupported(): boolean {
  return getAudioContextCtor() !== null && typeof Blob !== 'undefined'
}

/** 多声道平均成单声道。 */
function toMono(buffer: AudioBuffer): Float32Array {
  const channels = buffer.numberOfChannels
  const length = buffer.length
  if (channels <= 1) {
    // getChannelData 返回的是内部缓冲的视图；复制一份避免解码上下文关闭后失效
    return new Float32Array(buffer.getChannelData(0))
  }

  const out = new Float32Array(length)
  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < length; i++) {
      out[i] += data[i]
    }
  }
  for (let i = 0; i < length; i++) {
    out[i] /= channels
  }
  return out
}

/**
 * 解码为单声道 PCM。
 *
 * 返回 null 的情形：环境不支持、Blob 为空、或解码失败（例如浏览器录出的容器
 * 本身解不开）。调用方应据此显示"无法分析节奏"，而不是把它当错误上报。
 */
export async function decodeAudioBlob(blob: Blob): Promise<DecodedAudio | null> {
  const Ctor = getAudioContextCtor()
  if (!Ctor || blob.size === 0) return null

  let ctx: AudioContext | null = null
  try {
    ctx = new Ctor()
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = await ctx.decodeAudioData(arrayBuffer)
    if (buffer.length === 0 || buffer.sampleRate <= 0) return null
    return { samples: toMono(buffer), sampleRate: buffer.sampleRate }
  } catch {
    return null
  } finally {
    // 每个录音都新建一个上下文，必须关掉，否则会耗掉浏览器的 AudioContext 配额
    if (ctx) void ctx.close().catch(() => {})
  }
}
