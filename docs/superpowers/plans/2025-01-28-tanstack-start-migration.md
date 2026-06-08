# Next.js → TanStack Start 迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 shadowing-learning 项目从 Next.js 16 完全迁移到 TanStack Start + Vite + TanStack Router（默认 CSR SPA 模式），保留 90%+ 业务逻辑。

**Architecture:** 保留 `src/components/`、`src/hooks/`、`src/lib/db/`、`src/types/` 等业务代码不变，仅重写框架胶水层：`package.json` scripts、`vite.config.ts`、路由文件、`__root.tsx`、API routes（标准 Web `Request`/`Response`）、导航组件（`Link`/`useNavigate`/`useLocation`）。

**Tech Stack:** React 19 + TypeScript 严格模式 + Tailwind CSS 3.4 + Vite + TanStack Router + TanStack Start + TanStack Query + Dexie + Biome + Vitest

---

## Phase 1: 基础配置迁移

### Task 1: 安装 TanStack Start 依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 添加依赖**

Run:
```bash
pnpm add @tanstack/react-router @tanstack/react-start
pnpm add -D vite
```

- [ ] **Step 2: commit**

```bash
git add package.json pnpm-lock.yaml
pnpm install
```

---

### Task 2: 更新 package.json scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 替换 scripts**

将 `scripts` 对象替换为：

```json
"scripts": {
  "dev": "vite dev",
  "build": "vite build",
  "start": "node .output/server/index.mjs",
  "preview": "vite preview",
  "lint": "biome check .",
  "format": "biome format . --write",
  "type-check": "tsc --noEmit",
  "test": "vitest",
  "test:run": "vitest run",
  "test:coverage": "vitest run --coverage",
  "clean": "rm -rf .output dist node_modules/.cache",
  "prepare": "husky"
}
```

- [ ] **Step 2: commit**

```bash
git add package.json
git commit -m "chore: update package.json scripts for tanstack start"
```

---

### Task 3: 创建 vite.config.ts

**Files:**
- Create: `vite.config.ts`

- [ ] **Step 1: 写入配置**

```ts
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  plugins: [
    tanstackStart({
      srcDirectory: "src",
      router: {
        routesDirectory: "app",
      },
    }),
    viteReact(),
  ],
});
```

- [ ] **Step 2: commit**

```bash
git add vite.config.ts
git commit -m "chore: add vite.config.ts with tanstack start"
```

---

### Task 4: 更新 tsconfig.json

**Files:**
- Modify: `tsconfig.json`

- [ ] **Step 1: 修改 compilerOptions**

从 `compilerOptions.plugins` 中删除：
```json
{
  "name": "next"
}
```

将 `include` 数组从：
```json
"include": [
  "next-env.d.ts",
  "**/*.ts",
  "**/*.tsx",
  ".next/types/**/*.ts",
  ".next/dev/types/**/*.ts"
]
```
改为：
```json
"include": [
  "**/*.ts",
  "**/*.tsx"
]
```

将 `exclude` 数组从：
```json
"exclude": ["node_modules"]
```
改为：
```json
"exclude": ["node_modules", ".output", "dist"]
```

- [ ] **Step 2: 创建 vite 类型声明文件**

Create `vite-env.d.ts`：
```ts
/// <reference types="vite/client" />
```

- [ ] **Step 3: commit**

```bash
git add tsconfig.json vite-env.d.ts
git commit -m "chore: update tsconfig for vite (remove next, add .output exclusion)"
```

---

### Task 5: 更新 Tailwind / Vitest / Biome 配置

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `vitest.config.ts`
- Modify: `biome.json`

- [ ] **Step 1: tailwind.config.ts**

将 `content` 数组中的 `./src/pages/**/*` 行删除（如果有），确保只保留：
```ts
content: [
  "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
],
```

- [ ] **Step 2: vitest.config.ts**

将 `exclude` 数组中的 `".next"` 改为 `".output"`：
```ts
exclude: ["node_modules", ".output", "dist"],
```

- [ ] **Step 3: biome.json**

确保 `ignores` 包含 `.output` 和 `dist`。在 `files` 对象中添加（如果不存在）：
```json
"files": {
  "ignoreUnknown": true,
  "includes": ["src/**/*.ts", "src/**/*.tsx", "*.json", "*.js", "*.ts", "*.tsx", "*.mjs", "*.cjs"],
  "ignores": [".output", "dist", "node_modules"]
}
```

- [ ] **Step 4: commit**

```bash
git add tailwind.config.ts vitest.config.ts biome.json
git commit -m "chore: update tailwind, vitest, biome for vite"
```

---

### Task 6: 环境变量迁移

**Files:**
- Modify: `.env.example`
- Create: `.env` (if not exists, copy from `.env.example`)

- [ ] **Step 1: 更新 .env.example**

将内容替换为：
```bash
# 服务端环境变量（API routes 可用）
GROQ_API_KEY=your_groq_api_key_here
PERFORMANCE_ADMIN_TOKEN=optional_admin_token

# 客户端环境变量（Vite 暴露 to 浏览器，必须以 VITE_ 开头）
VITE_APP_URL=http://localhost:3000
```

- [ ] **Step 2: 如果有 .env.local，同步更新**

如果存在 `.env` 或 `.env.local`，将 `NEXT_PUBLIC_APP_URL` 改为 `VITE_APP_URL`。

- [ ] **Step 3: commit**

```bash
git add .env.example .env .env.local
git commit -m "chore: migrate env vars from NEXT_PUBLIC_ to VITE_ prefix"
```

---

## Phase 2: 工具层迁移（优先完成，因为 API routes 依赖）

### Task 7: 迁移 api-response.ts（NextResponse → Response）

**Files:**
- Modify: `src/lib/utils/api-response.ts`

- [ ] **Step 1: 替换全部 NextResponse 为 Response**

删除 `import { NextResponse } from "next/server";`。

修改 `apiSuccess`：
```ts
export function apiSuccess(data: unknown, status: number = 200) {
  return Response.json(
    {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        pragma: "no-cache",
        expires: "0",
      },
    },
  );
}
```

修改 `apiError`：
```ts
export function apiError(error: AppError & { headers?: Record<string, string> }) {
  const { headers: customHeaders, ...errorData } = error;
  return Response.json(
    {
      success: false,
      error: {
        code: errorData.code,
        message: errorData.message,
        details: errorData.details,
      },
      timestamp: new Date().toISOString(),
    },
    {
      status: errorData.statusCode,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        pragma: "no-cache",
        expires: "0",
        ...customHeaders,
      },
    },
  );
}
```

修改 `apiNoContent`：
```ts
export function apiNoContent() {
  return new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      pragma: "no-cache",
      expires: "0",
    },
  });
}
```

- [ ] **Step 2: commit**

```bash
git add src/lib/utils/api-response.ts
git commit -m "refactor: migrate api-response from NextResponse to standard Response"
```

---

### Task 8: 确认 rate-limiter.ts 兼容性

**Files:**
- Verify: `src/lib/utils/rate-limiter.ts`

- [ ] **Step 1: 验证当前代码**

检查 `rate-limiter.ts` 第 194 行 `getClientIdentifier` 的签名是否为 `Request` 类型（从之前读取的内容来看已经是 `Request`，没有 Next.js 依赖）。确认该文件没有从 `next` 导入任何内容。

- [ ] **Step 2: 如无需改动则提交验证结果**

如果确实没有 Next.js 依赖的遗留，直接标记此 Task 完成，无需 commit。

---

## Phase 3: 路由与页面迁移

### Task 9: 创建 router.tsx

**Files:**
- Create: `src/router.tsx`

- [ ] **Step 1: 写入 router 入口**

```tsx
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
  });
  return router;
}
```

- [ ] **Step 2: commit**

```bash
git add src/router.tsx
git commit -m "chore: add tanstack router entry"
```

---

### Task 10: 创建 __root.tsx（根布局）

**Files:**
- Create: `src/app/__root.tsx`

- [ ] **Step 1: 写入 __root.tsx**

```tsx
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import appCss from "../styles/globals.css?url";
import { I18nProvider } from "@/components/layout/contexts/I18nContext";
import { ThemeProvider } from "@/components/layout/contexts/ThemeContext";
import { TranscriptionLanguageProvider } from "@/components/layout/contexts/TranscriptionLanguageContext";
import { QueryProvider } from "@/components/layout/providers/QueryProvider";
import { PageErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ToastContainer } from "@/components/ui/ErrorToast";
import { MonitoringInitializer } from "@/components/ui/MonitoringInitializer";
import PwaRegister from "@/components/ui/PwaRegister";
import { ThemeDebuggerToggle } from "@/components/ui/ThemeDebugger";

const SITE_NAME = "影子跟读 Shadowing";
const SITE_DESCRIPTION =
  "影子跟读 Shadowing 是一款基于 AI 的语言跟读练习应用，支持音频自动转录、字幕同步、逐句翻译，覆盖中文、英语、日语、韩语等多语种学习场景。";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: "影子跟读 Shadowing - AI 驱动的多语言跟读学习工具" },
      { name: "description", content: SITE_DESCRIPTION },
      { name: "application-name", content: SITE_NAME },
      { name: "robots", content: "index, follow" },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "zh_CN" },
      { property: "og:title", content: "影子跟读 Shadowing - AI 驱动的多语言跟读学习工具" },
      { property: "og:description", content: SITE_DESCRIPTION },
      { property: "og:site_name", content: SITE_NAME },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "影子跟读 Shadowing - AI 驱动的多语言跟读学习工具" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: SITE_NAME },
    ],
    links: [
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", href: "/icon.png" },
      { rel: "apple-touch-icon", href: "/icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
    scripts: [
      {
        type: "application/ld+json",
        text: JSON.stringify([
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: SITE_NAME,
            applicationCategory: "EducationalApplication",
            operatingSystem: "Web",
            inLanguage: ["zh-CN", "zh-TW", "en", "ja", "ko"],
            offers: { "@type": "Offer", price: "0", priceCurrency: "CNY" },
            description: SITE_DESCRIPTION,
          },
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: SITE_NAME,
            inLanguage: ["zh-CN", "zh-TW", "en", "ja", "ko"],
            description: SITE_DESCRIPTION,
          },
        ]),
      },
    ],
  }),
  component: RootLayout,
});

function RootLayout() {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Microsoft Clarity — inline script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","wmm91mbi3i");`,
          }}
        />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <ThemeProvider defaultTheme="system">
          <TranscriptionLanguageProvider>
            <I18nProvider>
              <MonitoringInitializer />
              <QueryProvider>
                <PageErrorBoundary>
                  <div className="relative min-h-screen">
                    <Outlet />
                  </div>
                </PageErrorBoundary>
              </QueryProvider>
              <ThemeDebuggerToggle />
              <PwaRegister />
              <ToastContainer>{null}</ToastContainer>
            </I18nProvider>
          </TranscriptionLanguageProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
```

- [ ] **Step 2: commit**

```bash
git add src/app/__root.tsx
git commit -m "feat: add tanstack root layout with providers and seo head"
```

---

### Task 11: 迁移首页 index.tsx

**Files:**
- Create: `src/app/index.tsx`
- Delete: `src/app/page.tsx` (after confirming index.tsx works)

- [ ] **Step 1: 写入 index.tsx**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import FileManager from "@/components/features/file/FileManager";
import StatsCards from "@/components/features/file/StatsCards";
import { PageLoadingState } from "@/components/ui/LoadingState";
import Navigation from "@/components/ui/Navigation";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="relative flex min-h-screen w-full flex-col">
      <Navigation />
      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8 mt-24">
        <div className="mx-auto max-w-5xl">
          <Suspense fallback={<PageLoadingState />}>
            <div className="mb-8">
              <StatsCards />
            </div>
            <FileManager />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: commit**

```bash
git add src/app/index.tsx
git commit -m "feat: migrate home page to tanstack router"
```

---

### Task 12: 迁移设置页 settings.tsx

**Files:**
- Create: `src/app/settings.tsx`

- [ ] **Step 1: 写入 settings.tsx**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import SettingsPage from "@/components/features/settings/SettingsPage";
import Navigation from "@/components/ui/Navigation";

export const Route = createFileRoute("/settings")({
  component: SettingsRoute,
});

function SettingsRoute() {
  return (
    <div className="relative flex min-h-screen w-full flex-col">
      <Navigation />
      <main className="flex-1">
        <div className="flex-1 px-4 py-8 sm:px-6 lg:px-8 mt-24">
          <div className="mx-auto max-w-4xl">
            <SettingsPage />
          </div>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: commit**

```bash
git add src/app/settings.tsx
git commit -m "feat: migrate settings page to tanstack router"
```

---

### Task 13: 迁移账户页 account.tsx

**Files:**
- Create: `src/app/account.tsx`

- [ ] **Step 1: 写入 account.tsx**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import AccountPage from "@/components/features/settings/AccountPage";
import Navigation from "@/components/ui/Navigation";

export const Route = createFileRoute("/account")({
  component: AccountRoute,
});

function AccountRoute() {
  return (
    <div className="relative flex min-h-screen w-full flex-col">
      <Navigation />
      <main className="flex-1">
        <div className="flex-1 px-4 py-8 sm:px-6 lg:px-8 mt-24">
          <div className="mx-auto max-w-4xl">
            <AccountPage />
          </div>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: commit**

```bash
git add src/app/account.tsx
git commit -m "feat: migrate account page to tanstack router"
```

---

### Task 14: 迁移播放器动态路由 player.$fileId.tsx

**Files:**
- Create: `src/app/player.$fileId.tsx`

- [ ] **Step 1: 写入 player.$fileId.tsx**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import PlayerErrorBoundary from "@/components/features/player/PlayerErrorBoundary";
import PlayerPageComponent from "@/components/features/player/PlayerPage";

export const Route = createFileRoute("/player/$fileId")({
  component: PlayerRoute,
});

function PlayerRoute() {
  const { fileId } = Route.useParams();
  return (
    <PlayerErrorBoundary>
      <PlayerPageComponent fileId={fileId} />
    </PlayerErrorBoundary>
  );
}
```

- [ ] **Step 2: commit**

```bash
git add src/app/player.\$fileId.tsx
git commit -m "feat: migrate player dynamic route to tanstack router"
```

---

## Phase 4: API 路由迁移

### Task 15: 迁移 /api/health

**Files:**
- Create: `src/app/api/health.ts`

- [ ] **Step 1: 写入 health.ts**

```ts
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({ status: "ok", timestamp: Date.now() }),
      HEAD: async () => new Response(null, { status: 200 }),
    },
  },
});
```

- [ ] **Step 2: commit**

```bash
git add src/app/api/health.ts
git commit -m "feat: migrate /api/health to tanstack start server route"
```

---

### Task 16: 迁移 /api/transcribe

**Files:**
- Create: `src/app/api/transcribe.ts`

- [ ] **Step 1: 创建 transcribe.ts**

将 `src/app/api/transcribe/route.ts` 的内容（除 `NextRequest`/`NextResponse` 导入外）复制到 `src/app/api/transcribe.ts`，然后做以下调整：

- 删除 `import type { NextRequest, NextResponse } from "next/server";`
- 删除 `export const runtime = "nodejs";`
- 删除 `export async function POST(request: NextRequest) {`
- 替换为：

```ts
export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
```

- 将 `processTranscription` 返回类型中的 `{ success: false; error: NextResponse }` 改为 `{ success: false; error: Response }`
- 将函数末尾的 `}` 闭合改为：

```ts
      }
    }
  }
});
```

- 在文件顶部添加：`import { createFileRoute } from "@tanstack/react-router";`

- [ ] **Step 2: 更新测试文件**

如果存在 `src/app/api/transcribe/__tests__/route.test.ts`：
- 删除 `import { NextRequest } from "next/server";`
- 将所有 `new NextRequest(...)` 替换为 `new Request(...)`

- [ ] **Step 3: commit**

```bash
git add src/app/api/transcribe.ts
git commit -m "feat: migrate /api/transcribe to tanstack start server route"
```

---

### Task 17: 迁移 /api/postprocess

**Files:**
- Create: `src/app/api/postprocess.ts`

- [ ] **Step 1: 创建 postprocess.ts**

参考 Task 16 的模式：
- 删除 `import type { NextRequest } from "next/server";`
- 删除 `export const runtime = "nodejs";`
- 添加 `import { createFileRoute } from "@tanstack/react-router";`
- 包裹为：

```ts
export const Route = createFileRoute("/api/postprocess")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // ... original POST body ...
      }
    }
  }
});
```

- [ ] **Step 2: commit**

```bash
git add src/app/api/postprocess.ts
git commit -m "feat: migrate /api/postprocess to tanstack start server route"
```

---

### Task 18: 迁移 /api/performance

**Files:**
- Create: `src/app/api/performance.ts`

- [ ] **Step 1: 创建 performance.ts**

参考 Task 16 的模式：
- 删除 `import { type NextRequest, NextResponse } from "next/server";`
- 删除 `export const runtime = "nodejs";`
- 添加 `import { createFileRoute } from "@tanstack/react-router";`
- 将两个导出函数改为 handlers 对象：

```ts
export const Route = createFileRoute("/api/performance")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // ... original POST body (replace NextResponse.json with Response.json) ...
      },
      GET: async ({ request }) => {
        // ... original GET body (replace NextResponse.json with Response.json) ...
      }
    }
  }
});
```

- [ ] **Step 2: commit**

```bash
git add src/app/api/performance.ts
git commit -m "feat: migrate /api/performance to tanstack start server route"
```

---

## Phase 5: 组件与导航迁移

### Task 19: 迁移 Navigation.tsx

**Files:**
- Modify: `src/components/ui/Navigation.tsx`

- [ ] **Step 1: 替换导入**

删除：
```ts
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
```

替换为：
```ts
import { Link, useLocation } from "@tanstack/react-router";
```

在组件内部：
- `const pathname = usePathname();` → `const { pathname } = useLocation();`
- 所有 `<Link href={item.href} ...>` → `<Link to={item.href} ...>`

- [ ] **Step 2: commit**

```bash
git add src/components/ui/Navigation.tsx
git commit -m "refactor: migrate Navigation to tanstack router Link and useLocation"
```

---

### Task 20: 迁移 PlayerPage.tsx

**Files:**
- Modify: `src/components/features/player/PlayerPage.tsx`

- [ ] **Step 1: 替换导入与 hooks**

删除：
```ts
"use client";
import { useRouter } from "next/navigation";
```

替换为：
```ts
import { useNavigate } from "@tanstack/react-router";
```

在组件内部：
- `const router = useRouter();` → `const navigate = useNavigate();`
- `router.push("/")` → `navigate({ to: "/" })`

- [ ] **Step 2: commit**

```bash
git add src/components/features/player/PlayerPage.tsx
git commit -m "refactor: migrate PlayerPage from next/navigation to tanstack router"
```

---

### Task 21: 迁移 AccountSection.tsx（图片组件）

**Files:**
- Modify: `src/components/features/settings/page/AccountSection.tsx`

- [ ] **Step 1: 替换 Image**

将：`import Image from "next/image";` 和 `<Image src="/icon.png" alt="User" width={40} height={40} />`

替换为：
```tsx
<img src="/icon.png" alt="User" width={40} height={40} className="rounded-full" />
```

- [ ] **Step 2: commit**

```bash
git add src/components/features/settings/page/AccountSection.tsx
git commit -m "refactor: replace next/image with standard img in AccountSection"
```

---

### Task 22: 更新测试 setup.ts（mock next/navigation）

**Files:**
- Modify: `src/__tests__/setup.ts`

- [ ] **Step 1: 替换 mock**

将：
```ts
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
```

替换为：
```ts
vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual("@tanstack/react-router");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: "/", search: {}, hash: "" }),
    useSearch: () => ({}),
    useParams: () => ({}),
    Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  };
});
```

- [ ] **Step 2: commit**

```bash
git add src/__tests__/setup.ts
git commit -m "test: update vitest setup to mock tanstack router instead of next/navigation"
```

---

## Phase 6: 清理与验证

### Task 23: 删除 Next.js 专属文件

**Files:**
- Delete: `next.config.js`
- Delete: `next-env.d.ts`
- Delete: `src/proxy.ts`
- Delete: `src/app/layout.tsx`
- Delete: `src/app/page.tsx`
- Delete: `src/app/player/[fileId]/page.tsx`
- Delete: `src/app/player/[fileId]/layout.tsx`
- Delete: `src/app/settings/page.tsx`
- Delete: `src/app/account/page.tsx`
- Delete: `src/app/api/transcribe/route.ts`
- Delete: `src/app/api/postprocess/route.ts`
- Delete: `src/app/api/health/route.ts`
- Delete: `src/app/api/performance/route.ts`
- Delete: `src/app/opengraph-image.tsx`
- Delete: `src/app/twitter-image.tsx`
- Delete: `src/app/sitemap.ts`
- Delete: `src/app/robots.ts`

- [ ] **Step 1: 执行删除**

```bash
git rm next.config.js next-env.d.ts src/proxy.ts \
  src/app/layout.tsx src/app/page.tsx \
  src/app/player/\[fileId\]/page.tsx \
  src/app/player/\[fileId\]/layout.tsx \
  src/app/settings/page.tsx src/app/account/page.tsx \
  src/app/api/transcribe/route.ts \
  src/app/api/postprocess/route.ts \
  src/app/api/health/route.ts \
  src/app/api/performance/route.ts \
  src/app/opengraph-image.tsx \
  src/app/twitter-image.tsx \
  src/app/sitemap.ts \
  src/app/robots.ts

# Also remove empty directories if any
rmdir src/app/player/\[fileId\] 2>/dev/null || true
```

- [ ] **Step 2: commit**

```bash
git commit -m "chore: remove all next.js specific files"
```

---

### Task 24: 创建静态 SEO 文件

**Files:**
- Create: `public/robots.txt`
- Create: `public/sitemap.xml`

- [ ] **Step 1: robots.txt**

```
User-agent: *
Allow: /
Disallow: /player/
Disallow: /settings
Disallow: /account
Sitemap: /sitemap.xml
```

- [ ] **Step 2: sitemap.xml**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>http://localhost:3000/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

- [ ] **Step 3: commit**

```bash
git add public/robots.txt public/sitemap.xml
git commit -m "chore: add static robots.txt and sitemap.xml"
```

---

### Task 25: 安装依赖并验证 dev server 启动

**Files:**
- None (verification task)

- [ ] **Step 1: 安装依赖**

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

- [ ] **Step 2: 运行类型检查**

```bash
pnpm type-check
```

Expected: 如果 `routeTree.gen.ts` 的自动类型尚未生成，可能会有类型错误（因为文件还不存在）。这是正常的 —— 第一次 `pnpm dev` 会触发 TanStack Start 插件生成路由树。

- [ ] **Step 3: 启动 dev server**

```bash
pnpm dev
```

Expected: Vite dev server 在 port 3000 启动，控制台无致命错误。浏览器访问 `http://localhost:3000` 应能看到首页。

- [ ] **Step 4: 验证路由**

在浏览器中测试：
- `http://localhost:3000/` → 首页正常
- `http://localhost:3000/settings` → 设置页面正常
- `http://localhost:3000/account` → 账户页面正常
- `http://localhost:3000/player/123` → 播放器渲染（可能显示文件不存在状态，但路由解析正常）
- `http://localhost:3000/api/health` → 返回 `{"status":"ok",...}`

- [ ] **Step 5: commit**

```bash
git add -A
git commit -m "chore: verify dev server starts successfully"
```

---

### Task 26: 运行 lint、format、test

**Files:**
- Various (verification task)

- [ ] **Step 1: 格式化代码**

```bash
pnpm format
```

- [ ] **Step 2: Lint**

```bash
pnpm lint
```

Expected: 如果存在类型声明问题（如 `process.env.NODE_ENV` 在客户端的类型警告），先处理 Biome 问题（非 TypeScript）。TypeScript 类型问题在 `type-check` 中处理。

- [ ] **Step 3: 运行测试**

```bash
pnpm test:run
```

Expected: 所有现有测试通过（除了可能涉及 Next.js mock 的测试，这些已经在 Task 22 更新）。

- [ ] **Step 4: commit 修复**

```bash
git add -A
git commit -m "style: apply biome format fixes"
```

---

## Self-Review Checklist

| Spec 需求 | 对应 Task | 备注 |
|---|---|---|
| 路由映射 | Task 9-14 | ✅ 全部覆盖 |
| `__root.tsx` 含 SEO + Provider | Task 10 | ✅ HeadContent + Providers + Outlet |
| API routes (4 条) | Task 15-18 | ✅ 全部覆盖 |
| `api-response.ts` NextResponse → Response | Task 7 | ✅ 全部替换 |
| `rate-limiter.ts` 兼容性 | Task 8 | ✅ 已是标准 Request，无需改动 |
| Navigation (Link + useLocation) | Task 19 | ✅ |
| PlayerPage (useNavigate) | Task 20 | ✅ |
| AccountSection (img) | Task 21 | ✅ |
| 测试 mock 更新 | Task 22 | ✅ |
| vite.config.ts | Task 3 | ✅ |
| package.json scripts | Task 2 | ✅ |
| tsconfig.json 调整 | Task 4 | ✅ |
| Tailwind/Vitest/Biome 更新 | Task 5 | ✅ |
| 环境变量 | Task 6 | ✅ |
| 删除 Next.js 文件 | Task 23 | ✅ 完整清单 |
| 静态 SEO 文件 | Task 24 | ✅ robots + sitemap |
| dev server 验证 | Task 25 | ✅ |
| lint/test 验证 | Task 26 | ✅ |

**Placeholder scan:** 无 TBD/TODO/"implement later"。

**Type consistency:** `Response.json` 和 `new Response` 在 Task 7 和 Task 15-18 中一致；`useNavigate` 在 Task 20 中唯一；`useLocation` 在 Task 19 中唯一。

---

**Plan saved to:** `docs/superpowers/plans/2025-01-28-tanstack-start-migration.md`

## 下一步执行选项

**1. Subagent-Driven（推荐）** — 我按 Task 逐个分派子代理执行，每个 Task 完成后向你汇报。

**2. Inline Execution** — 我在当前会话中批量执行任务，每几个 Task 设一个检查点。

**你准备用哪种方式执行？**
