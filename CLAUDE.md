# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shadowing Learning is a language-shadowing practice app. Users import a YouTube URL, the app fetches the video's caption track, post-processes the text (translation, annotations, furigana) through Groq chat completions, stores everything client-side in IndexedDB, and plays it back with time-synced subtitles. The earlier audio-upload / Groq Whisper transcription path has been removed.

The architecture is **client-heavy**: almost all server work is a handful of Groq/YouTube API calls behind a thin Cloudflare Worker. There is no application database — media, subtitles, and segments all live in the browser via Dexie.

## Toolchain

This project runs on **Bun + Vite + TanStack Router, deployed to Cloudflare Workers** (it was migrated off Next.js + pnpm, and later off a TanStack Start server onto Workers).

- **Runtime / package manager: Bun ≥1.2.0** for local dev/build/test. Do **not** use `npm`/`pnpm`/`yarn`/`node`. The lockfile is `bun.lock`. Production runs on the Cloudflare Workers runtime, not Bun.
- **Build: Vite 8** ([vite.config.ts](vite.config.ts)) builds the client SPA into `dist/`. There is no server-rendering plugin — the app is a static bundle served as Worker Assets.
- **API: Hono**, mounted directly in the Worker entry ([worker/index.ts](worker/index.ts)) — see [wrangler.jsonc](wrangler.jsonc) (`main: worker/index.ts`).
- **Routing: TanStack Router**, file-based, client-only (no server route handlers on this side — those live in `worker/`, see below).
- **View: React 19, Tailwind CSS v4** (CSS-only config via `@tailwindcss/vite`), Radix UI, lucide-react.
- **Path alias: `~/*` → `./src/*`** (configured in both [vite.config.ts](vite.config.ts) and [tsconfig.json](tsconfig.json)). `worker/` is excluded from the root `tsconfig.json` (has its own [tsconfig.worker.json](tsconfig.worker.json), not wired into any script) and its files use relative imports (`../lib/...`), not `~/`.

## Commands

```bash
bun install            # Install deps (uses bun.lock)

# Development
bun run dev            # wrangler dev — runs the full Worker (API + assets) locally
bun run dev:client     # Vite dev server at http://localhost:3000, proxies /api to :8787 (wrangler dev)
bun run build          # vite build → dist/ (client assets only; wrangler bundles worker/ separately)
bun run deploy         # bun run build && wrangler deploy — ships assets + Worker to Cloudflare
bun run clean          # rm -rf .output dist dist-worker node_modules/.cache *.tsbuildinfo .wrangler

# Quality
bun run lint           # biome check .
bun run format         # biome format . --write
bun run type-check     # tsc --noEmit

# Tests (Vitest — see the Testing section; do NOT use `bun test`)
bun run test                          # Watch mode (vitest)
bun run test:run                      # Single run
bun run test:coverage                 # Coverage
bun run test:run path/to/file.test.ts # Single file
bun run test:run -t "test name"       # Single test by name pattern
```

## Architecture

### Data flow

There is a single import path:

```
YouTube URL → POST /api/youtube/resolve (youtubei.js) → video metadata (incl. signed caption base_urls)
           → client writes `media` row to IndexedDB
           → watch page self-drives:
               POST /api/youtube/captions       → captions, if a track exists (else NO_CAPTIONS; no server-side ASR fallback for YouTube)
           → client-side chunked translation:
               POST /api/postprocess in ≤100-segment / ≤10k-char chunks
               → each chunk written back to IndexedDB incrementally
           → watch/$mediaId subtitle sync        → user
```

The chunked post-process orchestrator is `runChunkedPostProcess` ([src/lib/subtitles/chunk-postprocess.ts](src/lib/subtitles/chunk-postprocess.ts)) — the 100-segment/10k-char chunking exists because `/api/postprocess` 400s (`TOO_MANY_SEGMENTS`) above 100 segments in one call. The watch page drives it through `useSubtitlePipeline` ([src/hooks/media/useSubtitlePipeline.ts](src/hooks/media/useSubtitlePipeline.ts)), which self-drives captions/translate with resume & regenerate support. Don't add a manual "fetch subtitles" button flow — the auto-trigger is the contract.

### Routing (client) & API (Cloudflare Worker)

File-based routes live in [src/routes/](src/routes/); the route tree is committed at [src/routeTree.gen.ts](src/routeTree.gen.ts). There is no bundler plugin in this repo that regenerates it (the Workers migration dropped `@tanstack/router-plugin`), so treat it as a static, hand-synced artifact — don't casually hand-edit it, but also don't assume it auto-updates when you add/remove a route file. The router is created in [src/router.tsx](src/router.tsx) (`getRouter()`).

- Page routes: `index.tsx`, `watch.$mediaId.tsx`, `settings.tsx`, `account.tsx`.
- Root: [src/routes/__root.tsx](src/routes/__root.tsx) — a plain layout component (provider stack `ThemeProvider → TranscriptionLanguageProvider → I18nProvider → QueryProvider` + error boundary/toaster/PWA register). It does **not** own `<html>`/document head — this is a client SPA now, so `<html>`, meta/SEO/PWA tags live in the static [index.html](index.html), and `src/main.tsx` mounts `RouterProvider` into `#root`.

**API routes are Hono handlers in `worker/`**, bundled directly into the Cloudflare Worker (not part of the Vite/TanStack Router build). Entry point: [worker/index.ts](worker/index.ts); routes live in `worker/routes/`, shared helpers in `worker/lib/`, middleware in `worker/middleware/`:

```ts
export const youtubeRoute = new Hono<{ Bindings: Env }>()
youtubeRoute.post('/resolve', async (c) => { /* ... */ })
```

- `postprocess` — Groq chat model (`openai/gpt-oss-120b`) for translation, annotations, and furigana; hard caps at 100 segments / request (`TOO_MANY_SEGMENTS` 400 above that — see the chunked orchestrator above). Rate-limited (20 req/min).
- `youtube/resolve` — Resolves a YouTube URL to video metadata via youtubei.js, including each caption track's signed Innertube `base_url`. Rate-limited (20 req/10 min).
- `youtube/captions` — Fetches a caption track by following its signed `base_url` (from `/resolve`) and normalizes it into segments. Returns `NO_CAPTIONS` (404) when no track is available. Rate-limited (20 req/10 min). There is no yt-dlp/ASR fallback in the Worker for videos without captions.

There is **no `/api/transcribe` route** — the audio-upload / Groq Whisper path was removed along with `worker/routes/transcribe.ts` and `worker/lib/groq-whisper.ts`.

Use `apiSuccess` / `apiError` from [worker/lib/api-response.ts](worker/lib/api-response.ts) for consistent envelopes, and the `rateLimit` middleware from [worker/middleware/rate-limit.ts](worker/middleware/rate-limit.ts) on any new public route (mount it in [worker/index.ts](worker/index.ts)). The rate limiter is **KV-backed** via `RATE_LIMIT_KV` — a sliding-window count keyed by `cf-connecting-ip` (falling back to `x-forwarded-for`, then Cloudflare's `colo` datacenter code, then a UA/Accept-Language fingerprint) so it survives across Worker invocations/isolates. Always identify clients by IP first — keying primarily on `colo` buckets every user in a datacenter together. That binding is currently **not** present in [wrangler.jsonc](wrangler.jsonc): the middleware no-ops without it (so the Worker still deploys and serves requests) and `wrangler.jsonc` carries the commented-out instructions to re-add it.

### State layering

| Layer | Tool | Purpose |
|---|---|---|
| Persistent | Dexie / IndexedDB | Media rows, subtitles, segments |
| Server cache | TanStack Query | Mutations, status polling, cross-component sync |
| UI / local | React hooks + Context | Player state, theme, language |

Query keys live next to their hooks; the canonical pattern is `subtitleKeys` in [src/hooks/media/subtitle-keys.ts](src/hooks/media/subtitle-keys.ts) (it is a standalone module precisely so `useSubtitlePipeline` and other consumers don't form an import cycle). `filesKeys` in [src/hooks/db/useFiles.ts](src/hooks/db/useFiles.ts) follows the same shape. When you add new server-state hooks, mirror that key-factory pattern so invalidation stays surgical.

### Database (Dexie, version 5)

Schema and operations are in [src/lib/db/db.ts](src/lib/db/db.ts). All access goes through the `DBUtils` object exported from the same file (generic CRUD + table-specific helpers). Don't reach into `db.media` etc. directly from components; go through `DBUtils` so error handling stays consistent.

**Live tables (v5):**
- `media` — one row per imported YouTube video (`kind: 'youtube'`, `externalId` = video id). The `kind` field is retained but is a single-member union now; the audio-only columns (`blob` / `fileName` / `fileSize` / `mimeType`) were dropped with the audio module.
- `subtitles` — subtitle row keyed by `mediaId` (`source` is always `'official'`).
- `segments` — individual timed cues; `segments.transcriptId` references `subtitles.id` (field name kept for backwards compatibility).

**Migration history:**
- v4 unified `files`/`transcripts` into `media`/`subtitles` and kept the two old tables as a read-only recovery window.
- v5 drops `files` and `transcripts` and purges the `kind: 'audio'` `media` rows that v4 wrote for v3 upgraders, together with their `subtitles`/`segments` children.

Do not edit a migration version that has already shipped — an existing browser only replays the versions above its current one, so a retroactive edit silently does nothing for real users. Add a new version instead. `src/lib/db/__tests__/migration-v4.test.ts` and `migration-v5.test.ts` each re-declare their version block by hand and must be updated together with `db.ts`.

**Dexie gotcha — dropping a table.** `stores()` merges its declarations across all versions (internally `versions.forEach(v => extend(storesSpec, v._cfg.storesSource))`), so *omitting* a table from a later version does **not** delete it. A table is only dropped by declaring it as `null`:

```ts
this.version(5).stores({ files: null, transcripts: null })
```

`DBUtils.deleteMedia(id)` deletes children-first in a transaction (segments → subtitles → media) — preserve that order; otherwise orphans accumulate.

When schema changes:
1. Bump the version in [src/lib/db/db.ts](src/lib/db/db.ts) (currently 5).
2. Add a `.version(n).stores(...).upgrade(...)` block — keep prior versions intact. Remember that a new version's `stores()` only needs the tables whose spec actually changes.
3. Update types in [src/types/](src/types/), and add/extend the matching migration spec under `src/lib/db/__tests__/`.

### Languages

Two distinct language axes, easy to confuse:

- **Source language** — the language of the imported video's caption track. It comes back from `/api/youtube/captions` and is stored on the `subtitles` row as `sourceLanguage`; the user does not pick it.
- **UI / translation target** — what the user reads (`I18nContext`) and what subtitles are translated into.

Both are configured via [TranscriptionLanguageContext](src/components/layout/contexts/TranscriptionLanguageContext.tsx) and [I18nContext](src/components/layout/contexts/I18nContext.tsx). Note the context still carries the historical `Transcription*` name and exposes only `learningLanguage.nativeLanguage` (= the translation target); `TRANSCRIPTION_LANGUAGES` and `TranscriptionLanguageCode` were removed with the audio module. Both support zh-CN, zh-TW, en, ja, ko and persist to localStorage. When adding a language, update `SUPPORTED_LANGUAGES` plus the i18n strings in [src/lib/i18n/](src/lib/i18n/).

### Blob URL lifecycle

Blob URLs from `URL.createObjectURL` leak unless revoked. The live path is **sentence recording** ([src/hooks/player/useSentenceRecorder.ts](src/hooks/player/useSentenceRecorder.ts)): each recording gets an object URL that is explicitly revoked when replaced or cleared. Follow the same pattern if you cache an object URL elsewhere — the former audio-player `WeakMap` cache was removed with the audio module.

### Shadowing rhythm feedback

The per-sentence timing readout (抢拍 / 合拍 / 拖拍 + onset latency + pace ratio) is the differentiator against score-only products, and it is computed entirely client-side — no cloud, no ASR. The layering is deliberate; keep browser APIs out of the pure layer:

- [src/lib/player/rhythm.ts](src/lib/player/rhythm.ts) — **pure** functions: PCM → RMS envelope → speech bounds → latency / pace ratio / verdict. No DOM, fully unit-tested in [__tests__/rhythm.test.ts](src/lib/player/__tests__/rhythm.test.ts).
- [src/lib/audio/decode.ts](src/lib/audio/decode.ts) — the only place Web Audio appears (Blob → mono PCM). Every failure path returns `null`; analysis must never throw into the practice loop.
- `useShadowingPractice` exposes `phaseStartedAt`, the moment the current phase began. Entering `gap` is the zero point ("the original just finished, now it's your turn"), and it comes from a monotonic clock (`nowMs()`), not `Date.now()`.
- `SentenceRecording.rhythm` / `rhythmStatus` carry the result back to the UI; `RecordingBar` renders it.

Two semantic rules that must hold:

1. `RhythmReference.basis` decides whether an onset latency is meaningful. Only `'sentenceEnd'` may show it; `'manual'` (user pressed record at an arbitrary moment) shows the pace ratio alone.
2. The pace ratio is measured against the **natural** segment duration (`segment.end - segment.start`), never the wall-clock length of 0.75× slowed playback — otherwise normal-speed reading would read as 33% too fast.

The verdict is a hint, never a score: no grades, no stars, no streaks, and no error-red for "late". When analysis is impossible, say why (unsupported / no speech / analyzing) instead of inventing a number.

### Errors and toasts

- `handleError` / `createError` / `isAppError` / `logError` in [src/lib/utils/error-handler.ts](src/lib/utils/error-handler.ts) normalize any thrown value into an `AppError` and log it through the shared logger.
- `getFriendlyErrorMessage` turns an error into user-facing copy (it is currently only covered by `src/lib/utils/__tests__/error-handler-version.test.ts`).
- User-visible notifications use **sonner** ([src/components/ui/sonner.tsx](src/components/ui/sonner.tsx)).
- The transcription-specific recovery helpers were removed with the audio module; subtitle-pipeline failures surface through the pipeline's own `failed` stage plus the shared error handler.

## Testing

Uses **Vitest** (not Bun's native `bun test`). DOM environment is **happy-dom** and IndexedDB is **fake-indexeddb**.

- Config: [vitest.config.ts](vitest.config.ts) — sets `environment: 'happy-dom'` and `setupFiles: ['./src/__tests__/setup.ts']`.
- Setup file [src/__tests__/setup.ts](src/__tests__/setup.ts) wires up `fake-indexeddb/auto`, jest-dom matchers (`@testing-library/jest-dom/vitest`), and mocks `@tanstack/react-router` hooks (`useNavigate`/`useLocation`/`useSearch`/`useParams`) and `sonner`.
- Tests are colocated in `__tests__/` next to the code they cover.
- When mocking router navigation or toasts in a new test, rely on the global mocks in setup rather than re-mocking.

**Commands:**
```bash
bun run test:run               # Run all tests once (alias: vitest run)
bunx vitest run <path>         # Single file
bun run test                   # Watch mode (vitest)
bun run test:coverage          # Coverage report
```

> **Do NOT use `bun test`** — it ignores `vitest.config.ts` and fails with "document is not defined". There is no `bunfig.toml` in this repo.

## Theming

Four themes (dark, light, system, high-contrast) implemented via CSS custom properties in [src/styles/app.css](src/styles/app.css) and switched by `ThemeContext` (`data-theme`). Tailwind v4 is **CSS-only**: theme tokens live in the `@theme {}` block — do **not** add `tailwind.config.*` or `postcss.config.*`, and don't introduce arbitrary Tailwind values that duplicate existing tokens. To verify a token mapping actually works, build and grep the emitted CSS (`bun run build`, then `ls -t dist/assets/*.css | head -1`) — a missing `@theme` mapping fails **silently**: no error, no generated rule.

## Deployment (Cloudflare Workers)

Deployed as a Cloudflare Worker, not a container. `bun run deploy` (`vite build && wrangler deploy`) builds the client SPA into `dist/` and ships it as Worker Assets alongside the Hono API bundled from [worker/index.ts](worker/index.ts). Config lives in [wrangler.jsonc](wrangler.jsonc): the `ASSETS` binding (`directory: dist`, SPA fallback via `not_found_handling: single-page-application`), and observability/logs/traces. The `RATE_LIMIT_KV` binding is optional and currently absent (its re-add instructions are commented in place). Secrets (`GROQ_API_KEY`) are set via `wrangler secret put`, not committed or put in `vars`.

There is **no Docker/Dokploy path** — the Dockerfile, compose file, and `docs/DOKPLOY.md` that targeted a TanStack Start server bundle were removed along with that deployment model.

## Environment Variables

```env
GROQ_API_KEY=                  # Required — Groq LLM post-processing. Set as a Worker secret (wrangler secret put GROQ_API_KEY); locally put it in .dev.vars, NOT .env.
```

`RATE_LIMIT_KV` is a KV namespace binding read by the rate-limit middleware; it is optional and currently unbound (see the comment in [wrangler.jsonc](wrangler.jsonc)), and `ASSETS` is the `dist/` assets binding.

Local dev reads `GROQ_API_KEY` from `.dev.vars` — copy [.dev.vars.example](.dev.vars.example) and fill it in. There is no `.env` in this project any more.

Never commit `.dev.vars` (or any `.env*`).

## Code style

Biome handles both lint and format ([biome.json](biome.json)). Formatter: 2-space indent, 100-column lines, **single quotes**, semicolons as-needed. Biome manages import order. Don't introduce ESLint/Prettier — Biome is the single source of truth.
