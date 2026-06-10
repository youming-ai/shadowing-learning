import { describe, expect, it, vi } from 'vitest'
import {
  chunkSegmentsForPostProcess,
  runChunkedPostProcess,
} from '~/lib/subtitles/chunk-postprocess'

const seg = (i: number, text: string) => ({ segmentIndex: i, start: i, end: i + 1, text })

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
  it('posts chunks sequentially and reports each chunk result', async () => {
    const segs = Array.from({ length: 150 }, (_, i) => seg(i, 'hello'))
    const calls: number[] = []
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      calls.push(body.segments.length)
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            segments: body.segments.map((s: { segmentIndex: number }) => ({
              segmentIndex: s.segmentIndex,
              translation: `t${s.segmentIndex}`,
            })),
          },
        }),
        { status: 200 },
      )
    })
    const onChunkDone = vi.fn()
    const result = await runChunkedPostProcess({
      segments: segs,
      language: 'en',
      targetLanguage: 'zh-CN',
      enableFurigana: false,
      fetchImpl,
      onChunkDone,
    })
    expect(calls).toEqual([100, 50])
    expect(onChunkDone).toHaveBeenCalledTimes(2)
    expect(result.completedChunks).toBe(2)
    expect(result.failed).toBe(false)
  })

  it('stops at first failed chunk and reports failure with resume point', async () => {
    const segs = Array.from({ length: 150 }, (_, i) => seg(i, 'hello'))
    let n = 0
    const fetchImpl = vi.fn(async () => {
      n++
      return n === 1
        ? new Response(JSON.stringify({ success: true, data: { segments: [] } }), { status: 200 })
        : new Response('{}', { status: 500 })
    })
    const result = await runChunkedPostProcess({
      segments: segs,
      language: 'en',
      targetLanguage: 'zh-CN',
      enableFurigana: false,
      fetchImpl,
      onChunkDone: vi.fn(),
    })
    expect(result.failed).toBe(true)
    expect(result.completedChunks).toBe(1)
  })
})
