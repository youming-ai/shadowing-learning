import { afterEach, describe, expect, it } from 'vitest'
import { DBUtils, db } from '~/lib/db/db'

afterEach(async () => {
  await db.segments.clear()
  await db.subtitles.clear()
  await db.media.clear()
})

describe('DBUtils media/subtitles operations', () => {
  it('addMedia / getMedia / listMedia (newest first)', async () => {
    const id1 = await DBUtils.addMedia({
      kind: 'audio',
      title: 'a.mp3',
      durationSec: null,
      addedAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      blob: new Blob(['x']),
      fileName: 'a.mp3',
      fileSize: 1,
      mimeType: 'audio/mpeg',
    })
    await DBUtils.addMedia({
      kind: 'youtube',
      title: 'video',
      durationSec: 120,
      addedAt: new Date('2026-01-02'),
      updatedAt: new Date('2026-01-02'),
      externalId: 'dQw4w9WgXcQ',
      channelName: 'ch',
      thumbnailUrl: 'https://i.ytimg.com/x.jpg',
      sourceUrl: 'https://youtu.be/dQw4w9WgXcQ',
    })
    expect((await DBUtils.getMedia(id1))?.title).toBe('a.mp3')
    const list = await DBUtils.listMedia()
    expect(list.map((m) => m.title)).toEqual(['video', 'a.mp3'])
  })

  it('findMediaByExternalId', async () => {
    await DBUtils.addMedia({
      kind: 'youtube',
      title: 'v',
      durationSec: 1,
      addedAt: new Date(),
      updatedAt: new Date(),
      externalId: 'jNQXAC9IVRw',
    })
    expect((await DBUtils.findMediaByExternalId('jNQXAC9IVRw'))?.title).toBe('v')
    expect(await DBUtils.findMediaByExternalId('absent_____')).toBeUndefined()
  })

  it('deleteMedia removes children first (segments → subtitles → media)', async () => {
    const mediaId = await DBUtils.addMedia({
      kind: 'audio',
      title: 'a',
      durationSec: null,
      addedAt: new Date(),
      updatedAt: new Date(),
      blob: new Blob(['x']),
    })
    const subId = await DBUtils.addSubtitle({
      mediaId,
      source: 'whisper',
      status: 'completed',
      sourceLanguage: 'ja',
      targetLanguage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    await db.segments.add({
      transcriptId: subId,
      start: 0,
      end: 1,
      text: 'x',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    await DBUtils.deleteMedia(mediaId)
    expect(await db.media.count()).toBe(0)
    expect(await db.subtitles.count()).toBe(0)
    expect(await db.segments.count()).toBe(0)
  })

  it('deleteSubtitleWithSegments removes an orphan subtitle and its segments, leaving media intact', async () => {
    const mediaId = await DBUtils.addMedia({
      kind: 'audio',
      title: 'a',
      durationSec: null,
      addedAt: new Date(),
      updatedAt: new Date(),
      blob: new Blob(['x']),
    })
    const subId = await DBUtils.addSubtitle({
      mediaId,
      source: 'whisper',
      status: 'completed',
      sourceLanguage: 'ja',
      targetLanguage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    await db.segments.bulkAdd([
      {
        transcriptId: subId,
        start: 0,
        end: 1,
        text: 'a',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        transcriptId: subId,
        start: 1,
        end: 2,
        text: 'b',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ])
    await DBUtils.deleteSubtitleWithSegments(subId)
    expect(await db.subtitles.count()).toBe(0)
    expect(await db.segments.count()).toBe(0)
    expect(await db.media.count()).toBe(1)
  })

  it('findSubtitleByMediaId / updateSubtitleStatus', async () => {
    const mediaId = await DBUtils.addMedia({
      kind: 'audio',
      title: 'a',
      durationSec: null,
      addedAt: new Date(),
      updatedAt: new Date(),
      blob: new Blob(['x']),
    })
    const subId = await DBUtils.addSubtitle({
      mediaId,
      source: 'official',
      status: 'pending',
      sourceLanguage: 'en',
      targetLanguage: 'zh-CN',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    await DBUtils.updateSubtitleStatus(subId, 'failed')
    const sub = await DBUtils.findSubtitleByMediaId(mediaId)
    expect(sub?.status).toBe('failed')
  })
})
