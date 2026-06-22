import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MediaRow, Segment, SubtitleRow } from '~/types/db/database'
import { DBUtils, db } from '../db'

// Mock error handler
vi.mock('~/lib/utils/error-handler', () => ({
  handleError: vi.fn((error, _context) => {
    throw error
  }),
}))

describe('DBUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Generic CRUD operations', () => {
    it('should add an item to a table', async () => {
      const mockAdd = vi.fn().mockResolvedValue(1)
      db.media.add = mockAdd

      const item = {
        kind: 'audio',
        title: 'test.mp3',
        durationSec: null,
        addedAt: new Date(),
        updatedAt: new Date(),
      } as any
      const result = await DBUtils.add(db.media, item)

      expect(mockAdd).toHaveBeenCalledWith(item)
      expect(result).toBe(1)
    })

    it('should get an item by id', async () => {
      const mockGet = vi.fn().mockResolvedValue({ id: 1, title: 'test.mp3' })
      db.media.get = mockGet

      const result = await DBUtils.get(db.media, 1)

      expect(mockGet).toHaveBeenCalledWith(1)
      expect(result).toEqual({ id: 1, title: 'test.mp3' })
    })

    it('should update an item', async () => {
      const mockUpdate = vi.fn().mockResolvedValue(1)
      db.media.update = mockUpdate

      const changes = { title: 'updated.mp3' } as any
      const result = await DBUtils.update(db.media, 1, changes)

      expect(mockUpdate).toHaveBeenCalledWith(1, changes)
      expect(result).toBe(1)
    })

    it('should delete an item', async () => {
      const mockDelete = vi.fn().mockResolvedValue(undefined)
      db.media.delete = mockDelete

      await DBUtils.delete(db.media, 1)

      expect(mockDelete).toHaveBeenCalledWith(1)
    })

    it('should bulk add items', async () => {
      const mockBulkAdd = vi.fn().mockResolvedValue([1, 2, 3])
      db.media.bulkAdd = mockBulkAdd

      const items = [{ title: 'test1.mp3' }, { title: 'test2.mp3' }, { title: 'test3.mp3' }] as any
      const result = await DBUtils.bulkAdd(db.media, items)

      expect(mockBulkAdd).toHaveBeenCalledWith(items)
      expect(result).toEqual([1, 2, 3])
    })

    it('should bulk update items', async () => {
      const mockUpdate = vi.fn().mockResolvedValue(1)
      db.media.update = mockUpdate

      const items = [
        { id: 1, changes: { title: 'updated1.mp3' } },
        { id: 2, changes: { title: 'updated2.mp3' } },
      ] as any
      const result = await DBUtils.bulkUpdate(db.media, items)

      expect(mockUpdate).toHaveBeenCalledTimes(2)
      expect(result).toEqual([1, 1])
    })
  })

  describe('Media-specific operations', () => {
    it('should add a media item', async () => {
      const mockAdd = vi.fn().mockResolvedValue(1)
      db.media.add = mockAdd

      const media: Omit<MediaRow, 'id'> = {
        kind: 'audio',
        title: 'test.mp3',
        durationSec: null,
        addedAt: new Date(),
        updatedAt: new Date(),
        blob: new Blob(),
        fileName: 'test.mp3',
        fileSize: 1024,
        mimeType: 'audio/mpeg',
      }

      const result = await DBUtils.addMedia(media)

      expect(mockAdd).toHaveBeenCalledWith(media)
      expect(result).toBe(1)
    })

    it('should get all media ordered by addedAt date', async () => {
      const mockOrderBy = vi.fn().mockReturnValue({
        reverse: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            { id: 2, title: 'file2.mp3', addedAt: new Date('2023-01-02') },
            { id: 1, title: 'file1.mp3', addedAt: new Date('2023-01-01') },
          ]),
        }),
      })
      db.media.orderBy = mockOrderBy

      const result = await DBUtils.listMedia()

      expect(mockOrderBy).toHaveBeenCalledWith('addedAt')
      expect(result).toHaveLength(2)
      expect(result[0].title).toBe('file2.mp3')
    })
  })

  describe('Subtitle-specific operations', () => {
    it('should add a subtitle', async () => {
      const mockAdd = vi.fn().mockResolvedValue(1)
      db.subtitles.add = mockAdd

      const subtitle: Omit<SubtitleRow, 'id'> = {
        mediaId: 1,
        source: 'whisper',
        status: 'completed',
        sourceLanguage: 'en',
        targetLanguage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const result = await DBUtils.addSubtitle(subtitle)

      expect(mockAdd).toHaveBeenCalledWith(subtitle)
      expect(result).toBe(1)
    })

    it('should find subtitle by media id', async () => {
      const subtitleCreatedAt = new Date()
      const subtitleUpdatedAt = new Date()
      const mockWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue({
          id: 1,
          mediaId: 1,
          source: 'whisper',
          status: 'completed',
          sourceLanguage: 'en',
          targetLanguage: null,
          createdAt: subtitleCreatedAt,
          updatedAt: subtitleUpdatedAt,
        }),
      })
      db.subtitles.where = mockWhere

      const result = await DBUtils.findSubtitleByMediaId(1)

      expect(mockWhere).toHaveBeenCalledWith('mediaId')
      expect(result).toEqual({
        id: 1,
        mediaId: 1,
        source: 'whisper',
        status: 'completed',
        sourceLanguage: 'en',
        targetLanguage: null,
        createdAt: subtitleCreatedAt,
        updatedAt: subtitleUpdatedAt,
      })
    })
  })

  describe('Segment-specific operations', () => {
    it('should add a segment', async () => {
      const mockAdd = vi.fn().mockResolvedValue(1)
      db.segments.add = mockAdd

      const segment: Omit<Segment, 'id'> = {
        transcriptId: 1,
        start: 0,
        end: 3,
        text: 'Hello world',
        wordTimestamps: [],
        normalizedText: 'Hello world',
        translation: '你好世界',
        annotations: [],
        furigana: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const result = await DBUtils.addSegment(segment)

      expect(mockAdd).toHaveBeenCalledWith(segment)
      expect(result).toBe(1)
    })

    it('should get segments by transcript id', async () => {
      const mockWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([
          { id: 1, transcriptId: 1, text: 'Hello' },
          { id: 2, transcriptId: 1, text: 'World' },
        ]),
      })
      db.segments.where = mockWhere

      const result = await DBUtils.getSegmentsByTranscriptId(1)

      expect(mockWhere).toHaveBeenCalledWith('transcriptId')
      expect(result).toHaveLength(2)
    })

    it('should get segments by transcript id ordered', async () => {
      const mockWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnThis(),
        sortBy: vi.fn().mockResolvedValue([
          { id: 1, start: 0, text: 'Hello' },
          { id: 2, start: 3, text: 'World' },
        ]),
      })
      db.segments.where = mockWhere

      const result = await DBUtils.getSegmentsByTranscriptIdOrdered(1)

      expect(mockWhere).toHaveBeenCalledWith('transcriptId')
      expect(result[0].start).toBeLessThan(result[1].start)
    })

    it('should find segments by time range', async () => {
      const mockWhere = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnThis(),
        and: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([{ id: 1, start: 2, end: 4, text: 'Segment 1' }]),
        }),
      })
      db.segments.where = mockWhere

      const result = await DBUtils.findSegmentsByTimeRange(1, 1, 5)

      expect(mockWhere).toHaveBeenCalledWith('transcriptId')
      expect(result).toHaveLength(1)
    })
  })

  describe('Database maintenance', () => {
    it('should clear all data', async () => {
      const mockClear = vi.fn().mockResolvedValue(undefined)
      const mockTransaction = vi.fn().mockImplementation((...args) => {
        const callback = args[args.length - 1]
        return callback()
      })

      db.transaction = mockTransaction as any
      db.segments.clear = mockClear
      db.subtitles.clear = mockClear
      db.media.clear = mockClear

      await DBUtils.clearAll()

      expect(mockTransaction).toHaveBeenCalled()
      expect(mockClear).toHaveBeenCalledTimes(3)
    })
  })
})
