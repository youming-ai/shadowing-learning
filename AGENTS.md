# Agent Instructions

## Project Overview

Web-based language shadowing learning application with AI-powered audio transcription (Whisper via Groq). Client-persisted with IndexedDB (Dexie). A Vite 8 SPA (React 19 + TanStack Router file-based routing, TypeScript strict mode) built with Bun, served together with its API by a single Cloudflare Worker (Hono). Not TanStack Start — there is no server-side render or server-route layer.

## Prerequisites

- Bun >=1.2.0 (required; do not use npm/pnpm/yarn/node)
- Wrangler (dev dependency) for running/deploying the Worker
- `GROQ_API_KEY` in `.dev.vars` for `wrangler dev`; in production via `wrangler secret put GROQ_API_KEY`
- `RATE_LIMIT_KV` namespace binding (id in `wrangler.jsonc`)

## Common Commands

```bash
# Install dependencies
bun install

# Dev (two terminals). `dist/` is gitignored and `wrangler dev` never rebuilds it,
# so build once before the first `bun run dev`, and after any src/ change you
# intend to exercise through :8787.
bun run build
bun run dev            # Worker: /api/* + dist/ assets on :8787
bun run dev:client     # Vite HMR on :3000, proxies /api to :8787 (needs the above)

# Build SPA into dist/
bun run build

# Build + deploy Worker and assets
bun run deploy

# Lint / format (Biome)
bun run lint
bun run format

# Type check
bun run type-check

# Tests (vitest)
bun run test
bun run test:run

# Clean build artifacts
bun run clean
```

## Toolchain Quirks

- **Lint/Format**: Biome.js (`biome.json`). Single source of truth for linting and formatting.
- **Styling**: Tailwind CSS v4 with `@tailwindcss/vite` plugin. Theme tokens in CSS `@theme {}` block (`src/styles/app.css`). Do not add arbitrary values that duplicate existing tokens.
- **Path Alias**: `~/*` resolves to `./src/*`.
- **Dev Server**: two processes. `bun run dev` is `wrangler dev` (Worker serving `/api/*` plus the prebuilt `dist/` assets on :8787); `bun run dev:client` is Vite with HMR on :3000, proxying `/api` to :8787. Develop against :3000. `dist/` is gitignored and `wrangler dev` does not build it, so run `bun run build` before the first `bun run dev`. API code lives in `worker/`, never in `src/routes/api/`.
- **Font**: Material Symbols Outlined loaded from Google Fonts in `index.html` (the SPA shell), not in `__root.tsx`.

## Architecture

See `docs/ARCHITECTURE.md` for the full picture.

- **Client Routes**: `src/routes/index.tsx` (home), `src/routes/watch.$mediaId.tsx` (watch/player), `src/routes/me.tsx` (library), `src/routes/settings.tsx`, `src/routes/account.tsx`.
- **Worker**: `worker/index.ts` (Hono) mounts `cors` on `*`, `rateLimit` on `/api/*`, then routes `/api/transcribe`, `/api/postprocess`, `/api/youtube/{resolve,captions}`, `/api/health`; all other paths fall back to the `ASSETS` binding (SPA).
- **Rate limiting**: `worker/middleware/rate-limit.ts`, KV-backed sliding window. Client id precedence: `cf-connecting-ip` → first `x-forwarded-for` → `request.cf.colo` → `user-agent`+`accept-language` hash.
- **Database**: Dexie IndexedDB client-side (`src/lib/db/db.ts`). Version 4 schema: live tables `media`, `subtitles`, `segments`; `files`/`transcripts` retained read-only from v3 pending v5 removal.
- **State**: TanStack Query for server state; React hooks for component state.
- **AI**: Direct Groq SDK (`groq-sdk`), not via AI SDK. Post-processing uses `openai/gpt-oss-120b`.
- **UI**: shadcn/ui + Radix UI primitives.
- **No yt-dlp path**: Workers cannot run binaries, so the no-caption audio fallback is gone — the client records `error: 'NO_CAPTIONS'` on the subtitle row. All Groq/YouTube server code lives in `worker/lib/`; there is no `src/lib/ai/` anymore.

## Testing

- **Runner**: Vitest (`vitest.config.ts`), invoked as `bun run test` / `bun run test:run`. Do not use `bun test` — specs import from `vitest`.
- **Environment**: `happy-dom`, with `fake-indexeddb` for Dexie specs and `src/__tests__/setup.ts` for cleanup.

## Database Operations

- Use `DBUtils` from `src/lib/db/db.ts` for CRUD and batch operations.
- Bulk operations are preferred for large segment datasets.
- Deletion order is children-first: segments → subtitles → media (`DBUtils.deleteMedia`, `DBUtils.deleteSubtitleWithSegments`).

## Theme & Tokens

- 4 themes: dark (default), light, system, high-contrast.
- CSS custom properties in `src/styles/app.css` (Tailwind v4 `@theme {}` block); theme toggling via `data-theme` attribute.
- Do not add inline Tailwind arbitrary values that shadow the design tokens.

## PWA / Deployment

- Target is Cloudflare Workers. `bun run build` emits the SPA to `dist/`; `bun run deploy` builds then runs `wrangler deploy` to upload the Worker plus assets.
- PWA manifest at `/manifest.json`; service worker registration via `PwaRegister`.
- `Dockerfile`, `docker-compose.yml`, and `docs/DOKPLOY.md` are legacy: they start `dist/server/server.js`, which the current build no longer produces. Do not treat them as the deployment path.

## What to Avoid

- Do not introduce ESLint/Prettier configs; Biome is the single source of truth.
- Do not use `npm`/`pnpm`/`yarn`/`node`; runtime is Bun, lockfile is `bun.lock`.
- Do not add server-side database libraries; the Worker is stateless (KV is only rate-limit state).
- Do not add API handlers under `src/routes/api/`; all server code belongs in `worker/`.
- Do not add `tailwind.config.js/ts` or `postcss.config.js`; Tailwind v4 uses CSS-only config.
- Keep imports grouped; Biome manages import order automatically.
