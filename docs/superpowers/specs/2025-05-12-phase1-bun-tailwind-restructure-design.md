# Phase 1: 运行时 + 目录结构 + CSS 迁移设计

> **Date:** 2025-05-12
> **Scope:** Bun runtime、目录结构重组、Tailwind v3→v4、Vitest→bun test、路径别名 @→~
> **Prerequisite:** Phase 1 完成后项目能在 Bun 下 dev/build/test

---

## 1. 运行时迁移（pnpm/Node → Bun）

### 变更项
- 删除 `packageManager` 字段和 `engines` 字段
- 所有 scripts 命令从 pnpm/node 切换到 bun
- 删除 `pnpm-lock.yaml`，生成 `bun.lock`
- 删除 `bun.lock`（旧格式）
- 删除 husky（Bun 不需要）
- `start` script 从 `node .output/server/index.mjs` 改为 `bun run .output/server/index.mjs`

### 依赖调整
- 删除 devDeps: `autoprefixer`, `postcss`, `@vitejs/plugin-react`, `vitest`, `@vitest/coverage-v8`, `jsdom`, `fake-indexeddb`, `@testing-library/jest-dom`, `@testing-library/react`, `@testing-library/user-event`, `husky`
- 删除 deps: `isomorphic-dompurify`（评估是否保留）
- 添加 deps: `tailwindcss` (v4), `@tailwindcss/vite`
- 保留所有 Radix UI、shadcn 相关、TanStack、groq-sdk、dexie（Phase 3 再移）、zod、sonner、lucide-react 等

### 测试迁移
- `vitest` → `bun test`
- 删除 `vitest.config.ts`
- 删除 `src/__tests__/setup.ts`（bun test 不需要 vitest 的 setupFile）
- 测试文件从 `*.test.tsx` 继续工作（bun test 兼容 vitest API）

---

## 2. 目录结构重组

### 路由目录
- `src/app/` → `src/routes/`
- `src/app/__root.tsx` → `src/routes/__root.tsx`
- `src/app/index.tsx` → `src/routes/index.tsx`
- `src/app/settings.tsx` → `src/routes/settings.tsx`
- `src/app/account.tsx` → `src/routes/account.tsx`
- `src/app/player.$fileId.tsx` → `src/routes/player.$fileId.tsx`
- `src/app/api/` → `src/routes/api/`（Phase 2 会进一步迁移到 Hono）

### CSS
- `src/styles/globals.css` → `src/styles/app.css`

### 路径别名
- `@/*` → `~/*`（tsconfig.json + vite.config.ts + 所有 import 语句）

---

## 3. Tailwind v3 → v4

### 删除文件
- `tailwind.config.ts`（120 行，所有 theme 迁移到 CSS @theme）
- `postcss.config.js`

### CSS 入口文件改造
- `src/styles/globals.css` → `src/styles/app.css`
- 替换 `@tailwind base/components/utilities` 为 `@import "tailwindcss";`
- 将 `tailwind.config.ts` 中的所有颜色/间距/圆角/阴影映射移入 CSS `@theme {}` 块
- 保留所有 CSS 变量定义（`@layer base` 中的主题变量不动）

### Vite 配置
- 添加 `@tailwindcss/vite` 插件替代 PostCSS pipeline
- 删除 `@vitejs/plugin-react`（Bun 原生处理 React）

---

## 4. TypeScript 配置

- 添加 `"verbatimModuleSyntax": true`
- 路径别名 `"@/*"` → `"~/*"`
- 删除 `"allowJs": true`（Bun 不需要）

---

## 5. Biome 配置

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

---

## 6. Dockerfile 重写

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

---

## 7. import 路径全局替换

所有文件中的 `@/` 替换为 `~/`：
- `@/components/` → `~/components/`
- `@/hooks/` → `~/hooks/`
- `@/lib/` → `~/lib/`
- `@/types/` → `~/types/`

---

## 不在 Phase 1 范围内

- Hono API 层迁移（Phase 2）
- Dexie → Drizzle/PostgreSQL（Phase 3）
- Better Auth（Phase 4）
- API route 内部逻辑变更
- 组件/Hooks 内部逻辑变更
