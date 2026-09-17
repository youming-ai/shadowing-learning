import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { MediaRow } from '~/types/db/database'
import { DBUtils, db } from '../db'

/**
 * 测试用的清库。`DBUtils.clearAll` 已随「无调用方的 API」一起删除（业务代码里没有入口），
 * 这里按同样的顺序直接清空三张表。
 */
async function clearDatabase(): Promise<void> {
  await db.transaction('rw', db.media, db.subtitles, db.segments, async () => {
    await db.segments.clear()
    await db.subtitles.clear()
    await db.media.clear()
  })
}

describe('DBUtils', () => {
  // 每次测试前清空database
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  describe('Media operations', () => {
    const createMockMedia = (): Omit<MediaRow, 'id'> => ({
      kind: 'youtube',
      title: 'test-video',
      durationSec: null,
      addedAt: new Date(),
      updatedAt: new Date(),
    })

    describe('addMedia', () => {
      it('should add a media and return its id', async () => {
        const media = createMockMedia()
        const id = await DBUtils.addMedia(media)

        expect(id).toBeDefined()
        expect(typeof id).toBe('number')
        expect(id).toBeGreaterThan(0)
      })

      it('should store media with all properties', async () => {
        const media = createMockMedia()
        const id = await DBUtils.addMedia(media)

        const stored = await DBUtils.getMedia(id)

        expect(stored).toBeDefined()
        expect(stored?.title).toBe(media.title)
        expect(stored?.kind).toBe('youtube')
      })
    })

    describe('getMedia', () => {
      it('should return undefined for non-existent id', async () => {
        const media = await DBUtils.getMedia(99999)
        expect(media).toBeUndefined()
      })

      it('should retrieve media by id', async () => {
        const media = createMockMedia()
        const id = await DBUtils.addMedia(media)

        const retrieved = await DBUtils.getMedia(id)

        expect(retrieved).toBeDefined()
        expect(retrieved?.id).toBe(id)
      })
    })

    describe('listMedia', () => {
      it('should return empty array when no media', async () => {
        const media = await DBUtils.listMedia()
        expect(media).toEqual([])
      })

      it('should return all media ordered by addedAt descending', async () => {
        const media1 = {
          ...createMockMedia(),
          title: 'video-1',
          addedAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        }
        const media2 = {
          ...createMockMedia(),
          title: 'video-2',
          addedAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        }

        await DBUtils.addMedia(media1)
        await DBUtils.addMedia(media2)

        const list = await DBUtils.listMedia()

        expect(list.length).toBe(2)
        // 最新media应该在前面
        expect(list[0].title).toBe('video-2')
        expect(list[1].title).toBe('video-1')
      })
    })

    describe('deleteMedia', () => {
      it('should delete media by id', async () => {
        const id = await DBUtils.addMedia(createMockMedia())

        await DBUtils.deleteMedia(id)

        const media = await DBUtils.getMedia(id)
        expect(media).toBeUndefined()
      })

      it('should delete associated subtitles and segments', async () => {
        // 创建Media
        const mediaId = await DBUtils.addMedia(createMockMedia())

        // 创建Subtitle记录
        const subtitleId = await DBUtils.addSubtitle({
          mediaId,
          source: 'official',
          status: 'completed',
          sourceLanguage: 'en',
          targetLanguage: null,
          rawText: 'Test text',
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        // 创建Subtitle段（直接写表：`DBUtils.addSegments` 已随未使用的 API 删除）
        await db.segments.add({
          transcriptId: subtitleId,
          start: 0,
          end: 1,
          text: 'Segment 1',
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        // DeleteMedia
        await DBUtils.deleteMedia(mediaId)

        // Validate关联数据也被Delete
        const subtitles = await db.subtitles.where('mediaId').equals(mediaId).toArray()
        expect(subtitles.length).toBe(0)

        const segments = await db.segments.where('transcriptId').equals(subtitleId).toArray()
        expect(segments.length).toBe(0)
      })
    })
  })

  describe('Subtitle operations', () => {
    let mediaId: number

    beforeEach(async () => {
      mediaId = await DBUtils.addMedia({
        kind: 'youtube',
        title: 'test-video',
        durationSec: null,
        addedAt: new Date(),
        updatedAt: new Date(),
      })
    })

    describe('addSubtitle', () => {
      it('should add subtitle and return its id', async () => {
        const id = await DBUtils.addSubtitle({
          mediaId,
          source: 'official',
          status: 'pending',
          sourceLanguage: '',
          targetLanguage: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        expect(id).toBeDefined()
        expect(typeof id).toBe('number')
      })
    })

    /**
     * `DBUtils.updateSubtitleStatus` 已删除（业务代码无调用方）。生产路径更新字幕状态用的是
     * `DBUtils.update(db.subtitles, …)`（见 useSubtitlePipeline），所以这里改为守住那条**真实**
     * 路径，而不是把这块覆盖一起丢掉。
     */
    describe('updateSubtitleStatus（经由 DBUtils.update）', () => {
      it('should update subtitle status', async () => {
        const id = await DBUtils.addSubtitle({
          mediaId,
          source: 'official',
          status: 'pending',
          sourceLanguage: '',
          targetLanguage: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        await DBUtils.update(db.subtitles, id, { status: 'completed', updatedAt: new Date() })

        const subtitle = await db.subtitles.get(id)
        expect(subtitle?.status).toBe('completed')
      })

      it('should update updatedAt timestamp', async () => {
        const initialDate = new Date('2024-01-01')
        const id = await DBUtils.addSubtitle({
          mediaId,
          source: 'official',
          status: 'pending',
          sourceLanguage: '',
          targetLanguage: null,
          createdAt: initialDate,
          updatedAt: initialDate,
        })

        await DBUtils.update(db.subtitles, id, { status: 'processing', updatedAt: new Date() })

        const subtitle = await db.subtitles.get(id)
        expect(subtitle?.updatedAt.getTime()).toBeGreaterThan(initialDate.getTime())
      })
    })
  })

  describe('Segment operations', () => {
    let transcriptId: number

    beforeEach(async () => {
      const mediaId = await DBUtils.addMedia({
        kind: 'youtube',
        title: 'test-video',
        durationSec: null,
        addedAt: new Date(),
        updatedAt: new Date(),
      })

      transcriptId = await DBUtils.addSubtitle({
        mediaId,
        source: 'official',
        status: 'completed',
        sourceLanguage: '',
        targetLanguage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    })

    describe('getSegmentsByTranscriptIdOrdered', () => {
      it('should return empty array for non-existent transcript', async () => {
        const segments = await DBUtils.getSegmentsByTranscriptIdOrdered(99999)
        expect(segments).toEqual([])
      })

      it('should return segments for given transcript, ordered by start', async () => {
        await db.segments.bulkAdd([
          {
            transcriptId,
            start: 5,
            end: 6,
            text: 'Later',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            transcriptId,
            start: 0,
            end: 1,
            text: 'Earlier',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ])

        const segments = await DBUtils.getSegmentsByTranscriptIdOrdered(transcriptId)
        expect(segments.map((s) => s.text)).toEqual(['Earlier', 'Later'])
      })
    })
  })
})
