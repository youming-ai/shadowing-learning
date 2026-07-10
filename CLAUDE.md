# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shadowing Learning is a language-shadowing practice app. It transcribes audio with Groq Whisper, post-processes the text (normalization, translation, annotations, furigana), stores everything client-side in IndexedDB, and plays it back with time-synced subtitles.

The architecture is **client-heavy**: the only server work is two Groq API calls. There is no application database — files, transcripts, and segments all live in the browser via Dexie.

## Toolchain

This project runs on **Bun + Vite + TanStack Start** (it was migrated off Next.js + pnpm — `components.json` still contains stale shadcn/Next.js defaults; ignore it).

- **Runtime / package manager: Bun ≥1.2.0.** Do **not** use `npm`/`pnpm`/`yarn`/`node`. The lockfile is `bun.lock`.
- **Build/dev: Vite 8** with the `@tanstack/react-start` plugin ([vite.config.ts](vite.config.ts)). Dev server port is **3000**.
- **Routing: TanStack Router** (file-based) + **TanStack Start** for server route handlers. There is no Next.js App Router.
- **View: React 19, Tailwind CSS v4** (CSS-only config via `@tailwindcss/vite`), Radix UI, lucide-react.
- **Path alias: `~/*` → `./src/*`** (configured in both [vite.config.ts](vite.config.ts) and [tsconfig.json](tsconfig.json)). Note: `components.json` still lists shadcn's `@/` aliases — that file is stale; the real alias is `~`.

## Commands

```bash
bun install            # Install deps (uses bun.lock)

# Development
bun run dev            # Vite dev server at http://localhost:3000
bun run build          # Production build → dist/ (incl. dist/server/server.js)
bun run start          # Run the built server: bun run dist/server/server.js
bun run preview        # Preview the production build
bun run clean          # rm -rf .output dist node_modules/.cache

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
          → POST /api/postprocess (Groq LLM)     → normalized text / translation / furigana
          → IndexedDB (Dexie)                    → TanStack Query cache
          → watch/$mediaId subtitle sync         → user
```

**YouTube import path:**
```
YouTube URL → POST /api/youtube/resolve (youtubei.js) → video metadata
           → client writes `media` row to IndexedDB
           → watch page self-drives:
               POST /api/youtube/captions       → captions (if available)
               POST /api/youtube/transcribe      → yt-dlp + Groq Whisper (NO_CAPTIONS fallback)
           → client-side chunked translation:
               POST /api/postprocess in ≤100-segment / ≤10k-char chunks
               → each chunk written back to IndexedDB incrementally
           → watch/$mediaId subtitle sync        → user
```

The audio flow is driven by `usePlayerDataQuery` ([src/hooks/player/usePlayerDataQuery.ts](src/hooks/player/usePlayerDataQuery.ts)); the YouTube watch page uses `useSubtitlePipeline` which self-drives captions/transcribe/translate with resume & regenerate support. Don't add a separate "transcribe" button flow — the auto-trigger is the contract.

### Routing & API (TanStack Start)

File-based routes live in [src/routes/](src/routes/); the route tree is **generated** into [src/routeTree.gen.ts](src/routeTree.gen.ts) by the Vite plugin — don't hand-edit it. The router is created in [src/router.tsx](src/router.tsx) (`getRouter()`).

- Page routes: `index.tsx`, `player.$fileId.tsx`, `settings.tsx`, `account.tsx`.
- Root: [src/routes/__root.tsx](src/routes/__root.tsx) — owns `<html>`, document head (`HeadContent`/`Scripts`, SEO/JSON-LD/PWA meta), the CSS import (`../styles/app.css?url`), and the provider stack: `ThemeProvider → TranscriptionLanguageProvider → I18nProvider → QueryProvider`.

**API routes are TanStack Start server handlers**, not Next.js route handlers. They live in [src/routes/api/](src/routes/api/) and use:

```ts
export const Route = createFileRoute('/api/transcribe')({
  server: { handlers: { POST: async ({ request }) => { /* ... */ } } },
})
```

- `transcribe` — Groq `whisper-large-v3-turbo`. Zod-validated, per-IP sliding-window rate limit, 25 MB cap, returns `TranscriptionSegment[]`.
- `postprocess` — Groq chat model (`openai/gpt-oss-120b`) for normalized text, translation, annotations, furigana.
- `youtube/resolve` — Resolves a YouTube URL to video metadata via youtubei.js. Per-IP rate limit: 20 requests / 10 min.
- `youtube/captions` — Fetches and normalizes YouTube captions for a videoId. Per-IP rate limit: 20 requests / 10 min. Returns `NO_CAPTIONS` (404) when no track is available.
- `youtube/transcribe` — No-caption fallback: downloads low-bitrate audio via yt-dlp, then transcribes with Groq Whisper. Per-IP rate limit: 4 requests / hr; process-level concurrency semaphore of 1 (only one yt-dlp+Whisper job at a time); daily global quota of 24 per UTC day.

Use `apiSuccess` / `apiError` from [src/lib/utils/api-response.ts](src/lib/utils/api-response.ts) for consistent envelopes, and `checkRateLimit` from [src/lib/utils/rate-limiter.ts](src/lib/utils/rate-limiter.ts) on any new public endpoint. The rate limiter is **in-memory only** — fine for the single-container Dokploy deployment, but it does not survive a restart and would break under multi-replica scaling.

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

## Deployment (Docker + Dokploy)

Not on Vercel. Deployed as a Docker container on a VPS via Dokploy. See [docs/DOKPLOY.md](docs/DOKPLOY.md).

- [Dockerfile](Dockerfile) — multi-stage build on `oven/bun:1-alpine`: `bun install --frozen-lockfile`, `bun run build`, ships `dist/`, runs `bun run dist/server/server.js`. Exposes 3000. The runtime stage also installs **yt-dlp** (official release binary, pinned by `YTDLP_VERSION`), `python3`, and `nodejs` (required by yt-dlp's JS extractor).
- [docker-compose.yml](docker-compose.yml) — uses `expose: 3000` (not `ports:`) so Dokploy's Traefik reaches it via the Docker network.
- **Local dev prerequisite for the YouTube no-caption path**: `brew install yt-dlp` (the `/api/youtube/transcribe` route calls yt-dlp; without it the route returns 501).
- **Traefik prerequisite**: The in-memory per-IP rate limiter trusts the first element of the `x-forwarded-for` header. Traefik **must** sanitize this header (set `middlewares: X-Forwarded-For: Replace`) before forwarding to the container, or clients can spoof their IP and bypass rate limits.

Local container smoke test: `docker compose up --build`.

## Environment Variables

```env
GROQ_API_KEY=                  # Required — Groq Whisper + LLM (server-side)
VITE_APP_URL=                  # Client-side app URL; must be VITE_-prefixed to reach the browser. Defaults to http://localhost:3000
```

Set these in Dokploy in production; never commit `.env*`. See [.env.example](.env.example).

## Code style

Biome handles both lint and format ([biome.json](biome.json)). Formatter: 2-space indent, 100-column lines, **single quotes**, semicolons as-needed. Biome manages import order. Don't introduce ESLint/Prettier — Biome is the single source of truth.
