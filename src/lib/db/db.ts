/** * Simplified database operations file * Removed complex batch processors, keeping core functionality*/

import Dexie, { type Table, type UpdateSpec } from 'dexie'
import type { MediaRow, Segment, SubtitleRow } from '~/types/db/database'
import { handleError } from '../utils/error-handler'
import { dbLogger } from '../utils/logger'

export class AppDatabase extends Dexie {
  segments!: Table<Segment>
  media!: Table<MediaRow>
  subtitles!: Table<SubtitleRow>

  constructor() {
    super('shadowing-learning-db')

    this.version(1)
      .stores({
        files: '++id, name, size, type, uploadedAt, [name+type]',
        transcripts: '++id, fileId, status, language, createdAt, updatedAt',
        segments: '++id, transcriptId, start, end, text, [transcriptId+start], [transcriptId+end]',
      })
      .upgrade((_tx) => {
        // Initial setup - no migration needed
        dbLogger.debug('Database version 1 initialized')
      })

    this.version(2)
      .stores({
        files: '++id, name, size, type, uploadedAt, [name+type]',
        transcripts: '++id, fileId, status, language, createdAt, updatedAt',
        segments:
          '++id, transcriptId, start, end, text, wordTimestamps, [transcriptId+start], [transcriptId+end]',
      })
      .upgrade(async (_tx) => {
        // Add wordTimestamps to existing segments if needed
        dbLogger.debug('Database migrated to version 2: Added wordTimestamps support')
      })

    this.version(3)
      .stores({
        files: '++id, name, size, type, uploadedAt, [name+type]',
        transcripts: '++id, fileId, status, language, createdAt, updatedAt',
        segments:
          '++id, transcriptId, start, end, text, wordTimestamps, normalizedText, translation, annotations, furigana, [transcriptId+start], [transcriptId+end]',
      })
      .upgrade(async (tx) => {
        dbLogger.debug('Database migrating to version 3: Adding enhanced transcription fields')
        try {
          const segmentsTable = tx.table('segments')
          await segmentsTable.toCollection().modify((segment: Record<string, unknown>) => {
            if (segment.normalizedText === undefined) segment.normalizedText = null
            if (segment.translation === undefined) segment.translation = null
            if (segment.annotations === undefined) segment.annotations = null
            if (segment.furigana === undefined) segment.furigana = null
          })
          dbLogger.debug('Database migration to version 3 complete')
        } catch (error) {
          dbLogger.error('Database migration to version 3 failed:', error)
        }
      })

    this.version(4)
      .stores({
        media: '++id, kind, &externalId, addedAt, [kind+addedAt]',
        subtitles: '++id, mediaId, status, createdAt',
        // 以下三表与 v3 逐字一致：不重写行数据、不删旧表（恢复窗口，v5 再删）
        files: '++id, name, size, type, uploadedAt, [name+type]',
        transcripts: '++id, fileId, status, language, createdAt, updatedAt',
        // `wordTimestamps` 这个索引是**遗留**：全仓库从无写入方（依赖它的逐词高亮是不可达
        // 代码，已删）。已发布的 stores() 不可回改，而它只是个永远为空的索引，留着无害；
        // 也刻意不为它加一版迁移 —— 收益为零，代价是一次真实的 schema 升级。
        segments:
          '++id, transcriptId, start, end, text, wordTimestamps, normalizedText, translation, annotations, furigana, [transcriptId+start], [transcriptId+end]',
      })
      .upgrade(async (tx) => {
        dbLogger.debug('Database migrating to version 4: unified media model')
        const files = await tx.table('files').toArray()
        await tx.table('media').bulkAdd(
          files.map((f) => ({
            id: f.id,
            kind: 'audio' as const,
            title: f.name,
            durationSec: f.duration ?? null,
            addedAt: f.uploadedAt,
            updatedAt: f.updatedAt,
            blob: f.blob,
            fileName: f.name,
            fileSize: f.size,
            mimeType: f.type,
          })),
        )
        const transcripts = await tx.table('transcripts').toArray()
        await tx.table('subtitles').bulkAdd(
          transcripts.map((t) => ({
            id: t.id,
            mediaId: t.fileId,
            source: 'whisper' as const,
            status: t.status,
            sourceLanguage: t.language ?? 'auto',
            targetLanguage: null,
            postProcessStatus: t.postProcessStatus,
            postProcessError: t.postProcessError,
            rawText: t.rawText,
            error: t.error,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
          })),
        )
        dbLogger.debug(`v4 migration done: ${files.length} media, ${transcripts.length} subtitles`)
      })

    // v5：音频模块已下线，收尾清理。
    // - files / transcripts 置 null 才会被真正删除：Dexie 的 stores() 是跨版本累加的
    //   （内部 versions.forEach(v => extend(storesSpec, v._cfg.storesSource))），
    //   单靠"不声明"会继承 v4 的声明，表会一直留着。
    // - 同时清掉 v4 为 v3 老用户写入的 kind:'audio' 行（带 Blob，UI 已无法访问）及其子行。
    // media / subtitles / segments 未改动，沿用 v4 的声明。
    this.version(5)
      .stores({
        files: null,
        transcripts: null,
      })
      .upgrade(async (tx) => {
        const media = tx.table('media')

        // 只取主键：遗留行带 Blob，toArray() 会把整段音频读进内存。
        // 用"全量主键 − kind:'youtube' 主键"求差集，而不是 where('kind').notEqual(...)：
        // 后者走稀疏索引，会漏掉 kind 缺失的行，这里一律按遗留处理。
        const allIds: number[] = await media.toCollection().primaryKeys()
        const youtubeIds: number[] = await media.where('kind').equals('youtube').primaryKeys()
        const youtubeSet = new Set(youtubeIds)
        const legacyMediaIds = allIds.filter((id) => !youtubeSet.has(id))

        if (legacyMediaIds.length === 0) {
          dbLogger.debug('v5 migration done: no legacy audio rows to purge')
          return
        }

        // children-first：segments → subtitles → media（与 DBUtils.deleteMedia 同序）
        const legacySubtitleIds: number[] = await tx
          .table('subtitles')
          .where('mediaId')
          .anyOf(legacyMediaIds)
          .primaryKeys()
        if (legacySubtitleIds.length > 0) {
          await tx.table('segments').where('transcriptId').anyOf(legacySubtitleIds).delete()
          await tx.table('subtitles').bulkDelete(legacySubtitleIds)
        }
        await media.bulkDelete(legacyMediaIds)

        dbLogger.debug(
          `v5 migration done: purged ${legacyMediaIds.length} legacy audio rows, ${legacySubtitleIds.length} subtitles`,
        )
      })
  }
}

// Create database instance
export const db = new AppDatabase()

// 另一个标签页升级 DB 时，关闭本页连接并刷新，避免阻塞升级（Dexie 推荐做法）。
// 显式 disableAutoOpen：避免与 Dexie 内置 versionchange 处理的默认行为重复，且我们随即整页刷新。
db.on('versionchange', () => {
  db.close({ disableAutoOpen: true })
  if (typeof window !== 'undefined') {
    window.location.reload()
  }
})

// Simplified database utilities with repository functionality integrated
export const DBUtils = {
  /** * Generic database operations*/
  // Core CRUD operations
  async add<T>(table: Dexie.Table<T, number>, item: Omit<T, 'id'>): Promise<number> {
    try {
      return await table.add(item as T)
    } catch (error) {
      throw handleError(error, `DBUtils.add`)
    }
  },

  async get<T>(table: Dexie.Table<T, number>, id: number): Promise<T | undefined> {
    try {
      return await table.get(id)
    } catch (error) {
      throw handleError(error, `DBUtils.get`)
    }
  },

  async update<T>(
    table: Dexie.Table<T, number>,
    id: number,
    changes: UpdateSpec<T>,
  ): Promise<number> {
    try {
      return await table.update(id, changes)
    } catch (error) {
      throw handleError(error, `DBUtils.update`)
    }
  },

  // Batch operations
  async bulkAdd<T>(table: Dexie.Table<T, number>, items: Omit<T, 'id'>[]): Promise<number[]> {
    try {
      const result = await table.bulkAdd(items as T[])
      return Array.isArray(result) ? result : [result]
    } catch (error) {
      throw handleError(error, `DBUtils.bulkAdd`)
    }
  },

  /**
   * 按主键 upsert 一批完整的行（须含 `id`）；错误照旧统一归一化。
   *
   * 必须显式校验 `id`：Dexie 的 `bulkPut` 遇到没有 `id` 的行会**静默插入新行**（自增主键），
   * 于是「更新」变成「写重复数据」，而且不报错、没人察觉。
   */
  async bulkPut<T>(table: Dexie.Table<T, number>, items: T[]): Promise<void> {
    try {
      if (items.some((item) => typeof (item as { id?: unknown }).id !== 'number')) {
        throw new Error('DBUtils.bulkPut 要求每一项都带数字 id')
      }
      await table.bulkPut(items)
    } catch (error) {
      throw handleError(error, `DBUtils.bulkPut`)
    }
  },

  async orderBy<T>(
    table: Dexie.Table<T, number>,
    key: keyof T,
    direction: 'asc' | 'desc' = 'asc',
  ): Promise<T[]> {
    try {
      if (direction === 'desc') {
        return await table
          .orderBy(key as string)
          .reverse()
          .toArray()
      }
      return await table.orderBy(key as string).toArray()
    } catch (error) {
      throw handleError(error, `DBUtils.orderBy`)
    }
  },

  /** Media operations (v4) */
  async addMedia(media: Omit<MediaRow, 'id'>): Promise<number> {
    return await this.add(db.media, media)
  },

  async getMedia(id: number): Promise<MediaRow | undefined> {
    return await this.get(db.media, id)
  },

  async listMedia(): Promise<MediaRow[]> {
    try {
      return await this.orderBy(db.media, 'addedAt', 'desc')
    } catch (error) {
      throw handleError(error, 'DBUtils.listMedia')
    }
  },

  async findMediaByExternalId(externalId: string): Promise<MediaRow | undefined> {
    try {
      return await db.media.where('externalId').equals(externalId).first()
    } catch (error) {
      throw handleError(error, 'DBUtils.findMediaByExternalId')
    }
  },

  /** children-first: segments → subtitles → media */
  async deleteMedia(id: number): Promise<void> {
    try {
      await db.transaction('rw', db.media, db.subtitles, db.segments, async () => {
        const subtitles = await db.subtitles.where('mediaId').equals(id).toArray()
        for (const subtitle of subtitles) {
          if (subtitle.id) {
            await db.segments.where('transcriptId').equals(subtitle.id).delete()
          }
        }
        await db.subtitles.where('mediaId').equals(id).delete()
        await db.media.delete(id)
      })
    } catch (error) {
      throw handleError(error, 'DBUtils.deleteMedia')
    }
  },

  /** Subtitle operations (v4) */
  async addSubtitle(subtitle: Omit<SubtitleRow, 'id'>): Promise<number> {
    return await this.add(db.subtitles, subtitle)
  },

  async findSubtitleByMediaId(mediaId: number): Promise<SubtitleRow | undefined> {
    try {
      return await db.subtitles.where('mediaId').equals(mediaId).first()
    } catch (error) {
      throw handleError(error, 'DBUtils.findSubtitleByMediaId')
    }
  },

  async deleteSubtitleWithSegments(subtitleId: number): Promise<void> {
    try {
      await db.transaction('rw', db.subtitles, db.segments, async () => {
        await db.segments.where('transcriptId').equals(subtitleId).delete()
        await db.subtitles.delete(subtitleId)
      })
    } catch (error) {
      throw handleError(error, 'DBUtils.deleteSubtitleWithSegments')
    }
  },

  /** Segment-specific operations */
  async getSegmentsByTranscriptIdOrdered(transcriptId: number): Promise<Segment[]> {
    try {
      return await db.segments.where('transcriptId').equals(transcriptId).sortBy('start')
    } catch (error) {
      throw handleError(error, 'DBUtils.getSegmentsByTranscriptIdOrdered')
    }
  },
}

// Export database instance
export default db
