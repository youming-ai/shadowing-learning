/**
 * segments 的持久化写入。
 *
 * 单独成模块（而不是留在 `useSubtitlePipeline` 里）有两个理由：
 * 1. 这是**数据正确性**的关键路径 —— AI 返回的每个字段是否落库，决定了用户
 *    能不能看到它。放在纯模块里可以直接单测，不必拉起 React/Query 环境。
 * 2. 回写规则（按 `segmentIndex` 对齐、空值兜底）只应该有一份，避免两条链路漂移。
 */

import { db } from '~/lib/db/db'
import type { ProcessedSegment } from '~/lib/subtitles/chunk-postprocess'
import type { Segment } from '~/types/db/database'

/** 写入一个字幕的全部 segments（原文行）。*/
export async function writeSegments(
  subtitleId: number,
  rows: Array<{ start: number; end: number; text: string }>,
): Promise<void> {
  const now = new Date()
  await db.segments.bulkAdd(
    rows.map((r, index) => ({
      transcriptId: subtitleId,
      segmentIndex: index,
      start: r.start,
      end: r.end,
      text: r.text,
      createdAt: now,
      updatedAt: now,
    })),
  )
}

/**
 * 把一片 AI 结果按 `segmentIndex` 回写到既有 segments 行。
 *
 * **必须写全内核返回的四个字段。** `normalizedText` 与 `annotations` 曾经在这里被漏掉：
 * 每次翻译都为它们付了 token 钱，却在入库时被丢掉，于是 `SubtitlePanel` /
 * `CurrentSentence` 里读这两个字段的 UI 永远是空的。
 *
 * 空值一律兜底，不要留 `undefined`：行形状要稳定，读侧（UI 里的
 * `annotations && length > 0`）才不必区分「缺失」与「空」。Dexie 的 `update`/`modify`
 * 对 `undefined` 是**删除该键**（内部 `setByKeyPath` 走 `delete obj[keyPath]`），
 * 兜底也让写路径的语义不随实现方式变化。
 *
 * 实现上是「一次读出 + `bulkPut`」而不是逐条 `where(...).modify(...)`：一片最多 100 段，
 * 逐条写就是 100 次查询（N+1），长视频逐片上屏的延迟会明显堆在这一步。
 * `segmentIndex` 没有索引，所以没法直接按它 `where`；整片读进内存再按 index 建映射，
 * 比每条都做一次全表过滤便宜得多。
 */
export async function writeChunkResults(
  subtitleId: number,
  processed: ProcessedSegment[],
): Promise<void> {
  if (processed.length === 0) return
  const now = new Date()

  await db.transaction('rw', db.segments, async () => {
    const rows = await db.segments.where('transcriptId').equals(subtitleId).toArray()

    const byIndex = new Map<number, Segment>()
    for (const row of rows) {
      if (row.segmentIndex !== undefined) byIndex.set(row.segmentIndex, row)
    }

    const updates: Segment[] = []
    for (const p of processed) {
      const row = byIndex.get(p.segmentIndex)
      if (!row) continue
      updates.push({
        ...row,
        normalizedText: p.normalizedText || p.originalText,
        translation: p.translation ?? '',
        annotations: p.annotations ?? [],
        furigana: p.furigana ?? '',
        updatedAt: now,
      })
    }

    if (updates.length > 0) await db.segments.bulkPut(updates)
  })
}
