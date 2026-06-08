# Next.js → TanStack Start Migration Design

> **Date:** 2025-01-28  
> **Scope:** Full-stack migration from Next.js 16 App Router to TanStack Start + Vite + TanStack Router (CSR SPA)  
> **Strategy:** File-level migration (方案 A) — preserve 90%+ business code, rewrite framework glue layer only.

---

## Design Part 1: Routing & Layout Migration

### Route Mapping

| Next.js Path | TanStack Router Path | Action |
|---|---|---|
| `src/app/layout.tsx` | `src/app/__root.tsx` | Rewrite: root layout, providers, `<head>` |
| `src/app/page.tsx` | `src/app/index.tsx` | Wrap with `createFileRoute('/')` |
| `src/app/player/[fileId]/page.tsx` | `src/app/player.$fileId.tsx` | Merge layout, use `Route.useParams()` |
| `src/app/settings/page.tsx` | `src/app/settings.tsx` | Wrap with `createFileRoute('/settings')` |
| `src/app/account/page.tsx` | `src/app/account.tsx` | Wrap with `createFileRoute('/account')` |
| `src/app/player/[fileId]/layout.tsx` | — | **Delete** (only exported metadata) |

### `__root.tsx` Responsibilities

1. **SEO `<head>`**: All metadata, viewport, OG/Twitter, manifest, fonts, JSON-LD, Clarity script via `createRootRoute({ head: () => ({ ... }) })`
2. **Global Providers**: Theme → TranscriptionLanguage → I18n → Monitoring → Query → ErrorBoundary (unchanged nesting)
3. **Global UI**: PWA register, ThemeDebugger, ToastContainer (unchanged)
4. **Router outlet**: `<Outlet />` replaces `children`

### Special Route Handling

| File | Migration |
|---|---|
| `opengraph-image.tsx` | Generate static `public/og-image.png`; reference in `__root.tsx` head |
| `twitter-image.tsx` | Reuse same static OG image |
| `sitemap.ts` | Convert to static `public/sitemap.xml` |
| `robots.ts` | Convert to static `public/robots.txt` |

---

## Design Part 2: API Route Migration

### File Mapping

| Next.js | TanStack Start | Methods |
|---|---|---|
| `src/app/api/transcribe/route.ts` | `src/app/api/transcribe.ts` | `POST` |
| `src/app/api/postprocess/route.ts` | `src/app/api/postprocess.ts` | `POST` |
| `src/app/api/health/route.ts` | `src/app/api/health.ts` | `GET`, `HEAD` |
| `src/app/api/performance/route.ts` | `src/app/api/performance.ts` | `POST`, `GET` |

### Transformation Pattern

```ts
// Before
import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  return NextResponse.json({ ... });
}

// After
import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute('/api/transcribe')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        return Response.json({ ... });
      }
    }
  }
});
```

### Utility Function Updates

| Function | File | Change |
|---|---|---|
| `apiSuccess` | `src/lib/utils/api-response.ts` | `NextResponse.json` → `Response.json` |
| `apiError` | `src/lib/utils/api-response.ts` | `NextResponse.json` → `Response.json` |
| `getClientIdentifier` | `src/lib/utils/rate-limiter.ts` | Parameter: `NextRequest` → `Request` |
| `apiFromError` | `src/lib/utils/api-response.ts` | Return type: `NextResponse` → `Response` |

### Tests

- Replace `new NextRequest(...)` with `new Request(...)` in API route tests
- Update `vi.mock("next/navigation")` to mock `@tanstack/react-router` in setup

---

## Design Part 3: Components & Navigation Migration

### Navigation (`src/components/ui/Navigation.tsx`)

| Before | After |
|---|---|
| `import Link from "next/link"` | `import { Link } from "@tanstack/react-router"` |
| `import { usePathname } from "next/navigation"` | `import { useLocation } from "@tanstack/react-router"` |
| `href="/settings"` | `to="/settings"` |
| `usePathname()` | `useLocation().pathname` |

### PlayerPage (`src/components/features/player/PlayerPage.tsx`)

| Before | After |
|---|---|
| `import { useRouter } from "next/navigation"` | `import { useNavigate } from "@tanstack/react-router"` |
| `const router = useRouter()` | `const navigate = useNavigate()` |
| `router.push("/")` | `navigate({ to: "/" })` |

### Player Route Wrapper (`src/app/player.$fileId.tsx`)

| Before | After |
|---|---|
| `import { useParams } from "next/navigation"` | `const { fileId } = Route.useParams()` |
| `"use client"` directive | **Remove** (route files are client by default) |

### AccountSection Image (`src/components/features/settings/page/AccountSection.tsx`)

- Replace `next/image` `<Image>` with standard `<img>` (single 40×40 icon, no optimization needed)

### Environment Variables (Client-Side)

| Current | New | Where |
|---|---|---|
| `process.env.NODE_ENV === "development"` | `import.meta.env.DEV` | 11 files across components/lib |
| `NEXT_PUBLIC_APP_URL` | `VITE_APP_URL` | `__root.tsx`, `.env` |
| `process.env.NEXT_PUBLIC_*` | `import.meta.env.VITE_*` | Any client code |

**Files with `process.env.NODE_ENV` to update:**
1. `src/components/layout/contexts/ThemeContext.tsx`
2. `src/components/ui/ThemeDebugger.tsx`
3. `src/components/ui/PwaRegister.tsx`
4. `src/components/ui/ErrorBoundary.tsx`
5. `src/components/layout/providers/QueryProvider.tsx`
6. `src/components/features/player/PlayerErrorBoundary.tsx`
7. `src/lib/utils/web-vitals.ts`
8. `src/lib/utils/manual-postprocess.ts`
9. `src/lib/utils/transcription-error-handler.ts`
10. `src/lib/utils/logger.ts`

### Script Component (`next/script`)

- Microsoft Clarity script: embed directly in `__root.tsx` `head.scripts` array or as raw `<script>` in `RootLayout` component

### `proxy.ts`

- **Delete** — unused, contains only Next.js-specific types

---

## Design Part 4: Build Configuration & Dependencies

### New Files

| File | Purpose |
|---|---|
| `vite.config.ts` | Vite + TanStack Start plugin + React plugin + path alias |
| `src/router.tsx` | Explicit router instance creation (`createRouter`) |
| `src/app/__root.tsx` | Root layout with head, providers, outlet |
| `src/app/index.tsx` | Home route |
| `src/app/player.$fileId.tsx` | Player dynamic route |
| `src/app/settings.tsx` | Settings route |
| `src/app/account.tsx` | Account route |
| `src/app/api/transcribe.ts` | Transcription API |
| `src/app/api/postprocess.ts` | Post-processing API |
| `src/app/api/health.ts` | Health check API |
| `src/app/api/performance.ts` | Performance metrics API |

### Modified Files

| File | Change |
|---|---|
| `package.json` | Remove `next`; add `@tanstack/react-router`, `@tanstack/react-start`, `vite`; update scripts |
| `tsconfig.json` | Remove `next` plugin; update `include`/`exclude` |
| `tailwind.config.ts` | Update `content` array (remove `pages`, keep `app`) |
| `vitest.config.ts` | Update `exclude` (`.output` instead of `.next`) |
| `biome.json` | Add `.output` and `dist` to ignores |
| `.env.example` | `NEXT_PUBLIC_APP_URL` → `VITE_APP_URL` |
| `src/lib/utils/api-response.ts` | `NextResponse` → `Response` |
| `src/lib/utils/rate-limiter.ts` | `NextRequest` → `Request` |
| `src/components/ui/Navigation.tsx` | `next/link` → `@tanstack/react-router` |
| `src/components/features/player/PlayerPage.tsx` | `useRouter` → `useNavigate` |
| `src/components/features/settings/page/AccountSection.tsx` | `next/image` → `<img>` |
| `src/__tests__/setup.ts` | Mock `next/navigation` → mock `@tanstack/react-router` |

### Deleted Files

- `next.config.js`
- `next-env.d.ts`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/player/[fileId]/page.tsx`
- `src/app/player/[fileId]/layout.tsx`
- `src/app/settings/page.tsx`
- `src/app/account/page.tsx`
- `src/app/api/**/route.ts` (4 files)
- `src/app/opengraph-image.tsx`
- `src/app/twitter-image.tsx`
- `src/app/sitemap.ts`
- `src/app/robots.ts`
- `src/proxy.ts`

### Build & Deployment

| Aspect | Before (Next.js) | After (TanStack Start) |
|---|---|---|
| Dev server | `next dev` (port 3000) | `vite dev` (port 3000) |
| Build | `next build` → `.next/` | `vite build` → `.output/` |
| Start | `next start` | `node .output/server/index.mjs` |
| Output mode | `standalone` | Default (Nitro) |
| Security headers | `next.config.js` headers | Reverse proxy or Nitro config |

### Vite Config (`vite.config.ts`)

```ts
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  server: { port: 3000 },
  resolve: {
    alias: { "@": resolve(__dirname, "./src") },
  },
  plugins: [
    tanstackStart({ srcDirectory: "src", router: { routesDirectory: "app" } }),
    viteReact(),
  ],
});
```

### Router Entry (`src/router.tsx`)

```tsx
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({ routeTree, scrollRestoration: true });
}
```

---

## Dependencies Summary

### Removed
- `next`

### Added
- `@tanstack/react-router`
- `@tanstack/react-start`
- `vite`

### Unchanged (all business dependencies)
- `react`, `react-dom`, `typescript`, `tailwindcss`
- `@tanstack/react-query`, `dexie`, `groq-sdk`, `zod`
- All Radix UI, shadcn/ui, `lucide-react`, `sonner`
- `vitest`, `@vitejs/plugin-react`, `fake-indexeddb`

---

## Risk & Mitigation

| Risk | Mitigation |
|---|---|
| Route tree generation fails | Ensure all `createFileRoute` calls have correct path matching file location |
| `import.meta.env` types missing | Add `vite/client` to `tsconfig.json` `types` |
| CSS not loading | Verify `globals.css` is imported in `__root.tsx` via `?url` |
| OG images lost | Generate static `og-image.png`, update social sharing refs |
| API tests failing | Update `NextRequest` mocks to standard `Request` |
| Service Worker issues | Verify `public/sw.js` still served at root from `public/` |

---

## Approval

Design reviewed and approved by user on 2025-01-28.
