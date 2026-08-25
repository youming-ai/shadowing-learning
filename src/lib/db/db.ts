/** * Simplified database operations file * Removed complex batch processors, keeping core functionality*/

import Dexie, { type Table } from 'dexie'
import type {
  DatabaseStats,
  FileRow,
  MediaRow,
  Segment,
  SubtitleRow,
  TranscriptRow,
} from '~/types/db/database'
import { handleError } from '../utils/error-handler'
import { dbLogger } from '../utils/logger'

export class AppDatabase extends Dexie {
  files!: Table<FileRow>
  transcripts!: Table<TranscriptRow>
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

// v4 打开后的一次性行数校验（检测线：不一致只上报，不阻断）
db.on('ready', async () => {
  if (typeof window === 'undefined') return
  try {
    const [filesCount, mediaCount] = await Promise.all([db.files.count(), db.media.count()])
    if (mediaCount < filesCount) {
      dbLogger.error(`v4 row-count mismatch: files=${filesCount} media=${mediaCount}`)
    }
  } catch (e) {
    dbLogger.error('v4 row-count check failed:', e)
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

  async update<T>(table: Dexie.Table<T, number>, id: number, changes: Partial<T>): Promise<number> {
    try {
      return await table.update(id, changes as any)
    } catch (error) {
      throw handleError(error, `DBUtils.update`)
    }
  },

  async delete<T>(table: Dexie.Table<T, number>, id: number): Promise<void> {
    try {
      await table.delete(id)
    } catch (error) {
      throw handleError(error, `DBUtils.delete`)
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

  async bulkUpdate<T>(
    table: Dexie.Table<T, number>,
    items: Array<{ id: number; changes: Partial<T> }>,
  ): Promise<number[]> {
    try {
      return await db.transaction('rw', table, async () => {
        return await Promise.all(items.map(({ id, changes }) => table.update(id, changes as any)))
      })
    } catch (error) {
      throw handleError(error, `DBUtils.bulkUpdate`)
    }
  },

  // Query operations
  async where<T>(table: Dexie.Table<T, number>, predicate: (item: T) => boolean): Promise<T[]> {
    try {
      return await table.filter(predicate).toArray()
    } catch (error) {
      throw handleError(error, `DBUtils.where`)
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

  async getStorageUsage(): Promise<{
    totalSize: number
    totalFiles: number
    averageFileSize: number
    largestFileSize: number
    fileCountByType: Record<string, number>
  }> {
    try {
      const media = await db.media.toArray()
      const totalSize = media.reduce((sum, m) => sum + (m.fileSize ?? 0), 0)
      const fileCountByType = media.reduce(
        (acc, m) => {
          const key = m.mimeType ?? 'youtube'
          acc[key] = (acc[key] || 0) + 1
          return acc
        },
        {} as Record<string, number>,
      )

      return {
        totalSize,
        totalFiles: media.length,
        averageFileSize: media.length > 0 ? Math.round(totalSize / media.length) : 0,
        largestFileSize: media.length > 0 ? Math.max(...media.map((m) => m.fileSize ?? 0)) : 0,
        fileCountByType,
      }
    } catch (error) {
      throw handleError(error, 'DBUtils.getStorageUsage')
    }
  },

  async cleanupOldMedia(daysOld: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysOld)
      const oldMedia = await db.media.where('addedAt').below(cutoffDate).toArray()

      await db.transaction('rw', db.media, db.subtitles, db.segments, async () => {
        for (const m of oldMedia) {
          if (m.id) {
            const subtitles = await db.subtitles.where('mediaId').equals(m.id).toArray()
            for (const subtitle of subtitles) {
              if (subtitle.id) {
                await db.segments.where('transcriptId').equals(subtitle.id).delete()
              }
            }
            await db.subtitles.where('mediaId').equals(m.id).delete()
            await db.media.delete(m.id)
          }
        }
      })

      return oldMedia.length
    } catch (error) {
      throw handleError(error, 'DBUtils.cleanupOldMedia')
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

  async updateSubtitleStatus(id: number, status: SubtitleRow['status']): Promise<void> {
    await this.update(db.subtitles, id, { status, updatedAt: new Date() })
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

  /** * Segment-specific operations*/
  async addSegment(segment: Omit<Segment, 'id'>): Promise<number> {
    return await this.add(db.segments, segment)
  },

  async getSegment(id: number): Promise<Segment | undefined> {
    return await this.get(db.segments, id)
  },

  async getSegmentsByTranscriptId(transcriptId: number): Promise<Segment[]> {
    try {
      return await db.segments.where('transcriptId').equals(transcriptId).toArray()
    } catch (error) {
      throw handleError(error, 'DBUtils.getSegmentsByTranscriptId')
    }
  },

  async getSegmentsByTranscriptIdOrdered(transcriptId: number): Promise<Segment[]> {
    try {
      return await db.segments.where('transcriptId').equals(transcriptId).sortBy('start')
    } catch (error) {
      throw handleError(error, 'DBUtils.getSegmentsByTranscriptIdOrdered')
    }
  },

  async addSegments(
    segments: Omit<Segment, 'id'>[],
    options?: {
      batchSize?: number
      onProgress?: (progress: {
        processed: number
        total: number
        percentage: number
        status: string
        message: string
      }) => void
    },
  ): Promise<void> {
    try {
      const segmentsWithTimestamps = segments.map((segment) => ({
        ...segment,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))

      return await db.transaction('rw', db.segments, async () => {
        if (segmentsWithTimestamps.length <= 50) {
          await db.segments.bulkAdd(segmentsWithTimestamps as Segment[])
          return
        }

        const batchSize = options?.batchSize || 50
        for (let i = 0; i < segmentsWithTimestamps.length; i += batchSize) {
          const batch = segmentsWithTimestamps.slice(i, i + batchSize)
          await db.segments.bulkAdd(batch as Segment[])

          if (options?.onProgress) {
            const progress = Math.min(
              100,
              Math.floor(((i + batch.length) / segmentsWithTimestamps.length) * 100),
            )
            options.onProgress({
              processed: i + batch.length,
              total: segmentsWithTimestamps.length,
              percentage: progress,
              status: 'processing',
              message: `Processing ${i + batch.length}/${segmentsWithTimestamps.length}`,
            })
          }
        }
      })
    } catch (error) {
      throw handleError(error, 'DBUtils.addSegments')
    }
  },

  async updateSegmentsByTranscriptId(
    transcriptId: number,
    updates: Partial<Segment>,
  ): Promise<number> {
    try {
      return await db.segments.where('transcriptId').equals(transcriptId).modify(updates)
    } catch (error) {
      throw handleError(error, 'DBUtils.updateSegmentsByTranscriptId')
    }
  },

  async findSegmentsByTimeRange(
    transcriptId: number,
    startTime: number,
    endTime: number,
  ): Promise<Segment[]> {
    try {
      return await db.segments
        .where('transcriptId')
        .equals(transcriptId)
        .and((segment) => segment.start >= startTime && segment.end <= endTime)
        .toArray()
    } catch (error) {
      throw handleError(error, 'DBUtils.findSegmentsByTimeRange')
    }
  },

  /** * Database maintenance operations*/
  async clearAll(): Promise<void> {
    try {
      await db.transaction('rw', db.media, db.subtitles, db.segments, async () => {
        await db.segments.clear()
        await db.subtitles.clear()
        await db.media.clear()
      })
    } catch (error) {
      throw handleError(error, 'DBUtils.clearAll')
    }
  },

  async getDatabaseStats(): Promise<DatabaseStats> {
    try {
      // segments 只需要总数，用 count() 避免把每条 segment 都拉进内存
      const [media, subtitles, segmentsCount] = await Promise.all([
        db.media.toArray(),
        db.subtitles.toArray(),
        db.segments.count(),
      ])

      const totalStorageSize = media.reduce((sum, m) => sum + (m.fileSize ?? 0), 0)
      const subtitlesByStatus = subtitles.reduce(
        (acc, subtitle) => {
          acc[subtitle.status] = (acc[subtitle.status] || 0) + 1
          return acc
        },
        {} as Record<string, number>,
      )
      const averageSegmentsPerSubtitle = subtitles.length > 0 ? segmentsCount / subtitles.length : 0

      return {
        totalMedia: media.length,
        totalSubtitles: subtitles.length,
        totalSegments: segmentsCount,
        totalStorageSize,
        averageSegmentsPerSubtitle: Math.round(averageSegmentsPerSubtitle * 100) / 100,
        subtitlesByStatus,
      }
    } catch (error) {
      throw handleError(error, 'DBUtils.getDatabaseStats')
    }
  },
}

// Export database instance
export default db
