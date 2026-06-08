# Phase 1: Bun Runtime + Directory Structure + Tailwind v4 Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the project from pnpm/Node to Bun runtime, restructure directories to match tanstack-bun-stack conventions, upgrade Tailwind v3→v4, switch from Vitest to `bun test`, and update all config files.

**Architecture:** This is a pure infrastructure migration — no component logic changes. The app remains a TanStack Start SPA with Dexie client-side storage. We swap the runtime, reorganize paths, and modernize the CSS toolchain.

**Tech Stack:** Bun runtime, TanStack Start + Vite, Tailwind v4 + `@tailwindcss/vite`, Biome, `bun test`

---

## File Structure

### Files to Create
- `src/styles/app.css` — new CSS entry (replaces `globals.css` with Tailwind v4 `@import` + `@theme`)

### Files to Modify
- `package.json` — remove engines/packageManager, update scripts, update deps
- `vite.config.ts` — change alias `@` → `~`, routesDirectory `app` → `routes`, add `@tailwindcss/vite`, remove `@vitejs/plugin-react`
- `tsconfig.json` — change path alias `@/*` → `~/*`, add `verbatimModuleSyntax`, remove `allowJs`
- `biome.json` — update to canonical format per SKILL.md
- `Dockerfile` — rewrite for Bun
- `.env.example` — update VITE_ env comments

### Files to Delete
- `tailwind.config.ts`
- `postcss.config.js`
- `vitest.config.ts`
- `src/__tests__/setup.ts`
- `pnpm-lock.yaml`
- `.husky/` (entire directory)

### Files to Move
- `src/app/__root.tsx` → `src/routes/__root.tsx`
- `src/app/index.tsx` → `src/routes/index.tsx`
- `src/app/settings.tsx` → `src/routes/settings.tsx`
- `src/app/account.tsx` → `src/routes/account.tsx`
- `src/app/player.$fileId.tsx` → `src/routes/player.$fileId.tsx`
- `src/app/api/health.ts` → `src/routes/api/health.ts`
- `src/app/api/transcribe.ts` → `src/routes/api/transcribe.ts`
- `src/app/api/postprocess.ts` → `src/routes/api/postprocess.ts`
- `src/app/api/performance.ts` → `src/routes/api/performance.ts`
- `src/styles/globals.css` → delete (replaced by `app.css`)

### Global Replace
- All 81 source files: `@/` → `~/` in import paths

---

## Task 1: Delete obsolete config files and husky

**Files:**
- Delete: `tailwind.config.ts`
- Delete: `postcss.config.js`
- Delete: `vitest.config.ts`
- Delete: `.husky/` (entire directory)

- [ ] **Step 1: Delete the files**

```bash
rm tailwind.config.ts postcss.config.js vitest.config.ts
rm -rf .husky
```

- [ ] **Step 2: Verify files are gone**

Run: `ls tailwind.config.ts postcss.config.js vitest.config.ts .husky 2>&1`
Expected: "No such file or directory" for all four

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove tailwind.config, postcss.config, vitest.config, and husky"
```

---

## Task 2: Update package.json for Bun runtime

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Replace the entire package.json**

The full replacement removes `engines`, removes `packageManager`, updates all scripts for Bun, removes obsolete devDeps, and upgrades tailwindcss to v4.

```json
{
  "name": "shadowing-learning",
  "version": "1.0.0",
  "description": "A language learning application focused on shadowing practice with AI-powered audio transcription",
  "type": "module",
  "private": false,
  "scripts": {
    "dev": "bun run --bun vite dev",
    "build": "bun run --bun vite build",
    "start": "bun run .output/server/index.mjs",
    "preview": "bun run --bun vite preview",
    "lint": "biome check .",
    "format": "biome format . --write",
    "type-check": "bun run --bun tsc --noEmit",
    "test": "bun test",
    "test:run": "bun test",
    "clean": "rm -rf .output dist node_modules/.cache"
  },
  "keywords": [
    "language-learning",
    "shadowing",
    "speech-recognition",
    "transcription",
    "audio-processing",
    "ai",
    "groq",
    "whisper",
    "react",
    "typescript",
    "education",
    "japanese",
    "english"
  ],
  "author": "Shadowing Learning Team",
  "license": "MIT",
  "dependencies": {
    "@radix-ui/react-collapsible": "^1.1.12",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-dropdown-menu": "^2.1.16",
    "@radix-ui/react-label": "^2.1.8",
    "@radix-ui/react-progress": "^1.1.8",
    "@radix-ui/react-select": "^2.2.6",
    "@radix-ui/react-separator": "^1.1.8",
    "@radix-ui/react-slider": "^1.3.6",
    "@radix-ui/react-slot": "^1.2.4",
    "@radix-ui/react-switch": "^1.2.6",
    "@radix-ui/react-tabs": "^1.1.13",
    "@radix-ui/react-tooltip": "^1.2.8",
    "@tanstack/react-query": "^5.100.7",
    "@tanstack/react-query-devtools": "^5.100.7",
    "@tanstack/react-router": "^1.169.2",
    "@tanstack/react-start": "^1.167.65",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "dexie": "^4.4.2",
    "groq-sdk": "^0.37.0",
    "isomorphic-dompurify": "^3.11.0",
    "lucide-react": "^0.556.0",
    "react": "^19.2.5",
    "react-dom": "^19.2.5",
    "react-error-boundary": "^6.1.1",
    "sonner": "2.0.7",
    "tailwind-merge": "^3.5.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "zod": "^4.4.1"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.4.13",
    "@types/bun": "^1.2.0",
    "@types/node": "24.10.1",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "typescript": "^5.9.3",
    "vite": "^8.0.12"
  }
}
```

Key changes:
- Removed `engines` (Node/pnpm constraints)
- Removed `packageManager` field
- Removed `"prepare": "husky"` script
- Scripts use `bun run --bun` prefix where needed; `test` → `bun test`
- Removed devDeps: `@testing-library/jest-dom`, `@testing-library/react`, `@testing-library/user-event`, `@vitejs/plugin-react`, `@vitest/coverage-v8`, `autoprefixer`, `fake-indexeddb`, `husky`, `jsdom`, `postcss`, `tailwindcss` 3.4.0, `vitest`
- Added deps: `tailwindcss` ^4.0.0, `@tailwindcss/vite` ^4.0.0
- Added devDep: `@types/bun`
- Moved `nextjs` keyword → `react` in keywords array

- [ ] **Step 2: Verify JSON is valid**

Run: `bun run --bun node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('valid')"`
Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: update package.json for Bun runtime and Tailwind v4"
```

---

## Task 3: Install dependencies with Bun

**Files:**
- Delete: `pnpm-lock.yaml`
- Create: `bun.lock` (auto-generated)

- [ ] **Step 1: Remove old lockfile**

```bash
rm -f pnpm-lock.yaml bun.lock
```

- [ ] **Step 2: Install with Bun**

```bash
bun install
```

Expected: `bun.lock` file created, no errors.

- [ ] **Step 3: Verify key packages installed**

Run: `bun pm ls 2>/dev/null | head -5`
Expected: Packages listed without errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: switch from pnpm-lock.yaml to bun.lock"
```

---

## Task 4: Update vite.config.ts

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Replace vite.config.ts**

```typescript
import { defineConfig } from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import tailwindcss from "@tailwindcss/vite"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "~": resolve(__dirname, "./src"),
    },
  },
  plugins: [
    tanstackStart({
      srcDirectory: "src",
      router: {
        routesDirectory: "routes",
      },
    }),
    tailwindcss(),
  ],
})
```

Key changes:
- Removed `import viteReact from "@vitejs/plugin-react"` (Bun handles React natively)
- Added `import tailwindcss from "@tailwindcss/vite"`
- Changed alias `"@"` → `"~"`
- Changed `routesDirectory: "app"` → `"routes"`
- Replaced `viteReact()` plugin with `tailwindcss()`

- [ ] **Step 2: Commit**

```bash
git add vite.config.ts
git commit -m "chore: update vite.config for Bun, Tailwind v4, and routes dir"
```

---

## Task 5: Update tsconfig.json

**Files:**
- Modify: `tsconfig.json`

- [ ] **Step 1: Replace tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "es2022",
    "lib": ["dom", "dom.iterable", "es6", "webworker"],
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "jsx": "react-jsx",
    "incremental": true,
    "downlevelIteration": true,
    "types": ["bun-types"],
    "baseUrl": ".",
    "paths": {
      "~/*": ["./src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules", ".output", "dist"]
}
```

Key changes:
- Removed `"allowJs": true`
- Added `"verbatimModuleSyntax": true`
- Changed path alias `"@/*"` → `"~/*"`
- Added `"types": ["bun-types"]`

- [ ] **Step 2: Commit**

```bash
git add tsconfig.json
git commit -m "chore: update tsconfig with ~ alias, verbatimModuleSyntax, bun-types"
```

---

## Task 6: Move route files from src/app/ to src/routes/

**Files:**
- Move: `src/app/__root.tsx` → `src/routes/__root.tsx`
- Move: `src/app/index.tsx` → `src/routes/index.tsx`
- Move: `src/app/settings.tsx` → `src/routes/settings.tsx`
- Move: `src/app/account.tsx` → `src/routes/account.tsx`
- Move: `src/app/player.$fileId.tsx` → `src/routes/player.$fileId.tsx`
- Move: `src/app/api/health.ts` → `src/routes/api/health.ts`
- Move: `src/app/api/transcribe.ts` → `src/routes/api/transcribe.ts`
- Move: `src/app/api/postprocess.ts` → `src/routes/api/postprocess.ts`
- Move: `src/app/api/performance.ts` → `src/routes/api/performance.ts`

- [ ] **Step 1: Create target directory and move files**

```bash
mkdir -p src/routes/api
mv src/app/__root.tsx src/routes/__root.tsx
mv src/app/index.tsx src/routes/index.tsx
mv src/app/settings.tsx src/routes/settings.tsx
mv src/app/account.tsx src/routes/account.tsx
mv src/app/player.\$fileId.tsx src/routes/player.\$fileId.tsx
mv src/app/api/health.ts src/routes/api/health.ts
mv src/app/api/transcribe.ts src/routes/api/transcribe.ts
mv src/app/api/postprocess.ts src/routes/api/postprocess.ts
mv src/app/api/performance.ts src/routes/api/performance.ts
```

- [ ] **Step 2: Remove empty src/app/ directory**

```bash
rm -rf src/app
```

- [ ] **Step 3: Verify the new structure**

Run: `find src/routes -type f | sort`
Expected:
```
src/routes/__root.tsx
src/routes/account.tsx
src/routes/api/health.ts
src/routes/api/performance.ts
src/routes/api/postprocess.ts
src/routes/api/transcribe.ts
src/routes/index.tsx
src/routes/player.$fileId.tsx
src/routes/settings.tsx
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move src/app/ to src/routes/ per tanstack-bun-stack convention"
```

---

## Task 7: Global replace @/ → ~/ in all import paths

**Files:**
- Modify: All 81 source files containing `@/` imports

- [ ] **Step 1: Perform global find-and-replace**

```bash
find src/ -type f \( -name '*.ts' -o -name '*.tsx' \) -exec sed -i '' 's|@/|~/|g' {} +
```

This replaces every occurrence of `@/` with `~/` in all TypeScript/TSX files under `src/`.

- [ ] **Step 2: Verify no remaining @/ imports**

Run: `grep -r '@/' src/ --include='*.ts' --include='*.tsx' | head -5`
Expected: No output (no matches).

- [ ] **Step 3: Verify ~/ imports exist**

Run: `grep -rl '~/' src/ --include='*.ts' --include='*.tsx' | wc -l`
Expected: ~81 files.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: replace all @/ imports with ~/ path alias"
```

---

## Task 8: Update CSS import in __root.tsx

**Files:**
- Modify: `src/routes/__root.tsx`

- [ ] **Step 1: Update the CSS import**

In `src/routes/__root.tsx`, change the CSS import on line 2 from:

```typescript
import appCss from "../styles/globals.css?url";
```

to:

```typescript
import appCss from "~/styles/app.css?url"
```

This changes both the path (globals.css → app.css) and the alias (@/ → ~/). Note: the relative path works because `__root.tsx` is in `src/routes/` and the CSS is in `src/styles/`, so `../styles/app.css` would also work, but using the `~/` alias is consistent.

- [ ] **Step 2: Commit**

```bash
git add src/routes/__root.tsx
git commit -m "refactor: update CSS import path in __root.tsx"
```

---

## Task 9: Create new src/styles/app.css with Tailwind v4

**Files:**
- Create: `src/styles/app.css`
- Delete: `src/styles/globals.css`

This is the largest task. The new `app.css` replaces the old `globals.css`. The key changes are:
1. Replace `@tailwind base/components/utilities` with `@import "tailwindcss";`
2. Add a `@theme {}` block that maps all the values from the old `tailwind.config.ts`
3. Keep all existing CSS variable definitions in `@layer base` untouched
4. Keep all component styles in `@layer components` untouched

- [ ] **Step 1: Create src/styles/app.css**

```css
@import "tailwindcss";

@theme {
  --color-brand-50: var(--brand-50);
  --color-brand-100: var(--brand-100);
  --color-brand-200: var(--brand-200);
  --color-brand-300: var(--brand-300);
  --color-brand-400: var(--brand-400);
  --color-brand-500: var(--brand-500);
  --color-brand-600: var(--brand-600);
  --color-brand-700: var(--brand-700);
  --color-brand-800: var(--brand-800);
  --color-brand-900: var(--brand-900);

  --color-primary: var(--color-primary);
  --color-primary-hover: var(--color-primary-hover);
  --color-primary-active: var(--color-primary-active);

  --color-success: var(--state-success-text);
  --color-success-surface: var(--state-success-surface);
  --color-success-border: var(--state-success-border);
  --color-success-strong: var(--state-success-strong);

  --color-warning: var(--state-warning-text);
  --color-warning-surface: var(--state-warning-surface);
  --color-warning-border: var(--state-warning-border);
  --color-warning-strong: var(--state-warning-strong);

  --color-error: var(--state-error-text);
  --color-error-surface: var(--state-error-surface);
  --color-error-border: var(--state-error-border);
  --color-error-strong: var(--state-error-strong);

  --color-info: var(--state-info-text);
  --color-info-surface: var(--state-info-surface);
  --color-info-border: var(--state-info-border);
  --color-info-strong: var(--state-info-strong);

  --color-background: var(--bg-primary);
  --color-background-secondary: var(--bg-secondary);
  --color-background-tertiary: var(--bg-tertiary);
  --color-background-surface: var(--bg-surface);
  --color-background-inverse: var(--bg-inverse);

  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-text-tertiary: var(--text-tertiary);
  --color-text-muted: var(--text-muted);
  --color-text-inverse: var(--text-inverse);

  --color-border: var(--border-primary);
  --color-border-secondary: var(--border-secondary);
  --color-border-muted: var(--border-muted);
  --color-border-focus: var(--border-focus);
  --color-border-error: var(--border-error);

  --color-surface: var(--surface-card);
  --color-surface-base: var(--surface-base);
  --color-surface-muted: var(--surface-muted);
  --color-surface-inverse: var(--surface-inverse);

  --color-player-accent: var(--player-accent-color);
  --color-player-highlight: var(--player-highlight-bg);
  --color-player-track: var(--player-track-color);
  --color-player-thumb-fill: var(--player-thumb-fill);
  --color-player-thumb-border: var(--player-thumb-border);
  --color-player-hover: var(--player-hover-indicator);
  --color-player-tooltip: var(--player-tooltip-text);

  --spacing-card-sm: var(--space-card-padding-sm);
  --spacing-card-lg: var(--space-card-padding-lg);
  --spacing-section: var(--space-section-gap);

  --radius-card: var(--radius-card);
  --radius-card-lg: var(--radius-card-large);
  --radius-control: var(--radius-control);

  --shadow-theme-sm: var(--shadow-sm);
  --shadow-theme-md: var(--shadow-md);
  --shadow-theme-lg: var(--shadow-lg);
  --shadow-theme-xl: var(--shadow-xl);
}

/* Material Icons基础样式 */
.material-symbols-outlined {
  font-family: "Material Symbols Outlined", sans-serif;
  font-weight: normal;
  font-style: normal;
  font-size: 24px;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  -webkit-font-smoothing: antialiased;
  font-variation-settings:
    "FILL" 0,
    "wght" 400,
    "GRAD" 0,
    "opsz" 24;
}

/* ===================================
   CSS 架构说明
   ===================================
   1. 基础样式层 (@layer base)
   2. 组件样式层 (@layer components)

   设计令牌采用 CSS 变量系统，支持主题切换
   =================================== */

/* 基础样式层 */
@layer base {
  * {
    border-color: var(--border-primary);
  }

  /* ===================================
   设计令牌：暗色主题 (默认)
   =================================== */
  :root,
  html[data-theme="dark"] {
    /* 品牌色（绿色系） */
    --brand-50: #f0fdf4;
    --brand-100: #dcfce7;
    --brand-200: #bbf7d0;
    --brand-300: #86efac;
    --brand-400: #4ade80;
    --brand-500: #22c55e;
    --brand-600: #166534;
    --brand-700: #15803d;
    --brand-800: #14532d;
    --brand-900: #14532d;

    /* 中性色 */
    --neutral-50: #f9fafb;
    --neutral-100: #f3f4f6;
    --neutral-200: #e5e7eb;
    --neutral-300: #d1d5db;
    --neutral-400: #9ca3af;
    --neutral-500: #6b7280;
    --neutral-600: #4b5563;
    --neutral-700: #374151;
    --neutral-800: #1f2937;
    --neutral-900: #111827;

    /* 语义色别名 */
    --color-primary: var(--brand-600);
    --color-primary-hover: var(--brand-700);
    --color-primary-active: var(--brand-800);
    --color-success: var(--brand-500);
    --color-info: var(--brand-500);
    --color-warning: #f59e0b;
    --color-error: #ef4444;

    /* 状态语义令牌 */
    --state-success-text: var(--color-success);
    --state-success-surface: rgba(34, 197, 94, 0.2);
    --state-success-border: rgba(34, 197, 94, 0.5);
    --state-success-strong: var(--brand-500);

    --state-warning-text: var(--color-warning);
    --state-warning-surface: rgba(245, 158, 11, 0.22);
    --state-warning-border: rgba(245, 158, 11, 0.45);
    --state-warning-strong: #facc15;

    --state-error-text: var(--color-error);
    --state-error-surface: rgba(239, 68, 68, 0.22);
    --state-error-border: rgba(239, 68, 68, 0.5);
    --state-error-strong: #f87171;

    --state-info-text: var(--color-info);
    --state-info-surface: rgba(132, 204, 22, 0.24);
    --state-info-border: rgba(132, 204, 22, 0.55);
    --state-info-strong: var(--brand-500);

    /* 状态色阶 */
    --success-50: var(--brand-50);
    --success-100: var(--brand-100);
    --success-200: var(--brand-200);
    --success-300: var(--brand-300);
    --success-400: var(--brand-400);
    --success-500: var(--brand-500);
    --success-600: var(--brand-600);
    --success-700: var(--brand-700);
    --success-800: var(--brand-800);
    --success-900: var(--brand-900);

    --warning-50: #fffbeb;
    --warning-100: #fef3c7;
    --warning-200: #fde68a;
    --warning-300: #fcd34d;
    --warning-400: #fbbf24;
    --warning-500: #f97316;
    --warning-600: #ea580c;
    --warning-700: #c2410c;
    --warning-800: #9a3412;
    --warning-900: #7c2d12;

    --error-50: #fef2f2;
    --error-100: #fee2e2;
    --error-200: #fecaca;
    --error-300: #fca5a5;
    --error-400: #f87171;
    --error-500: #ef4444;
    --error-600: #dc2626;
    --error-700: #b91c1c;
    --error-800: #991b1b;
    --error-900: #7f1d1d;

    /* 文本色 - 暗色主题 (优化对比度) */
    --text-primary: #f8fafc;
    --text-secondary: #cbd5e1;
    --text-tertiary: #94a3b8;
    --text-muted: #64748b;
    --text-inverse: #0f172a;

    /* 表面与背景 */
    --surface-base: #0f172a;
    --surface-card: #1e293b;
    --surface-muted: #1e3432;
    --surface-inverse: #f8fafc;

    --bg-primary: var(--surface-base);
    --bg-secondary: var(--surface-card);
    --bg-tertiary: var(--surface-muted);
    --bg-surface: var(--surface-card);
    --bg-inverse: var(--surface-inverse);

    /* 圆角令牌 */
    --radius-xs: 0.375rem;
    --radius-sm: 0.5rem;
    --radius-md: 0.75rem;
    --radius-lg: 1rem;
    --radius-xl: 1.25rem;
    --radius-2xl: 1.5rem;
    --radius-pill: 9999px;

    --radius-card: var(--radius-2xl);
    --radius-card-large: 1.75rem;
    --radius-control: var(--radius-lg);

    /* 间距令牌 */
    --space-xs: 0.25rem;
    --space-sm: 0.5rem;
    --space-md: 1rem;
    --space-lg: 1.5rem;
    --space-xl: 2rem;

    --space-card-padding-sm: var(--space-md);
    --space-card-padding-lg: var(--space-lg);
    --space-section-gap: var(--space-xl);

    --spacing-xs: var(--space-xs);
    --spacing-sm: var(--space-sm);
    --spacing-md: var(--space-md);

    --space-2xl: 3rem;
    --space-player-content: var(--space-lg);
    --space-player-controls: var(--space-md);
    --space-subtitle-gap: var(--space-sm);
    --space-status-gap: var(--space-md);
    --space-mobile-padding: var(--space-sm);
    --space-desktop-padding: var(--space-lg);

    --font-size-base: 1rem;
    --font-family-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

    --border-default: #334155;
    --border-strong: #475569;
    --border-subtle: #1e293b;
    --border-focus: var(--color-primary);
    --border-error: var(--color-error);

    --border-primary: var(--border-default);
    --border-secondary: var(--border-strong);
    --border-muted: var(--border-subtle);

    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.25);
    --shadow-md: 0 6px 12px -2px rgb(0 0 0 / 0.35);
    --shadow-lg: 0 20px 40px -24px rgb(0 0 0 / 0.45);
    --shadow-xl: 0 32px 80px -40px rgb(0 0 0 / 0.5);

    --button-fill: var(--color-primary);
    --button-fill-hover: var(--color-primary-hover);
    --button-fill-active: var(--color-primary-active);
    --button-text-color: var(--text-inverse);
    --button-text: var(--text-inverse);
    --button-border: var(--border-default);
    --button-color: var(--button-fill);
    --button-hover-color: var(--button-fill-hover);
    --button-shadow-color: var(--brand-900);

    --primary: var(--color-primary);
    --primary-foreground: var(--text-inverse);
    --background: var(--bg-primary);
    --foreground: var(--text-primary);
    --card: var(--surface-card);
    --card-foreground: var(--text-primary);
    --popover: var(--surface-card);
    --popover-foreground: var(--text-primary);
    --muted: var(--surface-muted);
    --muted-foreground: var(--text-muted);
    --accent: var(--surface-muted);
    --accent-foreground: var(--text-primary);
    --destructive: var(--state-error-strong);
    --destructive-foreground: var(--text-inverse);
    --border: var(--border-default);
    --input: var(--border-default);
    --ring: var(--color-primary);

    --player-accent-color: var(--color-primary);
    --player-highlight-bg: rgba(132, 204, 22, 0.18);
    --player-card-bg: var(--surface-card);
    --player-card-border: rgba(255, 255, 255, 0.12);
    --player-card-shadow: rgba(0, 0, 0, 0.35);
    --player-track-color: rgba(132, 204, 22, 0.25);
    --player-thumb-fill: var(--surface-base);
    --player-thumb-border: rgba(132, 204, 22, 0.6);
    --player-hover-indicator: rgba(132, 204, 22, 0.35);
    --player-tooltip-text: var(--text-primary);

    --settings-shadow-color: rgba(15, 23, 42, 0.55);
    --settings-divider-color: rgba(75, 85, 99, 0.6);
    --settings-muted-color: rgba(226, 232, 240, 0.65);
    --settings-border-color: rgba(148, 163, 184, 0.35);

    --scrollbar-width: 6px;
    --scrollbar-track-color: transparent;
    --scrollbar-thumb-color: rgba(148, 163, 184, 0.5);
    --scrollbar-thumb-hover-color: rgba(148, 163, 184, 0.7);
    --scrollbar-border-radius: 9999px;

    --upload-bg-color: transparent;
    --inactive-icon-color: var(--text-muted);
    --stats-text-color: #d1d5db;
    --secondary-text-color: var(--text-secondary);
    --highlight-bg: rgba(132, 204, 22, 0.18);
    --nav-container-background: rgba(30, 41, 59, 0.8);

    --background-light: var(--surface-base);
    --card-background: var(--surface-card);
  }

  /* ===================================
   设计令牌：浅色主题
   =================================== */
  html[data-theme="light"] {
    --brand-50: #f0fdf4;
    --brand-100: #dcfce7;
    --brand-200: #bbf7d0;
    --brand-300: #86efac;
    --brand-400: #4ade80;
    --brand-500: #22c55e;
    --brand-600: #16a34a;
    --brand-700: #15803d;
    --brand-800: #166534;
    --brand-900: #14532d;

    --neutral-50: #f9fafb;
    --neutral-100: #f3f4f6;
    --neutral-200: #e5e7eb;
    --neutral-300: #d1d5db;
    --neutral-400: #9ca3af;
    --neutral-500: #6b7280;
    --neutral-600: #4b5563;
    --neutral-700: #374151;
    --neutral-800: #1f2937;
    --neutral-900: #111827;

    --color-primary: var(--brand-500);
    --color-primary-hover: var(--brand-600);
    --color-primary-active: var(--brand-700);
    --color-success: var(--brand-500);
    --color-info: var(--brand-500);
    --color-warning: #f59e0b;
    --color-error: #ef4444;

    --state-success-text: var(--color-success);
    --state-success-surface: rgba(34, 197, 94, 0.1);
    --state-success-border: rgba(34, 197, 94, 0.3);
    --state-success-strong: var(--brand-600);

    --state-warning-text: var(--color-warning);
    --state-warning-surface: rgba(245, 158, 11, 0.1);
    --state-warning-border: rgba(245, 158, 11, 0.3);
    --state-warning-strong: #d97706;

    --state-error-text: var(--color-error);
    --state-error-surface: rgba(239, 68, 68, 0.1);
    --state-error-border: rgba(239, 68, 68, 0.3);
    --state-error-strong: #dc2626;

    --state-info-text: var(--color-info);
    --state-info-surface: rgba(34, 197, 94, 0.1);
    --state-info-border: rgba(34, 197, 94, 0.3);
    --state-info-strong: var(--brand-600);

    --text-primary: #111827;
    --text-secondary: #374151;
    --text-tertiary: #6b7280;
    --text-muted: #9ca3af;
    --text-inverse: #ffffff;

    --surface-base: #ffffff;
    --surface-card: #ffffff;
    --surface-muted: var(--neutral-50);
    --surface-inverse: var(--neutral-900);

    --bg-primary: var(--surface-base);
    --bg-secondary: var(--surface-card);
    --bg-tertiary: var(--surface-muted);
    --bg-surface: var(--surface-card);
    --bg-inverse: var(--surface-inverse);

    --radius-xs: 0.375rem;
    --radius-sm: 0.5rem;
    --radius-md: 0.75rem;
    --radius-lg: 1rem;
    --radius-xl: 1.25rem;
    --radius-2xl: 1.5rem;
    --radius-pill: 9999px;

    --radius-card: var(--radius-2xl);
    --radius-card-large: 1.75rem;
    --radius-control: var(--radius-lg);

    --space-xs: 0.25rem;
    --space-sm: 0.5rem;
    --space-md: 1rem;
    --space-lg: 1.5rem;
    --space-xl: 2rem;

    --space-card-padding-sm: var(--space-md);
    --space-card-padding-lg: var(--space-lg);
    --space-section-gap: var(--space-xl);

    --spacing-xs: var(--space-xs);
    --spacing-sm: var(--space-sm);
    --spacing-md: var(--space-md);

    --space-2xl: 3rem;
    --space-player-content: var(--space-lg);
    --space-player-controls: var(--space-md);
    --space-subtitle-gap: var(--space-sm);
    --space-status-gap: var(--space-md);
    --space-mobile-padding: var(--space-sm);
    --space-desktop-padding: var(--space-lg);

    --font-size-base: 1rem;
    --font-family-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

    --border-default: var(--neutral-200);
    --border-strong: var(--neutral-300);
    --border-subtle: var(--neutral-100);
    --border-focus: var(--color-primary);
    --border-error: var(--color-error);

    --border-primary: var(--border-default);
    --border-secondary: var(--border-strong);
    --border-muted: var(--border-subtle);

    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
    --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1);

    --button-fill: var(--color-primary);
    --button-fill-hover: var(--color-primary-hover);
    --button-fill-active: var(--color-primary-active);
    --button-text-color: var(--text-inverse);
    --button-shadow-color: var(--brand-700);

    --primary: var(--color-primary);
    --primary-foreground: var(--text-inverse);
    --background: var(--bg-primary);
    --foreground: var(--text-primary);
    --card: var(--surface-card);
    --card-foreground: var(--text-primary);
    --popover: var(--surface-card);
    --popover-foreground: var(--text-primary);
    --muted: var(--surface-muted);
    --muted-foreground: var(--text-muted);
    --accent: var(--surface-muted);
    --accent-foreground: var(--text-primary);
    --destructive: var(--state-error-strong);
    --destructive-foreground: var(--text-inverse);
    --border: var(--border-default);
    --input: var(--border-default);
    --ring: var(--color-primary);

    --player-accent-color: var(--color-primary);
    --player-highlight-bg: rgba(34, 197, 94, 0.1);
    --player-card-bg: var(--surface-card);
    --player-card-border: var(--border-default);
    --player-card-shadow: rgba(0, 0, 0, 0.1);
    --player-track-color: rgba(34, 197, 94, 0.2);
    --player-thumb-fill: var(--surface-card);
    --player-thumb-border: rgba(34, 197, 94, 0.6);
    --player-hover-indicator: rgba(34, 197, 94, 0.3);
    --player-tooltip-text: var(--text-primary);

    --settings-shadow-color: rgba(0, 0, 0, 0.1);
    --settings-divider-color: var(--border-default);
    --settings-muted-color: var(--text-muted);
    --settings-border-color: var(--border-default);

    --scrollbar-width: 6px;
    --scrollbar-track-color: transparent;
    --scrollbar-thumb-color: rgba(0, 0, 0, 0.2);
    --scrollbar-thumb-hover-color: rgba(0, 0, 0, 0.3);
    --scrollbar-border-radius: 9999px;

    --upload-bg-color: rgba(34, 197, 94, 0.05);
    --inactive-icon-color: var(--text-muted);
    --stats-text-color: var(--text-primary);
    --secondary-text-color: var(--text-secondary);
    --highlight-bg: rgba(34, 197, 94, 0.1);
    --nav-container-background: rgba(255, 255, 255, 0.9);

    --background-light: var(--surface-base);
    --card-background: var(--surface-card);
  }

  /* ===================================
   设计令牌：高对比度主题 (可访问性增强)
   =================================== */
  html[data-theme="high-contrast"] {
    --brand-500: #00ff00;
    --brand-600: #00cc00;
    --brand-700: #009900;

    --text-primary: #ffffff;
    --text-secondary: #e0e0e0;
    --text-tertiary: #c0c0c0;
    --text-muted: #a0a0a0;
    --text-inverse: #000000;

    --surface-base: #000000;
    --surface-card: #1a1a1a;
    --surface-muted: #2d2d2d;

    --border-default: #ffffff;
    --border-strong: #ffffff;
    --border-focus: #00ff00;
    --border-error: #ff0000;

    --state-success-text: #00ff00;
    --state-warning-text: #ffff00;
    --state-error-text: #ff0000;
    --state-info-text: #00ffff;

    --space-xs: 0.25rem;
    --space-sm: 0.5rem;
    --space-md: 1rem;
    --space-lg: 1.5rem;
    --space-xl: 2rem;

    --space-card-padding-sm: var(--space-md);
    --space-card-padding-lg: var(--space-lg);
    --space-section-gap: var(--space-xl);

    --space-2xl: 3rem;
    --space-player-content: var(--space-lg);
    --space-player-controls: var(--space-md);
    --space-subtitle-gap: var(--space-sm);
    --space-status-gap: var(--space-md);
    --space-mobile-padding: var(--space-sm);
    --space-desktop-padding: var(--space-lg);

    --spacing-xs: var(--space-xs);
    --spacing-sm: var(--space-sm);
    --spacing-md: var(--space-md);

    --font-size-base: 1rem;
    --font-family-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

    --bg-primary: var(--surface-base);
    --bg-secondary: var(--surface-card);
    --bg-tertiary: var(--surface-muted);
    --bg-surface: var(--surface-card);
    --color-primary: var(--brand-500);
    --player-accent-color: var(--brand-500);
  }

  .text-success {
    color: var(--state-success-text);
  }
  .text-warning {
    color: var(--state-warning-text);
  }
  .text-error {
    color: var(--state-error-text);
  }
  .text-info {
    color: var(--state-info-text);
  }

  .bg-success {
    background-color: var(--state-success-text);
  }
  .bg-warning {
    background-color: var(--state-warning-text);
  }
  .bg-error {
    background-color: var(--state-error-text);
  }
  .bg-info {
    background-color: var(--state-info-text);
  }

  .bg-success\/10 {
    background-color: var(--state-success-surface);
  }
  .bg-warning\/10 {
    background-color: var(--state-warning-surface);
  }
  .bg-error\/10 {
    background-color: var(--state-error-surface);
  }
  .bg-info\/10 {
    background-color: var(--state-info-surface);
  }

  .border-success {
    border-color: var(--state-success-border);
  }
  .border-warning {
    border-color: var(--state-warning-border);
  }
  .border-error {
    border-color: var(--state-error-border);
  }
  .border-info {
    border-color: var(--state-info-border);
  }

  body {
    @apply min-h-screen font-sans;
    background-color: var(--bg-primary);
    color: var(--text-primary);
    transition:
      background-color 0.3s ease,
      color 0.3s ease,
      border-color 0.3s ease;
  }

  html,
  body,
  [data-theme],
  .theme-transition {
    transition:
      background-color 0.3s ease,
      color 0.3s ease,
      border-color 0.3s ease,
      box-shadow 0.3s ease;
  }

  .safe-area-inset-top {
    padding-top: env(safe-area-inset-top);
  }

  .safe-area-inset-bottom {
    padding-bottom: env(safe-area-inset-bottom);
  }

  .safe-area-inset-left {
    padding-left: env(safe-area-inset-left);
  }

  .safe-area-inset-right {
    padding-right: env(safe-area-inset-right);
  }

  @media (max-width: 640px) {
    :root {
      --font-size-responsive-sm: 0.875rem;
      --font-size-responsive-base: 1rem;
      --font-size-responsive-lg: 1.125rem;
      --font-size-responsive-xl: 1.25rem;
      --font-size-responsive-2xl: 1.5rem;
      --font-size-responsive-3xl: 1.875rem;

      --space-mobile-padding: var(--space-xs);
      --space-player-content: var(--space-sm);
      --space-player-controls: var(--space-sm);
      --space-subtitle-gap: var(--space-xs);
      --space-status-gap: var(--space-sm);
    }
  }

  @media (min-width: 641px) and (max-width: 1024px) {
    :root {
      --space-player-content: var(--space-md);
      --space-player-controls: var(--space-lg);
      --space-subtitle-gap: var(--space-sm);
      --space-status-gap: var(--space-md);
    }
  }

  @media (min-width: 1025px) {
    :root {
      --space-player-content: var(--space-lg);
      --space-player-controls: var(--space-xl);
      --space-subtitle-gap: var(--space-md);
      --space-status-gap: var(--space-lg);
    }
  }

  @media (hover: none) and (pointer: coarse) {
    button,
    a,
    input,
    select,
    textarea {
      min-height: 44px;
      min-width: 44px;
    }

    .scrollable {
      -webkit-overflow-scrolling: touch;
      scroll-behavior: smooth;
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    *:focus {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    *:focus:not(:focus-visible) {
      outline: none;
    }

    *:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
      box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.2);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms;
      animation-iteration-count: 1;
      transition-duration: 0.01ms;
      scroll-behavior: auto;
    }
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .sr-only:focus {
    position: static;
    width: auto;
    height: auto;
    padding: inherit;
    margin: inherit;
    overflow: visible;
    clip: auto;
    white-space: normal;
  }

  @media (prefers-contrast: high) {
    :root {
      --border-default: #ffffff;
      --border-strong: #ffffff;
      --text-primary: #ffffff;
      --text-secondary: #e0e0e0;
    }

    button,
    a,
    input,
    select,
    textarea {
      border-width: 2px;
      font-weight: 600;
    }
  }
}

@layer components {
  .card-base {
    background-color: var(--surface-card);
    border: 2px solid var(--border-primary);
    border-radius: var(--radius-card);
    padding: var(--space-card-padding-lg);
    transition: all 0.2s ease;
  }

  .card-default {
    @apply card-base;
    border-bottom-width: 4px;
    box-shadow: var(--shadow-md);
  }

  .card-default:hover {
    transform: translateY(-0.25rem);
    box-shadow: var(--shadow-lg);
  }

  .card-elevated {
    @apply card-base;
    border-bottom-width: 6px;
    box-shadow: var(--shadow-lg);
  }

  .card-elevated:hover {
    transform: translateY(-0.5rem);
    box-shadow: var(--shadow-xl);
  }

  .card-bordered {
    @apply card-base;
    border-bottom-width: 6px;
    border-color: var(--border-strong);
    box-shadow: var(--shadow-sm);
  }

  .card-bordered:hover {
    border-color: var(--border-focus);
    transform: translateY(-0.125rem);
    box-shadow: var(--shadow-md);
  }

  .card-interactive {
    @apply card-base;
    border-bottom-width: 4px;
    box-shadow: var(--shadow-md);
    cursor: pointer;
  }

  .card-interactive:hover {
    transform: translateY(-0.375rem);
    box-shadow: var(--shadow-xl);
    border-color: var(--border-focus);
  }

  .card-interactive:active {
    transform: translateY(-0.125rem);
    box-shadow: var(--shadow-md);
  }

  .stats-card {
    @apply card-elevated;
    border-radius: var(--radius-card-large);
  }

  .file-card {
    @apply card-interactive;
    padding: var(--space-card-padding-sm);
  }

  .file-card-actions {
    @apply flex items-center gap-2;
  }

  .file-card-action {
    @apply flex h-12 w-12 items-center justify-center rounded-full text-white shadow-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)];
    background-color: var(--state-info-text);
  }

  .file-card-action .material-symbols-outlined {
    @apply text-2xl;
  }

  .file-card-action--play:hover,
  .file-card-action--play.is-active {
    background-color: var(--state-info-strong);
  }

  .file-card-action--retry {
    background-color: var(--state-warning-text);
  }

  .file-card-action--retry:hover {
    background-color: var(--state-warning-strong);
  }

  .file-card-action--delete {
    background-color: transparent;
    box-shadow: none;
    color: var(--text-muted);
    opacity: 0;
    pointer-events: none;
    transition:
      opacity 150ms ease,
      background-color 150ms ease,
      color 150ms ease;
  }

  .file-card-actions:hover .file-card-action--delete,
  .file-card-action--delete:focus-visible {
    opacity: 1;
    pointer-events: auto;
  }

  .file-card-action--delete:hover {
    background-color: var(--state-error-surface);
    color: var(--state-error-strong);
  }

  .upload-area {
    @apply flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-6 py-16 text-center;
    border-color: var(--state-success-border);
    background-color: var(--upload-bg-color);
    border-radius: var(--radius-card);
  }

  .upload-area.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .btn-base {
    @apply inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50;
    height: 3.5rem;
    padding: 0 1.75rem;
    border-radius: var(--radius-control);
    border-bottom: 4px solid transparent;
    font-size: 0.875rem;
    font-weight: 600;
    letter-spacing: 0.025em;
    text-transform: uppercase;
  }

  .btn-primary {
    @apply btn-base;
    background-color: var(--button-fill);
    color: var(--button-text-color);
    border-bottom-color: var(--button-shadow-color);
    box-shadow: var(--shadow-md);
  }

  .btn-primary:hover:not(:disabled) {
    background-color: var(--button-fill-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-lg);
  }

  .btn-primary:active:not(:disabled) {
    background-color: var(--button-fill-active);
    transform: translateY(3px);
    border-bottom-width: 1px;
    box-shadow: var(--shadow-sm);
  }

  .btn-primary:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .btn-secondary {
    @apply btn-base;
    background-color: var(--surface-muted);
    color: var(--text-primary);
    border-color: var(--border-secondary);
    box-shadow: var(--shadow-sm);
  }

  .btn-secondary:hover:not(:disabled) {
    background-color: var(--surface-card);
    border-color: var(--border-default);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .btn-secondary:active:not(:disabled) {
    background-color: var(--surface-muted);
    transform: translateY(3px);
    border-bottom-width: 1px;
    box-shadow: none;
  }

  .btn-secondary:focus-visible {
    outline: 2px solid var(--border-focus);
    outline-offset: 2px;
  }

  .btn-outline {
    @apply btn-base;
    background-color: transparent;
    color: var(--color-primary);
    border-color: var(--color-primary);
    border-bottom-color: var(--color-primary);
    box-shadow: none;
  }

  .btn-outline:hover:not(:disabled) {
    background-color: var(--color-primary);
    color: var(--button-text-color);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .btn-outline:active:not(:disabled) {
    transform: translateY(3px);
    border-bottom-width: 1px;
  }

  .btn-outline:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .btn-ghost {
    @apply btn-base;
    background-color: transparent;
    color: var(--text-secondary);
    border-color: transparent;
    box-shadow: none;
  }

  .btn-ghost:hover:not(:disabled) {
    background-color: var(--surface-muted);
    color: var(--text-primary);
    transform: translateY(-1px);
  }

  .btn-ghost:active:not(:disabled) {
    background-color: var(--surface-muted);
    transform: translateY(1px);
  }

  .btn-ghost:focus-visible {
    outline: 2px solid var(--border-focus);
    outline-offset: 2px;
  }

  .btn-danger {
    @apply btn-base;
    background-color: var(--color-error);
    color: var(--button-text-color);
    border-bottom-color: var(--state-error-strong);
    box-shadow: var(--shadow-md);
  }

  .btn-danger:hover:not(:disabled) {
    background-color: var(--state-error-strong);
    transform: translateY(-1px);
    box-shadow: var(--shadow-lg);
  }

  .btn-danger:active:not(:disabled) {
    background-color: var(--state-error-strong);
    transform: translateY(3px);
    border-bottom-width: 1px;
    box-shadow: var(--shadow-sm);
  }

  .btn-danger:focus-visible {
    outline: 2px solid var(--color-error);
    outline-offset: 2px;
  }

  .btn-icon {
    @apply btn-base;
    width: 3.5rem;
    height: 3.5rem;
    padding: 0;
    border-radius: var(--radius-pill);
  }

  .btn-icon.btn-icon-sm {
    width: 2.75rem;
    height: 2.75rem;
  }

  .btn-icon.btn-icon-lg {
    width: 4rem;
    height: 4rem;
  }

  .btn-play {
    @apply flex items-center justify-center rounded-full h-12 w-12 text-white transition-all;
    background-color: var(--color-success);
    box-shadow: 0 4px 0 0 var(--state-success-strong);
    border-radius: var(--radius-pill);
  }

  .btn-play:active {
    box-shadow: none;
    transform: translateY(4px);
  }

  .btn-retry {
    @apply flex items-center justify-center rounded-xl h-12 px-6 text-white text-sm font-bold uppercase tracking-wider transition-all;
    background-color: var(--color-warning);
    box-shadow: 0 4px 0 0 var(--state-warning-strong);
    border-radius: var(--radius-control);
  }

  .btn-retry:active {
    box-shadow: none;
    transform: translateY(4px);
  }

  .btn-delete {
    @apply flex items-center justify-center p-3 rounded-full transition-all;
    border-radius: var(--radius-pill);
    color: var(--text-muted);
    background-color: transparent;
  }

  .btn-delete:hover {
    background-color: var(--state-error-surface);
    color: var(--state-error-text);
  }

  .nav-button {
    @apply flex items-center justify-center rounded-full h-12 w-12 transition-colors;
    color: var(--inactive-icon-color);
  }

  .nav-button:hover {
    background-color: var(--surface-muted);
  }

  .nav-button.active {
    background-color: var(--bg-primary);
    color: var(--text-primary);
  }

  .nav-container {
    @apply flex items-center justify-center gap-2 rounded-full p-2 shadow-lg border-2 backdrop-blur-sm;
    background-color: var(--nav-container-background);
    border-color: var(--border-primary);
    border-radius: var(--radius-pill);
    box-shadow: var(--shadow-md);
  }

  .player-subtitle-container {
    @apply space-y-3 text-left;
  }

  .subtitle-line {
    padding: 1rem;
    transition: background-color 0.3s ease;
    margin-bottom: 1rem;
    text-align: left;
  }

  .subtitle-line.highlight {
    background-color: var(--highlight-bg);
  }

  .player-subtitle-line {
    @apply flex flex-col gap-2 sm:gap-3 p-3 sm:p-4 transition-colors duration-300;
  }

  .player-subtitle-line.highlight {
    background-color: var(--player-highlight-bg);
  }

  @media (max-width: 640px) {
    .player-subtitle-line {
      padding: 0.75rem;
      gap: 0.5rem;
    }
  }

  .player-word-group {
    @apply inline-flex flex-col items-start text-left;
    margin-right: 0.25em;
  }

  .player-word-group ruby {
    @apply flex flex-col-reverse items-start leading-tight;
  }

  .player-word-group rt {
    @apply text-xs uppercase tracking-wide;
    color: var(--text-muted);
    user-select: none;
    opacity: 0.9;
  }

  .player-word-group rb {
    font-size: clamp(1.25rem, 4vw, 1.75rem);
    font-weight: 600;
    line-height: 1.5;
    color: var(--text-primary);
  }

  .player-word-group .romaji-word {
    font-size: clamp(0.7rem, 2vw, 0.8rem);
    color: var(--text-tertiary);
    letter-spacing: 0.05em;
    line-height: 1;
    margin-top: 0.1em;
    white-space: nowrap;
    user-select: none;
  }

  @media (max-width: 640px) {
    .player-word-group rb {
      font-size: 1.25rem;
      line-height: 1.4;
    }

    .player-word-group .romaji-word {
      font-size: 0.7rem;
      margin-top: 0.05em;
    }
  }

  .player-subtitle-words {
    @apply flex flex-wrap items-end justify-start gap-x-2 sm:gap-x-3 gap-y-3 sm:gap-y-4;
  }

  @media (max-width: 640px) {
    .player-subtitle-words {
      column-gap: 0.5rem;
      row-gap: 0.75rem;
    }
  }

  .player-word-surface {
    @apply text-2xl font-semibold leading-tight;
    color: var(--text-primary);
  }

  .player-romaji-word {
    @apply mt-1 text-xs uppercase tracking-widest;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .player-word-group.active .player-word-surface {
    color: var(--player-accent-color);
  }

  .player-word-group.active {
    @apply rounded-lg px-2 py-1;
    background-color: var(--player-highlight-bg);
  }

  .player-translation {
    @apply text-sm;
    color: var(--text-secondary);
  }

  .player-subtitle-plain {
    @apply text-left text-xl font-semibold leading-relaxed;
    color: var(--text-primary);
  }

  .player-subtitle-original {
    @apply text-left text-2xl font-semibold leading-relaxed;
    color: var(--text-primary);
  }

  .player-subtitle-translation {
    @apply text-left text-base leading-relaxed mt-2;
    color: var(--text-muted);
  }

  @media (max-width: 640px) {
    .player-subtitle-original {
      font-size: 1.25rem;
    }

    .player-subtitle-translation {
      font-size: 0.875rem;
    }
  }

  .player-seek {
    @apply relative h-2 w-full cursor-pointer rounded-full transition-colors duration-200;
    background-color: var(--player-track-color);
  }

  .player-seek:hover {
    background-color: var(--player-hover-indicator);
  }

  .player-seek-progress {
    @apply absolute left-0 top-0 h-full rounded-full transition-all duration-150;
    background-color: var(--player-accent-color);
  }

  .player-seek-thumb {
    @apply absolute top-1/2 h-3 w-3 -translate-y-1/2 translate-x-1/2 rounded-full shadow-lg transition-transform duration-150;
    background-color: var(--player-thumb-fill);
    border: 2px solid var(--player-thumb-border);
  }

  .player-seek-thumb:hover {
    transform: translateY(-50%) translateX(50%) scale(1.05);
  }

  .player-seek-hover {
    @apply absolute top-1/2 h-2 w-2 -translate-y-1/2 translate-x-1/2 rounded-full;
    background-color: var(--player-hover-indicator);
  }

  .player-seek-tooltip {
    @apply absolute -top-8 -translate-x-1/2 rounded px-2 py-1 text-xs shadow-md;
    background-color: var(--player-accent-color);
    color: var(--player-tooltip-text);
  }

  .player-card {
    background-color: var(--player-card-bg);
    border: 2px solid var(--player-card-border);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow-lg);
    padding: var(--space-card-padding-sm);
  }

  .player-control-surface {
    @apply flex flex-col gap-4;
    background-color: var(--player-card-bg);
    border: 2px solid var(--player-card-border);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow-xl);
    padding: var(--space-card-padding-sm);
    gap: var(--space-md);
  }

  .settings-header {
    @apply text-center mb-10;
  }

  .settings-title {
    @apply text-3xl font-bold;
    color: var(--text-primary);
  }

  .settings-section-title {
    @apply text-xl font-bold uppercase mb-2 px-2;
    color: var(--text-primary);
    opacity: 0.6;
  }

  .settings-card {
    background-color: var(--surface-card);
    border: 2px solid var(--settings-border-color);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .settings-row {
    @apply flex items-center justify-between gap-4 px-4 py-4;
  }

  .settings-card .settings-row + .settings-row {
    border-top: 2px solid var(--settings-divider-color);
  }

  .settings-row-content {
    @apply flex flex-col gap-1 text-left;
  }

  .settings-row-title {
    @apply font-bold text-lg;
    color: var(--text-primary);
  }

  .settings-row-description {
    @apply text-sm;
    color: var(--settings-muted-color);
  }

  .settings-value {
    @apply text-sm;
    color: var(--settings-muted-color);
  }

  .settings-inline-controls {
    @apply flex items-center gap-2;
  }

  .settings-link {
    @apply flex items-center justify-between gap-3 px-4 py-4 transition-colors;
  }

  .settings-link:hover {
    background-color: rgba(132, 204, 22, 0.05);
  }

  .settings-button-group {
    @apply inline-flex items-center gap-2;
  }

  .settings-button {
    @apply rounded-lg px-3 py-1 text-sm font-bold uppercase transition-all duration-200;
    color: rgba(74, 74, 74, 0.4);
    border: 2px solid var(--border-color);
    background-color: rgba(255, 255, 255, 0.4);
    box-shadow: 0 4px 0 var(--settings-shadow-color);
  }

  .settings-button:hover:not(.active) {
    @apply translate-y-[1px];
    background-color: rgba(92, 157, 82, 0.08);
  }

  .settings-button.active {
    color: var(--button-text-color);
    background-color: var(--player-accent-color);
    border-color: transparent;
  }

  .settings-number-adjuster {
    @apply flex items-center gap-2;
  }

  .settings-number-button {
    @apply p-2 rounded-full transition-colors;
    color: var(--settings-muted-color);
  }

  .settings-number-button:hover {
    background-color: rgba(132, 204, 22, 0.1);
  }

  .settings-number-value {
    @apply font-bold text-lg w-8 text-center;
    color: var(--text-primary);
  }

  .settings-account-card {
    @apply flex flex-col gap-4 p-4;
  }

  .settings-account-header {
    @apply flex items-center gap-4;
  }

  .settings-account-avatar {
    @apply w-16 h-16 rounded-full border-2;
    border-color: var(--settings-border-color);
  }

  .settings-account-info {
    @apply flex flex-col gap-1;
  }

  .settings-account-name {
    @apply font-bold text-lg;
    color: var(--text-primary);
  }

  .settings-account-label {
    @apply text-sm;
    color: var(--settings-muted-color);
  }

  .settings-progress-bar {
    @apply relative w-full h-4 overflow-hidden rounded-full bg-gray-200/50;
  }

  .settings-progress-fill {
    @apply absolute inset-y-0 left-0 h-full rounded-full bg-primary transition-[width] duration-300 ease-out;
  }

  .settings-progress-text {
    @apply text-sm text-center mt-2;
    color: var(--settings-muted-color);
  }

  .settings-pro-card {
    @apply p-6 text-center;
  }

  .settings-pro-icon {
    @apply text-5xl text-yellow-400 mb-4;
  }

  .settings-pro-title {
    @apply text-2xl font-bold mb-2;
    color: var(--text-primary);
  }

  .settings-pro-description {
    @apply text-sm mb-6;
    color: var(--settings-muted-color);
  }

  .settings-pro-button {
    @apply w-full py-3 px-4 font-bold rounded-lg transition-all;
    background-color: var(--player-accent-color);
    color: var(--button-text-color);
    box-shadow: 0 4px 0 0 var(--settings-shadow-color);
  }

  .settings-pro-button:hover {
    background-color: var(--button-hover-color);
  }

  .settings-pro-button:active {
    box-shadow: none;
    transform: translateY(4px);
  }

  @media (max-width: 768px) {
    .settings-title {
      @apply text-2xl;
    }

    .settings-row {
      @apply px-3 py-3;
    }

    .settings-button {
      @apply px-2 py-1 text-xs;
    }
  }

  .text-stats-label {
    @apply text-base font-bold;
    color: var(--secondary-text-color);
  }

  .text-stats-value {
    @apply text-3xl font-black mt-2;
    color: var(--stats-text-color);
  }

  .text-file-name {
    @apply font-bold text-lg;
    color: var(--stats-text-color);
  }

  .text-file-status {
    @apply text-sm;
    color: var(--text-muted);
  }

  .loading-spinner {
    @apply w-10 h-10 animate-spin rounded-full border-4 border-dashed;
    border-color: var(--color-info);
  }

  .status-success {
    color: var(--state-success-text);
  }

  .status-warning {
    color: var(--state-warning-text);
  }

  .status-error {
    color: var(--state-error-text);
  }

  .status-processing {
    color: var(--state-info-text);
  }

  .status-ready {
    color: var(--text-secondary);
  }

  .status-loading {
    color: var(--text-muted);
  }

  .scrollbar-custom {
    overflow-y: auto;
  }

  .scrollbar-custom::-webkit-scrollbar {
    width: var(--scrollbar-width);
  }

  .scrollbar-custom::-webkit-scrollbar-track {
    background: var(--scrollbar-track-color);
  }

  .scrollbar-custom::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb-color);
    border-radius: var(--scrollbar-border-radius);
  }

  .scrollbar-custom::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover-color);
  }

  .scrollable {
    overflow-y: auto;
    overflow-x: hidden;
  }

  .scrollable::-webkit-scrollbar {
    width: var(--scrollbar-width);
  }

  .scrollable::-webkit-scrollbar-track {
    background: var(--scrollbar-track-color);
  }

  .scrollable::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb-color);
    border-radius: var(--scrollbar-border-radius);
  }

  .scrollable::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover-color);
  }
}
```

- [ ] **Step 2: Delete old globals.css**

```bash
rm src/styles/globals.css
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: create app.css with Tailwind v4 @import and @theme, delete globals.css"
```

---

## Task 10: Delete test setup file

**Files:**
- Delete: `src/__tests__/setup.ts`

This file uses `vitest` imports (`vi`, `afterEach`, `beforeAll` from `"vitest"`) and `@testing-library/jest-dom/vitest`. Since we're switching to `bun test`, this file is no longer needed. Tests that rely on these mocks will need to be updated in a follow-up task.

- [ ] **Step 1: Delete the setup file**

```bash
rm src/__tests__/setup.ts
```

- [ ] **Step 2: Check if the __tests__ directory is now empty and remove if so**

```bash
rmdir src/__tests__ 2>/dev/null || true
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: delete vitest setup.ts (switching to bun test)"
```

---

## Task 11: Update biome.json

**Files:**
- Modify: `biome.json`

- [ ] **Step 1: Replace biome.json with canonical format**

```json
{
  "files": {
    "ignoreUnknown": true,
    "includes": ["**", "!**/drizzle/**", "!**/.output/**", "!**/node_modules/**"]
  },
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "javascript": {
    "formatter": { "quoteStyle": "single", "semicolons": "asNeeded" }
  }
}
```

Note: The existing biome.json has custom rule overrides (`noUnknownAtRules: off`, `noExplicitAny: warn`, etc.). These are removed in the canonical SKILL.md format. Tailwind v4's `@import "tailwindcss"` and `@theme {}` are valid CSS so `noUnknownAtRules` should no longer trigger. If issues arise, overrides can be re-added.

- [ ] **Step 2: Commit**

```bash
git add biome.json
git commit -m "chore: update biome.json to canonical tanstack-bun-stack format"
```

---

## Task 12: Rewrite Dockerfile for Bun

**Files:**
- Modify: `Dockerfile`

- [ ] **Step 1: Replace the Dockerfile**

```dockerfile
FROM oven/bun:1-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/.output ./.output
COPY --from=build /app/package.json ./
EXPOSE 3000
CMD ["bun", "run", "./.output/server/index.mjs"]
```

- [ ] **Step 2: Commit**

```bash
git add Dockerfile
git commit -m "chore: rewrite Dockerfile for Bun runtime"
```

---

## Task 13: Update .env.example

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Update .env.example**

```
# Server-side (API routes)
GROQ_API_KEY=your_groq_api_key_here
PERFORMANCE_ADMIN_TOKEN=optional_admin_token

# Client-side (Bun exposes to browser via Vite, must start with VITE_)
VITE_APP_URL=http://localhost:3000
```

The only change is updating the comment from "Vite exposes to browser" to "Bun exposes to browser via Vite". The `VITE_` prefix is still required because Vite is the build tool even under Bun.

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: update .env.example comment for Bun"
```

---

## Task 14: Update AGENTS.md

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Update the Prerequisites section**

Replace:
```
- Node.js >=20.0.0
- pnpm >=9.0.0 (required; do not use npm/yarn)
- `GROQ_API_KEY` in `.env.local`
- `NEXT_PUBLIC_APP_URL` (defaults to `http://localhost:3000`)
```

With:
```
- Bun >=1.2.0 (required; do not use npm/pnpm/yarn/node)
- `GROQ_API_KEY` in `.env.local`
- `VITE_APP_URL` (defaults to `http://localhost:3000`)
```

- [ ] **Step 2: Update the Common Commands section**

Replace the entire commands block with:
```
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
```

- [ ] **Step 3: Update the Toolchain Quirks section**

Replace:
```
- **Lint/Format**: Biome.js (`biome.json`). Rules differ from defaults: `noUnknownAtRules` off (Tailwind), `noExplicitAny` off, `useSemanticElements` off.
- **Styling**: Tailwind CSS 3.4.0 with custom design tokens in CSS variables (`src/styles/globals.css`). Do not add arbitrary values that duplicate existing tokens.
- **Path Alias**: `@/*` resolves to `./src/*`.
- **Dev Server**: Next.js dev; API routes under `src/app/api/**/route.ts`.
- **Font**: Material Symbols Outlined loaded from Google Fonts in `layout.tsx`.
```

With:
```
- **Lint/Format**: Biome.js (`biome.json`). Single source of truth for linting and formatting.
- **Styling**: Tailwind CSS v4 with `@tailwindcss/vite` plugin. Theme tokens in CSS `@theme {}` block (`src/styles/app.css`). Do not add arbitrary values that duplicate existing tokens.
- **Path Alias**: `~/*` resolves to `./src/*`.
- **Dev Server**: `bun run dev` (Vite dev under Bun); API routes as TanStack Start server functions under `src/routes/api/`.
- **Font**: Material Symbols Outlined loaded from Google Fonts in `__root.tsx`.
```

- [ ] **Step 4: Update the Architecture section**

Replace:
```
- **App Router**: `src/app/page.tsx` (home) and `src/app/player/[id]/page.tsx` (player).
- **API Routes**: `src/app/api/transcribe/route.ts` (Groq Whisper), `src/app/api/postprocess/route.ts` (text normalization), `src/app/api/health/route.ts`.
```

With:
```
- **Routes**: `src/routes/index.tsx` (home), `src/routes/player.$fileId.tsx` (player), `src/routes/settings.tsx`, `src/routes/account.tsx`.
- **API Routes**: `src/routes/api/transcribe.ts` (Groq Whisper), `src/routes/api/postprocess.ts` (text normalization), `src/routes/api/health.ts`, `src/routes/api/performance.ts`.
```

- [ ] **Step 5: Update the Testing section**

Replace:
```
- **Runner**: Vitest with `@vitejs/plugin-react`.
- **Environment**: jsdom.
- **Mocked APIs**: `fake-indexeddb` for IndexedDB in tests.
- **Setup**: `src/__tests__/setup.ts`.
- **Coverage**: v8 provider; excludes `node_modules/`, `src/__tests__/`, `**/*.d.ts`, `**/*.config.*`, `**/types/**`.
```

With:
```
- **Runner**: `bun test` (built-in Bun test runner, compatible with vitest API).
- **Environment**: Bun's built-in DOM support (happy-dom compatible).
- **Note**: Some test files may need updates for `bun:test` vs `vitest` imports.
```

- [ ] **Step 6: Update the What to Avoid section**

Replace:
```
- Do not introduce ESLint/Prettier configs; Biome is the single source of truth.
- Do not use `npm`/`yarn`; lockfile is `pnpm-lock.yaml`.
- Do not add server-side database libraries (PostgreSQL, MongoDB, etc.). Data is client-side via IndexedDB.
- Keep imports grouped; Biome manages import order automatically.
```

With:
```
- Do not introduce ESLint/Prettier configs; Biome is the single source of truth.
- Do not use `npm`/`pnpm`/`yarn`/`node`; runtime is Bun, lockfile is `bun.lock`.
- Do not add server-side database libraries (yet; Phase 3 will add Drizzle/PostgreSQL).
- Do not add `tailwind.config.js/ts` or `postcss.config.js`; Tailwind v4 uses CSS-only config.
- Keep imports grouped; Biome manages import order automatically.
```

- [ ] **Step 7: Commit**

```bash
git add AGENTS.md
git commit -m "docs: update AGENTS.md for Bun runtime and new project structure"
```

---

## Task 15: Regenerate route tree and verify dev server starts

**Files:**
- Auto-generated: `src/routeTree.gen.ts`

- [ ] **Step 1: Start dev server to trigger route tree generation**

```bash
bun run dev &
sleep 8
kill %1 2>/dev/null
```

The dev server will automatically regenerate `src/routeTree.gen.ts` based on the new `src/routes/` directory.

- [ ] **Step 2: Verify routeTree.gen.ts was regenerated**

Run: `ls -la src/routeTree.gen.ts`
Expected: File exists and is recently modified.

- [ ] **Step 3: Run type check**

```bash
bun run type-check
```

Expected: No errors (or only pre-existing errors unrelated to this migration).

- [ ] **Step 4: Verify dev server starts cleanly**

```bash
timeout 15 bun run dev 2>&1 | head -20
```

Expected: Vite dev server starts on port 3000 without errors.

- [ ] **Step 5: Commit**

```bash
git add src/routeTree.gen.ts
git commit -m "chore: regenerate routeTree.gen.ts for new routes directory"
```

---

## Task 16: Run linter and format

**Files:**
- Potentially all source files (auto-formatted by Biome)

- [ ] **Step 1: Run Biome format**

```bash
bun run format
```

Expected: Files formatted. Some imports may get reordered by Biome.

- [ ] **Step 2: Run Biome check**

```bash
bun run lint
```

Expected: No new errors. Pre-existing warnings may exist.

- [ ] **Step 3: Commit any formatting changes**

```bash
git add -A
git diff --cached --stat
git commit -m "style: apply biome formatting after Phase 1 migration" || echo "No formatting changes needed"
```

---

## Task 17: Final verification — build and test

- [ ] **Step 1: Run a full build**

```bash
bun run build
```

Expected: Build completes successfully, `.output/` directory created.

- [ ] **Step 2: Run tests**

```bash
bun test
```

Expected: Tests may have some failures due to vitest→bun test API differences (e.g., `vi` → `jest` mock API). This is acceptable for Phase 1; test fixes are a follow-up.

- [ ] **Step 3: Verify the build output**

Run: `ls .output/server/index.mjs`
Expected: File exists.

- [ ] **Step 4: Final commit with all changes**

```bash
git add -A
git status
git commit -m "chore: Phase 1 complete — Bun runtime, Tailwind v4, directory restructure" || echo "Nothing to commit"
```

---

## Post-Phase 1 Notes

- Test files may need individual updates for `bun:test` vs `vitest` API differences (e.g., `vi.fn()` → `jest.fn()`, import paths).
- `process.env.NODE_ENV` references in ~15 files work fine — Bun and Vite both handle these natively.
- Phase 2 (Hono API migration) will handle `src/routes/api/*.ts` server functions.
- Phase 3 (Drizzle + PostgreSQL) will replace Dexie.
- Phase 4 (Better Auth + Dockerfile) will add authentication.
