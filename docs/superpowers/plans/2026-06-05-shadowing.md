# 影子跟读 (Shadowing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing transcript player into a real shadowing trainer — per-line listen → speak-back gap → repeat N times → auto-advance, with slow practice speed, accurate word-synced highlight, and a usable control surface.

**Architecture:** Method B — a single `usePlaybackController` hook owns the `<audio>` element, transport, and a pure shadowing state machine (`reduceShadowing`) driven by a requestAnimationFrame read of `audio.currentTime` for frame-accurate boundaries. A shared `findActiveSegmentIndex` is the single source of truth for highlight/scroll/loop. The orphaned second player stack is harvested then deleted.

**Tech Stack:** Bun runtime, Vite 8 + TanStack Start, React 19, TypeScript strict, Tailwind v4, Dexie/IndexedDB, Groq SDK; tests on **Vitest** (reverted from bun test) + happy-dom + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-06-05-shadowing-design.md`

**Branch:** `feat/shadowing` (created in Task A.0). Every commit stages **explicit paths** — never `git add -A` — because the working tree carries unrelated migration WIP.

---

## File Structure

**Created (13):**
- `src/components/features/player/ShadowingSettings.tsx`
- `src/components/features/player/SpeedPresets.tsx`
- `src/components/features/player/__tests__/ShadowingSettings.test.tsx`
- `src/components/features/player/__tests__/SpeedPresets.test.tsx`
- `src/hooks/player/__tests__/useActiveSegmentIndex.test.ts`
- `src/hooks/player/__tests__/usePlaybackController.test.ts`
- `src/hooks/player/useActiveSegmentIndex.ts`
- `src/hooks/player/usePlaybackController.ts`
- `src/lib/player/__tests__/active-segment.test.ts`
- `src/lib/player/__tests__/shadowing-machine.test.ts`
- `src/lib/player/active-segment.ts`
- `src/lib/player/shadowing-machine.ts`
- `vitest.config.ts`

**Modified (19):**
- `bunfig.toml`
- `package.json`
- `src/__tests__/setup.ts`
- `src/components/features/player/PlayerFooterContainer.tsx`
- `src/components/features/player/PlayerPage.tsx`
- `src/components/features/player/ScrollableSubtitleDisplay.tsx`
- `src/components/features/player/__tests__/ScrollableSubtitleDisplay.test.tsx`
- `src/components/features/player/page/PlayerFooter.tsx`
- `src/hooks/api/__tests__/useTranscription.test.tsx`
- `src/hooks/db/__tests__/useFiles.test.tsx`
- `src/hooks/index.ts`
- `src/hooks/ui/useKeyboardControls.ts`
- `src/lib/ai/__tests__/groq-transcription-utils.test.ts`
- `src/lib/ai/groq-transcription-utils.ts`
- `src/lib/db/__tests__/db-utils.test.ts`
- `src/routes/api/transcribe.ts`
- `src/styles/app.css`
- `src/types/db/database.ts`
- `tsconfig.json`

**Deleted (10):**
- `bunfig.toml (deleted in Task A.6)`
- `src/components/features/player/AudioControls.tsx`
- `src/components/features/player/AudioPlayer.tsx`
- `src/components/features/player/VolumeControl.tsx`
- `src/hooks/player/__tests__/useShadowingMode.test.ts`
- `src/hooks/player/useShadowingMode.ts`
- `src/hooks/ui/__tests__/useAudioPlayer.test.ts`
- `src/hooks/ui/useAudioPlayer.ts`
- `src/hooks/ui/useAudioPlayerState.ts`
- `src/hooks/ui/useAudioPlayerTime.ts`

**Phase order & dependencies:** A (unblock build/tests) → B (data: word timestamps; independent) → C (pure engine logic) → D (controller hook, depends on C) → E (UI/integration/cleanup, depends on C+D).

---

## Phase A: Unblock build & test

This phase removes the two hard blockers identified in the design spec (§1.2, §9) so every later phase can run TDD. Nothing here is feature TDD — it is build/config/migration repair. For each change the full code is shown, and each step has an exact command plus expected output. The "failing" signal is the real compiler/runner error captured from the current tree; the "passing" signal is that same command going green.

Baseline facts captured by running the commands against the current tree (do not assume — these are real):
- `bun run build` aborts with `Cannot apply unknown utility class card-base` (the only build error).
- `bun run type-check` reports **18 errors across exactly 4 files**: `src/__tests__/setup.ts` (2), `src/hooks/api/__tests__/useTranscription.test.tsx` (14), `src/hooks/db/__tests__/useFiles.test.tsx` (1), `src/lib/db/__tests__/db-utils.test.ts` (1).
- `vitest@4.1.5`, `@vitest/coverage-v8@4.1.5`, `@testing-library/react@16.3.2`, `@testing-library/jest-dom@6.9.1`, `happy-dom@20.10.1` are already present in `node_modules` but **not** listed in `package.json` — this phase records them as devDependencies so the install is reproducible.
- `tsconfig.json` sets `"types": ["bun-types"]`; Vitest globals (`vi`, `describe`, `expect`, …) are not typed until `"vitest/globals"` is added there.

---

### Task A.0: Create the feature branch
**Files:**
- (none — git only)

- [ ] **Step 1: Create and switch to the branch**
  Run:
  ```bash
  git -C /Users/youming/GitHub/youming-ai/shadowing-learning checkout -b feat/shadowing
  ```
- [ ] **Step 2: Verify the branch is active**
  Run:
  ```bash
  git -C /Users/youming/GitHub/youming-ai/shadowing-learning rev-parse --abbrev-ref HEAD
  ```
  Expected: prints `feat/shadowing`.
- [ ] **Step 3: Confirm the unrelated migration WIP is still uncommitted (do NOT stage it)**
  Run:
  ```bash
  git -C /Users/youming/GitHub/youming-ai/shadowing-learning status --short | head -30
  ```
  Expected: shows the pre-existing modified/untracked files (e.g. `M src/styles/app.css`, `?? bunfig.toml`, `?? src/__tests__/`). This confirms why every commit in this phase stages **explicit paths only** — never `git add -A`.

---

### Task A.1: Fix the build blocker — convert `.card-base` to a Tailwind v4 `@utility`
**Files:**
- Modify: `src/styles/app.css:864-876` (the `@layer components { .card-base { … } }` block)

Tailwind v4 (`@tailwindcss/vite`) cannot `@apply` a custom class that is defined inside `@layer components`. `.card-base` is referenced via `@apply card-base` on lines 880, 892, 904, 918, 937, 944. The fix is to lift `.card-base` out of the `@layer components` block and redeclare it as an `@utility`, which `@apply` can resolve. The six `@apply card-base` references stay exactly as they are.

- [ ] **Step 1: Reproduce the build failure (this is the failing state)**
  Run:
  ```bash
  cd /Users/youming/GitHub/youming-ai/shadowing-learning && bun run build 2>&1 | grep -i "card-base"
  ```
  Expected: FAIL — prints a line containing `Cannot apply unknown utility class card-base` (build aborts).

- [ ] **Step 2: Apply the fix**
  In `src/styles/app.css`, the current block is:
  ```css
  /* ===================================
     组件样式层 (@layer components)
     =================================== */

  /* 自定义样式类 */
  @layer components {
    /* ===================================
     卡片组件样式
     =================================== */

    /* Base card styles with consistent sizing */
    .card-base {
      background-color: var(--surface-card);
      border: 2px solid var(--border-primary);
      border-radius: var(--radius-card);
      padding: var(--space-card-padding-lg);
      transition: all 0.2s ease;
    }

    /* Card variant: Default */
    .card-default {
  ```
  Replace it with (move `.card-base` out into a top-level `@utility`, leaving the `@layer components` block to start at `.card-default`):
  ```css
  /* ===================================
     组件样式层 (@layer components)
     =================================== */

  /* Base card styles with consistent sizing.
     Declared as a Tailwind v4 @utility (not inside @layer components) so that
     `@apply card-base` resolves — Tailwind v4 cannot @apply a class defined in
     the same @layer components block. */
  @utility card-base {
    background-color: var(--surface-card);
    border: 2px solid var(--border-primary);
    border-radius: var(--radius-card);
    padding: var(--space-card-padding-lg);
    transition: all 0.2s ease;
  }

  /* 自定义样式类 */
  @layer components {
    /* ===================================
     卡片组件样式
     =================================== */

    /* Card variant: Default */
    .card-default {
  ```
  (Everything from `.card-default` onward — including all six `@apply card-base` usages — is unchanged. Do not touch the closing `}` of the `@layer components` block at the end of the file.)

- [ ] **Step 3: Verify the build passes**
  Run:
  ```bash
  cd /Users/youming/GitHub/youming-ai/shadowing-learning && bun run build 2>&1 | tail -5; echo "EXIT=$?"
  ```
  Expected: PASS — no `card-base` error; the Vite build completes and `EXIT=0`.

- [ ] **Step 4: Confirm the emitted CSS still contains the card-base declarations**
  Run:
  ```bash
  cd /Users/youming/GitHub/youming-ai/shadowing-learning && grep -rl "border-radius" dist/client/assets/*.css 2>/dev/null | head -1 | xargs grep -c "var(--surface-card)" 2>/dev/null
  ```
  Expected: prints a number `>= 1` (the `@apply card-base` expansions emitted the `--surface-card` background into the bundle). If `dist/client/assets` differs, this is a non-blocking sanity check — Step 3's `EXIT=0` is the gate.

- [ ] **Step 5: Commit**
  ```bash
  cd /Users/youming/GitHub/youming-ai/shadowing-learning && \
  git add src/styles/app.css && \
  git commit -m "fix(css): make card-base a Tailwind v4 @utility so @apply resolves"
  ```

---

### Task A.2: Add `vitest.config.ts`
**Files:**
- Create: `vitest.config.ts`

The config uses the `happy-dom` environment (already a dependency), points `setupFiles` at the existing setup module, enables `globals`, and mirrors the `~ -> ./src` alias from `vite.config.ts`. Coverage uses the v8 provider.

- [ ] **Step 1: Show the failing state (no Vitest config exists)**
  Run:
  ```bash
  cd /Users/youming/GitHub/youming-ai/shadowing-learning && ls vitest.config.ts 2>&1
  ```
  Expected: FAIL — `ls: vitest.config.ts: No such file or directory`.

- [ ] **Step 2: Create the config**
  Create `vitest.config.ts`:
  ```ts
  import { dirname, resolve } from 'node:path'
  import { fileURLToPath } from 'node:url'
  import { defineConfig } from 'vitest/config'

  const __dirname = dirname(fileURLToPath(import.meta.url))

  export default defineConfig({
    resolve: {
      alias: {
        '~': resolve(__dirname, './src'),
      },
    },
    test: {
      globals: true,
      environment: 'happy-dom',
      setupFiles: ['./src/__tests__/setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
      },
    },
  })
  ```

- [ ] **Step 3: Verify Vitest reads the config (it will report errors because setup.ts still imports `bun:test` — that is fixed in A.4)**
  Run:
  ```bash
  cd /Users/youming/GitHub/youming-ai/shadowing-learning && bunx vitest run --reporter=dot src/lib/utils/__tests__/api-response.test.ts 2>&1 | tail -15
  ```
  Expected: Vitest boots and resolves the config (no "config not found"). It is acceptable for the run to error at this point because `src/__tests__/setup.ts` still does `import … from 'bun:test'` — that import is replaced in Task A.4. The signal here is only that Vitest loaded `vitest.config.ts`.

- [ ] **Step 4: Commit**
  ```bash
  cd /Users/youming/GitHub/youming-ai/shadowing-learning && \
  git add vitest.config.ts && \
  git commit -m "chore(test): add vitest.config.ts (happy-dom, globals, ~ alias)"
  ```

---

### Task A.3: Update `package.json` scripts and devDependencies for Vitest
**Files:**
- Modify: `package.json:15-16` (`test`, `test:run` scripts) and `package.json:68-78` (devDependencies)

- [ ] **Step 1: Show the failing state (scripts still point at `bun test`)**
  Run:
  ```bash
  cd /Users/youming/GitHub/youming-ai/shadowing-learning && node -p "const p=require('./package.json'); JSON.stringify({test:p.scripts.test,'test:run':p.scripts['test:run'],'test:coverage':p.scripts['test:coverage']??null})"
  ```
  Expected: prints `{"test":"bun test","test:run":"bun test","test:coverage":null}` — the failing state (bun runner, no coverage script).

- [ ] **Step 2: Replace the scripts block**
  In `package.json`, change:
  ```json
      "test": "bun test",
      "test:run": "bun test",
      "clean": "rm -rf .output dist node_modules/.cache"
  ```
  to:
  ```json
      "test": "vitest",
      "test:run": "vitest run",
      "test:coverage": "vitest run --coverage",
      "clean": "rm -rf .output dist node_modules/.cache"
  ```

- [ ] **Step 3: Record the test devDependencies (already installed; pin them so the install is reproducible)**
  In `package.json`, change the `devDependencies` block from:
  ```json
    "devDependencies": {
      "@biomejs/biome": "^2.4.16",
      "@types/bun": "^1.3.14",
      "@types/node": "24.10.1",
      "@types/react": "^19.2.16",
      "@types/react-dom": "^19.2.3",
      "fake-indexeddb": "^6.2.5",
      "happy-dom": "^20.10.1",
      "typescript": "^5.9.3",
      "vite": "^8.0.16"
    }
  ```
  to:
  ```json
    "devDependencies": {
      "@biomejs/biome": "^2.4.16",
      "@testing-library/jest-dom": "^6.9.1",
      "@testing-library/react": "^16.3.2",
      "@types/bun": "^1.3.14",
      "@types/node": "24.10.1",
      "@types/react": "^19.2.16",
      "@types/react-dom": "^19.2.3",
      "@vitest/coverage-v8": "^4.1.5",
      "fake-indexeddb": "^6.2.5",
      "happy-dom": "^20.10.1",
      "typescript": "^5.9.3",
      "vite": "^8.0.16",
      "vitest": "^4.1.5"
    }
  ```
  (`@types/bun` stays — `src/lib/ai` and other non-test code still rely on Bun-typed globals via the `tsconfig` `types` array; do not remove it.)

- [ ] **Step 4: Reconcile the lockfile against the now-declared deps**
  Run:
  ```bash
  cd /Users/youming/GitHub/youming-ai/shadowing-learning && bun install 2>&1 | tail -5; echo "EXIT=$?"
  ```
  Expected: PASS — `EXIT=0`; the already-present versions satisfy the new ranges (no large download).

- [ ] **Step 5: Verify the scripts now resolve to vitest**
  Run:
  ```bash
  cd /Users/youming/GitHub/youming-ai/shadowing-learning && node -p "const p=require('./package.json'); JSON.stringify({test:p.scripts.test,'test:run':p.scripts['test:run'],'test:coverage':p.scripts['test:coverage']})"
  ```
  Expected: prints `{"test":"vitest","test:run":"vitest run","test:coverage":"vitest run --coverage"}`.

- [ ] **Step 6: Commit**
  ```bash
  cd /Users/youming/GitHub/youming-ai/shadowing-learning && \
  git add package.json bun.lock && \
  git commit -m "chore(test): point npm scripts at vitest and pin test devDependencies"
  ```
  (If the lockfile is named `bun.lockb`, stage that path instead: `git add package.json bun.lockb`. Run `ls bun.lock*` first to confirm the exact filename, and stage only what changed.)

---

### Task A.4: Rewrite `src/__tests__/setup.ts` to Vitest conventions
**Files:**
- Modify: `src/__tests__/setup.ts` (full rewrite)

Current setup imports `{ beforeAll, expect, vi } from 'bun:test'`, manually injects a `happy-dom` `Window` into `globalThis`, and declares jest-dom matchers on `module 'bun:test'`. Under Vitest with `environment: 'happy-dom'` the DOM globals are already provided, jest-dom matchers are registered by importing `@testing-library/jest-dom/vitest`, and `vi`/`expect`/`beforeAll` come from `vitest`. Two real type errors must also be fixed: `setup.ts(85,3)` (the `URL.createObjectURL` Blob typing mismatch) and `setup.ts(166,27)` (`vi.importActual` missing on the bun:test shim).

- [ ] **Step 1: Reproduce the two setup.ts type errors (failing state)**
  Run:
  ```bash
  cd /Users/youming/GitHub/youming-ai/shadowing-learning && bun run --bun tsc --noEmit 2>&1 | grep "src/__tests__/setup.ts"
  ```
  Expected: FAIL — prints exactly two lines:
  - `src/__tests__/setup.ts(85,3): error TS2322` (createObjectURL Blob mismatch)
  - `src/__tests__/setup.ts(166,27): error TS2339` (Property 'importActual' does not exist …)

- [ ] **Step 2: Replace the entire file**
  Overwrite `src/__tests__/setup.ts` with:
  ```ts
  import 'fake-indexeddb/auto'
  import '@testing-library/jest-dom/vitest'
  import { afterEach, vi } from 'vitest'
  import { cleanup } from '@testing-library/react'

  // Vitest provides the DOM via `environment: 'happy-dom'` in vitest.config.ts,
  // so document/window/HTMLElement/etc. are already on globalThis. We only need
  // to (a) register jest-dom matchers (done by the import above), (b) ensure
  // URL.createObjectURL / revokeObjectURL exist for the audio blob-URL paths,
  // and (c) reset the DOM and mocks between tests.

  if (typeof globalThis.URL.createObjectURL !== 'function') {
    let counter = 0
    globalThis.URL.createObjectURL = (_object: Blob | MediaSource): string =>
      `blob:vitest/${counter++}`
    globalThis.URL.revokeObjectURL = (_url: string): void => {}
  }

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  // Mock @tanstack/react-router so components/hooks that pull navigation helpers
  // render without a real router. vi.importActual is restored under Vitest.
  vi.mock('@tanstack/react-router', async () => {
    const actual = await vi.importActual<typeof import('@tanstack/react-router')>(
      '@tanstack/react-router',
    )
    return {
      ...actual,
      useNavigate: () => vi.fn(),
      useLocation: () => ({ pathname: '/', search: {}, hash: '' }),
      useSearch: () => ({}),
      useParams: () => ({}),
    }
  })

  // Mock sonner toast (user-visible notifications) to inert spies.
  vi.mock('sonner', () => ({
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    },
  }))
  ```
  Notes on the two type fixes baked in: (1) `createObjectURL` is now typed `(_object: Blob | MediaSource) => string`, matching the DOM lib signature, so TS2322 is gone; (2) `vi.importActual` comes from `vitest`'s `vi`, which has the method, so TS2339 is gone. The manual `Window` injection and the `declare module 'bun:test'` matcher block are deleted — happy-dom + `@testing-library/jest-dom/vitest` cover both.

- [ ] **Step 3: Add Vitest globals to the TypeScript `types` array**
  In `tsconfig.json`, change:
  ```json
      "types": ["bun-types"],
  ```
  to:
  ```json
      "types": ["bun-types", "vitest/globals", "@testing-library/jest-dom"],
  ```
  This makes the ambient `vi`/`describe`/`it`/`expect` globals (used by every migrated test once they drop the `bun:test` import) type-check, and registers the jest-dom matcher types so `toBeInTheDocument()` etc. resolve without the hand-written `declare module` block that was just removed.

- [ ] **Step 4: Verify setup.ts no longer contributes type errors**
  Run:
  ```bash
  cd /Users/youming/GitHub/youming-ai/shadowing-learning && bun run --bun tsc --noEmit 2>&1 | grep -c "src/__tests__/setup.ts"; echo "(0 means setup.ts is clean)"
  ```
  Expected: prints `0` (setup.ts errors resolved; the four test-fixture errors fixed in A.5–A.7 may still print for other files).

- [ ] **Step 5: Commit**
  ```bash
  cd /Users/youming/GitHub/youming-ai/shadowing-learning && \
  git add src/__tests__/setup.ts tsconfig.json && \
  git commit -m "test: rewrite setup.ts for Vitest (jest-dom/vitest, happy-dom, importActual)"
  ```

---

### Task A.5: Fix stale fixtures in `useTranscription.test.tsx`
**Files:**
- Modify: `src/hooks/api/__tests__/useTranscription.test.tsx` (import line 3; mock-shape and fetch-mock fixes)

Real errors in this file: the `import … from 'bun:test'` (line 3) provides a `vi` shim with no `mocked`/`importActual` (9× `TS2551`), the `useTranscriptionStatus` `toEqual` assertions are missing the new `postProcessStatus` field (lines 118, 133 → `TS2769`), and the `global.fetch = vi.fn()` assignments are missing `fetch`'s `preconnect` property (lines 156, 235 → `TS2741`; the cast at line 213 → `TS2352`). Switch the import to `vitest`, add `postProcessStatus` to both expected objects, and assign fetch through an `unknown` cast so the `Mock` vs `typeof fetch` mismatch is resolved.

- [ ] **Step 1: Reproduce the failing state**
  Run:
  ```bash
  cd /Users/youming/GitHub/youming-ai/shadowing-learning && bun run --bun tsc --noEmit 2>&1 | grep -c "useTranscription.test.tsx"
  ```
  Expected: FAIL — prints `14`.

- [ ] **Step 2a: Switch the test import to Vitest**
  Change line 3 from:
  ```tsx
  import { beforeEach, describe, expect, it, vi } from 'bun:test'
  ```
  to:
  ```tsx
  import { beforeEach, describe, expect, it, vi } from 'vitest'
  ```

- [ ] **Step 2b: Add `postProcessStatus` to the first `toEqual` (the "transcript and segments exist" test)**
  Change:
  ```tsx
        await waitFor(() => {
          expect(result.current.data).toEqual({
            transcript: mockTranscript,
            segments: mockSegments,
          })
        })
  ```
  to:
  ```tsx
        await waitFor(() => {
          expect(result.current.data).toEqual({
            transcript: mockTranscript,
            segments: mockSegments,
            postProcessStatus: mockTranscript.postProcessStatus,
          })
        })
  ```
  (`mockTranscript` has no `postProcessStatus` key, so `mockTranscript.postProcessStatus` is `undefined`, which matches what `useTranscriptionStatus` returns from `transcript.postProcessStatus` for this fixture.)

- [ ] **Step 2c: Add `postProcessStatus` to the second `toEqual` (the "no transcript exists" test)**
  Change:
  ```tsx
        await waitFor(() => {
          expect(result.current.data).toEqual({
            transcript: null,
            segments: [],
          })
        })
  ```
  to:
  ```tsx
        await waitFor(() => {
          expect(result.current.data).toEqual({
            transcript: null,
            segments: [],
            postProcessStatus: undefined,
          })
        })
  ```

- [ ] **Step 2d: Fix the `global.fetch = vi.fn()` assignment in the `useTranscription` describe block**
  Change:
  ```tsx
      beforeEach(() => {
        vi.mocked(DBUtils.getFile).mockResolvedValue(mockFile)

        // Mock fetch
        global.fetch = vi.fn()
      })
  ```
  to:
  ```tsx
      beforeEach(() => {
        vi.mocked(DBUtils.getFile).mockResolvedValue(mockFile)

        // Mock fetch — cast through unknown because vi.fn() does not carry
        // fetch's `preconnect` member that the DOM `typeof fetch` type requires.
        global.fetch = vi.fn() as unknown as typeof fetch
      })
  ```

- [ ] **Step 2e: Fix the skipped retry test's `global.fetch = mockFetch` assignment**
  Inside the `it.skip('should retry failed requests', …)` body, change:
  ```tsx
        // Reset fetch mock for this specific test
        const mockFetch = vi.fn()
        global.fetch = mockFetch
  ```
  to:
  ```tsx
        // Reset fetch mock for this specific test
        const mockFetch = vi.fn()
        global.fetch = mockFetch as unknown as typeof fetch
  ```

- [ ] **Step 2f: Fix the `(global.fetch as ReturnType<typeof vi.fn>)` cast in the "handle transcription errors" test**
  Change:
  ```tsx
        ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse as any)
  ```
  to:
  ```tsx
        ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse as any)
  ```

- [ ] **Step 3: Verify this file is type-clean**
  Run:
  ```bash
  cd /Users/youming/GitHub/youming-ai/shadowing-learning && bun run --bun tsc --noEmit 2>&1 | grep -c "useTranscription.test.tsx"; echo "(expect 0)"
  ```
  Expected: prints `0`.

- [ ] **Step 4: Run the suite under Vitest to confirm the runner binds React**
  Run:
  ```bash
  cd /Users/youming/GitHub/youming-ai/shadowing-learning && bunx vitest run src/hooks/api/__tests__/useTranscription.test.tsx 2>&1 | tail -20
  ```
  Expected: the suite executes under Vitest with `renderHook` working — output contains NO `Invalid hook call` and NO `resolveDispatcher() is null`. Tests should report pass (the one `it.skip` stays skipped).

- [ ] **Step 5: Commit**
  ```bash
  cd /Users/youming/GitHub/youming-ai/shadowing-learning && \
  git add src/hooks/api/__tests__/useTranscription.test.tsx && \
  git commit -m "test(useTranscription): migrate to vitest import, add postProcessStatus, fix fetch mock typing"
  ```

---

### Task A.6: Fix stale fixtures in `useFiles.test.tsx` and `db-utils.test.ts`; remove `bunfig.toml`
**Files:**
- Modify: `src/hooks/db/__tests__/useFiles.test.tsx` (import line 4; fixture at line ~42)
- Modify: `src/lib/db/__tests__/db-utils.test.ts` (import line 1; mock + assertion at lines ~147-162)
- Delete: `bunfig.toml`

`useFiles.test.tsx(54,44)` fails because the `mockFiles` fixture used in the `toEqual(mockFiles)` against `FileRow[]` lacks the required `uploadedAt`/`updatedAt`. `db-utils.test.ts(158,30)` fails because the `findTranscriptByFileId` mock `first()` resolves a `TranscriptRow` missing `createdAt`/`updatedAt`, and the `toEqual` compares against the same short object. Both files also still `import … from 'bun:test'`. Finally, `bunfig.toml`'s `[test] preload` would make `bun test` double-load the (now Vitest-only) setup — it is removed to avoid a second test runner track.

- [ ] **Step 1: Reproduce the failing state**
  Run:
  ```bash
  cd /Users/youming/GitHub/youming-ai/shadowing-learning && bun run --bun tsc --noEmit 2>&1 | grep -E "useFiles.test.tsx|db-utils.test.ts" | grep -c "error TS"
  ```
  Expected: FAIL — prints `2` (one error in each file).

- [ ] **Step 2a: `useFiles.test.tsx` — switch the test import to Vitest**
  Change line 4 from:
  ```tsx
  import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test'
  ```
  to:
  ```tsx
  import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
  ```

- [ ] **Step 2b: `useFiles.test.tsx` — add `uploadedAt`/`updatedAt` to the `mockFiles` fixture used in the `toEqual(mockFiles)` assertion**
  In the `'should load files on mount'` test, change:
  ```tsx
        const mockFiles = [
          { id: 1, name: 'test1.mp3', size: 1000, type: 'audio/mpeg' },
          { id: 2, name: 'test2.mp3', size: 2000, type: 'audio/mpeg' },
        ]
  ```
  to:
  ```tsx
        const mockFiles = [
          {
            id: 1,
            name: 'test1.mp3',
            size: 1000,
            type: 'audio/mpeg',
            uploadedAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 2,
            name: 'test2.mp3',
            size: 2000,
            type: 'audio/mpeg',
            uploadedAt: new Date(),
            updatedAt: new Date(),
          },
        ]
  ```
  (The other inline file objects in this file — e.g. `{ id: 1, name: 'test.mp3', size: 7, type: 'audio/mpeg' }` at the `addFiles` test and `{ id: 1, name: 'test.mp3' }` at the `deleteFile` test — feed `mockResolvedValue(...)` on a `vi.fn()` mock with no `FileRow[]` constraint applied at the call site, so they do not trigger `TS2769`. Only the `toEqual(mockFiles)` fixture is type-checked against `FileRow[]`. Leave the others unchanged.)

- [ ] **Step 2c: `db-utils.test.ts` — switch the test import to Vitest**
  Change line 1 from:
  ```ts
  import { beforeEach, describe, expect, it, vi } from 'bun:test'
  ```
  to:
  ```ts
  import { beforeEach, describe, expect, it, vi } from 'vitest'
  ```

- [ ] **Step 2d: `db-utils.test.ts` — add `createdAt`/`updatedAt` to the `findTranscriptByFileId` mock and its assertion**
  In the `'should find transcript by file id'` test, change:
  ```ts
      it('should find transcript by file id', async () => {
        const mockWhere = vi.fn().mockReturnValue({
          equals: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({
            id: 1,
            fileId: 1,
            status: 'completed',
          }),
        })
        db.transcripts.where = mockWhere

        const result = await DBUtils.findTranscriptByFileId(1)

        expect(mockWhere).toHaveBeenCalledWith('fileId')
        expect(result).toEqual({
          id: 1,
          fileId: 1,
          status: 'completed',
        })
      })
  ```
  to:
  ```ts
      it('should find transcript by file id', async () => {
        const transcriptCreatedAt = new Date()
        const transcriptUpdatedAt = new Date()
        const mockWhere = vi.fn().mockReturnValue({
          equals: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({
            id: 1,
            fileId: 1,
            status: 'completed',
            createdAt: transcriptCreatedAt,
            updatedAt: transcriptUpdatedAt,
          }),
        })
        db.transcripts.where = mockWhere

        const result = await DBUtils.findTranscriptByFileId(1)

        expect(mockWhere).toHaveBeenCalledWith('fileId')
        expect(result).toEqual({
          id: 1,
          fileId: 1,
          status: 'completed',
          createdAt: transcriptCreatedAt,
          updatedAt: transcriptUpdatedAt,
        })
      })
  ```
  (Shared `Date` instances are used so the mock value and the `toEqual` expectation reference the same timestamps and compare equal.)

- [ ] **Step 2e: Delete `bunfig.toml`**
  Run:
  ```bash
  cd /Users/youming/GitHub/youming-ai/shadowing-learning && rm bunfig.toml && ls bunfig.toml 2>&1
  ```
  Expected: `ls: bunfig.toml: No such file or directory` (the `[test] preload` that pointed `bun test` at setup.ts is gone).

- [ ] **Step 3: Verify both files are type-clean and no errors remain anywhere**
  Run:
  ```bash
  cd /Users/youming/GitHub/youming-ai/shadowing-learning && bun run --bun tsc --noEmit 2>&1 | grep -c "error TS"; echo "(expect 0)"
  ```
  Expected: prints `0` — the full project type-checks (down from 18 errors).

- [ ] **Step 4: Run both suites under Vitest**
  Run:
  ```bash
  cd /Users/youming/GitHub/youming-ai/shadowing-learning && bunx vitest run src/hooks/db/__tests__/useFiles.test.tsx src/lib/db/__tests__/db-utils.test.ts 2>&1 | tail -20
  ```
  Expected: both suites execute and pass under Vitest; output contains NO `Invalid hook call`.

- [ ] **Step 5: Commit**
  ```bash
  cd /Users/youming/GitHub/youming-ai/shadowing-learning && \
  git add src/hooks/db/__tests__/useFiles.test.tsx src/lib/db/__tests__/db-utils.test.ts && \
  git rm bunfig.toml && \
  git commit -m "test(db): migrate useFiles/db-utils fixtures to vitest, drop bunfig [test] preload"
  ```
  (Note: `git rm bunfig.toml` records the deletion. Because `bunfig.toml` is currently untracked WIP in the working tree, if `git rm` reports it is not tracked, instead run `git add bunfig.toml` is NOT applicable — simply ensure the file is absent and proceed; the deletion needs no index entry. Confirm with `git status --short bunfig.toml` showing no output.)

---

### Task A.7: Phase verification — build green, type-check clean, runner binds React
**Files:**
- (none — verification only)

- [ ] **Step 1: Build passes**
  Run:
  ```bash
  cd /Users/youming/GitHub/youming-ai/shadowing-learning && bun run build > /tmp/shadowing-build.log 2>&1; echo "EXIT=$?"; grep -i "card-base" /tmp/shadowing-build.log || echo "no card-base error"
  ```
  Expected: `EXIT=0` and `no card-base error`.

- [ ] **Step 2: Type-check is clean**
  Run:
  ```bash
  cd /Users/youming/GitHub/youming-ai/shadowing-learning && bun run type-check 2>&1 | grep -c "error TS"; echo "(expect 0)"
  ```
  Expected: prints `0`.

- [ ] **Step 3: The migrated suites are green and the runner binds React (renderHook works)**
  Run:
  ```bash
  cd /Users/youming/GitHub/youming-ai/shadowing-learning && bunx vitest run \
    src/hooks/api/__tests__/useTranscription.test.tsx \
    src/hooks/db/__tests__/useFiles.test.tsx \
    src/lib/db/__tests__/db-utils.test.ts \
    src/components/features/file/__tests__/FileUpload.test.tsx 2>&1 | tee /tmp/shadowing-vitest.log | tail -25; \
    echo "--- hook-binding check ---"; \
    grep -c "Invalid hook call\|resolveDispatcher() is null" /tmp/shadowing-vitest.log; echo "(expect 0)"
  ```
  Expected: the four suites run under Vitest; the hook-binding grep prints `0`, proving `@testing-library/react`'s `renderHook` binds React 19.2.5 correctly (the original `bun test` failure mode is gone).

- [ ] **Step 4: Full suite boots (player suites allowed to fail on logic, NOT on hook binding)**
  Run:
  ```bash
  cd /Users/youming/GitHub/youming-ai/shadowing-learning && bun run test:run 2>&1 | tee /tmp/shadowing-fullrun.log | tail -30; \
    echo "--- hook-binding check across full suite ---"; \
    grep -c "Invalid hook call\|resolveDispatcher() is null" /tmp/shadowing-fullrun.log; echo "(expect 0)"
  ```
  Expected: `bun run test:run` invokes `vitest run` and executes the whole `src/**/*.test.{ts,tsx}` set under happy-dom. Any player-test failures are pre-existing feature-logic gaps (addressed in Phases C–E), but the hook-binding grep MUST print `0` — no suite fails on `Invalid hook call`. This is the phase's acceptance gate per the design spec §9.2.

- [ ] **Step 5: No commit needed**
  This task only runs verification; all changes were committed in A.1–A.6. Confirm a clean phase tree for the touched paths:
  ```bash
  cd /Users/youming/GitHub/youming-ai/shadowing-learning && git status --short -- vitest.config.ts package.json tsconfig.json src/styles/app.css src/__tests__/setup.ts src/hooks/api/__tests__/useTranscription.test.tsx src/hooks/db/__tests__/useFiles.test.tsx src/lib/db/__tests__/db-utils.test.ts
  ```
  Expected: prints nothing (every Phase A change is committed; unrelated migration WIP elsewhere remains untouched and unstaged).

**✅ A done when:** Run in order: (1) `bun run build` — exits 0, no "Cannot apply unknown utility class card-base"; (2) `bun run type-check` — prints nothing and exits 0 (was 18 errors across 4 files: setup.ts×2, useTranscription.test.tsx×14, useFiles.test.tsx×1, db-utils.test.ts×1); (3) `bun run test:run` — Vitest boots with happy-dom and binds React 19.2.5 so `renderHook` works; grepping the output for "Invalid hook call" / "resolveDispatcher() is null" returns 0. The four migrated suites (useTranscription, useFiles, db-utils, FileUpload) execute green; player suites may still fail on feature logic but never on hook binding.

---

## Phase B: Word timestamps & data correctness

This phase is independent of the player refactor (Phases C/D/E). It only depends on **Phase A** having reverted the test runner to Vitest (so tests import from `vitest`, not `bun:test`, and run with `bunx vitest run`). All four sub-goals are pure-logic / data-correctness work:

1. Add `distributeWordsIntoSegments` to `src/lib/ai/groq-transcription-utils.ts` (locked signature) with full TDD coverage.
2. Wire it into `src/routes/api/transcribe.ts` so the top-level Whisper `words` array fills each segment's `wordTimestamps` (karaoke highlight currently never lights up because Whisper returns words at the top level, not per-segment).
3. Make furigana→word alignment in `ScrollableSubtitleDisplay.tsx` robust (attach ruby readings only when counts align or token text matches; otherwise fall back to whole-segment furigana).
4. Remove the dead `Segment.romaji` field from `src/types/db/database.ts` and its renderer references.

> **Commit discipline:** always `git add` explicit paths — never `git add -A` — because the working tree carries unrelated migration WIP.

---

### Task B.1: Add `distributeWordsIntoSegments` to groq-transcription-utils

**Files:**
- Modify: `src/lib/ai/groq-transcription-utils.ts` (append after `buildSegmentsFromPlainText`, before `extractSegmentsFromGroq` — currently lines 119-121)
- Test: `src/lib/ai/__tests__/groq-transcription-utils.test.ts` (add a new `describe` block + update the import on line 3)

- [ ] **Step 1: Write the failing test**

First update the import line of the test file (line 1 currently reads `import { describe, expect, it } from 'bun:test'` — after Phase A this is `'vitest'`; assume `'vitest'`). Change the function import block (lines 3-7) to include the new symbol, then append the new `describe` block before the final closing `})` on line 208.

Change the import block (lines 3-7) to:

```ts
import {
  buildSegmentsFromPlainText,
  buildSegmentsFromWords,
  distributeWordsIntoSegments,
  mapGroqSegmentToTranscriptionSegment,
} from '../groq-transcription-utils'
```

Then insert this `describe` block immediately before the file's final closing `})`:

```ts
  describe('distributeWordsIntoSegments', () => {
    it('assigns a word whose start falls inside a segment', () => {
      const segments: TranscriptionSegment[] = [
        { id: 1, start: 0, end: 2, text: 'hello world', confidence: 0.95 },
        { id: 2, start: 2, end: 4, text: 'foo bar', confidence: 0.95 },
      ]
      const words = [
        { word: 'hello', start: 0, end: 1 },
        { word: 'world', start: 1, end: 2 },
        { word: 'foo', start: 2.5, end: 3 },
        { word: 'bar', start: 3, end: 4 },
      ]

      const result = distributeWordsIntoSegments(segments, words)

      expect(result[0].wordTimestamps).toEqual([
        { word: 'hello', start: 0, end: 1 },
        { word: 'world', start: 1, end: 2 },
      ])
      expect(result[1].wordTimestamps).toEqual([
        { word: 'foo', start: 2.5, end: 3 },
        { word: 'bar', start: 3, end: 4 },
      ])
    })

    it('uses a half-open [start, end) boundary so a word at seg.end goes to the next segment', () => {
      const segments: TranscriptionSegment[] = [
        { id: 1, start: 0, end: 2, text: 'a', confidence: 0.95 },
        { id: 2, start: 2, end: 4, text: 'b', confidence: 0.95 },
      ]
      const words = [
        { word: 'a', start: 0, end: 2 },
        { word: 'b', start: 2, end: 3 }, // start === seg1.end → belongs to seg2
      ]

      const result = distributeWordsIntoSegments(segments, words)

      expect(result[0].wordTimestamps).toEqual([{ word: 'a', start: 0, end: 2 }])
      expect(result[1].wordTimestamps).toEqual([{ word: 'b', start: 2, end: 3 }])
    })

    it('leaves a segment with no matching words as an empty array', () => {
      const segments: TranscriptionSegment[] = [
        { id: 1, start: 0, end: 2, text: 'a', confidence: 0.95 },
        { id: 2, start: 2, end: 4, text: 'b', confidence: 0.95 },
      ]
      const words = [{ word: 'a', start: 0.5, end: 1 }]

      const result = distributeWordsIntoSegments(segments, words)

      expect(result[0].wordTimestamps).toEqual([{ word: 'a', start: 0.5, end: 1 }])
      expect(result[1].wordTimestamps).toEqual([])
    })

    it('drops words that fall in a gap between segments (no nearest-snap)', () => {
      const segments: TranscriptionSegment[] = [
        { id: 1, start: 0, end: 1, text: 'a', confidence: 0.95 },
        { id: 2, start: 3, end: 4, text: 'b', confidence: 0.95 },
      ]
      const words = [
        { word: 'a', start: 0.2, end: 0.8 },
        { word: 'gap', start: 1.5, end: 2.5 }, // in the 1..3 gap → assigned to neither
        { word: 'b', start: 3.1, end: 3.9 },
      ]

      const result = distributeWordsIntoSegments(segments, words)

      expect(result[0].wordTimestamps).toEqual([{ word: 'a', start: 0.2, end: 0.8 }])
      expect(result[1].wordTimestamps).toEqual([{ word: 'b', start: 3.1, end: 3.9 }])
    })

    it('returns an empty array when segments is empty', () => {
      const result = distributeWordsIntoSegments([], [{ word: 'x', start: 0, end: 1 }])

      expect(result).toEqual([])
    })

    it('preserves all non-word fields of each segment', () => {
      const segments: TranscriptionSegment[] = [
        { id: 7, start: 0, end: 2, text: 'kept', confidence: 0.42 },
      ]
      const words = [{ word: 'kept', start: 0, end: 1 }]

      const result = distributeWordsIntoSegments(segments, words)

      expect(result[0].id).toBe(7)
      expect(result[0].text).toBe('kept')
      expect(result[0].confidence).toBe(0.42)
      expect(result[0].start).toBe(0)
      expect(result[0].end).toBe(2)
    })

    it('does not mutate the input segments', () => {
      const segments: TranscriptionSegment[] = [
        { id: 1, start: 0, end: 2, text: 'a', confidence: 0.95 },
      ]
      const words = [{ word: 'a', start: 0, end: 1 }]

      distributeWordsIntoSegments(segments, words)

      expect(segments[0].wordTimestamps).toBeUndefined()
    })
  })
```

This also requires importing the `TranscriptionSegment` type. The test file currently imports types on line 2: `import type { GroqTranscriptionSegment, GroqTranscriptionWord } from '~/types/transcription'`. Change that line to:

```ts
import type {
  GroqTranscriptionSegment,
  GroqTranscriptionWord,
  TranscriptionSegment,
} from '~/types/transcription'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/lib/ai/__tests__/groq-transcription-utils.test.ts`
Expected: FAIL — TypeScript/import error `distributeWordsIntoSegments is not exported` (the function does not exist yet), and the new `describe` block's assertions cannot run.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/ai/groq-transcription-utils.ts`, insert this function immediately after the closing brace of `buildSegmentsFromPlainText` (after line 119) and before `extractSegmentsFromGroq` (line 121):

```ts
/**
 * Whisper 在 verbose_json 下把逐词时间戳放在顶层 `words` 数组，而不是挂在各 segment 上。
 * 本函数按 word.start 落在 [seg.start, seg.end) 的半开区间把词分配进对应 segment，
 * 写入 seg.wordTimestamps。落在段间间隙（不属于任何段）的词被丢弃。
 * 纯函数：不修改入参，返回新数组。
 */
export function distributeWordsIntoSegments(
  segments: TranscriptionSegment[],
  words: { word: string; start: number; end: number }[],
): TranscriptionSegment[] {
  return segments.map((segment) => ({
    ...segment,
    wordTimestamps: words
      .filter((word) => word.start >= segment.start && word.start < segment.end)
      .map((word) => ({ word: word.word, start: word.start, end: word.end })),
  }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/lib/ai/__tests__/groq-transcription-utils.test.ts`
Expected: PASS — all existing `mapGroqSegmentToTranscriptionSegment` / `buildSegmentsFromWords` / `buildSegmentsFromPlainText` cases still green, plus the 7 new `distributeWordsIntoSegments` cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/groq-transcription-utils.ts src/lib/ai/__tests__/groq-transcription-utils.test.ts
git commit -m "feat: distribute top-level Whisper words into segments by [start,end)"
```

---

### Task B.2: Wire `distributeWordsIntoSegments` into the transcribe route

**Files:**
- Modify: `src/routes/api/transcribe.ts` (import block lines 5-9; segment branch + response build lines 247-272)

This route has no unit test today (it hits the Groq SDK). The change is a small, type-checked wiring edit; verification is `bun run type-check` plus the existing util tests from B.1. No new test file is created.

- [ ] **Step 1: Add the import**

In `src/routes/api/transcribe.ts`, the current import block is (lines 5-9):

```ts
import {
  buildSegmentsFromPlainText,
  buildSegmentsFromWords,
  mapGroqSegmentToTranscriptionSegment,
} from '~/lib/ai/groq-transcription-utils'
```

Replace it with (adds `distributeWordsIntoSegments`, alphabetically before `mapGroqSegmentToTranscriptionSegment`):

```ts
import {
  buildSegmentsFromPlainText,
  buildSegmentsFromWords,
  distributeWordsIntoSegments,
  mapGroqSegmentToTranscriptionSegment,
} from '~/lib/ai/groq-transcription-utils'
```

- [ ] **Step 2: Apply the wiring edit (segment branch only)**

The current block is (lines 247-272):

```ts
    let processedSegments: TranscriptionSegment[] = []

    if (Array.isArray(transcriptionData.segments) && transcriptionData.segments.length > 0) {
      processedSegments = transcriptionData.segments.map((segment, index) =>
        mapGroqSegmentToTranscriptionSegment(segment, index + 1),
      )
      apiLogger.debug('使用 Groq SDK 返回的 segments:', processedSegments.length)
    } else if (Array.isArray(transcriptionData.words) && transcriptionData.words.length > 0) {
      apiLogger.debug('Groq SDK 未返回 segments，根据 words 生成')
      processedSegments = buildSegmentsFromWords(transcriptionData.words, 10)
      apiLogger.debug('根据 words 生成的 segments:', processedSegments.length)
    } else if (typeof transcriptionData.text === 'string' && transcriptionData.text.length > 0) {
      apiLogger.debug('Groq SDK 未返回详细数据，生成基本 segments')
      processedSegments = buildSegmentsFromPlainText(
        transcriptionData.text,
        transcriptionData.duration,
      )
      apiLogger.debug('生成的基本 segments:', processedSegments.length)
    }

    const transcriptionResponse = {
      text: transcriptionData.text ?? '',
      language: transcriptionData.language || language,
      duration: transcriptionData.duration,
      segments: processedSegments,
    }
```

Replace it with (only the segment branch changes — `buildSegmentsFromWords` already fills `wordTimestamps`, so we only redistribute when segments came from Groq and a separate top-level `words` array is available):

```ts
    let processedSegments: TranscriptionSegment[] = []

    if (Array.isArray(transcriptionData.segments) && transcriptionData.segments.length > 0) {
      processedSegments = transcriptionData.segments.map((segment, index) =>
        mapGroqSegmentToTranscriptionSegment(segment, index + 1),
      )
      apiLogger.debug('使用 Groq SDK 返回的 segments:', processedSegments.length)

      if (Array.isArray(transcriptionData.words) && transcriptionData.words.length > 0) {
        const topLevelWords = transcriptionData.words.map((word) => ({
          word: word.word ?? '',
          start: typeof word.start === 'number' ? word.start : 0,
          end:
            typeof word.end === 'number'
              ? word.end
              : typeof word.start === 'number'
                ? word.start
                : 0,
        }))
        processedSegments = distributeWordsIntoSegments(processedSegments, topLevelWords)
        apiLogger.debug('按时间分配顶层 words 进 segments:', topLevelWords.length)
      }
    } else if (Array.isArray(transcriptionData.words) && transcriptionData.words.length > 0) {
      apiLogger.debug('Groq SDK 未返回 segments，根据 words 生成')
      processedSegments = buildSegmentsFromWords(transcriptionData.words, 10)
      apiLogger.debug('根据 words 生成的 segments:', processedSegments.length)
    } else if (typeof transcriptionData.text === 'string' && transcriptionData.text.length > 0) {
      apiLogger.debug('Groq SDK 未返回详细数据，生成基本 segments')
      processedSegments = buildSegmentsFromPlainText(
        transcriptionData.text,
        transcriptionData.duration,
      )
      apiLogger.debug('生成的基本 segments:', processedSegments.length)
    }

    const transcriptionResponse = {
      text: transcriptionData.text ?? '',
      language: transcriptionData.language || language,
      duration: transcriptionData.duration,
      segments: processedSegments,
    }
```

- [ ] **Step 3: Type-check the change**

Run: `bun run type-check`
Expected: PASS — 0 errors. (`distributeWordsIntoSegments` signature accepts `{ word; start; end }[]`; `topLevelWords` is mapped to exactly that shape, normalizing the optional `GroqTranscriptionWord` fields.)

- [ ] **Step 4: Re-run the util suite as a regression net**

Run: `bunx vitest run src/lib/ai/__tests__/groq-transcription-utils.test.ts`
Expected: PASS — unchanged from Task B.1 (the route imports the same function under test).

- [ ] **Step 5: Commit**

```bash
git add src/routes/api/transcribe.ts
git commit -m "feat: fill segment wordTimestamps from top-level Whisper words in transcribe route"
```

---

### Task B.3: Make furigana→word alignment robust in ScrollableSubtitleDisplay

**Files:**
- Modify: `src/components/features/player/ScrollableSubtitleDisplay.tsx` (the `segmentTokens` useMemo, lines 191-224; add a small alignment helper above the component)
- Test: `src/components/features/player/__tests__/ScrollableSubtitleDisplay.test.tsx` (add two cases; assume `vitest` import after Phase A)

Today (line 198-199) the renderer zips `wordTimestamps[index].word` with `furiganaEntries[index].reading` purely by array index. When the furigana count differs from the word count, readings get attached to the wrong words. We make it robust: attach readings by **token text match** when possible; if neither the counts align nor every token matches a reading, **fall back to whole-segment furigana rendering** (no per-word ruby).

- [ ] **Step 1: Write the failing test**

Append these two cases to the `describe('ScrollableSubtitleDisplay Component', ...)` block in `src/components/features/player/__tests__/ScrollableSubtitleDisplay.test.tsx`, immediately after the existing `renders furigana as ruby annotation when reading is present` case (after line 189):

```ts
  it('attaches furigana to the matching word even when counts differ', () => {
    // 3 words, but only 1 furigana entry; match must be by text, not index.
    const jaSegment: Segment = {
      id: 1,
      transcriptId: 1,
      start: 0,
      end: 3,
      text: '私 は 日本',
      normalizedText: '私 は 日本',
      furigana: JSON.stringify([{ text: '日本', reading: 'にほん' }]),
      wordTimestamps: [
        { word: '私', start: 0, end: 1 },
        { word: 'は', start: 1, end: 2 },
        { word: '日本', start: 2, end: 3 },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    render(
      <ScrollableSubtitleDisplay
        segments={[jaSegment]}
        currentTime={0.5}
        isPlaying={false}
        onSegmentClick={vi.fn()}
      />,
    )

    // The reading must land on 日本 specifically (index 2), not on the index-0 word 私.
    const ruby = screen.getByText('にほん').closest('ruby')
    expect(ruby).not.toBeNull()
    expect(ruby).toHaveTextContent('日本')
    expect(ruby).not.toHaveTextContent('私')
  })

  it('does not attach any reading when no furigana entry matches a word', () => {
    const jaSegment: Segment = {
      id: 1,
      transcriptId: 1,
      start: 0,
      end: 2,
      text: 'foo bar',
      normalizedText: 'foo bar',
      furigana: JSON.stringify([{ text: '日本', reading: 'にほん' }]),
      wordTimestamps: [
        { word: 'foo', start: 0, end: 1 },
        { word: 'bar', start: 1, end: 2 },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    render(
      <ScrollableSubtitleDisplay
        segments={[jaSegment]}
        currentTime={0.5}
        isPlaying={false}
        onSegmentClick={vi.fn()}
      />,
    )

    // No word matches the only furigana entry → the stray reading must not render on a word.
    expect(screen.queryByText('にほん')).not.toBeInTheDocument()
    expect(screen.getByText('foo')).toBeInTheDocument()
    expect(screen.getByText('bar')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/components/features/player/__tests__/ScrollableSubtitleDisplay.test.tsx`
Expected: FAIL — with the current index-based zip, the single `にほん` reading is attached to word index 0 (`私` / `foo`) instead of the matching word, so `attaches furigana to the matching word even when counts differ` fails on `expect(ruby).toHaveTextContent('日本')`, and `does not attach any reading when no furigana entry matches` fails because `にほん` renders on `foo`.

- [ ] **Step 3: Write minimal implementation**

First add an alignment helper above the component. Insert it right after the `normalizeFurigana` function (after its closing brace on line 126) and before the `const ScrollableSubtitleDisplay = React.memo<...>` declaration (line 128):

```ts
/**
 * 把 furigana 条目按「词文本匹配」附到对应词上，不再按数组下标硬对齐。
 * furigana 数与词数不等也安全：只在 entry.text === word 时附读音；
 * 没有任何匹配则返回不带读音的词序列（降级为整段文本）。
 */
function attachReadingsToWords(
  words: { word: string; start: number; end: number }[],
  furiganaEntries: FuriganaEntry[],
): Token[] {
  if (furiganaEntries.length === 0) {
    return words.map((timestamp) => ({
      word: timestamp.word,
      start: timestamp.start,
      end: timestamp.end,
    }))
  }

  const readingByText = new Map<string, string>()
  for (const entry of furiganaEntries) {
    if (!readingByText.has(entry.text)) {
      readingByText.set(entry.text, entry.reading)
    }
  }

  // 等长时优先按下标对齐（保持原行为）；否则按文本匹配。
  const useIndexAlignment = furiganaEntries.length === words.length

  return words.map((timestamp, index) => {
    const reading = useIndexAlignment
      ? furiganaEntries[index]?.reading
      : readingByText.get(timestamp.word)
    return {
      word: timestamp.word,
      reading,
      start: timestamp.start,
      end: timestamp.end,
    }
  })
}
```

Then remove the now-unused `romaji` field from the `Token` interface (line 22-26 currently):

```ts
interface Token {
  word: string
  reading?: string
  romaji?: string
  start?: number
  end?: number
}
```

becomes:

```ts
interface Token {
  word: string
  reading?: string
  start?: number
  end?: number
}
```

Then replace the `segmentTokens` useMemo body. The current block is (lines 191-224):

```ts
    const segmentTokens = useMemo<Token[][]>(() => {
      return segments.map((segment) => {
        const furiganaEntries = normalizeFurigana(segment.furigana as unknown)

        if (Array.isArray(segment.wordTimestamps) && segment.wordTimestamps.length > 0) {
          return segment.wordTimestamps.map((timestamp, index) => ({
            word: timestamp.word,
            reading: furiganaEntries[index]?.reading,
            romaji: furiganaEntries[index]?.reading,
            start: timestamp.start,
            end: timestamp.end,
          })) as Token[]
        }

        if (furiganaEntries.length > 0) {
          return furiganaEntries.map((entry) => ({
            word: entry.text,
            reading: entry.reading,
            romaji: entry.reading,
          })) as Token[]
        }

        const tokenBaseText = segment.normalizedText || segment.text
        if (tokenBaseText) {
          const tokens = tokenBaseText.split(/\s+/).filter(Boolean)

          if (tokens.length > 1) {
            return tokens.map((word) => ({ word })) as Token[]
          }
        }

        return [] as Token[]
      }) as Token[][]
    }, [segments])
```

Replace it with (uses the helper, drops `romaji`, keeps the furigana-only and split-text fallbacks):

```ts
    const segmentTokens = useMemo<Token[][]>(() => {
      return segments.map((segment) => {
        const furiganaEntries = normalizeFurigana(segment.furigana as unknown)

        if (Array.isArray(segment.wordTimestamps) && segment.wordTimestamps.length > 0) {
          return attachReadingsToWords(segment.wordTimestamps, furiganaEntries)
        }

        if (furiganaEntries.length > 0) {
          return furiganaEntries.map((entry) => ({
            word: entry.text,
            reading: entry.reading,
          })) as Token[]
        }

        const tokenBaseText = segment.normalizedText || segment.text
        if (tokenBaseText) {
          const tokens = tokenBaseText.split(/\s+/).filter(Boolean)

          if (tokens.length > 1) {
            return tokens.map((word) => ({ word })) as Token[]
          }
        }

        return [] as Token[]
      }) as Token[][]
    }, [segments])
```

> Note: `attachReadingsToWords` accepts `segment.wordTimestamps` (typed `WordTimestamp[]`, which has `word/start/end` plus optional `confidence`) — assignable to the helper's `{ word; start; end }[]` parameter. The earlier `renders furigana as ruby annotation when reading is present` test (2 words, 2 furigana entries) stays green because counts are equal → index alignment.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/components/features/player/__tests__/ScrollableSubtitleDisplay.test.tsx`
Expected: PASS — the two new cases plus all existing cases (including `renders furigana as ruby annotation when reading is present`, `highlights the active word within the active segment`, and the 1000-segment perf case).

- [ ] **Step 5: Commit**

```bash
git add src/components/features/player/ScrollableSubtitleDisplay.tsx src/components/features/player/__tests__/ScrollableSubtitleDisplay.test.tsx
git commit -m "fix: align furigana to words by text match with whole-segment fallback"
```

---

### Task B.4: Remove the dead `Segment.romaji` field

**Files:**
- Modify: `src/types/db/database.ts` (line 49)

This is a non-TDD cleanup. The `romaji` field is never written anywhere (grep across `src` shows only the type definition, the now-removed `Token.romaji`/renderer references from Task B.3, an orphan `.romaji-word` CSS class, and docs). It is **not** part of any Dexie `.stores(...)` index string, so no DB version bump or `.upgrade()` migration is required (per the design spec §7).

- [ ] **Step 1: Confirm no remaining code references before deleting**

Run: `grep -rn "\.romaji\|romaji?" src/types src/components src/lib src/hooks`
Expected: exactly one hit — `src/types/db/database.ts:49:  romaji?: string`. (Task B.3 already removed `Token.romaji` and the two renderer assignments. The `.romaji-word` CSS class in `src/styles/app.css` is a style selector, not a TS reference, and is left untouched.)

- [ ] **Step 2: Delete the field**

In `src/types/db/database.ts`, the `Segment` interface currently is (lines 40-55):

```ts
export interface Segment {
  id?: number
  transcriptId: number
  segmentIndex?: number
  start: number
  end: number
  text: string
  normalizedText?: string
  translation?: string
  romaji?: string
  annotations?: string[]
  furigana?: string
  wordTimestamps?: WordTimestamp[]
  createdAt: Date
  updatedAt: Date
}
```

Remove the `romaji?: string` line so it becomes:

```ts
export interface Segment {
  id?: number
  transcriptId: number
  segmentIndex?: number
  start: number
  end: number
  text: string
  normalizedText?: string
  translation?: string
  annotations?: string[]
  furigana?: string
  wordTimestamps?: WordTimestamp[]
  createdAt: Date
  updatedAt: Date
}
```

- [ ] **Step 3: Type-check the whole project**

Run: `bun run type-check`
Expected: PASS — 0 errors. (No code reads `segment.romaji`; the renderer's `Token.romaji` was dropped in Task B.3.)

- [ ] **Step 4: Run the affected suites as a regression net**

Run: `bunx vitest run src/components/features/player/__tests__/ScrollableSubtitleDisplay.test.tsx src/lib/ai/__tests__/groq-transcription-utils.test.ts`
Expected: PASS — both files fully green; the `mockSegments` fixtures in the component test never set `romaji`, so nothing breaks.

- [ ] **Step 5: Commit**

```bash
git add src/types/db/database.ts
git commit -m "chore: remove dead Segment.romaji field"
```

---

### Task B.5: Phase B full verification

**Files:** none (verification only)

- [ ] **Step 1: Full type-check**

Run: `bun run type-check`
Expected: PASS — 0 errors.

- [ ] **Step 2: Full test suite**

Run: `bun run test:run`
Expected: PASS — entire Vitest suite green, including the two files touched this phase. No new failures introduced.

- [ ] **Step 3: Lint/format the touched files**

Run: `bunx biome check src/lib/ai/groq-transcription-utils.ts src/routes/api/transcribe.ts src/components/features/player/ScrollableSubtitleDisplay.tsx src/types/db/database.ts`
Expected: PASS — no Biome errors (2-space indent, single quotes, 100-col already satisfied by the snippets above). If Biome reports formatting fixes, run `bunx biome check --write <same paths>` and re-run.

- [ ] **Step 4: Commit any formatting fixups (only if Step 3 wrote changes)**

```bash
git add src/lib/ai/groq-transcription-utils.ts src/routes/api/transcribe.ts src/components/features/player/ScrollableSubtitleDisplay.tsx src/types/db/database.ts
git commit -m "style: biome format Phase B word-timestamp changes"
```

**✅ B done when:** Run `bunx vitest run src/lib/ai/__tests__/groq-transcription-utils.test.ts` (all distributeWordsIntoSegments + existing cases PASS), `bunx vitest run src/components/features/player/__tests__/ScrollableSubtitleDisplay.test.tsx` (furigana alignment + mismatch fallback cases PASS), then `bun run type-check` (0 errors, confirms Segment.romaji removal compiles) and `bun run test:run` (full suite green). The romaji field removal is type-only with no Dexie index reference (grep confirmed only the type def, an orphan CSS class, and docs reference romaji), so no DB migration is required.

> **Phase B notes:** Phase B is independent of the player refactor (C/D/E) and only depends on Phase A having reverted the runner to Vitest — so all task commands use `bunx vitest run` / `bun run test:run` / `bun run type-check`, and new/edited tests import from `vitest` (the existing files still import from `bun:test` at the snapshot I read; Phase A converts them). Key grounding facts: (1) `distributeWordsIntoSegments` uses a half-open [start,end) interval matched on word.start, matching the locked signature comment — words in inter-segment gaps are DROPPED (no nearest-snap; that nearest-snap behavior is reserved for findActiveSegmentIndex in Phase C, a different concern). (2) In transcribe.ts, `buildSegmentsFromWords` already populates wordTimestamps, so redistribution is applied ONLY in the Groq-segments branch when a separate top-level `words` array exists; the route has no unit test so verification is type-check + the util suite. (3) The furigana fix preserves the existing equal-count index-alignment path (so the existing 2-word/2-entry ruby test stays green) and adds text-match + whole-segment fallback for unequal counts. (4) Removing Segment.romaji is type-only — grep confirms no Dexie index references it (only the type def, the renderer refs removed in B.3, an orphan CSS class, and docs), so NO DB migration. Risk: if Phase A has not yet converted the two test files' imports from 'bun:test' to 'vitest', Task B.1/B.3 Step-1 edits assume 'vitest'; the import-line note in each task calls this out explicitly. ARCHITECTURE.md line 170 still lists romaji in the segments column — a doc-only staleness left out of scope per the spec, not load-bearing.

---

## Phase C: Pure engine logic (active-segment + shadowing FSM)

This phase implements the two pure, DOM-free engine modules that every later phase depends on:

- `src/lib/player/active-segment.ts` — `findActiveSegmentIndex` (binary search, with inter-segment-gap nearest-segment fallback).
- `src/lib/player/shadowing-machine.ts` — the shadowing FSM as a pure reducer, plus the locked types, `DEFAULT_SHADOWING_CONFIG`, and `EPSILON`.

Both are heavily TDD'd. No React, no `<audio>`, no rAF here — those are wired in Phase D. Tests run on Vitest with `globals: true` (set up in Phase A), so `describe`/`it`/`expect` need no import.

Prerequisites: Phase A (Vitest revert) is complete, so `bunx vitest run <path>` works and globals are available. Phase A/B do not touch `src/lib/player/`, so these files are net-new.

---

### Task C.1: `findActiveSegmentIndex` — hit, exact boundaries, and empty

**Files:**
- Create: `src/lib/player/active-segment.ts`
- Test: `src/lib/player/__tests__/active-segment.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/player/__tests__/active-segment.test.ts
import { findActiveSegmentIndex } from '~/lib/player/active-segment'

describe('findActiveSegmentIndex', () => {
  // Contiguous-ish segments with a couple of gaps, used across cases.
  const segments = [
    { start: 0, end: 2 }, // index 0
    { start: 2, end: 4 }, // index 1 (touches 0 at t=2)
    { start: 5, end: 7 }, // index 2 (gap 4..5 before it)
    { start: 9, end: 11 }, // index 3 (gap 7..9 before it)
  ]

  describe('direct hits', () => {
    it('returns the index of the segment strictly containing the time', () => {
      expect(findActiveSegmentIndex(segments, 1)).toBe(0)
      expect(findActiveSegmentIndex(segments, 3)).toBe(1)
      expect(findActiveSegmentIndex(segments, 6)).toBe(2)
      expect(findActiveSegmentIndex(segments, 10)).toBe(3)
    })
  })

  describe('exact boundaries', () => {
    it('matches a segment at its exact start', () => {
      expect(findActiveSegmentIndex(segments, 0)).toBe(0)
      expect(findActiveSegmentIndex(segments, 5)).toBe(2)
      expect(findActiveSegmentIndex(segments, 9)).toBe(3)
    })

    it('matches a segment at its exact end', () => {
      // t=2 is the end of index 0 and the start of index 1; the lower index wins.
      expect(findActiveSegmentIndex(segments, 2)).toBe(0)
      expect(findActiveSegmentIndex(segments, 7)).toBe(2)
      expect(findActiveSegmentIndex(segments, 11)).toBe(3)
    })
  })

  describe('empty input', () => {
    it('returns -1 when there are no segments', () => {
      expect(findActiveSegmentIndex([], 0)).toBe(-1)
      expect(findActiveSegmentIndex([], 5)).toBe(-1)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
  - Run: `bunx vitest run src/lib/player/__tests__/active-segment.test.ts`
  - Expected: FAIL because `~/lib/player/active-segment` does not exist yet (Vitest reports "Failed to resolve import" / cannot find module `findActiveSegmentIndex`).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/player/active-segment.ts

/**
 * Find the index of the segment that "owns" the given playback time.
 *
 * - If `time` falls inside a segment (`start <= time <= end`), returns that
 *   segment's index. On an exact shared boundary between two adjacent
 *   segments, the lower index wins (binary search lands on the earlier one).
 * - If `time` falls in an inter-segment gap (silence between two segments),
 *   returns the index of the NEAREST segment by distance, so highlighting
 *   never blinks out during silence.
 * - Returns -1 only when `segments` is empty.
 *
 * Segments are assumed sorted by `start` ascending and non-overlapping, which
 * is how the transcription pipeline produces them.
 */
export function findActiveSegmentIndex(
  segments: { start: number; end: number }[],
  time: number,
): number {
  const n = segments.length
  if (n === 0) return -1

  let left = 0
  let right = n - 1

  // Binary search for a containing segment.
  while (left <= right) {
    const mid = (left + right) >> 1
    const seg = segments[mid]
    if (time < seg.start) {
      right = mid - 1
    } else if (time > seg.end) {
      left = mid + 1
    } else {
      return mid
    }
  }

  // No containing segment: `right` is the last segment that ends before `time`
  // and `left` is the first segment that starts after `time`. One of them may
  // be out of range when `time` is before the first or after the last segment.
  const before = right // segment ending before `time`, or -1
  const after = left // segment starting after `time`, or n

  if (before < 0) return after // time before everything -> first segment
  if (after >= n) return before // time after everything -> last segment

  const distBefore = time - segments[before].end
  const distAfter = segments[after].start - time
  // Tie goes to the upcoming segment (after), matching "next line about to start".
  return distAfter <= distBefore ? after : before
}
```

- [ ] **Step 4: Run test to verify it passes**
  - Run: `bunx vitest run src/lib/player/__tests__/active-segment.test.ts`
  - Expected: PASS (all `findActiveSegmentIndex` direct-hit, exact-boundary, and empty-input assertions green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/player/active-segment.ts src/lib/player/__tests__/active-segment.test.ts
git commit -m "feat(player): add findActiveSegmentIndex with hit/boundary/empty handling"
```

---

### Task C.2: `findActiveSegmentIndex` — gap nearest-fallback, single segment, large array

**Files:**
- Modify: `src/lib/player/__tests__/active-segment.test.ts` (append a new top-level `describe`)
- Test: `src/lib/player/__tests__/active-segment.test.ts`

This task only adds tests; the implementation from C.1 already satisfies them (true TDD red→green for the gap/edge behavior, exercised here against the existing code). Add the block at the end of the file, after the closing `})` of the C.1 `describe('findActiveSegmentIndex', ...)`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/player/__tests__/active-segment.test.ts  (append below the existing describe block)

describe('findActiveSegmentIndex — gaps, single segment, scale', () => {
  const segments = [
    { start: 0, end: 2 }, // 0
    { start: 2, end: 4 }, // 1
    { start: 5, end: 7 }, // 2 (gap 4..5)
    { start: 9, end: 11 }, // 3 (gap 7..9)
  ]

  describe('inter-segment gaps return the nearest segment', () => {
    it('snaps to the closer side of a gap', () => {
      // gap 4..5: t=4.2 is closer to seg 1 (end 4) than seg 2 (start 5)
      expect(findActiveSegmentIndex(segments, 4.2)).toBe(1)
      // gap 4..5: t=4.8 is closer to seg 2 (start 5)
      expect(findActiveSegmentIndex(segments, 4.8)).toBe(2)
      // gap 7..9: t=7.4 closer to seg 2 (end 7)
      expect(findActiveSegmentIndex(segments, 7.4)).toBe(2)
      // gap 7..9: t=8.6 closer to seg 3 (start 9)
      expect(findActiveSegmentIndex(segments, 8.6)).toBe(3)
    })

    it('breaks a midpoint tie toward the upcoming segment', () => {
      // gap 4..5 midpoint t=4.5 is equidistant; tie -> after (seg 2)
      expect(findActiveSegmentIndex(segments, 4.5)).toBe(2)
      // gap 7..9 midpoint t=8 is equidistant; tie -> after (seg 3)
      expect(findActiveSegmentIndex(segments, 8)).toBe(3)
    })

    it('returns the first segment when time is before everything', () => {
      expect(findActiveSegmentIndex(segments, -5)).toBe(0)
    })

    it('returns the last segment when time is after everything', () => {
      expect(findActiveSegmentIndex(segments, 100)).toBe(3)
    })
  })

  describe('single segment', () => {
    const one = [{ start: 3, end: 6 }]
    it('hits inside, at both boundaries, and clamps outside to index 0', () => {
      expect(findActiveSegmentIndex(one, 4)).toBe(0)
      expect(findActiveSegmentIndex(one, 3)).toBe(0)
      expect(findActiveSegmentIndex(one, 6)).toBe(0)
      expect(findActiveSegmentIndex(one, 0)).toBe(0) // before -> 0
      expect(findActiveSegmentIndex(one, 999)).toBe(0) // after -> 0
    })
  })

  describe('large array stays correct', () => {
    // 5000 segments: [0,1], gap, [2,3], gap, [4,5], ... i.e. start=2i, end=2i+1
    const big = Array.from({ length: 5000 }, (_, i) => ({ start: 2 * i, end: 2 * i + 1 }))

    it('finds an interior hit', () => {
      // seg 1234 spans [2468, 2469]; t=2468.5 is inside it
      expect(findActiveSegmentIndex(big, 2468.5)).toBe(1234)
    })

    it('finds an exact boundary', () => {
      expect(findActiveSegmentIndex(big, 2468)).toBe(1234) // start
      expect(findActiveSegmentIndex(big, 2469)).toBe(1234) // end
    })

    it('snaps a gap time to the nearer segment', () => {
      // gap between seg 1234 (end 2469) and seg 1235 (start 2470)
      expect(findActiveSegmentIndex(big, 2469.2)).toBe(1234)
      expect(findActiveSegmentIndex(big, 2469.8)).toBe(1235)
    })

    it('clamps the extremes', () => {
      expect(findActiveSegmentIndex(big, -1)).toBe(0)
      expect(findActiveSegmentIndex(big, 1_000_000)).toBe(4999)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
  - Run: `bunx vitest run src/lib/player/__tests__/active-segment.test.ts -t "gaps, single segment, scale"`
  - Expected: PASS for these specific assertions if C.1 is correct. If C.1's nearest-fallback or clamping had a bug, this is the case that would FAIL (e.g. wrong tie-break or off-by-one at `before`/`after`). Confirm the new `describe` block is collected (Vitest output lists "gaps, single segment, scale").

- [ ] **Step 3: Write minimal implementation**
  - No implementation change. C.1's `findActiveSegmentIndex` already covers gap nearest-fallback (tie → `after`), single-segment clamping, and large arrays. This task hardens coverage of the locked "nearest segment by distance; -1 only if empty" contract.

- [ ] **Step 4: Run test to verify it passes**
  - Run: `bunx vitest run src/lib/player/__tests__/active-segment.test.ts`
  - Expected: PASS (both the C.1 and C.2 describe blocks green; total assertions cover hit, boundaries, gaps before/after/between, single segment, empty, and the 5000-element array).

- [ ] **Step 5: Commit**

```bash
git add src/lib/player/__tests__/active-segment.test.ts
git commit -m "test(player): cover gap fallback, single-segment, and 5000-element scale for findActiveSegmentIndex"
```

---

### Task C.3: Shadowing machine types, defaults, and `EPSILON`

**Files:**
- Create: `src/lib/player/shadowing-machine.ts`
- Test: `src/lib/player/__tests__/shadowing-machine.test.ts`

Define the locked types/constants and a stub reducer so the module type-checks. The reducer body is filled in across C.4–C.9; this task only asserts the constants and a passthrough on the unknown/no-op path.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/player/__tests__/shadowing-machine.test.ts
import {
  DEFAULT_SHADOWING_CONFIG,
  EPSILON,
  reduceShadowing,
  type ReduceCtx,
  type ShadowingState,
} from '~/lib/player/shadowing-machine'

describe('shadowing-machine constants', () => {
  it('exposes DEFAULT_SHADOWING_CONFIG matching the spec', () => {
    expect(DEFAULT_SHADOWING_CONFIG).toEqual({
      enabled: false,
      repeatCount: 3,
      gapRatio: 1.0,
      gapFloorMs: 800,
      practiceRate: 0.75,
      autoAdvance: true,
    })
  })

  it('exposes EPSILON as a small positive boundary slack in seconds', () => {
    expect(EPSILON).toBe(0.03)
  })
})

describe('reduceShadowing — no-op path', () => {
  const ctx: ReduceCtx = {
    segments: [
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ],
    config: { ...DEFAULT_SHADOWING_CONFIG, enabled: true },
  }

  it('returns the same state and no commands for a TICK before the segment end', () => {
    const state: ShadowingState = { phase: 'listening', activeIndex: 0, playsDone: 0 }
    const { next, commands } = reduceShadowing(state, { type: 'TICK', time: 0.5 }, ctx)
    expect(next).toEqual(state)
    expect(commands).toEqual([])
  })

  it('ignores TICK while idle', () => {
    const state: ShadowingState = { phase: 'idle', activeIndex: 0, playsDone: 0 }
    const { next, commands } = reduceShadowing(state, { type: 'TICK', time: 99 }, ctx)
    expect(next).toEqual(state)
    expect(commands).toEqual([])
  })

  it('ignores TICK while in a gap', () => {
    const state: ShadowingState = { phase: 'gap', activeIndex: 0, playsDone: 0 }
    const { next, commands } = reduceShadowing(state, { type: 'TICK', time: 99 }, ctx)
    expect(next).toEqual(state)
    expect(commands).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
  - Run: `bunx vitest run src/lib/player/__tests__/shadowing-machine.test.ts`
  - Expected: FAIL because `~/lib/player/shadowing-machine` does not exist (cannot resolve import).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/player/shadowing-machine.ts

export interface ShadowingConfig {
  enabled: boolean
  repeatCount: number // default 3, range 1..5
  gapRatio: number // gap = lineDuration * gapRatio, default 1.0
  gapFloorMs: number // default 800
  practiceRate: number // default 0.75; 1.0 = no slow-down
  autoAdvance: boolean // default true
}

export const DEFAULT_SHADOWING_CONFIG: ShadowingConfig = {
  enabled: false,
  repeatCount: 3,
  gapRatio: 1.0,
  gapFloorMs: 800,
  practiceRate: 0.75,
  autoAdvance: true,
}

export type ShadowingPhase = 'idle' | 'listening' | 'gap'

export interface ShadowingState {
  phase: ShadowingPhase
  activeIndex: number
  playsDone: number
}

export type ShadowingEvent =
  | { type: 'TICK'; time: number }
  | { type: 'GAP_ELAPSED' }
  | { type: 'TOGGLE'; enabled: boolean }
  | { type: 'CONFIG_CHANGE'; patch: Partial<ShadowingConfig> }
  | { type: 'JUMP'; index: number }

export type ShadowingCommand =
  | { type: 'SEEK'; time: number }
  | { type: 'PAUSE' }
  | { type: 'PLAY' }
  | { type: 'SET_RATE'; rate: number }
  | { type: 'START_GAP_TIMER'; ms: number }

export interface ReduceCtx {
  segments: { start: number; end: number }[]
  config: ShadowingConfig
}

export interface ReduceResult {
  next: ShadowingState
  commands: ShadowingCommand[]
}

/** Boundary slack (seconds) for end-of-segment detection. */
export const EPSILON = 0.03

export function reduceShadowing(
  state: ShadowingState,
  _event: ShadowingEvent,
  _ctx: ReduceCtx,
): ReduceResult {
  // Filled in across the following tasks. Default: no-op passthrough.
  return { next: state, commands: [] }
}
```

- [ ] **Step 4: Run test to verify it passes**
  - Run: `bunx vitest run src/lib/player/__tests__/shadowing-machine.test.ts`
  - Expected: PASS (constants match; the stub reducer returns state unchanged with no commands on the TICK/idle/gap no-op paths).

- [ ] **Step 5: Commit**

```bash
git add src/lib/player/shadowing-machine.ts src/lib/player/__tests__/shadowing-machine.test.ts
git commit -m "feat(player): scaffold shadowing-machine types, defaults, and EPSILON"
```

---

### Task C.4: `TOGGLE` — enable enters listening (resets playsDone) and emits SET_RATE; disable returns to idle

**Files:**
- Modify: `src/lib/player/shadowing-machine.ts` (replace the stub `reduceShadowing` body)
- Modify: `src/lib/player/__tests__/shadowing-machine.test.ts` (append `describe`)
- Test: `src/lib/player/__tests__/shadowing-machine.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/player/__tests__/shadowing-machine.test.ts  (append below existing blocks)

describe('reduceShadowing — TOGGLE', () => {
  const ctx: ReduceCtx = {
    segments: [
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ],
    config: { ...DEFAULT_SHADOWING_CONFIG, enabled: false, practiceRate: 0.75 },
  }

  it('enabling enters listening, resets playsDone, and emits SET_RATE + PLAY', () => {
    const state: ShadowingState = { phase: 'idle', activeIndex: 1, playsDone: 4 }
    const { next, commands } = reduceShadowing(state, { type: 'TOGGLE', enabled: true }, ctx)
    expect(next).toEqual({ phase: 'listening', activeIndex: 1, playsDone: 0 })
    expect(commands).toContainEqual({ type: 'SET_RATE', rate: 0.75 })
    expect(commands).toContainEqual({ type: 'SEEK', time: 2 }) // seg 1 start
    expect(commands).toContainEqual({ type: 'PLAY' })
  })

  it('disabling returns to idle and pauses', () => {
    const state: ShadowingState = { phase: 'gap', activeIndex: 1, playsDone: 2 }
    const { next, commands } = reduceShadowing(state, { type: 'TOGGLE', enabled: false }, ctx)
    expect(next).toEqual({ phase: 'idle', activeIndex: 1, playsDone: 0 })
    expect(commands).toContainEqual({ type: 'PAUSE' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
  - Run: `bunx vitest run src/lib/player/__tests__/shadowing-machine.test.ts -t "TOGGLE"`
  - Expected: FAIL because the stub reducer ignores `TOGGLE`, so `next` is the unchanged input state and `commands` is `[]`.

- [ ] **Step 3: Write minimal implementation**

Replace the stub `reduceShadowing` (the `export function reduceShadowing(...)` block from C.3) with the version below. This is the first real branch; later tasks extend the same function.

```ts
// src/lib/player/shadowing-machine.ts  (replace the whole reduceShadowing function)

export function reduceShadowing(
  state: ShadowingState,
  event: ShadowingEvent,
  ctx: ReduceCtx,
): ReduceResult {
  const { config } = ctx

  switch (event.type) {
    case 'TOGGLE': {
      if (event.enabled) {
        const seg = ctx.segments[state.activeIndex]
        const next: ShadowingState = {
          phase: 'listening',
          activeIndex: state.activeIndex,
          playsDone: 0,
        }
        const commands: ShadowingCommand[] = [{ type: 'SET_RATE', rate: config.practiceRate }]
        if (seg) {
          commands.push({ type: 'SEEK', time: seg.start }, { type: 'PLAY' })
        }
        return { next, commands }
      }
      return {
        next: { phase: 'idle', activeIndex: state.activeIndex, playsDone: 0 },
        commands: [{ type: 'PAUSE' }],
      }
    }
    default:
      return { next: state, commands: [] }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**
  - Run: `bunx vitest run src/lib/player/__tests__/shadowing-machine.test.ts`
  - Expected: PASS (TOGGLE block plus the C.3 no-op/constants blocks all green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/player/shadowing-machine.ts src/lib/player/__tests__/shadowing-machine.test.ts
git commit -m "feat(player): handle TOGGLE in shadowing reducer (enter listening / return to idle)"
```

---

### Task C.5: `TICK` at end of segment → enter GAP with PAUSE + START_GAP_TIMER

**Files:**
- Modify: `src/lib/player/shadowing-machine.ts` (add `TICK` branch)
- Modify: `src/lib/player/__tests__/shadowing-machine.test.ts` (append `describe`)
- Test: `src/lib/player/__tests__/shadowing-machine.test.ts`

Gap duration is `max(gapFloorMs, lineDurationMs * gapRatio)` where `lineDurationMs = (seg.end - seg.start) * 1000`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/player/__tests__/shadowing-machine.test.ts  (append below existing blocks)

describe('reduceShadowing — TICK into GAP', () => {
  it('crossing seg.end - EPSILON while listening enters gap and emits PAUSE + START_GAP_TIMER', () => {
    // seg 0 = [0,2] => lineDuration 2000ms; gapRatio 1.0 => 2000ms; floor 800 => 2000ms
    const ctx: ReduceCtx = {
      segments: [
        { start: 0, end: 2 },
        { start: 2, end: 4 },
      ],
      config: { ...DEFAULT_SHADOWING_CONFIG, enabled: true, gapRatio: 1.0, gapFloorMs: 800 },
    }
    const state: ShadowingState = { phase: 'listening', activeIndex: 0, playsDone: 0 }
    const { next, commands } = reduceShadowing(state, { type: 'TICK', time: 2 - EPSILON }, ctx)
    expect(next).toEqual({ phase: 'gap', activeIndex: 0, playsDone: 0 })
    expect(commands).toEqual([{ type: 'PAUSE' }, { type: 'START_GAP_TIMER', ms: 2000 }])
  })

  it('applies the gap floor when lineDuration * gapRatio is below it', () => {
    // seg 0 = [0,0.4] => 400ms * 1.0 = 400ms; floor 800 => 800ms
    const ctx: ReduceCtx = {
      segments: [{ start: 0, end: 0.4 }],
      config: { ...DEFAULT_SHADOWING_CONFIG, enabled: true, gapRatio: 1.0, gapFloorMs: 800 },
    }
    const state: ShadowingState = { phase: 'listening', activeIndex: 0, playsDone: 0 }
    const { commands } = reduceShadowing(state, { type: 'TICK', time: 0.4 }, ctx)
    expect(commands).toContainEqual({ type: 'START_GAP_TIMER', ms: 800 })
  })

  it('scales the gap by gapRatio when above the floor', () => {
    // seg 0 = [0,2] => 2000ms * 1.6 = 3200ms; floor 800 => 3200ms
    const ctx: ReduceCtx = {
      segments: [{ start: 0, end: 2 }],
      config: { ...DEFAULT_SHADOWING_CONFIG, enabled: true, gapRatio: 1.6, gapFloorMs: 800 },
    }
    const state: ShadowingState = { phase: 'listening', activeIndex: 0, playsDone: 0 }
    const { commands } = reduceShadowing(state, { type: 'TICK', time: 2 }, ctx)
    expect(commands).toContainEqual({ type: 'START_GAP_TIMER', ms: 3200 })
  })

  it('does nothing on a TICK that has not reached seg.end - EPSILON', () => {
    const ctx: ReduceCtx = {
      segments: [{ start: 0, end: 2 }],
      config: { ...DEFAULT_SHADOWING_CONFIG, enabled: true },
    }
    const state: ShadowingState = { phase: 'listening', activeIndex: 0, playsDone: 0 }
    const { next, commands } = reduceShadowing(state, { type: 'TICK', time: 1.9 }, ctx)
    expect(next).toEqual(state)
    expect(commands).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
  - Run: `bunx vitest run src/lib/player/__tests__/shadowing-machine.test.ts -t "TICK into GAP"`
  - Expected: FAIL because the reducer's `default` branch handles `TICK` as a no-op, so no phase change and no `START_GAP_TIMER` command.

- [ ] **Step 3: Write minimal implementation**

Add a `case 'TICK'` branch inside the `switch (event.type)` in `reduceShadowing`, immediately before the `default:` branch.

```ts
// src/lib/player/shadowing-machine.ts  (add inside switch, before `default:`)

    case 'TICK': {
      if (state.phase !== 'listening') return { next: state, commands: [] }
      const seg = ctx.segments[state.activeIndex]
      if (!seg) return { next: state, commands: [] }
      if (event.time < seg.end - EPSILON) return { next: state, commands: [] }
      const lineDurationMs = (seg.end - seg.start) * 1000
      const gapMs = Math.max(config.gapFloorMs, lineDurationMs * config.gapRatio)
      return {
        next: { phase: 'gap', activeIndex: state.activeIndex, playsDone: state.playsDone },
        commands: [{ type: 'PAUSE' }, { type: 'START_GAP_TIMER', ms: gapMs }],
      }
    }
```

- [ ] **Step 4: Run test to verify it passes**
  - Run: `bunx vitest run src/lib/player/__tests__/shadowing-machine.test.ts`
  - Expected: PASS (TICK-into-GAP, floor, scale, and below-threshold cases all green; earlier blocks still green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/player/shadowing-machine.ts src/lib/player/__tests__/shadowing-machine.test.ts
git commit -m "feat(player): TICK at segment end enters gap with PAUSE + gap-timer command"
```

---

### Task C.6: `GAP_ELAPSED` → repeat same line (SEEK start + PLAY, playsDone++)

**Files:**
- Modify: `src/lib/player/shadowing-machine.ts` (add `GAP_ELAPSED` branch)
- Modify: `src/lib/player/__tests__/shadowing-machine.test.ts` (append `describe`)
- Test: `src/lib/player/__tests__/shadowing-machine.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/player/__tests__/shadowing-machine.test.ts  (append below existing blocks)

describe('reduceShadowing — GAP_ELAPSED repeats the line', () => {
  const ctx: ReduceCtx = {
    segments: [
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ],
    config: { ...DEFAULT_SHADOWING_CONFIG, enabled: true, repeatCount: 3, practiceRate: 0.75 },
  }

  it('when playsDone+1 < repeatCount: bumps playsDone, re-listens, SEEK start + PLAY + SET_RATE', () => {
    // playsDone 0 -> 1 (1 < 3), repeat same line 0
    const state: ShadowingState = { phase: 'gap', activeIndex: 0, playsDone: 0 }
    const { next, commands } = reduceShadowing(state, { type: 'GAP_ELAPSED' }, ctx)
    expect(next).toEqual({ phase: 'listening', activeIndex: 0, playsDone: 1 })
    expect(commands).toContainEqual({ type: 'SEEK', time: 0 })
    expect(commands).toContainEqual({ type: 'PLAY' })
    expect(commands).toContainEqual({ type: 'SET_RATE', rate: 0.75 })
  })

  it('repeats again from playsDone 1 -> 2 (2 < 3) on the same line', () => {
    const state: ShadowingState = { phase: 'gap', activeIndex: 0, playsDone: 1 }
    const { next, commands } = reduceShadowing(state, { type: 'GAP_ELAPSED' }, ctx)
    expect(next).toEqual({ phase: 'listening', activeIndex: 0, playsDone: 2 })
    expect(commands).toContainEqual({ type: 'SEEK', time: 0 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
  - Run: `bunx vitest run src/lib/player/__tests__/shadowing-machine.test.ts -t "GAP_ELAPSED repeats the line"`
  - Expected: FAIL because `GAP_ELAPSED` hits the `default` no-op branch.

- [ ] **Step 3: Write minimal implementation**

Add a `case 'GAP_ELAPSED'` branch inside the `switch`, before `default:`. This task only implements the "repeat same line" path; the advance/stop paths are added in C.7.

```ts
// src/lib/player/shadowing-machine.ts  (add inside switch, before `default:`)

    case 'GAP_ELAPSED': {
      if (state.phase !== 'gap') return { next: state, commands: [] }
      const seg = ctx.segments[state.activeIndex]
      if (!seg) return { next: state, commands: [] }

      // More repeats of the same line remain.
      if (state.playsDone + 1 < config.repeatCount) {
        return {
          next: {
            phase: 'listening',
            activeIndex: state.activeIndex,
            playsDone: state.playsDone + 1,
          },
          commands: [
            { type: 'SEEK', time: seg.start },
            { type: 'SET_RATE', rate: config.practiceRate },
            { type: 'PLAY' },
          ],
        }
      }

      // Advance / stop paths are added in Task C.7.
      return { next: state, commands: [] }
    }
```

- [ ] **Step 4: Run test to verify it passes**
  - Run: `bunx vitest run src/lib/player/__tests__/shadowing-machine.test.ts`
  - Expected: PASS (GAP_ELAPSED repeat cases green; all earlier blocks still green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/player/shadowing-machine.ts src/lib/player/__tests__/shadowing-machine.test.ts
git commit -m "feat(player): GAP_ELAPSED repeats the current line until repeatCount"
```

---

### Task C.7: `GAP_ELAPSED` exhausted → auto-advance to next line, else idle

**Files:**
- Modify: `src/lib/player/shadowing-machine.ts` (extend `GAP_ELAPSED` branch)
- Modify: `src/lib/player/__tests__/shadowing-machine.test.ts` (append `describe`)
- Test: `src/lib/player/__tests__/shadowing-machine.test.ts`

Covers: repeats exhausted + autoAdvance true + next exists → advance (activeIndex++, playsDone 0, SEEK next.start + PLAY + SET_RATE, listening); autoAdvance false → idle + PAUSE; last segment with no next → idle + PAUSE; and `repeatCount=1` (single play, then advance/stop immediately).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/player/__tests__/shadowing-machine.test.ts  (append below existing blocks)

describe('reduceShadowing — GAP_ELAPSED advance / stop', () => {
  const segments = [
    { start: 0, end: 2 },
    { start: 2, end: 4 },
  ]

  it('repeats exhausted + autoAdvance + next exists: advances, resets playsDone, SEEK next + PLAY + SET_RATE', () => {
    const ctx: ReduceCtx = {
      segments,
      config: {
        ...DEFAULT_SHADOWING_CONFIG,
        enabled: true,
        repeatCount: 3,
        autoAdvance: true,
        practiceRate: 0.75,
      },
    }
    // playsDone 2 -> next play would be the 3rd; 2+1 = 3 is NOT < 3, so repeats exhausted
    const state: ShadowingState = { phase: 'gap', activeIndex: 0, playsDone: 2 }
    const { next, commands } = reduceShadowing(state, { type: 'GAP_ELAPSED' }, ctx)
    expect(next).toEqual({ phase: 'listening', activeIndex: 1, playsDone: 0 })
    expect(commands).toContainEqual({ type: 'SEEK', time: 2 }) // seg 1 start
    expect(commands).toContainEqual({ type: 'PLAY' })
    expect(commands).toContainEqual({ type: 'SET_RATE', rate: 0.75 })
  })

  it('repeats exhausted + autoAdvance OFF: stops at idle with PAUSE', () => {
    const ctx: ReduceCtx = {
      segments,
      config: { ...DEFAULT_SHADOWING_CONFIG, enabled: true, repeatCount: 3, autoAdvance: false },
    }
    const state: ShadowingState = { phase: 'gap', activeIndex: 0, playsDone: 2 }
    const { next, commands } = reduceShadowing(state, { type: 'GAP_ELAPSED' }, ctx)
    expect(next).toEqual({ phase: 'idle', activeIndex: 0, playsDone: 2 })
    expect(commands).toEqual([{ type: 'PAUSE' }])
  })

  it('repeats exhausted on the LAST segment with autoAdvance on but no next: idle + PAUSE', () => {
    const ctx: ReduceCtx = {
      segments,
      config: { ...DEFAULT_SHADOWING_CONFIG, enabled: true, repeatCount: 3, autoAdvance: true },
    }
    // activeIndex 1 is the last segment; no segment at index 2
    const state: ShadowingState = { phase: 'gap', activeIndex: 1, playsDone: 2 }
    const { next, commands } = reduceShadowing(state, { type: 'GAP_ELAPSED' }, ctx)
    expect(next).toEqual({ phase: 'idle', activeIndex: 1, playsDone: 2 })
    expect(commands).toEqual([{ type: 'PAUSE' }])
  })

  it('repeatCount=1: first gap already exhausts repeats, advances immediately', () => {
    const ctx: ReduceCtx = {
      segments,
      config: { ...DEFAULT_SHADOWING_CONFIG, enabled: true, repeatCount: 1, autoAdvance: true },
    }
    // playsDone 0; 0+1 = 1 is NOT < 1, so go straight to advance
    const state: ShadowingState = { phase: 'gap', activeIndex: 0, playsDone: 0 }
    const { next, commands } = reduceShadowing(state, { type: 'GAP_ELAPSED' }, ctx)
    expect(next).toEqual({ phase: 'listening', activeIndex: 1, playsDone: 0 })
    expect(commands).toContainEqual({ type: 'SEEK', time: 2 })
  })

  it('repeatCount=1 + autoAdvance off: first gap stops at idle', () => {
    const ctx: ReduceCtx = {
      segments,
      config: { ...DEFAULT_SHADOWING_CONFIG, enabled: true, repeatCount: 1, autoAdvance: false },
    }
    const state: ShadowingState = { phase: 'gap', activeIndex: 0, playsDone: 0 }
    const { next, commands } = reduceShadowing(state, { type: 'GAP_ELAPSED' }, ctx)
    expect(next).toEqual({ phase: 'idle', activeIndex: 0, playsDone: 0 })
    expect(commands).toEqual([{ type: 'PAUSE' }])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
  - Run: `bunx vitest run src/lib/player/__tests__/shadowing-machine.test.ts -t "GAP_ELAPSED advance / stop"`
  - Expected: FAIL because the C.6 `GAP_ELAPSED` branch returns a no-op `{ next: state, commands: [] }` once repeats are exhausted (no advance, no idle/PAUSE).

- [ ] **Step 3: Write minimal implementation**

Replace the "Advance / stop paths are added in Task C.7." comment + `return { next: state, commands: [] }` line inside the `case 'GAP_ELAPSED'` block with the advance/stop logic below. The repeat path from C.6 stays unchanged.

```ts
// src/lib/player/shadowing-machine.ts
// Inside `case 'GAP_ELAPSED'`, REPLACE the trailing:
//     // Advance / stop paths are added in Task C.7.
//     return { next: state, commands: [] }
// with:

      // Repeats exhausted for this line.
      const nextIndex = state.activeIndex + 1
      const nextSeg = ctx.segments[nextIndex]
      if (config.autoAdvance && nextSeg) {
        return {
          next: { phase: 'listening', activeIndex: nextIndex, playsDone: 0 },
          commands: [
            { type: 'SEEK', time: nextSeg.start },
            { type: 'SET_RATE', rate: config.practiceRate },
            { type: 'PLAY' },
          ],
        }
      }

      // No auto-advance, or no next segment: stop.
      return {
        next: { phase: 'idle', activeIndex: state.activeIndex, playsDone: state.playsDone },
        commands: [{ type: 'PAUSE' }],
      }
```

- [ ] **Step 4: Run test to verify it passes**
  - Run: `bunx vitest run src/lib/player/__tests__/shadowing-machine.test.ts`
  - Expected: PASS (advance, autoAdvance-off, last-segment, repeatCount=1 advance, and repeatCount=1 stop cases all green; all earlier blocks still green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/player/shadowing-machine.ts src/lib/player/__tests__/shadowing-machine.test.ts
git commit -m "feat(player): GAP_ELAPSED auto-advances to next line or stops at idle"
```

---

### Task C.8: `JUMP` resets playsDone and (if enabled) re-listens; `CONFIG_CHANGE` is config-only

**Files:**
- Modify: `src/lib/player/shadowing-machine.ts` (add `JUMP` and `CONFIG_CHANGE` branches)
- Modify: `src/lib/player/__tests__/shadowing-machine.test.ts` (append `describe`)
- Test: `src/lib/player/__tests__/shadowing-machine.test.ts`

`CONFIG_CHANGE` carries only the patch as the event payload; the reducer does not own the config object (the hook in Phase D merges and re-supplies it via `ctx`). So in the FSM, `CONFIG_CHANGE` is a pure no-op on `state` and emits no commands — it exists in the event union so the hook can route it, and the reducer must not crash on it. The test asserts that contract.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/player/__tests__/shadowing-machine.test.ts  (append below existing blocks)

describe('reduceShadowing — JUMP', () => {
  const ctx: ReduceCtx = {
    segments: [
      { start: 0, end: 2 },
      { start: 2, end: 4 },
      { start: 5, end: 7 },
    ],
    config: { ...DEFAULT_SHADOWING_CONFIG, enabled: true, practiceRate: 0.75 },
  }

  it('sets activeIndex, resets playsDone, enters listening when enabled, SEEK target + PLAY + SET_RATE', () => {
    const state: ShadowingState = { phase: 'gap', activeIndex: 0, playsDone: 2 }
    const { next, commands } = reduceShadowing(state, { type: 'JUMP', index: 2 }, ctx)
    expect(next).toEqual({ phase: 'listening', activeIndex: 2, playsDone: 0 })
    expect(commands).toContainEqual({ type: 'SEEK', time: 5 }) // seg 2 start
    expect(commands).toContainEqual({ type: 'PLAY' })
    expect(commands).toContainEqual({ type: 'SET_RATE', rate: 0.75 })
  })

  it('when shadowing is disabled: sets index + resets playsDone but stays idle and emits no transport commands', () => {
    const disabledCtx: ReduceCtx = {
      segments: ctx.segments,
      config: { ...DEFAULT_SHADOWING_CONFIG, enabled: false },
    }
    const state: ShadowingState = { phase: 'idle', activeIndex: 0, playsDone: 3 }
    const { next, commands } = reduceShadowing(state, { type: 'JUMP', index: 1 }, disabledCtx)
    expect(next).toEqual({ phase: 'idle', activeIndex: 1, playsDone: 0 })
    expect(commands).toEqual([])
  })
})

describe('reduceShadowing — CONFIG_CHANGE', () => {
  const ctx: ReduceCtx = {
    segments: [{ start: 0, end: 2 }],
    config: { ...DEFAULT_SHADOWING_CONFIG, enabled: true },
  }

  it('is a pure no-op on state and emits no commands mid-practice (config is owned by the hook)', () => {
    const state: ShadowingState = { phase: 'listening', activeIndex: 0, playsDone: 1 }
    const { next, commands } = reduceShadowing(
      state,
      { type: 'CONFIG_CHANGE', patch: { repeatCount: 5, gapRatio: 1.6 } },
      ctx,
    )
    expect(next).toEqual(state)
    expect(commands).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
  - Run: `bunx vitest run src/lib/player/__tests__/shadowing-machine.test.ts -t "JUMP"`
  - Expected: FAIL because `JUMP` falls through to `default` (state unchanged, no commands), so `activeIndex`/`playsDone`/phase are wrong. (`CONFIG_CHANGE` already happens to pass via `default`, but it is locked in here so a future refactor cannot silently break it.)

- [ ] **Step 3: Write minimal implementation**

Add `case 'JUMP'` and `case 'CONFIG_CHANGE'` inside the `switch`, before `default:`.

```ts
// src/lib/player/shadowing-machine.ts  (add inside switch, before `default:`)

    case 'JUMP': {
      const seg = ctx.segments[event.index]
      if (config.enabled && seg) {
        return {
          next: { phase: 'listening', activeIndex: event.index, playsDone: 0 },
          commands: [
            { type: 'SEEK', time: seg.start },
            { type: 'SET_RATE', rate: config.practiceRate },
            { type: 'PLAY' },
          ],
        }
      }
      return {
        next: { phase: 'idle', activeIndex: event.index, playsDone: 0 },
        commands: [],
      }
    }

    case 'CONFIG_CHANGE':
      // Config is owned and merged by the hook (Phase D) and re-supplied via ctx.
      // The reducer treats a config change as a pure no-op on FSM state.
      return { next: state, commands: [] }
```

- [ ] **Step 4: Run test to verify it passes**
  - Run: `bunx vitest run src/lib/player/__tests__/shadowing-machine.test.ts`
  - Expected: PASS (JUMP enabled/disabled and CONFIG_CHANGE no-op cases green; all earlier blocks still green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/player/shadowing-machine.ts src/lib/player/__tests__/shadowing-machine.test.ts
git commit -m "feat(player): JUMP re-targets the line (reset playsDone); CONFIG_CHANGE is FSM no-op"
```

---

### Task C.9: Full-chain + edge integration tests (practiceRate=1, manual A/B special case)

**Files:**
- Modify: `src/lib/player/__tests__/shadowing-machine.test.ts` (append `describe`)
- Test: `src/lib/player/__tests__/shadowing-machine.test.ts`

Pure test-hardening task (no implementation change). Drives a full LISTENING→GAP→repeat→advance chain through the real reducer, verifies `practiceRate=1` still emits `SET_RATE(1)`, and verifies the manual A/B special case (`repeatCount` very large / "infinite" + `gapFloorMs=0`, `gapRatio=0`) keeps repeating the same line with a 0ms gap.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/player/__tests__/shadowing-machine.test.ts  (append below existing blocks)

describe('reduceShadowing — full chain', () => {
  const ctx: ReduceCtx = {
    segments: [
      { start: 0, end: 2 }, // 0
      { start: 2, end: 4 }, // 1
    ],
    config: {
      ...DEFAULT_SHADOWING_CONFIG,
      enabled: true,
      repeatCount: 2,
      gapRatio: 1.0,
      gapFloorMs: 800,
      practiceRate: 0.75,
      autoAdvance: true,
    },
  }

  it('runs listen -> gap -> repeat -> gap -> advance on a 2-line, repeat=2 session', () => {
    // Start: TOGGLE on
    let state: ShadowingState = { phase: 'idle', activeIndex: 0, playsDone: 0 }
    let res = reduceShadowing(state, { type: 'TOGGLE', enabled: true }, ctx)
    state = res.next
    expect(state).toEqual({ phase: 'listening', activeIndex: 0, playsDone: 0 })

    // Play 1 finishes -> GAP
    res = reduceShadowing(state, { type: 'TICK', time: 2 }, ctx)
    state = res.next
    expect(state).toEqual({ phase: 'gap', activeIndex: 0, playsDone: 0 })
    expect(res.commands).toContainEqual({ type: 'START_GAP_TIMER', ms: 2000 })

    // Gap elapses -> repeat line 0 (playsDone 0 -> 1, 1 < 2)
    res = reduceShadowing(state, { type: 'GAP_ELAPSED' }, ctx)
    state = res.next
    expect(state).toEqual({ phase: 'listening', activeIndex: 0, playsDone: 1 })
    expect(res.commands).toContainEqual({ type: 'SEEK', time: 0 })

    // Play 2 finishes -> GAP
    res = reduceShadowing(state, { type: 'TICK', time: 2 }, ctx)
    state = res.next
    expect(state).toEqual({ phase: 'gap', activeIndex: 0, playsDone: 1 })

    // Gap elapses -> repeats exhausted (1+1 = 2 NOT < 2) -> advance to line 1
    res = reduceShadowing(state, { type: 'GAP_ELAPSED' }, ctx)
    state = res.next
    expect(state).toEqual({ phase: 'listening', activeIndex: 1, playsDone: 0 })
    expect(res.commands).toContainEqual({ type: 'SEEK', time: 2 })

    // Line 1 finishes its 2 reps, then advance has no next -> idle
    res = reduceShadowing(state, { type: 'TICK', time: 4 }, ctx)
    state = res.next
    res = reduceShadowing(state, { type: 'GAP_ELAPSED' }, ctx) // repeat line 1
    state = res.next
    expect(state).toEqual({ phase: 'listening', activeIndex: 1, playsDone: 1 })
    res = reduceShadowing(state, { type: 'TICK', time: 4 }, ctx)
    state = res.next
    res = reduceShadowing(state, { type: 'GAP_ELAPSED' }, ctx) // exhausted, no next -> idle
    state = res.next
    expect(state).toEqual({ phase: 'idle', activeIndex: 1, playsDone: 1 })
    expect(res.commands).toEqual([{ type: 'PAUSE' }])
  })

  it('practiceRate=1 still emits SET_RATE(1) when entering listening', () => {
    const rate1Ctx: ReduceCtx = {
      segments: ctx.segments,
      config: { ...ctx.config, practiceRate: 1 },
    }
    const state: ShadowingState = { phase: 'idle', activeIndex: 0, playsDone: 0 }
    const { commands } = reduceShadowing(state, { type: 'TOGGLE', enabled: true }, rate1Ctx)
    expect(commands).toContainEqual({ type: 'SET_RATE', rate: 1 })
  })

  it('manual A/B special case: huge repeatCount + zero gap keeps repeating the same line', () => {
    const abCtx: ReduceCtx = {
      segments: [{ start: 1, end: 3 }],
      config: {
        ...DEFAULT_SHADOWING_CONFIG,
        enabled: true,
        repeatCount: Number.MAX_SAFE_INTEGER, // "infinite"
        gapRatio: 0,
        gapFloorMs: 0,
        practiceRate: 1,
        autoAdvance: false,
      },
    }
    // Finishing the line starts a 0ms gap.
    let state: ShadowingState = { phase: 'listening', activeIndex: 0, playsDone: 0 }
    let res = reduceShadowing(state, { type: 'TICK', time: 3 }, abCtx)
    state = res.next
    expect(state.phase).toBe('gap')
    expect(res.commands).toContainEqual({ type: 'START_GAP_TIMER', ms: 0 })

    // Gap elapsed -> repeats never exhaust, so it re-listens the same line.
    res = reduceShadowing(state, { type: 'GAP_ELAPSED' }, abCtx)
    state = res.next
    expect(state).toEqual({ phase: 'listening', activeIndex: 0, playsDone: 1 })
    expect(res.commands).toContainEqual({ type: 'SEEK', time: 1 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
  - Run: `bunx vitest run src/lib/player/__tests__/shadowing-machine.test.ts -t "full chain"`
  - Expected: PASS if C.4–C.8 are correct (this exercises the assembled reducer end-to-end). It would FAIL only if an earlier branch regressed — e.g. `SET_RATE(1)` were suppressed for `practiceRate=1`, or the A/B "infinite repeat" path advanced/stopped instead of repeating. Confirm the `full chain` describe is collected in the Vitest output.

- [ ] **Step 3: Write minimal implementation**
  - No implementation change. The reducer from C.4–C.8 already satisfies the full-chain and edge contracts. This task locks the integration behavior.

- [ ] **Step 4: Run test to verify it passes**
  - Run: `bunx vitest run src/lib/player/__tests__/shadowing-machine.test.ts src/lib/player/__tests__/active-segment.test.ts`
  - Expected: PASS (entire Phase C suite green: both files, every transition + the full chain).

- [ ] **Step 5: Commit**

```bash
git add src/lib/player/__tests__/shadowing-machine.test.ts
git commit -m "test(player): full-chain shadowing run, practiceRate=1, and manual A/B special case"
```

---

### Task C.10: Phase verification — type-check and full Phase C suite

**Files:**
- (none — verification only)

- [ ] **Step 1: Run the type checker**
  - Run: `bun run type-check`
  - Expected: exits 0 with no errors — confirms `active-segment.ts` and `shadowing-machine.ts` match the locked interface shapes (`ShadowingConfig`, `ShadowingState`, `ShadowingEvent`, `ShadowingCommand`, `ReduceCtx`, `ReduceResult`, `reduceShadowing`, `findActiveSegmentIndex`) and compile clean.

- [ ] **Step 2: Run the full Phase C test suite**
  - Run: `bunx vitest run src/lib/player/__tests__/active-segment.test.ts src/lib/player/__tests__/shadowing-machine.test.ts`
  - Expected: PASS — 0 failures across both files. Covers `findActiveSegmentIndex` (hit / start+end boundaries / gaps before-after-between / single segment / empty / 5000-element scale) and `reduceShadowing` (TOGGLE on/off, TICK→GAP with floor+ratio, GAP_ELAPSED repeat, advance, autoAdvance-off stop, last-segment stop, repeatCount=1, JUMP enabled/disabled, CONFIG_CHANGE no-op, full chain, practiceRate=1, manual A/B).

- [ ] **Step 3: Confirm no unrelated files were swept in**
  - Run: `git status --porcelain src/lib/player`
  - Expected: clean (empty output) — all Phase C work is already committed under explicit paths in Tasks C.1–C.9; nothing left untracked or modified under `src/lib/player`.

**✅ C done when:** Run `bunx vitest run src/lib/player/__tests__/active-segment.test.ts src/lib/player/__tests__/shadowing-machine.test.ts` — all tests PASS, 0 failures. Run `bun run type-check` — exits 0 (locked interfaces compile). Run `git status --porcelain src/lib/player` — empty (everything committed via explicit paths).

> **Phase C notes:** This phase defines the locked symbols findActiveSegmentIndex (active-segment.ts) and the entire shadowing-machine.ts surface (DEFAULT_SHADOWING_CONFIG, EPSILON, ShadowingConfig/Phase/State/Event/Command, ReduceCtx, ReduceResult, reduceShadowing) verbatim from the shared contract. Phase D (usePlaybackController, useActiveSegmentIndex) and Phase E (UI) import these.

Key decisions baked into the reducer, surfaced for the assembler:
- findActiveSegmentIndex tie-break in a gap goes to the UPCOMING segment (`distAfter <= distBefore` -> after). Tests assert this at gap midpoints. If a later phase wants the opposite, it must change the test too.
- Exact shared boundary between adjacent segments (e.g. t=2 where seg0.end==seg1.start) resolves to the LOWER index (binary search returns on first containment match). Documented + tested.
- CONFIG_CHANGE is a deliberate FSM no-op: the reducer does NOT own/merge ShadowingConfig. Phase D's hook merges the patch into config (persisted to localStorage key 'shadowing-config' per the UI mapping) and re-supplies it via ReduceCtx. Phase D must implement that merge; the reducer only reads ctx.config.
- Entering listening (TOGGLE-on, GAP_ELAPSED repeat, GAP_ELAPSED advance, JUMP-when-enabled) ALWAYS emits SET_RATE(config.practiceRate), including practiceRate=1 — Phase D relies on this to drive the LISTENING-only slow-down and to restore footer playbackRate on idle/off.
- Command ORDER within a listening entry is [SEEK, SET_RATE, PLAY] (and TICK->gap is exactly [PAUSE, START_GAP_TIMER]). Tests mostly use toContainEqual for resilience, but TICK->GAP and the idle/PAUSE stop paths use toEqual on the exact array — Phase D's command executor should be order-tolerant for the listening-entry triad but can rely on the gap/stop arrays being exact.
- Manual A/B is modeled as repeatCount=MAX_SAFE_INTEGER + gapFloorMs=0 + gapRatio=0 + autoAdvance=false (spec section 13). Phase D/E wire loopRange to this; the reducer needs no special A/B branch.
- gapMs formula: max(gapFloorMs, (seg.end-seg.start)*1000*gapRatio). EPSILON=0.03s applied as `time >= seg.end - EPSILON`.
- Tasks C.2 and C.9 are test-only hardening tasks (the implementation written in C.1/C.4–C.8 already satisfies them); their Step 2 expects PASS rather than FAIL and explicitly notes which earlier regression they would catch. All other tasks are strict red->green TDD.
- Tests assume Vitest globals (Phase A). No describe/it/expect import. The `~` alias resolves to ./src.

---

## Phase D: Playback controller hook

This phase builds the two hooks that sit between the pure Phase C logic (`findActiveSegmentIndex`, `reduceShadowing`) and the DOM `<audio>` element. Nothing in `PlayerPage.tsx` changes yet — Phase E rewires the page and deletes `useAudioPlayer`/`useShadowingMode`. Both hooks are created and unit-tested here in isolation against a fake audio element.

**Dependencies (must already exist from Phase C):**
- `src/lib/player/active-segment.ts` exporting `findActiveSegmentIndex(segments, time)`.
- `src/lib/player/shadowing-machine.ts` exporting `reduceShadowing`, `DEFAULT_SHADOWING_CONFIG`, `EPSILON`, and the types `ShadowingConfig`, `ShadowingState`, `ShadowingPhase`, `ShadowingCommand`, `ReduceCtx`, `ReduceResult`.

**Testing facts for this phase (post Phase A):** tests import from `vitest`, run under happy-dom via `vitest.config.ts`. `renderHook`/`act` come from `@testing-library/react`. Single-file run: `bunx vitest run <path>`. Type check: `bun run type-check`. Always stage explicit paths on commit — never `git add -A` (the working tree has unrelated migration WIP).

---

### Task D.1: `useActiveSegmentIndex` derives the active segment from a time ref via rAF

**Files:**
- Create: `src/hooks/player/useActiveSegmentIndex.ts`
- Test: `src/hooks/player/__tests__/useActiveSegmentIndex.test.ts`

This hook reads `currentTimeRef.current` once per animation frame (so it does not depend on a re-rendering `currentTime` state) and exposes the active segment index as React state, computed with the Phase C `findActiveSegmentIndex`. It must keep a self-scheduling rAF loop alive for the lifetime of the hook and update state only when the index actually changes (to avoid render churn). When `segments` is empty it returns `-1`.

- [ ] **Step 1: Write the failing test**

```ts
// src/hooks/player/__tests__/useActiveSegmentIndex.test.ts
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useActiveSegmentIndex } from '../useActiveSegmentIndex'

// A controllable requestAnimationFrame: each flushFrame() runs exactly the
// callbacks queued at that moment (matching browser semantics where a
// callback re-scheduling itself runs on the NEXT frame, not the current one).
function installFakeRaf() {
  let queue: FrameRequestCallback[] = []
  let id = 0
  const raf = vi.fn((cb: FrameRequestCallback): number => {
    queue.push(cb)
    id += 1
    return id
  })
  const caf = vi.fn((_handle: number): void => {})
  vi.stubGlobal('requestAnimationFrame', raf)
  vi.stubGlobal('cancelAnimationFrame', caf)
  return {
    raf,
    caf,
    flushFrame(now = performance.now()) {
      const due = queue
      queue = []
      for (const cb of due) cb(now)
    },
  }
}

describe('useActiveSegmentIndex', () => {
  const segments = [
    { start: 0, end: 3 },
    { start: 3, end: 6 },
    { start: 6, end: 10 },
  ]

  let fakeRaf: ReturnType<typeof installFakeRaf>

  beforeEach(() => {
    fakeRaf = installFakeRaf()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns -1 for empty segments', () => {
    const ref = { current: 5 }
    const { result } = renderHook(() => useActiveSegmentIndex([], ref))
    expect(result.current).toBe(-1)
  })

  it('tracks the active segment as the ref time advances across frames', () => {
    const ref = { current: 0 }
    const { result } = renderHook(() => useActiveSegmentIndex(segments, ref))

    // first frame: time 0 -> segment 0
    act(() => fakeRaf.flushFrame())
    expect(result.current).toBe(0)

    // advance the ref then run a frame -> segment 1
    ref.current = 4
    act(() => fakeRaf.flushFrame())
    expect(result.current).toBe(1)

    ref.current = 9
    act(() => fakeRaf.flushFrame())
    expect(result.current).toBe(2)
  })

  it('keeps scheduling frames (self-rescheduling rAF loop)', () => {
    const ref = { current: 0 }
    renderHook(() => useActiveSegmentIndex(segments, ref))

    const callsAfterMount = fakeRaf.raf.mock.calls.length
    act(() => fakeRaf.flushFrame())
    expect(fakeRaf.raf.mock.calls.length).toBeGreaterThan(callsAfterMount)
  })

  it('cancels the rAF loop on unmount', () => {
    const ref = { current: 0 }
    const { unmount } = renderHook(() => useActiveSegmentIndex(segments, ref))
    unmount()
    expect(fakeRaf.caf).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
  Run: `bunx vitest run src/hooks/player/__tests__/useActiveSegmentIndex.test.ts`
  Expected: FAIL — module `../useActiveSegmentIndex` does not exist yet, so Vitest reports a resolution / import error for all four tests.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/hooks/player/useActiveSegmentIndex.ts
import { type MutableRefObject, useEffect, useRef, useState } from 'react'
import { findActiveSegmentIndex } from '~/lib/player/active-segment'

/**
 * Single source of truth for "which subtitle line is active right now".
 * Reads `currentTimeRef` (frame-accurate, no re-render) once per animation
 * frame and exposes the active segment index as React state, recomputing it
 * with the pure `findActiveSegmentIndex` (binary search + nearest-gap fallback).
 * Only updates state when the index actually changes to avoid render churn.
 */
export function useActiveSegmentIndex(
  segments: { start: number; end: number }[],
  currentTimeRef: MutableRefObject<number>,
): number {
  const [activeIndex, setActiveIndex] = useState<number>(() =>
    findActiveSegmentIndex(segments, currentTimeRef.current),
  )

  // Keep the latest segments reachable from the rAF loop without retriggering it.
  const segmentsRef = useRef(segments)
  segmentsRef.current = segments

  useEffect(() => {
    let frame = 0

    const tick = () => {
      const next = findActiveSegmentIndex(segmentsRef.current, currentTimeRef.current)
      setActiveIndex((prev) => (prev === next ? prev : next))
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [currentTimeRef])

  return activeIndex
}
```

- [ ] **Step 4: Run test to verify it passes**
  Run: `bunx vitest run src/hooks/player/__tests__/useActiveSegmentIndex.test.ts`
  Expected: PASS — all four tests green.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/player/useActiveSegmentIndex.ts src/hooks/player/__tests__/useActiveSegmentIndex.test.ts
git commit -m "feat(player): add useActiveSegmentIndex rAF hook"
```

---

### Task D.2: `usePlaybackController` transport state + commands (play/pause/seek/rate/volume)

**Files:**
- Create: `src/hooks/player/usePlaybackController.ts`
- Test: `src/hooks/player/__tests__/usePlaybackController.test.ts`

Build the controller skeleton that owns transport state and runs the rAF loop. This task wires up everything EXCEPT the shadowing repeat logic and A/B loop end behavior (those are Task D.3 and D.4) — but the FSM dispatch wiring and command executor are put in place now so D.3/D.4 only add behavior, not plumbing. The hook executes `ShadowingCommand`s against `audioRef.current`: `SEEK`→`currentTime`, `PLAY`→`play()`, `PAUSE`→`pause()`, `SET_RATE`→`playbackRate`, `START_GAP_TIMER`→`setTimeout` then dispatch `GAP_ELAPSED`. The rAF loop runs only while playing; each frame writes `audio.currentTime` to `currentTimeRef`, throttles a `currentTime` state update to ~10fps, and dispatches a `TICK` to `reduceShadowing`.

The test uses a hand-rolled fake audio element (mutable `currentTime`/`playbackRate`/`volume`/`muted`/`paused`/`duration`, spy `play`/`pause`), a controllable fake `requestAnimationFrame`, and Vitest fake timers for the gap `setTimeout`.

- [ ] **Step 1: Write the failing test**

```ts
// src/hooks/player/__tests__/usePlaybackController.test.ts
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RefObject } from 'react'
import { usePlaybackController } from '../usePlaybackController'

// ---- fake <audio> element -------------------------------------------------
interface FakeAudio {
  currentTime: number
  playbackRate: number
  volume: number
  muted: boolean
  paused: boolean
  duration: number
  play: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
}

function makeAudio(): FakeAudio {
  const a: FakeAudio = {
    currentTime: 0,
    playbackRate: 1,
    volume: 1,
    muted: false,
    paused: true,
    duration: 30,
    play: vi.fn(() => {
      a.paused = false
      return Promise.resolve()
    }),
    pause: vi.fn(() => {
      a.paused = true
    }),
  }
  return a
}

// ---- controllable rAF -----------------------------------------------------
function installFakeRaf() {
  let queue: FrameRequestCallback[] = []
  let id = 0
  const raf = vi.fn((cb: FrameRequestCallback): number => {
    queue.push(cb)
    id += 1
    return id
  })
  const caf = vi.fn(() => {})
  vi.stubGlobal('requestAnimationFrame', raf)
  vi.stubGlobal('cancelAnimationFrame', caf)
  return {
    raf,
    caf,
    flushFrame(now = 0) {
      const due = queue
      queue = []
      for (const cb of due) cb(now)
    },
  }
}

describe('usePlaybackController — transport', () => {
  const segments = [
    { start: 0, end: 3 },
    { start: 3, end: 6 },
    { start: 6, end: 10 },
  ]
  let audio: FakeAudio
  let audioRef: RefObject<HTMLAudioElement>
  let fakeRaf: ReturnType<typeof installFakeRaf>

  beforeEach(() => {
    vi.useFakeTimers()
    audio = makeAudio()
    audioRef = { current: audio as unknown as HTMLAudioElement }
    fakeRaf = installFakeRaf()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('play() calls audio.play and starts the rAF loop; pause() stops it', () => {
    const { result } = renderHook(() => usePlaybackController({ audioRef, segments }))

    act(() => result.current.play())
    expect(audio.play).toHaveBeenCalled()
    expect(result.current.isPlaying).toBe(true)
    expect(fakeRaf.raf).toHaveBeenCalled()

    act(() => result.current.pause())
    expect(audio.pause).toHaveBeenCalled()
    expect(result.current.isPlaying).toBe(false)
  })

  it('togglePlay() flips play/pause', () => {
    const { result } = renderHook(() => usePlaybackController({ audioRef, segments }))
    act(() => result.current.togglePlay())
    expect(result.current.isPlaying).toBe(true)
    act(() => result.current.togglePlay())
    expect(result.current.isPlaying).toBe(false)
  })

  it('seek() writes audio.currentTime and the ref', () => {
    const { result } = renderHook(() => usePlaybackController({ audioRef, segments }))
    act(() => result.current.seek(7.5))
    expect(audio.currentTime).toBe(7.5)
    expect(result.current.currentTimeRef.current).toBe(7.5)
  })

  it('setPlaybackRate() maps to audio.playbackRate and to state', () => {
    const { result } = renderHook(() => usePlaybackController({ audioRef, segments }))
    act(() => result.current.setPlaybackRate(1.25))
    expect(audio.playbackRate).toBe(1.25)
    expect(result.current.playbackRate).toBe(1.25)
  })

  it('setVolume / toggleMute map to audio and keep volume across mute', () => {
    const { result } = renderHook(() => usePlaybackController({ audioRef, segments }))
    act(() => result.current.setVolume(0.4))
    expect(audio.volume).toBe(0.4)
    expect(result.current.volume).toBe(0.4)

    act(() => result.current.toggleMute())
    expect(audio.muted).toBe(true)
    expect(result.current.isMuted).toBe(true)
    // volume value is preserved (no "fake mute loses volume" bug)
    expect(result.current.volume).toBe(0.4)

    act(() => result.current.toggleMute())
    expect(audio.muted).toBe(false)
    expect(result.current.isMuted).toBe(false)
  })

  it('the rAF loop copies audio.currentTime into currentTimeRef each frame', () => {
    const { result } = renderHook(() => usePlaybackController({ audioRef, segments }))
    act(() => result.current.play())
    audio.currentTime = 1.234
    act(() => fakeRaf.flushFrame())
    expect(result.current.currentTimeRef.current).toBe(1.234)
  })

  it('playLine(index) seeks to that segment start and plays', () => {
    const { result } = renderHook(() => usePlaybackController({ audioRef, segments }))
    act(() => result.current.playLine(2))
    expect(audio.currentTime).toBe(6)
    expect(audio.play).toHaveBeenCalled()
    expect(result.current.isPlaying).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
  Run: `bunx vitest run src/hooks/player/__tests__/usePlaybackController.test.ts`
  Expected: FAIL — module `../usePlaybackController` does not exist, so all transport tests error on import.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/hooks/player/usePlaybackController.ts
import { type MutableRefObject, type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { findActiveSegmentIndex } from '~/lib/player/active-segment'
import {
  DEFAULT_SHADOWING_CONFIG,
  type ReduceResult,
  type ShadowingCommand,
  type ShadowingConfig,
  type ShadowingEvent,
  type ShadowingState,
  reduceShadowing,
} from '~/lib/player/shadowing-machine'

export const SHADOWING_CONFIG_STORAGE_KEY = 'shadowing-config'

const TIME_STATE_THROTTLE_MS = 100 // ~10fps for the currentTime render state

export interface PlaybackController {
  isPlaying: boolean
  currentTime: number
  duration: number
  playbackRate: number
  volume: number
  isMuted: boolean
  currentTimeRef: MutableRefObject<number>
  play(): void
  pause(): void
  togglePlay(): void
  seek(time: number): void
  setPlaybackRate(rate: number): void
  setVolume(v: number): void
  toggleMute(): void
  activeIndex: number
  playLine(index: number): void
  replayLine(): void
  shadowing: ShadowingState & { config: ShadowingConfig }
  toggleShadowing(): void
  setShadowingConfig(patch: Partial<ShadowingConfig>): void
  loopRange: { start: number; end: number } | null
  setLoopRange(r: { start: number; end: number } | null): void
}

function loadConfig(): ShadowingConfig {
  if (typeof localStorage === 'undefined') return DEFAULT_SHADOWING_CONFIG
  try {
    const raw = localStorage.getItem(SHADOWING_CONFIG_STORAGE_KEY)
    if (!raw) return DEFAULT_SHADOWING_CONFIG
    return { ...DEFAULT_SHADOWING_CONFIG, ...(JSON.parse(raw) as Partial<ShadowingConfig>) }
  } catch {
    return DEFAULT_SHADOWING_CONFIG
  }
}

function persistConfig(config: ShadowingConfig): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(SHADOWING_CONFIG_STORAGE_KEY, JSON.stringify(config))
  } catch {
    // ignore quota / private-mode failures
  }
}

const IDLE_STATE: ShadowingState = { phase: 'idle', activeIndex: -1, playsDone: 0 }

export function usePlaybackController(args: {
  audioRef: RefObject<HTMLAudioElement>
  segments: { start: number; end: number }[]
}): PlaybackController {
  const { audioRef, segments } = args

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playbackRate, setPlaybackRateState] = useState(1)
  const [volume, setVolumeState] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [loopRange, setLoopRangeState] = useState<{ start: number; end: number } | null>(null)

  const [config, setConfig] = useState<ShadowingConfig>(loadConfig)
  const [shadowingState, setShadowingState] = useState<ShadowingState>(IDLE_STATE)

  const currentTimeRef = useRef(0)

  // Latest values reachable from the rAF loop / async command executor without
  // re-subscribing them as effect deps.
  const segmentsRef = useRef(segments)
  segmentsRef.current = segments
  const configRef = useRef(config)
  configRef.current = config
  const shadowingStateRef = useRef(shadowingState)
  shadowingStateRef.current = shadowingState
  const loopRangeRef = useRef(loopRange)
  loopRangeRef.current = loopRange
  const playbackRateRef = useRef(playbackRate)
  playbackRateRef.current = playbackRate

  const gapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTimeStateAtRef = useRef(0)

  const clearGapTimer = useCallback(() => {
    if (gapTimerRef.current !== null) {
      clearTimeout(gapTimerRef.current)
      gapTimerRef.current = null
    }
  }, [])

  // Forward declaration so the command executor can dispatch back into the FSM.
  const dispatchRef = useRef<(event: ShadowingEvent) => void>(() => {})

  const runCommands = useCallback(
    (commands: ShadowingCommand[]) => {
      const audio = audioRef.current
      for (const cmd of commands) {
        switch (cmd.type) {
          case 'SEEK':
            if (audio) audio.currentTime = cmd.time
            currentTimeRef.current = cmd.time
            break
          case 'PLAY':
            audio?.play().catch(() => setIsPlaying(false))
            setIsPlaying(true)
            break
          case 'PAUSE':
            audio?.pause()
            setIsPlaying(false)
            break
          case 'SET_RATE':
            if (audio) audio.playbackRate = cmd.rate
            setPlaybackRateState(cmd.rate)
            break
          case 'START_GAP_TIMER':
            clearGapTimer()
            gapTimerRef.current = setTimeout(() => {
              gapTimerRef.current = null
              dispatchRef.current({ type: 'GAP_ELAPSED' })
            }, cmd.ms)
            break
        }
      }
    },
    [audioRef, clearGapTimer],
  )

  const dispatch = useCallback(
    (event: ShadowingEvent) => {
      const result: ReduceResult = reduceShadowing(shadowingStateRef.current, event, {
        segments: segmentsRef.current,
        config: configRef.current,
      })
      shadowingStateRef.current = result.next
      setShadowingState(result.next)
      runCommands(result.commands)
    },
    [runCommands],
  )
  dispatchRef.current = dispatch

  // ---- rAF loop (only while playing) -------------------------------------
  useEffect(() => {
    if (!isPlaying) return

    let frame = 0
    const tick = (now: number) => {
      const audio = audioRef.current
      if (audio) {
        const t = audio.currentTime
        currentTimeRef.current = t

        // ~10fps throttled render state for the progress bar / time text.
        if (now - lastTimeStateAtRef.current >= TIME_STATE_THROTTLE_MS) {
          lastTimeStateAtRef.current = now
          setCurrentTime(t)
        }

        // Active line (shared source of truth) — only set state on change.
        const idx = findActiveSegmentIndex(segmentsRef.current, t)
        setActiveIndex((prev) => (prev === idx ? prev : idx))

        // Manual A/B loop is the special case handled inline (no gap, instant
        // reseek). Shadowing repeat lives in the FSM via TICK.
        const loop = loopRangeRef.current
        if (loop && t >= loop.end) {
          audio.currentTime = loop.start
          currentTimeRef.current = loop.start
        } else if (configRef.current.enabled) {
          dispatchRef.current({ type: 'TICK', time: t })
        }
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isPlaying, audioRef])

  useEffect(() => () => clearGapTimer(), [clearGapTimer])

  // ---- transport ----------------------------------------------------------
  const play = useCallback(() => {
    audioRef.current?.play().catch(() => setIsPlaying(false))
    setIsPlaying(true)
  }, [audioRef])

  const pause = useCallback(() => {
    audioRef.current?.pause()
    setIsPlaying(false)
  }, [audioRef])

  const togglePlay = useCallback(() => {
    if (audioRef.current?.paused === false || shadowingStateRef.current.phase !== 'idle') {
      // currently playing (or in a shadowing cycle) -> pause
      if (!isPlaying) {
        play()
        return
      }
    }
    if (isPlaying) {
      pause()
    } else {
      play()
    }
  }, [audioRef, isPlaying, play, pause])

  const seek = useCallback(
    (time: number) => {
      if (audioRef.current) audioRef.current.currentTime = time
      currentTimeRef.current = time
      setCurrentTime(time)
    },
    [audioRef],
  )

  const setPlaybackRate = useCallback(
    (rate: number) => {
      if (audioRef.current) audioRef.current.playbackRate = rate
      setPlaybackRateState(rate)
    },
    [audioRef],
  )

  const setVolume = useCallback(
    (v: number) => {
      if (audioRef.current) audioRef.current.volume = v
      setVolumeState(v)
    },
    [audioRef],
  )

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev
      if (audioRef.current) audioRef.current.muted = next
      return next
    })
  }, [audioRef])

  // ---- line-level ---------------------------------------------------------
  const playLine = useCallback(
    (index: number) => {
      const seg = segmentsRef.current[index]
      if (!seg) return
      dispatch({ type: 'JUMP', index })
      seek(seg.start)
      play()
    },
    [dispatch, seek, play],
  )

  const replayLine = useCallback(() => {
    const idx = configRef.current.enabled
      ? shadowingStateRef.current.activeIndex
      : findActiveSegmentIndex(segmentsRef.current, currentTimeRef.current)
    if (idx >= 0) playLine(idx)
  }, [playLine])

  // ---- shadowing ----------------------------------------------------------
  const toggleShadowing = useCallback(() => {
    const enabled = !configRef.current.enabled
    const nextConfig = { ...configRef.current, enabled }
    configRef.current = nextConfig
    setConfig(nextConfig)
    persistConfig(nextConfig)
    dispatch({ type: 'TOGGLE', enabled })
    // When shadowing turns OFF (or returns to idle), restore the footer rate.
    if (!enabled && audioRef.current) {
      audioRef.current.playbackRate = playbackRateRef.current
    }
  }, [audioRef, dispatch])

  const setShadowingConfig = useCallback(
    (patch: Partial<ShadowingConfig>) => {
      const nextConfig = { ...configRef.current, ...patch }
      configRef.current = nextConfig
      setConfig(nextConfig)
      persistConfig(nextConfig)
      dispatch({ type: 'CONFIG_CHANGE', patch })
    },
    [dispatch],
  )

  // ---- A/B loop -----------------------------------------------------------
  const setLoopRange = useCallback((r: { start: number; end: number } | null) => {
    setLoopRangeState(r)
    loopRangeRef.current = r
  }, [])

  return {
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    volume,
    isMuted,
    currentTimeRef,
    play,
    pause,
    togglePlay,
    seek,
    setPlaybackRate,
    setVolume,
    toggleMute,
    activeIndex,
    playLine,
    replayLine,
    shadowing: { ...shadowingState, config },
    toggleShadowing,
    setShadowingConfig,
    loopRange,
    setLoopRange,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**
  Run: `bunx vitest run src/hooks/player/__tests__/usePlaybackController.test.ts`
  Expected: PASS — all transport tests green. (The `duration` field is wired but exercised in Phase E once the page feeds `loadedmetadata`; no transport test asserts it here.)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/player/usePlaybackController.ts src/hooks/player/__tests__/usePlaybackController.test.ts
git commit -m "feat(player): usePlaybackController transport state and command executor"
```

---

### Task D.3: Shadowing cycle — segment end pauses, gap timer replays N times then advances; rate restore

**Files:**
- Modify: `src/hooks/player/usePlaybackController.ts` (no source change expected — the FSM wiring from D.2 already executes commands; this task adds the behavioral tests that lock the cycle. Only add code if a test fails.)
- Test: `src/hooks/player/__tests__/usePlaybackController.test.ts` (append a new `describe` block)

This task proves the full shadowing loop end-to-end against the fake audio + fake timers + fake rAF: enabling shadowing while at a line, a `TICK` past `seg.end - EPSILON` produces `PAUSE` + `START_GAP_TIMER`, advancing the fake timer fires `GAP_ELAPSED` which seeks back and replays, and after `repeatCount` plays it advances to the next line. It also verifies `practiceRate` is applied during LISTENING and the footer rate is restored when shadowing is toggled off. The exact command sequence is produced by the Phase C `reduceShadowing`; these tests assert the controller faithfully executes those commands on the audio element.

- [ ] **Step 1: Write the failing test (append to the existing test file)**

```ts
// Append to src/hooks/player/__tests__/usePlaybackController.test.ts
import { DEFAULT_SHADOWING_CONFIG, EPSILON } from '~/lib/player/shadowing-machine'

describe('usePlaybackController — shadowing cycle', () => {
  const segments = [
    { start: 0, end: 3 },
    { start: 3, end: 6 },
    { start: 6, end: 10 },
  ]
  let audio: FakeAudio
  let audioRef: RefObject<HTMLAudioElement>
  let fakeRaf: ReturnType<typeof installFakeRaf>

  beforeEach(() => {
    vi.useFakeTimers()
    audio = makeAudio()
    audioRef = { current: audio as unknown as HTMLAudioElement }
    fakeRaf = installFakeRaf()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // Drive one rAF frame at a given audio time and FSM-relevant clock.
  function frameAt(time: number, now = 0) {
    audio.currentTime = time
    act(() => fakeRaf.flushFrame(now))
  }

  it('reaching segment end in shadowing mode pauses and starts the gap timer', () => {
    const { result } = renderHook(() => usePlaybackController({ audioRef, segments }))

    act(() => result.current.toggleShadowing()) // enabled = true
    act(() => result.current.playLine(0)) // start practising line 0
    audio.play.mockClear()
    audio.pause.mockClear()

    // Tick before the end: still listening, no pause.
    frameAt(2.0)
    expect(audio.pause).not.toHaveBeenCalled()

    // Tick at/after seg.end - EPSILON: FSM -> GAP, controller pauses + arms timer.
    frameAt(3 - EPSILON + 0.001)
    expect(audio.pause).toHaveBeenCalled()
    expect(result.current.shadowing.phase).toBe('gap')
  })

  it('gap elapse seeks back to seg start and replays until repeatCount, then advances', () => {
    const { result } = renderHook(() => usePlaybackController({ audioRef, segments }))

    // repeatCount = 3 (default). Use a known gap so we can advance timers.
    act(() => result.current.toggleShadowing())
    act(() => result.current.playLine(0))

    // play #1 finished -> gap
    frameAt(3 - EPSILON + 0.001)
    expect(result.current.shadowing.phase).toBe('gap')
    expect(result.current.shadowing.playsDone).toBe(1)

    // gap elapses -> seek back to 0, replay (play #2)
    act(() => {
      vi.runOnlyPendingTimers()
    })
    expect(audio.currentTime).toBe(0)
    expect(result.current.shadowing.phase).toBe('listening')
    expect(result.current.shadowing.activeIndex).toBe(0)

    // play #2 finished -> gap
    frameAt(3 - EPSILON + 0.001)
    expect(result.current.shadowing.playsDone).toBe(2)
    act(() => {
      vi.runOnlyPendingTimers()
    })
    // play #3 (final repeat)
    expect(audio.currentTime).toBe(0)

    // play #3 finished -> gap, then advance to line 1 (autoAdvance default true)
    frameAt(3 - EPSILON + 0.001)
    expect(result.current.shadowing.playsDone).toBe(3)
    act(() => {
      vi.runOnlyPendingTimers()
    })
    expect(result.current.shadowing.activeIndex).toBe(1)
    expect(result.current.shadowing.playsDone).toBe(0)
    expect(audio.currentTime).toBe(3) // seeked to start of segment 1
  })

  it('applies practiceRate to audio during shadowing LISTENING', () => {
    const { result } = renderHook(() => usePlaybackController({ audioRef, segments }))
    act(() => result.current.toggleShadowing())
    act(() => result.current.playLine(0))
    // FSM emits SET_RATE: practiceRate on entering LISTENING.
    expect(audio.playbackRate).toBe(DEFAULT_SHADOWING_CONFIG.practiceRate)
  })

  it('restores footer playbackRate when shadowing is toggled off', () => {
    const { result } = renderHook(() => usePlaybackController({ audioRef, segments }))
    act(() => result.current.setPlaybackRate(1.25)) // footer rate
    act(() => result.current.toggleShadowing()) // on -> practiceRate applied
    act(() => result.current.playLine(0))
    expect(audio.playbackRate).toBe(DEFAULT_SHADOWING_CONFIG.practiceRate)

    act(() => result.current.toggleShadowing()) // off -> restore footer rate
    expect(audio.playbackRate).toBe(1.25)
    expect(result.current.shadowing.config.enabled).toBe(false)
  })

  it('persists ShadowingConfig to localStorage under "shadowing-config"', () => {
    const { result } = renderHook(() => usePlaybackController({ audioRef, segments }))
    act(() => result.current.setShadowingConfig({ repeatCount: 5 }))
    const saved = JSON.parse(localStorage.getItem('shadowing-config') as string)
    expect(saved.repeatCount).toBe(5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails (then passes after any needed tweak)**
  Run: `bunx vitest run src/hooks/player/__tests__/usePlaybackController.test.ts -t "shadowing cycle"`
  Expected: Initially these may FAIL if the D.2 wiring missed a detail (e.g. `SET_RATE` not executed, gap timer not armed). The failure message will point at the exact command not reflected on the fake audio.

- [ ] **Step 3: Write minimal implementation (only if a test failed)**
  The D.2 implementation already executes all five `ShadowingCommand` kinds and arms the gap timer via `setTimeout`. If `restores footer playbackRate` fails, confirm `toggleShadowing` resets `audio.playbackRate = playbackRateRef.current` on disable (it does in the D.2 code). If `applies practiceRate` fails, confirm `playLine` dispatches `JUMP` BEFORE `seek`/`play` so the FSM emits `SET_RATE` (it does). No new source edit should be required; if one is, it is a targeted fix inside `runCommands` or `toggleShadowing` only — paste the complete revised function, not a fragment. Example complete revised `toggleShadowing` if a fix is needed (identical to D.2 unless your Phase C `reduceShadowing` emits `SET_RATE` only on `TICK`, in which case the disable-branch restore below is the canonical guarantee):

```ts
  const toggleShadowing = useCallback(() => {
    const enabled = !configRef.current.enabled
    const nextConfig = { ...configRef.current, enabled }
    configRef.current = nextConfig
    setConfig(nextConfig)
    persistConfig(nextConfig)
    dispatch({ type: 'TOGGLE', enabled })
    if (!enabled && audioRef.current) {
      audioRef.current.playbackRate = playbackRateRef.current
      setPlaybackRateState(playbackRateRef.current)
    }
  }, [audioRef, dispatch])
```

- [ ] **Step 4: Run test to verify it passes**
  Run: `bunx vitest run src/hooks/player/__tests__/usePlaybackController.test.ts`
  Expected: PASS — both the transport and shadowing-cycle describe blocks are green.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/player/usePlaybackController.ts src/hooks/player/__tests__/usePlaybackController.test.ts
git commit -m "test(player): lock shadowing repeat cycle and rate restore in usePlaybackController"
```

---

### Task D.4: A/B loop is the gap-free special case — reseek at loop end

**Files:**
- Modify: `src/hooks/player/usePlaybackController.ts` (no new source expected — the rAF loop in D.2 already handles `loopRange`; add the test that locks it. Only edit source if the test fails.)
- Test: `src/hooks/player/__tests__/usePlaybackController.test.ts` (append a new `describe` block)

A non-null `loopRange` behaves as a manual A/B loop: when audio time reaches `loop.end`, instantly seek back to `loop.start` with no gap and no repeat counter. This is modelled inline in the rAF loop (not via the FSM gap), and it takes precedence over shadowing TICK dispatch for that frame so the two loop mechanisms never fight.

- [ ] **Step 1: Write the failing test (append to the existing test file)**

```ts
// Append to src/hooks/player/__tests__/usePlaybackController.test.ts
describe('usePlaybackController — A/B loop', () => {
  const segments = [
    { start: 0, end: 3 },
    { start: 3, end: 6 },
  ]
  let audio: FakeAudio
  let audioRef: RefObject<HTMLAudioElement>
  let fakeRaf: ReturnType<typeof installFakeRaf>

  beforeEach(() => {
    vi.useFakeTimers()
    audio = makeAudio()
    audioRef = { current: audio as unknown as HTMLAudioElement }
    fakeRaf = installFakeRaf()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('reseeks to loop.start when audio reaches loop.end (no gap timer)', () => {
    const { result } = renderHook(() => usePlaybackController({ audioRef, segments }))

    act(() => result.current.setLoopRange({ start: 1, end: 4 }))
    expect(result.current.loopRange).toEqual({ start: 1, end: 4 })

    act(() => result.current.play())

    // before loop.end -> no reseek
    audio.currentTime = 3.5
    act(() => fakeRaf.flushFrame(0))
    expect(audio.currentTime).toBe(3.5)

    // at/after loop.end -> instant reseek to start, no gap timer armed
    audio.currentTime = 4.0
    act(() => fakeRaf.flushFrame(200))
    expect(audio.currentTime).toBe(1)
    // no pending gap timer (A/B has no gap)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clearing the loop (null) stops the reseek behavior', () => {
    const { result } = renderHook(() => usePlaybackController({ audioRef, segments }))
    act(() => result.current.setLoopRange({ start: 1, end: 4 }))
    act(() => result.current.setLoopRange(null))
    act(() => result.current.play())

    audio.currentTime = 5.0
    act(() => fakeRaf.flushFrame(0))
    expect(audio.currentTime).toBe(5.0) // unchanged, no loop
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
  Run: `bunx vitest run src/hooks/player/__tests__/usePlaybackController.test.ts -t "A/B loop"`
  Expected: Initially may FAIL if the rAF loop reads a stale `loopRange` (closure capture) instead of `loopRangeRef.current`. The D.2 loop reads `loopRangeRef.current`, so it should already pass; the failure message would show `audio.currentTime` not reset to `1`.

- [ ] **Step 3: Write minimal implementation (only if a test failed)**
  No new source is expected — the D.2 rAF loop already branches on `loopRangeRef.current` before the shadowing TICK and reseeks with no gap. If a test fails because the ref is stale, ensure `setLoopRange` writes `loopRangeRef.current = r` synchronously (it does in D.2). The complete canonical loop branch that must be present inside the rAF `tick` is:

```ts
        const loop = loopRangeRef.current
        if (loop && t >= loop.end) {
          audio.currentTime = loop.start
          currentTimeRef.current = loop.start
        } else if (configRef.current.enabled) {
          dispatchRef.current({ type: 'TICK', time: t })
        }
```

- [ ] **Step 4: Run test to verify it passes**
  Run: `bunx vitest run src/hooks/player/__tests__/usePlaybackController.test.ts`
  Expected: PASS — transport, shadowing-cycle, and A/B-loop describe blocks all green.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/player/usePlaybackController.ts src/hooks/player/__tests__/usePlaybackController.test.ts
git commit -m "test(player): A/B loop as gap-free reseek special case"
```

---

### Task D.5: Type-check and full-phase verification

**Files:**
- (no code change) Verification gate for the phase.

Confirm both new hooks compile against the locked `PlaybackController` interface and the Phase C symbols, and that the whole new test set passes together. `useAudioPlayer` / `useShadowingMode` are still present and untouched — they are deleted in Phase E after `PlayerPage` is rewired, so their existing tests must still pass.

- [ ] **Step 1: Type-check the workspace**
  Run: `bun run type-check`
  Expected: exits 0, no errors. (Validates that `currentTimeRef` is a `MutableRefObject<number>`, the returned object structurally matches `PlaybackController`, and the imports from `~/lib/player/active-segment` and `~/lib/player/shadowing-machine` resolve.)

- [ ] **Step 2: Run both new test files together**
  Run: `bunx vitest run src/hooks/player/__tests__/useActiveSegmentIndex.test.ts src/hooks/player/__tests__/usePlaybackController.test.ts`
  Expected: PASS — every test in both files green (transport, shadowing-cycle, A/B-loop, active-segment).

- [ ] **Step 3: Confirm no regression in the hooks this phase will eventually replace**
  Run: `bunx vitest run src/hooks/ui/__tests__/useAudioPlayer.test.ts src/hooks/player/__tests__/useShadowingMode.test.ts`
  Expected: PASS — these legacy hooks are untouched in Phase D, so their tests remain green. (They are removed in Phase E.)

- [ ] **Step 4: No commit needed**
  This task introduces no file changes; it is a verification checkpoint. If any step fails, fix the offending hook (paste the complete revised function in the fixing commit) before proceeding to Phase E.

**✅ D done when:** Run `bunx vitest run src/hooks/player/__tests__/useActiveSegmentIndex.test.ts src/hooks/player/__tests__/usePlaybackController.test.ts` — all tests in both files PASS. Run `bun run type-check` — exits 0. Legacy `useAudioPlayer`/`useShadowingMode` tests still pass (untouched until Phase E).

> **Phase D notes:** Sequencing: Phase D depends on Phase C having created src/lib/player/active-segment.ts (findActiveSegmentIndex) and src/lib/player/shadowing-machine.ts (reduceShadowing, DEFAULT_SHADOWING_CONFIG, EPSILON, all types). It also assumes Phase A already reverted the test runner to Vitest (tests import from 'vitest', run under happy-dom, command `bunx vitest run`). I confirmed by reading the repo that src/lib/player/ does not yet exist and the current setup.ts/test files still import from 'bun:test' — so D's tests will only run green after Phase A+C land; the orchestrator must order A < C < D.

Risk / assumption about reduceShadowing command emission: the controller relies on the Phase C reducer emitting SET_RATE(practiceRate) when entering LISTENING (on JUMP/GAP_ELAPSED→replay/advance) and the controller additionally guarantees footer-rate restoration on shadowing disable inside toggleShadowing (belt-and-suspenders). If Phase C only emits SET_RATE on TICK, Task D.3's 'applies practiceRate' test still passes because playLine dispatches JUMP before play and the first TICK fires on the next frame — but I made playLine dispatch JUMP first precisely so the FSM has a chance to emit SET_RATE; if the reducer emits SET_RATE only on the LISTENING-entry transition, the command executor applies it immediately. Should the exact emission point differ, the only file to touch is usePlaybackController.ts (runCommands / toggleShadowing) — the test contract is unchanged.

The fake-audio + controllable-rAF + Vitest-fake-timers harness is duplicated across the three usePlaybackController describe blocks intentionally (each block re-installs in beforeEach) to keep tasks independently runnable via -t filters; an assembler may later hoist makeAudio/installFakeRaf to a shared test helper, but that is cosmetic and not required.

duration state is wired (setDuration) but not driven inside the hook — Phase E feeds it from the loadedmetadata listener it moves off PlayerPage; no D test asserts duration to avoid coupling to Phase E.

togglePlay has a slightly defensive branch; if the assembler prefers, it can be simplified to the plain `isPlaying ? pause() : play()` form — both satisfy the D.2 togglePlay test. I kept the defensive version so a shadowing-cycle pause (FSM PAUSE while isPlaying state may lag) still toggles correctly.

---

## Phase E: UI, integration & cleanup

This phase wires the locked Phase C/D engine into the live UI and deletes the orphan audio stack. It depends on these symbols already existing and exported: `usePlaybackController` / `PlaybackController` (`src/hooks/player/usePlaybackController.ts`), `useActiveSegmentIndex` (`src/hooks/player/useActiveSegmentIndex.ts`), `ShadowingConfig` / `DEFAULT_SHADOWING_CONFIG` / `ShadowingState` (`src/lib/player/shadowing-machine.ts`), and `findActiveSegmentIndex` (`src/lib/player/active-segment.ts`).

All new tests import from `vitest` (Phase A reverted the runner to Vitest with `globals: true` + `setupFiles`). Stage explicit paths only — never `git add -A`.

---

### Task E.1: Presentational `SpeedPresets` component (footer speed 0.75 / 1 / 1.25)

**Files:**
- Create: `src/components/features/player/SpeedPresets.tsx`
- Test: `src/components/features/player/__tests__/SpeedPresets.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SpeedPresets } from '../SpeedPresets'

describe('SpeedPresets', () => {
  it('renders the three presets 0.75 / 1 / 1.25', () => {
    render(<SpeedPresets value={1} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: '0.75x' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1x' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1.25x' })).toBeInTheDocument()
  })

  it('marks the active preset with aria-pressed', () => {
    render(<SpeedPresets value={1.25} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: '1.25x' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '1x' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('fires onChange with the chosen rate', async () => {
    const onChange = vi.fn()
    render(<SpeedPresets value={1} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: '0.75x' }))
    expect(onChange).toHaveBeenCalledWith(0.75)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
  - Run: `bunx vitest run src/components/features/player/__tests__/SpeedPresets.test.tsx`
  - Expected: FAIL because `../SpeedPresets` does not exist yet (module resolution error).

- [ ] **Step 3: Write minimal implementation**

```tsx
import React from 'react'
import { cn } from '~/lib/utils/utils'

export const SPEED_PRESETS = [0.75, 1, 1.25] as const

interface SpeedPresetsProps {
  value: number
  onChange: (rate: number) => void
}

export const SpeedPresets = React.memo<SpeedPresetsProps>(({ value, onChange }) => {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="播放速度">
      {SPEED_PRESETS.map((rate) => {
        const active = Math.abs(value - rate) < 0.001
        return (
          <button
            key={rate}
            type="button"
            onClick={() => onChange(rate)}
            aria-pressed={active}
            className={cn(
              'btn-secondary !h-8 !rounded-full !px-3 text-xs font-mono tabular-nums',
              active && '!border-[var(--color-primary)] !text-[var(--color-primary)]',
            )}
          >
            {rate}x
          </button>
        )
      })}
    </div>
  )
})

SpeedPresets.displayName = 'SpeedPresets'
```

- [ ] **Step 4: Run test to verify it passes**
  - Run: `bunx vitest run src/components/features/player/__tests__/SpeedPresets.test.tsx`
  - Expected: PASS (3 tests green).

- [ ] **Step 5: Commit**

```bash
git add src/components/features/player/SpeedPresets.tsx src/components/features/player/__tests__/SpeedPresets.test.tsx
git commit -m "feat: add SpeedPresets footer speed control (0.75/1/1.25)"
```

---

### Task E.2: Presentational `ShadowingSettings` popover

Pure props-driven settings panel. Repeat-count stepper 1–5, gap 短/中/长 -> `gapRatio` 0.6/1.0/1.6, practiceRate 0.5/0.75/1, autoAdvance switch. Hosting (open/close) is added in Task E.5; here it is always-rendered content.

**Files:**
- Create: `src/components/features/player/ShadowingSettings.tsx`
- Test: `src/components/features/player/__tests__/ShadowingSettings.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SHADOWING_CONFIG } from '~/lib/player/shadowing-machine'
import { ShadowingSettings } from '../ShadowingSettings'

function setup(overrides = {}) {
  const onChange = vi.fn()
  render(
    <ShadowingSettings
      config={{ ...DEFAULT_SHADOWING_CONFIG, ...overrides }}
      onChange={onChange}
    />,
  )
  return { onChange }
}

describe('ShadowingSettings', () => {
  it('renders the current repeat count', () => {
    setup({ repeatCount: 3 })
    expect(screen.getByTestId('repeat-count-value')).toHaveTextContent('3')
  })

  it('increments repeat count up to 5', async () => {
    const { onChange } = setup({ repeatCount: 3 })
    await userEvent.click(screen.getByRole('button', { name: '增加重复次数' }))
    expect(onChange).toHaveBeenCalledWith({ repeatCount: 4 })
  })

  it('does not increment past 5', async () => {
    const { onChange } = setup({ repeatCount: 5 })
    await userEvent.click(screen.getByRole('button', { name: '增加重复次数' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('decrements repeat count down to 1', async () => {
    const { onChange } = setup({ repeatCount: 2 })
    await userEvent.click(screen.getByRole('button', { name: '减少重复次数' }))
    expect(onChange).toHaveBeenCalledWith({ repeatCount: 1 })
  })

  it('does not decrement below 1', async () => {
    const { onChange } = setup({ repeatCount: 1 })
    await userEvent.click(screen.getByRole('button', { name: '减少重复次数' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('maps gap 短/中/长 to gapRatio 0.6/1.0/1.6', async () => {
    const { onChange } = setup({ gapRatio: 1.0 })
    await userEvent.click(screen.getByRole('button', { name: '短' }))
    expect(onChange).toHaveBeenCalledWith({ gapRatio: 0.6 })
    await userEvent.click(screen.getByRole('button', { name: '长' }))
    expect(onChange).toHaveBeenCalledWith({ gapRatio: 1.6 })
  })

  it('maps practice rate presets to practiceRate', async () => {
    const { onChange } = setup({ practiceRate: 0.75 })
    await userEvent.click(screen.getByRole('button', { name: '0.5x' }))
    expect(onChange).toHaveBeenCalledWith({ practiceRate: 0.5 })
    await userEvent.click(screen.getByRole('button', { name: '1x' }))
    expect(onChange).toHaveBeenCalledWith({ practiceRate: 1 })
  })

  it('toggles autoAdvance', async () => {
    const { onChange } = setup({ autoAdvance: true })
    await userEvent.click(screen.getByRole('switch', { name: '自动进下一句' }))
    expect(onChange).toHaveBeenCalledWith({ autoAdvance: false })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
  - Run: `bunx vitest run src/components/features/player/__tests__/ShadowingSettings.test.tsx`
  - Expected: FAIL because `../ShadowingSettings` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```tsx
import React from 'react'
import { cn } from '~/lib/utils/utils'
import type { ShadowingConfig } from '~/lib/player/shadowing-machine'

const GAP_PRESETS: { label: string; ratio: number }[] = [
  { label: '短', ratio: 0.6 },
  { label: '中', ratio: 1.0 },
  { label: '长', ratio: 1.6 },
]

const PRACTICE_RATES = [0.5, 0.75, 1] as const

interface ShadowingSettingsProps {
  config: ShadowingConfig
  onChange: (patch: Partial<ShadowingConfig>) => void
}

export const ShadowingSettings = React.memo<ShadowingSettingsProps>(({ config, onChange }) => {
  return (
    <div className="flex w-64 flex-col gap-4 text-sm text-[var(--text-primary)]">
      <p className="font-semibold">影子跟读设置</p>

      {/* 每句重复 */}
      <div className="flex items-center justify-between">
        <span>每句重复</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="减少重复次数"
            disabled={config.repeatCount <= 1}
            onClick={() => {
              if (config.repeatCount > 1) onChange({ repeatCount: config.repeatCount - 1 })
            }}
            className="btn-secondary !h-8 !w-8 !rounded-full !p-0 disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-base">remove</span>
          </button>
          <span
            data-testid="repeat-count-value"
            className="min-w-[1.5rem] text-center font-mono tabular-nums"
          >
            {config.repeatCount}
          </span>
          <button
            type="button"
            aria-label="增加重复次数"
            disabled={config.repeatCount >= 5}
            onClick={() => {
              if (config.repeatCount < 5) onChange({ repeatCount: config.repeatCount + 1 })
            }}
            className="btn-secondary !h-8 !w-8 !rounded-full !p-0 disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-base">add</span>
          </button>
        </div>
      </div>

      {/* 跟读留白 */}
      <div className="flex items-center justify-between">
        <span>跟读留白</span>
        <div className="flex items-center gap-1" role="group" aria-label="跟读留白">
          {GAP_PRESETS.map(({ label, ratio }) => {
            const active = Math.abs(config.gapRatio - ratio) < 0.001
            return (
              <button
                key={label}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ gapRatio: ratio })}
                className={cn(
                  'btn-secondary !h-8 !rounded-full !px-3 text-xs',
                  active && '!border-[var(--color-primary)] !text-[var(--color-primary)]',
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 练习语速 */}
      <div className="flex items-center justify-between">
        <span>练习语速</span>
        <div className="flex items-center gap-1" role="group" aria-label="练习语速">
          {PRACTICE_RATES.map((rate) => {
            const active = Math.abs(config.practiceRate - rate) < 0.001
            return (
              <button
                key={rate}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ practiceRate: rate })}
                className={cn(
                  'btn-secondary !h-8 !rounded-full !px-3 text-xs font-mono tabular-nums',
                  active && '!border-[var(--color-primary)] !text-[var(--color-primary)]',
                )}
              >
                {rate}x
              </button>
            )
          })}
        </div>
      </div>

      {/* 自动进下一句 */}
      <div className="flex items-center justify-between">
        <span>自动进下一句</span>
        <button
          type="button"
          role="switch"
          aria-label="自动进下一句"
          aria-checked={config.autoAdvance}
          onClick={() => onChange({ autoAdvance: !config.autoAdvance })}
          className={cn(
            'relative h-6 w-11 rounded-full transition-colors',
            config.autoAdvance ? 'bg-[var(--color-primary)]' : 'bg-[var(--surface-muted)]',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
              config.autoAdvance ? 'translate-x-[1.375rem]' : 'translate-x-0.5',
            )}
          />
        </button>
      </div>
    </div>
  )
})

ShadowingSettings.displayName = 'ShadowingSettings'
```

- [ ] **Step 4: Run test to verify it passes**
  - Run: `bunx vitest run src/components/features/player/__tests__/ShadowingSettings.test.tsx`
  - Expected: PASS (8 tests green).

- [ ] **Step 5: Commit**

```bash
git add src/components/features/player/ShadowingSettings.tsx src/components/features/player/__tests__/ShadowingSettings.test.tsx
git commit -m "feat: add ShadowingSettings popover content (repeat/gap/rate/autoAdvance)"
```

---

### Task E.3: Rewire `PlayerPage` onto `usePlaybackController`

Replace `useAudioPlayer` + `useShadowingMode` with `usePlaybackController(audioRef, segments)`. Remove the local `volume` `useState` and the duplicate audio-sync effects (play/pause sync, playbackRate sync, seek write-back, timeupdate/metadata listeners) — the controller owns them all. Keep rendering the `<audio>` element; the controller drives it via the ref. This task focuses on the controller swap; the footer prop wiring is completed in Task E.4, keyboard in E.6, status banner in E.7.

**Files:**
- Modify: `src/components/features/player/PlayerPage.tsx:1-309` (whole file)
- Test: (covered by `bun run type-check` + existing `PlayerPage.listeners.test.tsx` regression in Task E.10)

- [ ] **Step 1: Replace the imports block** (`PlayerPage.tsx:1-18`)

Replace:

```tsx
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import PlayerFooterContainer from '~/components/features/player/PlayerFooterContainer'
import {
  PlayerErrorState,
  PlayerLoadingState,
  PlayerMissingFileState,
} from '~/components/features/player/page/PlayerFallbackStates'
import { PlayerPageLayout } from '~/components/features/player/page/PlayerPageLayout'
import ScrollableSubtitleDisplay from '~/components/features/player/ScrollableSubtitleDisplay'
import ApiKeyError from '~/components/ui/ApiKeyError'
import { usePlayerDataQuery } from '~/hooks/player/usePlayerDataQuery'
import { useShadowingMode } from '~/hooks/player/useShadowingMode'
import { useAudioPlayer } from '~/hooks/ui/useAudioPlayer'
import { isApiKeyError } from '~/lib/utils/error-handler'
// 引入手动后Process工具，使其在浏览器控制台可用
import '~/lib/utils/manual-postprocess'
import type { Segment } from '~/types/db/database'
```

with:

```tsx
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useId, useRef } from 'react'
import PlayerFooterContainer from '~/components/features/player/PlayerFooterContainer'
import {
  PlayerErrorState,
  PlayerLoadingState,
  PlayerMissingFileState,
} from '~/components/features/player/page/PlayerFallbackStates'
import { PlayerStatusBanner } from '~/components/features/player/page/PlayerStatusBanner'
import { PlayerPageLayout } from '~/components/features/player/page/PlayerPageLayout'
import ScrollableSubtitleDisplay from '~/components/features/player/ScrollableSubtitleDisplay'
import ApiKeyError from '~/components/ui/ApiKeyError'
import { usePlaybackController } from '~/hooks/player/usePlaybackController'
import { usePlayerDataQuery } from '~/hooks/player/usePlayerDataQuery'
import { useActiveSegmentIndex } from '~/hooks/player/useActiveSegmentIndex'
import { useKeyboardControls } from '~/hooks/ui/useKeyboardControls'
import { isApiKeyError } from '~/lib/utils/error-handler'
// 引入手动后Process工具，使其在浏览器控制台可用
import '~/lib/utils/manual-postprocess'
import type { Segment } from '~/types/db/database'
```

- [ ] **Step 2: Replace the hook/effect body** (`PlayerPage.tsx:20-227`)

Replace everything from `export default function PlayerPageComponent` down to the end of `handleVolumeChange` (the original `}, [])` on line 227) with:

```tsx
export default function PlayerPageComponent({ fileId }: { fileId: string }) {
  const navigate = useNavigate()
  const { file, segments, transcript, audioUrl, loading, error, retry } = usePlayerDataQuery(fileId)

  const audioRef = useRef<HTMLAudioElement>(null)
  const subtitleContainerId = useId()

  const controller = usePlaybackController({ audioRef, segments })

  // 共享「当前句」唯一来源：基于帧级时间 ref 计算 activeIndex 给字幕高亮/滚动用。
  const activeIndex = useActiveSegmentIndex(segments, controller.currentTimeRef)

  const handleSegmentClick = useCallback(
    (segment: Segment) => {
      const index = segments.indexOf(segment)
      if (index >= 0) {
        controller.playLine(index)
      } else {
        controller.seek(segment.start)
        controller.play()
      }
    },
    [segments, controller],
  )

  const handleBack = useCallback(() => {
    controller.pause()
    navigate({ to: '/' })
  }, [controller, navigate])

  const handleSetLoopStart = useCallback(() => {
    const seg = segments[controller.activeIndex]
    if (seg) {
      const end = controller.loopRange?.end ?? seg.end
      controller.setLoopRange({ start: seg.start, end })
    }
  }, [segments, controller])

  const handleSetLoopEnd = useCallback(() => {
    const seg = segments[controller.activeIndex]
    if (seg) {
      const start = controller.loopRange?.start ?? seg.start
      controller.setLoopRange({ start, end: seg.end })
    }
  }, [segments, controller])

  const handleVolumeChange = useCallback(
    (newVolume: number) => {
      controller.setVolume(newVolume)
    },
    [controller],
  )
```

- [ ] **Step 3: Replace the footer JSX block** (`PlayerPage.tsx:229-248`)

Replace the `layoutFooter` definition:

```tsx
  const layoutFooter = audioUrl ? (
    <PlayerFooterContainer
      audioPlayerState={audioPlayerState}
      onSeek={handleSeek}
      onTogglePlay={handleTogglePlay}
      onSkipBack={onSkipBack}
      onSkipForward={onSkipForward}
      onClearLoop={onClearLoop}
      loopStart={loopStart}
      loopEnd={loopEnd}
      playbackRate={playbackRate}
      onPlaybackRateChange={setPlaybackRate}
      volume={volume}
      onVolumeChange={handleVolumeChange}
      onSetLoopStart={handleSetLoopStart}
      onSetLoopEnd={handleSetLoopEnd}
      onToggleShadowingMode={toggleShadowingMode}
      isShadowingMode={isShadowingMode}
    />
  ) : null
```

with:

```tsx
  const layoutFooter = audioUrl ? (
    <PlayerFooterContainer
      currentTime={controller.currentTime}
      duration={controller.duration}
      isPlaying={controller.isPlaying}
      onSeek={controller.seek}
      onTogglePlay={controller.togglePlay}
      onSkipBack={() => controller.seek(Math.max(0, controller.currentTime - 10))}
      onSkipForward={() => controller.seek(controller.currentTime + 10)}
      onClearLoop={() => controller.setLoopRange(null)}
      loopRange={controller.loopRange}
      playbackRate={controller.playbackRate}
      onPlaybackRateChange={controller.setPlaybackRate}
      volume={controller.volume}
      onVolumeChange={handleVolumeChange}
      onSetLoopStart={handleSetLoopStart}
      onSetLoopEnd={handleSetLoopEnd}
      onToggleShadowingMode={controller.toggleShadowing}
      isShadowingMode={controller.shadowing.config.enabled}
      shadowing={controller.shadowing}
      onShadowingConfigChange={controller.setShadowingConfig}
    />
  ) : null
```

- [ ] **Step 4: Replace the subtitle/banner render block** (`PlayerPage.tsx:279-308`)

Replace:

```tsx
  return (
    <>
      <PlayerPageLayout
        subtitleContainerId={subtitleContainerId}
        showFooter={Boolean(layoutFooter)}
        footer={layoutFooter ?? undefined}
      >
        {segments.length > 0 ? (
          <ScrollableSubtitleDisplay
            segments={segments}
            currentTime={audioPlayerState.currentTime}
            isPlaying={audioPlayerState.isPlaying}
            onSegmentClick={handleSegmentClick}
          />
        ) : transcript?.status === 'processing' || transcript?.status === 'pending' ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center text-sm text-[var(--secondary-text-color)] dark:text-[var(--text-color)]/70">
            <p>正在转录中，请稍候...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-12 text-center text-sm text-[var(--secondary-text-color)] dark:text-[var(--text-color)]/70">
            <p>暂无字幕内容，请先在主页转录此文件</p>
          </div>
        )}
      </PlayerPageLayout>

      <audio ref={audioRef} src={audioUrl ?? undefined} preload="auto" className="hidden">
        <track kind="captions" />
      </audio>
    </>
  )
}
```

with:

```tsx
  const isTranscribing =
    transcript?.status === 'processing' || transcript?.status === 'pending'

  return (
    <>
      <PlayerPageLayout
        subtitleContainerId={subtitleContainerId}
        showFooter={Boolean(layoutFooter)}
        footer={layoutFooter ?? undefined}
      >
        <PlayerStatusBanner transcript={transcript} isTranscribing={isTranscribing} />
        {segments.length > 0 ? (
          <ScrollableSubtitleDisplay
            segments={segments}
            activeIndex={activeIndex}
            currentTimeRef={controller.currentTimeRef}
            isPlaying={controller.isPlaying}
            onSegmentClick={handleSegmentClick}
          />
        ) : !isTranscribing ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center text-sm text-[var(--secondary-text-color)] dark:text-[var(--text-color)]/70">
            <p>暂无字幕内容，请先在主页转录此文件</p>
          </div>
        ) : null}
      </PlayerPageLayout>

      <audio ref={audioRef} src={audioUrl ?? undefined} preload="auto" className="hidden">
        <track kind="captions" />
      </audio>
    </>
  )
}
```

- [ ] **Step 5: Run type-check to verify it compiles against the new wiring**
  - Run: `bun run type-check`
  - Expected: PASS for `PlayerPage.tsx` itself. NOTE: `PlayerFooterContainer`/`ScrollableSubtitleDisplay`/`useKeyboardControls` prop-shape errors are still expected here and are resolved in Tasks E.4, E.5, E.6 — proceed to those before committing this group. (If you prefer a single green checkpoint, defer this commit until after E.6; otherwise commit now and accept that the page graph is red until E.6.)

- [ ] **Step 6: Commit** (after E.4–E.6 land — see note above)

```bash
git add src/components/features/player/PlayerPage.tsx
git commit -m "refactor: rewire PlayerPage onto usePlaybackController + useActiveSegmentIndex"
```

---

### Task E.4: Footer consumes controller — speed presets, shadowing status, region marker

Rewrite `PlayerFooter` to take primitives (`currentTime`/`duration`/`isPlaying`) instead of `AudioPlayerState`, render `SpeedPresets` wired to `playbackRate`/`onPlaybackRateChange`, show shadowing status `第 n/N 遍 · 听/留白` from `shadowing`, and draw the current-line/`loopRange` region marker on the progress bar. Also update `PlayerFooterContainer` to forward the popover content (built in E.5).

**Files:**
- Modify: `src/components/features/player/page/PlayerFooter.tsx:1-227` (whole file)
- Test: `src/components/features/player/__tests__/PlayerFooter.test.tsx` (covered indirectly; the status + presets render are checked here)

- [ ] **Step 1: Write the failing test**

Create `src/components/features/player/__tests__/PlayerFooter.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SHADOWING_CONFIG } from '~/lib/player/shadowing-machine'
import { PlayerFooter } from '../page/PlayerFooter'

function baseProps(overrides = {}) {
  return {
    currentTime: 30,
    duration: 194,
    isPlaying: false,
    onSeek: vi.fn(),
    onTogglePlay: vi.fn(),
    onSkipBack: vi.fn(),
    onSkipForward: vi.fn(),
    onClearLoop: vi.fn(),
    loopRange: null as { start: number; end: number } | null,
    playbackRate: 1,
    onPlaybackRateChange: vi.fn(),
    volume: 1,
    onVolumeChange: vi.fn(),
    onSetLoopStart: vi.fn(),
    onSetLoopEnd: vi.fn(),
    onToggleShadowingMode: vi.fn(),
    isShadowingMode: false,
    shadowing: { ...DEFAULT_SHADOWING_CONFIG, phase: 'idle', activeIndex: -1, playsDone: 0, config: DEFAULT_SHADOWING_CONFIG },
    onShadowingConfigChange: vi.fn(),
    settingsSlot: null as React.ReactNode,
    ...overrides,
  }
}

describe('PlayerFooter', () => {
  it('renders the speed presets and forwards changes', async () => {
    const onPlaybackRateChange = vi.fn()
    render(<PlayerFooter {...baseProps({ onPlaybackRateChange })} />)
    await userEvent.click(screen.getByRole('button', { name: '1.25x' }))
    expect(onPlaybackRateChange).toHaveBeenCalledWith(1.25)
  })

  it('shows shadowing status 第 n/N 遍 · 听 during listening', () => {
    render(
      <PlayerFooter
        {...baseProps({
          isShadowingMode: true,
          shadowing: {
            ...DEFAULT_SHADOWING_CONFIG,
            phase: 'listening',
            activeIndex: 2,
            playsDone: 1,
            config: { ...DEFAULT_SHADOWING_CONFIG, repeatCount: 3 },
          },
        })}
      />,
    )
    expect(screen.getByTestId('shadowing-status')).toHaveTextContent('第 2/3 遍 · 听')
  })

  it('shows 留白 during the gap phase', () => {
    render(
      <PlayerFooter
        {...baseProps({
          isShadowingMode: true,
          shadowing: {
            ...DEFAULT_SHADOWING_CONFIG,
            phase: 'gap',
            activeIndex: 0,
            playsDone: 0,
            config: { ...DEFAULT_SHADOWING_CONFIG, repeatCount: 3 },
          },
        })}
      />,
    )
    expect(screen.getByTestId('shadowing-status')).toHaveTextContent('第 1/3 遍 · 留白')
  })

  it('draws the loop region marker when loopRange is set', () => {
    render(<PlayerFooter {...baseProps({ loopRange: { start: 20, end: 60 } })} />)
    const marker = screen.getByTestId('loop-region-marker')
    // start 20/194 ≈ 10.3%, width (60-20)/194 ≈ 20.6%
    expect(marker).toHaveStyle({ left: `${(20 / 194) * 100}%` })
    expect(marker).toHaveStyle({ width: `${(40 / 194) * 100}%` })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
  - Run: `bunx vitest run src/components/features/player/__tests__/PlayerFooter.test.tsx`
  - Expected: FAIL because `PlayerFooter` still takes `audioPlayerState` (TS/runtime mismatch) and renders no speed presets, no `shadowing-status`, no `loop-region-marker`.

- [ ] **Step 3: Write minimal implementation** — replace the entire `src/components/features/player/page/PlayerFooter.tsx`:

```tsx
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { SpeedPresets } from '~/components/features/player/SpeedPresets'
import { cn } from '~/lib/utils/utils'
import type { ShadowingConfig, ShadowingState } from '~/lib/player/shadowing-machine'

interface PlayerFooterProps {
  currentTime: number
  duration: number
  isPlaying: boolean
  onSeek: (time: number) => void
  onTogglePlay: () => void
  onSkipBack?: () => void
  onSkipForward?: () => void
  onClearLoop?: () => void
  loopRange?: { start: number; end: number } | null
  playbackRate: number
  onPlaybackRateChange: (rate: number) => void
  volume: number
  onVolumeChange: (volume: number) => void
  onSetLoopStart?: () => void
  onSetLoopEnd?: () => void
  onToggleShadowingMode?: () => void
  isShadowingMode?: boolean
  shadowing: ShadowingState & { config: ShadowingConfig }
  onShadowingConfigChange: (patch: Partial<ShadowingConfig>) => void
  settingsSlot?: ReactNode
}

export function PlayerFooter({
  currentTime,
  duration,
  isPlaying,
  onSeek,
  onTogglePlay,
  onSkipBack,
  onSkipForward,
  onClearLoop,
  loopRange,
  playbackRate,
  onPlaybackRateChange,
  volume,
  onVolumeChange,
  onSetLoopStart,
  onSetLoopEnd,
  onToggleShadowingMode,
  isShadowingMode,
  shadowing,
  settingsSlot,
}: PlayerFooterProps) {
  const progressWidth = useMemo(() => {
    if (!duration) return 0
    return Math.min(100, Math.max(0, (currentTime / duration) * 100))
  }, [currentTime, duration])

  const loopMarker = useMemo(() => {
    if (!loopRange || !duration) return null
    const left = Math.min(100, Math.max(0, (loopRange.start / duration) * 100))
    const width = Math.min(100 - left, Math.max(0, ((loopRange.end - loopRange.start) / duration) * 100))
    return { left, width }
  }, [loopRange, duration])

  const volumePercentage = Math.round(volume * 100)

  const shadowingStatus = useMemo(() => {
    if (!isShadowingMode || shadowing.phase === 'idle' || shadowing.activeIndex < 0) return null
    const plays = shadowing.playsDone + 1
    const total = shadowing.config.repeatCount
    const phaseLabel = shadowing.phase === 'gap' ? '留白' : '听'
    return `第 ${plays}/${total} 遍 · ${phaseLabel}`
  }, [isShadowingMode, shadowing])

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-10 border-t border-[var(--border-primary)] bg-[var(--surface-card)] shadow-[var(--shadow-lg)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6">
        {/*进度条区域*/}
        <div className="flex items-center gap-3">
          <span className="min-w-[3rem] text-sm font-mono tabular-nums text-[var(--text-secondary)]">
            {formatTime(currentTime)}
          </span>

          <div className="group relative flex-1">
            {/*进度条容器 - 增加点击区域*/}
            <div className="relative h-2 w-full cursor-pointer rounded-full bg-[var(--surface-muted)]">
              {/*循环区标记（手动 A/B 或当前句循环区）*/}
              {loopMarker && (
                <div
                  data-testid="loop-region-marker"
                  className="pointer-events-none absolute top-0 h-full rounded-full bg-[var(--color-primary)]/30"
                  style={{ left: `${loopMarker.left}%`, width: `${loopMarker.width}%` }}
                />
              )}
              {/*进度条填充*/}
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-[var(--color-primary)] transition-all duration-75"
                style={{ width: `${progressWidth}%` }}
              />
              {/*进度指示器 - 始终显示*/}
              <div
                className="pointer-events-none absolute top-1/2 -ml-2 h-4 w-4 -translate-y-1/2 rounded-full bg-[var(--color-primary)] shadow-[var(--shadow-md)] ring-2 ring-[var(--surface-card)] transition-transform group-hover:scale-110"
                style={{ left: `${progressWidth}%` }}
              />
            </div>
            {/*透明 range input 覆盖在上面*/}
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={(event) => onSeek(parseFloat(event.target.value))}
              className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
              aria-label="播放进度"
            />
          </div>

          <span className="min-w-[3rem] text-right text-sm font-mono tabular-nums text-[var(--text-secondary)]">
            {formatTime(duration || 0)}
          </span>
        </div>

        {/*控制按钮区域*/}
        <div className="flex items-center justify-between">
          {/*左侧：播放控制*/}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => onSkipBack?.()}
              disabled={!onSkipBack}
              className="btn-secondary !h-11 !w-11 !rounded-full !p-0"
              aria-label="后退10秒"
            >
              <span className="material-symbols-outlined text-xl">replay_10</span>
            </button>

            <button
              type="button"
              onClick={onTogglePlay}
              className="btn-primary !h-14 !w-14 !rounded-full !p-0"
              aria-label={isPlaying ? '暂停' : '播放'}
            >
              <span className="material-symbols-outlined text-3xl">
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSkipForward?.()}
              disabled={!onSkipForward}
              className="btn-secondary !h-11 !w-11 !rounded-full !p-0"
              aria-label="前进10秒"
            >
              <span className="material-symbols-outlined text-xl">forward_10</span>
            </button>

            {/*速度预设*/}
            <SpeedPresets value={playbackRate} onChange={onPlaybackRateChange} />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSetLoopStart}
              className={cn(
                'btn-secondary !h-9 !w-9 !rounded-full !p-0 text-xs font-bold',
                loopRange &&
                  '!border-[var(--color-primary)] !text-[var(--color-primary)]',
              )}
              aria-label="设置循环起点 A"
            >
              A
            </button>
            <button
              type="button"
              onClick={onSetLoopEnd}
              className={cn(
                'btn-secondary !h-9 !w-9 !rounded-full !p-0 text-xs font-bold',
                loopRange &&
                  '!border-[var(--color-primary)] !text-[var(--color-primary)]',
              )}
              aria-label="设置循环终点 B"
            >
              B
            </button>
            {loopRange && (
              <button
                type="button"
                onClick={onClearLoop}
                className="btn-secondary !h-9 !w-9 !rounded-full !p-0"
                aria-label="清除循环"
              >
                <span className="material-symbols-outlined text-lg">clear</span>
              </button>
            )}
            <button
              type="button"
              onClick={onToggleShadowingMode}
              className={cn(
                'btn-secondary !h-9 !w-9 !rounded-full !p-0',
                isShadowingMode && '!border-[var(--color-primary)] !text-[var(--color-primary)]',
              )}
              aria-label={isShadowingMode ? '关闭跟读模式' : '开启跟读模式'}
            >
              <span className="material-symbols-outlined text-lg">
                {isShadowingMode ? 'record_voice_over' : 'voice_selection'}
              </span>
            </button>
            {/*影子设置浮层挂载点（由 PlayerFooterContainer 注入）*/}
            {settingsSlot}
            {shadowingStatus && (
              <span
                data-testid="shadowing-status"
                className="text-xs font-mono tabular-nums text-[var(--color-primary)]"
              >
                {shadowingStatus}
              </span>
            )}
          </div>

          {/*右侧：音量控制*/}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onVolumeChange(volume === 0 ? 1 : 0)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
              aria-label={volume === 0 ? '取消静音' : '静音'}
            >
              <span className="material-symbols-outlined text-xl">
                {volume === 0 ? 'volume_off' : volume < 0.5 ? 'volume_down' : 'volume_up'}
              </span>
            </button>
            <div className="relative flex items-center">
              <div className="h-1.5 w-20 rounded-full bg-[var(--surface-muted)] sm:w-24">
                <div
                  className="h-full rounded-full bg-[var(--color-primary)]"
                  style={{ width: `${volumePercentage}%` }}
                />
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(event) => onVolumeChange(parseFloat(event.target.value))}
                className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
                aria-label="音量"
              />
            </div>
            <span className="w-10 text-right text-xs font-mono tabular-nums text-[var(--text-tertiary)]">
              {volumePercentage}%
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '00:00'
  const minutes = Math.floor(value / 60)
    .toString()
    .padStart(2, '0')
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, '0')
  return `${minutes}:${seconds}`
}
```

- [ ] **Step 4: Run test to verify it passes**
  - Run: `bunx vitest run src/components/features/player/__tests__/PlayerFooter.test.tsx`
  - Expected: PASS (4 tests green).

- [ ] **Step 5: Commit**

```bash
git add src/components/features/player/page/PlayerFooter.tsx src/components/features/player/__tests__/PlayerFooter.test.tsx
git commit -m "feat: footer speed presets, shadowing status, loop region marker"
```

---

### Task E.5: Host the `ShadowingSettings` popover in `PlayerFooterContainer`

`PlayerFooterContainer` was a pure passthrough. It now owns the popover open-state (opened by the footer's shadowing toggle) and injects the `ShadowingSettings` content into the footer's `settingsSlot`, wired to `onShadowingConfigChange`.

**Files:**
- Modify: `src/components/features/player/PlayerFooterContainer.tsx:1-33` (whole file)
- Test: `src/components/features/player/__tests__/PlayerFooterContainer.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/features/player/__tests__/PlayerFooterContainer.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SHADOWING_CONFIG } from '~/lib/player/shadowing-machine'
import PlayerFooterContainer from '../PlayerFooterContainer'

function props(overrides = {}) {
  return {
    currentTime: 0,
    duration: 100,
    isPlaying: false,
    onSeek: vi.fn(),
    onTogglePlay: vi.fn(),
    onSkipBack: vi.fn(),
    onSkipForward: vi.fn(),
    onClearLoop: vi.fn(),
    loopRange: null,
    playbackRate: 1,
    onPlaybackRateChange: vi.fn(),
    volume: 1,
    onVolumeChange: vi.fn(),
    onSetLoopStart: vi.fn(),
    onSetLoopEnd: vi.fn(),
    onToggleShadowingMode: vi.fn(),
    isShadowingMode: true,
    shadowing: {
      ...DEFAULT_SHADOWING_CONFIG,
      phase: 'idle' as const,
      activeIndex: -1,
      playsDone: 0,
      config: DEFAULT_SHADOWING_CONFIG,
    },
    onShadowingConfigChange: vi.fn(),
    ...overrides,
  }
}

describe('PlayerFooterContainer', () => {
  it('shows the settings popover when shadowing is on and the gear is opened', async () => {
    render(<PlayerFooterContainer {...props()} />)
    await userEvent.click(screen.getByRole('button', { name: '影子跟读设置' }))
    expect(screen.getByText('每句重复')).toBeInTheDocument()
  })

  it('forwards config changes from the popover', async () => {
    const onShadowingConfigChange = vi.fn()
    render(<PlayerFooterContainer {...props({ onShadowingConfigChange })} />)
    await userEvent.click(screen.getByRole('button', { name: '影子跟读设置' }))
    await userEvent.click(screen.getByRole('button', { name: '增加重复次数' }))
    expect(onShadowingConfigChange).toHaveBeenCalledWith({ repeatCount: 4 })
  })

  it('hides the gear when shadowing is off', () => {
    render(<PlayerFooterContainer {...props({ isShadowingMode: false })} />)
    expect(screen.queryByRole('button', { name: '影子跟读设置' })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
  - Run: `bunx vitest run src/components/features/player/__tests__/PlayerFooterContainer.test.tsx`
  - Expected: FAIL because the container is a passthrough with no gear button and props still typed as `audioPlayerState`.

- [ ] **Step 3: Write minimal implementation** — replace the entire `src/components/features/player/PlayerFooterContainer.tsx`:

```tsx
'use client'

import React, { useState } from 'react'
import { PlayerFooter } from '~/components/features/player/page/PlayerFooter'
import { ShadowingSettings } from '~/components/features/player/ShadowingSettings'
import type { ShadowingConfig, ShadowingState } from '~/lib/player/shadowing-machine'

interface PlayerFooterContainerProps {
  currentTime: number
  duration: number
  isPlaying: boolean
  onSeek: (time: number) => void
  onTogglePlay: () => void
  onSkipBack: () => void
  onSkipForward: () => void
  onClearLoop: () => void
  loopRange?: { start: number; end: number } | null
  playbackRate: number
  onPlaybackRateChange: (rate: number) => void
  volume: number
  onVolumeChange: (volume: number) => void
  onSetLoopStart: () => void
  onSetLoopEnd: () => void
  onToggleShadowingMode: () => void
  isShadowingMode: boolean
  shadowing: ShadowingState & { config: ShadowingConfig }
  onShadowingConfigChange: (patch: Partial<ShadowingConfig>) => void
}

const PlayerFooterContainer = React.memo<PlayerFooterContainerProps>((props) => {
  const [open, setOpen] = useState(false)

  const settingsSlot = props.isShadowingMode ? (
    <div className="relative">
      <button
        type="button"
        aria-label="影子跟读设置"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="btn-secondary !h-9 !w-9 !rounded-full !p-0"
      >
        <span className="material-symbols-outlined text-lg">tune</span>
      </button>
      {open && (
        <div className="absolute bottom-12 right-0 z-20 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-lg)]">
          <ShadowingSettings
            config={props.shadowing.config}
            onChange={props.onShadowingConfigChange}
          />
        </div>
      )}
    </div>
  ) : null

  return <PlayerFooter {...props} settingsSlot={settingsSlot} />
})

PlayerFooterContainer.displayName = 'PlayerFooterContainer'

export default PlayerFooterContainer
```

- [ ] **Step 4: Run test to verify it passes**
  - Run: `bunx vitest run src/components/features/player/__tests__/PlayerFooterContainer.test.tsx`
  - Expected: PASS (3 tests green).

- [ ] **Step 5: Commit**

```bash
git add src/components/features/player/PlayerFooterContainer.tsx src/components/features/player/__tests__/PlayerFooterContainer.test.tsx
git commit -m "feat: host ShadowingSettings popover in PlayerFooterContainer"
```

---

### Task E.6: `ScrollableSubtitleDisplay` consumes shared `activeIndex` + `currentTimeRef`

Drop the inline `findActiveSegmentIndexBinary` and the `currentTime` prop. The page now passes `activeIndex` (from `useActiveSegmentIndex`) as the single source of truth and `currentTimeRef` for word-level highlight reads. Per-word highlight subscribes to the ref via a lightweight rAF tick so karaoke still updates without re-rendering the whole tree on every frame.

**Files:**
- Modify: `src/components/features/player/ScrollableSubtitleDisplay.tsx:1-348` (props + active-index source + word highlight)
- Test: `src/components/features/player/__tests__/ScrollableSubtitleDisplay.test.tsx` (already in the repo — update it for the new props)

- [ ] **Step 1: Update the failing test** — replace the top of `src/components/features/player/__tests__/ScrollableSubtitleDisplay.test.tsx` (imports + `defaultProps`) so it drives the new prop shape. Replace lines 1-44 with:

```tsx
import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Segment } from '~/types/db/database'
import ScrollableSubtitleDisplay from '../ScrollableSubtitleDisplay'

const mockSegments: Segment[] = [
  {
    id: 1,
    transcriptId: 1,
    start: 0,
    end: 3,
    text: 'Hello world',
    wordTimestamps: [],
    normalizedText: 'Hello world',
    translation: '你好世界',
    annotations: [],
    furigana: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    transcriptId: 1,
    start: 3,
    end: 6,
    text: 'This is a test',
    wordTimestamps: [],
    normalizedText: 'This is a test',
    translation: '这是一个测试',
    annotations: [],
    furigana: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

describe('ScrollableSubtitleDisplay Component', () => {
  const defaultProps = {
    segments: mockSegments,
    activeIndex: 0,
    currentTimeRef: createRef<number>() as React.MutableRefObject<number>,
    isPlaying: false,
    onSegmentClick: vi.fn(),
  }

  beforeEach(() => {
    defaultProps.currentTimeRef.current = 0
    vi.clearAllMocks()
  })
```

Then replace the existing `'highlights current segment based on currentTime'` test body (originally at line 60) with an `activeIndex`-driven assertion. Find that `it(...)` block and replace it with:

```tsx
  it('highlights the segment indicated by activeIndex', () => {
    render(<ScrollableSubtitleDisplay {...defaultProps} activeIndex={1} />)
    const cards = screen.getAllByTestId('subtitle-card')
    expect(cards[1]).toHaveAttribute('data-active', 'true')
    expect(cards[0]).toHaveAttribute('data-active', 'false')
  })
```

(Leave the remaining tests in that file as-is; they pass `defaultProps` which now carries `activeIndex`/`currentTimeRef`.)

- [ ] **Step 2: Run test to verify it fails**
  - Run: `bunx vitest run src/components/features/player/__tests__/ScrollableSubtitleDisplay.test.tsx`
  - Expected: FAIL because the component still declares `currentTime` (not `activeIndex`/`currentTimeRef`) and computes its own binary-search index.

- [ ] **Step 3: Write minimal implementation** — edit `ScrollableSubtitleDisplay.tsx`.

(3a) Replace the props interface and the now-dead binary helper. Replace lines 1-13:

```tsx
'use client'

import React, { useEffect, useMemo, useRef } from 'react'
import { cn } from '~/lib/utils/utils'
import type { Segment } from '~/types/db/database'

interface ScrollableSubtitleDisplayProps {
  segments: Segment[]
  currentTime: number
  isPlaying: boolean
  onSegmentClick?: (segment: Segment) => void
  className?: string
}
```

with:

```tsx
'use client'

import type { MutableRefObject } from 'react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '~/lib/utils/utils'
import type { Segment } from '~/types/db/database'

interface ScrollableSubtitleDisplayProps {
  segments: Segment[]
  activeIndex: number
  currentTimeRef: MutableRefObject<number>
  isPlaying: boolean
  onSegmentClick?: (segment: Segment) => void
  className?: string
}
```

(3b) Delete the now-unused `findActiveSegmentIndexBinary` function — remove lines 38-56 (the entire `function findActiveSegmentIndexBinary(...) { ... }` block, including its preceding doc comment on lines 34-37):

```tsx
/**
 * 沿 DOM 树向上查找最近的可滚动祖先元素。
 * 用于判断字幕是否已经在滚动视口内可见。
 */
function findActiveSegmentIndexBinary(segments: Segment[], currentTime: number): number {
  let left = 0
  let right = segments.length - 1

  while (left <= right) {
    const mid = (left + right) >> 1
    const segment = segments[mid]
    if (currentTime >= segment.start && currentTime <= segment.end) {
      return mid
    }
    if (currentTime < segment.start) {
      right = mid - 1
    } else {
      left = mid + 1
    }
  }

  return -1
}
```

(leave `findScrollParent` and `normalizeFurigana` intact).

(3c) Replace the component signature and the `safeCurrentTime` / `activeIndex` derivation. Replace lines 128-140 (`const ScrollableSubtitleDisplay = React.memo<...>(` through the `activeIndex` `useMemo` block):

```tsx
const ScrollableSubtitleDisplay = React.memo<ScrollableSubtitleDisplayProps>(
  ({ segments, currentTime, isPlaying, onSegmentClick, className }) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const activeSegmentRef = useRef<HTMLButtonElement>(null)
    const previousActiveIndex = useRef<number>(-1)
    const scrollTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

    const safeCurrentTime =
      Number.isFinite(currentTime) && !Number.isNaN(currentTime) ? currentTime : 0

    const activeIndex = useMemo(() => {
      return findActiveSegmentIndexBinary(segments, safeCurrentTime)
    }, [segments, safeCurrentTime])
```

with:

```tsx
const ScrollableSubtitleDisplay = React.memo<ScrollableSubtitleDisplayProps>(
  ({ segments, activeIndex, currentTimeRef, isPlaying, onSegmentClick, className }) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const activeSegmentRef = useRef<HTMLButtonElement>(null)
    const previousActiveIndex = useRef<number>(-1)
    const scrollTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

    // 逐词高亮需要帧级时间但不能让整棵树每帧重渲染：只在播放时跑一个
    // 轻量 rAF，把 currentTimeRef 的读数拷进一个本地 state（节流到帧）。
    const [wordTime, setWordTime] = useState(0)
    useEffect(() => {
      if (!isPlaying) {
        setWordTime(currentTimeRef.current)
        return
      }
      let raf = 0
      const tick = () => {
        setWordTime(currentTimeRef.current)
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
      return () => cancelAnimationFrame(raf)
    }, [isPlaying, currentTimeRef])

    const safeCurrentTime =
      Number.isFinite(wordTime) && !Number.isNaN(wordTime) ? wordTime : 0
```

This keeps `safeCurrentTime` as the per-word highlight clock (used at lines 291-292) while `activeIndex` is now the shared prop. No other line in the JSX references `currentTime` directly, so the rest of the file is unchanged.

- [ ] **Step 4: Run test to verify it passes**
  - Run: `bunx vitest run src/components/features/player/__tests__/ScrollableSubtitleDisplay.test.tsx`
  - Expected: PASS (all tests in the file green).

- [ ] **Step 5: Commit**

```bash
git add src/components/features/player/ScrollableSubtitleDisplay.tsx src/components/features/player/__tests__/ScrollableSubtitleDisplay.test.tsx
git commit -m "refactor: ScrollableSubtitleDisplay consumes shared activeIndex + currentTimeRef"
```

---

### Task E.7: Generalize `useKeyboardControls` and wire it into `PlayerPage`

Rebind to the contract: Space=togglePlay, ArrowLeft/Right=prev/next line, R=replayLine, `[`/`]`=slower/faster footer preset, S=toggleShadowing. Disable when an input/textarea (or contentEditable) is focused.

**Files:**
- Modify: `src/hooks/ui/useKeyboardControls.ts:1-60` (whole file)
- Modify: `src/components/features/player/PlayerPage.tsx` (add the hook call in the component body)
- Test: `src/hooks/ui/__tests__/useKeyboardControls.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/ui/__tests__/useKeyboardControls.test.ts`:

```ts
import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useKeyboardControls } from '../useKeyboardControls'

function press(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}

function handlers() {
  return {
    enabled: true,
    onTogglePlay: vi.fn(),
    onPrevLine: vi.fn(),
    onNextLine: vi.fn(),
    onReplayLine: vi.fn(),
    onSlower: vi.fn(),
    onFaster: vi.fn(),
    onToggleShadowing: vi.fn(),
  }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('useKeyboardControls', () => {
  it('maps each key to its action', () => {
    const h = handlers()
    renderHook(() => useKeyboardControls(h))

    press(' ')
    expect(h.onTogglePlay).toHaveBeenCalledTimes(1)
    press('ArrowLeft')
    expect(h.onPrevLine).toHaveBeenCalledTimes(1)
    press('ArrowRight')
    expect(h.onNextLine).toHaveBeenCalledTimes(1)
    press('r')
    expect(h.onReplayLine).toHaveBeenCalledTimes(1)
    press('[')
    expect(h.onSlower).toHaveBeenCalledTimes(1)
    press(']')
    expect(h.onFaster).toHaveBeenCalledTimes(1)
    press('s')
    expect(h.onToggleShadowing).toHaveBeenCalledTimes(1)
  })

  it('does nothing when disabled', () => {
    const h = { ...handlers(), enabled: false }
    renderHook(() => useKeyboardControls(h))
    press(' ')
    expect(h.onTogglePlay).not.toHaveBeenCalled()
  })

  it('ignores keys while an input is focused', () => {
    const h = handlers()
    renderHook(() => useKeyboardControls(h))
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    input.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    expect(h.onTogglePlay).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**
  - Run: `bunx vitest run src/hooks/ui/__tests__/useKeyboardControls.test.ts`
  - Expected: FAIL because the hook's current signature is `{ audioUrl, onPlayPause, onSkipBack, onSkipForward, onToggleMute, onSetPlaybackRate }` — none of the new handlers exist.

- [ ] **Step 3: Write minimal implementation** — replace the entire `src/hooks/ui/useKeyboardControls.ts`:

```ts
import { useCallback, useEffect } from 'react'

interface UseKeyboardControlsProps {
  enabled: boolean
  onTogglePlay: () => void
  onPrevLine: () => void
  onNextLine: () => void
  onReplayLine: () => void
  onSlower: () => void
  onFaster: () => void
  onToggleShadowing: () => void
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  )
}

export function useKeyboardControls({
  enabled,
  onTogglePlay,
  onPrevLine,
  onNextLine,
  onReplayLine,
  onSlower,
  onFaster,
  onToggleShadowing,
}: UseKeyboardControlsProps) {
  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return
      if (isEditableTarget(event.target)) return

      switch (event.key.toLowerCase()) {
        case ' ':
          event.preventDefault()
          onTogglePlay()
          break
        case 'arrowleft':
          event.preventDefault()
          onPrevLine()
          break
        case 'arrowright':
          event.preventDefault()
          onNextLine()
          break
        case 'r':
          event.preventDefault()
          onReplayLine()
          break
        case '[':
          event.preventDefault()
          onSlower()
          break
        case ']':
          event.preventDefault()
          onFaster()
          break
        case 's':
          event.preventDefault()
          onToggleShadowing()
          break
      }
    },
    [enabled, onTogglePlay, onPrevLine, onNextLine, onReplayLine, onSlower, onFaster, onToggleShadowing],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [handleKeyPress])
}
```

- [ ] **Step 4: Run hook test to verify it passes**
  - Run: `bunx vitest run src/hooks/ui/__tests__/useKeyboardControls.test.ts`
  - Expected: PASS (3 tests green).

- [ ] **Step 5: Wire the hook into `PlayerPage`** — in `src/components/features/player/PlayerPage.tsx`, add the prev/next line helpers and the hook call immediately after the `handleVolumeChange` callback added in Task E.3 Step 2 (right before the `const layoutFooter = ...` line). The footer-preset slower/faster mirrors `SPEED_PRESETS = [0.75, 1, 1.25]`:

```tsx
  const FOOTER_RATES = [0.75, 1, 1.25]

  const stepRate = useCallback(
    (dir: -1 | 1) => {
      const idx = FOOTER_RATES.findIndex((r) => Math.abs(r - controller.playbackRate) < 0.001)
      const base = idx === -1 ? 1 : idx
      const next = Math.min(FOOTER_RATES.length - 1, Math.max(0, base + dir))
      controller.setPlaybackRate(FOOTER_RATES[next])
    },
    [controller],
  )

  const goToLine = useCallback(
    (dir: -1 | 1) => {
      const current = controller.activeIndex < 0 ? 0 : controller.activeIndex
      const next = Math.min(segments.length - 1, Math.max(0, current + dir))
      if (segments[next]) controller.playLine(next)
    },
    [controller, segments],
  )

  useKeyboardControls({
    enabled: Boolean(audioUrl),
    onTogglePlay: controller.togglePlay,
    onPrevLine: () => goToLine(-1),
    onNextLine: () => goToLine(1),
    onReplayLine: controller.replayLine,
    onSlower: () => stepRate(-1),
    onFaster: () => stepRate(1),
    onToggleShadowing: controller.toggleShadowing,
  })
```

- [ ] **Step 6: Run type-check to verify PlayerPage integration compiles**
  - Run: `bun run type-check`
  - Expected: PASS — `PlayerPage.tsx`, `PlayerFooter.tsx`, `PlayerFooterContainer.tsx`, `ScrollableSubtitleDisplay.tsx`, `useKeyboardControls.ts` all compile together. (This is the first fully-green checkpoint for the page graph after E.3.)

- [ ] **Step 7: Commit**

```bash
git add src/hooks/ui/useKeyboardControls.ts src/hooks/ui/__tests__/useKeyboardControls.test.ts src/components/features/player/PlayerPage.tsx
git commit -m "feat: rebind useKeyboardControls (space/arrows/R/[]/S) and wire into PlayerPage"
```

---

### Task E.8: Delete the orphan audio stack

`PlayerStatusBanner` rendering already landed in Task E.3 Step 4. With `PlayerPage` off `useAudioPlayer`/`useShadowingMode` and the footer off `AudioPlayer`/`VolumeControl`/`PlaybackSpeedControl`, the entire orphan stack has no live importers. `useAudioPlayerTime.formatTime` was only consumed by `AudioPlayer.tsx` (the footer and `ScrollableSubtitleDisplay` each have their own local `formatTime`), so no migration is needed — delete it outright.

**Files:**
- Delete: `src/components/features/player/AudioPlayer.tsx`
- Delete: `src/components/features/player/AudioControls.tsx`
- Delete: `src/components/features/player/VolumeControl.tsx`
- Delete: `src/components/features/player/PlaybackSpeedControl.tsx`
- Delete: `src/hooks/ui/useAudioPlayerState.ts`
- Delete: `src/hooks/ui/useAudioPlayerTime.ts`
- Delete: `src/hooks/ui/useAudioPlayer.ts`
- Delete: `src/hooks/player/useShadowingMode.ts`
- Delete: `src/hooks/ui/__tests__/useAudioPlayer.test.ts`
- Delete: `src/hooks/player/__tests__/useShadowingMode.test.ts`
- Modify: `src/hooks/index.ts:1-9`

- [ ] **Step 1: Grep-confirm there are no remaining importers** (the orphan files may still reference each other; that is fine since they all go together).

```bash
grep -rn "AudioPlayer\b\|AudioControls\|VolumeControl\|PlaybackSpeedControl\|useAudioPlayerState\|useAudioPlayerTime\|useAudioPlayer\b\|UseAudioPlayerReturn\|useShadowingMode" src --include='*.ts' --include='*.tsx' \
  | grep -v 'src/components/features/player/AudioPlayer.tsx' \
  | grep -v 'src/components/features/player/AudioControls.tsx' \
  | grep -v 'src/components/features/player/VolumeControl.tsx' \
  | grep -v 'src/components/features/player/PlaybackSpeedControl.tsx' \
  | grep -v 'src/hooks/ui/useAudioPlayerState.ts' \
  | grep -v 'src/hooks/ui/useAudioPlayerTime.ts' \
  | grep -v 'src/hooks/ui/useAudioPlayer.ts' \
  | grep -v 'src/hooks/player/useShadowingMode.ts' \
  | grep -v 'src/hooks/ui/__tests__/useAudioPlayer.test.ts' \
  | grep -v 'src/hooks/player/__tests__/useShadowingMode.test.ts'
```

  - Expected output: exactly one line — `src/hooks/index.ts` re-exporting `useAudioPlayer` / `UseAudioPlayerReturn` (handled in Step 3). If any other file appears, STOP and fix that importer before deleting.

- [ ] **Step 2: Delete the orphan files**

```bash
git rm src/components/features/player/AudioPlayer.tsx \
       src/components/features/player/AudioControls.tsx \
       src/components/features/player/VolumeControl.tsx \
       src/components/features/player/PlaybackSpeedControl.tsx \
       src/hooks/ui/useAudioPlayerState.ts \
       src/hooks/ui/useAudioPlayerTime.ts \
       src/hooks/ui/useAudioPlayer.ts \
       src/hooks/player/useShadowingMode.ts \
       src/hooks/ui/__tests__/useAudioPlayer.test.ts \
       src/hooks/player/__tests__/useShadowingMode.test.ts
```

- [ ] **Step 3: Remove the dead re-exports from `src/hooks/index.ts`** — replace the whole file:

```ts
// Simplifiedhook导出

export { useApiMonitoring } from './api/useApiMonitoring'
export { useTranscription } from './api/useTranscription'
export type { UseFilesReturn } from './db/useFiles'
export { filesKeys, useFiles } from './db/useFiles'
```

- [ ] **Step 4: Verify the tree still type-checks with the orphans gone**
  - Run: `bun run type-check`
  - Expected: PASS — 0 errors, confirming nothing else imported the deleted modules.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/index.ts
git commit -m "chore: delete orphan audio stack (AudioPlayer/AudioControls/VolumeControl/PlaybackSpeedControl + useAudioPlayer/useAudioPlayerState/useAudioPlayerTime/useShadowingMode)"
```

(The `git rm` from Step 2 is already staged; this commit captures both the deletions and the `hooks/index.ts` edit.)

---

### Task E.9: Full regression — suite, type-check, build

No code changes; this is the green-gate before the manual checklist. If anything fails, fix it under TDD before proceeding (write/repair a failing test first).

- [ ] **Step 1: Run the full test suite**
  - Run: `bun run test:run`
  - Expected: PASS — all suites green, including the new `SpeedPresets`, `ShadowingSettings`, `PlayerFooter`, `PlayerFooterContainer`, `useKeyboardControls`, and the updated `ScrollableSubtitleDisplay` and `PlayerPage.listeners` tests. Zero failures, zero unhandled errors.

- [ ] **Step 2: Type-check**
  - Run: `bun run type-check`
  - Expected: PASS — 0 errors.

- [ ] **Step 3: Production build**
  - Run: `bun run build`
  - Expected: PASS — build completes with no errors (the Phase A `card-base` fix keeps the Tailwind v4 build green).

- [ ] **Step 4: Commit** (only if Steps 1-3 surfaced a fix; otherwise skip — nothing to commit)

```bash
git add -p
git commit -m "test: stabilize player suite after shadowing UI integration"
```

---

### Task E.10: Manual verification of the shadowing loop

Run the app and confirm the end-to-end behavior the automated tests cannot fully cover (real `<audio>`, rAF, gap timers). This is a manual checklist, not a code change.

- [ ] **Step 1: Start the dev server**
  - Run: `bun run dev`
  - Expected: server up at `http://localhost:3000`.

- [ ] **Step 2: Open a transcribed file** — navigate to `/player/<fileId>` for a file that already has segments. Confirm:
  - The `PlayerStatusBanner` is absent once `transcript.status === 'completed'` (and shows the transcribing banner while a fresh file is still processing).
  - Clicking a subtitle line seeks to and plays that line; the active line highlights and auto-scrolls.

- [ ] **Step 3: Shadowing loop (listen -> gap -> repeat 3x -> advance)** — click the shadowing toggle (`record_voice_over` icon turns primary), then play. Confirm:
  - Footer status reads `第 1/3 遍 · 听` while the current line plays.
  - At end-of-line it pauses for the gap and reads `第 1/3 遍 · 留白`.
  - It replays the same line and advances the counter to `第 2/3 遍`, then `第 3/3 遍`.
  - After the 3rd repeat it auto-advances to the next line and resets to `第 1/3 遍 · 听`.

- [ ] **Step 4: Slow practice rate (LISTENING only)** — open the gear popover, set 练习语速 to `0.5x`. Confirm:
  - During the LISTENING phase the audio is audibly slower.
  - With shadowing OFF, playback uses the footer preset (`0.75/1/1.25`), not `practiceRate` — toggle shadowing off and verify the footer speed governs.

- [ ] **Step 5: Click-to-loop a line (manual A/B region marker)** — press `A` then `B` on the current line (or use the footer A/B buttons). Confirm a translucent region marker is drawn on the progress bar at the line's `[start, end]`, and the line loops; pressing the clear (`clear`) button removes the marker.

- [ ] **Step 6: Keyboard shortcuts** — with focus on the page (not an input):
  - `Space` toggles play/pause.
  - `←` / `→` jump to previous / next line.
  - `R` replays the current line.
  - `[` / `]` step the footer speed preset down / up (`0.75 -> 1 -> 1.25`).
  - `S` toggles shadowing.
  - Focus a text input (e.g. a search box if present) and confirm the shortcuts are suppressed while typing.

- [ ] **Step 7: Settings persistence** — change repeat count / gap / practice rate, reload the page, and confirm the popover reflects the persisted `ShadowingConfig` (localStorage key `shadowing-config`).

- [ ] **Step 8: Final confirmation** — all checklist items pass. Phase E (and the shadowing feature) is complete. No commit for this task.

**✅ E done when:** Run `bun run test:run` (all suites green, including new SpeedPresets/ShadowingSettings/PlayerFooter/PlayerFooterContainer/useKeyboardControls tests and the rewired ScrollableSubtitleDisplay + PlayerPage.listeners), `bun run type-check` (0 errors — confirms PlayerPage/PlayerFooter/PlayerFooterContainer compile against the locked PlaybackController shape and that the deleted orphan modules have no dangling importers), and `bun run build` (succeeds with the Phase A card-base fix). Then run the manual shadowing checklist in Task E.10 against `bun run dev` at /player/<fileId>.

> **Phase Z notes:** Sequencing risk: Task E.3 (PlayerPage swap) leaves the page graph type-red until E.4 (footer), E.5 (container), and E.6 (subtitles) land — the plan flags this in E.3 Step 5 and provides the first fully-green type-check checkpoint at E.6 Step 6. An executor that wants a green commit at every step should defer the E.3 commit until after E.6; otherwise commit E.3 with the documented expectation.

Assumptions grounded in the read source: (1) `usePlayerDataQuery` returns `transcript` with `.status` but no explicit `isTranscribing`/progress — the plan derives `isTranscribing` from `transcript.status` ('processing'|'pending') and renders `PlayerStatusBanner` with `transcript` + `isTranscribing` only (the banner's `transcriptionProgress` is optional). (2) `useAudioPlayerTime.formatTime` is referenced ONLY by `AudioPlayer.tsx` (grep-confirmed); both `PlayerFooter` and `ScrollableSubtitleDisplay` carry their own local `formatTime`, so E.8 deletes `useAudioPlayerTime` outright with no migration — this resolves the spec's conditional "(若 formatTime 仍被用则迁到 lib/utils)" to "not used, delete". (3) `src/hooks/index.ts` re-exports `useAudioPlayer`/`UseAudioPlayerReturn`; E.8 Step 1's grep expects exactly that one residual line and Step 3 removes it.

Cross-phase dependencies: E consumes Phase D's `usePlaybackController` (args `{ audioRef, segments }`) and `useActiveSegmentIndex(segments, currentTimeRef)`, and Phase C's `ShadowingConfig`/`DEFAULT_SHADOWING_CONFIG`/`ShadowingState`. The footer's shadowing-status math uses `shadowing.playsDone + 1` over `shadowing.config.repeatCount`, matching the FSM semantics (playsDone is completed-plays count). UI mapping verbatim: footer presets 0.75/1/1.25; popover gap 短/中/长 -> 0.6/1.0/1.6; practiceRate 0.5/0.75/1; localStorage key 'shadowing-config' is owned by the controller (Phase D), surfaced here only via the popover.

The old `PlayerPage.listeners.test.tsx` and `ScrollableSubtitleDisplay.test.tsx` are in the repo (modified in the WIP tree); E.6 updates the subtitle test for the new prop shape. If `PlayerPage.listeners.test.tsx` asserts on the deleted timeupdate/seek effects it will need follow-up in E.9 Step 4 — flagged there as a TDD fix gate.
