import { describe, expect, it, vi } from 'vitest'
import type { PostProcessTransport } from '~/lib/ai/transports'
import {
  chunkSegmentsForPostProcess,
  runChunkedPostProcess,
} from '~/lib/subtitles/chunk-postprocess'
import {
  FatalEngineError,
  type PostProcessResult as ProcessedSegment,
  RetryableEngineError,
} from '~shared/ai/postprocess-core'

const seg = (i: number, text: string) => ({ segmentIndex: i, start: i, end: i + 1, text })

/** 构造传输层要求的完整 PostProcessResult（类型是有意的，不接受最小子集）*/
const processed = (segmentIndex: number, normalizedText = 'ok'): ProcessedSegment => ({
  originalText: normalizedText,
  normalizedText,
  translation: '',
  annotations: [],
  furigana: '',
  start: segmentIndex,
  end: segmentIndex + 1,
  segmentIndex,
})

/** 假传输层：记录每片的大小，并回填可辨识的翻译。 */
function fakeTransport(impl: (segments: { segmentIndex: number }[]) => Promise<unknown>): {
  transport: PostProcessTransport
  sizes: number[]
} {
  const sizes: number[] = []
  return {
    sizes,
    transport: {
      id: 'fake',
      async run(segments) {
        sizes.push(segments.length)
        return (await impl(segments)) as never
      },
    },
  }
}

describe('chunkSegmentsForPostProcess', () => {
  it('splits by 100-segment limit', () => {
    const segs = Array.from({ length: 250 }, (_, i) => seg(i, 'a'))
    const chunks = chunkSegmentsForPostProcess(segs)
    expect(chunks.map((c) => c.length)).toEqual([100, 100, 50])
  })

  it('splits by 10000-char total limit', () => {
    const segs = Array.from({ length: 12 }, (_, i) => seg(i, 'x'.repeat(1000)))
    const chunks = chunkSegmentsForPostProcess(segs)
    expect(chunks.map((c) => c.length)).toEqual([10, 2])
  })

  it('keeps global segmentIndex values inside chunks', () => {
    const segs = Array.from({ length: 150 }, (_, i) => seg(i, 'a'))
    const chunks = chunkSegmentsForPostProcess(segs)
    expect(chunks[1][0].segmentIndex).toBe(100)
  })
})

describe('runChunkedPostProcess', () => {
  it('逐片串行调用传输层，并逐片回报结果', async () => {
    const segs = Array.from({ length: 150 }, (_, i) => seg(i, 'hello'))
    const { transport, sizes } = fakeTransport(async (chunk) =>
      chunk.map((s) => ({
        segmentIndex: s.segmentIndex,
        normalizedText: 'x',
        translation: `t${s.segmentIndex}`,
      })),
    )
    const onChunkDone = vi.fn()
    const result = await runChunkedPostProcess({
      segments: segs,
      language: 'en',
      targetLanguage: 'zh-CN',
      enableFurigana: false,
      transport,
      onChunkDone,
    })
    expect(sizes).toEqual([100, 50])
    expect(onChunkDone).toHaveBeenCalledTimes(2)
    expect(result.completedChunks).toBe(2)
    expect(result.failed).toBe(false)
  })

  it('第一片失败即停止，并给出续跑点', async () => {
    const segs = Array.from({ length: 150 }, (_, i) => seg(i, 'hello'))
    let n = 0
    const { transport } = fakeTransport(async (chunk) => {
      n++
      if (n > 1) throw new Error('HTTP 500')
      return chunk.map((s) => ({ segmentIndex: s.segmentIndex, normalizedText: 'x' }))
    })
    const result = await runChunkedPostProcess({
      segments: segs,
      language: 'en',
      targetLanguage: 'zh-CN',
      enableFurigana: false,
      transport,
      onChunkDone: vi.fn(),
    })
    expect(result.failed).toBe(true)
    expect(result.completedChunks).toBe(1)
    expect(result.error).toContain('HTTP 500')
  })

  it('把语言与 furigana 选项原样交给传输层', async () => {
    const seen: unknown[] = []
    const { transport } = fakeTransport(async () => [])
    transport.run = async (_segments, options) => {
      seen.push(options)
      return []
    }
    await runChunkedPostProcess({
      segments: [seg(0, 'a')],
      language: 'ja',
      targetLanguage: 'zh-CN',
      enableFurigana: true,
      transport,
      onChunkDone: vi.fn(),
    })
    expect(seen[0]).toEqual({
      language: 'ja',
      targetLanguage: 'zh-CN',
      enableAnnotations: true,
      enableFurigana: true,
    })
  })
})

describe('runChunkedPostProcess 的重试与退避', () => {
  const baseOpts = {
    segments: [seg(0, 'a')],
    language: 'en',
    targetLanguage: 'zh-CN',
    enableFurigana: false,
    onChunkDone: vi.fn(),
  }

  /** 第 n 次调用抛 RetryableEngineError，之后返回成功。 */
  function transportFailingTimes(times: number, retryAfterSec: number | null = null) {
    let calls = 0
    const t: PostProcessTransport = {
      id: 'flaky',
      async run() {
        calls++
        if (calls <= times) throw new RetryableEngineError('RATE_LIMITED (429)', retryAfterSec)
        return [processed(0)]
      },
    }
    return { t, calls: () => calls }
  }

  it('限流后重试并最终成功', async () => {
    const { t, calls } = transportFailingTimes(2)
    const sleep = vi.fn(async () => {})
    const result = await runChunkedPostProcess({ ...baseOpts, transport: t, sleep })
    expect(result.failed).toBe(false)
    expect(result.completedChunks).toBe(1)
    expect(calls()).toBe(3)
    expect(sleep).toHaveBeenCalledTimes(2)
  })

  it('尊重服务端 Retry-After，而不是用自己的退避曲线', async () => {
    const { t } = transportFailingTimes(1, 7)
    const slept: number[] = []
    await runChunkedPostProcess({
      ...baseOpts,
      transport: t,
      sleep: async (ms) => {
        slept.push(ms)
      },
    })
    expect(slept).toEqual([7000])
  })

  it('Retry-After 被夹在上限内（不接受离谱的等待）', async () => {
    const { t } = transportFailingTimes(1, 999999)
    const slept: number[] = []
    await runChunkedPostProcess({
      ...baseOpts,
      transport: t,
      sleep: async (ms) => {
        slept.push(ms)
      },
    })
    expect(slept[0]).toBeLessThanOrEqual(20_000)
  })

  it('重试耗尽后如实失败，并说明已重试过', async () => {
    const { t, calls } = transportFailingTimes(99)
    const result = await runChunkedPostProcess({
      ...baseOpts,
      transport: t,
      retryPolicy: { maxAttempts: 3 },
      sleep: async () => {},
    })
    expect(result.failed).toBe(true)
    expect(result.error).toContain('RATE_LIMITED')
    expect(result.error).toContain('已重试 3 次')
    expect(calls()).toBe(3)
  })

  it('系统性失败不重试（无效 key 重试无意义）', async () => {
    let calls = 0
    const t: PostProcessTransport = {
      id: 'bad-key',
      async run() {
        calls++
        throw new FatalEngineError('INVALID_KEY (401)', 'ENGINE_UNAVAILABLE')
      },
    }
    const sleep = vi.fn(async () => {})
    const result = await runChunkedPostProcess({ ...baseOpts, transport: t, sleep })
    expect(result.failed).toBe(true)
    expect(result.error).toContain('INVALID_KEY')
    expect(result.error).not.toContain('已重试')
    expect(calls).toBe(1)
    expect(sleep).not.toHaveBeenCalled()
  })

  it('成功分片不被重试，且续跑点正确', async () => {
    const segs = Array.from({ length: 150 }, (_, i) => seg(i, 'x'))
    let calls = 0
    const t: PostProcessTransport = {
      id: 'ok',
      async run(chunk) {
        calls++
        return chunk.map((s) => processed(s.segmentIndex))
      },
    }
    const result = await runChunkedPostProcess({
      segments: segs,
      language: 'en',
      targetLanguage: 'zh-CN',
      enableFurigana: false,
      transport: t,
      onChunkDone: vi.fn(),
      sleep: async () => {},
    })
    expect(result.failed).toBe(false)
    expect(calls).toBe(2)
  })

  it('重试后仍失败时，续跑点停在失败的那一片之前', async () => {
    const segs = Array.from({ length: 150 }, (_, i) => seg(i, 'x'))
    let calls = 0
    const t: PostProcessTransport = {
      id: 'second-chunk-always-429',
      async run(chunk) {
        calls++
        // 第一片成功；第二片的每次尝试都 429
        if (chunk[0].segmentIndex === 0) {
          return chunk.map((s) => processed(s.segmentIndex))
        }
        throw new RetryableEngineError('RATE_LIMITED (429)')
      },
    }
    const result = await runChunkedPostProcess({
      segments: segs,
      language: 'en',
      targetLanguage: 'zh-CN',
      enableFurigana: false,
      transport: t,
      onChunkDone: vi.fn(),
      retryPolicy: { maxAttempts: 2 },
      sleep: async () => {},
    })
    expect(result.failed).toBe(true)
    expect(result.completedChunks).toBe(1)
    expect(calls).toBe(1 + 2)
  })
})
