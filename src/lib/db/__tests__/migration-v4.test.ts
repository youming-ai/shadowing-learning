import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'

const DB_NAME = 'migration-v4-test-db'

const V3_STORES = {
  files: '++id, name, size, type, uploadedAt, [name+type]',
  transcripts: '++id, fileId, status, language, createdAt, updatedAt',
  segments:
    '++id, transcriptId, start, end, text, wordTimestamps, normalizedText, translation, annotations, furigana, [transcriptId+start], [transcriptId+end]',
}

async function seedV3() {
  const v3 = new Dexie(DB_NAME)
  v3.version(3).stores(V3_STORES)
  await v3.open()
  const fileId = await v3.table('files').add({
    name: 'lesson.mp3',
    size: 1024,
    type: 'audio/mpeg',
    blob: new Blob(['x']),
    uploadedAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    duration: 60,
  })
  const transcriptId = await v3.table('transcripts').add({
    fileId,
    status: 'completed',
    language: 'ja',
    rawText: 'こんにちは',
    postProcessStatus: 'completed',
    createdAt: new Date('2026-01-02'),
    updatedAt: new Date('2026-01-02'),
  })
  await v3.table('segments').bulkAdd([
    {
      transcriptId,
      start: 0,
      end: 2,
      text: 'こんにちは',
      translation: '你好',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      transcriptId,
      start: 2,
      end: 4,
      text: '世界',
      translation: '世界',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ])
  v3.close()
  return { fileId: fileId as number, transcriptId: transcriptId as number }
}

// ⚠️ 必须与 src/lib/db/db.ts 的 version(4) 块手工保持同步。
// 此处独立构造（而非复用 AppDatabase 单例），是为了避免单例在多次 fake-indexeddb
// 测试间缓存连接。代价是：若改了 db.ts 的迁移逻辑而忘了同步这里，测试会静默通过
// 却在验证旧逻辑——改 db.ts version(4) 时，务必同步修改本函数。
function openV4() {
  const v4 = new Dexie(DB_NAME)
  v4.version(3).stores(V3_STORES)
  v4.version(4)
    .stores({
      media: '++id, kind, &externalId, addedAt, [kind+addedAt]',
      subtitles: '++id, mediaId, status, createdAt',
      ...V3_STORES,
    })
    .upgrade(async (tx) => {
      const files = await tx.table('files').toArray()
      await tx.table('media').bulkAdd(
        files.map((f) => ({
          id: f.id,
          kind: 'audio',
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
          source: 'whisper',
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
    })
  return v4
}

afterEach(async () => {
  await Dexie.delete(DB_NAME)
})

describe('Dexie v3 → v4 migration', () => {
  it('copies files→media and transcripts→subtitles preserving ids; segments and old tables untouched', async () => {
    const { fileId, transcriptId } = await seedV3()
    const v4 = openV4()
    await v4.open()

    const media = await v4.table('media').toArray()
    expect(media).toHaveLength(1)
    expect(media[0].id).toBe(fileId)
    expect(media[0]).toMatchObject({
      kind: 'audio',
      title: 'lesson.mp3',
      fileSize: 1024,
      durationSec: 60,
    })

    const subtitles = await v4.table('subtitles').toArray()
    expect(subtitles).toHaveLength(1)
    expect(subtitles[0].id).toBe(transcriptId)
    expect(subtitles[0]).toMatchObject({
      mediaId: fileId,
      source: 'whisper',
      status: 'completed',
      sourceLanguage: 'ja',
      targetLanguage: null,
      postProcessStatus: 'completed',
    })

    const segs = await v4
      .table('segments')
      .where('transcriptId')
      .equals(transcriptId)
      .sortBy('start')
    expect(segs).toHaveLength(2)
    expect(segs[0].translation).toBe('你好')

    expect(await v4.table('files').count()).toBe(1)
    expect(await v4.table('transcripts').count()).toBe(1)
    v4.close()
  })

  it('opens cleanly on an empty database', async () => {
    const v4 = openV4()
    await v4.open()
    expect(await v4.table('media').count()).toBe(0)
    v4.close()
  })

  it('enforces unique externalId on media', async () => {
    const v4 = openV4()
    await v4.open()
    const row = {
      kind: 'youtube',
      title: 'a',
      durationSec: 10,
      addedAt: new Date(),
      updatedAt: new Date(),
      externalId: 'dQw4w9WgXcQ',
    }
    await v4.table('media').add(row)
    await expect(v4.table('media').add({ ...row, title: 'b' })).rejects.toMatchObject({
      name: 'ConstraintError',
    })
    v4.close()
  })

  it('allows multiple audio rows with no externalId (sparse unique index)', async () => {
    const v4 = openV4()
    await v4.open()
    const audio = {
      kind: 'audio',
      durationSec: null,
      addedAt: new Date(),
      updatedAt: new Date(),
      blob: new Blob(['x']),
      fileSize: 1,
      mimeType: 'audio/mpeg',
    }
    await v4.table('media').add({ ...audio, title: 'a', fileName: 'a.mp3' })
    await v4.table('media').add({ ...audio, title: 'b', fileName: 'b.mp3' })
    expect(await v4.table('media').count()).toBe(2)
    v4.close()
  })
})
