/**
 * 历史遗留类型（v3 的 files / transcripts 表）已随 v5 迁移删除：
 * 那两张表在 v5 的 stores 里被移除，Dexie 会在升级事务中把它们丢掉。
 */

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed'

/**
 * segments 行。
 *
 * 注意**没有** `wordTimestamps`：那个字段全仓库从无写入方，依赖它的「逐词高亮」因此是
 * 不可达代码，已连同 `lib/player/active-word.ts` 一起删除。Dexie 的 v1–v4 `stores()`
 * 里仍留着该字段的索引声明 —— 已发布的迁移不可回改，而那只是个空索引，留着无害。
 * 详见 `src/lib/db/db.ts` 中 v4 附近的说明。
 */
export interface Segment {
  id?: number
  /** v4 起指向 subtitles.id（历史字段名保留，避免重写最大的表） */
  transcriptId: number
  segmentIndex?: number
  start: number
  end: number
  text: string
  normalizedText?: string
  translation?: string
  annotations?: string[]
  furigana?: string
  createdAt: Date
  updatedAt: Date
}

// ===== v4 unified media model (YouTube-only;音频模块已移除) =====

export type MediaKind = 'youtube'

export interface MediaRow {
  id?: number
  kind: MediaKind
  title: string
  durationSec: number | null
  addedAt: Date
  updatedAt: Date
  // kind: 'youtube'
  externalId?: string
  channelName?: string
  thumbnailUrl?: string
  sourceUrl?: string
}

export type SubtitleSource = 'official'

export interface SubtitleRow {
  id?: number
  mediaId: number
  source: SubtitleSource
  status: ProcessingStatus // 'pending' | 'processing' | 'completed' | 'failed'
  sourceLanguage: string
  targetLanguage: string | null
  postProcessStatus?: 'pending' | 'completed' | 'failed'
  postProcessError?: string
  rawText?: string
  error?: string
  createdAt: Date
  updatedAt: Date
}
