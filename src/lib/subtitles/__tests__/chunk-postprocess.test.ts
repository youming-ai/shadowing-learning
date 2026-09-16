import { describe, expect, it, vi } from 'vitest'
import type { PostProcessTransport } from '~/lib/ai/transports'
import {
  chunkSegmentsForPostProcess,
  runChunkedPostProcess,
} from '~/lib/subtitles/chunk-postprocess'

const seg = (i: number, text: string) => ({ segmentIndex: i, start: i, end: i + 1, text })

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
