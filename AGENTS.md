# Agent Instructions

## Project Overview

Web-based language shadowing learning application with AI-powered audio transcription (Whisper via Groq). Client-persisted with IndexedDB (Dexie). Vite 8 + TanStack Start / TanStack Router (file-based) + React 19 + TypeScript strict mode, running on the Bun runtime.

## Prerequisites

- Bun >=1.2.0 (required; do not use npm/pnpm/yarn/node)
- `GROQ_API_KEY` in `.env.local`
- `VITE_APP_URL` (defaults to `http://localhost:3000`)

## Common Commands

```bash
# Install dependencies
bun install

# Dev server (port 3000)
bun run dev

# Build (standalone output)
bun run build

# Lint / format (Biome)
bun run lint
bun run format

# Type check
bun run type-check

# Tests (bun test)
bun test

# Clean build artifacts
bun run clean
```

## Toolchain Quirks

- **Lint/Format**: Biome.js (`biome.json`). Single source of truth for linting and formatting.
- **Styling**: Tailwind CSS v4 with `@tailwindcss/vite` plugin. Theme tokens in CSS `@theme {}` block (`src/styles/app.css`). Do not add arbitrary values that duplicate existing tokens.
- **Path Alias**: `~/*` resolves to `./src/*`.
- **Dev Server**: `bun run dev` (Vite dev under Bun); API routes as TanStack Start server functions under `src/routes/api/`.
- **Font**: Material Symbols Outlined loaded from Google Fonts in `__root.tsx`.

## Architecture

- **Routes**: `src/routes/index.tsx` (home), `src/routes/player.$fileId.tsx` (player), `src/routes/settings.tsx`, `src/routes/account.tsx`.
- **API Routes**: `src/routes/api/transcribe.ts` (Groq Whisper), `src/routes/api/postprocess.ts` (text normalization), `src/routes/api/health.ts`, `src/routes/api/performance.ts`.
- **Database**: Dexie IndexedDB client-side (`src/lib/db/db.ts`). Version 3 schema with migrations for `files`, `transcripts`, `segments`.
- **State**: TanStack Query for server state; React hooks for component state.
- **AI**: Direct Groq SDK (`groq-sdk`), not via AI SDK.
- **UI**: shadcn/ui + Radix UI primitives.

## Testing

- **Runner**: `bun test` (built-in Bun test runner, compatible with vitest API).
- **Environment**: Bun's built-in DOM support (happy-dom compatible).
- **Note**: Some test files may need updates for `bun:test` vs `vitest` imports.

## Database Operations

- Use `DBUtils` from `src/lib/db/db.ts` for CRUD and batch operations.
- Bulk operations are preferred for large segment datasets.
- Deletion order: segments → transcripts → file (children first).

## Theme & Tokens

- 4 themes: dark (default), light, system, high-contrast.
- CSS custom properties in `src/styles/app.css` (Tailwind v4 `@theme {}` block); theme toggling via `data-theme` attribute.
- Do not add inline Tailwind arbitrary values that shadow the design tokens.

## PWA / Deployment

- Build output: `dist/` (Vite + TanStack Start). Server entry is `dist/server/server.js`, started via `bun run dist/server/server.js`.
- Docker base image: `oven/bun:1-alpine` (multi-stage; `bun install --frozen-lockfile` → `bun run build`).
- PWA manifest at `/manifest.json`; service worker registration exists.

## What to Avoid

- Do not introduce ESLint/Prettier configs; Biome is the single source of truth.
- Do not use `npm`/`pnpm`/`yarn`/`node`; runtime is Bun, lockfile is `bun.lock`.
- Do not add server-side database libraries (yet; Phase 3 will add Drizzle/PostgreSQL).
- Do not add `tailwind.config.js/ts` or `postcss.config.js`; Tailwind v4 uses CSS-only config.
- Keep imports grouped; Biome manages import order automatically.
