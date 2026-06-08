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

```
Audio file → POST /api/transcribe (Groq Whisper) → segments
          → POST /api/postprocess (Groq LLM)     → normalized text / translation / furigana
          → IndexedDB (Dexie)                    → TanStack Query cache
          → player.$fileId subtitle sync         → user
```

The flow is driven by `usePlayerDataQuery` ([src/hooks/player/usePlayerDataQuery.ts](src/hooks/player/usePlayerDataQuery.ts)): when the player mounts and a file lacks a transcript, it auto-triggers transcription and the UI reacts via React Query invalidation. Don't add a separate "transcribe" button flow — the auto-trigger is the contract.

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
- `health` — liveness probe (used by Dokploy).
- `performance` — Web Vitals ingestion, gated by `PERFORMANCE_ADMIN_TOKEN`.

Use `apiSuccess` / `apiError` from [src/lib/utils/api-response.ts](src/lib/utils/api-response.ts) for consistent envelopes, and `checkRateLimit` from [src/lib/utils/rate-limiter.ts](src/lib/utils/rate-limiter.ts) on any new public endpoint. The rate limiter is **in-memory only** — fine for the single-container Dokploy deployment, but it does not survive a restart and would break under multi-replica scaling.

### State layering

| Layer | Tool | Purpose |
|---|---|---|
| Persistent | Dexie / IndexedDB | Files (with Blob), transcripts, segments |
| Server cache | TanStack Query | Mutations, status polling, cross-component sync |
| UI / local | React hooks + Context | Player state, theme, language |

Query keys live next to their hooks; the canonical pattern is `transcriptionKeys` in [src/hooks/api/useTranscription.ts](src/hooks/api/useTranscription.ts). When you add new server-state hooks, mirror that key-factory pattern so invalidation stays surgical.

### Database (Dexie, version 3)

Schema and operations are in [src/lib/db/db.ts](src/lib/db/db.ts). Three tables — `files`, `transcripts`, `segments` — joined by `fileId` and `transcriptId`. All access goes through the `DBUtils` object exported from the same file (generic CRUD + table-specific helpers). Don't reach into `db.files` etc. directly from components; go through `DBUtils` so error handling stays consistent.

`DBUtils.deleteFile(id)` deletes children-first in a transaction (segments → transcripts → file) — preserve that order if you touch it; otherwise orphans accumulate.

When schema changes:
1. Bump the version in [src/lib/db/db.ts](src/lib/db/db.ts) (currently 3).
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

Uses **Bun's built-in test runner** (`bun test`) — not Vitest, though the test code uses Vitest-style `vi.fn()` / `vi.mock()` and `bun:test` provides that API. DOM is **happy-dom** (not jsdom) and IndexedDB is **fake-indexeddb**.

- The setup file [src/__tests__/setup.ts](src/__tests__/setup.ts) is preloaded via `bunfig.toml` (`[test] preload = [...]`). It wires up happy-dom globals, `fake-indexeddb/auto`, jest-dom matchers, and mocks `@tanstack/react-router` hooks (`useNavigate`/`useLocation`/`useSearch`/`useParams`) and `sonner`.
- Tests are colocated in `__tests__/` next to the code they cover.
- When mocking router navigation or toasts in a new test, rely on the global mocks in setup rather than re-mocking.

## Theming

Four themes (dark, light, system, high-contrast) implemented via CSS custom properties in [src/styles/app.css](src/styles/app.css) and switched by `ThemeContext` (`data-theme`). Tailwind v4 is **CSS-only**: theme tokens live in the `@theme {}` block — do **not** add `tailwind.config.*` or `postcss.config.*`, and don't introduce arbitrary Tailwind values that duplicate existing tokens. A debugger overlay is bound to **Ctrl/Cmd+Shift+T** ([src/components/ui/ThemeDebugger.tsx](src/components/ui/ThemeDebugger.tsx)) — use it when verifying token coverage on new components.

## Deployment (Docker + Dokploy)

Not on Vercel. Deployed as a Docker container on a VPS via Dokploy. See [docs/DOKPLOY.md](docs/DOKPLOY.md).

- [Dockerfile](Dockerfile) — multi-stage build on `oven/bun:1-alpine`: `bun install --frozen-lockfile`, `bun run build`, ships `dist/`, runs `bun run dist/server/server.js`. Exposes 3000.
- [docker-compose.yml](docker-compose.yml) — uses `expose: 3000` (not `ports:`) so Dokploy's Traefik reaches it via the Docker network.

Local container smoke test: `docker compose up --build`.

## Environment Variables

```env
GROQ_API_KEY=                  # Required — Groq Whisper + LLM (server-side)
VITE_APP_URL=                  # Client-side app URL; must be VITE_-prefixed to reach the browser. Defaults to http://localhost:3000
PERFORMANCE_ADMIN_TOKEN=       # Optional — gates /api/performance ingestion
```

Set these in Dokploy in production; never commit `.env*`. See [.env.example](.env.example).

## Code style

Biome handles both lint and format ([biome.json](biome.json)). Formatter: 2-space indent, 100-column lines, **single quotes**, semicolons as-needed. Biome manages import order. Don't introduce ESLint/Prettier — Biome is the single source of truth.
