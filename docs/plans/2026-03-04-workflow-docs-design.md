# Workflow Documentation Rewrite - Design

## Goal

Rewrite all project workflow documentation from scratch based on the actual codebase state. Remove all Vercel/Cloudflare references. English language throughout.

## Decisions

- **Approach**: Full rewrite (not incremental update) - existing docs reference removed infrastructure
- **Location**: `docs/` (flat, alongside ARCHITECTURE.md)
- **Language**: English
- **Deployment doc**: Deleted (no deployment target configured)
- **Diagrams**: Mermaid in each document

## Documents

### 1. ARCHITECTURE.md (rewrite)

Sections:
- Overview: app purpose, tech stack table (Next.js 16, React 19, TypeScript, Dexie, TanStack Query, Groq SDK, Tailwind, shadcn/ui)
- Directory structure: actual `src/` tree
- Component architecture: Player, File Management, Settings, Layout/UI primitives
- State management: TanStack Query (server state) + Dexie/IndexedDB (persistence) + React hooks (local)
- API surface: /api/transcribe, /api/postprocess, /api/progress/[fileId], /api/performance
- Type system: src/types/ organization (db, api, ui, transcription)
- Mermaid: layered architecture diagram

### 2. DATA-FLOW.md (rewrite)

Sections:
- Upload flow: FileUpload -> useFiles.addFiles -> DBUtils.addFile -> db.files
- Transcription trigger: FileCard -> useFileStatusManager -> useTranscription -> /api/transcribe (Groq Whisper)
- Post-processing: client -> /api/postprocess (Groq) -> update segments (normalizedText, translation, furigana)
- Player data loading: usePlayerDataQuery -> file + transcript + segments -> audio URL + subtitles
- Database schema: files, transcripts, segments (version 3 with word timestamps and enhanced fields)
- Query key structure: transcriptionKeys, playerKeys, fileStatusKeys
- Caching: TanStack Query config (staleTime 5min, gcTime 10min), WeakMap audio URL caching
- Mermaid: sequence diagrams for upload, transcription, playback

### 3. DEVELOPMENT.md (rewrite)

Sections:
- Prerequisites: Node >=20, pnpm >=9
- Setup: clone, install, env config
- Commands: all 11 package.json scripts with descriptions
- Code quality: Biome.js (rules, includes), Husky pre-commit (pnpm lint)
- TypeScript: strict mode, @/* path aliases
- Testing: Vitest + jsdom, 6 test suites (db, hooks, API, utils), coverage
- Styling: Tailwind with design token system
- Mermaid: development cycle

### 4. GIT-WORKFLOW.md (rewrite)

Sections:
- Branch strategy: main (production) + develop (integration) + feature/fix/refactor branches
- Commit convention: Conventional Commits
- Pre-commit: Husky -> pnpm lint
- PR flow: branch -> commit -> push -> PR -> review -> merge
- Mermaid: branch model diagram

### 5. DEPLOYMENT.md (delete)

No deployment platform configured. Will be recreated when a deployment target is chosen.

## Constraints

- Content based solely on actual codebase (not outdated documentation)
- No Vercel/Cloudflare references
- No sensitive information
- Each document includes at least 1 Mermaid diagram
