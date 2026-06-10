# YouTube 学习平台 子项目 #1 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 Bun + Vite + TanStack Start + Dexie 栈上实现「YouTube 导入 + 双语播放」：粘贴 YouTube 链接 → 服务端抓字幕（无字幕则 yt-dlp+Whisper）→ 客户端分片翻译 → Trancy 式三区播放页逐句学习。

**Architecture:** 服务器保持无状态代理（3 个新 API 以 videoId 为键），存储全在客户端 IndexedDB（Dexie v4 两阶段迁移：拷贝保留旧表，下个周期 v5 删表）。播放器经 `MediaSourceAdapter` 抽象统一 `<audio>` 与 YouTube IFrame。规格源：[docs/superpowers/specs/2026-06-10-youtube-learning-platform-design.md](../specs/2026-06-10-youtube-learning-platform-design.md)。

**Tech Stack:** TypeScript / React 19 / TanStack Start & Router & Query / Dexie 4 / youtubei.js / yt-dlp / Groq SDK / Tailwind v4 / Vitest（**不是 bun test**——运行命令一律 `bun run test:run` 或 `bunx vitest run <path>`）。

**约定（适用所有任务）：**
- 包管理只用 `bun`。lint：`bun run lint`；类型：`bun run type-check`；测试：`bunx vitest run <path>`（单文件）/ `bun run test:run`（全量）。
- 所有新组件用现有 CSS token（`var(--...)`），样式参照 [PlayerFooter.tsx](../../../src/components/features/player/page/PlayerFooter.tsx) 的写法。
- 提交信息用 conventional commits；每个任务结束必须 commit。
- 分支：在 `feat/shadowing` 上继续（或按需新建 `feat/youtube-learning`）。

---

## 文件地图（全部任务涉及的文件）

```
新建：
  scripts/spike-youtube-vps.ts                    # Phase 0 spike 脚本
  src/lib/youtube/url.ts (+__tests__/url.test.ts)
  src/lib/youtube/normalize.ts (+test)            # 字幕碎片合并
  src/lib/youtube/track-select.ts (+test)         # 字幕轨 5 级优先选择
  src/lib/youtube/innertube.ts                    # youtubei.js 包装 + 错误分类
  src/lib/youtube/ytdlp.ts                        # yt-dlp 子进程
  src/lib/youtube/error-messages.ts               # 错误码 → i18n key
  src/lib/utils/global-limits.ts (+test)          # 并发信号量 + 每日配额
  src/lib/ai/groq-whisper.ts                      # 从 transcribe.ts 抽出的 Whisper 调用
  src/lib/subtitles/chunk-postprocess.ts (+test)  # 分片翻译编排
  src/routes/api/youtube/resolve.ts
  src/routes/api/youtube/captions.ts
  src/routes/api/youtube/transcribe.ts
  src/routes/watch.$mediaId.tsx
  src/components/features/player/sources/types.ts
  src/components/features/player/sources/iframe-loader.ts
  src/components/features/player/sources/AudioFileAdapter.ts (+test)
  src/components/features/player/sources/YouTubeAdapter.ts (+test)
  src/components/features/player/sources/factory.ts
  src/hooks/player/usePlayerAdapter.ts
  src/hooks/player/useSegmentNavigation.ts (+test)
  src/hooks/player/useSegmentLoop.ts (+test)
  src/hooks/media/useMediaImport.ts (+test)
  src/hooks/media/useSubtitlePipeline.ts
  src/components/features/watch/{WatchPage,MediaViewport,CurrentSentence,SubtitlePanel,WatchControls}.tsx
  src/components/features/library/{LibraryPage,MediaCard,MediaImportDialog}.tsx

修改：
  src/types/db/database.ts            # +MediaRow/SubtitleRow/判别联合
  src/lib/db/db.ts                    # v4 schema+迁移+versionchange；DBUtils 改 media/subtitles
  src/hooks/db/useFiles.ts            # → useMediaList 语义（media 表）
  src/hooks/api/useTranscription.ts   # transcripts→subtitles
  src/hooks/useFileStatus.ts          # transcripts→subtitles
  src/hooks/player/usePlayerDataQuery.ts  # getFile→getMedia（Phase C 中其 objectURL 职责迁入 adapter）
  src/lib/utils/rate-limiter.ts       # +3 个端点配置
  src/lib/security/csp-nonce.ts       # +frame-src/script-src YouTube
  src/lib/i18n/translations.ts        # +新 key×4 locale
  src/routes/index.tsx                # LibraryPage
  src/routes/player.$fileId.tsx       # 重定向 /watch/$mediaId
  src/lib/utils/error-handler.ts      # +VersionError 识别
  public/sw.js                        # CACHE_NAME v2→v3
  Dockerfile                          # +yt-dlp 官方二进制
  docker-compose.yml                  # +tmpfs /tmp
  CLAUDE.md / docs/ARCHITECTURE.md / README.md

删除（Phase C 清理）：
  src/lib/db/subtitle-sync.ts（死代码，线性查找无引用）
  src/components/features/player/AudioPlayer.tsx（死代码）
  src/components/features/player/PlayerPage.tsx + PlayerFooterContainer.tsx + page/PlayerFooter.tsx（被 watch 组件取代）
  src/components/features/file/FileManager.tsx / FileCard.tsx（被 library 组件取代）
```

执行顺序：Phase 0 →（决策门通过）→ A → B → C → D。Phase A 结束是一个可独立发布的版本（行为不变，数据已上新表）。

---

# Phase 0 — Spike：VPS 上的 YouTube 可达性（决策门）

### Task 0: spike 脚本与实测

**Files:**
- Create: `scripts/spike-youtube-vps.ts`

- [ ] **Step 1: 安装依赖**

```bash
bun add youtubei.js
```

- [ ] **Step 2: 写 spike 脚本**

```ts
// scripts/spike-youtube-vps.ts
// 用法: bun run scripts/spike-youtube-vps.ts
// 在目标 VPS（Dokploy 宿主机或容器内）运行，验证 youtubei.js 与 yt-dlp 的可达性。
import { execFile } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { Innertube } from 'youtubei.js'

const execFileAsync = promisify(execFile)

// 混合冷热门、有手动字幕/仅 ASR/无字幕的样本
const VIDEO_IDS = [
  'dQw4w9WgXcQ', 'jNQXAC9IVRw', '9bZkp7q19f0', 'kJQP7kiw5Fk', 'OPf0YbXqDm0',
  'fJ9rUzIMcZQ', 'hTWKbfoikeg', 'YQHsXMglC9A', 'CevxZvSJLk8', 'JGwWNGJdvx8',
  'RgKAFK5djSk', 'OJNxxKlPtPg', 'uelHwf8o7_U', 'e-ORhEE9VVg', 'fLexgOxsZu0',
  'nfWlot6h_JM', 'hY7m5jjJ9mM', 'CocEMWdc7Ck', '09R8_2nJtjg', '7PCkvCPvDXk',
]

async function spikeInnertube() {
  const yt = await Innertube.create()
  let okBasic = 0
  let okTranscript = 0
  for (const id of VIDEO_IDS) {
    try {
      const basic = await yt.getBasicInfo(id)
      if (basic.basic_info.title) okBasic++
      try {
        const info = await yt.getInfo(id)
        const transcript = await info.getTranscript()
        if (transcript?.transcript?.content) okTranscript++
      } catch (e) {
        console.log(`  transcript ${id}: FAIL ${(e as Error).message.slice(0, 120)}`)
      }
    } catch (e) {
      console.log(`  basicInfo ${id}: FAIL ${(e as Error).message.slice(0, 120)}`)
    }
  }
  console.log(`innertube: basicInfo ${okBasic}/${VIDEO_IDS.length}, transcript ${okTranscript}/${VIDEO_IDS.length}`)
  return { okBasic, okTranscript }
}

async function spikeYtdlp() {
  let ok = 0
  const dir = mkdtempSync(join(tmpdir(), 'spike-'))
  try {
    for (const id of VIDEO_IDS.slice(0, 20)) {
      try {
        await execFileAsync(
          'yt-dlp',
          ['-f', 'bestaudio[abr<=64]/worstaudio', '--max-filesize', '25M', '--no-part',
           '-o', join(dir, `${id}.audio`), '--', id],
          { timeout: 90_000 },
        )
        ok++
      } catch (e) {
        console.log(`  yt-dlp ${id}: FAIL ${(e as Error).message.slice(0, 120)}`)
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
  console.log(`yt-dlp: ${ok}/20`)
  return ok
}

const { okBasic, okTranscript } = await spikeInnertube()
const ytdlpOk = await spikeYtdlp()
const pass = okBasic >= 18 && okTranscript >= 16 && ytdlpOk >= 18
console.log(pass ? '\nSPIKE PASS（≥90% 阈值，按计划继续）' : '\nSPIKE FAIL（启动对策阶梯，见 spec Section 0）')
process.exit(pass ? 0 : 1)
```

- [ ] **Step 3: 本地先跑一遍确认脚本本身能工作**

Run: `bun run scripts/spike-youtube-vps.ts`
Expected: 本地（住宅网络）应接近全绿。脚本错误（非网络错误）在此修掉。

- [ ] **Step 4: 在目标 VPS 上运行**

```bash
# 在 VPS 上（需 bun + yt-dlp；或起一个临时容器）：
git fetch && git checkout feat/shadowing
bun install
bun run scripts/spike-youtube-vps.ts
```
Expected: 输出两条成功率与 PASS/FAIL 结论。

- [ ] **Step 5: 记录决策**

把实测数字与结论追加到 spec 文档 Section 0 末尾（`docs/superpowers/specs/2026-06-10-youtube-learning-platform-design.md`）。**FAIL 则停止执行本计划**，按对策阶梯（cookies → PO token provider → TV_EMBEDDED → 住宅代理）修订 spec 后再回来。

- [ ] **Step 6: Commit**

```bash
git add scripts/spike-youtube-vps.ts package.json bun.lock docs/superpowers/specs/2026-06-10-youtube-learning-platform-design.md
git commit -m "chore(spike): YouTube reachability spike script + VPS results"
```

---

# Phase A — 数据层：Dexie v4 与调用点收编

### Task A1: 新类型 MediaRow / SubtitleRow

**Files:**
- Modify: `src/types/db/database.ts`

- [ ] **Step 1: 在 `Segment` 接口之后追加新类型**（保留 FileRow/TranscriptRow——迁移代码与 v5 清理仍需要它们）

```ts
// ===== v4 unified media model =====

export type MediaKind = 'audio' | 'youtube'

export interface MediaRow {
  id?: number
  kind: MediaKind
  title: string
  durationSec: number | null
  addedAt: Date
  updatedAt: Date
  // kind: 'audio'
  blob?: Blob
  fileName?: string
  fileSize?: number
  mimeType?: string
  // kind: 'youtube'
  externalId?: string
  channelName?: string
  thumbnailUrl?: string
  sourceUrl?: string
}

export type AudioMedia = MediaRow & { kind: 'audio'; blob: Blob }
export type YouTubeMedia = MediaRow & { kind: 'youtube'; externalId: string }

export type SubtitleSource = 'official' | 'whisper'

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
```

注意：`Segment.transcriptId` 字段名不改——v4 起其语义是指向 `subtitles.id`（迁移保留原 id，两者数值相同）。在 `Segment` 接口的 `transcriptId` 行上方加一行注释：

```ts
  /** v4 起指向 subtitles.id（历史字段名保留，避免重写最大的表） */
  transcriptId: number
```

- [ ] **Step 2: 验证**

Run: `bun run type-check`
Expected: PASS（纯新增，无破坏）

- [ ] **Step 3: Commit**

```bash
git add src/types/db/database.ts
git commit -m "feat(db): add MediaRow/SubtitleRow types for unified media model"
```

### Task A2: Dexie v4 迁移（测试先行）+ versionchange

**Files:**
- Modify: `src/lib/db/db.ts`
- Test: `src/lib/db/__tests__/migration-v4.test.ts`

- [ ] **Step 1: 写失败的迁移测试**

```ts
// src/lib/db/__tests__/migration-v4.test.ts
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
    name: 'lesson.mp3', size: 1024, type: 'audio/mpeg',
    blob: new Blob(['x']), uploadedAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
    duration: 60,
  })
  const transcriptId = await v3.table('transcripts').add({
    fileId, status: 'completed', language: 'ja', rawText: 'こんにちは',
    postProcessStatus: 'completed',
    createdAt: new Date('2026-01-02'), updatedAt: new Date('2026-01-02'),
  })
  await v3.table('segments').bulkAdd([
    { transcriptId, start: 0, end: 2, text: 'こんにちは', translation: '你好',
      createdAt: new Date(), updatedAt: new Date() },
    { transcriptId, start: 2, end: 4, text: '世界', translation: '世界',
      createdAt: new Date(), updatedAt: new Date() },
  ])
  v3.close()
  return { fileId: fileId as number, transcriptId: transcriptId as number }
}

// 与 src/lib/db/db.ts 中 version(4) 完全一致的声明（测试里独立构造，避免单例缓存）
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
          id: f.id, kind: 'audio', title: f.name,
          durationSec: f.duration ?? null, addedAt: f.uploadedAt, updatedAt: f.updatedAt,
          blob: f.blob, fileName: f.name, fileSize: f.size, mimeType: f.type,
        })),
      )
      const transcripts = await tx.table('transcripts').toArray()
      await tx.table('subtitles').bulkAdd(
        transcripts.map((t) => ({
          id: t.id, mediaId: t.fileId, source: 'whisper', status: t.status,
          sourceLanguage: t.language ?? 'auto', targetLanguage: null,
          postProcessStatus: t.postProcessStatus, postProcessError: t.postProcessError,
          rawText: t.rawText, error: t.error, createdAt: t.createdAt, updatedAt: t.updatedAt,
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
    expect(media[0]).toMatchObject({ kind: 'audio', title: 'lesson.mp3', fileSize: 1024, durationSec: 60 })

    const subtitles = await v4.table('subtitles').toArray()
    expect(subtitles).toHaveLength(1)
    expect(subtitles[0].id).toBe(transcriptId)
    expect(subtitles[0]).toMatchObject({
      mediaId: fileId, source: 'whisper', status: 'completed',
      sourceLanguage: 'ja', targetLanguage: null, postProcessStatus: 'completed',
    })

    // segments 零接触，仍可按原索引查询
    const segs = await v4.table('segments').where('transcriptId').equals(transcriptId).sortBy('start')
    expect(segs).toHaveLength(2)
    expect(segs[0].translation).toBe('你好')

    // 旧表保留（恢复窗口）
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
      kind: 'youtube', title: 'a', durationSec: 10, addedAt: new Date(), updatedAt: new Date(),
      externalId: 'dQw4w9WgXcQ',
    }
    await v4.table('media').add(row)
    await expect(v4.table('media').add({ ...row, title: 'b' })).rejects.toMatchObject({
      name: 'ConstraintError',
    })
    v4.close()
  })
})
```

- [ ] **Step 2: 跑测试确认当前失败**

Run: `bunx vitest run src/lib/db/__tests__/migration-v4.test.ts`
Expected: 测试本身自包含会 PASS（它独立构造 schema）——这是迁移逻辑的规格测试。先确认 3 个用例全绿，作为 db.ts 改动的对照基准。

- [ ] **Step 3: 修改 `src/lib/db/db.ts`**

3a. class 声明加新表（保留 files/transcripts 声明）：

```ts
export class AppDatabase extends Dexie {
  files!: Table<FileRow>
  transcripts!: Table<TranscriptRow>
  segments!: Table<Segment>
  media!: Table<MediaRow>
  subtitles!: Table<SubtitleRow>
```

import 行更新：`import type { FileRow, MediaRow, Segment, SubtitleRow, TranscriptRow } from '~/types/db/database'`

3b. 在 constructor 中 `this.version(3)...` 块之后追加（schema 字符串与测试中 `openV4()` 逐字一致；**不吞错**——与 v3 upgrade 的 try/catch 风格刻意不同）：

```ts
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
            id: f.id, kind: 'audio' as const, title: f.name,
            durationSec: f.duration ?? null, addedAt: f.uploadedAt, updatedAt: f.updatedAt,
            blob: f.blob, fileName: f.name, fileSize: f.size, mimeType: f.type,
          })),
        )
        const transcripts = await tx.table('transcripts').toArray()
        await tx.table('subtitles').bulkAdd(
          transcripts.map((t) => ({
            id: t.id, mediaId: t.fileId, source: 'whisper' as const, status: t.status,
            sourceLanguage: t.language ?? 'auto', targetLanguage: null,
            postProcessStatus: t.postProcessStatus, postProcessError: t.postProcessError,
            rawText: t.rawText, error: t.error, createdAt: t.createdAt, updatedAt: t.updatedAt,
          })),
        )
        dbLogger.debug(`v4 migration done: ${files.length} media, ${transcripts.length} subtitles`)
      })
```

3c. 在 `export const db = new AppDatabase()` 之后加 versionchange 处理与打开后校验：

```ts
// 另一个标签页升级 DB 时，关闭本页连接并刷新，避免阻塞升级（Dexie 推荐做法）
db.on('versionchange', () => {
  db.close()
  if (typeof window !== 'undefined') {
    window.location.reload()
  }
})

// v4 打开后的一次性行数校验（检测线：不一致只上报，不阻断）
db.on('ready', async () => {
  try {
    const [filesCount, mediaCount] = await Promise.all([db.files.count(), db.media.count()])
    if (mediaCount < filesCount) {
      dbLogger.error(`v4 row-count mismatch: files=${filesCount} media=${mediaCount}`)
    }
  } catch (e) {
    dbLogger.error('v4 row-count check failed:', e)
  }
})
```

- [ ] **Step 4: 验证**

Run: `bunx vitest run src/lib/db && bun run type-check`
Expected: 迁移测试与现有 db 测试 PASS；type-check PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/db.ts src/lib/db/__tests__/migration-v4.test.ts
git commit -m "feat(db): Dexie v4 — media/subtitles tables, copy-migration keeping old tables, versionchange handler"
```

### Task A3: DBUtils 改造

**Files:**
- Modify: `src/lib/db/db.ts`（DBUtils 对象）
- Test: `src/lib/db/__tests__/dbutils-media.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// src/lib/db/__tests__/dbutils-media.test.ts
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
      kind: 'audio', title: 'a.mp3', durationSec: null,
      addedAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
      blob: new Blob(['x']), fileName: 'a.mp3', fileSize: 1, mimeType: 'audio/mpeg',
    })
    await DBUtils.addMedia({
      kind: 'youtube', title: 'video', durationSec: 120,
      addedAt: new Date('2026-01-02'), updatedAt: new Date('2026-01-02'),
      externalId: 'dQw4w9WgXcQ', channelName: 'ch', thumbnailUrl: 'https://i.ytimg.com/x.jpg',
      sourceUrl: 'https://youtu.be/dQw4w9WgXcQ',
    })
    expect((await DBUtils.getMedia(id1))?.title).toBe('a.mp3')
    const list = await DBUtils.listMedia()
    expect(list.map((m) => m.title)).toEqual(['video', 'a.mp3'])
  })

  it('findMediaByExternalId', async () => {
    await DBUtils.addMedia({
      kind: 'youtube', title: 'v', durationSec: 1, addedAt: new Date(), updatedAt: new Date(),
      externalId: 'jNQXAC9IVRw',
    })
    expect((await DBUtils.findMediaByExternalId('jNQXAC9IVRw'))?.title).toBe('v')
    expect(await DBUtils.findMediaByExternalId('absent_____')).toBeUndefined()
  })

  it('deleteMedia removes children first (segments → subtitles → media)', async () => {
    const mediaId = await DBUtils.addMedia({
      kind: 'audio', title: 'a', durationSec: null, addedAt: new Date(), updatedAt: new Date(),
      blob: new Blob(['x']),
    })
    const subId = await DBUtils.addSubtitle({
      mediaId, source: 'whisper', status: 'completed', sourceLanguage: 'ja', targetLanguage: null,
      createdAt: new Date(), updatedAt: new Date(),
    })
    await db.segments.add({
      transcriptId: subId, start: 0, end: 1, text: 'x', createdAt: new Date(), updatedAt: new Date(),
    })
    await DBUtils.deleteMedia(mediaId)
    expect(await db.media.count()).toBe(0)
    expect(await db.subtitles.count()).toBe(0)
    expect(await db.segments.count()).toBe(0)
  })

  it('findSubtitleByMediaId / updateSubtitleStatus', async () => {
    const mediaId = await DBUtils.addMedia({
      kind: 'audio', title: 'a', durationSec: null, addedAt: new Date(), updatedAt: new Date(),
      blob: new Blob(['x']),
    })
    const subId = await DBUtils.addSubtitle({
      mediaId, source: 'official', status: 'pending', sourceLanguage: 'en', targetLanguage: 'zh-CN',
      createdAt: new Date(), updatedAt: new Date(),
    })
    await DBUtils.updateSubtitleStatus(subId, 'failed')
    const sub = await DBUtils.findSubtitleByMediaId(mediaId)
    expect(sub?.status).toBe('failed')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `bunx vitest run src/lib/db/__tests__/dbutils-media.test.ts`
Expected: FAIL — `DBUtils.addMedia is not a function`

- [ ] **Step 3: 在 DBUtils 中实现**

在 `DBUtils` 对象里：**替换** `addFile/getFile/getAllFiles/findFilesByName/deleteFile/addTranscript/getTranscript/findTranscriptByFileId/updateTranscriptStatus/getTranscriptsByStatus` 这组旧方法为下列新方法（旧方法直接删除——调用点在 Task A4 全部更新）：

```ts
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
```

同文件内其余调整：
- `getStorageUsage`：`db.files.toArray()` → `db.media.toArray()`，`file.size` → `m.fileSize ?? 0`，`file.type` → `m.mimeType ?? 'youtube'`
- `cleanupOldFiles`：改为基于 `db.media.where('addedAt')`，children 删除走 subtitles；重命名为 `cleanupOldMedia`
- `clearAll` / `getDatabaseStats`：表改为 media/subtitles/segments（统计字段名 totalFiles→totalMedia、totalTranscripts→totalSubtitles，同步改 `DatabaseStats` 类型）

- [ ] **Step 4: 验证**

Run: `bunx vitest run src/lib/db && bun run type-check`
Expected: 新测试 PASS；type-check 此时会**报错**列出所有还在调用旧方法的文件（useFiles/useFileStatus/useTranscription/usePlayerDataQuery/StatsCards/manual-postprocess 等）——这正是 Task A4 的工作清单，先记录报错列表再进入 A4。

- [ ] **Step 5: Commit（与 A4 合并提交亦可，若 type-check 不绿则此处不单独提交）**

### Task A4: 调用点收编（全仓切到 media/subtitles）

**Files:**
- Modify: `src/hooks/db/useFiles.ts`、`src/hooks/api/useTranscription.ts`、`src/hooks/useFileStatus.ts`、`src/hooks/player/usePlayerDataQuery.ts`、`src/lib/utils/manual-postprocess.ts`、`src/components/features/file/FileManager.tsx`、`FileCard.tsx`、`StatsCards.tsx`、`FileUpload.tsx`（仅类型引用处）

**字段映射表（机械重命名，全部按此执行）：**

| 旧 | 新 |
|---|---|
| `FileRow` 类型引用 | `MediaRow` |
| `TranscriptRow` 类型引用 | `SubtitleRow` |
| `DBUtils.getFile(id)` | `DBUtils.getMedia(id)` |
| `DBUtils.getAllFiles()` | `DBUtils.listMedia()` |
| `DBUtils.addFile({...})` | `DBUtils.addMedia({...})`（字段见下） |
| `DBUtils.deleteFile(id)` | `DBUtils.deleteMedia(id)` |
| `DBUtils.findTranscriptByFileId(id)` | `DBUtils.findSubtitleByMediaId(id)` |
| `DBUtils.addTranscript({fileId,...})` | `DBUtils.addSubtitle({mediaId,...})` |
| `DBUtils.updateTranscriptStatus(...)` | `DBUtils.updateSubtitleStatus(...)` |
| `db.transcripts`（事务/直连） | `db.subtitles` |
| 行字段 `.name` | `.title`（显示）/ `.fileName`（文件名场景） |
| 行字段 `.size` | `.fileSize ?? 0` |
| 行字段 `.type` | `.mimeType ?? ''` |
| 行字段 `.uploadedAt` | `.addedAt` |
| 行字段 `.duration` | `.durationSec` |

- [ ] **Step 1: useFiles.ts** — `addFiles` 的写入体改为：

```ts
        await DBUtils.addMedia({
          kind: 'audio',
          title: file.name,
          durationSec: null,
          addedAt: now,
          updatedAt: now,
          blob: file,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        })
```

`queryFn` 改 `DBUtils.listMedia()`；`deleteFile` 内改 `DBUtils.deleteMedia(id)`；返回类型 `files: MediaRow[]`。

- [ ] **Step 2: useTranscription.ts** — 关键改动：
  - `saveTranscriptionResults`：事务表 `db.transcripts`→`db.subtitles`、`tx.table('transcripts')`→`tx.table('subtitles')`、`where('fileId')`→`where('mediaId')`；新建行补齐 v4 必填字段：

```ts
        transcriptId = await tx.table('subtitles').add({
          mediaId: fileId,
          source: 'whisper' as const,
          status: 'completed' as const,
          sourceLanguage: data.language,
          targetLanguage: null,
          rawText: data.text,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
```

  - 更新分支同理（update 字段 `rawText/sourceLanguage/status/updatedAt`）。
  - `updatePostProcessStatus`：`DBUtils.update(db.transcripts, ...)` → `DBUtils.update(db.subtitles, ...)`，并在 postprocess 完成时一并写 `targetLanguage`（在 `postProcessTranscription` 成功路径上加 `await DBUtils.update(db.subtitles, transcriptId, { targetLanguage })`，`targetLanguage` 已是该函数入参）。
  - `useTranscriptionStatus` 的 queryFn：`findTranscriptByFileId`→`findSubtitleByMediaId`。
  - 局部变量/参数名 `fileId` 保持不动（值即 mediaId，A 阶段不做大规模改名）。

- [ ] **Step 3: useFileStatus.ts** — 按映射表替换（`addTranscript`→`addSubtitle` 时新建行补 `source:'whisper', sourceLanguage:'', targetLanguage:null`；`DBUtils.update(db.transcripts,...)`→`db.subtitles`）。`resetFileStatus` 中删除逻辑改用 `DBUtils.deleteSubtitleWithSegments(transcript.id)`。

- [ ] **Step 4: usePlayerDataQuery.ts** — `DBUtils.getFile`→`DBUtils.getMedia`；`file.blob` 逻辑不变（audio 行有 blob）；类型 `FileRow`→`MediaRow`。

- [ ] **Step 5: manual-postprocess.ts、FileManager.tsx、FileCard.tsx、StatsCards.tsx** — 按映射表机械替换（显示处 `.name`→`.title`、`.uploadedAt`→`.addedAt`、`.size`→`.fileSize ?? 0`）。

- [ ] **Step 6: 全量验证**

Run: `bun run type-check && bun run lint && bun run test:run`
Expected: 三者全绿。type-check 是这次收编的完备性证明——任何遗漏调用点都会在这里现形。若现有测试断言了旧字段名（如 FileUpload.test），同步更新断言。

- [ ] **Step 7: 手动迁移冒烟**

Run: `bun run dev`，用一个**之前用过本应用、IndexedDB 里有真实数据**的浏览器 profile 打开 http://localhost:3000 。
Expected: 文件列表照常显示；播放某个旧文件，字幕/翻译完整；DevTools → Application → IndexedDB 中可见 media/subtitles 表有数据且 files/transcripts 仍在。

- [ ] **Step 8: Commit**

```bash
git add -A src/
git commit -m "refactor(db): switch all callers from files/transcripts to media/subtitles"
```

### Task A5: VersionError 错误识别

**Files:**
- Modify: `src/lib/utils/error-handler.ts`
- Test: `src/lib/utils/__tests__/error-handler-version.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// src/lib/utils/__tests__/error-handler-version.test.ts
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { getFriendlyErrorMessage } from '~/lib/utils/error-handler'

describe('Dexie version errors', () => {
  it('maps VersionError to a refresh prompt', () => {
    const err = new Dexie.VersionError('stale schema')
    expect(getFriendlyErrorMessage(err)).toContain('刷新')
  })
  it('maps DatabaseClosedError to a refresh prompt', () => {
    const err = new Dexie.DatabaseClosedError('closed')
    expect(getFriendlyErrorMessage(err)).toContain('刷新')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `bunx vitest run src/lib/utils/__tests__/error-handler-version.test.ts`
Expected: FAIL（当前返回通用错误文案）

- [ ] **Step 3: 实现** — 在 `error-handler.ts` 顶部 `import Dexie from 'dexie'`，在 `getFriendlyErrorMessage`（:339）的 `isApiKeyError` 判断之后插入：

```ts
  if (
    error instanceof Dexie.VersionError ||
    error instanceof Dexie.DatabaseClosedError ||
    (error instanceof Error && (error.name === 'VersionError' || error.name === 'DatabaseClosedError'))
  ) {
    return '应用已更新，请刷新页面以加载新版本'
  }
```

- [ ] **Step 4: 验证 + Commit**

Run: `bunx vitest run src/lib/utils && bun run type-check`
Expected: PASS

```bash
git add src/lib/utils/error-handler.ts src/lib/utils/__tests__/error-handler-version.test.ts
git commit -m "feat(errors): friendly refresh prompt for Dexie VersionError/DatabaseClosedError"
```

**Phase A 完成标志：** `bun run lint && bun run type-check && bun run test:run` 全绿 + Task A4 Step 7 的手动迁移冒烟通过。此状态可独立发布（行为不变）。

---

# Phase B — 服务端：YouTube 接入层

### Task B1: 抽取共享 Whisper 模块 lib/ai/groq-whisper.ts

**Files:**
- Create: `src/lib/ai/groq-whisper.ts`
- Modify: `src/routes/api/transcribe.ts`

- [ ] **Step 1: 纯移动重构** — 把 [transcribe.ts](../../../src/routes/api/transcribe.ts) 中的 `normalizeLanguageCode`（:180-190）与 `processTranscription`（:192-362）**原样剪切**到新文件 `src/lib/ai/groq-whisper.ts`，两个函数都加 `export`。新文件头部 import（从 transcribe.ts 现有 import 中带走）：

```ts
import { groqClient } from '~/lib/ai/groq-client'
import { safeGroqRequest } from '~/lib/ai/groq-request-wrapper'
import {
  buildSegmentsFromPlainText,
  buildSegmentsFromWords,
  distributeWordsIntoSegments,
  mapGroqSegmentToTranscriptionSegment,
} from '~/lib/ai/groq-transcription-utils'
import { apiError } from '~/lib/utils/api-response'
import { apiLogger } from '~/lib/utils/logger'
import type { GroqTranscriptionResponse, TranscriptionSegment } from '~/types/transcription'
```

- [ ] **Step 2:** transcribe.ts 中删掉这两个函数，改为 `import { processTranscription } from '~/lib/ai/groq-whisper'`，清理不再使用的 import（biome 会报）。

- [ ] **Step 3: 验证（行为零变化的证明）**

Run: `bun run type-check && bun run lint && bun run test:run`
Expected: 全绿，无任何测试改动。

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/groq-whisper.ts src/routes/api/transcribe.ts
git commit -m "refactor(ai): extract processTranscription to shared lib/ai/groq-whisper"
```

### Task B2: YouTube URL 解析器

**Files:**
- Create: `src/lib/youtube/url.ts`
- Test: `src/lib/youtube/__tests__/url.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// src/lib/youtube/__tests__/url.test.ts
import { describe, expect, it } from 'vitest'
import { extractVideoId } from '~/lib/youtube/url'

describe('extractVideoId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?si=abc', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('parses %s', (url, id) => {
    expect(extractVideoId(url)).toBe(id)
  })

  it.each([
    'https://www.youtube.com/playlist?list=PLx',          // playlist，无视频
    'https://example.com/watch?v=dQw4w9WgXcQ',            // 非 YouTube 域
    'https://www.youtube.com/watch?v=short',               // id 长度不对
    'https://www.youtube.com/watch?v=dQw4w9WgXc$',         // 非法字符
    'not a url',
    'file:///etc/passwd',
    '',
  ])('rejects %s', (url) => {
    expect(extractVideoId(url)).toBeNull()
  })
})
```

- [ ] **Step 2:** Run: `bunx vitest run src/lib/youtube/__tests__/url.test.ts` → Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

```ts
// src/lib/youtube/url.ts
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/
const ALLOWED_HOSTS = new Set([
  'www.youtube.com', 'youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be',
])

/**
 * 从 YouTube URL 提取 11 位 videoId。
 * 返回值同时是安全边界：调用方可以信任它只含 [A-Za-z0-9_-]，
 * 可安全用于 yt-dlp execFile 参数与 IFrame videoId。
 */
export function extractVideoId(input: string): string | null {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    return null
  }
  if (!ALLOWED_HOSTS.has(url.hostname)) return null

  let candidate: string | null = null
  if (url.hostname === 'youtu.be') {
    candidate = url.pathname.split('/')[1] ?? null
  } else if (url.pathname === '/watch') {
    candidate = url.searchParams.get('v')
  } else if (url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/embed/')) {
    candidate = url.pathname.split('/')[2] ?? null
  }

  return candidate && VIDEO_ID_RE.test(candidate) ? candidate : null
}

export function isValidVideoId(id: string): boolean {
  return VIDEO_ID_RE.test(id)
}
```

- [ ] **Step 4:** Run: `bunx vitest run src/lib/youtube/__tests__/url.test.ts` → Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/youtube/
git commit -m "feat(youtube): URL parser with strict 11-char videoId validation"
```

### Task B3: 字幕碎片合并 normalize.ts

**Files:**
- Create: `src/lib/youtube/normalize.ts`
- Test: `src/lib/youtube/__tests__/normalize.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// src/lib/youtube/__tests__/normalize.test.ts
import { describe, expect, it } from 'vitest'
import { type CaptionCue, mergeShortCues, msCuesToSeconds } from '~/lib/youtube/normalize'

describe('msCuesToSeconds', () => {
  it('converts ms offsets to seconds', () => {
    expect(msCuesToSeconds([{ startMs: 1500, endMs: 4250, text: 'hi' }])).toEqual([
      { start: 1.5, end: 4.25, text: 'hi' },
    ])
  })
})

describe('mergeShortCues', () => {
  const cue = (start: number, end: number, text: string): CaptionCue => ({ start, end, text })

  it('merges a fragment shorter than 1.2s without ending punctuation into the next cue', () => {
    const merged = mergeShortCues([cue(0, 0.8, 'I was'), cue(0.8, 3, 'told to make my bed.')])
    expect(merged).toEqual([cue(0, 3, 'I was told to make my bed.')])
  })

  it('keeps short fragments that end with sentence punctuation', () => {
    const input = [cue(0, 1, 'Yeah.'), cue(1, 4, 'That is about right.')]
    expect(mergeShortCues(input)).toEqual(input)
  })

  it('keeps long cues as-is and supports CJK punctuation', () => {
    const input = [cue(0, 0.9, '你好。'), cue(0.9, 5, '欢迎来到本频道，今天我们聊聊苹果。')]
    expect(mergeShortCues(input)).toEqual(input)
  })

  it('chains merges across consecutive fragments', () => {
    const merged = mergeShortCues([cue(0, 0.5, 'a'), cue(0.5, 1.0, 'b'), cue(1.0, 4, 'c done.')])
    expect(merged).toEqual([cue(0, 4, 'a b c done.')])
  })

  it('last cue is never dropped even if short', () => {
    const input = [cue(0, 3, 'Hello there.'), cue(3, 3.5, 'bye')]
    expect(mergeShortCues(input)).toEqual(input)
  })

  it('handles empty input', () => {
    expect(mergeShortCues([])).toEqual([])
  })
})
```

- [ ] **Step 2:** Run: `bunx vitest run src/lib/youtube/__tests__/normalize.test.ts` → FAIL

- [ ] **Step 3: 实现**

```ts
// src/lib/youtube/normalize.ts
export interface CaptionCue {
  start: number // 秒
  end: number
  text: string
}

export interface MsCue {
  startMs: number
  endMs: number
  text: string
}

const SENTENCE_END_RE = /[.!?。！？…]["')\]」』]?$/
const MIN_CUE_SECONDS = 1.2

export function msCuesToSeconds(cues: MsCue[]): CaptionCue[] {
  return cues.map((c) => ({ start: c.startMs / 1000, end: c.endMs / 1000, text: c.text }))
}

/**
 * YouTube ASR 字幕碎片化严重；将「时长 < 1.2s 且不以句末标点结尾」的片段
 * 并入下一段，避免翻译与逐句学习体验被碎片破坏。最后一段永不丢弃。
 */
export function mergeShortCues(cues: CaptionCue[]): CaptionCue[] {
  const result: CaptionCue[] = []
  let pending: CaptionCue | null = null

  for (const cue of cues) {
    const current: CaptionCue = pending
      ? { start: pending.start, end: cue.end, text: `${pending.text} ${cue.text}`.trim() }
      : { ...cue }
    pending = null

    const duration = current.end - current.start
    if (duration < MIN_CUE_SECONDS && !SENTENCE_END_RE.test(current.text.trim())) {
      pending = current
    } else {
      result.push(current)
    }
  }

  if (pending) result.push(pending)
  return result
}
```

- [ ] **Step 4:** Run: `bunx vitest run src/lib/youtube/__tests__/normalize.test.ts` → PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/youtube/
git commit -m "feat(youtube): caption cue normalization — ms→s and short-fragment merging"
```

### Task B4: 字幕轨 5 级优先选择 track-select.ts

**Files:**
- Create: `src/lib/youtube/track-select.ts`
- Test: `src/lib/youtube/__tests__/track-select.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// src/lib/youtube/__tests__/track-select.test.ts
import { describe, expect, it } from 'vitest'
import { type CaptionTrackMeta, selectCaptionTrack } from '~/lib/youtube/track-select'

const t = (language: string, kind: 'manual' | 'asr', displayName: string): CaptionTrackMeta => ({
  language, kind, displayName,
})

describe('selectCaptionTrack — 5 级优先', () => {
  const tracks = [
    t('ja', 'asr', 'Japanese (auto-generated)'),
    t('en', 'manual', 'English'),
    t('en', 'asr', 'English (auto-generated)'),
    t('ko', 'manual', 'Korean'),
  ]

  it('1. preferredLanguage 的手动字幕最优', () => {
    expect(selectCaptionTrack(tracks, { preferredLanguage: 'en' })?.displayName).toBe('English')
  })
  it('2. 无手动时取 preferredLanguage 的 ASR', () => {
    expect(selectCaptionTrack(tracks, { preferredLanguage: 'ja' })?.displayName).toBe(
      'Japanese (auto-generated)',
    )
  })
  it('3. 无 preferred 命中时取原声语言的手动字幕', () => {
    expect(
      selectCaptionTrack(tracks, { preferredLanguage: 'fr', originalLanguage: 'ko' })?.displayName,
    ).toBe('Korean')
  })
  it('4. 再退到任意手动字幕', () => {
    const only = [t('de', 'manual', 'German'), t('ja', 'asr', 'Japanese (auto-generated)')]
    expect(selectCaptionTrack(only, { preferredLanguage: 'fr' })?.displayName).toBe('German')
  })
  it('5. 最后任意 ASR', () => {
    const only = [t('ja', 'asr', 'Japanese (auto-generated)')]
    expect(selectCaptionTrack(only, { preferredLanguage: 'fr' })?.displayName).toBe(
      'Japanese (auto-generated)',
    )
  })
  it('语言比较忽略地区后缀（zh-CN 匹配 zh）', () => {
    const only = [t('zh-Hans', 'manual', 'Chinese (Simplified)')]
    expect(selectCaptionTrack(only, { preferredLanguage: 'zh-CN' })?.displayName).toBe(
      'Chinese (Simplified)',
    )
  })
  it('空轨道返回 null', () => {
    expect(selectCaptionTrack([], {})).toBeNull()
  })
})
```

- [ ] **Step 2:** Run: `bunx vitest run src/lib/youtube/__tests__/track-select.test.ts` → FAIL

- [ ] **Step 3: 实现**

```ts
// src/lib/youtube/track-select.ts
export interface CaptionTrackMeta {
  language: string // BCP-47 language code（来自 player 响应 caption_tracks.language_code）
  kind: 'manual' | 'asr'
  displayName: string // transcript 面板的 display name（用于 selectLanguage()）
}

interface SelectOptions {
  preferredLanguage?: string
  originalLanguage?: string
}

function baseLang(code: string): string {
  return code.toLowerCase().split('-')[0]
}

function sameLang(a: string | undefined, b: string): boolean {
  return a !== undefined && baseLang(a) === baseLang(b)
}

/** 5 级优先：preferred 手动 > preferred ASR > 原声手动 > 任意手动 > 任意 ASR */
export function selectCaptionTrack(
  tracks: CaptionTrackMeta[],
  { preferredLanguage, originalLanguage }: SelectOptions,
): CaptionTrackMeta | null {
  if (tracks.length === 0) return null
  return (
    tracks.find((t) => t.kind === 'manual' && sameLang(preferredLanguage, t.language)) ??
    tracks.find((t) => t.kind === 'asr' && sameLang(preferredLanguage, t.language)) ??
    tracks.find((t) => t.kind === 'manual' && sameLang(originalLanguage, t.language)) ??
    tracks.find((t) => t.kind === 'manual') ??
    tracks.find((t) => t.kind === 'asr') ??
    null
  )
}
```

- [ ] **Step 4:** Run: `bunx vitest run src/lib/youtube/__tests__/track-select.test.ts` → PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/youtube/
git commit -m "feat(youtube): 5-level caption track selection"
```

### Task B5: 并发信号量 + 每日配额 global-limits.ts

**Files:**
- Create: `src/lib/utils/global-limits.ts`
- Test: `src/lib/utils/__tests__/global-limits.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// src/lib/utils/__tests__/global-limits.test.ts
import { describe, expect, it } from 'vitest'
import { createDailyQuota, createSemaphore } from '~/lib/utils/global-limits'

describe('createSemaphore', () => {
  it('rejects acquisition beyond max and releases correctly', () => {
    const sem = createSemaphore(1)
    const release = sem.tryAcquire()
    expect(release).not.toBeNull()
    expect(sem.tryAcquire()).toBeNull() // 占满
    release?.()
    expect(sem.tryAcquire()).not.toBeNull() // 释放后可再取
  })
})

describe('createDailyQuota', () => {
  it('consumes up to max per UTC day then rejects', () => {
    const quota = createDailyQuota(2, () => '2026-06-10')
    expect(quota.tryConsume()).toBe(true)
    expect(quota.tryConsume()).toBe(true)
    expect(quota.tryConsume()).toBe(false)
  })

  it('resets when the UTC day changes', () => {
    let day = '2026-06-10'
    const quota = createDailyQuota(1, () => day)
    expect(quota.tryConsume()).toBe(true)
    expect(quota.tryConsume()).toBe(false)
    day = '2026-06-11'
    expect(quota.tryConsume()).toBe(true)
  })
})
```

- [ ] **Step 2:** Run: `bunx vitest run src/lib/utils/__tests__/global-limits.test.ts` → FAIL

- [ ] **Step 3: 实现**

```ts
// src/lib/utils/global-limits.ts
/**
 * 进程级全局防线（与 IP 无关）：
 * - 信号量：限制 yt-dlp+Whisper 这类重任务的并发，防容器被打满
 * - 每日配额：防多 IP 费用攻击（per-IP 限流挡不住的部分）
 * 单容器部署假设下进程内实现即可；多副本时需移到共享存储。
 */

export interface Semaphore {
  /** 返回 release 函数；占满时返回 null */
  tryAcquire(): (() => void) | null
}

export function createSemaphore(max: number): Semaphore {
  let inFlight = 0
  return {
    tryAcquire() {
      if (inFlight >= max) return null
      inFlight++
      let released = false
      return () => {
        if (!released) {
          released = true
          inFlight--
        }
      }
    },
  }
}

export interface DailyQuota {
  tryConsume(): boolean
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

export function createDailyQuota(maxPerDay: number, dayFn: () => string = todayUtc): DailyQuota {
  let day = dayFn()
  let used = 0
  return {
    tryConsume() {
      const now = dayFn()
      if (now !== day) {
        day = now
        used = 0
      }
      if (used >= maxPerDay) return false
      used++
      return true
    },
  }
}
```

- [ ] **Step 4:** Run: `bunx vitest run src/lib/utils/__tests__/global-limits.test.ts` → PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/global-limits.ts src/lib/utils/__tests__/global-limits.test.ts
git commit -m "feat(limits): process-level semaphore and UTC daily quota"
```

### Task B6: youtubei.js 包装 innertube.ts（错误分类）

**Files:**
- Create: `src/lib/youtube/innertube.ts`

> 此模块直接打真实 YouTube，不写单测（fixture 在 route 层 mock 本模块）；正确性由 Phase 0 spike 与手动验收覆盖。

- [ ] **Step 1: 实现**

```ts
// src/lib/youtube/innertube.ts
import { Innertube } from 'youtubei.js'
import { apiLogger } from '~/lib/utils/logger'
import type { CaptionTrackMeta } from '~/lib/youtube/track-select'
import type { MsCue } from '~/lib/youtube/normalize'

export type YouTubeErrorCode =
  | 'VIDEO_NOT_FOUND'
  | 'VIDEO_UNAVAILABLE'
  | 'LIVE_NOT_SUPPORTED'
  | 'NO_CAPTIONS'
  | 'YT_BLOCKED'
  | 'EXTRACTOR_FAILED'

export class YouTubeSourceError extends Error {
  constructor(
    public code: YouTubeErrorCode,
    message: string,
    public statusCode: number,
  ) {
    super(message)
    this.name = 'YouTubeSourceError'
  }
}

/** 把 youtubei.js 抛出的错误归类到我们的错误码。拿不准一律 EXTRACTOR_FAILED（可重试）。 */
export function classifyYouTubeError(error: unknown): YouTubeSourceError {
  if (error instanceof YouTubeSourceError) return error
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase()
  if (msg.includes('sign in') || msg.includes('log in') || msg.includes('login') || msg.includes('bot')) {
    return new YouTubeSourceError('YT_BLOCKED', '服务器被 YouTube 风控拦截', 502)
  }
  if (msg.includes('private') || msg.includes('age') || msg.includes('region') || msg.includes('unavailable')) {
    return new YouTubeSourceError('VIDEO_UNAVAILABLE', '视频不可用（私享/区域/年龄限制）', 403)
  }
  if (msg.includes('not found') || msg.includes('404') || msg.includes('deleted')) {
    return new YouTubeSourceError('VIDEO_NOT_FOUND', '视频不存在或已删除', 404)
  }
  return new YouTubeSourceError('EXTRACTOR_FAILED', `YouTube 数据抽取失败: ${msg.slice(0, 200)}`, 502)
}

let innertubePromise: Promise<Innertube> | null = null
function getClient(): Promise<Innertube> {
  if (!innertubePromise) {
    innertubePromise = Innertube.create()
  }
  return innertubePromise
}

export interface VideoMeta {
  videoId: string
  title: string
  channelName: string
  thumbnailUrl: string
  durationSec: number
  isLive: boolean
  captionTracks: CaptionTrackMeta[]
}

// biome-ignore lint/suspicious/noExplicitAny: youtubei.js 的响应类型在版本间漂移，按运行时形状读取
function mapCaptionTracks(info: any): CaptionTrackMeta[] {
  const tracks = info?.captions?.caption_tracks ?? []
  // biome-ignore lint/suspicious/noExplicitAny: 同上
  return tracks.map((t: any) => ({
    language: String(t.language_code ?? ''),
    kind: t.kind === 'asr' ? ('asr' as const) : ('manual' as const),
    displayName: String(t.name?.text ?? t.name ?? ''),
  }))
}

/** resolve 用：轻请求（player 响应），含 caption 轨元数据 */
export async function getVideoMeta(videoId: string): Promise<VideoMeta> {
  try {
    const yt = await getClient()
    const info = await yt.getBasicInfo(videoId)
    const basic = info.basic_info
    if (!basic?.id) {
      throw new YouTubeSourceError('VIDEO_NOT_FOUND', '视频不存在', 404)
    }
    return {
      videoId,
      title: basic.title ?? '',
      channelName: basic.channel?.name ?? '',
      thumbnailUrl: basic.thumbnail?.[0]?.url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      durationSec: basic.duration ?? 0,
      isLive: Boolean(basic.is_live),
      captionTracks: mapCaptionTracks(info),
    }
  } catch (error) {
    apiLogger.error('getVideoMeta failed:', { videoId, error: String(error) })
    throw classifyYouTubeError(error)
  }
}

/**
 * captions 用：完整 getInfo + transcript 面板（重请求）。
 * 禁止走 caption base_url（timedtext）直拉——服务端已被 POT token 封死。
 * displayName 来自 caption_tracks 决策（两步映射，见 track-select.ts）。
 */
export async function fetchTranscriptCues(videoId: string, displayName?: string): Promise<MsCue[]> {
  try {
    const yt = await getClient()
    const info = await yt.getInfo(videoId)
    let transcriptInfo = await info.getTranscript()
    if (
      displayName &&
      transcriptInfo.languages.includes(displayName) &&
      transcriptInfo.selectedLanguage !== displayName
    ) {
      transcriptInfo = await transcriptInfo.selectLanguage(displayName)
    }
    const segments = transcriptInfo.transcript?.content?.body?.initial_segments ?? []
    const cues: MsCue[] = []
    for (const seg of segments) {
      // transcript 面板可能混入 section header；只取带时间的文本段
      // biome-ignore lint/suspicious/noExplicitAny: 运行时形状
      const s = seg as any
      const text = s.snippet?.text ?? ''
      if (typeof s.start_ms !== 'undefined' && text.trim().length > 0) {
        cues.push({ startMs: Number(s.start_ms), endMs: Number(s.end_ms), text: text.trim() })
      }
    }
    if (cues.length === 0) {
      throw new YouTubeSourceError('NO_CAPTIONS', '该视频没有可用字幕', 404)
    }
    return cues
  } catch (error) {
    apiLogger.error('fetchTranscriptCues failed:', { videoId, error: String(error) })
    throw classifyYouTubeError(error)
  }
}
```

- [ ] **Step 2: 验证**

Run: `bun run type-check && bun run lint`
Expected: PASS。（可选本地真机验证：`bun -e "const {getVideoMeta}=await import('./src/lib/youtube/innertube.ts');console.log(await getVideoMeta('dQw4w9WgXcQ'))"`）

- [ ] **Step 3: Commit**

```bash
git add src/lib/youtube/innertube.ts
git commit -m "feat(youtube): youtubei.js wrapper with error classification (getInfo+getTranscript path)"
```

### Task B7: POST /api/youtube/resolve

**Files:**
- Create: `src/routes/api/youtube/resolve.ts`
- Test: `src/routes/api/youtube/__tests__/resolve.test.ts`
- Modify: `src/lib/utils/rate-limiter.ts`（一并加 3 个端点配置）

- [ ] **Step 1: rate-limiter 配置** — 在 `API_RATE_LIMIT_CONFIG` 的 `default` 之前插入：

```ts
  '/api/youtube/resolve': {
    windowMs: 10 * 60 * 1000,
    maxRequests: 20,
    message: '解析请求过于频繁，请稍后再试',
  },
  '/api/youtube/captions': {
    windowMs: 10 * 60 * 1000,
    maxRequests: 20,
    message: '字幕请求过于频繁，请稍后再试',
  },
  '/api/youtube/transcribe': {
    windowMs: 60 * 60 * 1000,
    maxRequests: 4,
    message: 'AI 转写额度有限，请稍后再试',
  },
```

- [ ] **Step 2: 写失败测试**

```ts
// src/routes/api/youtube/__tests__/resolve.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('~/lib/youtube/innertube', () => ({
  getVideoMeta: vi.fn(),
  YouTubeSourceError: class extends Error {
    constructor(public code: string, message: string, public statusCode: number) { super(message) }
  },
  classifyYouTubeError: vi.fn(),
}))

import { getVideoMeta } from '~/lib/youtube/innertube'
import { handleResolvePost } from '~/routes/api/youtube/resolve'

function post(body: unknown) {
  return new Request('http://localhost/api/youtube/resolve', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => vi.clearAllMocks())

describe('POST /api/youtube/resolve', () => {
  it('returns video meta for a valid URL', async () => {
    vi.mocked(getVideoMeta).mockResolvedValue({
      videoId: 'dQw4w9WgXcQ', title: 'T', channelName: 'C', thumbnailUrl: 'https://i.ytimg.com/x.jpg',
      durationSec: 212, isLive: false,
      captionTracks: [{ language: 'en', kind: 'manual', displayName: 'English' }],
    })
    const res = await handleResolvePost(post({ url: 'https://youtu.be/dQw4w9WgXcQ' }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.videoId).toBe('dQw4w9WgXcQ')
    expect(json.data.captionTracks).toHaveLength(1)
  })

  it('rejects an invalid URL with INVALID_URL', async () => {
    const res = await handleResolvePost(post({ url: 'https://example.com/watch?v=dQw4w9WgXcQ' }))
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error.code).toBe('INVALID_URL')
    expect(getVideoMeta).not.toHaveBeenCalled()
  })

  it('rejects live streams with LIVE_NOT_SUPPORTED', async () => {
    vi.mocked(getVideoMeta).mockResolvedValue({
      videoId: 'dQw4w9WgXcQ', title: 'live', channelName: 'C', thumbnailUrl: '',
      durationSec: 0, isLive: true, captionTracks: [],
    })
    const res = await handleResolvePost(post({ url: 'https://youtu.be/dQw4w9WgXcQ' }))
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe('LIVE_NOT_SUPPORTED')
  })
})
```

- [ ] **Step 3:** Run: `bunx vitest run src/routes/api/youtube/__tests__/resolve.test.ts` → FAIL

- [ ] **Step 4: 实现**（handler 主体导出为 `handleResolvePost` 便于测试，Route 仅挂接）

```ts
// src/routes/api/youtube/resolve.ts
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { apiError, apiSuccess } from '~/lib/utils/api-response'
import {
  checkRateLimit, getClientIdentifier, getRateLimitConfig, getRateLimitHeaders,
} from '~/lib/utils/rate-limiter'
import { getVideoMeta, YouTubeSourceError } from '~/lib/youtube/innertube'
import { extractVideoId } from '~/lib/youtube/url'

const bodySchema = z.object({ url: z.string().min(1).max(2048) })

export async function handleResolvePost(request: Request): Promise<Response> {
  const clientId = getClientIdentifier(request)
  const config = getRateLimitConfig('/api/youtube/resolve')
  const limit = checkRateLimit(`yt-resolve:${clientId}`, config)
  if (limit.limited) {
    return apiError({
      code: 'RATE_LIMITED', message: config.message ?? '请求过于频繁',
      details: { retryAfter: limit.retryAfter }, statusCode: 429,
      headers: getRateLimitHeaders(limit),
    })
  }

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return apiError({ code: 'INVALID_URL', message: '请求体无效', statusCode: 400 })
  }

  const videoId = extractVideoId(parsed.data.url)
  if (!videoId) {
    return apiError({ code: 'INVALID_URL', message: '无法识别的 YouTube 链接', statusCode: 400 })
  }

  try {
    const meta = await getVideoMeta(videoId)
    if (meta.isLive) {
      return apiError({ code: 'LIVE_NOT_SUPPORTED', message: '暂不支持直播内容', statusCode: 422 })
    }
    return apiSuccess(meta)
  } catch (error) {
    if (error instanceof YouTubeSourceError) {
      return apiError({ code: error.code, message: error.message, statusCode: error.statusCode })
    }
    return apiError({ code: 'EXTRACTOR_FAILED', message: 'YouTube 解析失败', statusCode: 502 })
  }
}

export const Route = createFileRoute('/api/youtube/resolve')({
  server: { handlers: { POST: async ({ request }) => handleResolvePost(request) } },
})
```

- [ ] **Step 5:** Run: `bunx vitest run src/routes/api/youtube/__tests__/resolve.test.ts && bun run type-check` → PASS

- [ ] **Step 6: Commit**

```bash
git add src/routes/api/youtube/ src/lib/utils/rate-limiter.ts
git commit -m "feat(api): POST /api/youtube/resolve + rate-limit configs for youtube endpoints"
```

### Task B8: POST /api/youtube/captions

**Files:**
- Create: `src/routes/api/youtube/captions.ts`
- Test: `src/routes/api/youtube/__tests__/captions.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// src/routes/api/youtube/__tests__/captions.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('~/lib/youtube/innertube', async (importOriginal) => {
  const orig = await importOriginal<typeof import('~/lib/youtube/innertube')>()
  return {
    ...orig,
    getVideoMeta: vi.fn(),
    fetchTranscriptCues: vi.fn(),
  }
})

import { fetchTranscriptCues, getVideoMeta, YouTubeSourceError } from '~/lib/youtube/innertube'
import { handleCaptionsPost } from '~/routes/api/youtube/captions'

function post(body: unknown) {
  return new Request('http://localhost/api/youtube/captions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.8' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => vi.clearAllMocks())

describe('POST /api/youtube/captions', () => {
  it('selects track, fetches transcript, returns merged second-based segments', async () => {
    vi.mocked(getVideoMeta).mockResolvedValue({
      videoId: 'dQw4w9WgXcQ', title: 't', channelName: 'c', thumbnailUrl: '', durationSec: 100,
      isLive: false,
      captionTracks: [
        { language: 'en', kind: 'manual', displayName: 'English' },
        { language: 'en', kind: 'asr', displayName: 'English (auto-generated)' },
      ],
    })
    vi.mocked(fetchTranscriptCues).mockResolvedValue([
      { startMs: 0, endMs: 800, text: 'I was' },
      { startMs: 800, endMs: 3000, text: 'told to make my bed.' },
    ])
    const res = await handleCaptionsPost(post({ videoId: 'dQw4w9WgXcQ', preferredLanguage: 'en' }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data.language).toBe('en')
    expect(json.data.kind).toBe('manual')
    expect(json.data.segments).toEqual([{ start: 0, end: 3, text: 'I was told to make my bed.' }])
    expect(fetchTranscriptCues).toHaveBeenCalledWith('dQw4w9WgXcQ', 'English')
  })

  it('returns NO_CAPTIONS 404 when no tracks exist', async () => {
    vi.mocked(getVideoMeta).mockResolvedValue({
      videoId: 'dQw4w9WgXcQ', title: 't', channelName: 'c', thumbnailUrl: '', durationSec: 100,
      isLive: false, captionTracks: [],
    })
    const res = await handleCaptionsPost(post({ videoId: 'dQw4w9WgXcQ' }))
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('NO_CAPTIONS')
  })

  it('rejects malformed videoId', async () => {
    const res = await handleCaptionsPost(post({ videoId: 'nope' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('INVALID_URL')
  })

  it('maps YouTubeSourceError through (e.g. YT_BLOCKED)', async () => {
    vi.mocked(getVideoMeta).mockRejectedValue(
      new YouTubeSourceError('YT_BLOCKED', 'blocked', 502),
    )
    const res = await handleCaptionsPost(post({ videoId: 'dQw4w9WgXcQ' }))
    expect(res.status).toBe(502)
    expect((await res.json()).error.code).toBe('YT_BLOCKED')
  })
})
```

- [ ] **Step 2:** Run: `bunx vitest run src/routes/api/youtube/__tests__/captions.test.ts` → FAIL

- [ ] **Step 3: 实现**

```ts
// src/routes/api/youtube/captions.ts
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { apiError, apiSuccess } from '~/lib/utils/api-response'
import {
  checkRateLimit, getClientIdentifier, getRateLimitConfig, getRateLimitHeaders,
} from '~/lib/utils/rate-limiter'
import { fetchTranscriptCues, getVideoMeta, YouTubeSourceError } from '~/lib/youtube/innertube'
import { mergeShortCues, msCuesToSeconds } from '~/lib/youtube/normalize'
import { selectCaptionTrack } from '~/lib/youtube/track-select'
import { isValidVideoId } from '~/lib/youtube/url'

const bodySchema = z.object({
  videoId: z.string(),
  preferredLanguage: z.string().optional(),
})

export async function handleCaptionsPost(request: Request): Promise<Response> {
  const clientId = getClientIdentifier(request)
  const config = getRateLimitConfig('/api/youtube/captions')
  const limit = checkRateLimit(`yt-captions:${clientId}`, config)
  if (limit.limited) {
    return apiError({
      code: 'RATE_LIMITED', message: config.message ?? '请求过于频繁',
      details: { retryAfter: limit.retryAfter }, statusCode: 429,
      headers: getRateLimitHeaders(limit),
    })
  }

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success || !isValidVideoId(parsed.data.videoId)) {
    return apiError({ code: 'INVALID_URL', message: '无效的 videoId', statusCode: 400 })
  }
  const { videoId, preferredLanguage } = parsed.data

  try {
    const meta = await getVideoMeta(videoId)
    const track = selectCaptionTrack(meta.captionTracks, { preferredLanguage })
    if (!track) {
      return apiError({ code: 'NO_CAPTIONS', message: '该视频没有可用字幕', statusCode: 404 })
    }
    const cues = await fetchTranscriptCues(videoId, track.displayName)
    const segments = mergeShortCues(msCuesToSeconds(cues))
    return apiSuccess({ language: track.language, kind: track.kind, segments })
  } catch (error) {
    if (error instanceof YouTubeSourceError) {
      return apiError({ code: error.code, message: error.message, statusCode: error.statusCode })
    }
    return apiError({ code: 'EXTRACTOR_FAILED', message: '字幕抓取失败', statusCode: 502 })
  }
}

export const Route = createFileRoute('/api/youtube/captions')({
  server: { handlers: { POST: async ({ request }) => handleCaptionsPost(request) } },
})
```

- [ ] **Step 4:** Run: `bunx vitest run src/routes/api/youtube/__tests__/captions.test.ts && bun run type-check` → PASS

- [ ] **Step 5: Commit**

```bash
git add src/routes/api/youtube/
git commit -m "feat(api): POST /api/youtube/captions — track selection + transcript fetch + cue merging"
```

### Task B9: yt-dlp 子进程 + POST /api/youtube/transcribe

**Files:**
- Create: `src/lib/youtube/ytdlp.ts`
- Create: `src/routes/api/youtube/transcribe.ts`
- Test: `src/routes/api/youtube/__tests__/transcribe.test.ts`

- [ ] **Step 1: 实现 ytdlp.ts**（子进程模块不做单测，route 层 mock 它）

```ts
// src/lib/youtube/ytdlp.ts
import { execFile } from 'node:child_process'
import { readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { apiLogger } from '~/lib/utils/logger'
import { isValidVideoId } from '~/lib/youtube/url'

const execFileAsync = promisify(execFile)

const MAX_FILESIZE = '25M' // Groq free tier 上限；dev tier 100M
const FORMAT = 'bestaudio[abr<=64]/worstaudio' // Whisper 不需要高码率；30min ≈ 11-16MB
const TIMEOUT_MS = 120_000

export async function isYtdlpAvailable(): Promise<boolean> {
  try {
    await execFileAsync('yt-dlp', ['--version'], { timeout: 10_000 })
    return true
  } catch {
    return false
  }
}

export class YtdlpError extends Error {
  constructor(
    public code: 'AUDIO_TOO_LARGE' | 'EXTRACTOR_FAILED' | 'YT_BLOCKED',
    message: string,
  ) {
    super(message)
    this.name = 'YtdlpError'
  }
}

/**
 * 下载低码率音频流并返回 File（供 Groq Whisper）。
 * videoId 必须先过 isValidVideoId（白名单字符集），execFile + '--' 双保险防注入。
 * --no-part 直写目标文件；finally 清理 tmp 前缀残留。
 */
export async function downloadAudio(videoId: string): Promise<File> {
  if (!isValidVideoId(videoId)) {
    throw new YtdlpError('EXTRACTOR_FAILED', `非法 videoId: ${videoId}`)
  }
  const tmpPath = join(tmpdir(), `yt-audio-${videoId}-${crypto.randomUUID()}.m4a`)
  try {
    await execFileAsync(
      'yt-dlp',
      ['-f', FORMAT, '--max-filesize', MAX_FILESIZE, '--no-part', '-o', tmpPath, '--', videoId],
      { timeout: TIMEOUT_MS },
    )
    const buf = await readFile(tmpPath)
    return new File([buf], `${videoId}.m4a`, { type: 'audio/mp4' })
  } catch (error) {
    const msg = (error instanceof Error ? error.message : String(error)).toLowerCase()
    apiLogger.error('yt-dlp failed:', { videoId, error: msg.slice(0, 300) })
    if (msg.includes('max-filesize') || msg.includes('file is larger')) {
      throw new YtdlpError('AUDIO_TOO_LARGE', '音频超过 25MB 上限')
    }
    if (msg.includes('sign in') || msg.includes('bot') || msg.includes('login')) {
      throw new YtdlpError('YT_BLOCKED', '服务器被 YouTube 风控拦截')
    }
    if (msg.includes('enoent')) {
      throw new YtdlpError('EXTRACTOR_FAILED', 'yt-dlp 不可用') // route 层转 EXTRACTOR_UNAVAILABLE
    }
    throw new YtdlpError('EXTRACTOR_FAILED', `音频下载失败: ${msg.slice(0, 200)}`)
  } finally {
    await rm(tmpPath, { force: true }).catch(() => {})
  }
}
```

- [ ] **Step 2: 写失败测试**

```ts
// src/routes/api/youtube/__tests__/transcribe.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('~/lib/youtube/innertube', async (importOriginal) => {
  const orig = await importOriginal<typeof import('~/lib/youtube/innertube')>()
  return { ...orig, getVideoMeta: vi.fn() }
})
vi.mock('~/lib/youtube/ytdlp', async (importOriginal) => {
  const orig = await importOriginal<typeof import('~/lib/youtube/ytdlp')>()
  return { ...orig, downloadAudio: vi.fn(), isYtdlpAvailable: vi.fn().mockResolvedValue(true) }
})
vi.mock('~/lib/ai/groq-whisper', () => ({
  processTranscription: vi.fn(),
}))

import { processTranscription } from '~/lib/ai/groq-whisper'
import { getVideoMeta } from '~/lib/youtube/innertube'
import { downloadAudio } from '~/lib/youtube/ytdlp'
import { handleYoutubeTranscribePost } from '~/routes/api/youtube/transcribe'

function post(body: unknown, ip = '203.0.113.9') {
  return new Request('http://localhost/api/youtube/transcribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

const meta = (durationSec: number) => ({
  videoId: 'dQw4w9WgXcQ', title: 't', channelName: 'c', thumbnailUrl: '',
  durationSec, isLive: false, captionTracks: [],
})

beforeEach(() => vi.clearAllMocks())

describe('POST /api/youtube/transcribe', () => {
  it('rejects videos longer than 30 minutes before downloading', async () => {
    vi.mocked(getVideoMeta).mockResolvedValue(meta(31 * 60))
    const res = await handleYoutubeTranscribePost(post({ videoId: 'dQw4w9WgXcQ' }))
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe('VIDEO_TOO_LONG')
    expect(downloadAudio).not.toHaveBeenCalled()
  })

  it('downloads, transcribes and returns segments', async () => {
    vi.mocked(getVideoMeta).mockResolvedValue(meta(60))
    vi.mocked(downloadAudio).mockResolvedValue(new File(['x'], 'a.m4a', { type: 'audio/mp4' }))
    vi.mocked(processTranscription).mockResolvedValue({
      success: true,
      data: { text: 'hi', language: 'en', duration: 60,
        segments: [{ id: 1, start: 0, end: 2, text: 'hi' }] },
    })
    const res = await handleYoutubeTranscribePost(post({ videoId: 'dQw4w9WgXcQ', language: 'en' }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data.segments).toHaveLength(1)
  })
})
```

- [ ] **Step 3:** Run: `bunx vitest run src/routes/api/youtube/__tests__/transcribe.test.ts` → FAIL

- [ ] **Step 4: 实现 route**

```ts
// src/routes/api/youtube/transcribe.ts
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { processTranscription } from '~/lib/ai/groq-whisper'
import { apiError, apiSuccess } from '~/lib/utils/api-response'
import { createDailyQuota, createSemaphore } from '~/lib/utils/global-limits'
import {
  checkRateLimit, getClientIdentifier, getRateLimitConfig, getRateLimitHeaders,
} from '~/lib/utils/rate-limiter'
import { getVideoMeta, YouTubeSourceError } from '~/lib/youtube/innertube'
import { isValidVideoId } from '~/lib/youtube/url'
import { downloadAudio, isYtdlpAvailable, YtdlpError } from '~/lib/youtube/ytdlp'

const MAX_DURATION_SEC = 30 * 60
const transcribeSemaphore = createSemaphore(1) // 同时最多 1 个 yt-dlp+Whisper 任务
const transcribeDailyQuota = createDailyQuota(24) // 每日全局 24 次（UTC 日界）

const bodySchema = z.object({
  videoId: z.string(),
  language: z.string().optional().default('auto'),
})

export async function handleYoutubeTranscribePost(request: Request): Promise<Response> {
  const clientId = getClientIdentifier(request)
  const config = getRateLimitConfig('/api/youtube/transcribe')
  const limit = checkRateLimit(`yt-transcribe:${clientId}`, config)
  if (limit.limited) {
    return apiError({
      code: 'RATE_LIMITED', message: config.message ?? '请求过于频繁',
      details: { retryAfter: limit.retryAfter }, statusCode: 429,
      headers: getRateLimitHeaders(limit),
    })
  }

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success || !isValidVideoId(parsed.data.videoId)) {
    return apiError({ code: 'INVALID_URL', message: '无效的 videoId', statusCode: 400 })
  }
  const { videoId, language } = parsed.data

  if (!(await isYtdlpAvailable())) {
    return apiError({
      code: 'EXTRACTOR_UNAVAILABLE',
      message: '服务器未安装 yt-dlp，无法转写无字幕视频',
      statusCode: 501,
    })
  }
  if (!transcribeDailyQuota.tryConsume()) {
    return apiError({
      code: 'QUOTA_EXHAUSTED', message: '今日 AI 转写额度已用完，请明天再试或选择有字幕的视频',
      statusCode: 429,
    })
  }
  const release = transcribeSemaphore.tryAcquire()
  if (!release) {
    return apiError({
      code: 'SERVER_BUSY', message: '已有转写任务进行中，请稍后再试', statusCode: 429,
    })
  }

  try {
    const meta = await getVideoMeta(videoId)
    if (meta.durationSec > MAX_DURATION_SEC) {
      return apiError({
        code: 'VIDEO_TOO_LONG',
        message: '无字幕视频暂只支持 30 分钟以内', statusCode: 422,
      })
    }
    const audioFile = await downloadAudio(videoId)
    const result = await processTranscription(audioFile, language)
    if (!result.success) {
      return result.error
    }
    return apiSuccess({
      status: 'completed',
      text: result.data.text,
      language: result.data.language ?? language,
      duration: result.data.duration,
      segments: result.data.segments,
    })
  } catch (error) {
    if (error instanceof YouTubeSourceError) {
      return apiError({ code: error.code, message: error.message, statusCode: error.statusCode })
    }
    if (error instanceof YtdlpError) {
      const statusCode = error.code === 'AUDIO_TOO_LARGE' ? 422 : 502
      return apiError({ code: error.code, message: error.message, statusCode })
    }
    return apiError({ code: 'EXTRACTOR_FAILED', message: '转写失败', statusCode: 502 })
  } finally {
    release()
  }
}

export const Route = createFileRoute('/api/youtube/transcribe')({
  server: { handlers: { POST: async ({ request }) => handleYoutubeTranscribePost(request) } },
})
```

- [ ] **Step 5:** Run: `bunx vitest run src/routes/api/youtube && bun run type-check` → PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/youtube/ytdlp.ts src/routes/api/youtube/
git commit -m "feat(api): POST /api/youtube/transcribe — yt-dlp low-bitrate + Whisper, semaphore + daily quota"
```

### Task B10: CSP 放行 YouTube

**Files:**
- Modify: `src/lib/security/csp-nonce.ts`
- Test: `src/lib/security/__tests__/csp-nonce.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// src/lib/security/__tests__/csp-nonce.test.ts
import { describe, expect, it } from 'vitest'
import { buildContentSecurityPolicy } from '~/lib/security/csp-nonce'

describe('CSP for YouTube embedding', () => {
  const csp = buildContentSecurityPolicy('testnonce')
  it('allows YouTube iframes', () => {
    expect(csp).toContain('frame-src https://www.youtube.com https://www.youtube-nocookie.com')
  })
  it('allows iframe_api scripts from youtube.com', () => {
    expect(csp).toMatch(/script-src[^;]*https:\/\/www\.youtube\.com/)
  })
  it('keeps frame-ancestors none (we embed others, nobody embeds us)', () => {
    expect(csp).toContain("frame-ancestors 'none'")
  })
})
```

- [ ] **Step 2:** Run: `bunx vitest run src/lib/security` → FAIL

- [ ] **Step 3: 实现** — `buildContentSecurityPolicy` 改为：

```ts
export function buildContentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development'
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-inline' 'nonce-${nonce}' https://www.clarity.ms https://www.youtube.com`
    : `script-src 'self' 'nonce-${nonce}' https://www.clarity.ms https://www.youtube.com`

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' blob: data: https:",
    "media-src 'self' blob:",
    "connect-src 'self' https://api.groq.com https://www.clarity.ms",
    // YouTube IFrame Player（嵌入 host 用 nocookie，iframe_api/widgetapi 脚本来自 www.youtube.com）
    'frame-src https://www.youtube.com https://www.youtube-nocookie.com',
    "frame-ancestors 'none'",
  ].join('; ')
}
```

- [ ] **Step 4:** Run: `bunx vitest run src/lib/security && bun run type-check` → PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/security/
git commit -m "feat(security): CSP frame-src/script-src for YouTube IFrame Player"
```

**Phase B 完成标志：** `bun run lint && bun run type-check && bun run test:run` 全绿；`bun run dev` 下用 curl 真机验证三个端点（带字幕视频、无字幕视频、非法 URL 各一次）。

---

# Phase C — 客户端：适配器、管线与 UI

### Task C1: MediaSourceAdapter 接口 + AudioFileAdapter

**Files:**
- Create: `src/components/features/player/sources/types.ts`
- Create: `src/components/features/player/sources/AudioFileAdapter.ts`
- Test: `src/components/features/player/sources/__tests__/AudioFileAdapter.test.ts`

- [ ] **Step 1: 接口与事件基类**

```ts
// src/components/features/player/sources/types.ts
export type AdapterEvent = 'ready' | 'play' | 'pause' | 'ended' | 'timeupdate' | 'error'

export interface MediaSourceAdapter {
  mount(container: HTMLElement): Promise<void>
  destroy(): void
  play(): Promise<void>
  pause(): void
  seekTo(seconds: number): void
  setPlaybackRate(rate: number): void
  getAvailablePlaybackRates(): number[]
  setVolume(volume: number): void // 0-1
  getCurrentTime(): number
  getDuration(): number
  on(event: AdapterEvent, cb: (payload?: unknown) => void): () => void
}

/** 极简事件分发基类，两个 adapter 共用 */
export class AdapterEmitter {
  private listeners = new Map<AdapterEvent, Set<(payload?: unknown) => void>>()

  on(event: AdapterEvent, cb: (payload?: unknown) => void): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)?.add(cb)
    return () => this.listeners.get(event)?.delete(cb)
  }

  protected emit(event: AdapterEvent, payload?: unknown): void {
    for (const cb of this.listeners.get(event) ?? []) cb(payload)
  }

  protected clearListeners(): void {
    this.listeners.clear()
  }
}
```

- [ ] **Step 2: 写失败测试**

```ts
// src/components/features/player/sources/__tests__/AudioFileAdapter.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioFileAdapter } from '~/components/features/player/sources/AudioFileAdapter'
import type { MediaRow } from '~/types/db/database'

const media: MediaRow = {
  id: 1, kind: 'audio', title: 'a.mp3', durationSec: 60,
  addedAt: new Date(), updatedAt: new Date(), blob: new Blob(['x'], { type: 'audio/mpeg' }),
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})

describe('AudioFileAdapter', () => {
  it('mounts an <audio> with an object URL and revokes it on destroy', async () => {
    const adapter = new AudioFileAdapter(media)
    const container = document.createElement('div')
    await adapter.mount(container)
    const audio = container.querySelector('audio')
    expect(audio?.src).toContain('blob:mock-url')
    adapter.destroy()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
    expect(container.querySelector('audio')).toBeNull()
  })

  it('forwards native events as adapter events', async () => {
    const adapter = new AudioFileAdapter(media)
    const container = document.createElement('div')
    await adapter.mount(container)
    const audio = container.querySelector('audio') as HTMLAudioElement
    const onPlay = vi.fn()
    const onTime = vi.fn()
    adapter.on('play', onPlay)
    adapter.on('timeupdate', onTime)
    audio.dispatchEvent(new Event('play'))
    audio.dispatchEvent(new Event('timeupdate'))
    expect(onPlay).toHaveBeenCalled()
    expect(onTime).toHaveBeenCalled()
  })

  it('throws when media has no blob', async () => {
    const broken = { ...media, blob: undefined }
    const adapter = new AudioFileAdapter(broken)
    await expect(adapter.mount(document.createElement('div'))).rejects.toThrow()
  })
})
```

- [ ] **Step 3:** Run: `bunx vitest run src/components/features/player/sources` → FAIL

- [ ] **Step 4: 实现**

```ts
// src/components/features/player/sources/AudioFileAdapter.ts
import type { MediaRow } from '~/types/db/database'
import { AdapterEmitter, type MediaSourceAdapter } from './types'

const AUDIO_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

/**
 * 本地音频适配器。objectURL 的创建/撤销在此内聚（原 usePlayerDataQuery 的职责）。
 * currentTime 单向流出（timeupdate），seek 只经 seekTo() —— 不存在旧 PlayerPage
 * 的「state 回写 audio.currentTime 防反馈循环」问题。
 */
export class AudioFileAdapter extends AdapterEmitter implements MediaSourceAdapter {
  private audio: HTMLAudioElement | null = null
  private objectUrl: string | null = null
  private detach: (() => void) | null = null

  constructor(private media: MediaRow) {
    super()
  }

  async mount(container: HTMLElement): Promise<void> {
    if (!this.media.blob) {
      throw new Error('Audio media has no blob')
    }
    const audio = document.createElement('audio')
    audio.preload = 'auto'
    this.objectUrl = URL.createObjectURL(this.media.blob)
    audio.src = this.objectUrl
    container.appendChild(audio)
    this.audio = audio

    const onTime = () => this.emit('timeupdate', audio.currentTime)
    const onPlay = () => this.emit('play')
    const onPause = () => this.emit('pause')
    const onEnded = () => this.emit('ended')
    const onError = () => this.emit('error', audio.error)
    const onLoaded = () => this.emit('ready')
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    audio.addEventListener('loadedmetadata', onLoaded)
    this.detach = () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      audio.removeEventListener('loadedmetadata', onLoaded)
    }
  }

  destroy(): void {
    this.detach?.()
    this.audio?.pause()
    this.audio?.remove()
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl)
      this.objectUrl = null
    }
    this.audio = null
    this.clearListeners()
  }

  async play(): Promise<void> {
    await this.audio?.play()
  }

  pause(): void {
    this.audio?.pause()
  }

  seekTo(seconds: number): void {
    if (this.audio) this.audio.currentTime = seconds
  }

  setPlaybackRate(rate: number): void {
    if (this.audio) this.audio.playbackRate = rate
  }

  getAvailablePlaybackRates(): number[] {
    return AUDIO_RATES
  }

  setVolume(volume: number): void {
    if (this.audio) this.audio.volume = volume
  }

  getCurrentTime(): number {
    return this.audio?.currentTime ?? 0
  }

  getDuration(): number {
    const d = this.audio?.duration
    return Number.isFinite(d) ? (d as number) : (this.media.durationSec ?? 0)
  }
}
```

- [ ] **Step 5:** Run: `bunx vitest run src/components/features/player/sources && bun run type-check` → PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/features/player/sources/
git commit -m "feat(player): MediaSourceAdapter interface + AudioFileAdapter"
```

### Task C2: iframe-loader + YouTubeAdapter

**Files:**
- Create: `src/components/features/player/sources/iframe-loader.ts`
- Create: `src/components/features/player/sources/YouTubeAdapter.ts`
- Test: `src/components/features/player/sources/__tests__/YouTubeAdapter.test.ts`

- [ ] **Step 1: iframe-loader（单例脚本加载 + 最小 ambient 类型）**

```ts
// src/components/features/player/sources/iframe-loader.ts
/** YouTube IFrame Player API 的最小类型（不引第三方 @types，按官方文档手写） */
export interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  setPlaybackRate(rate: number): void
  getAvailablePlaybackRates(): number[]
  setVolume(volume: number): void // 0-100
  getCurrentTime(): number
  getDuration(): number
  destroy(): void
}

export interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string
      host?: string
      playerVars?: Record<string, number | string>
      events?: {
        onReady?: () => void
        onStateChange?: (e: { data: number }) => void
        onError?: (e: { data: number }) => void
      }
    },
  ) => YTPlayer
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number }
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<YTNamespace> | null = null

/** 全局只注入一次 iframe_api 脚本；处理 onYouTubeIframeAPIReady 回调竞态 */
export function loadYouTubeIframeApi(): Promise<YTNamespace> {
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT)
      return
    }
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      if (window.YT) resolve(window.YT)
      else reject(new Error('YT namespace missing after API ready'))
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => {
      apiPromise = null
      reject(new Error('Failed to load YouTube iframe API'))
    }
    document.head.appendChild(script)
  })
  return apiPromise
}

/** 仅供测试重置单例 */
export function resetIframeApiForTest(): void {
  apiPromise = null
}
```

- [ ] **Step 2: 写失败测试**

```ts
// src/components/features/player/sources/__tests__/YouTubeAdapter.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetIframeApiForTest } from '~/components/features/player/sources/iframe-loader'
import { YouTubeAdapter } from '~/components/features/player/sources/YouTubeAdapter'
import type { MediaRow } from '~/types/db/database'

const media: MediaRow = {
  id: 2, kind: 'youtube', title: 'v', durationSec: 212,
  addedAt: new Date(), updatedAt: new Date(), externalId: 'dQw4w9WgXcQ',
}

type StateCb = (e: { data: number }) => void
let stateCb: StateCb | undefined
let errorCb: StateCb | undefined
const playerMock = {
  playVideo: vi.fn(), pauseVideo: vi.fn(), seekTo: vi.fn(), setPlaybackRate: vi.fn(),
  getAvailablePlaybackRates: vi.fn().mockReturnValue([0.5, 1, 1.5]),
  setVolume: vi.fn(), getCurrentTime: vi.fn().mockReturnValue(7),
  getDuration: vi.fn().mockReturnValue(212), destroy: vi.fn(),
}

beforeEach(() => {
  vi.useFakeTimers()
  resetIframeApiForTest()
  window.YT = {
    PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0, BUFFERING: 3 },
    Player: vi.fn().mockImplementation((_el, opts) => {
      stateCb = opts.events?.onStateChange
      errorCb = opts.events?.onError
      queueMicrotask(() => opts.events?.onReady?.())
      return playerMock
    }),
  } as unknown as typeof window.YT
})

afterEach(() => {
  vi.useRealTimers()
  window.YT = undefined
})

describe('YouTubeAdapter', () => {
  async function mountAdapter() {
    const adapter = new YouTubeAdapter(media)
    await adapter.mount(document.createElement('div'))
    return adapter
  }

  it('maps PLAYING/PAUSED/ENDED state changes to adapter events', async () => {
    const adapter = await mountAdapter()
    const onPlay = vi.fn(); const onPause = vi.fn(); const onEnded = vi.fn()
    adapter.on('play', onPlay); adapter.on('pause', onPause); adapter.on('ended', onEnded)
    stateCb?.({ data: 1 }); stateCb?.({ data: 2 }); stateCb?.({ data: 0 })
    expect(onPlay).toHaveBeenCalled()
    expect(onPause).toHaveBeenCalled()
    expect(onEnded).toHaveBeenCalled()
  })

  it('polls timeupdate at 250ms only while playing', async () => {
    const adapter = await mountAdapter()
    const onTime = vi.fn()
    adapter.on('timeupdate', onTime)
    vi.advanceTimersByTime(1000)
    expect(onTime).not.toHaveBeenCalled() // 未播放不轮询
    stateCb?.({ data: 1 }) // PLAYING
    vi.advanceTimersByTime(1000)
    expect(onTime.mock.calls.length).toBeGreaterThanOrEqual(3)
    stateCb?.({ data: 2 }) // PAUSED
    onTime.mockClear()
    vi.advanceTimersByTime(1000)
    expect(onTime).not.toHaveBeenCalled()
  })

  it('maps embed-blocked error codes 101/150 to EMBED_BLOCKED', async () => {
    const adapter = await mountAdapter()
    const onError = vi.fn()
    adapter.on('error', onError)
    errorCb?.({ data: 101 })
    expect(onError).toHaveBeenCalledWith({ code: 'EMBED_BLOCKED' })
  })

  it('destroy clears polling and the player', async () => {
    const adapter = await mountAdapter()
    stateCb?.({ data: 1 })
    adapter.destroy()
    expect(playerMock.destroy).toHaveBeenCalled()
    const onTime = vi.fn()
    adapter.on('timeupdate', onTime)
    vi.advanceTimersByTime(1000)
    expect(onTime).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3:** Run: `bunx vitest run src/components/features/player/sources/__tests__/YouTubeAdapter.test.ts` → FAIL

- [ ] **Step 4: 实现**

```ts
// src/components/features/player/sources/YouTubeAdapter.ts
import type { MediaRow } from '~/types/db/database'
import { loadYouTubeIframeApi, type YTPlayer } from './iframe-loader'
import { AdapterEmitter, type MediaSourceAdapter } from './types'

const POLL_MS = 250 // 归一 ~4Hz，与 <audio> 原生 timeupdate 节奏一致

export class YouTubeAdapter extends AdapterEmitter implements MediaSourceAdapter {
  private player: YTPlayer | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private destroyed = false

  constructor(private media: MediaRow) {
    super()
  }

  async mount(container: HTMLElement): Promise<void> {
    if (!this.media.externalId) {
      throw new Error('YouTube media has no externalId')
    }
    const YT = await loadYouTubeIframeApi()
    if (this.destroyed) return
    await new Promise<void>((resolve) => {
      this.player = new YT.Player(container, {
        videoId: this.media.externalId as string,
        host: 'https://www.youtube-nocookie.com',
        // controls:0 隐藏自带控制条（操作全走我们的 WatchControls）；modestbranding 已废弃不写
        playerVars: { controls: 0, rel: 0, playsinline: 1 },
        events: {
          onReady: () => {
            this.emit('ready')
            resolve()
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PLAYING) {
              this.startPolling()
              this.emit('play')
            } else if (e.data === YT.PlayerState.PAUSED) {
              this.stopPolling()
              this.emit('pause')
            } else if (e.data === YT.PlayerState.ENDED) {
              this.stopPolling()
              this.emit('ended')
            }
            // BUFFERING 不外发：上层不需要区分
          },
          onError: (e) => {
            // 101/150 = 禁止嵌入（resolve 阶段查不出，播放页兜底「在 YouTube 打开」）
            if (e.data === 101 || e.data === 150) {
              this.emit('error', { code: 'EMBED_BLOCKED' })
            } else {
              this.emit('error', { code: 'PLAYBACK_ERROR', raw: e.data })
            }
          },
        },
      })
    })
  }

  private startPolling(): void {
    if (this.pollTimer) return
    this.pollTimer = setInterval(() => {
      this.emit('timeupdate', this.player?.getCurrentTime() ?? 0)
    }, POLL_MS)
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  destroy(): void {
    this.destroyed = true
    this.stopPolling()
    this.player?.destroy()
    this.player = null
    this.clearListeners()
  }

  async play(): Promise<void> {
    this.player?.playVideo()
  }

  pause(): void {
    this.player?.pauseVideo()
  }

  seekTo(seconds: number): void {
    this.player?.seekTo(seconds, true)
  }

  setPlaybackRate(rate: number): void {
    this.player?.setPlaybackRate(rate)
  }

  getAvailablePlaybackRates(): number[] {
    return this.player?.getAvailablePlaybackRates() ?? [1]
  }

  setVolume(volume: number): void {
    this.player?.setVolume(Math.round(volume * 100))
  }

  getCurrentTime(): number {
    return this.player?.getCurrentTime() ?? 0
  }

  getDuration(): number {
    const d = this.player?.getDuration()
    return d && d > 0 ? d : (this.media.durationSec ?? 0)
  }
}
```

- [ ] **Step 5:** Run: `bunx vitest run src/components/features/player/sources && bun run type-check` → PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/features/player/sources/
git commit -m "feat(player): YouTubeAdapter via IFrame API — 250ms polling, state mapping, embed-blocked handling"
```

### Task C3: 工厂 + usePlayerAdapter

**Files:**
- Create: `src/components/features/player/sources/factory.ts`
- Create: `src/hooks/player/usePlayerAdapter.ts`

- [ ] **Step 1: 工厂**

```ts
// src/components/features/player/sources/factory.ts
import type { MediaRow } from '~/types/db/database'
import { AudioFileAdapter } from './AudioFileAdapter'
import type { MediaSourceAdapter } from './types'
import { YouTubeAdapter } from './YouTubeAdapter'

export function createAdapter(media: MediaRow): MediaSourceAdapter {
  return media.kind === 'youtube' ? new YouTubeAdapter(media) : new AudioFileAdapter(media)
}
```

- [ ] **Step 2: usePlayerAdapter**

```ts
// src/hooks/player/usePlayerAdapter.ts
import { useCallback, useEffect, useRef, useState } from 'react'
import { createAdapter } from '~/components/features/player/sources/factory'
import type { MediaSourceAdapter } from '~/components/features/player/sources/types'
import type { MediaRow } from '~/types/db/database'

export interface PlayerAdapterState {
  isReady: boolean
  isPlaying: boolean
  currentTime: number
  duration: number
  availableRates: number[]
  embedBlocked: boolean
}

export function usePlayerAdapter(media: MediaRow | null) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const adapterRef = useRef<MediaSourceAdapter | null>(null)
  const [state, setState] = useState<PlayerAdapterState>({
    isReady: false, isPlaying: false, currentTime: 0,
    duration: media?.durationSec ?? 0, availableRates: [1], embedBlocked: false,
  })

  // biome-ignore lint/correctness/useExhaustiveDependencies: media.id 变化才重建 adapter
  useEffect(() => {
    const container = containerRef.current
    if (!media || !container) return

    const adapter = createAdapter(media)
    adapterRef.current = adapter
    const offs = [
      adapter.on('ready', () =>
        setState((s) => ({
          ...s, isReady: true,
          duration: adapter.getDuration(),
          availableRates: adapter.getAvailablePlaybackRates(),
        })),
      ),
      adapter.on('play', () => setState((s) => ({ ...s, isPlaying: true }))),
      adapter.on('pause', () => setState((s) => ({ ...s, isPlaying: false }))),
      adapter.on('ended', () => setState((s) => ({ ...s, isPlaying: false }))),
      adapter.on('timeupdate', (t) =>
        setState((s) => ({ ...s, currentTime: typeof t === 'number' ? t : adapter.getCurrentTime() })),
      ),
      adapter.on('error', (payload) => {
        if ((payload as { code?: string })?.code === 'EMBED_BLOCKED') {
          setState((s) => ({ ...s, embedBlocked: true }))
        }
      }),
    ]
    adapter.mount(container).catch(() => {
      // mount 失败（如 blob 缺失）由上层错误态兜底
    })

    return () => {
      for (const off of offs) off()
      adapter.destroy()
      adapterRef.current = null
      setState((s) => ({ ...s, isReady: false, isPlaying: false, currentTime: 0 }))
    }
  }, [media?.id])

  const play = useCallback(() => void adapterRef.current?.play(), [])
  const pause = useCallback(() => adapterRef.current?.pause(), [])
  const seekTo = useCallback((sec: number) => {
    adapterRef.current?.seekTo(sec)
    setState((s) => ({ ...s, currentTime: sec })) // 立即反馈，下一次 timeupdate 校正
  }, [])
  const setRate = useCallback((r: number) => adapterRef.current?.setPlaybackRate(r), [])
  const setVolume = useCallback((v: number) => adapterRef.current?.setVolume(v), [])

  return { containerRef, ...state, play, pause, seekTo, setRate, setVolume }
}
```

- [ ] **Step 3: 验证 + Commit**

Run: `bun run type-check && bun run lint` → PASS

```bash
git add src/components/features/player/sources/factory.ts src/hooks/player/usePlayerAdapter.ts
git commit -m "feat(player): adapter factory + usePlayerAdapter hook"
```

### Task C4: useSegmentNavigation + useSegmentLoop

**Files:**
- Create: `src/hooks/player/useSegmentNavigation.ts`
- Create: `src/hooks/player/useSegmentLoop.ts`
- Test: `src/hooks/player/__tests__/segment-hooks.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// src/hooks/player/__tests__/segment-hooks.test.ts
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSegmentLoop } from '~/hooks/player/useSegmentLoop'
import { useSegmentNavigation } from '~/hooks/player/useSegmentNavigation'

const segs = [
  { start: 0, end: 2 }, { start: 2, end: 5 }, { start: 6, end: 9 },
]

describe('useSegmentNavigation', () => {
  it('activeIndex follows currentTime (gap snaps to nearest)', () => {
    const { result, rerender } = renderHook(
      ({ t }) => useSegmentNavigation(segs, t, vi.fn()),
      { initialProps: { t: 3 } },
    )
    expect(result.current.activeIndex).toBe(1)
    rerender({ t: 5.4 }) // 段间空隙 → 就近（5.4 距 5 比距 6 近 → index 1）
    expect(result.current.activeIndex).toBe(1)
  })

  it('goNext / goPrev seek to adjacent segment start', () => {
    const seekTo = vi.fn()
    const { result } = renderHook(() => useSegmentNavigation(segs, 3, seekTo))
    act(() => result.current.goNext())
    expect(seekTo).toHaveBeenCalledWith(6)
    act(() => result.current.goPrev())
    expect(seekTo).toHaveBeenCalledWith(0)
  })

  it('clamps at boundaries', () => {
    const seekTo = vi.fn()
    const { result } = renderHook(() => useSegmentNavigation(segs, 8, seekTo))
    act(() => result.current.goNext()) // 已是最后一段 → 不动
    expect(seekTo).not.toHaveBeenCalled()
  })
})

describe('useSegmentLoop', () => {
  it('when enabled, seeks back to the locked segment start as time passes its end', () => {
    const seekTo = vi.fn()
    const { result, rerender } = renderHook(
      ({ t }) => useSegmentLoop(segs, t, seekTo),
      { initialProps: { t: 3 } },
    )
    act(() => result.current.toggleLoop()) // 锁定 index 1 (2-5)
    expect(result.current.isLooping).toBe(true)
    rerender({ t: 5.1 }) // 越过 end
    expect(seekTo).toHaveBeenCalledWith(2)
  })

  it('disabled by toggle again; no seeking', () => {
    const seekTo = vi.fn()
    const { result, rerender } = renderHook(
      ({ t }) => useSegmentLoop(segs, t, seekTo),
      { initialProps: { t: 3 } },
    )
    act(() => result.current.toggleLoop())
    act(() => result.current.toggleLoop())
    expect(result.current.isLooping).toBe(false)
    rerender({ t: 5.1 })
    expect(seekTo).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2:** Run: `bunx vitest run src/hooks/player/__tests__/segment-hooks.test.ts` → FAIL

- [ ] **Step 3: 实现**

```ts
// src/hooks/player/useSegmentNavigation.ts
import { useCallback, useMemo } from 'react'
import { findActiveSegmentIndex } from '~/lib/player/active-segment'

interface SegmentLike {
  start: number
  end: number
}

/** 媒体无关的句级导航：activeIndex 复用 active-segment.ts 的二分（含空隙就近归属） */
export function useSegmentNavigation(
  segments: SegmentLike[],
  currentTime: number,
  seekTo: (seconds: number) => void,
) {
  const activeIndex = useMemo(
    () => findActiveSegmentIndex(segments, currentTime),
    [segments, currentTime],
  )

  const goPrev = useCallback(() => {
    if (activeIndex > 0) seekTo(segments[activeIndex - 1].start)
  }, [activeIndex, segments, seekTo])

  const goNext = useCallback(() => {
    if (activeIndex >= 0 && activeIndex < segments.length - 1) {
      seekTo(segments[activeIndex + 1].start)
    }
  }, [activeIndex, segments, seekTo])

  return { activeIndex, goPrev, goNext }
}
```

```ts
// src/hooks/player/useSegmentLoop.ts
import { useCallback, useEffect, useRef, useState } from 'react'
import { findActiveSegmentIndex } from '~/lib/player/active-segment'

interface SegmentLike {
  start: number
  end: number
}

/**
 * 单句循环：开启时锁定当前段，currentTime 越过段尾即跳回段首。
 * 4Hz tick 下 YouTube 最多越界 ~250ms（spec 已接受）。
 */
export function useSegmentLoop(
  segments: SegmentLike[],
  currentTime: number,
  seekTo: (seconds: number) => void,
) {
  const [isLooping, setIsLooping] = useState(false)
  const lockedRef = useRef<SegmentLike | null>(null)

  const toggleLoop = useCallback(() => {
    setIsLooping((prev) => {
      if (prev) {
        lockedRef.current = null
        return false
      }
      const idx = findActiveSegmentIndex(segments, currentTime)
      if (idx < 0) return false
      lockedRef.current = segments[idx]
      return true
    })
  }, [segments, currentTime])

  useEffect(() => {
    const locked = lockedRef.current
    if (!isLooping || !locked) return
    if (currentTime >= locked.end || currentTime < locked.start - 0.5) {
      seekTo(locked.start)
    }
  }, [isLooping, currentTime, seekTo])

  return { isLooping, toggleLoop }
}
```

- [ ] **Step 4:** Run: `bunx vitest run src/hooks/player && bun run type-check` → PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/player/
git commit -m "feat(player): media-agnostic sentence navigation and single-sentence loop hooks"
```

### Task C5: 分片翻译编排器 chunk-postprocess.ts

**Files:**
- Create: `src/lib/subtitles/chunk-postprocess.ts`
- Test: `src/lib/subtitles/__tests__/chunk-postprocess.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// src/lib/subtitles/__tests__/chunk-postprocess.test.ts
import { describe, expect, it, vi } from 'vitest'
import {
  chunkSegmentsForPostProcess, runChunkedPostProcess,
} from '~/lib/subtitles/chunk-postprocess'

const seg = (i: number, text: string) => ({ segmentIndex: i, start: i, end: i + 1, text })

describe('chunkSegmentsForPostProcess', () => {
  it('splits by 100-segment limit', () => {
    const segs = Array.from({ length: 250 }, (_, i) => seg(i, 'a'))
    const chunks = chunkSegmentsForPostProcess(segs)
    expect(chunks.map((c) => c.length)).toEqual([100, 100, 50])
  })

  it('splits by 10000-char total limit', () => {
    const segs = Array.from({ length: 12 }, (_, i) => seg(i, 'x'.repeat(1000)))
    const chunks = chunkSegmentsForPostProcess(segs)
    expect(chunks.map((c) => c.length)).toEqual([10, 2])
  })

  it('keeps global segmentIndex values inside chunks', () => {
    const segs = Array.from({ length: 150 }, (_, i) => seg(i, 'a'))
    const chunks = chunkSegmentsForPostProcess(segs)
    expect(chunks[1][0].segmentIndex).toBe(100)
  })
})

describe('runChunkedPostProcess', () => {
  it('posts chunks sequentially and reports each chunk result', async () => {
    const segs = Array.from({ length: 150 }, (_, i) => seg(i, 'hello'))
    const calls: number[] = []
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      calls.push(body.segments.length)
      return new Response(
        JSON.stringify({
          success: true,
          data: { segments: body.segments.map((s: { segmentIndex: number }) => ({
            segmentIndex: s.segmentIndex, translation: `t${s.segmentIndex}`,
          })) },
        }),
        { status: 200 },
      )
    })
    const onChunkDone = vi.fn()
    const result = await runChunkedPostProcess({
      segments: segs, language: 'en', targetLanguage: 'zh-CN', enableFurigana: false,
      fetchImpl, onChunkDone,
    })
    expect(calls).toEqual([100, 50])
    expect(onChunkDone).toHaveBeenCalledTimes(2)
    expect(result.completedChunks).toBe(2)
    expect(result.failed).toBe(false)
  })

  it('stops at first failed chunk and reports failure with resume point', async () => {
    const segs = Array.from({ length: 150 }, (_, i) => seg(i, 'hello'))
    let n = 0
    const fetchImpl = vi.fn(async () => {
      n++
      return n === 1
        ? new Response(JSON.stringify({ success: true, data: { segments: [] } }), { status: 200 })
        : new Response('{}', { status: 500 })
    })
    const result = await runChunkedPostProcess({
      segments: segs, language: 'en', targetLanguage: 'zh-CN', enableFurigana: false,
      fetchImpl, onChunkDone: vi.fn(),
    })
    expect(result.failed).toBe(true)
    expect(result.completedChunks).toBe(1)
  })
})
```

- [ ] **Step 2:** Run: `bunx vitest run src/lib/subtitles` → FAIL

- [ ] **Step 3: 实现**

```ts
// src/lib/subtitles/chunk-postprocess.ts
/**
 * 客户端分片翻译编排。
 * 服务端 /api/postprocess 硬限制：≤100 段、总文本 ≤10000 字符、单段 ≤2000 字符，
 * 单请求一次性返回——所以分片、串行（天然满足其 20 次/分钟限流）、逐片回写都在客户端做。
 */

export interface ChunkSegment {
  segmentIndex: number // 全局 index，跨片保持，回写靠它
  start: number
  end: number
  text: string
}

export interface ProcessedSegment {
  segmentIndex: number
  normalizedText?: string
  translation?: string
  annotations?: string[]
  furigana?: string
}

const MAX_SEGMENTS_PER_CHUNK = 100
const MAX_CHARS_PER_CHUNK = 10_000

export function chunkSegmentsForPostProcess(segments: ChunkSegment[]): ChunkSegment[][] {
  const chunks: ChunkSegment[][] = []
  let current: ChunkSegment[] = []
  let chars = 0
  for (const s of segments) {
    const len = s.text.length
    if (current.length >= MAX_SEGMENTS_PER_CHUNK || (current.length > 0 && chars + len > MAX_CHARS_PER_CHUNK)) {
      chunks.push(current)
      current = []
      chars = 0
    }
    current.push(s)
    chars += len
  }
  if (current.length > 0) chunks.push(current)
  return chunks
}

export interface RunChunkedOptions {
  segments: ChunkSegment[]
  language: string
  targetLanguage: string
  enableFurigana: boolean
  /** 每片成功后回调（调用方负责写库 + invalidate 查询，实现逐片上屏） */
  onChunkDone: (processed: ProcessedSegment[], chunkIndex: number, totalChunks: number) => Promise<void> | void
  /** 断点续传：跳过前 N 片（已完成片数） */
  startAtChunk?: number
  fetchImpl?: typeof fetch
}

export interface RunChunkedResult {
  completedChunks: number
  totalChunks: number
  failed: boolean
  error?: string
}

export async function runChunkedPostProcess(opts: RunChunkedOptions): Promise<RunChunkedResult> {
  const { segments, language, targetLanguage, enableFurigana, onChunkDone } = opts
  const fetchImpl = opts.fetchImpl ?? fetch
  const chunks = chunkSegmentsForPostProcess(segments)
  let completed = opts.startAtChunk ?? 0

  for (let i = completed; i < chunks.length; i++) {
    try {
      const response = await fetchImpl('/api/postprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments: chunks[i],
          language,
          targetLanguage,
          enableAnnotations: true,
          enableFurigana,
        }),
      })
      if (!response.ok) {
        return { completedChunks: completed, totalChunks: chunks.length, failed: true,
          error: `postprocess HTTP ${response.status}` }
      }
      const json = await response.json()
      if (!json.success || !json.data?.segments) {
        return { completedChunks: completed, totalChunks: chunks.length, failed: true,
          error: 'postprocess invalid response' }
      }
      await onChunkDone(json.data.segments as ProcessedSegment[], i, chunks.length)
      completed = i + 1
    } catch (error) {
      return { completedChunks: completed, totalChunks: chunks.length, failed: true,
        error: error instanceof Error ? error.message : String(error) }
    }
  }
  return { completedChunks: completed, totalChunks: chunks.length, failed: false }
}
```

- [ ] **Step 4:** Run: `bunx vitest run src/lib/subtitles && bun run type-check` → PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/subtitles/
git commit -m "feat(subtitles): client-side chunked postprocess orchestrator (100seg/10k-char limits, sequential, resumable)"
```

### Task C6: i18n 文案 + 错误码消息映射

**Files:**
- Modify: `src/lib/i18n/translations.ts`
- Create: `src/lib/youtube/error-messages.ts`

- [ ] **Step 1: 在 `TranslationKey` 接口追加 key**（'Common' 区块之前）：

```ts
  // Library
  'library.title': string
  'library.add': string
  'library.search.placeholder': string
  'library.empty.title': string
  'library.empty.cta': string
  'library.deleteConfirm': string

  // Import dialog
  'import.tab.youtube': string
  'import.tab.upload': string
  'import.url.placeholder': string
  'import.submit': string
  'import.resolving': string
  'import.saving': string
  'import.error.INVALID_URL': string
  'import.error.VIDEO_NOT_FOUND': string
  'import.error.VIDEO_UNAVAILABLE': string
  'import.error.LIVE_NOT_SUPPORTED': string
  'import.error.VIDEO_TOO_LONG': string
  'import.error.AUDIO_TOO_LARGE': string
  'import.error.YT_BLOCKED': string
  'import.error.EXTRACTOR_UNAVAILABLE': string
  'import.error.EXTRACTOR_FAILED': string
  'import.error.QUOTA_EXHAUSTED': string
  'import.error.SERVER_BUSY': string
  'import.error.RATE_LIMITED': string

  // Watch page
  'watch.subtitleCount': string
  'watch.regenerate': string
  'watch.regenerateConfirm': string
  'watch.openOnYouTube': string
  'watch.embedBlocked': string
  'watch.notFound': string
  'watch.stage.captions': string
  'watch.stage.transcribing': string
  'watch.stage.translating': string
  'watch.retryPipeline': string
  'watch.prevSentence': string
  'watch.nextSentence': string
  'watch.loopSentence': string
```

- [ ] **Step 2: 四个 locale（zh-CN / zh-TW / en-US / ja-JP）各自补全**。zh-CN 与 en-US 全文如下，zh-TW 按 zh-CN 转繁体，ja-JP 按 en-US 译日文（实施者照抄下表，不留空）：

```ts
  // zh-CN
  'library.title': '资料库',
  'library.add': '添加',
  'library.search.placeholder': '搜索已导入的内容',
  'library.empty.title': '还没有学习内容',
  'library.empty.cta': '粘贴一个 YouTube 链接开始学习',
  'library.deleteConfirm': '删除这个内容及其字幕？',
  'import.tab.youtube': 'YouTube 链接',
  'import.tab.upload': '上传音频',
  'import.url.placeholder': '粘贴 YouTube 视频链接…',
  'import.submit': '导入',
  'import.resolving': '获取视频信息…',
  'import.saving': '保存中…',
  'import.error.INVALID_URL': '无法识别的 YouTube 链接，请检查格式',
  'import.error.VIDEO_NOT_FOUND': '视频不存在或已删除',
  'import.error.VIDEO_UNAVAILABLE': '视频不可用（私享、区域或年龄限制）',
  'import.error.LIVE_NOT_SUPPORTED': '暂不支持直播内容，请等存档后再导入',
  'import.error.VIDEO_TOO_LONG': '无字幕视频暂只支持 30 分钟以内',
  'import.error.AUDIO_TOO_LARGE': '音频超过大小上限，暂无法转写',
  'import.error.YT_BLOCKED': '服务器暂时无法访问 YouTube，请稍后再试',
  'import.error.EXTRACTOR_UNAVAILABLE': '服务器未配置转写组件，暂只支持有字幕的视频',
  'import.error.EXTRACTOR_FAILED': 'YouTube 数据获取失败，请稍后重试',
  'import.error.QUOTA_EXHAUSTED': '今日 AI 转写额度已用完，请明天再试',
  'import.error.SERVER_BUSY': '已有转写任务进行中，请稍后再试',
  'import.error.RATE_LIMITED': '请求过于频繁，请稍后再试',
  'watch.subtitleCount': '字幕',
  'watch.regenerate': '重新生成字幕',
  'watch.regenerateConfirm': '重新转写将消耗 AI 额度，确定继续？',
  'watch.openOnYouTube': '在 YouTube 打开',
  'watch.embedBlocked': '该视频不允许嵌入播放',
  'watch.notFound': '内容不存在，可能已被删除',
  'watch.stage.captions': '获取字幕中…',
  'watch.stage.transcribing': 'AI 转写中…',
  'watch.stage.translating': '翻译中（{done}/{total}）',
  'watch.retryPipeline': '重试',
  'watch.prevSentence': '上一句',
  'watch.nextSentence': '下一句',
  'watch.loopSentence': '单句循环',
```

```ts
  // en-US
  'library.title': 'Library',
  'library.add': 'Add',
  'library.search.placeholder': 'Search imported content',
  'library.empty.title': 'Nothing to learn yet',
  'library.empty.cta': 'Paste a YouTube link to start learning',
  'library.deleteConfirm': 'Delete this item and its subtitles?',
  'import.tab.youtube': 'YouTube link',
  'import.tab.upload': 'Upload audio',
  'import.url.placeholder': 'Paste a YouTube video link…',
  'import.submit': 'Import',
  'import.resolving': 'Fetching video info…',
  'import.saving': 'Saving…',
  'import.error.INVALID_URL': 'Unrecognized YouTube link — please check the format',
  'import.error.VIDEO_NOT_FOUND': 'Video not found or deleted',
  'import.error.VIDEO_UNAVAILABLE': 'Video unavailable (private, region or age restricted)',
  'import.error.LIVE_NOT_SUPPORTED': 'Live streams are not supported yet',
  'import.error.VIDEO_TOO_LONG': 'Videos without captions are limited to 30 minutes',
  'import.error.AUDIO_TOO_LARGE': 'Audio exceeds the size limit for transcription',
  'import.error.YT_BLOCKED': 'The server cannot reach YouTube right now — try again later',
  'import.error.EXTRACTOR_UNAVAILABLE': 'Transcription unavailable on this server; only captioned videos are supported',
  'import.error.EXTRACTOR_FAILED': 'Failed to fetch YouTube data — please retry',
  'import.error.QUOTA_EXHAUSTED': 'Daily AI transcription quota reached — try tomorrow',
  'import.error.SERVER_BUSY': 'Another transcription is running — try again shortly',
  'import.error.RATE_LIMITED': 'Too many requests — please slow down',
  'watch.subtitleCount': 'Subtitles',
  'watch.regenerate': 'Regenerate subtitles',
  'watch.regenerateConfirm': 'Re-transcribing consumes AI quota. Continue?',
  'watch.openOnYouTube': 'Open on YouTube',
  'watch.embedBlocked': 'This video does not allow embedded playback',
  'watch.notFound': 'Content not found — it may have been deleted',
  'watch.stage.captions': 'Fetching captions…',
  'watch.stage.transcribing': 'AI transcribing…',
  'watch.stage.translating': 'Translating ({done}/{total})',
  'watch.retryPipeline': 'Retry',
  'watch.prevSentence': 'Previous sentence',
  'watch.nextSentence': 'Next sentence',
  'watch.loopSentence': 'Loop sentence',
```

```ts
  // zh-TW
  'library.title': '資料庫',
  'library.add': '新增',
  'library.search.placeholder': '搜尋已匯入的內容',
  'library.empty.title': '還沒有學習內容',
  'library.empty.cta': '貼上一個 YouTube 連結開始學習',
  'library.deleteConfirm': '刪除這個內容及其字幕？',
  'import.tab.youtube': 'YouTube 連結',
  'import.tab.upload': '上傳音訊',
  'import.url.placeholder': '貼上 YouTube 影片連結…',
  'import.submit': '匯入',
  'import.resolving': '取得影片資訊…',
  'import.saving': '儲存中…',
  'import.error.INVALID_URL': '無法識別的 YouTube 連結，請檢查格式',
  'import.error.VIDEO_NOT_FOUND': '影片不存在或已刪除',
  'import.error.VIDEO_UNAVAILABLE': '影片不可用（私人、區域或年齡限制）',
  'import.error.LIVE_NOT_SUPPORTED': '暫不支援直播內容，請等存檔後再匯入',
  'import.error.VIDEO_TOO_LONG': '無字幕影片暫只支援 30 分鐘以內',
  'import.error.AUDIO_TOO_LARGE': '音訊超過大小上限，暫無法轉寫',
  'import.error.YT_BLOCKED': '伺服器暫時無法存取 YouTube，請稍後再試',
  'import.error.EXTRACTOR_UNAVAILABLE': '伺服器未設定轉寫元件，暫只支援有字幕的影片',
  'import.error.EXTRACTOR_FAILED': 'YouTube 資料取得失敗，請稍後重試',
  'import.error.QUOTA_EXHAUSTED': '今日 AI 轉寫額度已用完，請明天再試',
  'import.error.SERVER_BUSY': '已有轉寫任務進行中，請稍後再試',
  'import.error.RATE_LIMITED': '請求過於頻繁，請稍後再試',
  'watch.subtitleCount': '字幕',
  'watch.regenerate': '重新產生字幕',
  'watch.regenerateConfirm': '重新轉寫將消耗 AI 額度，確定繼續？',
  'watch.openOnYouTube': '在 YouTube 開啟',
  'watch.embedBlocked': '該影片不允許嵌入播放',
  'watch.notFound': '內容不存在，可能已被刪除',
  'watch.stage.captions': '取得字幕中…',
  'watch.stage.transcribing': 'AI 轉寫中…',
  'watch.stage.translating': '翻譯中（{done}/{total}）',
  'watch.retryPipeline': '重試',
  'watch.prevSentence': '上一句',
  'watch.nextSentence': '下一句',
  'watch.loopSentence': '單句循環',
```

```ts
  // ja-JP
  'library.title': 'ライブラリ',
  'library.add': '追加',
  'library.search.placeholder': 'インポート済みコンテンツを検索',
  'library.empty.title': 'まだ学習コンテンツがありません',
  'library.empty.cta': 'YouTube リンクを貼り付けて学習を始める',
  'library.deleteConfirm': 'このコンテンツと字幕を削除しますか？',
  'import.tab.youtube': 'YouTube リンク',
  'import.tab.upload': '音声をアップロード',
  'import.url.placeholder': 'YouTube 動画のリンクを貼り付け…',
  'import.submit': 'インポート',
  'import.resolving': '動画情報を取得中…',
  'import.saving': '保存中…',
  'import.error.INVALID_URL': 'YouTube リンクを認識できません。形式を確認してください',
  'import.error.VIDEO_NOT_FOUND': '動画が存在しないか削除されています',
  'import.error.VIDEO_UNAVAILABLE': '動画を利用できません（非公開・地域・年齢制限）',
  'import.error.LIVE_NOT_SUPPORTED': 'ライブ配信は未対応です。アーカイブ後にお試しください',
  'import.error.VIDEO_TOO_LONG': '字幕なし動画は 30 分以内のみ対応しています',
  'import.error.AUDIO_TOO_LARGE': '音声がサイズ上限を超えているため転写できません',
  'import.error.YT_BLOCKED': 'サーバーが YouTube にアクセスできません。後でもう一度お試しください',
  'import.error.EXTRACTOR_UNAVAILABLE': 'サーバーに転写コンポーネントがなく、字幕付き動画のみ対応しています',
  'import.error.EXTRACTOR_FAILED': 'YouTube データの取得に失敗しました。後で再試行してください',
  'import.error.QUOTA_EXHAUSTED': '本日の AI 転写枠を使い切りました。明日お試しください',
  'import.error.SERVER_BUSY': '別の転写タスクが実行中です。しばらくしてからお試しください',
  'import.error.RATE_LIMITED': 'リクエストが多すぎます。しばらくお待ちください',
  'watch.subtitleCount': '字幕',
  'watch.regenerate': '字幕を再生成',
  'watch.regenerateConfirm': '再転写は AI 枠を消費します。続行しますか？',
  'watch.openOnYouTube': 'YouTube で開く',
  'watch.embedBlocked': 'この動画は埋め込み再生を許可していません',
  'watch.notFound': 'コンテンツが見つかりません。削除された可能性があります',
  'watch.stage.captions': '字幕を取得中…',
  'watch.stage.transcribing': 'AI 転写中…',
  'watch.stage.translating': '翻訳中（{done}/{total}）',
  'watch.retryPipeline': '再試行',
  'watch.prevSentence': '前の文',
  'watch.nextSentence': '次の文',
  'watch.loopSentence': '一文リピート',
```

四个 locale 全部给齐；**TranslationKey 接口保证缺 key 会被 type-check 抓住**。

- [ ] **Step 3: 错误码 → i18n key 映射**

```ts
// src/lib/youtube/error-messages.ts
const KNOWN_CODES = new Set([
  'INVALID_URL', 'VIDEO_NOT_FOUND', 'VIDEO_UNAVAILABLE', 'LIVE_NOT_SUPPORTED',
  'VIDEO_TOO_LONG', 'AUDIO_TOO_LARGE', 'YT_BLOCKED', 'EXTRACTOR_UNAVAILABLE',
  'EXTRACTOR_FAILED', 'QUOTA_EXHAUSTED', 'SERVER_BUSY', 'RATE_LIMITED',
])

export function youtubeErrorMessageKey(code: string | undefined): string {
  return code && KNOWN_CODES.has(code) ? `import.error.${code}` : 'import.error.EXTRACTOR_FAILED'
}
```

- [ ] **Step 4: 验证 + Commit**

Run: `bun run type-check`（缺任何 locale 的 key 都会在此失败）
Expected: PASS

```bash
git add src/lib/i18n/translations.ts src/lib/youtube/error-messages.ts
git commit -m "feat(i18n): library/import/watch strings in 4 locales + youtube error message mapping"
```

### Task C7: useMediaImport + MediaImportDialog

**Files:**
- Create: `src/hooks/media/useMediaImport.ts`
- Create: `src/components/features/library/MediaImportDialog.tsx`
- Test: `src/hooks/media/__tests__/useMediaImport.test.tsx`

- [ ] **Step 1: 写失败测试**

```ts
// src/hooks/media/__tests__/useMediaImport.test.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMediaImport } from '~/hooks/media/useMediaImport'
import { db, DBUtils } from '~/lib/db/db'

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const META = {
  videoId: 'dQw4w9WgXcQ', title: 'T', channelName: 'C',
  thumbnailUrl: 'https://i.ytimg.com/x.jpg', durationSec: 212, isLive: false, captionTracks: [],
}

beforeEach(async () => {
  await db.segments.clear(); await db.subtitles.clear(); await db.media.clear()
  vi.restoreAllMocks()
})

describe('useMediaImport', () => {
  it('resolve → save → returns new mediaId', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: META }), { status: 200 }),
    )
    const { result } = renderHook(() => useMediaImport(), { wrapper })
    let mediaId = 0
    await act(async () => {
      mediaId = await result.current.importYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')
    })
    const media = await DBUtils.getMedia(mediaId)
    expect(media).toMatchObject({ kind: 'youtube', externalId: 'dQw4w9WgXcQ', title: 'T' })
  })

  it('duplicate import returns the existing mediaId without a second row', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: META }), { status: 200 }),
    )
    const { result } = renderHook(() => useMediaImport(), { wrapper })
    let first = 0; let second = 0
    await act(async () => { first = await result.current.importYouTubeUrl('https://youtu.be/dQw4w9WgXcQ') })
    await act(async () => { second = await result.current.importYouTubeUrl('https://youtu.be/dQw4w9WgXcQ') })
    expect(second).toBe(first)
    expect(await db.media.count()).toBe(1)
  })

  it('surfaces the server error code on failure', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: { code: 'VIDEO_UNAVAILABLE', message: 'x' } }),
        { status: 403 }),
    )
    const { result } = renderHook(() => useMediaImport(), { wrapper })
    await act(async () => {
      await expect(result.current.importYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).rejects.toMatchObject({
        code: 'VIDEO_UNAVAILABLE',
      })
    })
    await waitFor(() => expect(result.current.stage).toBe('idle'))
  })
})
```

- [ ] **Step 2:** Run: `bunx vitest run src/hooks/media` → FAIL

- [ ] **Step 3: 实现 hook**

```ts
// src/hooks/media/useMediaImport.ts
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { filesKeys } from '~/hooks/db/useFiles'
import { DBUtils } from '~/lib/db/db'

export type ImportStage = 'idle' | 'resolving' | 'saving'

export class ImportError extends Error {
  constructor(public code: string, message: string) {
    super(message)
    this.name = 'ImportError'
  }
}

interface ResolveData {
  videoId: string
  title: string
  channelName: string
  thumbnailUrl: string
  durationSec: number
}

/**
 * 导入编排（弹窗职责仅到写库为止）：resolve → 去重 → addMedia → 返回 mediaId。
 * 字幕抓取/转写/翻译由 watch 页的 useSubtitlePipeline 自驱动（auto-trigger 契约）。
 */
export function useMediaImport() {
  const [stage, setStage] = useState<ImportStage>('idle')
  const queryClient = useQueryClient()

  const importYouTubeUrl = useCallback(
    async (url: string): Promise<number> => {
      setStage('resolving')
      try {
        const response = await fetch('/api/youtube/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        })
        const json = await response.json().catch(() => null)
        if (!response.ok || !json?.success) {
          throw new ImportError(json?.error?.code ?? 'EXTRACTOR_FAILED', json?.error?.message ?? 'resolve failed')
        }
        const data = json.data as ResolveData

        setStage('saving')
        const existing = await DBUtils.findMediaByExternalId(data.videoId)
        if (existing?.id) return existing.id

        const now = new Date()
        try {
          const id = await DBUtils.addMedia({
            kind: 'youtube', title: data.title, durationSec: data.durationSec,
            addedAt: now, updatedAt: now,
            externalId: data.videoId, channelName: data.channelName,
            thumbnailUrl: data.thumbnailUrl, sourceUrl: url,
          })
          queryClient.invalidateQueries({ queryKey: filesKeys.all })
          return id
        } catch (error) {
          // &externalId 唯一索引兜底并发导入：撞约束 → 取已有行
          if (error instanceof Error && error.name === 'ConstraintError') {
            const winner = await DBUtils.findMediaByExternalId(data.videoId)
            if (winner?.id) return winner.id
          }
          // DBUtils 会把 Dexie 错误包装成 AppError；按 message 兜底识别
          if (error instanceof Error && error.message.includes('Constraint')) {
            const winner = await DBUtils.findMediaByExternalId(data.videoId)
            if (winner?.id) return winner.id
          }
          throw error
        }
      } finally {
        setStage('idle')
      }
    },
    [queryClient],
  )

  return { stage, importYouTubeUrl }
}
```

- [ ] **Step 4: MediaImportDialog**（两个 Tab：YouTube 链接 / 上传音频。上传 Tab 直接复用现有 `FileUpload` + `useFiles().addFiles`）

```tsx
// src/components/features/library/MediaImportDialog.tsx
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import FileUpload from '~/components/features/file/FileUpload'
import { useTranslation } from '~/components/layout/contexts/I18nContext'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { useFiles } from '~/hooks/db/useFiles'
import { ImportError, useMediaImport } from '~/hooks/media/useMediaImport'
import { youtubeErrorMessageKey } from '~/lib/youtube/error-messages'

interface MediaImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MediaImportDialog({ open, onOpenChange }: MediaImportDialogProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const { stage, importYouTubeUrl } = useMediaImport()
  const { addFiles, files } = useFiles()
  const [uploading, setUploading] = useState(false)

  const busy = stage !== 'idle'

  const handleImport = async () => {
    if (!url.trim() || busy) return
    try {
      const mediaId = await importYouTubeUrl(url.trim())
      onOpenChange(false)
      setUrl('')
      navigate({ to: '/watch/$mediaId', params: { mediaId: String(mediaId) } })
    } catch (error) {
      const code = error instanceof ImportError ? error.code : undefined
      toast.error(t(youtubeErrorMessageKey(code)))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('library.add')}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="youtube">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="youtube">{t('import.tab.youtube')}</TabsTrigger>
            <TabsTrigger value="upload">{t('import.tab.upload')}</TabsTrigger>
          </TabsList>
          <TabsContent value="youtube" className="flex flex-col gap-3 pt-4">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('import.url.placeholder')}
              onKeyDown={(e) => e.key === 'Enter' && handleImport()}
              disabled={busy}
            />
            <Button onClick={handleImport} disabled={busy || !url.trim()}>
              {stage === 'resolving'
                ? t('import.resolving')
                : stage === 'saving'
                  ? t('import.saving')
                  : t('import.submit')}
            </Button>
          </TabsContent>
          <TabsContent value="upload" className="pt-4">
            <FileUpload
              onFilesSelected={async (selected) => {
                setUploading(true)
                try {
                  await addFiles(selected)
                  onOpenChange(false)
                } finally {
                  setUploading(false)
                }
              }}
              isUploading={uploading}
              currentFileCount={files.length}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
```

注：`FileUpload` 的实际 props 名以 [FileUpload.tsx](../../../src/components/features/file/FileUpload.tsx) `interface FileUploadProps`（:8-16）为准——实现时打开该文件核对 `onFilesSelected/isUploading/currentFileCount` 三个名字，不一致则按真实名字接。

- [ ] **Step 5:** Run: `bunx vitest run src/hooks/media && bun run type-check` → PASS

- [ ] **Step 6: Commit**

```bash
git add src/hooks/media/ src/components/features/library/
git commit -m "feat(library): useMediaImport hook + import dialog (YouTube tab + upload tab)"
```

### Task C8: useSubtitlePipeline（watch 页自驱动管线）

**Files:**
- Create: `src/hooks/media/useSubtitlePipeline.ts`

- [ ] **Step 1: 实现**（状态全部落库，重进可恢复；audio 复用现有 useFileStatusManager 自动转写契约）

```ts
// src/hooks/media/useSubtitlePipeline.ts
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranscriptionLanguage } from '~/components/layout/contexts/TranscriptionLanguageContext'
import { useFileStatusManager } from '~/hooks/useFileStatus'
import { db, DBUtils } from '~/lib/db/db'
import {
  runChunkedPostProcess, type ProcessedSegment,
} from '~/lib/subtitles/chunk-postprocess'
import { transcriptionLogger } from '~/lib/utils/logger'
import type { MediaRow, Segment } from '~/types/db/database'

export const subtitleKeys = {
  all: ['subtitle'] as const,
  forMedia: (mediaId: number) => [...subtitleKeys.all, 'media', mediaId] as const,
}

export type PipelineStage =
  | 'idle' | 'fetching-captions' | 'transcribing' | 'translating' | 'done' | 'failed'

interface TranslateProgress {
  done: number
  total: number
}

function baseLang(code: string): string {
  return code.toLowerCase().split('-')[0]
}

async function writeSegments(
  subtitleId: number,
  rows: Array<{ start: number; end: number; text: string }>,
): Promise<void> {
  const now = new Date()
  await db.segments.bulkAdd(
    rows.map((r, index) => ({
      transcriptId: subtitleId, segmentIndex: index,
      start: r.start, end: r.end, text: r.text, createdAt: now, updatedAt: now,
    })),
  )
}

async function writeChunkResults(
  subtitleId: number,
  processed: ProcessedSegment[],
  source: 'official' | 'whisper',
): Promise<void> {
  for (const p of processed) {
    await db.segments
      .where('transcriptId').equals(subtitleId)
      .and((s: Segment) => s.segmentIndex === p.segmentIndex)
      .modify(
        source === 'official'
          ? { translation: p.translation, furigana: p.furigana } // official 只取翻译，防 LLM 改写原文
          : {
              normalizedText: p.normalizedText, translation: p.translation,
              annotations: p.annotations, furigana: p.furigana,
            },
      )
  }
}

export function useSubtitlePipeline(media: MediaRow | null) {
  const queryClient = useQueryClient()
  const { learningLanguage } = useTranscriptionLanguage()
  const targetLanguage = learningLanguage.nativeLanguage
  const mediaId = media?.id ?? 0
  const { startTranscription } = useFileStatusManager(media?.kind === 'audio' ? mediaId : 0)

  const [stage, setStage] = useState<PipelineStage>('idle')
  const [translateProgress, setTranslateProgress] = useState<TranslateProgress | null>(null)
  const runningRef = useRef(false)

  const query = useQuery({
    queryKey: subtitleKeys.forMedia(mediaId),
    enabled: mediaId > 0,
    queryFn: async () => {
      const subtitle = await DBUtils.findSubtitleByMediaId(mediaId)
      const segments = subtitle?.id
        ? await DBUtils.getSegmentsByTranscriptIdOrdered(subtitle.id)
        : []
      return { subtitle: subtitle ?? null, segments }
    },
    staleTime: 1000 * 30,
  })

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: subtitleKeys.forMedia(mediaId) })
  }, [queryClient, mediaId])

  const runTranslate = useCallback(
    async (subtitleId: number, source: 'official' | 'whisper', sourceLanguage: string) => {
      if (baseLang(sourceLanguage) === baseLang(targetLanguage)) {
        await DBUtils.update(db.subtitles, subtitleId, {
          postProcessStatus: 'completed' as const, targetLanguage: null, updatedAt: new Date(),
        })
        invalidate()
        return
      }
      setStage('translating')
      const segments = await DBUtils.getSegmentsByTranscriptIdOrdered(subtitleId)
      const result = await runChunkedPostProcess({
        segments: segments.map((s) => ({
          segmentIndex: s.segmentIndex ?? 0, start: s.start, end: s.end, text: s.text,
        })),
        language: sourceLanguage,
        targetLanguage,
        enableFurigana: baseLang(sourceLanguage) === 'ja',
        onChunkDone: async (processed, i, total) => {
          await writeChunkResults(subtitleId, processed, source)
          setTranslateProgress({ done: i + 1, total })
          invalidate() // 逐片上屏
        },
      })
      await DBUtils.update(db.subtitles, subtitleId, {
        postProcessStatus: result.failed ? ('failed' as const) : ('completed' as const),
        postProcessError: result.error,
        targetLanguage,
        updatedAt: new Date(),
      })
      invalidate()
      setStage(result.failed ? 'failed' : 'done')
    },
    [targetLanguage, invalidate],
  )

  const runYouTubePipeline = useCallback(async () => {
    if (!media?.externalId || runningRef.current) return
    runningRef.current = true
    try {
      setStage('fetching-captions')
      const res = await fetch('/api/youtube/captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: media.externalId }),
      })
      const json = await res.json().catch(() => null)

      if (res.ok && json?.success) {
        const { language, segments } = json.data as {
          language: string; segments: Array<{ start: number; end: number; text: string }>
        }
        const subtitleId = await DBUtils.addSubtitle({
          mediaId, source: 'official', status: 'completed', sourceLanguage: language,
          targetLanguage: null, postProcessStatus: 'pending',
          createdAt: new Date(), updatedAt: new Date(),
        })
        await writeSegments(subtitleId, segments)
        invalidate()
        await runTranslate(subtitleId, 'official', language)
        return
      }

      if (json?.error?.code === 'NO_CAPTIONS') {
        setStage('transcribing')
        const tRes = await fetch('/api/youtube/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: media.externalId }),
        })
        const tJson = await tRes.json().catch(() => null)
        if (!tRes.ok || !tJson?.success) {
          const code = tJson?.error?.code ?? 'EXTRACTOR_FAILED'
          await DBUtils.addSubtitle({
            mediaId, source: 'whisper', status: 'failed', sourceLanguage: 'auto',
            targetLanguage: null, error: code, createdAt: new Date(), updatedAt: new Date(),
          })
          invalidate()
          setStage('failed')
          return
        }
        const { language, segments, text } = tJson.data as {
          language: string; text: string
          segments: Array<{ start: number; end: number; text: string }>
        }
        const subtitleId = await DBUtils.addSubtitle({
          mediaId, source: 'whisper', status: 'completed', sourceLanguage: language,
          targetLanguage: null, postProcessStatus: 'pending', rawText: text,
          createdAt: new Date(), updatedAt: new Date(),
        })
        await writeSegments(subtitleId, segments)
        invalidate()
        await runTranslate(subtitleId, 'whisper', language)
        return
      }

      // captions 其他失败（YT_BLOCKED / EXTRACTOR_FAILED…）：落一条 failed 记录给重试入口
      await DBUtils.addSubtitle({
        mediaId, source: 'official', status: 'failed', sourceLanguage: 'auto',
        targetLanguage: null, error: json?.error?.code ?? 'EXTRACTOR_FAILED',
        createdAt: new Date(), updatedAt: new Date(),
      })
      invalidate()
      setStage('failed')
    } catch (error) {
      transcriptionLogger.error('subtitle pipeline failed:', error)
      setStage('failed')
    } finally {
      runningRef.current = false
    }
  }, [media, mediaId, invalidate, runTranslate])

  // 自驱动（auto-trigger 契约）：挂载/数据就绪后按落库状态决定下一步
  useEffect(() => {
    if (!media?.id || query.isLoading || runningRef.current) return
    const { subtitle } = query.data ?? { subtitle: null }

    if (media.kind === 'youtube') {
      if (!subtitle) {
        void runYouTubePipeline()
      } else if (subtitle.status === 'completed' && subtitle.postProcessStatus === 'pending') {
        // 翻译中断（关页/失败前没写完）→ 续跑
        runningRef.current = true
        void runTranslate(subtitle.id as number, subtitle.source, subtitle.sourceLanguage).finally(() => {
          runningRef.current = false
        })
      }
    } else if (media.kind === 'audio' && !subtitle) {
      // 沿用现有音频自动转写契约（useFileStatusManager 内部走 /api/transcribe + postprocess）
      void startTranscription()
    }
  }, [media, query.isLoading, query.data, runYouTubePipeline, runTranslate, startTranscription])

  /** 失败重试：删掉 failed 记录重走管线 */
  const retry = useCallback(async () => {
    const subtitle = query.data?.subtitle
    if (subtitle?.id && subtitle.status === 'failed') {
      await DBUtils.deleteSubtitleWithSegments(subtitle.id)
      invalidate()
    }
  }, [query.data, invalidate])

  /** 重新生成：official 免费重抓重翻；whisper 由 UI 先确认（消耗额度）再调用 */
  const regenerate = useCallback(async () => {
    const subtitle = query.data?.subtitle
    if (subtitle?.id) {
      await DBUtils.deleteSubtitleWithSegments(subtitle.id)
      invalidate() // effect 检测到无 subtitle 自动重走管线
    }
  }, [query.data, invalidate])

  return {
    subtitle: query.data?.subtitle ?? null,
    segments: query.data?.segments ?? [],
    isLoading: query.isLoading,
    stage,
    translateProgress,
    retry,
    regenerate,
  }
}
```

- [ ] **Step 2: 验证 + Commit**

Run: `bun run type-check && bun run lint` → PASS

```bash
git add src/hooks/media/useSubtitlePipeline.ts
git commit -m "feat(media): useSubtitlePipeline — self-driving captions/transcribe/translate with resume & regenerate"
```

### Task C9: Watch 页组件（三区布局）

**Files:**
- Create: `src/components/features/watch/MediaViewport.tsx`
- Create: `src/components/features/watch/CurrentSentence.tsx`
- Create: `src/components/features/watch/SubtitlePanel.tsx`
- Create: `src/components/features/watch/WatchControls.tsx`
- Create: `src/components/features/watch/WatchPage.tsx`

> 设计偏离备注：spec 提议复用 `PlaybackSpeedControl`，但它是固定 0.25-2 滑杆，与「档位以 `getAvailablePlaybackRates()` 为准」（YouTube 按视频而异）冲突。此处用动态 `<select>` 实现倍速，`PlaybackSpeedControl` 列入 C12 死代码清理。

- [ ] **Step 1: MediaViewport**

```tsx
// src/components/features/watch/MediaViewport.tsx
import type { RefObject } from 'react'
import { useTranslation } from '~/components/layout/contexts/I18nContext'
import type { MediaRow } from '~/types/db/database'

interface MediaViewportProps {
  media: MediaRow
  containerRef: RefObject<HTMLDivElement | null>
  embedBlocked: boolean
}

export function MediaViewport({ media, containerRef, embedBlocked }: MediaViewportProps) {
  const { t } = useTranslation()

  if (media.kind === 'youtube' && embedBlocked) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-xl bg-[var(--surface-muted)]">
        <p className="text-sm text-[var(--text-secondary)]">{t('watch.embedBlocked')}</p>
        <a
          href={`https://www.youtube.com/watch?v=${media.externalId}`}
          target="_blank"
          rel="noreferrer"
          className="btn-primary"
        >
          {t('watch.openOnYouTube')}
        </a>
      </div>
    )
  }

  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-black">
      {media.kind === 'youtube' ? (
        // YT.Player 会把这个 div 替换为 iframe；外层比例容器负责 16:9
        <div className="aspect-video w-full">
          <div ref={containerRef} className="h-full w-full" />
        </div>
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-[var(--surface-muted)]">
          <span className="material-symbols-outlined text-7xl text-[var(--text-tertiary)]">
            music_note
          </span>
          {/* AudioFileAdapter 把隐藏 <audio> 挂在这里 */}
          <div ref={containerRef} className="hidden" />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: CurrentSentence**

```tsx
// src/components/features/watch/CurrentSentence.tsx
import type { Segment } from '~/types/db/database'

interface CurrentSentenceProps {
  segment: Segment | null
  showOriginalOnly: boolean // official 字幕永远显示原文（spec：防 LLM 改写）
}

export function CurrentSentence({ segment, showOriginalOnly }: CurrentSentenceProps) {
  if (!segment) {
    return <div className="min-h-[5rem]" />
  }
  const original = showOriginalOnly ? segment.text : (segment.normalizedText ?? segment.text)
  return (
    <div className="flex min-h-[5rem] flex-col items-center gap-2 px-4 py-3 text-center">
      <p className="text-xl font-bold leading-relaxed text-[var(--text-primary)] sm:text-2xl">
        {original}
      </p>
      {segment.translation && (
        <p className="text-base text-[var(--text-secondary)]">{segment.translation}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: SubtitlePanel**（时间戳双语行 + 当前行高亮 + 自动滚动居中 + 点击跳转 + 头部重新生成）

```tsx
// src/components/features/watch/SubtitlePanel.tsx
import { useEffect, useRef } from 'react'
import { useTranslation } from '~/components/layout/contexts/I18nContext'
import type { PipelineStage } from '~/hooks/media/useSubtitlePipeline'
import type { Segment, SubtitleRow } from '~/types/db/database'

interface SubtitlePanelProps {
  segments: Segment[]
  subtitle: SubtitleRow | null
  activeIndex: number
  stage: PipelineStage
  translateProgress: { done: number; total: number } | null
  onSegmentClick: (segment: Segment) => void
  onRegenerate: () => void
  onRetry: () => void
}

function formatTimestamp(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export function SubtitlePanel({
  segments, subtitle, activeIndex, stage, translateProgress,
  onSegmentClick, onRegenerate, onRetry,
}: SubtitlePanelProps) {
  const { t } = useTranslation()
  const activeRowRef = useRef<HTMLButtonElement | null>(null)
  const showOriginalOnly = subtitle?.source === 'official'

  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeIndex])

  const stageText =
    stage === 'fetching-captions' ? t('watch.stage.captions')
    : stage === 'transcribing' ? t('watch.stage.transcribing')
    : stage === 'translating' && translateProgress
      ? t('watch.stage.translating')
          .replace('{done}', String(translateProgress.done))
          .replace('{total}', String(translateProgress.total))
      : null

  return (
    <aside className="flex h-full min-h-0 flex-col rounded-xl border border-[var(--border-primary)] bg-[var(--surface-card)]">
      <header className="flex items-center justify-between border-b border-[var(--border-primary)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {t('watch.subtitleCount')}
          </span>
          {segments.length > 0 && (
            <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
              {segments.length}
            </span>
          )}
        </div>
        {subtitle && (
          <button type="button" onClick={onRegenerate} className="btn-secondary !h-8 !px-3 text-xs">
            {t('watch.regenerate')}
          </button>
        )}
      </header>

      {stageText && (
        <div className="border-b border-[var(--border-primary)] px-4 py-2 text-xs text-[var(--text-secondary)]">
          {stageText}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {stage === 'failed' && segments.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <p className="text-sm text-[var(--text-secondary)]">
              {subtitle?.error ?? t('import.error.EXTRACTOR_FAILED')}
            </p>
            <button type="button" onClick={onRetry} className="btn-primary !h-9 !px-4 text-sm">
              {t('watch.retryPipeline')}
            </button>
          </div>
        ) : (
          segments.map((segment, index) => {
            const isActive = index === activeIndex
            const original = showOriginalOnly ? segment.text : (segment.normalizedText ?? segment.text)
            return (
              <button
                key={segment.id ?? index}
                ref={isActive ? activeRowRef : undefined}
                type="button"
                onClick={() => onSegmentClick(segment)}
                className={`block w-full rounded-lg px-3 py-2 text-left transition-colors ${
                  isActive
                    ? 'bg-[var(--color-primary)]/10 ring-1 ring-[var(--color-primary)]'
                    : 'hover:bg-[var(--surface-muted)]'
                }`}
              >
                <span className="mb-1 inline-block rounded-full bg-[var(--surface-muted)] px-2 py-0.5 font-mono text-[10px] tabular-nums text-[var(--text-tertiary)]">
                  {formatTimestamp(segment.start)}
                </span>
                <p
                  className={`text-sm font-medium ${
                    isActive ? 'text-[var(--color-primary)]' : 'text-[var(--text-primary)]'
                  }`}
                >
                  {original}
                </p>
                {segment.translation && (
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{segment.translation}</p>
                )}
              </button>
            )
          })
        )}
      </div>
    </aside>
  )
}
```

- [ ] **Step 4: WatchControls**（播放/暂停、上一句/下一句、单句循环、进度条、倍速、音量。进度条/音量的样式照抄 [PlayerFooter.tsx](../../../src/components/features/player/page/PlayerFooter.tsx) 的透明 range input 模式）

```tsx
// src/components/features/watch/WatchControls.tsx
import { useTranslation } from '~/components/layout/contexts/I18nContext'
import { cn } from '~/lib/utils/utils'

interface WatchControlsProps {
  isPlaying: boolean
  currentTime: number
  duration: number
  availableRates: number[]
  playbackRate: number
  volume: number
  isLooping: boolean
  onTogglePlay: () => void
  onSeek: (seconds: number) => void
  onPrev: () => void
  onNext: () => void
  onToggleLoop: () => void
  onRateChange: (rate: number) => void
  onVolumeChange: (volume: number) => void
}

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '00:00'
  const minutes = Math.floor(value / 60).toString().padStart(2, '0')
  const seconds = Math.floor(value % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

export function WatchControls({
  isPlaying, currentTime, duration, availableRates, playbackRate, volume, isLooping,
  onTogglePlay, onSeek, onPrev, onNext, onToggleLoop, onRateChange, onVolumeChange,
}: WatchControlsProps) {
  const { t } = useTranslation()
  const progress = duration ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-card)] px-4 py-3">
      {/* 进度条 */}
      <div className="flex items-center gap-3">
        <span className="min-w-[3rem] font-mono text-sm tabular-nums text-[var(--text-secondary)]">
          {formatTime(currentTime)}
        </span>
        <div className="group relative flex-1">
          <div className="relative h-2 w-full rounded-full bg-[var(--surface-muted)]">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-[var(--color-primary)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <input
            type="range" min={0} max={duration || 100} step={0.1} value={currentTime}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
            aria-label="播放进度"
          />
        </div>
        <span className="min-w-[3rem] text-right font-mono text-sm tabular-nums text-[var(--text-secondary)]">
          {formatTime(duration)}
        </span>
      </div>

      {/* 控制键 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onPrev} className="btn-secondary !h-10 !w-10 !rounded-full !p-0"
            aria-label={t('watch.prevSentence')}>
            <span className="material-symbols-outlined text-xl">skip_previous</span>
          </button>
          <button type="button" onClick={onTogglePlay} className="btn-primary !h-12 !w-12 !rounded-full !p-0"
            aria-label={isPlaying ? '暂停' : '播放'}>
            <span className="material-symbols-outlined text-2xl">
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>
          <button type="button" onClick={onNext} className="btn-secondary !h-10 !w-10 !rounded-full !p-0"
            aria-label={t('watch.nextSentence')}>
            <span className="material-symbols-outlined text-xl">skip_next</span>
          </button>
          <button
            type="button" onClick={onToggleLoop}
            className={cn(
              'btn-secondary !h-10 !w-10 !rounded-full !p-0',
              isLooping && '!border-[var(--color-primary)] !text-[var(--color-primary)]',
            )}
            aria-label={t('watch.loopSentence')}
          >
            <span className="material-symbols-outlined text-xl">repeat_one</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={playbackRate}
            onChange={(e) => onRateChange(parseFloat(e.target.value))}
            className="h-8 rounded-md border border-[var(--border-primary)] bg-[var(--surface-card)] px-2 text-xs text-[var(--text-primary)]"
            aria-label="播放速度"
          >
            {availableRates.map((rate) => (
              <option key={rate} value={rate}>{rate}x</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onVolumeChange(volume === 0 ? 1 : 0)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
            aria-label={volume === 0 ? '取消静音' : '静音'}
          >
            <span className="material-symbols-outlined text-xl">
              {volume === 0 ? 'volume_off' : volume < 0.5 ? 'volume_down' : 'volume_up'}
            </span>
          </button>
          <div className="relative hidden w-20 items-center sm:flex">
            <div className="h-1.5 w-full rounded-full bg-[var(--surface-muted)]">
              <div className="h-full rounded-full bg-[var(--color-primary)]"
                style={{ width: `${Math.round(volume * 100)}%` }} />
            </div>
            <input
              type="range" min={0} max={1} step={0.01} value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
              aria-label="音量"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: WatchPage**（组装 + 键盘 + 媒体不存在兜底）

```tsx
// src/components/features/watch/WatchPage.tsx
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { CurrentSentence } from '~/components/features/watch/CurrentSentence'
import { MediaViewport } from '~/components/features/watch/MediaViewport'
import { SubtitlePanel } from '~/components/features/watch/SubtitlePanel'
import { WatchControls } from '~/components/features/watch/WatchControls'
import { useTranslation } from '~/components/layout/contexts/I18nContext'
import { PageLoadingState } from '~/components/ui/LoadingState'
import { useSubtitlePipeline } from '~/hooks/media/useSubtitlePipeline'
import { usePlayerAdapter } from '~/hooks/player/usePlayerAdapter'
import { useSegmentLoop } from '~/hooks/player/useSegmentLoop'
import { useSegmentNavigation } from '~/hooks/player/useSegmentNavigation'
import { useWatchKeyboard } from '~/hooks/player/useWatchKeyboard'
import { DBUtils } from '~/lib/db/db'
import type { Segment } from '~/types/db/database'

export const mediaKeys = {
  all: ['media'] as const,
  byId: (id: number) => [...mediaKeys.all, id] as const,
}

export default function WatchPage({ mediaId }: { mediaId: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const parsedId = Number.parseInt(mediaId, 10)
  const validId = Number.isFinite(parsedId) && parsedId > 0

  const mediaQuery = useQuery({
    queryKey: mediaKeys.byId(parsedId),
    enabled: validId,
    queryFn: async () => (await DBUtils.getMedia(parsedId)) ?? null,
  })
  const media = mediaQuery.data ?? null

  const pipeline = useSubtitlePipeline(media)
  const player = usePlayerAdapter(media)
  const { activeIndex, goPrev, goNext } = useSegmentNavigation(
    pipeline.segments, player.currentTime, player.seekTo,
  )
  const { isLooping, toggleLoop } = useSegmentLoop(
    pipeline.segments, player.currentTime, player.seekTo,
  )

  const [playbackRate, setPlaybackRateState] = useState(1)
  const [volume, setVolumeState] = useState(1)

  const handleTogglePlay = useCallback(() => {
    if (player.isPlaying) player.pause()
    else player.play()
  }, [player])

  const handleRateChange = useCallback((rate: number) => {
    setPlaybackRateState(rate)
    player.setRate(rate)
  }, [player])

  const handleVolumeChange = useCallback((v: number) => {
    setVolumeState(v)
    player.setVolume(v)
  }, [player])

  const handleSegmentClick = useCallback((segment: Segment) => {
    player.seekTo(segment.start)
    if (!player.isPlaying) player.play()
  }, [player])

  const handleRegenerate = useCallback(() => {
    if (pipeline.subtitle?.source === 'whisper') {
      if (!window.confirm(t('watch.regenerateConfirm'))) return
    }
    void pipeline.regenerate()
  }, [pipeline, t])

  useWatchKeyboard({
    enabled: Boolean(media),
    onPlayPause: handleTogglePlay,
    onPrev: goPrev,
    onNext: goNext,
    onToggleMute: () => handleVolumeChange(volume === 0 ? 1 : 0),
    onSetRate: handleRateChange,
  })

  if (!validId || (!mediaQuery.isLoading && !media)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-sm text-[var(--text-secondary)]">{t('watch.notFound')}</p>
        <button type="button" onClick={() => navigate({ to: '/' })} className="btn-primary">
          {t('player.back')}
        </button>
      </div>
    )
  }
  if (mediaQuery.isLoading || !media) {
    return <PageLoadingState />
  }

  const activeSegment = activeIndex >= 0 ? (pipeline.segments[activeIndex] ?? null) : null
  const showOriginalOnly = pipeline.subtitle?.source === 'official'

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-4 py-4 lg:h-screen">
      <header className="flex items-center gap-3">
        <button type="button" onClick={() => navigate({ to: '/' })}
          className="btn-secondary !h-9 !w-9 !rounded-full !p-0" aria-label={t('player.back')}>
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-[var(--text-primary)]">{media.title}</h1>
          {media.channelName && (
            <p className="truncate text-xs text-[var(--text-secondary)]">{media.channelName}</p>
          )}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="flex min-h-0 flex-col gap-3">
          <MediaViewport media={media} containerRef={player.containerRef} embedBlocked={player.embedBlocked} />
          <CurrentSentence segment={activeSegment} showOriginalOnly={Boolean(showOriginalOnly)} />
          <WatchControls
            isPlaying={player.isPlaying}
            currentTime={player.currentTime}
            duration={player.duration}
            availableRates={player.availableRates}
            playbackRate={playbackRate}
            volume={volume}
            isLooping={isLooping}
            onTogglePlay={handleTogglePlay}
            onSeek={player.seekTo}
            onPrev={goPrev}
            onNext={goNext}
            onToggleLoop={toggleLoop}
            onRateChange={handleRateChange}
            onVolumeChange={handleVolumeChange}
          />
        </div>
        <div className="min-h-[40vh] lg:min-h-0">
          <SubtitlePanel
            segments={pipeline.segments}
            subtitle={pipeline.subtitle}
            activeIndex={activeIndex}
            stage={pipeline.stage}
            translateProgress={pipeline.translateProgress}
            onSegmentClick={handleSegmentClick}
            onRegenerate={handleRegenerate}
            onRetry={() => void pipeline.retry()}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: 验证 + Commit**（useWatchKeyboard 在 C10 创建，此时 type-check 会报缺模块——C9/C10 一起提交亦可）

```bash
git add src/components/features/watch/
git commit -m "feat(watch): three-zone watch page components (viewport, sentence, subtitle panel, controls)"
```

### Task C10: 路由接线 + 键盘

**Files:**
- Create: `src/hooks/player/useWatchKeyboard.ts`
- Create: `src/routes/watch.$mediaId.tsx`
- Modify: `src/routes/player.$fileId.tsx`（重定向）

- [ ] **Step 1: useWatchKeyboard**（以死代码 useKeyboardControls 的按键表为规格：空格/←→/m/1-5；←→ 语义改为句级导航）

```ts
// src/hooks/player/useWatchKeyboard.ts
import { useCallback, useEffect } from 'react'

interface UseWatchKeyboardProps {
  enabled: boolean
  onPlayPause: () => void
  onPrev: () => void
  onNext: () => void
  onToggleMute: () => void
  onSetRate: (rate: number) => void
}

export function useWatchKeyboard({
  enabled, onPlayPause, onPrev, onNext, onToggleMute, onSetRate,
}: UseWatchKeyboardProps) {
  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return

      switch (event.key.toLowerCase()) {
        case ' ':
          event.preventDefault()
          onPlayPause()
          break
        case 'arrowleft':
          event.preventDefault()
          onPrev()
          break
        case 'arrowright':
          event.preventDefault()
          onNext()
          break
        case 'm':
          event.preventDefault()
          onToggleMute()
          break
        case '1': case '2': case '3': case '4': case '5': {
          event.preventDefault()
          onSetRate(parseInt(event.key, 10) * 0.25)
          break
        }
      }
    },
    [enabled, onPlayPause, onPrev, onNext, onToggleMute, onSetRate],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [handleKeyPress])
}
```

- [ ] **Step 2: watch 路由**

```tsx
// src/routes/watch.$mediaId.tsx
import { createFileRoute } from '@tanstack/react-router'
import PlayerErrorBoundary from '~/components/features/player/PlayerErrorBoundary'
import WatchPage from '~/components/features/watch/WatchPage'

export const Route = createFileRoute('/watch/$mediaId')({
  component: WatchRoute,
})

function WatchRoute() {
  const { mediaId } = Route.useParams()
  return (
    <PlayerErrorBoundary>
      <WatchPage mediaId={mediaId} />
    </PlayerErrorBoundary>
  )
}
```

- [ ] **Step 3: 旧路由重定向**（id 在 v4 迁移中保留，fileId 即 mediaId）

```tsx
// src/routes/player.$fileId.tsx — 整文件替换为：
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/player/$fileId')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/watch/$mediaId', params: { mediaId: params.fileId } })
  },
})
```

- [ ] **Step 4: 验证**

Run: `bun run dev` 启动后访问 http://localhost:3000/player/1
Expected: 跳转到 /watch/1。`bun run type-check && bun run lint` PASS（routeTree.gen.ts 由 Vite 插件自动再生成，勿手改）。

- [ ] **Step 5: Commit**

```bash
git add src/routes/ src/hooks/player/useWatchKeyboard.ts src/routeTree.gen.ts
git commit -m "feat(routes): /watch/\$mediaId + redirect from /player/\$fileId + keyboard controls"
```

### Task C11: 资料库页（MediaCard 网格）

**Files:**
- Create: `src/components/features/library/MediaCard.tsx`
- Create: `src/components/features/library/LibraryPage.tsx`
- Modify: `src/routes/index.tsx`

- [ ] **Step 1: MediaCard**

```tsx
// src/components/features/library/MediaCard.tsx
import { Link } from '@tanstack/react-router'
import { useTranslation } from '~/components/layout/contexts/I18nContext'
import type { MediaRow } from '~/types/db/database'

interface MediaCardProps {
  media: MediaRow
  onDelete: (id: number) => void
}

function formatDuration(sec: number | null): string {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function relativeTime(date: Date, locale: string): string {
  const diffMs = date.getTime() - Date.now()
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const hours = Math.round(diffMs / 3_600_000)
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour')
  return rtf.format(Math.round(hours / 24), 'day')
}

export function MediaCard({ media, onDelete }: MediaCardProps) {
  const { t, language } = useTranslation()

  return (
    <div className="group relative">
      <Link
        to="/watch/$mediaId"
        params={{ mediaId: String(media.id) }}
        className="block overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--surface-card)] transition-shadow hover:shadow-[var(--shadow-md)]"
      >
        <div className="relative aspect-video w-full bg-[var(--surface-muted)]">
          {media.kind === 'youtube' && media.thumbnailUrl ? (
            <img src={media.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="material-symbols-outlined text-5xl text-[var(--text-tertiary)]">
                music_note
              </span>
            </div>
          )}
          {media.durationSec ? (
            <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 font-mono text-xs text-white">
              {formatDuration(media.durationSec)}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-1 px-3 py-2.5">
          <p className="line-clamp-2 text-sm font-semibold text-[var(--text-primary)]">{media.title}</p>
          <p className="truncate text-xs text-[var(--text-secondary)]">
            {media.kind === 'youtube' ? media.channelName : media.fileName}
          </p>
          <p className="text-xs text-[var(--text-tertiary)]">{relativeTime(media.addedAt, language)}</p>
        </div>
      </Link>
      <button
        type="button"
        onClick={() => {
          if (media.id && window.confirm(t('library.deleteConfirm'))) onDelete(media.id)
        }}
        className="absolute right-2 top-2 hidden h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white group-hover:flex"
        aria-label={t('common.delete')}
      >
        <span className="material-symbols-outlined text-base">delete</span>
      </button>
    </div>
  )
}
```

注：`useTranslation()` 返回值里 UI 语言字段名以 [I18nContext.tsx](../../../src/components/layout/contexts/I18nContext.tsx) 为准（`language` 或 `locale`），实现时核对。

- [ ] **Step 2: LibraryPage**

```tsx
// src/components/features/library/LibraryPage.tsx
import { useMemo, useState } from 'react'
import { MediaCard } from '~/components/features/library/MediaCard'
import { MediaImportDialog } from '~/components/features/library/MediaImportDialog'
import { useTranslation } from '~/components/layout/contexts/I18nContext'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { PageLoadingState } from '~/components/ui/LoadingState'
import { useFiles } from '~/hooks/db/useFiles'

export function LibraryPage() {
  const { t } = useTranslation()
  const { files: mediaList, isLoading, deleteFile } = useFiles()
  const [search, setSearch] = useState('')
  const [importOpen, setImportOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return mediaList
    return mediaList.filter(
      (m) => m.title.toLowerCase().includes(q) || (m.channelName ?? '').toLowerCase().includes(q),
    )
  }, [mediaList, search])

  if (isLoading) return <PageLoadingState />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('library.title')}</h1>
        <div className="flex items-center gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('library.search.placeholder')}
            className="w-56"
          />
          <Button onClick={() => setImportOpen(true)}>
            <span className="material-symbols-outlined mr-1 text-base">add</span>
            {t('library.add')}
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-[var(--border-primary)] py-20">
          <p className="text-base font-medium text-[var(--text-primary)]">{t('library.empty.title')}</p>
          <Button onClick={() => setImportOpen(true)}>{t('library.empty.cta')}</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((media) => (
            <MediaCard key={media.id} media={media} onDelete={(id) => void deleteFile(String(id))} />
          ))}
        </div>
      )}

      <MediaImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
```

- [ ] **Step 3: index.tsx 改造**（移除 StatsCards 与 FileManager——StatsCards 迁设置页推 #2）

```tsx
// src/routes/index.tsx — 整文件替换为：
import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { LibraryPage } from '~/components/features/library/LibraryPage'
import { PageLoadingState } from '~/components/ui/LoadingState'
import Navigation from '~/components/ui/Navigation'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="relative flex min-h-screen w-full flex-col">
      <Navigation />
      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8 mt-24">
        <div className="mx-auto max-w-6xl">
          <Suspense fallback={<PageLoadingState />}>
            <LibraryPage />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 4: 验证**

Run: `bun run dev` → 首页显示卡片网格；导入一条真实 YouTube 链接 → 跳 watch 页 → 字幕逐片出现。
Run: `bun run type-check && bun run lint && bun run test:run` → PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/features/library/ src/routes/index.tsx
git commit -m "feat(library): media card grid with local search, import dialog entry, empty state"
```

### Task C12: 死代码清理

**Files:**
- Delete: `src/lib/db/subtitle-sync.ts`（+其测试）、`src/components/features/player/AudioPlayer.tsx`、`PlaybackSpeedControl.tsx`、`PlayerPage.tsx`、`PlayerFooterContainer.tsx`、`page/PlayerFooter.tsx`、`ScrollableSubtitleDisplay.tsx`（+其测试）、`src/components/features/file/FileManager.tsx`、`FileCard.tsx`、`src/hooks/player/usePlayerDataQuery.ts`、`src/hooks/ui/useKeyboardControls.ts`、`src/hooks/ui/useAudioPlayer*.ts`（确认无引用后）

- [ ] **Step 1: 逐个删除前先 grep 引用**

```bash
for f in subtitle-sync AudioPlayer PlaybackSpeedControl PlayerPage PlayerFooterContainer ScrollableSubtitleDisplay FileManager FileCard usePlayerDataQuery useKeyboardControls useAudioPlayer; do
  echo "=== $f ==="; grep -rn "$f" src --include='*.ts' --include='*.tsx' -l | grep -v __tests__ | grep -v "$f"
done
```

只删「除自身与测试外零引用」的文件；仍被引用的（如 `page/PlayerFallbackStates.tsx`、`PlayerErrorBoundary`、`useShadowingMode`/`shadowing-machine`——跟读在 #2/#3 回归，保留）不动。删除对应测试文件。

- [ ] **Step 2: 验证 + Commit**

Run: `bun run type-check && bun run lint && bun run test:run` → 全绿

```bash
git add -A src/
git commit -m "chore: remove dead player/file components superseded by watch/library"
```

**Phase C 完成标志：** 全量检查绿 + 手动过一遍：导入带字幕视频 / 仅 ASR / 无字幕短视频 / 重复导入 / 上传音频，五条链路都走通。

---

# Phase D — 发布

### Task D1: Service Worker + Dockerfile + compose

**Files:**
- Modify: `public/sw.js:1`、`Dockerfile`、`docker-compose.yml`

- [ ] **Step 1: sw.js** — `const CACHE_NAME = 'shadowing-learning-v2'` → `'shadowing-learning-v3'`（activate 分支已会清旧缓存；不 bump 则离线 PWA 用户用旧壳打开 v4 库且刷新无效）。

- [ ] **Step 2: Dockerfile** — runtime 阶段加 yt-dlp（官方 release 的 Python zipapp + python3 + nodejs 作 JS runtime；**不用 apk 的 yt-dlp**——Alpine 分支冻结旧版，提取器必须能跟随上游滚动更新，升级 = 改 ARG 重建）：

```dockerfile
FROM base AS runtime
ENV NODE_ENV=production

# yt-dlp：官方 release zipapp（pinned）。zipapp 需要 python3；
# 2025.11+ 的 EJS 挑战需要外部 JS runtime（nodejs）。
# 升级方式：改 YTDLP_VERSION 重建镜像（提取器类依赖跟随上游滚动）。
ARG YTDLP_VERSION=2026.06.01
RUN apk add --no-cache python3 nodejs \
  && wget -O /usr/local/bin/yt-dlp \
     "https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp" \
  && chmod +x /usr/local/bin/yt-dlp \
  && yt-dlp --version

COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
EXPOSE 3000
CMD ["bun", "run", "dist/server/server.js"]
```

`YTDLP_VERSION` 以实施当日 https://github.com/yt-dlp/yt-dlp/releases 最新版为准。

- [ ] **Step 3: docker-compose.yml** — service 下加 tmpfs，限制转写临时音频的磁盘占用：

```yaml
    tmpfs:
      - /tmp:size=256M
```

- [ ] **Step 4: 容器冒烟**

```bash
docker compose up --build -d
curl -fsS http://localhost:3000/api/health
docker compose exec app yt-dlp --version    # service 名以 docker-compose.yml 实际为准
curl -fsS -X POST http://localhost:3000/api/youtube/resolve \
  -H 'content-type: application/json' -d '{"url":"https://youtu.be/dQw4w9WgXcQ"}'
docker compose down
```
Expected: health 200；yt-dlp 输出版本；resolve 返回视频元数据（容器内若被 YouTube 拦 → 回看 Phase 0 决策）。

- [ ] **Step 5: Commit**

```bash
git add public/sw.js Dockerfile docker-compose.yml
git commit -m "chore(release): SW cache bump v3, yt-dlp in runtime image, tmpfs for /tmp"
```

### Task D2: 文档同步

**Files:**
- Modify: `CLAUDE.md`、`docs/ARCHITECTURE.md`、`README.md`、`docs/DOKPLOY.md`、`.env.example`（无新变量，确认即可）

- [ ] **Step 1: CLAUDE.md** 必改点：
  1. **测试章节纠错**：删除「Bun's built-in test runner / bunfig.toml preload」的过期描述，改为 Vitest（`bun run test:run`、单文件 `bunx vitest run path`、vitest.config.ts setupFiles）。
  2. 数据流图更新：加入 YouTube 导入路径（resolve→captions/transcribe→分片 postprocess）。
  3. Database 章节：v4 两阶段迁移说明（media/subtitles 为活表，files/transcripts 为只读备份待 v5 删除；segments.transcriptId 指向 subtitles.id）。
  4. API 列表：+`/api/youtube/{resolve,captions,transcribe}` 与各自限流/信号量/配额。
  5. 部署依赖：yt-dlp（容器内置；本地 `brew install yt-dlp`）。
  6. 部署前置条件：Traefik 必须清洗入站 `x-forwarded-for`。

- [ ] **Step 2: docs/ARCHITECTURE.md** — 顺手修掉过期的「Next.js 16 App Router」表述（实际是 Vite + TanStack Start）；目录结构/数据流按本次改版重写相关小节。

- [ ] **Step 3: README.md** — 本地开发依赖加 yt-dlp 一行。

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/ README.md
git commit -m "docs: sync CLAUDE.md/ARCHITECTURE/README for youtube platform (incl. Vitest correction)"
```

### Task D3: DoD 验收与发布

- [ ] **Step 1: 全量门禁**

Run: `bun run lint && bun run type-check && bun run test:run`
Expected: 全绿。

- [ ] **Step 2: 手动 DoD** — 逐条执行 spec [Section 6.3](../specs/2026-06-10-youtube-learning-platform-design.md) 清单（导入链路 7 条、播放页 6 条、回归 7 条），逐项打勾记录在 PR 描述里。

- [ ] **Step 3: 发布**（按 spec 6.4）：PR → review → Dokploy 部署 → 线上过导入链路前 3 条 + CSP 无 console 违规。PR 描述中注明回滚预案：**镜像回滚救不了已迁移用户（库已 v4），修复方向只能向前；旧表仍在，可重放迁移**。

- [ ] **Step 4: 跟进项登记** — 在 spec 文档末尾追加：「下个发布周期执行 Dexie v5 删 files/transcripts（spec Section 2 两阶段迁移的收尾）」。

---

## 与 spec 的已知偏离（实施者须知）

1. **PlaybackSpeedControl 不复用**：固定滑杆与动态 `getAvailablePlaybackRates()` 冲突，改为动态 select（C9 备注）。
2. **广告 tick 异常检测**（spec 5.4 的兜底策略）**未排进本计划**：等 C 阶段真机观察广告期 `getCurrentTime` 实际行为后，作为后续小任务补——盲写检测阈值容易误伤正常 seek。已在 DoD 中保留「广告期字幕行为」观察项。
3. **`import.error.*` / `watch.*` 等 i18n key 的 `{done}/{total}` 插值**用简单 `.replace` 实现（现有 i18n 无插值机制，不为两处用法引入库）。
