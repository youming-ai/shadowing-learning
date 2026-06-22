import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { MediaRow, Segment } from '~/types/db/database'
import { DBUtils, db } from '../db'

describe('DBUtils', () => {
  // 每次测试前清空database
  beforeEach(async () => {
    await DBUtils.clearAll()
  })

  afterEach(async () => {
    await DBUtils.clearAll()
  })

  describe('Media operations', () => {
    const createMockMedia = (): Omit<MediaRow, 'id'> => ({
      kind: 'audio',
      title: 'test-audio.mp3',
      durationSec: null,
      addedAt: new Date(),
      updatedAt: new Date(),
      blob: new Blob(['x']),
      fileName: 'test-audio.mp3',
      fileSize: 1024000,
      mimeType: 'audio/mpeg',
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
        expect(stored?.fileSize).toBe(media.fileSize)
        expect(stored?.mimeType).toBe(media.mimeType)
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
          title: 'file1.mp3',
          addedAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        }
        const media2 = {
          ...createMockMedia(),
          title: 'file2.mp3',
          addedAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        }

        await DBUtils.addMedia(media1)
        await DBUtils.addMedia(media2)

        const list = await DBUtils.listMedia()

        expect(list.length).toBe(2)
        // 最新media应该在前面
        expect(list[0].title).toBe('file2.mp3')
        expect(list[1].title).toBe('file1.mp3')
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
          source: 'whisper',
          status: 'completed',
          sourceLanguage: 'en',
          targetLanguage: null,
          rawText: 'Test text',
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        // 创建Subtitle段
        await DBUtils.addSegments([
          {
            transcriptId: subtitleId,
            start: 0,
            end: 1,
            text: 'Segment 1',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ])

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
        kind: 'audio',
        title: 'test.mp3',
        durationSec: null,
        addedAt: new Date(),
        updatedAt: new Date(),
        blob: new Blob(['x']),
        fileName: 'test.mp3',
        fileSize: 1000,
        mimeType: 'audio/mpeg',
      })
    })

    describe('addSubtitle', () => {
      it('should add subtitle and return its id', async () => {
        const id = await DBUtils.addSubtitle({
          mediaId,
          source: 'whisper',
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

    describe('updateSubtitleStatus', () => {
      it('should update subtitle status', async () => {
        const id = await DBUtils.addSubtitle({
          mediaId,
          source: 'whisper',
          status: 'pending',
          sourceLanguage: '',
          targetLanguage: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        await DBUtils.updateSubtitleStatus(id, 'completed')

        const subtitle = await db.subtitles.get(id)
        expect(subtitle?.status).toBe('completed')
      })

      it('should update updatedAt timestamp', async () => {
        const initialDate = new Date('2024-01-01')
        const id = await DBUtils.addSubtitle({
          mediaId,
          source: 'whisper',
          status: 'pending',
          sourceLanguage: '',
          targetLanguage: null,
          createdAt: initialDate,
          updatedAt: initialDate,
        })

        await DBUtils.updateSubtitleStatus(id, 'processing')

        const subtitle = await db.subtitles.get(id)
        expect(subtitle?.updatedAt.getTime()).toBeGreaterThan(initialDate.getTime())
      })
    })
  })

  describe('Segment operations', () => {
    let transcriptId: number

    beforeEach(async () => {
      const mediaId = await DBUtils.addMedia({
        kind: 'audio',
        title: 'test.mp3',
        durationSec: null,
        addedAt: new Date(),
        updatedAt: new Date(),
        blob: new Blob(['x']),
        fileName: 'test.mp3',
        fileSize: 1000,
        mimeType: 'audio/mpeg',
      })

      transcriptId = await DBUtils.addSubtitle({
        mediaId,
        source: 'whisper',
        status: 'completed',
        sourceLanguage: '',
        targetLanguage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    })

    describe('addSegments', () => {
      it('should add multiple segments', async () => {
        const segments: Omit<Segment, 'id'>[] = [
          {
            transcriptId,
            start: 0,
            end: 2,
            text: 'Hello',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            transcriptId,
            start: 2,
            end: 4,
            text: 'World',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]

        await DBUtils.addSegments(segments)

        const stored = await DBUtils.getSegmentsByTranscriptId(transcriptId)
        expect(stored.length).toBe(2)
      })

      it('should report progress for large batches', async () => {
        const segments: Omit<Segment, 'id'>[] = Array.from({ length: 100 }, (_, i) => ({
          transcriptId,
          start: i,
          end: i + 1,
          text: `Segment ${i}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        }))

        const progressUpdates: number[] = []
        await DBUtils.addSegments(segments, {
          batchSize: 30,
          onProgress: (progress) => {
            progressUpdates.push(progress.percentage)
          },
        })

        expect(progressUpdates.length).toBeGreaterThan(0)
        expect(progressUpdates[progressUpdates.length - 1]).toBe(100)
      })
    })

    describe('getSegmentsByTranscriptId', () => {
      it('should return empty array for non-existent transcript', async () => {
        const segments = await DBUtils.getSegmentsByTranscriptId(99999)
        expect(segments).toEqual([])
      })

      it('should return segments for given transcript', async () => {
        await DBUtils.addSegments([
          {
            transcriptId,
            start: 0,
            end: 1,
            text: 'Test',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ])

        const segments = await DBUtils.getSegmentsByTranscriptId(transcriptId)
        expect(segments.length).toBe(1)
        expect(segments[0].text).toBe('Test')
      })
    })
  })

  describe('clearAll', () => {
    it('should clear all data from database', async () => {
      // Add一些数据
      const mediaId = await DBUtils.addMedia({
        kind: 'audio',
        title: 'test.mp3',
        durationSec: null,
        addedAt: new Date(),
        updatedAt: new Date(),
        blob: new Blob(['x']),
        fileName: 'test.mp3',
        fileSize: 1000,
        mimeType: 'audio/mpeg',
      })

      await DBUtils.addSubtitle({
        mediaId,
        source: 'whisper',
        status: 'pending',
        sourceLanguage: '',
        targetLanguage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // 清空
      await DBUtils.clearAll()

      // Validate
      const media = await DBUtils.listMedia()
      const subtitles = await db.subtitles.toArray()
      const segments = await db.segments.toArray()

      expect(media.length).toBe(0)
      expect(subtitles.length).toBe(0)
      expect(segments.length).toBe(0)
    })
  })
})
