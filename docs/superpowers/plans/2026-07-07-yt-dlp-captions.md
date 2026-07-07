# yt-dlp Captions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/api/youtube/captions`' content fetch (youtubei.js `get_transcript`, empirically 400) with a yt-dlp json3 download, degrading unfetchable captions to `NO_CAPTIONS` so the existing Whisper fallback triggers.

**Architecture:** Keep youtubei.js `getVideoMeta` + `selectCaptionTrack` for track selection (metadata path still works). Add `fetchSubtitleCues` to the existing `ytdlp.ts` (mirrors `downloadAudio`'s `execFile`/tmp/cleanup pattern) that shells `yt-dlp --write-subs/--write-auto-subs --sub-format json3`, reads the produced `.json3`, and parses it into `MsCue[]` via a pure `parseJson3Cues`. Swap the one call site in `captions.ts` and delete the now-dead `fetchTranscriptCues`.

**Tech Stack:** Bun, TanStack Start server handlers, Vitest (happy-dom), yt-dlp (external binary), zod.

## Global Constraints

- Runtime/PM: **Bun ≥1.2.0** — never `npm`/`pnpm`/`yarn`/`node`.
- Tests: **Vitest only** — run with `bun run test:run` / `bunx vitest run <path>`. **Never `bun test`** (ignores `vitest.config.ts`, fails "document is not defined").
- Path alias: `~/*` → `./src/*`.
- Lint/format: Biome — 2-space indent, 100-col, single quotes, semicolons as-needed. Biome manages import order.
- yt-dlp invocations MUST use `execFile` (never a shell), pass `--` before `videoId`, and validate `videoId` with `isValidVideoId` first (injection defense — matches `downloadAudio`).
- Response contract of `/api/youtube/captions` is unchanged: `apiSuccess({ language, kind, segments })`.

---

### Task 1: `parseJson3Cues` + `fetchSubtitleCues` in `ytdlp.ts`

**Files:**
- Modify: `src/lib/youtube/ytdlp.ts`
- Test: `src/lib/youtube/__tests__/ytdlp.test.ts` (create)

**Interfaces:**
- Consumes: `MsCue` from `~/lib/youtube/normalize`; `YouTubeSourceError` from `~/lib/youtube/innertube`; existing `YtdlpError`, `isValidVideoId`, `execFileAsync`, `TIMEOUT_MS`, `apiLogger` in scope.
- Produces:
  - `parseJson3Cues(raw: string): MsCue[]` — pure parser, exported.
  - `fetchSubtitleCues(videoId: string, language: string, kind: 'manual' | 'asr'): Promise<MsCue[]>` — throws `YouTubeSourceError('NO_CAPTIONS', …, 404)` when yt-dlp produces no usable cues; throws `YtdlpError('YT_BLOCKED' | 'EXTRACTOR_FAILED', …)` otherwise.

- [ ] **Step 1: Write the failing test**

Create `src/lib/youtube/__tests__/ytdlp.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseJson3Cues } from '~/lib/youtube/ytdlp'

describe('parseJson3Cues', () => {
  it('maps events to MsCue with endMs = start + duration', () => {
    const raw = JSON.stringify({
      events: [
        { tStartMs: 292, dDurationMs: 2000, segs: [{ utf8: 'Think of the mind like an ocean.' }] },
        { tStartMs: 3040, dDurationMs: 4335, segs: [{ utf8: 'Up on the surface.' }] },
      ],
    })
    expect(parseJson3Cues(raw)).toEqual([
      { startMs: 292, endMs: 2292, text: 'Think of the mind like an ocean.' },
      { startMs: 3040, endMs: 7375, text: 'Up on the surface.' },
    ])
  })

  it('collapses newlines/whitespace across segs to single spaces', () => {
    const raw = JSON.stringify({
      events: [{ tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: 'line one\n' }, { utf8: '  line two' }] }],
    })
    expect(parseJson3Cues(raw)).toEqual([{ startMs: 0, endMs: 1000, text: 'line one line two' }])
  })

  it('skips events without segs, with empty text, or without tStartMs', () => {
    const raw = JSON.stringify({
      events: [
        { tStartMs: 100, dDurationMs: 500 }, // no segs
        { tStartMs: 200, dDurationMs: 500, segs: [{ utf8: '   ' }] }, // empty text
        { dDurationMs: 500, segs: [{ utf8: 'no start' }] }, // no tStartMs
        { tStartMs: 300, dDurationMs: 500, segs: [{ utf8: 'kept' }] },
      ],
    })
    expect(parseJson3Cues(raw)).toEqual([{ startMs: 300, endMs: 800, text: 'kept' }])
  })

  it('treats missing dDurationMs as 0', () => {
    const raw = JSON.stringify({ events: [{ tStartMs: 500, segs: [{ utf8: 'x' }] }] })
    expect(parseJson3Cues(raw)).toEqual([{ startMs: 500, endMs: 500, text: 'x' }])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/lib/youtube/__tests__/ytdlp.test.ts`
Expected: FAIL — `parseJson3Cues` is not exported / not a function.

- [ ] **Step 3: Implement `parseJson3Cues` and `fetchSubtitleCues`**

In `src/lib/youtube/ytdlp.ts`, update the imports at the top:

```ts
import { execFile } from 'node:child_process'
import { mkdir, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { apiLogger } from '~/lib/utils/logger'
import { YouTubeSourceError } from '~/lib/youtube/innertube'
import type { MsCue } from '~/lib/youtube/normalize'
import { isValidVideoId } from '~/lib/youtube/url'
```

Then append to the end of the file:

```ts
interface Json3Event {
  tStartMs?: number
  dDurationMs?: number
  segs?: { utf8?: string }[]
}

/** Parse yt-dlp's json3 subtitle payload into MsCue[]. Pure — unit-tested. */
export function parseJson3Cues(raw: string): MsCue[] {
  const data = JSON.parse(raw) as { events?: Json3Event[] }
  const cues: MsCue[] = []
  for (const e of data.events ?? []) {
    if (!e.segs || typeof e.tStartMs !== 'number') continue
    const text = e.segs
      .map((s) => s.utf8 ?? '')
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
    if (!text) continue
    cues.push({ startMs: e.tStartMs, endMs: e.tStartMs + (e.dDurationMs ?? 0), text })
  }
  return cues
}

/**
 * 抓取指定语言字幕（json3）并返回 MsCue[]。
 * 用 android_vr 等客户端绕过 timedtext 的 PoToken 封锁（youtubei.js 的 get_transcript 已 400）。
 * videoId 必须先过 isValidVideoId；execFile + '--' 双保险防注入（同 downloadAudio）。
 * 无产出 / 空字幕 → NO_CAPTIONS(404)，交给客户端 Whisper 兜底。
 */
export async function fetchSubtitleCues(
  videoId: string,
  language: string,
  kind: 'manual' | 'asr',
): Promise<MsCue[]> {
  if (!isValidVideoId(videoId)) {
    throw new YtdlpError('EXTRACTOR_FAILED', `非法 videoId: ${videoId}`)
  }
  const base = language.split('-')[0]
  const writeFlag = kind === 'asr' ? '--write-auto-subs' : '--write-subs'
  const dir = join(tmpdir(), `yt-sub-${videoId}-${crypto.randomUUID()}`)
  try {
    await mkdir(dir, { recursive: true })
    await execFileAsync(
      'yt-dlp',
      [
        '--skip-download',
        writeFlag,
        '--sub-langs',
        `${base}.*,${base}`,
        '--sub-format',
        'json3',
        '-o',
        join(dir, '%(id)s.%(ext)s'),
        '--',
        videoId,
      ],
      { timeout: TIMEOUT_MS },
    )
    const json3 = (await readdir(dir)).filter((f) => f.endsWith('.json3'))
    if (json3.length === 0) {
      throw new YouTubeSourceError('NO_CAPTIONS', '该视频没有可用字幕', 404)
    }
    const cues = parseJson3Cues(await readFile(join(dir, json3[0]), 'utf8'))
    if (cues.length === 0) {
      throw new YouTubeSourceError('NO_CAPTIONS', '该视频没有可用字幕', 404)
    }
    return cues
  } catch (error) {
    if (error instanceof YouTubeSourceError) throw error
    if (error instanceof YtdlpError) throw error
    const msg = (error instanceof Error ? error.message : String(error)).toLowerCase()
    apiLogger.error('fetchSubtitleCues failed:', { videoId, error: msg.slice(0, 300) })
    if (msg.includes('sign in') || msg.includes('bot') || msg.includes('login')) {
      throw new YtdlpError('YT_BLOCKED', '服务器被 YouTube 风控拦截')
    }
    if (msg.includes('enoent')) throw new YtdlpError('EXTRACTOR_FAILED', 'yt-dlp 不可用')
    throw new YtdlpError('EXTRACTOR_FAILED', `字幕抓取失败: ${msg.slice(0, 200)}`)
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
```

> Note: `fetchSubtitleCues` spawns `yt-dlp` and is not unit-tested (integration/manual — see Task 2's verification). Only the pure `parseJson3Cues` is unit-tested here.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/lib/youtube/__tests__/ytdlp.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Type-check**

Run: `bun run type-check`
Expected: exit 0 (no errors). Confirms `MsCue`/`YouTubeSourceError` imports and no circular-import type break.

- [ ] **Step 6: Commit**

```bash
git add src/lib/youtube/ytdlp.ts src/lib/youtube/__tests__/ytdlp.test.ts
git commit -m "feat(youtube): fetchSubtitleCues via yt-dlp json3 + parseJson3Cues"
```

---

### Task 2: Wire `captions.ts` to yt-dlp; delete dead `fetchTranscriptCues`

**Files:**
- Modify: `src/routes/api/youtube/captions.ts`
- Modify: `src/lib/youtube/innertube.ts` (delete `fetchTranscriptCues`)
- Test: `src/routes/api/youtube/__tests__/captions.test.ts`

**Interfaces:**
- Consumes: `fetchSubtitleCues`, `isYtdlpAvailable`, `YtdlpError` from `~/lib/youtube/ytdlp`; `getVideoMeta`, `YouTubeSourceError` from `~/lib/youtube/innertube`; existing `selectCaptionTrack`, `mergeShortCues`, `msCuesToSeconds`, `apiSuccess`, `apiError`, rate-limit helpers.
- Produces: no new exports; route behavior only.

- [ ] **Step 1: Update the route test (failing)**

Replace the top of `src/routes/api/youtube/__tests__/captions.test.ts` (the mock block + imports, lines 1–13) with:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('~/lib/youtube/innertube', async (importOriginal) => {
  const orig = await importOriginal<typeof import('~/lib/youtube/innertube')>()
  return { ...orig, getVideoMeta: vi.fn() }
})

vi.mock('~/lib/youtube/ytdlp', async (importOriginal) => {
  const orig = await importOriginal<typeof import('~/lib/youtube/ytdlp')>()
  return { ...orig, fetchSubtitleCues: vi.fn(), isYtdlpAvailable: vi.fn() }
})

import { getVideoMeta, YouTubeSourceError } from '~/lib/youtube/innertube'
import { fetchSubtitleCues, isYtdlpAvailable } from '~/lib/youtube/ytdlp'
import { handleCaptionsPost } from '~/routes/api/youtube/captions'
```

Replace the `beforeEach` (line 23) with a version that defaults yt-dlp to available:

```ts
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(isYtdlpAvailable).mockResolvedValue(true)
})
```

In the first test ("selects track…"), replace the `fetchTranscriptCues` mock + assertion (lines 39–42 and line 49):

```ts
    vi.mocked(fetchSubtitleCues).mockResolvedValue([
      { startMs: 0, endMs: 800, text: 'I was' },
      { startMs: 800, endMs: 3000, text: 'told to make my bed.' },
    ])
```

and

```ts
    expect(fetchSubtitleCues).toHaveBeenCalledWith('dQw4w9WgXcQ', 'en', 'manual')
```

Add one new test after the malformed-videoId test:

```ts
  it('returns EXTRACTOR_UNAVAILABLE 501 when yt-dlp is missing', async () => {
    vi.mocked(isYtdlpAvailable).mockResolvedValue(false)
    const res = await handleCaptionsPost(post({ videoId: 'dQw4w9WgXcQ' }))
    expect(res.status).toBe(501)
    expect((await res.json()).error.code).toBe('EXTRACTOR_UNAVAILABLE')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/routes/api/youtube/__tests__/captions.test.ts`
Expected: FAIL — `captions.ts` still imports/calls `fetchTranscriptCues`; `fetchSubtitleCues`/`isYtdlpAvailable` not yet wired.

- [ ] **Step 3: Rewire `captions.ts`**

Change the imports in `src/routes/api/youtube/captions.ts`:

```ts
import { getVideoMeta, YouTubeSourceError } from '~/lib/youtube/innertube'
import { fetchSubtitleCues, isYtdlpAvailable, YtdlpError } from '~/lib/youtube/ytdlp'
```

(Remove `fetchTranscriptCues` from the innertube import.)

Immediately after the `bodySchema` parse + `isValidVideoId` guard (after `const { videoId, preferredLanguage } = parsed.data`), add the availability check — mirroring `transcribe.ts`:

```ts
  if (!(await isYtdlpAvailable())) {
    return apiError({
      code: 'EXTRACTOR_UNAVAILABLE',
      message: '服务器未安装 yt-dlp，无法抓取字幕',
      statusCode: 501,
    })
  }
```

Inside the `try`, replace the fetch line:

```ts
    const cues = await fetchSubtitleCues(videoId, track.language, track.kind)
```

Extend the `catch` to map `YtdlpError` (keep the existing `YouTubeSourceError` branch first):

```ts
  } catch (error) {
    if (error instanceof YouTubeSourceError) {
      return apiError({ code: error.code, message: error.message, statusCode: error.statusCode })
    }
    if (error instanceof YtdlpError) {
      return apiError({ code: error.code, message: error.message, statusCode: 502 })
    }
    return apiError({ code: 'EXTRACTOR_FAILED', message: '字幕抓取失败', statusCode: 502 })
  }
```

- [ ] **Step 4: Delete dead `fetchTranscriptCues`**

In `src/lib/youtube/innertube.ts`, delete the entire `fetchTranscriptCues` function (the block starting at the `/** captions 用：完整 getInfo + transcript 面板… */` comment through its closing brace, ~lines 116–163). Leave `getVideoMeta`, `classifyYouTubeError`, `mapCaptionTracks`, `YouTubeSourceError` intact.

- [ ] **Step 5: Run tests + type-check + lint**

Run: `bunx vitest run src/routes/api/youtube/__tests__/captions.test.ts`
Expected: PASS (5 tests).

Run: `bun run type-check`
Expected: exit 0. (Confirms no remaining references to `fetchTranscriptCues`.)

Run: `bun run lint`
Expected: no errors (warnings ok).

- [ ] **Step 6: Full test suite (regression guard)**

Run: `bun run test:run`
Expected: all pass (prior baseline: 26 files, 198 passed + 1 skipped; now +5 with Task 1's 4 new).

- [ ] **Step 7: Manual verification (yt-dlp required locally: `brew install yt-dlp`)**

Start dev (`bun run dev`), then from another shell:

```bash
curl -s -X POST http://localhost:3000/api/youtube/captions \
  -H 'content-type: application/json' \
  -d '{"videoId":"rKV5JcALQoQ","preferredLanguage":"en"}' | head -c 400
```

Expected: HTTP 200 envelope with `data.segments` containing real cues (e.g. "Think of the mind like an ocean."). This is the video that previously 400'd on `get_transcript`.

- [ ] **Step 8: Commit**

```bash
git add src/routes/api/youtube/captions.ts src/lib/youtube/innertube.ts \
        src/routes/api/youtube/__tests__/captions.test.ts
git commit -m "feat(youtube): captions fetch via yt-dlp; drop dead get_transcript path"
```

---

## Self-Review

**Spec coverage:**
- Spec §实现 `fetchSubtitleCues` → Task 1 Step 3. ✅
- Spec §实现 `captions.ts` swap + `isYtdlpAvailable` 501 → Task 2 Steps 3, new test. ✅
- Spec §错误处理 (NO_CAPTIONS / YT_BLOCKED / EXTRACTOR_FAILED) → Task 1 catch + Task 2 catch. ✅
- Spec §测试 (json3 parser fixture; captions mock swap) → Task 1 test, Task 2 Step 1. ✅
- Spec §删除 (`fetchTranscriptCues`) → Task 2 Step 4. ✅
- Spec §已知考量 (ASR fragmentation; yt-dlp availability) → carried as note; `mergeShortCues` unchanged handles it. ✅

**Placeholder scan:** No TBD/TODO/"handle edge cases"; all code shown. ✅

**Type consistency:** `parseJson3Cues(raw: string): MsCue[]` and `fetchSubtitleCues(videoId, language, kind)` names/signatures identical across Task 1 (definition), Task 2 (call `fetchSubtitleCues(videoId, track.language, track.kind)`), and test (`toHaveBeenCalledWith('dQw4w9WgXcQ', 'en', 'manual')`). `YtdlpError` codes reused, no new codes. ✅
