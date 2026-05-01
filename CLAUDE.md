# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shadowing Learning is a language-shadowing practice app. It transcribes audio with Groq Whisper, post-processes the text, stores everything client-side in IndexedDB, and plays it back with time-synced subtitles.

The architecture is **client-heavy**: the only server work is two API calls to Groq. There is no application database — files, transcripts, and segments all live in the browser via Dexie.

## Commands

```bash
# Development
pnpm dev               # Next.js dev server at http://localhost:3000
pnpm build             # Production build (output: "standalone")
pnpm start             # Run the production build

# Quality
pnpm lint              # Biome check
pnpm format            # Biome format --write
pnpm type-check        # tsc --noEmit

# Tests (Vitest + jsdom + fake-indexeddb)
pnpm test              # Watch mode
pnpm test:run          # Single run
pnpm test:coverage     # Coverage report (v8)
# Single test file: pnpm test:run path/to/file.test.ts
# Single test name: pnpm test:run -t "test name pattern"
```

Engines: **Node ≥20, pnpm ≥9** (lockfile pinned to pnpm 10.22.0).

## Architecture

### Data flow

```
Audio file → POST /api/transcribe (Groq Whisper) → segments
          → POST /api/postprocess (Groq LLM)     → normalized text / translation
          → IndexedDB (Dexie)                    → React Query cache
          → PlayerPage subtitle sync             → user
```

The flow is driven by `usePlayerDataQuery` ([src/hooks/player/usePlayerDataQuery.ts](src/hooks/player/usePlayerDataQuery.ts)): when the player mounts and a file lacks a transcript, it auto-triggers transcription and the UI reacts via React Query invalidation. Don't add a separate "transcribe" button flow — the auto-trigger is the contract.

### State layering

| Layer | Tool | Purpose |
|---|---|---|
| Persistent | Dexie / IndexedDB | Files (with Blob), transcripts, segments |
| Server cache | TanStack Query | Mutations, status polling, cross-component sync |
| UI / local | React hooks + Context | Player state, theme, language |

Query keys live next to their hooks; the canonical pattern is `transcriptionKeys` in [src/hooks/api/useTranscription.ts](src/hooks/api/useTranscription.ts). When you add new server-state hooks, mirror that key-factory pattern so invalidation stays surgical.

### Database (Dexie, version 3)

Schema and operations are in [src/lib/db/db.ts](src/lib/db/db.ts). Three tables — `files`, `transcripts`, `segments` — joined by `fileId` and `transcriptId`. All access goes through the `DBUtils` object exported from the same file (generic CRUD + table-specific helpers). Don't reach into `db.files` etc. directly from components; go through `DBUtils` so error handling stays consistent.

`DBUtils.deleteFile(id)` deletes children-first in a transaction — preserve that order if you touch it; otherwise orphans accumulate.

When schema changes:
1. Bump the version in [src/lib/db/db.ts](src/lib/db/db.ts) (currently 3).
2. Add a `.version(n).stores(...).upgrade(...)` block — keep prior versions intact.
3. Update types in [src/types/db/](src/types/db/).

### API routes

All under [src/app/api/](src/app/api/):

- `transcribe` — Groq Whisper-large-v3-turbo. Validates with Zod, enforces a per-IP sliding-window rate limit, returns `TranscriptionSegment[]`.
- `postprocess` — Groq LLM for normalized text, translation, annotations, furigana.
- `health` — liveness probe (used by Dokploy).
- `performance` — Web Vitals ingestion endpoint, gated by `PERFORMANCE_ADMIN_TOKEN`.

Use `apiSuccess` / `apiError` from [src/lib/utils/api-response.ts](src/lib/utils/api-response.ts) for consistent envelopes, and `checkRateLimit` from [src/lib/utils/rate-limiter.ts](src/lib/utils/rate-limiter.ts) on any new public endpoint. The rate limiter is **in-memory only** — fine for the single-container Dokploy deployment, but it does not survive a restart and would break under multi-replica scaling.

### Languages

Two distinct language axes, easy to confuse:

- **Transcription language** — what Whisper expects the audio to be in. Configured via `TranscriptionLanguageContext` ([src/components/layout/contexts/TranscriptionLanguageContext.tsx](src/components/layout/contexts/TranscriptionLanguageContext.tsx)).
- **UI / translation target** — what the user reads. Set via `I18nContext`.

Both axes support zh-CN, zh-TW, en, ja, ko and persist to localStorage. When adding a new language, update both `SUPPORTED_LANGUAGES` and `TRANSCRIPTION_LANGUAGES` plus the i18n strings in [src/lib/i18n/translations.ts](src/lib/i18n/translations.ts).

### Audio resource lifecycle

Blob URLs from `URL.createObjectURL` leak unless revoked. The player caches them keyed by `Blob` in a `WeakMap` so the URL is reclaimed when the blob is garbage-collected, and explicitly revokes on component unmount. If you cache an object URL elsewhere, follow the same pattern — the audio path is the most common source of memory regressions.

### Errors and toasts

- `handleError` and `ErrorHandler` in [src/lib/utils/error-handler.ts](src/lib/utils/error-handler.ts) classify errors and decide retry/backoff.
- User-visible notifications use **sonner** ([src/components/ui/sonner.tsx](src/components/ui/sonner.tsx)) — not `react-hot-toast`.
- Transcription-specific recovery lives in [src/lib/utils/transcription-recovery.ts](src/lib/utils/transcription-recovery.ts) and [src/lib/utils/transcription-error-handler.ts](src/lib/utils/transcription-error-handler.ts).

## Deployment (Docker + Dokploy)

The project is **not** on Vercel. It's deployed as a Docker container on a VPS via Dokploy. See [docs/DOKPLOY.md](docs/DOKPLOY.md).

- [Dockerfile](Dockerfile) — multi-stage build on `node:22-alpine`, runs `pnpm build`, ships `.next/standalone` as `node server.js`.
- [docker-compose.yml](docker-compose.yml) — uses `expose: 3000` (not `ports:`) so Dokploy's Traefik can reach it via the Docker network without binding the host port.
- Next.js is configured with `output: "standalone"` in [next.config.js](next.config.js) so this build mode works.

Local container smoke test: `docker compose up --build`.

## Environment Variables

```env
GROQ_API_KEY=                  # Required — Groq Whisper + LLM
NEXT_PUBLIC_APP_URL=           # Optional — used by metadata, robots, sitemap
PERFORMANCE_ADMIN_TOKEN=       # Optional — gates /api/performance ingestion
```

Set these in Dokploy in production; never commit `.env*`.

## Theming

Four themes (dark, light, system, high-contrast) implemented via CSS custom properties in [src/styles/globals.css](src/styles/globals.css) and switched by `ThemeContext`. A debugger overlay is bound to **Ctrl/Cmd+Shift+T** ([src/components/ui/ThemeDebugger.tsx](src/components/ui/ThemeDebugger.tsx)) — use it when verifying token coverage on new components.

## Testing

Vitest with jsdom and `fake-indexeddb`. Setup file: [src/__tests__/setup.ts](src/__tests__/setup.ts). Mocks use `vi.fn()` (not `jest.fn()`). Tests are colocated in `__tests__/` next to the code they cover. Coverage is set up but not enforced in CI.

## Code style

Biome handles both lint and format. Notable overrides in [biome.json](biome.json): `noExplicitAny` is off, `noUnusedVariables` is a warning, `useSemanticElements` is off. Formatter: 2-space indent, 100-column lines.
