import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'

const DB_NAME = 'migration-v5-test-db'

const V4_STORES = {
  media: '++id, kind, &externalId, addedAt, [kind+addedAt]',
  subtitles: '++id, mediaId, status, createdAt',
  files: '++id, name, size, type, uploadedAt, [name+type]',
  transcripts: '++id, fileId, status, language, createdAt, updatedAt',
  segments:
    '++id, transcriptId, start, end, text, wordTimestamps, normalizedText, translation, annotations, furigana, [transcriptId+start], [transcriptId+end]',
}

// ⚠️ 必须与 src/lib/db/db.ts 的 version(5) 块手工保持同步。
// 与 migration-v4.test.ts 同样独立构造 Dexie 实例（不复用 AppDatabase 单例，
// 避免单例在多次 fake-indexeddb 测试间缓存连接）。改 db.ts version(5) 时同步本文件。
//
// 注意：删表必须写成 `files: null`。Dexie 的 stores() 跨版本累加声明，
// 单纯"不写这张表"不会删掉它（见下方 "drops the legacy files and transcripts tables"）。
const V5_STORES = {
  files: null,
  transcripts: null,
}

async function seedV4() {
  const v4 = new Dexie(DB_NAME)
  v4.version(4).stores(V4_STORES)
  await v4.open()

  const now = new Date('2026-01-01')

  // 保留的 YouTube 行（含子行），迁移后必须原样存活
  const youtubeMediaId = (await v4.table('media').add({
    kind: 'youtube',
    title: 'kept-video',
    externalId: 'dQw4w9WgXcQ',
    durationSec: 120,
    addedAt: now,
    updatedAt: now,
  })) as number
  const youtubeSubtitleId = (await v4.table('subtitles').add({
    mediaId: youtubeMediaId,
    source: 'official',
    status: 'completed',
    sourceLanguage: 'ja',
    targetLanguage: 'en',
    createdAt: now,
    updatedAt: now,
  })) as number
  await v4.table('segments').add({
    transcriptId: youtubeSubtitleId,
    segmentIndex: 0,
    start: 0,
    end: 2,
    text: 'こんにちは',
    translation: '你好',
    createdAt: now,
    updatedAt: now,
  })

  // v4 为 v3 老用户写入的遗留音频行（带 Blob、无 externalId）
  const legacyMediaIds: number[] = []
  for (const name of ['lesson-a.mp3', 'lesson-b.mp3']) {
    legacyMediaIds.push(
      (await v4.table('media').add({
        kind: 'audio',
        title: name,
        durationSec: 60,
        addedAt: now,
        updatedAt: now,
        blob: new Blob(['x']),
        fileName: name,
        fileSize: 1024,
        mimeType: 'audio/mpeg',
      })) as number,
    )
  }
  const legacySubtitleId = (await v4.table('subtitles').add({
    mediaId: legacyMediaIds[0],
    source: 'whisper',
    status: 'completed',
    sourceLanguage: 'ja',
    targetLanguage: null,
    createdAt: now,
    updatedAt: now,
  })) as number
  await v4.table('segments').bulkAdd([
    {
      transcriptId: legacySubtitleId,
      segmentIndex: 0,
      start: 0,
      end: 2,
      text: '旧片段',
      createdAt: now,
      updatedAt: now,
    },
    {
      transcriptId: legacySubtitleId,
      segmentIndex: 1,
      start: 2,
      end: 4,
      text: '旧片段二',
      createdAt: now,
      updatedAt: now,
    },
  ])

  // v5 应删掉的两张旧表，故意留行以证明它们是随表删除而非逐行清空
  await v4.table('files').add({
    name: 'lesson-a.mp3',
    size: 1024,
    type: 'audio/mpeg',
    blob: new Blob(['x']),
    uploadedAt: now,
    updatedAt: now,
  })
  await v4.table('transcripts').add({
    fileId: legacyMediaIds[0],
    status: 'completed',
    language: 'ja',
    createdAt: now,
    updatedAt: now,
  })

  v4.close()
  return { youtubeMediaId, youtubeSubtitleId, legacyMediaIds, legacySubtitleId }
}

function openV5() {
  const v5 = new Dexie(DB_NAME)
  v5.version(4).stores(V4_STORES)
  v5.version(5)
    .stores(V5_STORES)
    .upgrade(async (tx) => {
      const media = tx.table('media')
      const allIds: number[] = await media.toCollection().primaryKeys()
      const youtubeIds: number[] = await media.where('kind').equals('youtube').primaryKeys()
      const youtubeSet = new Set(youtubeIds)
      const legacyMediaIds = allIds.filter((id) => !youtubeSet.has(id))

      if (legacyMediaIds.length === 0) return

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
    })
  return v5
}

afterEach(async () => {
  await Dexie.delete(DB_NAME)
})

describe('Dexie v4 → v5 migration', () => {
  it('purges legacy audio media and its children while keeping YouTube rows intact', async () => {
    const { youtubeMediaId, youtubeSubtitleId, legacyMediaIds, legacySubtitleId } = await seedV4()
    const v5 = openV5()
    await v5.open()

    const media = await v5.table('media').toArray()
    expect(media).toHaveLength(1)
    expect(media[0].id).toBe(youtubeMediaId)
    expect(media[0]).toMatchObject({ kind: 'youtube', title: 'kept-video' })
    for (const legacyId of legacyMediaIds) {
      expect(await v5.table('media').get(legacyId)).toBeUndefined()
    }

    const subtitles = await v5.table('subtitles').toArray()
    expect(subtitles).toHaveLength(1)
    expect(subtitles[0].id).toBe(youtubeSubtitleId)
    expect(await v5.table('subtitles').get(legacySubtitleId)).toBeUndefined()

    const segments = await v5.table('segments').toArray()
    expect(segments).toHaveLength(1)
    expect(segments[0].transcriptId).toBe(youtubeSubtitleId)
    expect(segments[0].translation).toBe('你好')

    v5.close()
  })

  it('drops the legacy files and transcripts tables', async () => {
    await seedV4()
    const v5 = openV5()
    await v5.open()

    expect(v5.tables.map((t) => t.name).sort()).toEqual(['media', 'segments', 'subtitles'])

    v5.close()
  })

  it('is a no-op on a database that already holds only YouTube rows', async () => {
    const v4 = new Dexie(DB_NAME)
    v4.version(4).stores(V4_STORES)
    await v4.open()
    await v4.table('media').add({
      kind: 'youtube',
      title: 'only-video',
      externalId: 'aaaaaaaaaaa',
      durationSec: 1,
      addedAt: new Date(),
      updatedAt: new Date(),
    })
    v4.close()

    const v5 = openV5()
    await v5.open()

    expect(await v5.table('media').count()).toBe(1)
    expect((await v5.table('media').toArray())[0].title).toBe('only-video')
    v5.close()
  })

  it('opens cleanly on an empty database', async () => {
    const v5 = openV5()
    await v5.open()
    expect(await v5.table('media').count()).toBe(0)
    v5.close()
  })
})
