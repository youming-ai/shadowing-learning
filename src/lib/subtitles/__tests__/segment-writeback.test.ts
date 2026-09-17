import { afterEach, describe, expect, it, vi } from 'vitest'
import { DBUtils, db } from '~/lib/db/db'
import type { ProcessedSegment } from '~/lib/subtitles/chunk-postprocess'
import { writeChunkResults, writeSegments } from '~/lib/subtitles/segment-writeback'

afterEach(async () => {
  await db.segments.clear()
})

function processed(
  segmentIndex: number,
  overrides: Partial<ProcessedSegment> = {},
): ProcessedSegment {
  return {
    originalText: `src-${segmentIndex}`,
    normalizedText: `norm-${segmentIndex}`,
    translation: `trans-${segmentIndex}`,
    annotations: [`note-${segmentIndex}`],
    furigana: `furigana-${segmentIndex}`,
    start: segmentIndex,
    end: segmentIndex + 1,
    segmentIndex,
    ...overrides,
  }
}

describe('writeChunkResults', () => {
  /**
   * 回归测试：`normalizedText` 与 `annotations` 曾在这里被漏掉 ——
   * AI 每片都返回它们、每次都付了 token 钱，却在入库时丢掉，
   * 于是读这两个字段的 UI（SubtitlePanel / CurrentSentence）永远是空的。
   */
  it('落库 AI 返回的全部字段，而不是只写 translation', async () => {
    await writeSegments(1, [{ start: 0, end: 1, text: 'こんにちは' }])

    await writeChunkResults(1, [processed(0)])

    const [row] = await db.segments.toArray()
    expect(row.normalizedText).toBe('norm-0')
    expect(row.translation).toBe('trans-0')
    expect(row.annotations).toEqual(['note-0'])
    expect(row.furigana).toBe('furigana-0')
    expect(row.text).toBe('こんにちは') // 原文不被改写
  })

  it('按 segmentIndex 对齐，不依赖数组顺序', async () => {
    await writeSegments(1, [
      { start: 0, end: 1, text: 'a' },
      { start: 1, end: 2, text: 'b' },
    ])

    // 故意乱序：结果必须各自归位，而不是按数组位置写
    await writeChunkResults(1, [processed(1), processed(0)])

    const rows = (await db.segments.toArray()).sort(
      (a, b) => (a.segmentIndex ?? 0) - (b.segmentIndex ?? 0),
    )
    expect(rows.map((r) => r.translation)).toEqual(['trans-0', 'trans-1'])
  })

  it('只改属于该字幕的行', async () => {
    await writeSegments(1, [{ start: 0, end: 1, text: 'a' }])
    await writeSegments(2, [{ start: 0, end: 1, text: 'b' }])

    await writeChunkResults(1, [processed(0)])

    const other = await db.segments.where('transcriptId').equals(2).first()
    expect(other?.translation).toBeUndefined()
  })

  /**
   * 空值必须显式兜底：否则行形状会随模型返回的字段有无而变，
   * 读侧（`annotations && length > 0`）也就得分不清「缺失」与「空」。
   */
  it('缺省字段兜底为空值而不是留 undefined', async () => {
    await writeSegments(1, [{ start: 0, end: 1, text: 'a' }])

    await writeChunkResults(1, [
      processed(0, { translation: undefined, annotations: undefined, furigana: undefined }),
    ])

    const [row] = await db.segments.toArray()
    expect(row.translation).toBe('')
    expect(row.annotations).toEqual([])
    expect(row.furigana).toBe('')
    expect('annotations' in row).toBe(true)
  })

  it('整片（100 段，与服务端上限一致）一次写完', async () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({ start: i, end: i + 1, text: `s${i}` }))
    await writeSegments(1, rows)

    await writeChunkResults(
      1,
      rows.map((_, i) => processed(i)),
    )

    const stored = await db.segments.where('transcriptId').equals(1).toArray()
    expect(stored).toHaveLength(100)
    expect(stored.every((r) => r.translation === `trans-${r.segmentIndex}`)).toBe(true)
  })

  /**
   * 「一片一次写」是这次改动的性能主张，只看结果数据验证不了它 ——
   * 退回逐段写、数据同样正确。所以这里直接盯住批量调用的次数。
   */
  it('整片只发起一次批量写入，而不是每段一次', async () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({ start: i, end: i + 1, text: `s${i}` }))
    await writeSegments(1, rows)

    const spy = vi.spyOn(db.segments, 'bulkPut')
    try {
      await writeChunkResults(
        1,
        rows.map((_, i) => processed(i)),
      )
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy.mock.calls[0]?.[0]).toHaveLength(100)
    } finally {
      spy.mockRestore()
    }
  })

  /**
   * 回归：不是每个写入方都会写 `segmentIndex`（`DBUtils.addSegments` 就不写），
   * 而回写曾只按它匹配 —— 缺这个字段的行会让整片翻译静默写不进去。
   * 这里刻意用 `DBUtils.addSegments` 造数据，正是因为它就是那个不写 segmentIndex 的写入方。
   */
  it('行缺 segmentIndex 时按 start 兜底写入，而不是静默丢弃', async () => {
    const now = new Date()
    await DBUtils.addSegments([
      { transcriptId: 1, start: 0, end: 1, text: 'a', createdAt: now, updatedAt: now },
      { transcriptId: 1, start: 1, end: 2, text: 'b', createdAt: now, updatedAt: now },
    ])

    await writeChunkResults(1, [processed(0), processed(1)])

    const stored = (await db.segments.toArray()).sort((a, b) => a.start - b.start)
    expect(stored.map((r) => r.translation)).toEqual(['trans-0', 'trans-1'])
  })

  /**
   * 回归：兜底映射曾按 `start` 存单值，两条同时开始的行会塌成同一行 ——
   * 结果全部写到后一行，另一行永远没有翻译。
   */
  it('同 start 的多行各自拿到结果，而不是塌到同一行', async () => {
    const now = new Date()
    await DBUtils.addSegments([
      { transcriptId: 1, start: 0, end: 1, text: 'a', createdAt: now, updatedAt: now },
      { transcriptId: 1, start: 0, end: 2, text: 'b', createdAt: now, updatedAt: now },
    ])

    await writeChunkResults(1, [
      processed(0, { start: 0, translation: 'first' }),
      processed(1, { start: 0, translation: 'second' }),
    ])

    const stored = await db.segments.where('transcriptId').equals(1).toArray()
    expect(stored.map((r) => r.translation).sort()).toEqual(['first', 'second'])
  })

  it('重译覆盖旧值', async () => {
    await writeSegments(1, [{ start: 0, end: 1, text: 'a' }])

    await writeChunkResults(1, [processed(0, { translation: 'first', annotations: ['old'] })])
    await writeChunkResults(1, [processed(0, { translation: 'second', annotations: ['new'] })])

    const [row] = await db.segments.toArray()
    expect(row.translation).toBe('second')
    expect(row.annotations).toEqual(['new'])
  })
})
