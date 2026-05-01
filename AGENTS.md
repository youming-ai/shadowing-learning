# Agent Instructions

## Project Overview

Web-based language shadowing learning application with AI-powered audio transcription (Whisper via Groq). Client-persisted with IndexedDB (Dexie). Next.js 16 App Router + React 19 + TypeScript strict mode.

## Prerequisites

- Node.js >=20.0.0
- pnpm >=9.0.0 (required; do not use npm/yarn)
- `GROQ_API_KEY` in `.env.local`
- `NEXT_PUBLIC_APP_URL` (defaults to `http://localhost:3000`)

## Common Commands

```bash
# Install dependencies
pnpm install

# Dev server (port 3000)
pnpm dev

# Build (standalone output)
pnpm build

# Lint / format (Biome, not ESLint/Prettier)
pnpm lint           # biome check
pnpm format         # biome format --write

# Type check
pnpm type-check     # tsc --noEmit

# Tests (Vitest + jsdom)
pnpm test           # watch mode
pnpm test:run       # single run
pnpm test:coverage  # v8 coverage

# Clean build artifacts
pnpm clean
```

## Toolchain Quirks

- **Lint/Format**: Biome.js (`biome.json`). Rules differ from defaults: `noUnknownAtRules` off (Tailwind), `noExplicitAny` off, `useSemanticElements` off.
- **Styling**: Tailwind CSS 3.4.0 with custom design tokens in CSS variables (`src/styles/globals.css`). Do not add arbitrary values that duplicate existing tokens.
- **Path Alias**: `@/*` resolves to `./src/*`.
- **Dev Server**: Next.js dev; API routes under `src/app/api/**/route.ts`.
- **Font**: Material Symbols Outlined loaded from Google Fonts in `layout.tsx`.

## Architecture

- **App Router**: `src/app/page.tsx` (home) and `src/app/player/[id]/page.tsx` (player).
- **API Routes**: `src/app/api/transcribe/route.ts` (Groq Whisper), `src/app/api/postprocess/route.ts` (text normalization), `src/app/api/health/route.ts`.
- **Database**: Dexie IndexedDB client-side (`src/lib/db/db.ts`). Version 3 schema with migrations for `files`, `transcripts`, `segments`.
- **State**: TanStack Query for server state; React hooks for component state.
- **AI**: Direct Groq SDK (`groq-sdk`), not via AI SDK.
- **UI**: shadcn/ui + Radix UI primitives.

## Testing

- **Runner**: Vitest with `@vitejs/plugin-react`.
- **Environment**: jsdom.
- **Mocked APIs**: `fake-indexeddb` for IndexedDB in tests.
- **Setup**: `src/__tests__/setup.ts`.
- **Coverage**: v8 provider; excludes `node_modules/`, `src/__tests__/`, `**/*.d.ts`, `**/*.config.*`, `**/types/**`.

## Database Operations

- Use `DBUtils` from `src/lib/db/db.ts` for CRUD and batch operations.
- Bulk operations are preferred for large segment datasets.
- Deletion order: segments → transcripts → file (children first).

## Theme & Tokens

- 4 themes: dark (default), light, system, high-contrast.
- CSS custom properties in `src/styles/globals.css`; theme toggling via `data-theme` attribute.
- Do not add inline Tailwind arbitrary values that shadow the design tokens.

## PWA / Deployment

- Output mode: `standalone` (`next.config.js`).
- PWA manifest at `/manifest.json`; service worker registration exists.
- Security headers and API cache headers configured in `next.config.js`.

## What to Avoid

- Do not introduce ESLint/Prettier configs; Biome is the single source of truth.
- Do not use `npm`/`yarn`; lockfile is `pnpm-lock.yaml`.
- Do not add server-side database libraries (PostgreSQL, MongoDB, etc.). Data is client-side via IndexedDB.
- Keep imports grouped; Biome manages import order automatically.
