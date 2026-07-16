# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shadowing Learning is a language-shadowing practice app. It transcribes audio with Groq Whisper, post-processes the text (normalization, translation, annotations, furigana), stores everything client-side in IndexedDB, and plays it back with time-synced subtitles.

The architecture is **client-heavy**: almost all server work is a handful of Groq/YouTube API calls behind a thin Cloudflare Worker. There is no application database — files, transcripts, and segments all live in the browser via Dexie.

## Toolchain

This project runs on **Bun + Vite + TanStack Router, deployed to Cloudflare Workers** (it was migrated off Next.js + pnpm, and later off a TanStack Start server onto Workers — `components.json` still contains stale shadcn/Next.js defaults; ignore it).

- **Runtime / package manager: Bun ≥1.2.0** for local dev/build/test. Do **not** use `npm`/`pnpm`/`yarn`/`node`. The lockfile is `bun.lock`. Production runs on the Cloudflare Workers runtime, not Bun.
- **Build: Vite 8** ([vite.config.ts](vite.config.ts)) builds the client SPA into `dist/`. There is no server-rendering plugin — the app is a static bundle served as Worker Assets.
- **API: Hono**, mounted directly in the Worker entry ([worker/index.ts](worker/index.ts)) — see [wrangler.jsonc](wrangler.jsonc) (`main: worker/index.ts`).
- **Routing: TanStack Router**, file-based, client-only (no server route handlers on this side — those live in `worker/`, see below).
- **View: React 19, Tailwind CSS v4** (CSS-only config via `@tailwindcss/vite`), Radix UI, lucide-react.
- **Path alias: `~/*` → `./src/*`** (configured in both [vite.config.ts](vite.config.ts) and [tsconfig.json](tsconfig.json)). Note: `components.json` still lists shadcn's `@/` aliases — that file is stale; the real alias is `~`. `worker/` is excluded from the root `tsconfig.json` (has its own [tsconfig.worker.json](tsconfig.worker.json), not wired into any script) and its files use relative imports (`../lib/...`), not `~/`.

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

# Tests (Bun's built-in test runner)
bun test                       # Single run (NOT watch — add --watch for watch mode)
bun test --watch               # Watch mode
bun test --coverage            # Coverage
bun test path/to/file.test.ts  # Single file
bun test -t "test name"        # Single test by name pattern
```

`bun run test` and `bun run test:run` are both aliases for `bun test`.

## Architecture

### Data flow

**Audio file upload path:**
```
Audio file → POST /api/transcribe (Groq Whisper) → segments
          → IndexedDB (Dexie)                    → TanStack Query cache
          → client-side chunked post-process:
              POST /api/postprocess (Groq LLM) in ≤100-segment / ≤10k-char chunks
              → normalized text / translation / furigana, written back incrementally
          → watch/$mediaId subtitle sync         → user
```

**YouTube import path:**
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

Both paths now share the same chunked post-process orchestrator, `runChunkedPostProcess` ([src/lib/subtitles/chunk-postprocess.ts](src/lib/subtitles/chunk-postprocess.ts)) — the 100-segment/10k-char chunking exists because `/api/postprocess` 400s (`TOO_MANY_SEGMENTS`) above 100 segments in one call. The audio flow is driven by `useTranscription` ([src/hooks/api/useTranscription.ts](src/hooks/api/useTranscription.ts)); the YouTube watch page uses `useSubtitlePipeline` ([src/hooks/media/useSubtitlePipeline.ts](src/hooks/media/useSubtitlePipeline.ts)) which self-drives captions/translate with resume & regenerate support. Don't add a separate "transcribe" button flow — the auto-trigger is the contract.

### Routing (client) & API (Cloudflare Worker)

File-based routes live in [src/routes/](src/routes/); the route tree is committed at [src/routeTree.gen.ts](src/routeTree.gen.ts). There is no bundler plugin in this repo that regenerates it (the Workers migration dropped `@tanstack/router-plugin`), so treat it as a static, hand-synced artifact — don't casually hand-edit it, but also don't assume it auto-updates when you add/remove a route file. The router is created in [src/router.tsx](src/router.tsx) (`getRouter()`).

- Page routes: `index.tsx`, `watch.$mediaId.tsx`, `settings.tsx`, `account.tsx`, `me.tsx`.
- Root: [src/routes/__root.tsx](src/routes/__root.tsx) — a plain layout component (provider stack `ThemeProvider → TranscriptionLanguageProvider → I18nProvider → QueryProvider` + error boundary/toaster/PWA register). It does **not** own `<html>`/document head — this is a client SPA now, so `<html>`, meta/SEO/PWA tags live in the static [index.html](index.html), and `src/main.tsx` mounts `RouterProvider` into `#root`.

**API routes are Hono handlers in `worker/`**, bundled directly into the Cloudflare Worker (not part of the Vite/TanStack Router build). Entry point: [worker/index.ts](worker/index.ts); routes live in `worker/routes/`, shared helpers in `worker/lib/`, middleware in `worker/middleware/`:

```ts
export const transcribeRoute = new Hono<{ Bindings: Env }>()
transcribeRoute.post("/", async (c) => { /* ... */ })
```

- `transcribe` — Groq `whisper-large-v3`. 25 MB cap, returns transcription segments. Rate-limited (10 req/min).
- `postprocess` — Groq chat model (`openai/gpt-oss-120b`) for normalized text, translation, annotations, furigana; hard caps at 100 segments / request (`TOO_MANY_SEGMENTS` 400 above that — see the chunked orchestrator above). Rate-limited (20 req/min).
- `youtube/resolve` — Resolves a YouTube URL to video metadata via youtubei.js, including each caption track's signed Innertube `base_url`. Rate-limited (20 req/10 min).
- `youtube/captions` — Fetches a caption track by following its signed `base_url` (from `/resolve`) and normalizes it into segments. Returns `NO_CAPTIONS` (404) when no track is available. Rate-limited (20 req/10 min). There is no yt-dlp/ASR fallback in the Worker for videos without captions.

Use `apiSuccess` / `apiError` from [worker/lib/api-response.ts](worker/lib/api-response.ts) for consistent envelopes, and the `rateLimit` middleware from [worker/middleware/rate-limit.ts](worker/middleware/rate-limit.ts) on any new public route (mount it in [worker/index.ts](worker/index.ts)). The rate limiter is **KV-backed** (`RATE_LIMIT_KV`, bound in [wrangler.jsonc](wrangler.jsonc)) — a sliding-window count keyed by `cf-connecting-ip` (falling back to `x-forwarded-for`, then Cloudflare's `colo` datacenter code, then a UA/Accept-Language fingerprint) so it survives across Worker invocations/isolates. Always identify clients by IP first — keying primarily on `colo` buckets every user in a datacenter together.

### State layering

| Layer | Tool | Purpose |
|---|---|---|
| Persistent | Dexie / IndexedDB | Files (with Blob), transcripts, segments |
| Server cache | TanStack Query | Mutations, status polling, cross-component sync |
| UI / local | React hooks + Context | Player state, theme, language |

Query keys live next to their hooks; the canonical pattern is `transcriptionKeys` in [src/hooks/api/useTranscription.ts](src/hooks/api/useTranscription.ts). When you add new server-state hooks, mirror that key-factory pattern so invalidation stays surgical.

### Database (Dexie, version 4 — two-phase migration)

Schema and operations are in [src/lib/db/db.ts](src/lib/db/db.ts). All access goes through the `DBUtils` object exported from the same file (generic CRUD + table-specific helpers). Don't reach into `db.media` etc. directly from components; go through `DBUtils` so error handling stays consistent.

**Live tables (v4):**
- `media` — unified media row for both uploaded audio and YouTube videos (`kind: 'audio' | 'youtube'`).
- `subtitles` — subtitle/transcript row keyed by `mediaId`.
- `segments` — individual timed cues; `segments.transcriptId` references `subtitles.id` (field name kept for backwards compatibility).

**Read-only backup tables (v4, pending v5 deletion):**
- `files` and `transcripts` — retained from v3 so users can recover data. The v4 upgrade migration copies all rows into `media`/`subtitles`. A future v5 release will drop these tables.

`DBUtils.deleteMedia(id)` deletes children-first in a transaction (segments → subtitles → media) — preserve that order; otherwise orphans accumulate.

When schema changes:
1. Bump the version in [src/lib/db/db.ts](src/lib/db/db.ts) (currently 4).
2. Add a `.version(n).stores(...).upgrade(...)` block — keep prior versions intact.
3. Update types in [src/types/](src/types/).

### Languages

Two distinct language axes, easy to confuse:

- **Transcription language** — what Whisper expects the audio to be in.
- **UI / translation target** — what the user reads (`I18nContext`).

Both are configured via [TranscriptionLanguageContext](src/components/layout/contexts/TranscriptionLanguageContext.tsx) and [I18nContext](src/components/layout/contexts/I18nContext.tsx); `TRANSCRIPTION_LANGUAGES` is aliased to `SUPPORTED_LANGUAGES`. Both support zh-CN, zh-TW, en, ja, ko and persist to localStorage. When adding a language, update `SUPPORTED_LANGUAGES` plus the i18n strings in [src/lib/i18n/](src/lib/i18n/).

### Audio resource lifecycle

Blob URLs from `URL.createObjectURL` leak unless revoked. The player caches them keyed by `Blob` in a `WeakMap` so the URL is reclaimed when the blob is garbage-collected, and explicitly revokes on component unmount. If you cache an object URL elsewhere, follow the same pattern — the audio path is the most common source of memory regressions.

### Errors and toasts

- `handleError` and `ErrorHandler` in [src/lib/utils/error-handler.ts](src/lib/utils/error-handler.ts) classify errors and decide retry/backoff.
- User-visible notifications use **sonner** ([src/components/ui/sonner.tsx](src/components/ui/sonner.tsx)).
- Transcription-specific recovery lives in [src/lib/utils/transcription-recovery.ts](src/lib/utils/transcription-recovery.ts) and [src/lib/utils/transcription-error-handler.ts](src/lib/utils/transcription-error-handler.ts).

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

Four themes (dark, light, system, high-contrast) implemented via CSS custom properties in [src/styles/app.css](src/styles/app.css) and switched by `ThemeContext` (`data-theme`). Tailwind v4 is **CSS-only**: theme tokens live in the `@theme {}` block — do **not** add `tailwind.config.*` or `postcss.config.*`, and don't introduce arbitrary Tailwind values that duplicate existing tokens. A debugger overlay is bound to **Ctrl/Cmd+Shift+T** ([src/components/ui/ThemeDebugger.tsx](src/components/ui/ThemeDebugger.tsx)) — use it when verifying token coverage on new components.

## Deployment (Cloudflare Workers)

Deployed as a Cloudflare Worker, not a container. `bun run deploy` (`vite build && wrangler deploy`) builds the client SPA into `dist/` and ships it as Worker Assets alongside the Hono API bundled from [worker/index.ts](worker/index.ts). Config lives in [wrangler.jsonc](wrangler.jsonc): the `RATE_LIMIT_KV` KV namespace binding, the `ASSETS` binding (`directory: dist`, SPA fallback via `not_found_handling: single-page-application`), and observability/logs/traces. Secrets (`GROQ_API_KEY`) are set via `wrangler secret put`, not committed or put in `vars`.

**The `Dockerfile`, `docker-compose.yml`, and [docs/DOKPLOY.md](docs/DOKPLOY.md) are historical** — they describe a prior Docker/Dokploy deployment (with a bundled yt-dlp fallback for caption-less YouTube videos) that this repo no longer runs. There is no `dist/server/server.js`, no in-container yt-dlp, and no Traefik in front of the app; do not treat those files as current deployment docs.

## Environment Variables

```env
GROQ_API_KEY=                  # Required — Groq Whisper + LLM. Set as a Worker secret (wrangler secret put GROQ_API_KEY), not a var.
VITE_APP_URL=                  # Client-side app URL; must be VITE_-prefixed to reach the browser. Set via wrangler.jsonc `vars` (defaults to http://localhost:3000).
```

Never commit `.env*`. See [.env.example](.env.example).

## Code style

Biome handles both lint and format ([biome.json](biome.json)). Formatter: 2-space indent, 100-column lines, **single quotes**, semicolons as-needed. Biome manages import order. Don't introduce ESLint/Prettier — Biome is the single source of truth.
