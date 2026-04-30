# Workflow Documentation Rewrite - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite all project workflow documentation from scratch in English, reflecting the actual codebase with no Vercel/Cloudflare references.

**Architecture:** 4 standalone Markdown documents in `docs/`, each with Mermaid diagrams. Delete the obsolete DEPLOYMENT.md. Clean Vercel/Cloudflare references from ARCHITECTURE.md.

**Tech Stack:** Markdown, Mermaid diagram syntax

---

## TL;DR

| # | Task | Deliverable | Parallel Group |
|---|------|-------------|----------------|
| 1 | Delete DEPLOYMENT.md | File removed | Wave 0 |
| 2 | Rewrite ARCHITECTURE.md | `docs/ARCHITECTURE.md` | Wave 1 |
| 3 | Rewrite DATA-FLOW.md | `docs/DATA-FLOW.md` | Wave 1 |
| 4 | Rewrite DEVELOPMENT.md | `docs/DEVELOPMENT.md` | Wave 1 |
| 5 | Rewrite GIT-WORKFLOW.md | `docs/GIT-WORKFLOW.md` | Wave 1 |
| 6 | Verify all documents | All docs pass checks | Wave 2 |

Wave 0 → Wave 1 (4 tasks, all parallel) → Wave 2

---

### Task 1: Delete DEPLOYMENT.md

**Files:**
- Delete: `docs/DEPLOYMENT.md`

**Step 1: Delete the file**
```bash
rm docs/DEPLOYMENT.md
```

**Step 2: Verify deletion**
```bash
test ! -f docs/DEPLOYMENT.md && echo "PASS" || echo "FAIL"
```
Expected: PASS

---

### Task 2: Rewrite ARCHITECTURE.md

**Files:**
- Overwrite: `docs/ARCHITECTURE.md`

**Step 1: Write ARCHITECTURE.md**

Content requirements (all sections mandatory):

**Section: Overview**
- One paragraph: what the app does (language learning via shadowing practice, AI-powered transcription)
- Tech stack table:

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 16 (App Router) | Server/client rendering |
| UI | React 19 + shadcn/ui + Radix UI | Component library |
| Language | TypeScript (strict mode) | Type safety |
| Styling | Tailwind CSS + design tokens | Styling system |
| State | TanStack Query v5 | Server state, caching |
| Database | Dexie v4 (IndexedDB) | Client-side persistence |
| AI | Groq SDK (Whisper large-v3-turbo) | Audio transcription |
| Testing | Vitest + React Testing Library | Unit/integration tests |

**Section: Directory Structure**
- Actual `src/` tree (from codebase exploration):
```
src/
  app/                    # Next.js App Router
    api/                  # API routes (transcribe, postprocess, progress, performance)
    player/[fileId]/      # Dynamic player page
    settings/             # Settings page
    account/              # Account page
  components/
    features/
      player/             # Player components (PlayerPage, AudioPlayer, ScrollableSubtitleDisplay, etc.)
      file/               # File management (FileManager, FileUpload, FileCard, StatsCards)
      settings/           # Settings components
    layout/
      contexts/           # I18nContext, ThemeContext, TranscriptionLanguageContext
      providers/          # QueryProvider
    ui/                   # Primitives (Navigation, ErrorBoundary, ThemeToggle, shadcn components)
    transcription/        # TranscriptionLoading
  hooks/
    api/                  # useTranscription, useApiMonitoring
    db/                   # useFiles
    player/               # usePlayerDataQuery
    ui/                   # useAudioPlayer, useAudioPlayerState, useKeyboardControls
  lib/
    ai/                   # groq-transcription-utils, text-postprocessor, transcription-service
    db/                   # Dexie database (db.ts), subtitle-sync
    utils/                # error-handler, rate-limiter, retry-utils, api-response, etc.
    config/               # routes, url-manager
  types/
    db/                   # database.ts (FileRow, TranscriptRow, Segment)
    api/                  # errors.ts
    ui/                   # theme.ts
    api.types.ts          # API type definitions
    transcription.ts      # Transcription types
```

**Section: Component Architecture**
- Four feature areas with brief descriptions:
  1. Player: PlayerPage, AudioPlayer, AudioControls, ScrollableSubtitleDisplay, VolumeControl, PlaybackSpeedControl, PlayerFooter, PlayerStatusBanner, PlayerErrorBoundary
  2. File Management: FileManager, FileUpload, FileCard, StatsCards
  3. Settings: SettingsLayout, SettingsCard, SettingsControls, and page sections (General, Language, Account, Feedback, ProUpgrade)
  4. Layout/UI: Navigation, ThemeToggle, LanguageToggle, ErrorBoundary, ErrorToast, PwaRegister, MonitoringInitializer, ThemeDebugger

**Section: State Management**
- Three layers:
  1. TanStack Query: server state caching with query keys (transcriptionKeys, playerKeys, fileStatusKeys)
  2. Dexie/IndexedDB: persistent client storage (files, transcripts, segments tables)
  3. React hooks: component-level state (audio playback, UI toggles)
- QueryProvider configuration: staleTime 5min, gcTime 10min

**Section: API Surface**
- Table of 4 endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| /api/transcribe | POST | Audio transcription via Groq Whisper |
| /api/postprocess | POST | Text normalization, translation, furigana |
| /api/progress/[fileId] | GET | Real-time transcription progress |
| /api/performance | GET | Performance metrics |

**Section: Mermaid Diagram**
- Layered architecture diagram showing: UI Components → Hooks → State Management (TanStack Query + Dexie) → API Routes → Groq SDK

**Step 2: Verify**
```bash
test -s docs/ARCHITECTURE.md && echo "PASS" || echo "FAIL"
grep -q '```mermaid' docs/ARCHITECTURE.md && echo "Mermaid OK" || echo "No Mermaid"
grep -cq 'vercel\|cloudflare\|Vercel\|Cloudflare' docs/ARCHITECTURE.md && echo "FAIL: platform refs" || echo "Clean"
```
Expected: PASS, Mermaid OK, Clean

---

### Task 3: Rewrite DATA-FLOW.md

**Files:**
- Overwrite: `docs/DATA-FLOW.md`

**Step 1: Write DATA-FLOW.md**

Content requirements (all sections mandatory):

**Section: Overview**
- Brief description of offline-first architecture
- Tech stack for data layer: Dexie (IndexedDB), TanStack Query, Next.js API Routes, Groq SDK

**Section: Database Schema**
- Three tables with actual fields from version 3:

files table:
- id (auto-increment), name, size, type, blob, uploadedAt, updatedAt
- Indexes: [name+type]

transcripts table:
- id (auto-increment), fileId, status, language, createdAt, updatedAt
- Indexes: fileId

segments table:
- id (auto-increment), transcriptId, start, end, text, wordTimestamps, normalizedText, translation, annotations, furigana
- Indexes: [transcriptId+start], [transcriptId+end]

**Section: Audio Upload Flow**
- Path: FileUpload component -> onFilesSelected callback -> FileManager.handleFilesSelected -> useFiles.addFiles -> DBUtils.addFile -> db.files table
- Mermaid sequence diagram for this flow

**Section: Transcription Flow**
- Trigger: FileCard "Transcribe" button -> useFileStatusManager.startTranscription -> useTranscription mutation
- Client -> POST /api/transcribe (sends FormData with audio blob, fileId, language)
- Server: Groq SDK Whisper transcription -> returns segments, text, language, duration
- Client: saveTranscriptionResults -> transaction: insert/update transcript row + bulkAdd segments
- Post-processing: client calls /api/postprocess with segments -> Groq enhances with normalizedText, translation, furigana -> updates segment rows
- Mermaid sequence diagram for this flow

**Section: Player Data Loading**
- usePlayerDataQuery(fileId):
  1. Loads FileRow from db.files, creates audio URL from blob (WeakMap cached)
  2. Loads TranscriptRow via useTranscriptionStatus
  3. Loads Segments ordered by start time
  4. Returns { file, segments, transcript, audioUrl, loading, error, retry }
- PlayerPage renders ScrollableSubtitleDisplay with synced segments, or prompt if no transcription
- Mermaid sequence diagram for player loading

**Section: TanStack Query Keys**
```typescript
transcriptionKeys = {
  all: ["transcription"],
  forFile: (fileId) => [...all, "file", fileId],
  progress: (fileId) => [...forFile(fileId), "progress"]
}

playerKeys = {
  all: ["player"],
  file: (fileId) => [...all, "file", fileId]
}
```

**Section: Caching and Memory**
- TanStack Query: staleTime 5min, gcTime 10min, invalidateQueries on mutations
- Audio URL caching: WeakMap<Blob, string> prevents memory leaks
- URL.revokeObjectURL on component unmount

**Step 2: Verify**
```bash
test -s docs/DATA-FLOW.md && echo "PASS" || echo "FAIL"
grep -q '```mermaid' docs/DATA-FLOW.md && echo "Mermaid OK" || echo "No Mermaid"
grep -cq 'vercel\|cloudflare' docs/DATA-FLOW.md && echo "FAIL: platform refs" || echo "Clean"
```
Expected: PASS, Mermaid OK, Clean

---

### Task 4: Rewrite DEVELOPMENT.md

**Files:**
- Overwrite: `docs/DEVELOPMENT.md`

**Step 1: Write DEVELOPMENT.md**

Content requirements (all sections mandatory):

**Section: Prerequisites**
- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Git 2.30+

**Section: Setup**
```bash
git clone https://github.com/youming-ai/shadowing-learning.git
cd shadowing-learning
pnpm install
cp .env.example .env.local
# Add GROQ_API_KEY to .env.local
pnpm dev
```

**Section: Available Commands**
Table of all 11 scripts:

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server (http://localhost:3000) |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Run Biome.js linter |
| `pnpm format` | Format code with Biome.js |
| `pnpm type-check` | TypeScript type checking (tsc --noEmit) |
| `pnpm test` | Run Vitest in watch mode |
| `pnpm test:run` | Run Vitest once |
| `pnpm test:coverage` | Run Vitest with coverage |
| `pnpm clean` | Remove .next and node_modules cache |
| `pnpm prepare` | Setup Husky git hooks |

**Section: Code Quality**
- Biome.js configuration:
  - Recommended rules enabled
  - Relaxed: noUnknownAtRules, noExplicitAny (off), noDangerouslySetInnerHtml (off), useSemanticElements (off)
  - Warning: noUnusedVariables
  - Includes: src/**/*.ts, src/**/*.tsx, *.json, *.js, *.ts, *.tsx, *.mjs, *.cjs
- Husky pre-commit hook: runs `pnpm lint` before every commit

**Section: TypeScript Configuration**
- Strict mode enabled
- Path alias: `@/*` maps to `./src/*`
- Includes: all .ts/.tsx files + Next.js type files
- Excludes: node_modules

**Section: Testing**
- Framework: Vitest with jsdom environment
- Setup file: src/__tests__/setup.ts
- Path alias support in tests (@/ -> src/)
- Test locations:
  - `src/lib/db/__tests__/` — Database operations (DBUtils CRUD, file/transcript/segment flows)
  - `src/hooks/db/__tests__/` — useFiles hook (load, add, delete, refresh)
  - `src/app/api/transcribe/__tests__/` — Transcription API route (validation, error cases)
  - `src/lib/ai/__tests__/` — Groq transcription utilities (segment mapping, timestamps)
  - `src/lib/utils/__tests__/` — Rate limiter, API response helpers

**Section: Styling**
- Tailwind CSS with content paths: pages, components, app directories
- Design token system via CSS custom properties in globals.css
- 4 themes: Dark (default), Light, System, High Contrast
- Theme debugger: Ctrl+Shift+T

**Section: Development Cycle (Mermaid)**
- Diagram: Write code -> lint -> type-check -> test -> commit (pre-commit hook) -> push

**Step 2: Verify**
```bash
test -s docs/DEVELOPMENT.md && echo "PASS" || echo "FAIL"
grep -q '```mermaid' docs/DEVELOPMENT.md && echo "Mermaid OK" || echo "No Mermaid"
grep -cq 'vercel\|cloudflare' docs/DEVELOPMENT.md && echo "FAIL: platform refs" || echo "Clean"
```
Expected: PASS, Mermaid OK, Clean

---

### Task 5: Rewrite GIT-WORKFLOW.md

**Files:**
- Overwrite: `docs/GIT-WORKFLOW.md`

**Step 1: Write GIT-WORKFLOW.md**

Content requirements (all sections mandatory):

**Section: Branch Strategy**
- Two permanent branches: main (production), develop (integration)
- Feature branches: feature/*, fix/*, refactor/* (created from develop)
- Table:

| Branch | Purpose | Source | Merges To | Protected |
|--------|---------|--------|-----------|-----------|
| main | Production | - | - | Yes (PR only) |
| develop | Integration | main | main | No |
| feature/* | New features | develop | develop | No |
| fix/* | Bug fixes | develop | develop | No |
| refactor/* | Code refactoring | develop | develop | No |

- Mermaid gitGraph diagram

**Section: Commit Convention**
- Conventional Commits format: `<type>(<scope>): <description>`
- Types table:

| Type | Description |
|------|-------------|
| feat | New feature |
| fix | Bug fix |
| docs | Documentation |
| style | Code formatting (no logic change) |
| refactor | Code refactoring |
| test | Tests |
| chore | Build/tooling changes |

- Examples:
```
feat(player): add playback speed control
fix(transcription): handle empty audio file
docs(readme): update installation steps
refactor(hooks): consolidate transcription state
```

**Section: Pre-commit Enforcement**
- Husky runs `pnpm lint` (Biome.js) before every commit
- Commits blocked if lint fails

**Section: Pull Request Flow**
- Branch from develop -> implement -> push -> create PR -> review -> merge to develop
- Develop merged to main for production releases
- Mermaid sequence diagram for PR flow

**Section: Code Review Checklist**
- Code follows project conventions
- TypeScript types are correct (no `any`)
- Tests added/updated as needed
- No lint warnings
- Commit messages follow convention

**Step 2: Verify**
```bash
test -s docs/GIT-WORKFLOW.md && echo "PASS" || echo "FAIL"
grep -q '```mermaid' docs/GIT-WORKFLOW.md && echo "Mermaid OK" || echo "No Mermaid"
grep -cq 'vercel\|cloudflare' docs/GIT-WORKFLOW.md && echo "FAIL: platform refs" || echo "Clean"
```
Expected: PASS, Mermaid OK, Clean

---

### Task 6: Final Verification

**Step 1: Verify all documents exist and are non-empty**
```bash
for f in docs/ARCHITECTURE.md docs/DATA-FLOW.md docs/DEVELOPMENT.md docs/GIT-WORKFLOW.md; do
  test -s "$f" && echo "OK: $f" || echo "FAIL: $f"
done
```
Expected: All OK

**Step 2: Verify DEPLOYMENT.md is deleted**
```bash
test ! -f docs/DEPLOYMENT.md && echo "PASS: deleted" || echo "FAIL: still exists"
```
Expected: PASS

**Step 3: Verify Mermaid diagrams present**
```bash
grep -l '```mermaid' docs/*.md | wc -l
```
Expected: 4 (all docs have mermaid)

**Step 4: Verify no Vercel/Cloudflare references in docs/**
```bash
grep -ri 'vercel\|cloudflare' docs/ARCHITECTURE.md docs/DATA-FLOW.md docs/DEVELOPMENT.md docs/GIT-WORKFLOW.md && echo "FAIL" || echo "Clean"
```
Expected: Clean

**Step 5: Run project quality checks**
```bash
pnpm type-check && pnpm lint
```
Expected: Both pass (docs don't affect these, but ensures no regressions)
