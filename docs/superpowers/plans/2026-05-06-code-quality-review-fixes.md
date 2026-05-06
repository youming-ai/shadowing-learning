# 代码质量审查修复计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复全局代码质量审查中识别的所有关键/重要/次要问题，提升代码一致性、可维护性和健壮性。

**Architecture:** 按优先级分层修复：Critical 问题优先（重复 aria-live、DB 迁移），Important 问题次之（函数签名冲突、速率限制绕过、日志统一、内存泄漏），Minor 问题最后（代码清理、性能微调）。每个任务独立可测试，失败不影响其他任务。

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Dexie (IndexedDB), Groq SDK, Biome, Tailwind CSS, Vitest + jsdom

---

## 文件变更概览

### 修改
- `src/components/features/player/ScrollableSubtitleDisplay.tsx` — 移除重复 aria-live，memoize activeIndex
- `src/lib/db/db.ts` — 修复 v3 迁移回调
- `src/lib/utils/error-handler.ts` — 移除冲突的 `apiError` 函数，修复 stack 捕获
- `src/app/api/postprocess/route.ts` — 使用 `getRateLimitConfig` 统一限流
- `src/lib/utils/manual-postprocess.ts` — 添加类型声明，dev-only 守卫
- `src/components/layout/contexts/TranscriptionLanguageContext.tsx` — SSR 返回 children 而非 null
- `src/app/api/performance/route.ts` — 添加 dev-only 文档注释
- `src/hooks/api/useTranscription.ts` — 替换 console.log 为 logger
- `src/lib/utils/file-status-manager.ts` — 替换 console.error 为 logger
- `src/components/layout/contexts/ThemeContext.tsx` — 替换 console.log 为 themeLogger
- `src/hooks/player/usePlayerDataQuery.ts` — 修复音频 URL 内存泄漏
- `src/lib/db/subtitle-sync.ts` — 移除未使用的 `_addFurigana`
- `src/lib/utils/retry-utils.ts` — 修复 CircuitBreaker 注释格式
- `src/components/layout/contexts/I18nContext.tsx` — 转义 regex 特殊字符

---

## Task 1: 移除重复 aria-live 区域 [Critical]

**Files:**
- Modify: `src/components/features/player/ScrollableSubtitleDisplay.tsx:242-251`

- [ ] **Step 1: 移除第二个 aria-live div**

在 `src/components/features/player/ScrollableSubtitleDisplay.tsx` 中，第 247-251 行是第 242-246 行的完全重复。删除第二个：

```tsx
// 保留这个（第 242-246 行）:
<div aria-live="polite" aria-atomic="true" className="sr-only" role="status">
  {isPlaying && activeIndex >= 0 && segments[activeIndex]
    ? segments[activeIndex].text
    : ""}
</div>

// 删除这个（第 247-251 行）:
<div aria-live="polite" aria-atomic="true" className="sr-only" role="status">
  {isPlaying && activeIndex >= 0 && segments[activeIndex]
    ? segments[activeIndex].text
    : ""}
</div>
```

- [ ] **Step 2: 运行测试验证**

```bash
pnpm test:run -- --reporter=verbose src/components/features/player
```
Expected: 所有 player 组件测试通过

- [ ] **Step 3: 运行类型检查**

```bash
pnpm type-check
```
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add src/components/features/player/ScrollableSubtitleDisplay.tsx
git commit -m "fix(a11y): remove duplicate aria-live region in ScrollableSubtitleDisplay"
```

---

## Task 2: 修复 DB v3 迁移回调 [Critical]

**Files:**
- Modify: `src/lib/db/db.ts:47-57`

- [ ] **Step 1: 检查当前 v3 迁移逻辑**

当前 v3 迁移回调只打印 debug 日志，未实际处理数据迁移：

```typescript
this.version(3)
  .stores({
    files: "++id, name, size, type, uploadedAt, [name+type]",
    // ...
  })
  .upgrade(async (_tx) => {
    // 只有 debug 日志，没有实际迁移
    dbLogger.debug("Database migrated to version 3");
  });
```

- [ ] **Step 2: 添加实际迁移逻辑**

v3 新增了 `normalizedText`, `translation`, `annotations`, `furigana` 字段。需要为现有 segment 记录设置默认值：

```typescript
this.version(3)
  .stores({
    files: "++id, name, size, type, uploadedAt, [name+type]",
    transcripts: "++id, fileId, status, language, createdAt, updatedAt",
    segments:
      "++id, transcriptId, start, end, text, wordTimestamps, normalizedText, translation, annotations, furigana, [transcriptId+start], [transcriptId+end]",
  })
  .upgrade(async (tx) => {
    dbLogger.debug("Database migrating to version 3: Adding enhanced transcription fields");
    try {
      const segmentsTable = tx.table("segments");
      await segmentsTable.toCollection().modify((segment: Record<string, unknown>) => {
        if (segment.normalizedText === undefined) segment.normalizedText = null;
        if (segment.translation === undefined) segment.translation = null;
        if (segment.annotations === undefined) segment.annotations = null;
        if (segment.furigana === undefined) segment.furigana = null;
      });
      dbLogger.debug("Database migration to version 3 complete");
    } catch (error) {
      dbLogger.error("Database migration to version 3 failed:", error);
      // 不抛出异常，允许 Dexie 自动处理缺失字段
    }
  });
```

- [ ] **Step 3: 运行数据库测试**

```bash
pnpm test:run -- --reporter=verbose src/__tests__/db-utils.test.ts
```
Expected: 所有 DB 测试通过

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/db.ts
git commit -m "fix(db): add actual data migration logic for v3 schema upgrade"
```

---

## Task 3: 解决 apiError 函数签名冲突 [Important]

**Files:**
- Modify: `src/lib/utils/error-handler.ts:219-226`

- [ ] **Step 1: 重命名 error-handler.ts 中的 apiError**

`src/lib/utils/error-handler.ts:220` 定义了一个返回 `AppError` 的 `apiError`，与 `src/lib/utils/api-response.ts:31` 定义的返回 `NextResponse` 的 `apiError` 同名。前者在代码库中未被直接使用（所有 API 路由都从 `api-response.ts` 导入）。

将 `error-handler.ts` 中的版本重命名为 `createApiError`：

```typescript
// 修改前:
export function apiError(
  message: string,
  statusCode: number = 500,
  details?: Record<string, unknown>,
): AppError {
  return createError("apiValidationError", message, details, statusCode);
}

// 修改后:
export function createApiError(
  message: string,
  statusCode: number = 500,
  details?: Record<string, unknown>,
): AppError {
  return createError("apiValidationError", message, details, statusCode);
}
```

- [ ] **Step 2: 检查是否有消费者导入此函数**

```bash
grep -rn "from.*error-handler.*apiError\|from.*error-handler.*{.*apiError" src --include="*.ts" --include="*.tsx"
```

如果没有找到引用，说明该函数未被使用，重命名是安全的。如果有引用，需要同步更新导入。

- [ ] **Step 3: 运行类型检查**

```bash
pnpm type-check
```
Expected: 无错误

- [ ] **Step 4: 运行 lint**

```bash
pnpm lint
```
Expected: 无新增警告

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/error-handler.ts
git commit -m "fix(utils): rename apiError to createApiError to avoid signature collision with api-response.ts"
```

---

## Task 4: 统一 postprocess 速率限制配置 [Important]

**Files:**
- Modify: `src/app/api/postprocess/route.ts:627-631`

- [ ] **Step 1: 检查当前速率限制实现**

当前代码绕过了 `rate-limiter.ts` 中的配置：

```typescript
// 当前（绕过配置）:
const clientKey = getClientIdentifier(request);
const rateLimit = checkRateLimit(clientKey, {
  windowMs: 60 * 1000,
  maxRequests: 20,
});
```

- [ ] **Step 2: 使用 getRateLimitConfig 统一配置**

修改为使用集中配置：

```typescript
const clientKey = getClientIdentifier(request);
const rateLimitConfig = getRateLimitConfig("/api/postprocess");
const rateLimit = checkRateLimit(`postprocess:${clientKey}`, rateLimitConfig);
```

需要在文件顶部确认 `getRateLimitConfig` 已导入。检查现有的 import 语句：

```typescript
import { checkRateLimit, getRateLimitConfig } from "@/lib/utils/rate-limiter";
```

如果 `getRateLimitConfig` 未导入，添加到现有导入中。

- [ ] **Step 3: 添加速率限制响应头**

在 `rateLimit.limited` 的返回中添加速率限制头信息（与 transcribe 路由一致）：

```typescript
if (rateLimit.limited) {
  return apiError({
    code: "RATE_LIMIT",
    message: "Too many postprocess requests",
    statusCode: 429,
    headers: {
      "X-RateLimit-Limit": String(rateLimitConfig.maxRequests),
      "X-RateLimit-Remaining": String(rateLimit.remaining),
      "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetTime / 1000)),
      "Retry-After": String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)),
    },
  });
}
```

- [ ] **Step 4: 运行测试**

```bash
pnpm test:run -- --reporter=verbose src/__tests__/api-route.test.ts
```
Expected: API 路由测试通过

- [ ] **Step 5: Commit**

```bash
git add src/app/api/postprocess/route.ts
git commit -m "fix(api): use centralized rate limit config for postprocess route"
```

---

## Task 5: 修复 error-handler stack 捕获 [Important]

**Files:**
- Modify: `src/lib/utils/error-handler.ts:58-65`

- [ ] **Step 1: 修复 stack 捕获逻辑**

当前实现创建一个无用的 Error 对象来获取 stack，但这个 stack 指向 `createError` 函数本身，不是实际错误来源：

```typescript
// 当前:
let stack: string | undefined;
try {
  const testError = new Error();
  stack = testError.stack;
} catch {
  stack = undefined;
}
```

修改为接受可选的 `cause` 参数：

```typescript
export function createError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
  statusCode: number = 500,
  cause?: Error,
): AppError {
  const errorCode = ErrorCodes[code];

  return {
    code: errorCode,
    message,
    details,
    statusCode,
    timestamp: Date.now(),
    stack: cause?.stack,
    cause: cause
      ? {
          message: cause.message,
          code: (cause as { code?: string }).code,
        }
      : undefined,
    context: {
      timestamp: Date.now(),
    },
  };
}
```

- [ ] **Step 2: 更新 handleError 中的调用**

在 `handleError` 函数中，将原始 error 作为 cause 传递：

```bash
grep -n "createError(" src/lib/utils/error-handler.ts
```

检查所有 `createError` 调用，确保在有原始 error 时传递 cause。

- [ ] **Step 3: 运行类型检查**

```bash
pnpm type-check
```
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add src/lib/utils/error-handler.ts
git commit -m "fix(utils): pass error cause to createError instead of creating dummy Error for stack"
```

---

## Task 6: 为 manual-postprocess 添加类型声明 [Important]

**Files:**
- Modify: `src/lib/utils/manual-postprocess.ts:157-162`

- [ ] **Step 1: 添加 Window 接口扩展**

在文件顶部添加类型声明：

```typescript
interface ManualPostProcessWindow extends Window {
  manualPostProcess: typeof manualPostProcess;
  retranslateFile: typeof retranslateFile;
  retranscribeFile: typeof retranscribeFile;
}

declare const window: ManualPostProcessWindow | undefined;
```

- [ ] **Step 2: 添加 dev-only 守卫**

将全局挂载包裹在 dev 环境检查中：

```typescript
// 修改前:
if (typeof window !== "undefined") {
  (window as any).manualPostProcess = manualPostProcess;
  (window as any).retranslateFile = retranslateFile;
  (window as any).retranscribeFile = retranscribeFile;
}

// 修改后:
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const win = window as unknown as ManualPostProcessWindow;
  win.manualPostProcess = manualPostProcess;
  win.retranslateFile = retranslateFile;
  win.retranscribeFile = retranscribeFile;
}
```

- [ ] **Step 3: 运行类型检查**

```bash
pnpm type-check
```
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add src/lib/utils/manual-postprocess.ts
git commit -m "fix(utils): add typed Window declaration for debug helpers, restrict to dev-only"
```

---

## Task 7: 修复 TranscriptionLanguageProvider SSR 闪烁 [Important]

**Files:**
- Modify: `src/components/layout/contexts/TranscriptionLanguageContext.tsx:148-151`

- [ ] **Step 1: 修改 SSR 分支返回 children**

当前 SSR 返回 `null`，导致所有子组件在服务端渲染为空：

```typescript
// 当前:
if (!isClient) {
  return null;
}
```

修改为返回带默认值的 Provider：

```typescript
if (!isClient) {
  return (
    <TranscriptionLanguageContext.Provider
      value={{
        learningLanguage: null,
        setLearningLanguage: () => {},
        getSupportedLanguages: () => SUPPORTED_LANGUAGES,
        getTranscriptionLanguages: () => SUPPORTED_LANGUAGES,
      }}
    >
      {children}
    </TranscriptionLanguageContext.Provider>
  );
}
```

- [ ] **Step 2: 运行测试**

```bash
pnpm test:run -- --reporter=verbose src/__tests__
```
Expected: 所有测试通过

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/contexts/TranscriptionLanguageContext.tsx
git commit -m "fix(context): return children with default value during SSR instead of null"
```

---

## Task 8: 统一日志系统 [Important]

**Files:**
- Modify: `src/hooks/api/useTranscription.ts:132-134,140`
- Modify: `src/lib/utils/file-status-manager.ts:42,85,138`
- Modify: `src/components/layout/contexts/ThemeContext.tsx:88,120,133,149`
- Modify: `src/lib/utils/manual-postprocess.ts` (多处 console.log/error)

- [ ] **Step 1: 为 useTranscription.ts 添加 logger 导入并替换**

```typescript
// 在文件顶部添加:
import { transcriptionLogger } from "@/lib/utils/logger";

// 替换第 132-134 行:
// 修改前:
console.log(
  `✅ 转录结果保存完成 (文件ID: ${fileId}) - 耗时: ${processingTime}ms, segments: ${data.segments?.length || 0}`,
);

// 修改后:
transcriptionLogger.info(
  `转录结果保存完成 (文件ID: ${fileId}) - 耗时: ${processingTime}ms, segments: ${data.segments?.length || 0}`,
);

// 替换第 140 行:
// 修改前:
console.error(`❌ 转录结果保存失败 (文件ID: ${fileId}) - 耗时: ${processingTime}ms`, error);

// 修改后:
transcriptionLogger.error(
  `转录结果保存失败 (文件ID: ${fileId}) - 耗时: ${processingTime}ms`,
  error,
);
```

- [ ] **Step 2: 为 file-status-manager.ts 添加 logger 导入并替换**

```typescript
// 在文件顶部添加:
import { dbLogger } from "@/lib/utils/logger";

// 替换所有 console.error/console.log:
// 第 42 行:
// 修改前: console.error("获取文件真实状态失败:", error);
// 修改后: dbLogger.error("获取文件真实状态失败:", error);

// 第 85 行和第 138 行类似处理
```

- [ ] **Step 3: ThemeContext.tsx 已有 themeLogger，替换 console 调用**

```typescript
// ThemeContext.tsx 已导入 themeLogger，替换所有 console.log:
// 第 88 行: console.log("🎨 Theme applied:", {...})
// 修改为: themeLogger.debug("Theme applied:", {...})

// 第 120 行: console.log("🔄 System theme changed:", {...})
// 修改为: themeLogger.debug("System theme changed:", {...})

// 第 133 行: console.log("📱 System theme listener active:", {...})
// 修改为: themeLogger.debug("System theme listener active:", {...})

// 第 149 行: console.log("💾 Theme saved to localStorage:", {...})
// 修改为: themeLogger.debug("Theme saved to localStorage:", {...})
```

- [ ] **Step 4: manual-postprocess.ts 替换 console 调用**

```typescript
// 在文件顶部添加:
import { transcriptionLogger } from "@/lib/utils/logger";

// 替换所有 console.log/console.error（搜索文件中所有 console 调用）
```

- [ ] **Step 5: 运行 lint 和类型检查**

```bash
pnpm lint && pnpm type-check
```
Expected: 无错误

- [ ] **Step 6: Commit**

```bash
git add src/hooks/api/useTranscription.ts src/lib/utils/file-status-manager.ts src/components/layout/contexts/ThemeContext.tsx src/lib/utils/manual-postprocess.ts
git commit -m "fix(logging): replace raw console calls with structured logger instances"
```

---

## Task 9: 修复音频 URL 内存泄漏 [Important]

**Files:**
- Modify: `src/hooks/player/usePlayerDataQuery.ts:103-110`

- [ ] **Step 1: 修复 cleanup effect 逻辑**

当前 effect 只在 `file?.blob` 引用变化时清理，但组件卸载时如果 blob 引用未变则不会清理：

```typescript
// 当前:
useEffect(() => {
  const blob = file?.blob;
  return () => {
    if (blob) {
      revokeAudioUrl(blob);
    }
  };
}, [file?.blob]);
```

修改为使用 ref 跟踪当前 blob，确保卸载时总是清理：

```typescript
const currentBlobRef = useRef<Blob | undefined>(undefined);

useEffect(() => {
  const blob = file?.blob;
  currentBlobRef.current = blob;

  return () => {
    // 总是清理当前 blob 的 URL，无论引用是否变化
    if (blob) {
      revokeAudioUrl(blob);
    }
  };
}, [blob]);

// 卸载时的额外保护
useEffect(() => {
  return () => {
    if (currentBlobRef.current) {
      revokeAudioUrl(currentBlobRef.current);
    }
  };
}, []); // 空依赖，只在卸载时运行
```

需要在文件顶部确认 `useRef` 已从 React 导入。

- [ ] **Step 2: 运行测试**

```bash
pnpm test:run -- --reporter=verbose src/__tests__/player-hooks.test.ts
```
Expected: hooks 测试通过

- [ ] **Step 3: Commit**

```bash
git add src/hooks/player/usePlayerDataQuery.ts
git commit -m "fix(hooks): ensure audio URL cleanup on unmount even when blob reference unchanged"
```

---

## Task 10: 添加 performance/route.ts dev-only 文档 [Important]

**Files:**
- Modify: `src/app/api/performance/route.ts:1-11`

- [ ] **Step 1: 添加限制说明注释**

```typescript
/**
 * 性能指标收集 API
 * 用于接收和存储客户端性能数据
 *
 * ⚠️ 限制说明:
 * - 使用内存 Map 存储，serverless/edge 环境下冷启动会重置
 * - 仅适用于开发环境和短期调试
 * - 生产环境应使用外部数据库或监控服务
 * - GET 端点在开发模式下无认证
 */

import { type NextRequest, NextResponse } from "next/server";
import { apiSuccess } from "@/lib/utils/api-response";
import { performanceLogger } from "@/lib/utils/logger";

export const runtime = "nodejs";

// ⚠️ 内存存储：serverless 环境下冷启动会丢失数据
const performanceStore = new Map<string, StoredPerformanceData[]>();
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/performance/route.ts
git commit -m "docs(api): add limitation comments for in-memory performance store"
```

---

## Task 11: memoize ScrollableSubtitleDisplay activeIndex [Minor]

**Files:**
- Modify: `src/components/features/player/ScrollableSubtitleDisplay.tsx:139-141,194`

- [ ] **Step 1: 使用 useMemo 替代重复调用**

当前 `findActiveSegmentIndex()` 在 useEffect 和 render 中各调用一次：

```typescript
// 第 139-141 行定义:
const findActiveSegmentIndex = useCallback(() => {
  return findActiveSegmentIndexBinary(segments, safeCurrentTime);
}, [segments, safeCurrentTime]);

// 第 194 行在 render 中调用:
const activeIndex = findActiveSegmentIndex();
```

修改为使用 useMemo 计算一次：

```typescript
// 替换第 139-141 行和第 194 行:
const activeIndex = useMemo(() => {
  return findActiveSegmentIndexBinary(segments, safeCurrentTime);
}, [segments, safeCurrentTime]);

// 保留 findActiveSegmentIndex 供 useEffect 使用（或直接在 useEffect 中使用 activeIndex）
```

同时更新 useEffect 依赖：

```typescript
useEffect(() => {
  // 使用 activeIndex 替代 findActiveSegmentIndex()
  if (activeIndex === previousActiveIndex.current || activeIndex === -1) {
    return;
  }
  // ... 其余逻辑不变
}, [activeIndex, isPlaying]);
```

- [ ] **Step 2: 运行测试**

```bash
pnpm test:run -- --reporter=verbose src/components/features/player
```
Expected: 测试通过

- [ ] **Step 3: Commit**

```bash
git add src/components/features/player/ScrollableSubtitleDisplay.tsx
git commit -m "perf(subtitle): memoize activeIndex to avoid duplicate computation per render"
```

---

## Task 12: 移除未使用的 _addFurigana 包装器 [Minor]

**Files:**
- Modify: `src/lib/db/subtitle-sync.ts:303-306`

- [ ] **Step 1: 删除未使用的函数**

```typescript
// 删除以下代码（第 303-306 行）:
// keep原有 addFurigana 函数Used for向后兼容
function _addFurigana(text: string, furigana: string): string {
  return addSafeFurigana(text, furigana);
}
```

- [ ] **Step 2: 运行 lint 确认无未使用变量警告**

```bash
pnpm lint
```
Expected: 无新增警告

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/subtitle-sync.ts
git commit -m "chore(db): remove unused _addFurigana backward-compat wrapper"
```

---

## Task 13: 修复 CircuitBreaker 注释格式 [Minor]

**Files:**
- Modify: `src/lib/utils/retry-utils.ts:165-168`

- [ ] **Step 1: 修复注释格式**

当前注释与代码混在一起，难以阅读：

```typescript
// 当前:
constructor(
  private readonly failureThreshold: number = 5,
  private readonly resetTimeout: number = 60000, // 1 minutereadonly _monitoringPeriod: number = 60000 // 1 minute
) {}
```

修复为：

```typescript
constructor(
  private readonly failureThreshold: number = 5,
  private readonly resetTimeout: number = 60000, // 1 minute
) {}
```

`_monitoringPeriod` 已被注释掉且不在参数列表中，只需清理注释格式。

- [ ] **Step 2: Commit**

```bash
git add src/lib/utils/retry-utils.ts
git commit -m "chore(utils): fix CircuitBreaker constructor comment formatting"
```

---

## Task 14: 转义 I18nContext regex 特殊字符 [Minor]

**Files:**
- Modify: `src/components/layout/contexts/I18nContext.tsx:44-46`

- [ ] **Step 1: 添加 regex 转义**

当前实现直接将参数名插入正则表达式：

```typescript
// 当前:
Object.entries(params).forEach(([param, value]) => {
  translation = translation.replace(new RegExp(`{{${param}}}`, "g"), String(value));
});
```

如果 `param` 包含 regex 特殊字符（如 `$`, `.`, `*`），会导致正则异常。添加转义：

```typescript
Object.entries(params).forEach(([param, value]) => {
  const escaped = param.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  translation = translation.replace(new RegExp(`{{${escaped}}}`, "g"), String(value));
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/contexts/I18nContext.tsx
git commit -m "fix(i18n): escape regex special characters in parameter names"
```

---

## Task 15: 最终验证

- [ ] **Step 1: 运行完整 lint 检查**

```bash
pnpm lint
```
Expected: 无错误，无新增警告

- [ ] **Step 2: 运行完整类型检查**

```bash
pnpm type-check
```
Expected: 无错误

- [ ] **Step 3: 运行完整测试套件**

```bash
pnpm test:run
```
Expected: 所有测试通过

- [ ] **Step 4: 运行构建**

```bash
pnpm build
```
Expected: 构建成功

- [ ] **Step 5: 最终 Commit（如果有遗漏的修复）**

```bash
git add -A
git commit -m "chore: final verification and cleanup for code quality fixes"
```

---

## 执行优先级

| 优先级 | Task | 问题类型 | 影响 |
|--------|------|----------|------|
| P0 | Task 1 | Critical | 屏幕阅读器重复播报 |
| P0 | Task 2 | Critical | 数据库迁移不完整 |
| P1 | Task 3 | Important | 函数签名冲突 |
| P1 | Task 4 | Important | 速率限制绕过 |
| P1 | Task 5 | Important | 错误堆栈不准确 |
| P1 | Task 6 | Important | 全局作用域污染 |
| P1 | Task 7 | Important | SSR 内容闪烁 |
| P1 | Task 8 | Important | 日志不一致 |
| P1 | Task 9 | Important | 内存泄漏 |
| P1 | Task 10 | Important | 文档缺失 |
| P2 | Task 11 | Minor | 性能微调 |
| P2 | Task 12 | Minor | 代码清理 |
| P2 | Task 13 | Minor | 注释格式 |
| P2 | Task 14 | Minor | 潜在 regex 问题 |
| P3 | Task 15 | 验证 | 最终检查 |
